import { useEffect, useRef, useState } from 'react';
import { useResort } from './ResortContent.jsx';
import './website-chat.css';

export default function WebsiteChat({ onDraft, onBook, refresh }) {
  const { copy } = useResort();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const launcher = useRef(null);
  const input = useRef(null);
  const thread = useRef(null);
  const sending = useRef(false);
  const close = () => { setOpen(false); launcher.current?.focus(); };
  useEffect(() => {
    if (!open && !refresh) return;
    const controller = new AbortController();
    fetch('/api/chat.php', { signal: controller.signal, cache: 'no-store' }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setData(result); setError('');
    }).catch(err => { if (err.name !== 'AbortError') setError('Chat is unavailable. Please use the booking form.'); });
    return () => controller.abort();
  }, [open, refresh]);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  useEffect(() => { if (thread.current) thread.current.scrollTop = thread.current.scrollHeight; }, [data, busy]);
  const send = async (text, action = 'message') => {
    if (sending.current || !data || !text.trim()) return;
    sending.current = true; setBusy(true); setError('');
    try {
      const response = await fetch('/api/chat.php', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Chat-CSRF': data.csrf }, body: JSON.stringify({ action, message: text }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Please try again.');
      setData(result); setMessage('');
      if (result.action === 'open_booking') { setOpen(false); onDraft({ ...result.draft, csrf: result.csrf }); }
    } catch (err) { setError(err.message); }
    finally { sending.current = false; setBusy(false); }
  };
  return <div className="website-chat">
    <button ref={launcher} className="website-chat-launcher" type="button" aria-expanded={open} aria-controls="website-chat-panel" onClick={() => open ? close() : setOpen(true)}>Chat with us <span aria-hidden="true">✦</span></button>
    {open && <section id="website-chat-panel" className="website-chat-panel" role="dialog" aria-label="Odidepse resort assistant" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
      <header><div><strong>Odidepse assistant</strong><small>Plan your beach stay</small></div><button type="button" onClick={close} aria-label="Close chat">×</button></header>
      <p className="website-chat-notice">AI may help with general questions. Bookings require staff approval. Please don’t share payment details.</p>
      <div className="website-chat-thread" ref={thread} role="log" aria-live="polite" aria-relevant="additions text">
        {!(data?.history?.length) && <p className="website-chat-bubble">{data?.greeting || 'Welcome! Loading your resort assistant…'}</p>}
        {data?.history?.map((item, index) => <p className={`website-chat-bubble ${item.role === 'visitor' ? 'is-visitor' : ''}`} key={index}><span className="website-chat-speaker">{item.role === 'visitor' ? 'You' : 'Assistant'}</span>{item.text}</p>)}
        {busy && <p role="status">Preparing your reply…</p>}
      </div>
      <div className="website-chat-actions">{(data?.quickActions || []).map(text => <button type="button" key={text} disabled={busy} onClick={() => send(text)}>{text}</button>)}</div>
      {(data?.handoff || error) && <div className="website-chat-actions"><a href={copy.links.email}>Email us</a><a href="https://www.facebook.com/profile.php?id=61576647053739" target="_blank" rel="noreferrer">Facebook</a><button type="button" onClick={() => { setOpen(false); onBook(); }}>Booking form</button></div>}
      {error && <p className="website-chat-error" role="alert">{error}</p>}
      <form onSubmit={event => { event.preventDefault(); send(message); }}><label className="website-chat-speaker" htmlFor="website-chat-message">Your message</label><div><textarea ref={input} id="website-chat-message" rows="2" maxLength={2000} value={message} onChange={event => setMessage(event.target.value)} placeholder="Ask about rooms, or type BOOKING" /><button type="submit" disabled={busy || !data || !message.trim()}>Send</button></div></form>
      <button className="website-chat-reset" type="button" disabled={busy || !data} onClick={() => send('RESTART', 'reset')}>Start a new chat</button>
    </section>}
  </div>;
}
