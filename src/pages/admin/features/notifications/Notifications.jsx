import { useCallback, useEffect, useState } from 'react';
import useVisibilityPolling from '../polling/useVisibilityPolling.js';
import './notifications.css';

export default function Notifications({ csrfToken, onLogout, onRefresh }) {
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/notifications.php?page=${page}&status=${filter}`, { headers: { Accept: 'application/json' } });
      if (response.status === 401) { onLogout(); return; }
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Could not load notifications.');
      setData(result);
      setDraft(current => current || result.settings);
      setError('');
    } catch (e) { setError(e.message); }
  }, [page, filter, onLogout]);
  useEffect(() => { load(); }, [load]);
  useVisibilityPolling(load, { enabled: !busy });
  const mutate = async payload => {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/notifications.php', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify(payload) });
      if (response.status === 401) { onLogout(); return; }
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Notification action failed.');
      if (payload.action === 'settings') setDraft(null);
      setNotice(result.message); await load(); await onRefresh();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const retry = job => {
    if (job.status === 'unknown' && !window.confirm('This email may already have reached the recipient. Retrying can send a duplicate. Have you checked the provider and do you want to retry?')) return;
    mutate({ action: 'retry', id: Number(job.id), acknowledge_duplicate_risk: job.status === 'unknown' });
  };
  return <section className="notifications admin-view">
    <header><div><span className="admin-kicker">Customer communication</span><h1>Email notifications</h1></div><button type="button" onClick={load} disabled={busy}>Refresh</button></header>
    {error && <p role="alert" className="admin-error">{error}</p>}
    {notice && <p role="status" className="admin-notice">{notice}</p>}
    {data && draft && <>
      <section className="notification-panel"><h2>Email setup</h2><p>{data.readiness.enabled ? 'Sending enabled' : 'Sending disabled'} · {data.readiness.ready ? 'Configuration ready' : 'Configuration incomplete'}</p>
        {data.readiness.missing.length > 0 && <p>Configure on the server: {data.readiness.missing.join(', ')}.</p>}
        {data.readiness.test_mode && <p role="status">Test mode: all mail is redirected to the configured test inbox.</p>}
        <p>Schedule: arrival reminders one day before check-in; daily operations at 7:00 AM Asia/Manila.</p>
        <p>Worker last checked: {data.settings.worker_seen_at ? `${data.settings.worker_seen_at} UTC` : 'Not yet. Start the local email worker or production cron.'}</p>
        <button disabled={busy || !data.readiness.enabled || !data.readiness.ready} onClick={() => mutate({ action: 'test' })}>Send test to admin inboxes</button>
      </section>
      <form className="notification-panel" onSubmit={e => { e.preventDefault(); mutate({ action: 'settings', revision: draft.revision, events: draft.events, review_url: draft.review_url }); }}>
        <h2>Notification settings</h2><p>Changes apply to future events. Disabling a category also cancels its unsent messages.</p>
        <div className="notification-options">{Object.entries(data.types).map(([key, label]) => <label key={key}><input type="checkbox" checked={draft.events[key]} onChange={e => setDraft({ ...draft, events: { ...draft.events, [key]: e.target.checked } })} />{label}</label>)}</div>
        <label className="notification-field">Optional feedback link (HTTPS)<input type="url" maxLength={2048} placeholder="Leave blank until your review or Google Form link is ready" value={draft.review_url} onChange={e => setDraft({ ...draft, review_url: e.target.value })} /></label>
        <p>A blank link sends a thank-you without a feedback button.</p>
        <button disabled={busy}>Save settings</button>{draft.revision !== data.settings.revision && <button type="button" disabled={busy} onClick={() => setDraft(data.settings)}>Discard edits and load current settings</button>}
      </form>
      <section className="notification-panel"><h2>Delivery log</h2><p>“Accepted by SMTP” means the provider accepted the email; it does not prove inbox delivery. Records are retained for 90 days.</p>
        <label className="notification-field">Filter<select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}><option value="">All statuses</option>{['pending','processing','retry_wait','succeeded','failed','unknown','skipped','cancelled'].map(status => <option key={status} value={status}>{status === 'succeeded' ? 'Accepted by SMTP' : status.replaceAll('_', ' ')}</option>)}</select></label>
        <div className="notification-table"><table><thead><tr><th>Email</th><th>Recipient</th><th>Status</th><th>Attempts</th><th>Created</th><th>Action</th></tr></thead><tbody>{data.jobs.map(job => <tr key={job.id}><td>{job.subject}<small>{job.event_type}</small></td><td>{job.recipient || 'No email address'}</td><td>{job.status === 'succeeded' ? 'Accepted by SMTP' : job.status.replaceAll('_', ' ')}{job.error_code && <small>{job.error_code.replaceAll('_', ' ')}</small>}</td><td>{job.attempts}</td><td>{job.created_at}</td><td>{['failed','unknown'].includes(job.status) && <button disabled={busy} onClick={() => retry(job)}>Retry</button>}</td></tr>)}</tbody></table></div>
        {data.jobs.length === 0 && <p>No deliveries in this view.</p>}
        <div className="notification-pages"><button disabled={page <= 1 || busy} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} · {data.total} records</span><button disabled={page * 25 >= data.total || busy} onClick={() => setPage(page + 1)}>Next</button></div>
      </section>
    </>}
  </section>;
}
