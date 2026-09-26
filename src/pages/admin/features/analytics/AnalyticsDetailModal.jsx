import { useEffect, useMemo, useRef, useState } from 'react';
import { label, money, number } from './reportExport.js';
import { mockDetailPage } from './mockDetail.js';

const metricLabels = {
  booked: 'Booked value', net: 'Net cash collected', outstanding: 'Outstanding balance', pipeline: 'Pending pipeline',
  requests: 'Booking requests', guests: 'Guests expected / hosted', average: 'Average booking value', cancelled: 'Cancellation rate',
};
const currencyMetrics = new Set(['booked', 'net', 'outstanding', 'pipeline', 'average']);
const dateLabels = { net: 'Transaction date', requests: 'Created', cancelled: 'Created' };

export default function AnalyticsDetailModal({ metric, report, onClose, onLogout, onOpenBooking }) {
  const dialogRef = useRef(null);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => { dialogRef.current?.showModal(); return () => dialogRef.current?.close(); }, []);
  useEffect(() => { setPage(1); setDetail(null); }, [metric, report]);
  useEffect(() => {
    if (report.mock) return;
    const controller = new AbortController();
    setBusy(true); setError('');
    const params = new URLSearchParams({ ...report.filters, metric, page: String(page) });
    fetch(`/api/admin/analytics-detail.php?${params}`, { headers: { Accept: 'application/json' }, signal: controller.signal }).then(async response => {
      if (response.status === 401) { onLogout(); return; }
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Could not load booking details.');
      setDetail(body.detail);
    }).catch(failure => { if (failure.name !== 'AbortError') setError(failure.message); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [metric, report, page, retry, onLogout]);
  const mockDetail = useMemo(() => report.mock ? mockDetailPage(report, metric, page) : null, [report, metric, page]);
  const shown = mockDetail || detail;
  const rows = shown?.rows || [];
  const totalPages = shown ? Math.max(1, Math.ceil(shown.total_rows / shown.page_size)) : 1;
  const summary = metric === 'cancelled' ? shown?.value === null ? '-' : `${number(shown?.value)}%`
    : currencyMetrics.has(metric) ? money(shown?.value) : number(shown?.value);
  const close = () => dialogRef.current?.close();
  return <dialog ref={dialogRef} className="bi-detail-modal" aria-labelledby="bi-detail-title" onClose={onClose} onCancel={onClose}>
    <header className="bi-detail-modal__head"><div><p>BOOKING BREAKDOWN</p><h2 id="bi-detail-title">{metricLabels[metric]}</h2><span>{report.filters.from} - {report.filters.to}</span></div><button type="button" onClick={close} aria-label="Close booking breakdown">×</button></header>
    {report.mock && <p className="bi-detail-modal__note bi-detail-modal__mock-note"><strong>MOCK SAMPLE</strong> These sample bookings and transactions are illustrative only. Nothing here was saved.</p>}
    {shown && <div className="bi-detail-modal__summary"><strong>{summary}</strong><span>{metric === 'cancelled' ? `${number(report.metrics.cancelled_requests)} cancelled ${Number(report.metrics.cancelled_requests) === 1 ? 'booking' : 'bookings'} out of ${number(shown.total_rows)} requests` : `${shown.total_rows} ${metric === 'net' ? 'payment/refund entries' : 'booking rows'} in this breakdown`}</span></div>}
    {metric === 'average' && <p className="bi-detail-modal__note">Each listed booking contributes its booked value. The KPI divides their combined value by the number of priced accepted stays.</p>}
    {metric === 'cancelled' && <p className="bi-detail-modal__note">All requests created in the period are listed. A cancelled booking contributes 1 to the numerator; the rate divides cancelled requests by all listed requests.</p>}
    {metric === 'net' && <p className="bi-detail-modal__note">Payments add to net cash; refunds subtract from it. A booking can have more than one transaction row.</p>}
    {metric === 'outstanding' && <p className="bi-detail-modal__note">Only positive unpaid balances are listed. Payments through the earlier of today or the report end date are included.</p>}
    {busy && <p role="status" className="bi-detail-modal__state">Loading booking details...</p>}
    {error && <p role="alert" className="bi-detail-modal__error">{error} <button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button></p>}
    {shown && !busy && !error && (rows.length ? <div className="bi-detail-modal__table-wrap" tabIndex="0"><table><thead><tr><th>Booking</th><th>Guest</th><th>Stay</th><th>Status</th><th>{dateLabels[metric] || 'Check-in'}</th><th>Contribution</th><th>Basis</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.reference}-${row.date}-${row.basis}-${index}`}><td>{onOpenBooking && !report.mock ? <button type="button" className="bi-detail-modal__booking-link" onClick={() => onOpenBooking(row.booking_id)}>{row.reference}</button> : row.reference}</td><td>{row.guest}</td><td>{row.stay || 'Unspecified'}</td><td>{label(row.status)}</td><td>{row.date}</td><td>{currencyMetrics.has(metric) ? money(row.contribution) : number(row.contribution)}</td><td>{row.basis}</td></tr>)}</tbody></table></div> : <p className="bi-detail-modal__state">No matching booking rows for this metric and filter selection.</p>)}
    {shown && shown.total_rows > shown.page_size && <div className="bi-detail-modal__pager"><span>Page {page} of {totalPages} - {shown.total_rows} rows</span><button type="button" disabled={busy || page === 1} onClick={() => setPage(value => value - 1)}>Previous</button><button type="button" disabled={busy || page >= totalPages} onClick={() => setPage(value => value + 1)}>Next</button></div>}
  </dialog>;
}
