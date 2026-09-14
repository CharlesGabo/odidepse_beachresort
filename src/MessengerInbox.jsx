import { useEffect, useRef, useState } from 'react';
import './messenger-inbox.css';

function ChatIcon({ name }) {
  const paths = {
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    back: <path d="m14 5-7 7 7 7M7 12h14" />,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7v1" /></>,
    chat: <path d="M21 11.5a9 9 0 0 1-9 9 10 10 0 0 1-4-.9L3 21l1.4-4.6A9 9 0 1 1 21 11.5Z M7 11h10M7 15h6" />,
    send: <path d="m3 3 19 9-19 9 4-9-4-9Zm4 9h15" />,
    down: <path d="m6 9 6 6 6-6" />,
    smile: <><circle cx="12" cy="12" r="9" /><path d="M8 14s1 3 4 3 4-3 4-3M8 8v2M16 8v2" /></>,
  };
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Avatar({ name }) {
  return <span className="messenger-avatar" aria-hidden="true">{Array.from(name || '?')[0].toUpperCase()}</span>;
}

const chatDate = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const chatDay = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric' });
const chatTime = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
const timestamp = value => value && Number.isFinite(Date.parse(value)) ? chatDate.format(new Date(value)) : 'Time unavailable';
const dayLabel = value => value && Number.isFinite(Date.parse(value)) ? chatDay.format(new Date(value)) : 'Date unavailable';
const timeLabel = value => value && Number.isFinite(Date.parse(value)) ? chatTime.format(new Date(value)) : 'Time unavailable';

export default function MessengerInbox({ records, total, renderDetails, connected, busy, onSend }) {
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState(null);
  const [mobileThread, setMobileThread] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [reply, setReply] = useState('');
  const [pendingReplies, setPendingReplies] = useState([]);
  const [showScrollDown, setShowScrollDown] = useState(false);
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
    const recordedTimeline = chat.messages.flatMap(item => [
      { key: `incoming:${item.id}`, body: item.body, type: (item.attachments || []).length > 1 ? 'gallery' : item.attachment_url && (item.attachment_type === 'sticker' || item.attachment_url.includes('/t39.1997-6/')) ? 'sticker' : item.attachment_type === 'image' && item.attachment_url ? 'image' : 'text', photos: item.attachments || [], photoUrl: item.attachment_url || '', at: item.message_at, outgoing: false },
      ...(item.sent_replies || []).map(reply => ({ key: `reply:${reply.id}`, body: reply.body, type: reply.type || 'text', origin: reply.origin || 'automated', photoUrl: reply.photo_url || '', at: reply.sent_at, outgoing: true })),
    ]);
    const localReplies = pendingReplies.filter(item => item.conversationKey === chat.key && !recordedTimeline.some(recorded => recorded.origin === 'staff' && recorded.body === item.body && Date.parse(recorded.at) >= Date.parse(item.at) - 2000));
    const timeline = [...recordedTimeline, ...localReplies].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    return { ...chat, timeline, preview: timeline[timeline.length - 1] };
  }).sort((a, b) => Date.parse(b.preview.at) - Date.parse(a.preview.at))
    .filter(chat => !query || chat.name.toLocaleLowerCase().includes(query)
      || chat.timeline.some(item => item.body.toLocaleLowerCase().includes(query)));
  const selected = chats.find(chat => chat.key === selectedKey) || chats[0];
  const lastId = selected?.preview.key;
  const messageCount = selected?.timeline.length;
  const canReply = Boolean(connected && selected?.latest.source === 'facebook' && selected.latest.page_id && selected.latest.sender_id && selected.latest.status !== 'resolved');

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    setShowScrollDown(false);
  }, [selected?.key, lastId, messageCount]);

  useEffect(() => { setReply(''); }, [selected?.key]);

  useEffect(() => {
    if (!previewPhoto) return undefined;
    const navigatePreview = event => {
      if (event.key === 'Escape') setPreviewPhoto(null);
      if (event.key === 'ArrowLeft') setPreviewPhoto(current => current && current.photos.length > 1 ? { ...current, index: (current.index - 1 + current.photos.length) % current.photos.length } : current);
      if (event.key === 'ArrowRight') setPreviewPhoto(current => current && current.photos.length > 1 ? { ...current, index: (current.index + 1) % current.photos.length } : current);
    };
    document.addEventListener('keydown', navigatePreview);
    return () => document.removeEventListener('keydown', navigatePreview);
  }, [previewPhoto]);

  function openPreview(photos, index = 0) {
    setPreviewPhoto({ photos, index });
  }

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
      <p className="messenger-list-note">{chats.length} conversations · {records.length} of {total} recent messages loaded.</p>
    </aside>
    <section className="messenger-conversation" aria-label={selected ? `Conversation with ${selected.name}` : 'Conversation'}>
      {selected ? <>
        <header className="messenger-thread-header">
          <button ref={backRef} className="messenger-icon-button messenger-back" type="button" aria-label="Back to chats" onClick={() => { setMobileThread(false); requestAnimationFrame(() => listRef.current?.focus()); }}><ChatIcon name="back" /></button>
          <Avatar name={selected.name} /><div className="messenger-person"><h3>{selected.name}</h3><small>{selected.latest.source === 'manual' ? 'Manually recorded inquiry' : 'Facebook Page conversation'}</small></div>
          <button className="messenger-icon-button" type="button" aria-label="Conversation details" aria-expanded={showDetails} aria-controls="messenger-details" onClick={() => setShowDetails(value => !value)}><ChatIcon name="info" /></button>
        </header>
        <div className="messenger-message-stage">
        <div className="messenger-messages" ref={scrollRef} tabIndex={0} aria-label="Recorded conversation messages" onScroll={event => {
          const panel = event.currentTarget;
          setShowScrollDown(panel.scrollHeight - panel.scrollTop - panel.clientHeight > 2);
        }}>
          <div className="messenger-history-note">Recorded messages and sent automated replies. Replies made directly in Facebook and full history are not synced yet.</div>
          {selected.timeline.map((item, index) => {
            const previous = selected.timeline[index - 1];
            const startsNewDay = !previous || dayLabel(previous.at) !== dayLabel(item.at);
            const followsTimeGap = !previous || Date.parse(item.at) - Date.parse(previous.at) >= 10 * 60 * 1000;
            return <article className={`messenger-message${item.outgoing ? ' messenger-message--outgoing' : ''}`} key={item.key} aria-label={item.outgoing ? 'Your reply' : 'Guest message'}>
            {startsNewDay && <time className="messenger-message-date">{dayLabel(item.at)}</time>}
            {(startsNewDay || followsTimeGap) && <time className="messenger-message-time">{timeLabel(item.at)}</time>}
            <div className="messenger-bubble-row">{!item.outgoing && <Avatar name={selected.name} />}{item.outgoing && <time className="messenger-hover-time" dateTime={item.at}>{timeLabel(item.at)}</time>}{item.type === 'gallery'
              ? <div className="messenger-photo-grid" aria-label={`${item.photos.length} photos received`}>{item.photos.map((photo, photoIndex) => <button className={`messenger-photo${photo.type === 'sticker' ? ' messenger-sticker' : ''}`} type="button" key={`${photo.url}:${photoIndex}`} onClick={() => openPreview(item.photos.map((entry, index) => ({ src: entry.url, alt: `${selected.name} photo ${index + 1}` })), photoIndex)} aria-label={`Open photo ${photoIndex + 1} of ${item.photos.length}`}><img src={photo.url} alt={`Photo ${photoIndex + 1} sent through Messenger`} loading="lazy" /></button>)}</div>
              : item.type === 'image' || item.type === 'sticker'
              ? <button className={`messenger-photo${item.type === 'sticker' ? ' messenger-sticker' : ''}`} type="button" onClick={() => openPreview([{ src: item.photoUrl, alt: item.type === 'sticker' ? `${selected.name} sticker` : `${selected.name} room photo` }])} aria-label={item.type === 'sticker' ? 'Open sticker' : 'Open room photo'}><img src={item.photoUrl} alt={item.type === 'sticker' ? 'Sticker sent through Messenger' : 'Room sent through Messenger'} loading="lazy" /></button>
              : <p className="messenger-bubble">{item.body}</p>}</div>
            {item.outgoing && <small className="messenger-sent-label">{item.deliveryStatus === 'sending' ? 'Sending' : item.deliveryStatus === 'queued' ? 'Queued' : 'Sent'} · {item.origin === 'staff' ? 'Staff reply' : item.origin === 'system' ? 'System notice' : 'Automated reply'}</small>}
          </article>})}
        </div>
        {showScrollDown && <button type="button" className="scroll-to-top is-visible messenger-scroll-down" aria-label="Scroll to newest message" title="Scroll to newest message" onClick={() => {
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        }}><ChatIcon name="down" /></button>}
        </div>
        <form className="messenger-composer" onSubmit={async event => {
          event.preventDefault();
          const body = reply.trim();
          if (!body || !canReply || busy) return;
          const localKey = `local:${Date.now()}:${Math.random().toString(16).slice(2)}`;
          const optimisticReply = { key: localKey, conversationKey: selected.key, body, at: new Date().toISOString(), outgoing: true, origin: 'staff', deliveryStatus: 'sending' };
          setReply('');
          setPendingReplies(items => [...items, optimisticReply]);
          // Let the optimistic bubble paint before the fast local worker can deliver to Meta.
          await new Promise(resolve => window.requestAnimationFrame(() => resolve()));
          if (await onSend(selected.latest, body)) {
            setPendingReplies(items => items.map(item => item.key === localKey ? { ...item, deliveryStatus: 'queued' } : item));
          } else {
            setPendingReplies(items => items.filter(item => item.key !== localKey));
            setReply(current => current || body);
          }
        }}><div className="messenger-compose-row"><span className="messenger-compose-icon"><ChatIcon name="chat" /></span><div className="messenger-input-shell"><input aria-label="Reply to this conversation" placeholder="Aa" value={reply} maxLength={2000} disabled={!canReply || busy} aria-describedby="messenger-reply-note" onChange={event => setReply(event.target.value)} /><ChatIcon name="smile" /></div><button type="submit" className="messenger-icon-button" disabled={!canReply || busy || !reply.trim()} aria-label="Send message"><ChatIcon name="send" /></button></div><p id="messenger-reply-note">{!connected ? 'Connect the Facebook webhook before replying.' : selected.latest.source !== 'facebook' ? 'Manual records cannot receive Messenger replies.' : selected.latest.status === 'resolved' ? 'Reopen this inquiry before replying.' : 'Staff replies are sent through your connected Facebook Page.'}</p></form>
      </> : <div className="messenger-placeholder messenger-welcome"><span className="messenger-welcome-icon"><ChatIcon name="chat" /></span><h3>Your conversations, in one place</h3><p>Select a chat to view its recorded messages.</p></div>}
    </section>
    {selected && showDetails && <section id="messenger-details" className="messenger-details" aria-label="Inquiry management"><div className="fb-row"><h3>Inquiry details</h3><button type="button" onClick={() => setShowDetails(false)}>Close details</button></div>{selected.messages.map(item => renderDetails(item))}</section>}
    {previewPhoto && <div className="messenger-photo-viewer" role="dialog" aria-modal="true" aria-label="Photo preview" onClick={() => setPreviewPhoto(null)}>
      <button className="messenger-viewer-close" type="button" aria-label="Close photo preview" onClick={() => setPreviewPhoto(null)}>×</button>
      {previewPhoto.photos.length > 1 && <button className="messenger-viewer-nav messenger-viewer-prev" type="button" aria-label="Previous photo" onClick={event => { event.stopPropagation(); setPreviewPhoto(current => ({ ...current, index: (current.index - 1 + current.photos.length) % current.photos.length })); }}>‹</button>}
      <img src={previewPhoto.photos[previewPhoto.index].src} alt={previewPhoto.photos[previewPhoto.index].alt} onClick={event => event.stopPropagation()} />
      {previewPhoto.photos.length > 1 && <><span className="messenger-viewer-count">{previewPhoto.index + 1} / {previewPhoto.photos.length}</span><button className="messenger-viewer-nav messenger-viewer-next" type="button" aria-label="Next photo" onClick={event => { event.stopPropagation(); setPreviewPhoto(current => ({ ...current, index: (current.index + 1) % current.photos.length })); }}>›</button></>}
    </div>}
  </div>;
}
