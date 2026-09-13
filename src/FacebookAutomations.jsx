import { useEffect, useRef, useState } from 'react';
import MessengerInbox from './MessengerInbox.jsx';
import './facebook-automations.css';

const sections = [['message', 'Messenger'], ['alerts', 'Booking Requests'], ['comment', 'Comments'], ['lead', 'Leads'], ['drafts', 'Post drafts'], ['rules', 'Reply rules'], ['jobs', 'Delivery queue'], ['audit', 'Audit log']];
const categories = ['booking', 'rates', 'amenities', 'location', 'complaint', 'general'];
const guidedReplies = [
  ['start', 'Booking flow introduction'], ['restart', 'Restart message'], ['ask_dates', 'Ask for dates'], ['confirm_dates', 'Confirm interpreted dates'],
  ['ask_guests', 'Ask for guest count'], ['options_intro', 'Room suggestions introduction'], ['ask_stay', 'Ask for room choice'],
  ['ask_contact', 'Ask for name and contact'], ['ask_booking_details', 'All booking details request'], ['ask_rate_details', 'Rate details request'], ['book_from_rates', 'Continue from rates to booking'], ['missing_name', 'Contact received, name missing'], ['missing_contact', 'Name received, contact missing'], ['summary_intro', 'Booking summary introduction'],
  ['ask_confirmation', 'Ask for confirmation'], ['confirm_only', 'Confirmation reminder'], ['pending_created', 'Pending request created'],
  ['progress_saved', 'Side question progress reminder'], ['invalid_answer', 'Unrecognized answer'], ['unavailable', 'Room became unavailable'],
  ['no_options', 'No suitable room'], ['menu', 'Menu command'], ['handoff', 'Waiting for staff'],
  ['completed', 'Existing pending request'], ['cancelled', 'Cancelled flow'],
  ['pending_updated', 'Pending request updated'],
];
const MESSENGER_REFRESH_MS = 1000;
const VISIBLE_REFRESH_MS = 15000;
const HIDDEN_REFRESH_MS = 60000;
const label = value => String(value || '').replaceAll('_', ' ');
const bookingStatusLabels = { pending: 'New request', confirmed: 'Confirmed', checked_in: 'Checked in', completed: 'Completed', no_show: 'No show', cancelled: 'Cancelled' };

function formatBookingDate(value) {
  if (!value) return 'Not set';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' }).format(date);
}

function getBookingNights(item) {
  const checkIn = new Date(`${item.booking_check_in}T12:00:00`);
  const checkOut = new Date(`${item.booking_check_out}T12:00:00`);
  const nights = Math.round((checkOut - checkIn) / 86400000);
  return Number.isFinite(nights) && nights > 0 ? nights : null;
}
const stamp = value => value ? value.replace('T', ' ').slice(0, 19) : '—';

const bookingAlertDetails = item => [
  ['Booking reference', item.reference_code],
  ['Customer', item.booking_guest_name || 'Not provided'],
  ['Stay dates', `${item.booking_check_in || 'Not provided'} to ${item.booking_check_out || 'Not provided'}`],
  ['Total pax', item.booking_guests || 'Not provided'],
  ['Accommodation', item.booking_stay_type || 'Not provided'],
  ['Contact', [item.booking_email, item.booking_phone].filter(Boolean).join(' · ') || 'Not provided'],
  ['Booking status', label(item.booking_status) || 'Not provided'],
];

function Field({ title, name, value, maxLength = 190, type = 'text', required = false, multiline = false }) {
  return <label className="fb-field"><span>{title}</span>{multiline
    ? <textarea name={name} defaultValue={value} maxLength={maxLength} required={required} rows="5" />
    : <input name={name} defaultValue={value} maxLength={maxLength} type={type} required={required} />}</label>;
}

function Intake({ kind, mutate, busy }) {
  return <details className="fb-panel fb-intake"><summary>Add {kind === 'message' ? 'inquiry' : kind} manually</summary>
    <p>Record an item from your Page while the connection is pending. Manual entries never authorize a Facebook reply.</p>
    <form onSubmit={async event => {
      event.preventDefault(); const form = event.currentTarget;
      if (await mutate({ action: 'intake', kind, ...Object.fromEntries(new FormData(form)) })) form.reset();
    }}><fieldset disabled={busy}><div className="fb-grid">
      <Field title="Guest name" name="guest_name" maxLength={100} required />
      <Field title="Facebook item ID (optional, prevents duplicate imports)" name="external_id" />
      {kind === 'lead' && <><Field title="Email (optional)" name="email" type="email" /><Field title="Phone (optional)" name="phone" maxLength={30} /></>}
    </div><Field title={kind === 'lead' ? 'Inquiry details' : 'Message or comment'} name="body" maxLength={4000} multiline required />
    <button className="fb-primary">Save {kind === 'message' ? 'inquiry' : kind}</button></fieldset></form>
  </details>;
}

function EventCard({ item, mutate, busy, onConvert, onBooking, showBookingSummary = false }) {
  const hasBookingSummary = showBookingSummary && item.booking_id && item.reference_code;
  return <article className="fb-panel">
    <div className="fb-row"><div><span className="fb-eyebrow">{item.source === 'manual' ? 'Manually recorded' : 'Facebook'} · {item.kind} #{item.id}</span><h3>{item.guest_name}</h3></div>
      <span className={`fb-badge${Number(item.needs_attention) ? ' fb-badge--strong' : ''}`}>{Number(item.needs_attention) ? 'Staff attention' : label(item.status)}</span></div>
    {hasBookingSummary
      ? <div className="fb-copy fb-booking-copy">{bookingAlertDetails(item).map(([title, value]) => <div key={title}><strong>{title}:</strong> <span>{value}</span></div>)}</div>
      : <p className="fb-copy">{item.body}</p>}
    {!hasBookingSummary && (item.email || item.phone) && <p>{[item.email, item.phone].filter(Boolean).join(' · ')}</p>}
    <small>Received {stamp(item.received_at)}{item.external_id ? ` · Facebook ID ${item.external_id}` : ''}</small>
    {item.booking_id ? <div className="fb-actions"><span>Pending booking {item.reference_code}</span><button type="button" onClick={() => onBooking(item.booking_id)}>Review booking</button>{Number(item.needs_attention) ? <button type="button" disabled={busy} onClick={() => mutate({ action: 'clear_attention', id: Number(item.id), revision: Number(item.revision) })}>Clear staff alert</button> : null}</div> : <>
      <form key={item.revision} onSubmit={event => {
        event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget));
        mutate({ action: 'update_event', id: Number(item.id), revision: Number(item.revision), ...data, needs_attention: data.needs_attention === 'on' });
      }}><fieldset disabled={busy}><div className="fb-event-fields">
        <label className="fb-field"><span>Category</span><select name="category" defaultValue={item.category}>{categories.map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="fb-field"><span>Status</span><select name="status" defaultValue={item.status}>{['new', 'in_progress', 'resolved'].map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
        <label className="fb-check"><input type="checkbox" name="needs_attention" defaultChecked={Boolean(Number(item.needs_attention))} />Needs staff attention</label>
        <button>Save changes</button>
      </div></fieldset></form>
      <div className="fb-actions">
        {item.kind === 'comment' && <button type="button" className={item.website_status === 'published' ? '' : 'fb-primary'} disabled={busy} onClick={() => mutate({ action: item.website_status === 'published' ? 'hide_comment' : 'publish_comment', id: Number(item.id), revision: Number(item.revision) })}>{item.website_status === 'published' ? 'Hide from website' : 'Show on website'}</button>}
        {item.kind === 'comment' && <span>{item.website_status === 'published' ? 'Visible on the public homepage' : 'Hidden from the public website'}</span>}
        {item.kind === 'message' && item.status !== 'resolved' && <button type="button" disabled={busy} onClick={() => mutate({ action: 'prepare_reply', id: Number(item.id), revision: Number(item.revision) })}>Queue template reply</button>}
        {item.kind === 'lead' && <button type="button" className="fb-primary" disabled={busy} onClick={() => onConvert(item)}>Create booking from lead</button>}
      </div>
    </>}
  </article>;
}

function FacebookBookingCard({ item, onLocate, onManage }) {
  const nights = getBookingNights(item);
  const status = item.booking_status || 'pending';
  const contact = item.booking_email || item.booking_phone || 'No contact provided';
  const openCalendar = () => onLocate(item.booking_id);
  return <article className="booking-card booking-card--calendar-link" tabIndex="0" role="button" aria-label={`Show ${item.booking_guest_name || item.guest_name || 'Facebook customer'} in the booking calendar`}
    onClick={event => { if (!event.target.closest('button,select,input,label,a')) openCalendar(); }}
    onKeyDown={event => { if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) { event.preventDefault(); openCalendar(); } }}>
    <div className="booking-card__top">
      <span>{item.reference_code}</span>
      <span className={`booking-status booking-status--${status}`}>{bookingStatusLabels[status] || label(status)}</span>
    </div>
    <div className="booking-card__guest">
      <div><strong>{item.booking_guest_name || item.guest_name || 'Facebook customer'}</strong><small>{contact}</small></div>
    </div>
    <div className="booking-card__stay">
      <div><span>Stay</span><strong>{item.booking_stay_type || 'Flexible stay'}</strong></div>
      <div><span>Party</span><strong>{item.booking_guests ? `${item.booking_guests} pax` : 'Not provided'}</strong></div>
    </div>
    <div className="booking-card__footer">
      <div className="booking-card__dates">
        <div><span>Check-in</span><strong>{formatBookingDate(item.booking_check_in)}</strong></div>
        <div className="booking-card__route"><span>{nights ? `${nights + 1}D · ${nights}N` : '→'}</span></div>
        <div><span>Check-out</span><strong>{formatBookingDate(item.booking_check_out)}</strong></div>
      </div>
      <div className="booking-card__actions"><button className="booking-manage-button" type="button" onClick={() => onManage(item.booking_id)}>View &amp; manage</button></div>
    </div>
  </article>;
}

function Rules({ settings, mutate, busy }) {
  const rules = settings.rules;
  return <form className="fb-panel" onSubmit={event => {
    event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget));
    mutate({ action: 'save_rules', revision: Number(settings.revision), rules: {
      categorize: data.categorize === 'on', prepare_replies: data.prepare_replies === 'on', notify_comments: data.notify_comments === 'on',
      templates: Object.fromEntries(categories.map(category => [category, data[category] || ''])),
      keywords: Object.fromEntries(categories.map(category => [category, String(data[`keywords_${category}`] || '').split(/[,\n]/).map(value => value.trim()).filter(Boolean)])),
      guided_replies: Object.fromEntries(guidedReplies.map(([key]) => [key, data[`guided_${key}`] || ''])),
    } });
  }}><fieldset disabled={busy}><h2>Automation rules</h2><p>Rules apply to new items. Review existing inquiries individually after changing these settings.</p>
    <div className="fb-toggles">
      <label className="fb-check"><input type="checkbox" name="categorize" defaultChecked={rules.categorize} /><span>Automatically categorize inquiries <small>Recognizes common English and Filipino keywords. Unmatched inquiries go to General.</small></span></label>
      <label className="fb-check"><input type="checkbox" name="prepare_replies" defaultChecked={rules.prepare_replies} /><span>Automatically answer new Messenger inquiries <small>Uses templates for questions and a guided, stateful flow for bookings. Complaints are handed to staff.</small></span></label>
      <label className="fb-check"><input type="checkbox" name="notify_comments" defaultChecked={rules.notify_comments} /><span>Flag new comments for staff <small>Shows an attention badge here. Complaints always create an alert.</small></span></label>
    </div><details className="fb-keywords"><summary>Category keywords <span>Optional advanced settings</span></summary><p>Use commas or new lines. Complaint matches take priority; unmatched messages use General. Close misspellings of words with five or more characters are recognized conservatively.</p><div className="fb-grid">{categories.filter(category => category !== 'general').map(category => <Field key={category} title={`${label(category)} keywords`} name={`keywords_${category}`} value={(rules.keywords?.[category] || []).join(', ')} maxLength={2500} multiline />)}</div></details>
    <h3>Reply templates</h3><p>These answer normal and mid-booking questions. Booking requests then collect dates, check-in and check-out times, guests, accommodation, name, and contact details before creating a pending request. Leave a template blank to skip that category.</p>
    <div className="fb-grid">{categories.map(category => <Field key={category} title={label(category)} name={category} value={rules.templates[category]} maxLength={1000} multiline />)}</div>
    <details className="fb-keywords"><summary>Guided booking replies <span>Customize each conversation step</span></summary>
      <p>The room choices, customer details, and final summary are inserted safely by the system. Use <code>{'{date_example}'}</code> in the date question, <code>{'{dates}'}</code> in the interpreted-date confirmation, and keep <code>{'{reference}'}</code> in the pending-request reply. The system always adds the pending/staff-approval warning.</p>
      <div className="fb-grid">{guidedReplies.map(([key, title]) => <Field key={key} title={title} name={`guided_${key}`} value={rules.guided_replies?.[key] || ''} maxLength={1000} multiline />)}</div>
    </details>
    <button className="fb-primary">{busy ? 'Saving…' : 'Save rules'}</button>
  </fieldset></form>;
}

function DraftEditor({ draft, mutate, busy, onDone }) {
  return <form className="fb-panel" onSubmit={async event => {
    event.preventDefault(); const form = event.currentTarget;
    const action = event.nativeEvent.submitter?.value || 'save_draft';
    if (await mutate({ action, ...Object.fromEntries(new FormData(form)), ...(draft ? { id: Number(draft.id), revision: Number(draft.revision) } : {}) })) { form.reset(); onDone(); }
  }}><fieldset disabled={busy}><h2>{draft ? 'Edit draft' : 'Create a post draft'}</h2>
    <p>Generate a caption from the details you provide, or save your own text. Generation uses a fixed template, not an AI service. Every edit requires approval again.</p>
    <Field title="Internal title" name="title" value={draft?.title} maxLength={120} required />
    <Field title="Post text or details for the generated caption" name="body" value={draft?.body} maxLength={4000} multiline required />
    <div className="fb-actions"><button className="fb-primary" name="action" value="save_draft">Save for approval</button>
      {!draft && <button name="action" value="generate_draft">Generate template draft</button>}
      {draft && <button type="button" onClick={onDone}>Cancel edit</button>}</div>
  </fieldset></form>;
}

export default function FacebookAutomations({ csrfToken, onLogout, ManualBookingModal, BookingRequestModal, bookings, updateStatus, onBookingSaved, onOpenBooking }) {
  const [section, setSection] = useState('message');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [lead, setLead] = useState(null);
  const [draft, setDraft] = useState(null);
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [editorKey, setEditorKey] = useState(0);
  const lastRequestKey = useRef('');

  useEffect(() => {
    const controller = new AbortController();
    const requestKey = `${section}:${page}`;
    if (lastRequestKey.current !== requestKey) setLoading(true);
    lastRequestKey.current = requestKey;
    fetch(`/api/admin/facebook.php?section=${section}&page=${page}`, { signal: controller.signal, headers: { Accept: 'application/json' } })
      .then(async response => {
        if (response.status === 401) { onLogout(); return; }
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Could not load automations.');
        if (!controller.signal.aborted) { setData(result); setError(''); }
      }).catch(exception => { if (exception.name !== 'AbortError') { setError(exception.message); setData(null); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [section, page, refresh, onLogout]);

  useEffect(() => {
    let timer;
    let stopped = false;
    const schedule = () => {
      const delay = document.visibilityState === 'visible'
        ? (section === 'message' ? MESSENGER_REFRESH_MS : VISIBLE_REFRESH_MS)
        : HIDDEN_REFRESH_MS;
      timer = window.setTimeout(() => {
        if (stopped) return;
        setRefresh(value => value + 1);
        schedule();
      }, delay);
    };
    const visibilityChanged = () => {
      window.clearTimeout(timer);
      if (document.visibilityState === 'visible') setRefresh(value => value + 1);
      schedule();
    };
    document.addEventListener('visibilitychange', visibilityChanged);
    schedule();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', visibilityChanged);
    };
  }, [section]);

  const mutate = async payload => {
    if (busy) return false;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/facebook.php', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify(payload) });
      if (response.status === 401) { onLogout(); return false; }
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Could not save changes.');
      setNotice(payload.action === 'send_message' ? 'Staff reply queued for Messenger delivery.' : payload.action === 'prepare_reply' ? 'Reply prepared for staff review. Only verified Messenger inquiries are sent automatically.' : payload.action === 'approve_draft' ? 'Draft approved. Nothing has been published.' : 'Changes saved.');
      setRefresh(value => value + 1); return true;
    } catch (exception) { setError(exception.message); return false; }
    finally { setBusy(false); }
  };
  const navigate = value => { setSection(value); setPage(1); setNotice(''); setError(''); setDraft(null); };
  const finishEdit = () => { setDraft(null); setEditorKey(value => value + 1); };
  const eventSection = ['comment', 'lead'].includes(section);
  const connected = data?.connection === 'connected';

  return <section className="fb-workspace admin-view" aria-labelledby="facebook-heading">
    <div className="fb-row fb-heading"><div><span className="fb-eyebrow">Page operations</span><h1 id="facebook-heading">Facebook Automations</h1><p>One workspace for conversations, leads, and content.</p></div><button type="button" disabled={busy || loading} onClick={() => setRefresh(value => value + 1)}>Refresh</button></div>
    <div className="fb-connection"><span className="fb-badge fb-badge--strong">{loading ? 'Checking' : connected ? 'Connected' : 'Not connected'}</span><div><strong>{loading ? 'Checking the Facebook connection…' : connected ? 'Facebook webhook verified.' : 'Your workspace is ready for setup.'}</strong><p>{connected ? 'Meta successfully verified this callback. Keep the active callback URL online and run the delivery worker for automatic replies.' : 'Complete Meta webhook verification to enable live Page activity.'}</p></div></div>
    <div className="fb-stats">{[['message', 'Open inquiries', 'inquiries'], ['alerts', 'Booking Requests', 'alerts'], ['lead', 'Unconverted leads', 'leads'], ['drafts', 'Awaiting approval', 'drafts']].map(([target, title, key]) => <button type="button" disabled={busy} key={key} onClick={() => navigate(target)}><span>{title}</span><strong>{data ? Number(data.counts[key] || 0) : '—'}</strong></button>)}</div>
    <nav className="fb-tabs" aria-label="Facebook automation sections">{sections.map(([key, title]) => <button type="button" key={key} disabled={busy} aria-current={section === key ? 'page' : undefined} className={section === key ? 'active' : ''} onClick={() => navigate(key)}>{title}</button>)}</nav>
    {error && <p className="fb-feedback fb-feedback--error" role="alert">{error}</p>}
    {notice && <p className="fb-feedback" role="status">{notice}</p>}
    {loading ? <p role="status">Loading workspace…</p> : data && <>
      {section === 'message' && <>
        <MessengerInbox records={data.records} total={data.total} connected={connected} busy={busy} onSend={(item, body) => mutate({ action: 'send_message', id: Number(item.id), revision: Number(item.revision), body })} renderDetails={item => <EventCard key={`${item.id}-${item.revision}`} item={item} mutate={mutate} busy={busy} onConvert={setLead} onBooking={onOpenBooking} />} />
        <Intake kind="message" mutate={mutate} busy={busy} />
      </>}
      {section === 'alerts' && <><div className="fb-row"><div><h2>Booking Requests</h2><p>Booking requests created through your connected Facebook Page.</p></div><small>{data.total} {data.total === 1 ? 'request' : 'requests'}</small></div>
        <div className="booking-table booking-card-grid fb-booking-requests">
          {data.records.map(item => <FacebookBookingCard key={item.booking_id} item={item} onLocate={onOpenBooking} onManage={setSelectedBookingId} />)}
        </div>
      </>}
      {eventSection && <><Intake key={section} kind={section} mutate={mutate} busy={busy} /><div className="fb-row"><h2>{sections.find(([key]) => key === section)?.[1]}</h2><small>{data.total} recorded</small></div>
        {section === 'comment' && <p>New comments appear here with staff attention flags. Acknowledge one by clearing its attention checkbox. Refresh to check for new items.</p>}
        {data.records.map(item => <EventCard key={`${item.id}-${item.revision}`} item={item} mutate={mutate} busy={busy} onConvert={setLead} onBooking={onOpenBooking} />)}
      </>}
      {section === 'rules' && <Rules key={data.settings.revision} settings={data.settings} mutate={mutate} busy={busy} />}
      {section === 'drafts' && <><DraftEditor key={draft ? `edit-${draft.id}` : `new-${editorKey}`} draft={draft} mutate={mutate} busy={busy} onDone={finishEdit} />
        {data.records.map(item => <article className="fb-panel" key={item.id}><div className="fb-row"><h3>{item.title}</h3><span className="fb-badge">{label(item.status)}</span></div><p className="fb-copy">{item.body}</p><small>Revision {item.revision} · {stamp(item.updated_at)}</small>
          <div className="fb-actions">{item.status !== 'published' && <button type="button" disabled={busy} onClick={() => { setDraft(item); document.getElementById('facebook-heading')?.scrollIntoView({ block: 'start' }); }}>Edit</button>}
            {item.status === 'pending' && <><button className="fb-primary" type="button" disabled={busy} onClick={() => mutate({ action: 'approve_draft', id: Number(item.id), revision: Number(item.revision) })}>Approve</button><button type="button" disabled={busy} onClick={() => mutate({ action: 'reject_draft', id: Number(item.id), revision: Number(item.revision) })}>Reject</button></>}
            {item.status === 'approved' && <span>Approved · publishing awaits connection</span>}</div></article>)}
      </>}
      {section === 'jobs' && <><h2>Delivery queue</h2><p>Verified Messenger inquiries are sent automatically by the server worker. Manual test entries stay blocked. Temporary failures can use up to five attempts with increasing delays; uncertain delivery is never repeated automatically.</p>
        {data.records.map(item => <article className="fb-panel" key={item.id}><div className="fb-row"><h3>{label(item.kind)} #{item.id}</h3><span className="fb-badge">{label(item.status)}</span></div><p className="fb-copy">{item.payload}</p><small>Attempts {item.attempts}/{item.max_attempts} · {label(item.error_code) || 'No error'} · Next attempt: {stamp(item.next_attempt_at)}</small>
          {['blocked', 'pending', 'retry_wait'].includes(item.status) && <div className="fb-actions"><button type="button" disabled={busy} onClick={() => mutate({ action: 'cancel_job', id: Number(item.id) })}>Cancel delivery</button></div>}</article>)}
      </>}
      {section === 'audit' && <><h2>Audit log</h2><p>Records changes and processing outcomes without copying private conversations or credentials into the log.</p><div className="fb-panel">{data.records.map(item => <div className="fb-audit-row" key={item.id}><strong>{label(item.action)}</strong><span>{item.entity_type} #{item.entity_id} · {item.actor_id ? `Admin #${item.actor_id}` : 'System'}</span><small>{stamp(item.created_at)}</small></div>)}</div></>}
      {section !== 'rules' && section !== 'message' && data.records.length === 0 && <div className="fb-empty"><span className="fb-eyebrow">A clear workspace</span><h3>No {sections.find(([key]) => key === section)?.[1].toLowerCase()} yet.</h3><p>{section === 'alerts' ? 'New booking requests from your connected Facebook Page will appear here.' : eventSection ? 'Record an item above, or wait for the Facebook connection to bring in new activity.' : section === 'drafts' ? 'Create a draft above and review it before publishing.' : 'Activity will appear here as you use the workspace.'}</p></div>}
      {section !== 'rules' && data.total > data.page_size && <div className="fb-pagination"><button type="button" disabled={busy || page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page} of {Math.ceil(data.total / data.page_size)}</span><button type="button" disabled={busy || page * data.page_size >= data.total} onClick={() => setPage(value => value + 1)}>Next</button></div>}
    </>}
    {lead && <ManualBookingModal key={lead.id} open onClose={() => setLead(null)} csrfToken={csrfToken}
      facebookLeadId={Number(lead.id)} initialGuest={lead}
      initialMessage={`Facebook lead #${lead.id}${lead.external_id ? ` (${lead.external_id})` : ''}: ${lead.body}`.slice(0, 650)}
      onSaved={result => { setLead(null); setNotice(`Lead converted to booking ${result.reference}.`); setRefresh(value => value + 1); onBookingSaved(); }} />}
    <BookingRequestModal booking={bookings.find(item => Number(item.id) === Number(selectedBookingId)) || null} onClose={() => setSelectedBookingId(null)} updateStatus={updateStatus} />
  </section>;
}
