import { useEffect, useMemo, useState } from 'react';
import { Breakdown, Trend, colors } from './ReportCharts.jsx';
import { generateMockReport } from './mockReport.js';
import { columns, downloadReport, label, money, number } from './reportExport.js';
import './analytics.css';
import './tremor-dashboard.css';

const defaults = { preset: 'rolling', group: 'month', source: 'all', status: 'all', stay_id: '0', activity_id: '0', from: '', to: '' };
const sources = ['all', 'website', 'website_chat', 'facebook', 'manual', 'unknown'];
const statuses = ['all', 'pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'];

export default function AnalyticsPage({ onLogout }) {
  const [draft, setDraft] = useState(defaults); const [filters, setFilters] = useState(defaults);
  const [liveReport, setReport] = useState(null); const [mockSeed, setMockSeed] = useState(null);
  const [busy, setBusy] = useState(true); const [error, setError] = useState(''); const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setBusy(true); setError('');
    fetch(`/api/admin/analytics.php?${new URLSearchParams(filters)}`, { headers: { Accept: 'application/json' }, signal: controller.signal }).then(async response => {
      if (response.status === 401) { onLogout(); return; }
      const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Could not load analytics.');
      setReport(data.report);
    }).catch(err => { if (err.name !== 'AbortError') setError(err.message); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [filters, onLogout, refresh]);
  const change = event => setDraft(current => ({ ...current, [event.target.name]: event.target.value }));
  const select = (name, title, options) => <label>{title}<select name={name} value={draft[name]} onChange={change}>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>;
  const report = useMemo(() => liveReport && mockSeed !== null ? generateMockReport(liveReport, mockSeed) : liveReport, [liveReport, mockSeed]);
  const m = report?.metrics;
  const stale = busy || !!error;
  return <section className="bi-page" aria-labelledby="analytics-title">
    <header className="bi-heading"><div><p className="bi-eyebrow">ODIDEPSE / BUSINESS INTELLIGENCE</p><h1 id="analytics-title">Resort performance</h1><p>Bookings, guests & financial overview</p></div><div className="bi-toolbar">
      <button type="button" disabled={busy} onClick={() => setRefresh(v => v + 1)}>↻ Refresh</button>
      <button type="button" className="bi-mock-button" disabled={!liveReport || stale} onClick={() => setMockSeed(seed => (seed ?? 0) + 1)}>{mockSeed === null ? 'Generate mock' : 'Regenerate mock'}</button>
      {mockSeed !== null && <button type="button" disabled={busy} onClick={() => setMockSeed(null)}>Show live data</button>}
      <button type="button" disabled={!report || stale || mockSeed !== null} onClick={() => downloadReport(report)}>↓ Export CSV</button>
      <button type="button" disabled={!report || stale || mockSeed !== null} onClick={() => window.print()}>Print / PDF</button>
    </div></header>
    <form className="bi-filters" onSubmit={event => { event.preventDefault(); setFilters({ ...draft }); }}>
      <div className="bi-filter-title"><span aria-hidden="true">≡</span> Report filters</div>
      {select('preset', 'Reporting period', [['rolling','Rolling 12 months'],['year','Current year'],['previous','Previous year'],['all','All history'],['custom','Custom dates']])}
      {draft.preset === 'custom' && <><label>From<input name="from" type="date" required value={draft.from} onChange={change} /></label><label>To<input name="to" type="date" required min={draft.from} value={draft.to} onChange={change} /></label></>}
      {select('group', 'Trend interval', [['month','Monthly'],['year','Yearly']])}
      {select('source','Booking source',sources.map(value => [value,label(value)]))}
      {select('status','Current status',statuses.map(value => [value,label(value)]))}
      {select('stay_id','Accommodation',[['0','All accommodations'],...(report?.options.stays || []).map(v => [String(v.id),v.name])])}
      {select('activity_id','Activity',[['0','All activities'],...(report?.options.activities || []).map(v => [String(v.id),v.name])])}
      <div className="bi-filter-buttons"><button className="bi-primary" disabled={busy}>Apply</button><button type="button" disabled={busy} onClick={() => { setDraft(defaults); setFilters(defaults); }}>Reset</button></div>
    </form>
    {busy && <p role="status" className="bi-notice">Calculating your report…</p>}
    {error && <p role="alert" className="bi-error">{error} <button type="button" onClick={() => setRefresh(v => v + 1)}>Retry</button></p>}
    {mockSeed !== null && <p className="bi-mock-banner" role="status"><strong>MOCK PREVIEW</strong> Illustrative figures only. No bookings or payments were created; accommodation and activity names come from your current resort catalog. Exports are available again in live mode.</p>}
    {report && <div className={stale ? 'bi-results is-stale' : 'bi-results'} aria-busy={busy}>
      <div className="bi-report-meta"><span><i /> {report.filters.from} — {report.filters.to} · {label(report.filters.group)} trends</span><span>Updated {new Date(report.generated_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })} PHT</span></div>
      <p className="bi-applied">Applied: {label(report.filters.source)} sources · {label(report.filters.status)} statuses · {report.options.stays.find(v => v.id === report.filters.stay_id)?.name || 'All accommodations'} · {report.options.activities.find(v => v.id === report.filters.activity_id)?.name || 'All activities'}</p>
      <div className="bi-section-heading"><div><p className="bi-section-kicker">OVERVIEW</p><h2>Performance at a glance</h2></div><span>Key metrics for the selected period</span></div>
      <div className="bi-kpis">{[
        ['Booked value',money(m.booked),'Confirmed, checked in & completed', 'booked'],
        ['Net cash collected',money(m.net),'Payments less refunds · transaction date', 'net'],
        ['Outstanding balance',money(m.outstanding),'For stays in this period · includes estimates', 'outstanding'],
        ['Pending pipeline',money(m.pipeline),'Pending stays · includes estimates', 'pipeline'],
        ['Booking requests',number(m.requests),'By request creation date', 'requests'],
        ['Guests expected / hosted',number(m.guests),`${number(m.stays)} accepted stays · by check-in date`, 'guests'],
        ['Average booking value',money(m.average_value),'Priced accepted stays only', 'average'],
        ['Cancellation rate',m.cancellation_rate === null ? '—' : `${number(m.cancellation_rate)}%`,'Current outcomes of requests in period', 'cancelled'],
      ].map(([title,value,note,key],i) => <article className="bi-kpi" key={key} style={{ '--tile-color': colors[i % colors.length] }}><span>{title}</span><strong>{value}</strong><small>{note}</small><div className="bi-kpi-rule" /></article>)}</div>
      <div className="bi-quality"><strong>Financial coverage</strong><span>{money(m.agreed)} agreed · {money(m.estimated)} estimated across {number(m.estimated_bookings)} stays · {number(m.unpriced)} accepted stays without a value</span><span>Catalog estimates exclude activity charges. Review amounts in Booking details → Finance.</span></div>
      {!m.requests && !m.stays && Number(m.paid) === 0 && Number(m.refunded) === 0 && <p className="bi-notice">No matching requests, accepted stays, or cash transactions. Try another reporting period or reset the filters.</p>}
      <div className="bi-section-heading"><div><p className="bi-section-kicker">TRENDS</p><h2>How the resort is performing</h2></div><span>Bookings, revenue and guest volume over time</span></div>
      <div className="bi-chart-grid">
        <Trend title="Booking trends" caption="Requests by creation date · accepted stays by check-in date" rows={report.series} lines={[{key:'requests',label:'Booking requests'},{key:'stays',label:'Accepted stays'}]} />
        <Trend title="Financial performance" caption="PHP · check-in value compared with cash by transaction date" rows={report.series} currency lines={[{key:'agreed',label:'Agreed booking value'},{key:'net',label:'Net cash collected'},{key:'estimated',label:'Estimated booking value',dashed:true}]} />
        <Trend title="People visiting the resort" caption="Party sizes for confirmed, checked-in and completed stays" rows={report.series} bars lines={[{key:'guests',label:'Guests expected / hosted'}]} />
        <Trend title="Income per month / year" caption="Cash received and refunded in the selected transaction period" rows={report.series} currency bars lines={[{key:'paid',label:'Payments'},{key:'refunded',label:'Refunds'}]} />
      </div>
      <div className="bi-section-heading"><div><p className="bi-section-kicker">INSIGHTS</p><h2>Booking mix and activity demand</h2></div><span>Understand what drives each request</span></div>
      <div className="bi-breakdown-grid">
        <Breakdown title="Booking outcomes" caption="Current status · requests created in the period" values={report.status} donut />
        <Breakdown title="Where bookings come from" caption="Request creation date · unknown legacy sources remain visible" values={report.sources} />
        <article className="bi-panel"><header><div><h3>Most requested activities</h3><p>Demand from requests created in this period</p></div></header>{report.activities.length ? <ul className="bi-activity-list">{report.activities.map((activity,i) => <li key={activity.name}><span className="bi-rank">{String(i+1).padStart(2,'0')}</span><div><strong>{activity.name}</strong><small>{number(activity.guests)} guests in requesting parties</small></div><b>{number(activity.requests)}<small>requests</small></b></li>)}</ul> : <p className="bi-empty">No recorded activity requests in this period.</p>}<p className="bi-footnote">Party size indicates potential demand, not confirmed participants or activity sales.</p></article>
      </div>
      <article className="bi-panel bi-financial"><header><div><h3>Monthly financial report</h3><p>PHP · booking values by check-in month; collections by transaction month</p></div><span className="bi-report-tag">FINANCIAL SUMMARY</span></header><div className="bi-table-wrap" tabIndex="0" aria-label="Monthly financial report, scroll for more columns"><table><caption>Monthly financial report in Philippine pesos</caption><thead><tr>{columns.map(([key,title]) => <th key={key} scope="col">{title}</th>)}</tr></thead><tbody>{report.monthly.map(row => <tr key={row.period}>{columns.map(([key,,currency]) => key === 'period' ? <th scope="row" key={key}>{row[key]}</th> : <td key={key}>{currency ? money(row[key]) : number(row[key])}</td>)}</tr>)}</tbody><tfoot><tr>{columns.map(([key,,currency]) => <td key={key}>{key === 'period' ? 'Total' : currency ? money(m[key]) : number(m[key])}</td>)}</tr></tfoot></table></div></article>
      <article className="bi-panel"><header><div><h3>Accommodation performance</h3><p>Accepted stays by check-in date · combined room bookings shown once</p></div></header><div className="bi-table-wrap" tabIndex="0"><table><caption>Accommodation performance</caption><thead><tr><th>Accommodation / room combination</th><th>Stays</th><th>Guests</th><th>Booked value</th><th>Average nights</th></tr></thead><tbody>{report.accommodations.map(stay => <tr key={stay.name}><th scope="row">{stay.name}</th><td>{number(stay.stays)}</td><td>{number(stay.guests)}</td><td>{money(stay.booked)}</td><td>{number(stay.average_nights)}</td></tr>)}{!report.accommodations.length && <tr><td colSpan="5">No accepted stays in this period.</td></tr>}</tbody></table></div></article>
      <details className="bi-methodology"><summary>Report definitions & data notes</summary>
        <p>Rolling 12 months starts on the first day of the month eleven months ago and ends today. All history ends today; use current year or custom dates to include future stays. All dates use Asia/Manila.</p>
        <p>Accepted stays are confirmed, checked in or completed. Overdue confirmed bookings are shown as no-shows, following the booking workspace. Guest totals are party visits, not unique people or measured attendance. Cancellation rate uses current outcomes, not historical status snapshots.</p>
        <p>Booked value uses the agreed total or, when missing, the saved room estimate. Estimates use catalog rates at capture time and may differ from final charges. Changes to rooms or dates require staff to review the agreed total. Unknown values are excluded, never assumed to be zero.</p>
        <p>Outstanding balances use current booking totals and payments through the earlier of today or the report end date. They are grouped by check-in month and are not a historical balance sheet. Cash includes cancelled-booking payments and refunds unless excluded by the chosen status filter. A room filter includes the whole matching booking; it does not allocate charges or guests among rooms.</p>
        <p>Activity counts use recorded selections, including cancelled requests. Legacy labeled notes are matched only to exact catalog names. One party may request several activities; totals across activities are not unique guests. {report.unmapped} accepted stays could not be mapped to catalog inventory.</p>
      </details>
    </div>}
  </section>;
}
