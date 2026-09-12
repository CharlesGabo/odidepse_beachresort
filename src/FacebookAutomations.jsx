import { useEffect, useState } from 'react';
import './facebook-automations.css';

const sections = [['message', 'Messenger'], ['comment', 'Comments'], ['alerts', 'Staff alerts'], ['lead', 'Leads'], ['drafts', 'Post drafts'], ['rules', 'Reply rules'], ['jobs', 'Delivery queue'], ['audit', 'Audit log']];
const categories = ['booking', 'rates', 'amenities', 'location', 'complaint', 'general'];
const label = value => String(value || '').replaceAll('_', ' ');
const stamp = value => value ? value.replace('T', ' ').slice(0, 19) : '—';

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

function EventCard({ item, mutate, busy, onConvert, onBooking }) {
  return <article className="fb-panel">
    <div className="fb-row"><div><span className="fb-eyebrow">{item.source === 'manual' ? 'Manually recorded' : 'Facebook'} · {item.kind} #{item.id}</span><h3>{item.guest_name}</h3></div>
      <span className={`fb-badge${Number(item.needs_attention) ? ' fb-badge--strong' : ''}`}>{Number(item.needs_attention) ? 'Staff attention' : label(item.status)}</span></div>
    <p className="fb-copy">{item.body}</p>
    {(item.email || item.phone) && <p>{[item.email, item.phone].filter(Boolean).join(' · ')}</p>}
    <small>Received {stamp(item.received_at)}{item.external_id ? ` · Facebook ID ${item.external_id}` : ''}</small>
    {item.booking_id ? <div className="fb-actions"><span>Converted to {item.reference_code}</span><button type="button" onClick={() => onBooking(item.booking_id)}>View booking</button></div> : <>
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
        {item.kind === 'message' && item.category !== 'complaint' && item.status !== 'resolved' && <button type="button" disabled={busy} onClick={() => mutate({ action: 'prepare_reply', id: Number(item.id), revision: Number(item.revision) })}>Queue template reply</button>}
        {item.kind === 'lead' && <button type="button" className="fb-primary" disabled={busy} onClick={() => onConvert(item)}>Create booking from lead</button>}
      </div>
    </>}
  </article>;
}

function Rules({ settings, mutate, busy }) {
  const rules = settings.rules;
  return <form className="fb-panel" onSubmit={event => {
    event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget));
    mutate({ action: 'save_rules', revision: Number(settings.revision), rules: {
      categorize: data.categorize === 'on', prepare_replies: data.prepare_replies === 'on', notify_comments: data.notify_comments === 'on',
      templates: Object.fromEntries(categories.map(category => [category, data[category] || ''])),
    } });
  }}><fieldset disabled={busy}><h2>Automation rules</h2><p>Rules apply to new items. Review existing inquiries individually after changing these settings.</p>
    <div className="fb-toggles">
      <label className="fb-check"><input type="checkbox" name="categorize" defaultChecked={rules.categorize} /><span>Automatically categorize inquiries <small>Recognizes common English and Filipino keywords. Unmatched inquiries go to General.</small></span></label>
      <label className="fb-check"><input type="checkbox" name="prepare_replies" defaultChecked={rules.prepare_replies} /><span>Automatically answer new Messenger inquiries <small>Uses the matching approved template when Meta permits a reply. Complaints and categories with a blank template go to staff.</small></span></label>
      <label className="fb-check"><input type="checkbox" name="notify_comments" defaultChecked={rules.notify_comments} /><span>Flag new comments for staff <small>Shows an attention badge here. Complaints always create an alert.</small></span></label>
    </div><h3>Reply templates</h3><p>Leave a template blank to skip that category. Complaints are handled by staff.</p>
    <div className="fb-grid">{categories.filter(value => value !== 'complaint').map(category => <Field key={category} title={label(category)} name={category} value={rules.templates[category]} maxLength={1000} multiline />)}</div>
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

export default function FacebookAutomations({ csrfToken, onLogout, ManualBookingModal, onBookingSaved, onOpenBooking }) {
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
  const [editorKey, setEditorKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
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

  const mutate = async payload => {
    if (busy) return false;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/facebook.php', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify(payload) });
      if (response.status === 401) { onLogout(); return false; }
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Could not save changes.');
      setNotice(payload.action === 'prepare_reply' ? 'Reply prepared for staff review. Only verified Messenger inquiries are sent automatically.' : payload.action === 'approve_draft' ? 'Draft approved. Nothing has been published.' : 'Changes saved.');
      setRefresh(value => value + 1); return true;
    } catch (exception) { setError(exception.message); return false; }
    finally { setBusy(false); }
  };
  const navigate = value => { setSection(value); setPage(1); setNotice(''); setError(''); setDraft(null); };
  const finishEdit = () => { setDraft(null); setEditorKey(value => value + 1); };
  const eventSection = ['message', 'comment', 'lead', 'alerts'].includes(section);

  return <section className="fb-workspace admin-view" aria-labelledby="facebook-heading">
    <div className="fb-row fb-heading"><div><span className="fb-eyebrow">Page operations</span><h1 id="facebook-heading">Facebook Automations</h1><p>One workspace for conversations, leads, and content.</p></div><button type="button" disabled={busy || loading} onClick={() => setRefresh(value => value + 1)}>Refresh</button></div>
    <div className="fb-connection"><span className="fb-badge fb-badge--strong">Not connected</span><div><strong>Your workspace is ready for setup.</strong><p>Manage rules, record inquiries, and prepare drafts now. Live imports, sending, publishing, and delivery retries start after the Facebook connection and webhooks are configured.</p></div></div>
    <div className="fb-stats">{[['message', 'Open inquiries', 'inquiries'], ['alerts', 'Staff alerts', 'alerts'], ['lead', 'Unconverted leads', 'leads'], ['drafts', 'Awaiting approval', 'drafts']].map(([target, title, key]) => <button type="button" disabled={busy} key={key} onClick={() => navigate(target)}><span>{title}</span><strong>{data ? Number(data.counts[key] || 0) : '—'}</strong></button>)}</div>
    <nav className="fb-tabs" aria-label="Facebook automation sections">{sections.map(([key, title]) => <button type="button" key={key} disabled={busy} aria-current={section === key ? 'page' : undefined} className={section === key ? 'active' : ''} onClick={() => navigate(key)}>{title}</button>)}</nav>
    {error && <p className="fb-feedback fb-feedback--error" role="alert">{error}</p>}
    {notice && <p className="fb-feedback" role="status">{notice}</p>}
    {loading ? <p role="status">Loading workspace…</p> : data && <>
      {eventSection && <>{section !== 'alerts' && <Intake key={section} kind={section} mutate={mutate} busy={busy} />}<div className="fb-row"><h2>{sections.find(([key]) => key === section)?.[1]}</h2><small>{data.total} recorded</small></div>
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
      {section !== 'rules' && data.records.length === 0 && <div className="fb-empty"><span className="fb-eyebrow">A clear workspace</span><h3>No {sections.find(([key]) => key === section)?.[1].toLowerCase()} yet.</h3><p>{eventSection ? 'Record an item above, or wait for the Facebook connection to bring in new activity.' : section === 'drafts' ? 'Create a draft above and review it before publishing.' : 'Activity will appear here as you use the workspace.'}</p></div>}
      {section !== 'rules' && data.total > 25 && <div className="fb-pagination"><button type="button" disabled={busy || page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page} of {Math.ceil(data.total / 25)}</span><button type="button" disabled={busy || page * 25 >= data.total} onClick={() => setPage(value => value + 1)}>Next</button></div>}
    </>}
    {lead && <ManualBookingModal key={lead.id} open onClose={() => setLead(null)} csrfToken={csrfToken}
      facebookLeadId={Number(lead.id)} initialGuest={lead}
      initialMessage={`Facebook lead #${lead.id}${lead.external_id ? ` (${lead.external_id})` : ''}: ${lead.body}`.slice(0, 650)}
      onSaved={result => { setLead(null); setNotice(`Lead converted to booking ${result.reference}.`); setRefresh(value => value + 1); onBookingSaved(); }} />}
  </section>;
}
