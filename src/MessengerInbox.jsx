import { useEffect, useRef, useState } from 'react';
import './messenger-inbox.css';

function ChatIcon({ name }) {
  const paths = {
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    back: <path d="m14 5-7 7 7 7M7 12h14" />,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7v1" /></>,
    chat: <path d="M21 11.5a9 9 0 0 1-9 9 10 10 0 0 1-4-.9L3 21l1.4-4.6A9 9 0 1 1 21 11.5Z M7 11h10M7 15h6" />,
    send: <path d="m3 3 19 9-19 9 4-9-4-9Zm4 9h15" />,
    smile: <><circle cx="12" cy="12" r="9" /><path d="M8 14s1 3 4 3 4-3 4-3M8 8v2M16 8v2" /></>,
  };
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Avatar({ name }) {
  return <span className="messenger-avatar" aria-hidden="true">{Array.from(name || '?')[0].toUpperCase()}</span>;
}

const chatDate = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const timestamp = value => value && Number.isFinite(Date.parse(value)) ? chatDate.format(new Date(value)) : 'Time unavailable';

export default function MessengerInbox({ records, total, renderDetails }) {
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState(null);
  const [mobileThread, setMobileThread] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const scrollRef = useRef(null);
  const backRef = useRef(null);
  const listRef = useRef(null);
  const grouped = new Map();
  // Names are not identities. Keep manual entries separate without a Page sender ID.
  [...records].sort((a, b) => Number(b.id) - Number(a.id)).forEach(item => {
    const key = item.source === 'facebook' && item.page_id && item.sender_id
      ? `${item.page_id}:${item.sender_id}` : `entry:${item.id}`;
    if (!grouped.has(key)) grouped.set(key, { key, name: item.guest_name || 'Messenger guest', latest: item, messages: [] });
    grouped.get(key).messages.unshift(item);
  });
  const query = search.trim().toLocaleLowerCase();
  const chats = [...grouped.values()].map(chat => {
    const timeline = chat.messages.flatMap(item => [
      { key: `incoming:${item.id}`, body: item.body, at: item.message_at, outgoing: false },
      ...(item.sent_replies || []).map(reply => ({ key: `reply:${reply.id}`, body: reply.body, at: reply.sent_at, outgoing: true })),
    ]).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    return { ...chat, timeline, preview: timeline[timeline.length - 1] };
  }).sort((a, b) => Date.parse(b.preview.at) - Date.parse(a.preview.at))
    .filter(chat => !query || chat.name.toLocaleLowerCase().includes(query)
      || chat.timeline.some(item => item.body.toLocaleLowerCase().includes(query)));
  const selected = chats.find(chat => chat.key === selectedKey) || chats[0];
  const lastId = selected?.preview.key;
  const messageCount = selected?.timeline.length;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [selected?.key, lastId, messageCount]);

  function selectChat(key) {
    setSelectedKey(key); setMobileThread(true); setShowDetails(false);
    requestAnimationFrame(() => {
      if (backRef.current?.getClientRects().length) backRef.current.focus();
    });
  }

  return <div className={`messenger-inbox${mobileThread && selected ? ' messenger-inbox--thread' : ''}`}>
    <aside className="messenger-sidebar" aria-label="Recorded conversations">
      <div className="messenger-sidebar-top"><div className="messenger-title"><h2>Chats</h2><span className="messenger-brand"><ChatIcon name="chat" /></span></div>
        <label className="messenger-search"><ChatIcon name="search" /><input ref={listRef} type="search" aria-label="Search loaded chats" placeholder="Search chats" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <div className="messenger-list-caption"><span>Recent conversations</span><span>{chats.length}</span></div>
      </div>
      <div className="messenger-chat-list">
        {chats.map(chat => <button type="button" className={`messenger-chat${selected?.key === chat.key ? ' messenger-chat--selected' : ''}`} key={chat.key} aria-current={selected?.key === chat.key ? 'true' : undefined} onClick={() => selectChat(chat.key)}>
          <Avatar name={chat.name} /><span className="messenger-chat-copy"><strong>{chat.name}</strong><span>{chat.preview.outgoing ? 'You: ' : ''}{chat.preview.body}</span><small>{timestamp(chat.preview.at)}</small></span>
          {chat.messages.some(item => Number(item.needs_attention)) && <span className="messenger-attention" role="img" aria-label="Needs staff attention" />}
        </button>)}
        {!chats.length && <div className="messenger-placeholder"><ChatIcon name="chat" /><h3>{query ? 'No matching chats' : 'Your inbox starts here'}</h3><p>{query ? 'Try another name or message.' : 'Recorded Messenger inquiries will appear here.'}</p></div>}
      </div>
      <p className="messenger-list-note">{records.length} of {total} recorded messages loaded. Search and conversations cover this page only.</p>
    </aside>
    <section className="messenger-conversation" aria-label={selected ? `Conversation with ${selected.name}` : 'Conversation'}>
      {selected ? <>
        <header className="messenger-thread-header">
          <button ref={backRef} className="messenger-icon-button messenger-back" type="button" aria-label="Back to chats" onClick={() => { setMobileThread(false); requestAnimationFrame(() => listRef.current?.focus()); }}><ChatIcon name="back" /></button>
          <Avatar name={selected.name} /><div className="messenger-person"><h3>{selected.name}</h3><small>{selected.latest.source === 'manual' ? 'Manually recorded inquiry' : 'Facebook Page conversation'}</small></div>
          <button className="messenger-icon-button" type="button" aria-label="Conversation details" aria-expanded={showDetails} aria-controls="messenger-details" onClick={() => setShowDetails(value => !value)}><ChatIcon name="info" /></button>
        </header>
        <div className="messenger-messages" ref={scrollRef} tabIndex={0} aria-label="Recorded conversation messages">
          <div className="messenger-history-note">Recorded messages and sent automated replies. Replies made directly in Facebook and full history are not synced yet.</div>
          {selected.timeline.map(item => <article className={`messenger-message${item.outgoing ? ' messenger-message--outgoing' : ''}`} key={item.key} aria-label={item.outgoing ? 'Your automated reply' : 'Guest message'}>
            <time className="messenger-message-time">{timestamp(item.at)}</time>
            <div className="messenger-bubble-row">{!item.outgoing && <Avatar name={selected.name} />}<p className="messenger-bubble">{item.body}</p></div>
            {item.outgoing && <small className="messenger-sent-label">Sent · Automated reply</small>}
          </article>)}
        </div>
        <div className="messenger-composer"><div className="messenger-compose-row"><span className="messenger-compose-icon"><ChatIcon name="chat" /></span><div className="messenger-input-shell"><input aria-label="Reply unavailable" placeholder="Aa" disabled aria-describedby="messenger-reply-note" /><ChatIcon name="smile" /></div><button type="button" className="messenger-icon-button" disabled aria-label="Send message unavailable"><ChatIcon name="send" /></button></div><p id="messenger-reply-note">Replying from this inbox is not available yet.</p></div>
      </> : <div className="messenger-placeholder messenger-welcome"><span className="messenger-welcome-icon"><ChatIcon name="chat" /></span><h3>Your conversations, in one place</h3><p>Select a chat to view its recorded messages.</p></div>}
    </section>
    {selected && showDetails && <section id="messenger-details" className="messenger-details" aria-label="Inquiry management"><div className="fb-row"><h3>Inquiry details</h3><button type="button" onClick={() => setShowDetails(false)}>Close details</button></div>{selected.messages.map(item => renderDetails(item))}</section>}
  </div>;
}
