import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import './booking-finance.css';

export const BookingFinanceContext = createContext(null);
const money = value => value === null ? 'Not set' : new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value));
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export default function BookingFinance({ bookingId }) {
  const { csrfToken, onLogout, onSaved } = useContext(BookingFinanceContext);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [voidId, setVoidId] = useState(null);
  const [reload, setReload] = useState(0);
  const request = useCallback(async (body, signal) => {
    const response = await fetch(`/api/admin/booking-finance.php${body ? '' : `?booking_id=${bookingId}`}`, {
      method: body ? 'POST' : 'GET', signal,
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken } : {}) },
      ...(body ? { body: JSON.stringify({ ...body, booking_id: Number(bookingId) }) } : {}),
    });
    if (response.status === 401) { onLogout(); return null; }
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Could not load booking finance.');
    return result.finance;
  }, [bookingId, csrfToken, onLogout]);
  useEffect(() => {
    const controller = new AbortController(); setData(null); setError(''); setMessage('');
    request(null, controller.signal).then(setData).catch(err => { if (err.name !== 'AbortError') setError(err.message); });
    return () => controller.abort();
  }, [request, reload]);
  const save = async (event, extra) => {
    event.preventDefault(); const form = event.currentTarget;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await request({ ...Object.fromEntries(new FormData(form)), ...extra, revision: Number(data.finance_revision) });
      if (result) { setData(result); form.reset(); setVoidId(null); setMessage('Finance saved.'); await onSaved(); }
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <section className="booking-finance" aria-label="Booking finance">
    <div className="booking-finance__heading"><h3>Finance</h3><button type="button" disabled={busy} onClick={() => setReload(value => value + 1)}>Reload ledger</button></div>
    {error && <p role="alert" className="admin-error">{error}</p>}
    {message && <p role="status">{message}</p>}
    {!data && !error && <p role="status">Loading finance…</p>}
    {data && <>
      <dl className="booking-finance__totals">{[['Agreed total', data.agreed_total], ['Collected', data.paid], ['Refunded', data.refunded], ['Balance', data.balance]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{money(value)}</dd></div>)}</dl>
      {data.agreed_total === null && <p className="booking-finance__notice">Set the agreed total before confirming this booking. Preview estimates are not used.</p>}
      {data.status === 'cancelled' && <p>Cancelled booking: review net collections and record any agreed refund. The balance shown is against the original agreed total.</p>}
      <details open={data.agreed_total === null}><summary>{data.agreed_total === null ? 'Set agreed total' : 'Revise agreed total'}</summary>
        <form key={data.finance_revision} onSubmit={event => save(event, { action: 'set_total' })}>
          <label>Total (PHP)<input name="amount" inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" defaultValue={data.agreed_total ?? ''} required /></label>
          <label>Reason / complimentary explanation<input name="reason" maxLength={500} required /></label>
          <button disabled={busy}>Save total</button>
        </form>
      </details>
      {data.agreed_total !== null && <details><summary>Record payment or refund</summary>
        <form onSubmit={event => save(event, { action: 'record' })}>
          <label>Type<select name="kind" defaultValue={data.status === 'cancelled' ? 'refund' : 'payment'}>{data.status !== 'cancelled' && <option value="payment">Payment</option>}<option value="refund">Refund</option></select></label>
          <label>Amount (PHP)<input name="amount" inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" required /></label>
          <label>Date<input name="paid_on" type="date" max={today()} min="2000-01-01" defaultValue={today()} required /></label>
          <label>Method<select name="method">{['cash','gcash','bank_transfer','card','other'].map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>
          <label>Reference (optional)<input name="reference" maxLength={100} /></label>
          <label>Note (required for refunds)<input name="note" maxLength={500} /></label>
          <button disabled={busy}>Record transaction</button>
        </form>
      </details>}
      <h4>Transaction history</h4>
      {!data.entries.length && <p>No payments or refunds recorded.</p>}
      <div className="booking-finance__entries">{data.entries.map(entry => <article key={entry.id} className={entry.voided_at ? 'is-voided' : ''}>
        <strong>{entry.kind === 'payment' ? 'Payment' : 'Refund'} · {money(entry.amount)} {entry.voided_at && '· Voided'}</strong>
        <p>{entry.paid_on} · {entry.method.replaceAll('_', ' ')} · recorded by admin #{entry.created_by}</p>
        {entry.reference && <p>Reference: {entry.reference}</p>}{entry.note && <p>{entry.note}</p>}
        {entry.voided_at ? <p>Voided {entry.voided_at} by admin #{entry.voided_by}: {entry.void_reason}</p> : <button disabled={busy} type="button" onClick={() => setVoidId(Number(entry.id))}>Correct / void entry</button>}
        {voidId === Number(entry.id) && <form onSubmit={event => save(event, { action: 'void', entry_id: Number(entry.id) })}><p>Voiding reverses this entry’s effect on the balance and retains its audit record.</p><label>Correction reason<input name="reason" maxLength={500} required /></label><button disabled={busy}>Confirm void</button><button type="button" onClick={() => setVoidId(null)}>Keep entry</button></form>}
      </article>)}</div>
      <details><summary>Total change history</summary>{data.audit.length ? data.audit.map((item, index) => <p key={index}>{item.created_at} · {money(item.old_total)} → {money(item.new_total)} · admin #{item.created_by}<br />{item.reason}</p>) : <p>No total changes recorded.</p>}</details>
    </>}
  </section>;
}

export function BookingFinanceDialog({ booking, onClose, onConfirm, notice }) {
  const ref = useRef(null);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => { if (booking && !ref.current?.open) ref.current?.showModal(); }, [booking]);
  if (!booking) return null;
  return <dialog ref={ref} className="booking-finance-dialog" onClose={onClose} onCancel={onClose} aria-labelledby="finance-dialog-title">
    <div className="booking-finance__heading"><h2 id="finance-dialog-title">Finance · {booking.reference_code}</h2><button type="button" onClick={onClose} aria-label="Close finance">×</button></div>
    <BookingFinance bookingId={booking.id} />
    {notice && <p role="status">{notice}</p>}
    {booking.status === 'pending' && <button type="button" className="booking-finance-confirm" disabled={booking.agreed_total === null || confirming} onClick={async () => { setConfirming(true); try { await onConfirm(); } finally { setConfirming(false); } }}>{confirming ? 'Confirming…' : 'Confirm booking'}</button>}
  </dialog>;
}
