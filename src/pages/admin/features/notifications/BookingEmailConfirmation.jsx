import { useEffect, useRef, useState } from 'react';
import './notifications.css';

export default function BookingEmailConfirmation({ booking, status, label, onConfirm, onClose }) {
  const ref = useRef(null);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="notification-confirm" onCancel={e => { if (busy) e.preventDefault(); else onClose(); }} aria-labelledby="email-confirm-title">
    <form onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError('');
      try { await onConfirm({ staff_note: note, cancellation_reason: reason, expected_updated_at: booking.updated_at }); onClose(); }
      catch (failure) { setError(failure.message); } finally { setBusy(false); }
    }}>
      <h2 id="email-confirm-title">{label} booking</h2>
      <p>{booking.reference_code} · {booking.guest_name}</p>
      <p>{booking.stay_type || 'Accommodation to be arranged'} · {booking.guests} guests<br />{booking.check_in} to {booking.check_out}</p>
      <p>New status: <strong>{status.replaceAll('_', ' ')}</strong></p>
      <p>{booking.email ? `An email with this summary will be queued for ${booking.email} when this notification is enabled.` : 'This guest has no email address. No customer email will be sent.'}</p>
      {status === 'cancelled' && <label className="notification-field">Cancellation reason (sent to guest)<textarea required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>}
      <label className="notification-field">Optional message to guest<textarea maxLength={1000} value={note} onChange={e => setNote(e.target.value)} /></label>
      {error && <p role="alert" className="admin-error">{error}</p>}
      <div className="notification-pages"><button type="button" disabled={busy} onClick={onClose}>Back</button><button disabled={busy}>{busy ? 'Saving…' : `Apply ${label.toLowerCase()}`}</button></div>
    </form>
  </dialog>;
}
