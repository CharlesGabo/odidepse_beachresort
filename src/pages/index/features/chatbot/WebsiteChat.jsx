import { useEffect, useRef, useState } from 'react';
import { useResort } from '../../../../shared/resort/ResortContent.jsx';
import { StayPhotoModal, stayPhotoSource } from '../../../../shared/stay-photos/StayPhotos.jsx';
import './website-chat.css';

function ChatText({ text }) {
  return String(text || '').split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith('**') && part.endsWith('**')
    ? <strong key={index}>{part.slice(2, -2)}</strong>
    : part);
}

export default function WebsiteChat({ onDraft, onBook, refresh }) {
  const { copy } = useResort();
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [data, setData] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [contactOpen, setContactOpen] = useState(false);
  const [photoViewer, setPhotoViewer] = useState(null);
  const launcher = useRef(null);
  const input = useRef(null);
  const thread = useRef(null);
  const sending = useRef(false);
  const close = () => {
    setFullscreen(false);
    setContactOpen(false);
    setOpen(false);
    requestAnimationFrame(() => launcher.current?.focus());
  };
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
  useEffect(() => {
    if (open && window.matchMedia('(min-width: 769px) and (pointer: fine)').matches) input.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!input.current) return;
    input.current.style.height = '';
    if (message !== '') input.current.style.height = `${Math.min(input.current.scrollHeight, 180)}px`;
  }, [message]);
  useEffect(() => {
    if (!fullscreen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [fullscreen]);
  useEffect(() => { if (thread.current) thread.current.scrollTop = thread.current.scrollHeight; }, [data, busy]);
  const send = async (text, action = 'message') => {
    if (sending.current || !data || !text.trim()) return;
    sending.current = true; setBusy(true); setError('');
    try {
      const response = await fetch('/api/chat.php', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Chat-CSRF': data.csrf }, body: JSON.stringify({ action, message: text }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Please try again.');
      setData(result); setMessage('');
      if (result.action === 'open_booking') {
        setFullscreen(false);
        setContactOpen(false);
        setOpen(false);
        onDraft({ ...result.draft, csrf: result.csrf });
      }
    } catch (err) { setError(err.message); }
    finally { sending.current = false; setBusy(false); }
  };
  const contactEmail = String(copy.links.email || '').replace(/^mailto:/i, '').split('?')[0];
  return <div className={`website-chat${open ? ' is-open' : ''}`}>
    <button ref={launcher} className="website-chat-launcher" type="button" aria-expanded={open} aria-controls="website-chat-panel" onClick={() => open ? close() : setOpen(true)}>Chat with us <span aria-hidden="true">✦</span></button>
    {open && <section id="website-chat-panel" className={`website-chat-panel${fullscreen ? ' is-fullscreen' : ''}`} role="dialog" aria-modal={fullscreen || undefined} aria-label="Odidepse resort assistant" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); fullscreen ? setFullscreen(false) : close(); } }}>
      <header>
        <div><strong>Odidepse assistant</strong><small>Plan your beach stay</small></div>
        <div className="website-chat-header-actions">
          <button className="website-chat-fullscreen" type="button" aria-pressed={fullscreen} aria-label={fullscreen ? 'Exit fullscreen chat' : 'Open fullscreen chat'} title={fullscreen ? 'Exit fullscreen' : 'Open fullscreen'} onClick={() => setFullscreen(value => !value)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={fullscreen ? 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5' : 'M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5'} /></svg>
          </button>
          <button type="button" onClick={close} aria-label="Close chat">×</button>
        </div>
      </header>
      <p className="website-chat-notice">AI may help with general questions. Bookings require staff approval. Please don’t share payment details.</p>
      <div className="website-chat-thread" ref={thread} role="log" aria-live="polite" aria-relevant="additions text">
        {!(data?.history?.length) && <p className="website-chat-bubble">{data?.greeting || 'Welcome! Loading your resort assistant…'}</p>}
        {data?.history?.map((item, index) => <article className={`website-chat-bubble ${item.role === 'visitor' ? 'is-visitor' : ''}`} key={index}>
          <span className="website-chat-speaker">{item.role === 'visitor' ? 'You' : 'Assistant'}</span><ChatText text={item.text} />
          {item.role === 'assistant' && item.photos?.length > 0 && <div className="website-chat-photos" aria-label={`${item.photo_name || 'Suggested room'} photos`}>
            {item.photos.map((photo, photoIndex) => <button type="button" onClick={() => setPhotoViewer({ photos: item.photos, name: item.photo_name || 'Suggested room', index: photoIndex })} aria-label={`Open ${item.photo_name || 'suggested room'} photo ${photoIndex + 1}`} key={photo}>
              <img src={stayPhotoSource(photo)} alt={`${item.photo_name || 'Suggested room'}, photo ${photoIndex + 1}`} loading="lazy" decoding="async" />
            </button>)}
          </div>}
        </article>)}
        {busy && <p role="status">Preparing your reply…</p>}
      </div>
      <div className="website-chat-actions">
        <button type="button" className="website-chat-contact-button" aria-expanded={contactOpen} aria-controls="website-chat-contact" onClick={() => setContactOpen(value => !value)}>{contactOpen ? 'Hide contact' : 'Contact'}</button>
        {(data?.quickActions || []).map(text => <button type="button" key={text} disabled={busy} onClick={() => send(text)}>{text}</button>)}
        {(data?.handoff || error) && <><a href={copy.links.email}>Email us</a><a href="https://www.facebook.com/profile.php?id=61576647053739" target="_blank" rel="noreferrer">Facebook</a><button type="button" onClick={() => { setFullscreen(false); setContactOpen(false); setOpen(false); onBook(); }}>Booking form</button></>}
      </div>
      {contactOpen && <aside className="website-chat-contact" id="website-chat-contact" aria-label="Resort contact information"><div><strong>Contact Odidepse</strong><small>Our resort team can help with bookings and questions.</small></div><a href={copy.links.email}><span>Email</span><strong>{contactEmail}</strong></a><a href="https://www.facebook.com/profile.php?id=61576647053739" target="_blank" rel="noreferrer"><span>Messenger</span><strong>Odidepse Beach Resort</strong></a></aside>}
      {error && <p className="website-chat-error" role="alert">{error}</p>}
      <form onSubmit={event => { event.preventDefault(); send(message); }}><label className="website-chat-speaker" htmlFor="website-chat-message">Your message</label><div><textarea ref={input} id="website-chat-message" rows="3" maxLength={2000} value={message} onChange={event => setMessage(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Ask about rooms, or type BOOKING" /><button type="submit" disabled={busy || !data || !message.trim()}>Send</button></div></form>
      <button className="website-chat-reset" type="button" disabled={busy || !data} onClick={() => send('RESTART', 'reset')}>Start a new chat</button>
    </section>}
    {photoViewer && <StayPhotoModal photos={photoViewer.photos} name={photoViewer.name} initialIndex={photoViewer.index} onClose={() => setPhotoViewer(null)} />}
  </div>;
}
