import { createContext, useCallback, useContext, useEffect, useState } from 'react';
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
  const [editingTotal, setEditingTotal] = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const [priceAmount, setPriceAmount] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
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
    const controller = new AbortController(); setData(null); setError(''); setMessage(''); setEditingTotal(false); setShowRefund(false);
    request(null, controller.signal).then(setData).catch(err => { if (err.name !== 'AbortError') setError(err.message); });
    return () => controller.abort();
  }, [request, reload]);
  useEffect(() => {
    if (!data) return;
    setPriceAmount(data.agreed_total ?? data.estimated_total ?? '');
    setPaymentAmount(Number(data.balance) > 0 ? data.balance : '');
  }, [data]);
  const save = async (event, extra) => {
    event.preventDefault(); const form = event.currentTarget;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await request({ ...Object.fromEntries(new FormData(form)), ...extra, revision: Number(data.finance_revision) });
      if (result) {
        setData(result); form.reset(); setVoidId(null); setEditingTotal(false); setShowRefund(false);
        setMessage(extra.action === 'set_total' ? 'Booking price saved.' : extra.action === 'void' ? 'Transaction voided.' : extra.kind === 'refund' ? 'Refund recorded.' : 'Payment recorded.');
        await onSaved();
      }
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const priceReason = data?.agreed_total === null && priceAmount !== '' && Number(priceAmount) !== 0
    ? { reason: 'Initial booking price confirmed by staff' } : {};
  const paymentLabel = Number(paymentAmount) > 0 && Number.isFinite(Number(paymentAmount))
    ? `Record ${money(paymentAmount)} payment` : 'Record payment';
  return <section className="booking-finance" aria-label="Booking finance">
    <div className="booking-finance__heading"><h3>Finance</h3><button type="button" disabled={busy} onClick={() => setReload(value => value + 1)}>Reload ledger</button></div>
    {error && <p role="alert" className="admin-error">{error}</p>}
    {message && <p role="status">{message}</p>}
    {!data && !error && <p role="status">Loading finance…</p>}
    {data && <>
      <dl className="booking-finance__totals">
        <div><div className="booking-finance__metric-head"><dt>Agreed total</dt>{data.agreed_total !== null && <button type="button" disabled={busy} onClick={() => { setPriceAmount(data.agreed_total); setEditingTotal(value => !value); }}>Edit</button>}</div><dd>{money(data.agreed_total)}</dd></div>
        <div><dt>Net collected</dt><dd>{money(data.net_collected)}</dd></div>
        <div className="booking-finance__balance"><dt>Remaining to pay</dt><dd>{data.agreed_total === null ? '—' : money(data.balance)}</dd></div>
      </dl>
      {editingTotal && data.agreed_total !== null && <div className="booking-finance__edit">
        <h4>Edit agreed total</h4>
        <form onSubmit={event => save(event, { action: 'set_total' })}>
          <label>New agreed total (PHP)<input name="amount" inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" value={priceAmount} onChange={event => setPriceAmount(event.target.value)} required /></label>
          <label>Why is the total changing?<input name="reason" maxLength={500} required /></label>
          <div className="booking-finance__form-actions"><button disabled={busy}>Save new total</button><button type="button" disabled={busy} onClick={() => setEditingTotal(false)}>Cancel</button></div>
        </form>
      </div>}
      {data.agreed_total === null ? <div className="booking-finance__primary">
        <h4>1. Confirm booking price</h4>
        <p>Set the final amount for this booking before recording a payment.</p>
        <form onSubmit={event => save(event, { action: 'set_total', ...priceReason })}>
          <label>Agreed total (PHP)<input name="amount" inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" value={priceAmount} onChange={event => setPriceAmount(event.target.value)} required /></label>
          {data.estimated_total !== null && <small className="booking-finance__hint">Started with the room estimate of {money(data.estimated_total)}. Change it if the agreed price differs; activities are not included.</small>}
          {priceAmount !== '' && Number(priceAmount) === 0 && <label>Why is this stay complimentary?<input name="reason" maxLength={500} required /></label>}
          <button className="booking-finance__primary-button" disabled={busy}>Confirm price</button>
        </form>
      </div> : <>
        {data.status !== 'cancelled' && Number(data.balance) > 0 ? <div className="booking-finance__primary">
          <h4>Record a payment</h4>
          <p>Up to {money(data.balance)} remains. Change the amount for a partial payment.</p>
          <form onSubmit={event => save(event, { action: 'record', kind: 'payment' })}>
            <label>Amount received (PHP)<input name="amount" inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" value={paymentAmount} onChange={event => setPaymentAmount(event.target.value)} required /></label>
            <label>Date received<input name="paid_on" type="date" max={today()} min="2000-01-01" defaultValue={today()} required /></label>
            <label>Method<select name="method">{['cash','gcash','bank_transfer','card','other'].map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>
            <label>Reference (optional)<input name="reference" maxLength={100} /></label>
            <button className="booking-finance__primary-button" disabled={busy}>{paymentLabel}</button>
          </form>
        </div> : <p className="booking-finance__state">{data.status === 'cancelled' ? 'This booking is cancelled. New payments are unavailable; any refund can be recorded below.' : 'This booking is paid in full.'}</p>}
        {Number(data.net_collected) > 0 && <div className="booking-finance__refund-action">
          <button type="button" disabled={busy} aria-expanded={showRefund} onClick={() => setShowRefund(value => !value)}>{showRefund ? 'Cancel refund' : 'Record a refund'}</button>
          {showRefund && <form key={`refund-${data.finance_revision}`} onSubmit={event => save(event, { action: 'record', kind: 'refund' })}>
            <p>Up to {money(data.net_collected)} can be refunded.</p>
            <label>Amount to refund (PHP)<input name="amount" inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" required /></label>
            <label>Refund date<input name="paid_on" type="date" max={today()} min="2000-01-01" defaultValue={today()} required /></label>
            <label>Method<select name="method">{['cash','gcash','bank_transfer','card','other'].map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>
            <label>Reference (optional)<input name="reference" maxLength={100} /></label>
            <label>Reason for refund<input name="note" maxLength={500} required /></label>
            <button disabled={busy}>Record refund</button>
          </form>}
        </div>}
      </>}
      <details className="booking-finance__history"><summary>Transaction history ({data.entries.length})</summary>
        {!data.entries.length && <p>No payments or refunds recorded.</p>}
        <div className="booking-finance__entries">{data.entries.map(entry => <article key={entry.id} className={entry.voided_at ? 'is-voided' : ''}>
          <strong>{entry.kind === 'payment' ? 'Payment' : 'Refund'} · {money(entry.amount)} {entry.voided_at && '· Voided'}</strong>
          <p>{entry.paid_on} · {entry.method.replaceAll('_', ' ')} · recorded by admin #{entry.created_by}</p>
          {entry.reference && <p>Reference: {entry.reference}</p>}{entry.note && <p>{entry.note}</p>}
          {entry.voided_at ? <p>Voided {entry.voided_at} by admin #{entry.voided_by}: {entry.void_reason}</p> : <button disabled={busy} type="button" onClick={() => setVoidId(Number(entry.id))}>Correct / void entry</button>}
          {voidId === Number(entry.id) && <form onSubmit={event => save(event, { action: 'void', entry_id: Number(entry.id) })}><p>Voiding reverses this entry’s effect on the balance and retains its audit record.</p><label>Correction reason<input name="reason" maxLength={500} required /></label><button disabled={busy}>Confirm void</button><button type="button" onClick={() => setVoidId(null)}>Keep entry</button></form>}
        </article>)}</div>
        <details><summary>Price change history</summary>{data.audit.length ? data.audit.map((item, index) => <p key={index}>{item.created_at} · {money(item.old_total)} → {money(item.new_total)} · admin #{item.created_by}<br />{item.reason}</p>) : <p>No price changes recorded.</p>}</details>
      </details>
    </>}
  </section>;
}

