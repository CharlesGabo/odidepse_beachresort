import { useEffect, useRef, useState } from 'react';
import './analytics.css';

const label = value => value.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());
const moneyKeys = new Set(['booked_value','collected','refunded','outstanding']);
const percentKeys = new Set(['occupancy','conversion_rate','cancellation_rate','no_show_rate','financial_coverage']);
const number = value => value === null || value === undefined ? '—' : new Intl.NumberFormat('en-PH', { maximumFractionDigits: 2 }).format(Number(value));
const format = (key, value) => value === null || value === undefined ? '—' : moneyKeys.has(key) ? `₱${number(value)}` : percentKeys.has(key) ? `${number(value)}%` : number(value);
const defaults = { preset: '90', from: '', to: '', stay_id: '0', source: 'all', status: 'all' };

function Trend({ title, rows, lines, caption }) {
  const width = 720, height = 190, pad = 25;
  const max = Math.max(1, ...rows.flatMap(row => lines.map(line => Number(row[line.key]) || 0)));
  const x = i => pad + i / Math.max(1, rows.length - 1) * (width - pad * 2);
  const y = value => height - pad - (Number(value) || 0) / max * (height - pad * 2);
  return <section className="analytics-panel"><h3>{title}</h3><p>{caption}</p>
    <div className="analytics-legend">{lines.map(line => <span key={line.key}><i style={{ background: line.color }} />{line.label}</span>)}</div>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}. Exact values are in the expandable table below.`}>
      {[0, 0.5, 1].map(part => <g key={part}><line x1={pad} x2={width - pad} y1={y(max * part)} y2={y(max * part)} stroke="#e6e9e0" /><text x={pad} y={y(max * part) - 4} fontSize="10" fill="#69776d">{number(max * part)}</text></g>)}
      {lines.map(line => <polyline key={line.key} points={rows.map((row, i) => `${x(i)},${y(row[line.key])}`).join(' ')} fill="none" stroke={line.color} strokeWidth="2.5" strokeDasharray={line.dashed ? '5 4' : undefined} />)}
    </svg>
    <div className="analytics-axis"><span>{rows[0]?.date}</span><span>{rows.at(-1)?.date}</span></div>
    <details><summary>View chart data</summary><div className="analytics-table-wrap"><table><thead><tr><th>Date</th>{lines.map(line => <th key={line.key}>{line.label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.date}><th>{row.date}</th>{lines.map(line => <td key={line.key}>{number(row[line.key])}</td>)}</tr>)}</tbody></table></div></details>
  </section>;
}

function Breakdown({ title, values, unit, onChoose }) {
  const sorted = Object.entries(values).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...Object.values(values));
  return <section className="analytics-panel"><h3>{title}</h3><p>{unit}</p>{!sorted.length ? <p>No matching data.</p> : <ul className="analytics-bars">{sorted.map(([key, value]) => <li key={key}><div>{onChoose ? <button type="button" onClick={() => onChoose(key)}>{label(key)}</button> : <span>{label(key)}</span>}<strong>{number(value)}</strong></div><div className="analytics-bar"><span style={{ width: `${value / max * 100}%` }} /></div></li>)}</ul>}</section>;
}

const roomEstimate = value => {
  const low = Math.floor(Number(value) || 0), high = Math.ceil(Number(value) || 0);
  return low === high ? `${low}` : `${low}–${high}`;
};

function OwnerForecastSummary({ forecast }) {
  const daily = forecast.daily || [];
  const eligible = forecast.models?.rooms?.eligible;
  const total = key => daily.reduce((sum, day) => sum + (Number(day.rooms?.[key]) || 0), 0);
  const forecastTotal = total('value'), bookedTotal = total('on_books');
  const additionalTotal = Math.max(0, forecastTotal - bookedTotal);
  const pendingTotal = daily.reduce((sum, day) => sum + (Number(day.pending_room_nights) || 0), 0);
  const focusDays = [...daily].sort((a, b) => {
    const gap = day => Math.max(0, Number(day.rooms.value) - Number(day.rooms.on_books));
    return gap(b) - gap(a) || Number(b.rooms.value) - Number(a.rooms.value);
  }).slice(0, 3);
  if (!daily.length) return null;
  return <section className="analytics-owner-summary" aria-labelledby="owner-forecast-heading">
    <div><span className="admin-kicker">Plain-language result</span><h4 id="owner-forecast-heading">What this forecast means for the owner</h4></div>
    {!eligible ? <p>There is not enough history for a reliable prediction yet. The figures below describe confirmed reservations only, so do not treat them as total expected demand.</p> : <>
      <p>Across the next 30 days, the model expects about <strong>{number(forecastTotal)} occupied room-nights</strong>. <strong>{number(bookedTotal)}</strong> are already confirmed, leaving about <strong>{number(additionalTotal)} room-nights</strong> of expected demand that has not yet been booked.</p>
      <div className="analytics-owner-days">{focusDays.map(day => {
        const additional = Math.max(0, Number(day.rooms.value) - Number(day.rooms.on_books));
        const possibleLow = Math.max(0, Math.floor(Number(day.rooms.lower)));
        const possibleHigh = Math.max(possibleLow, Math.ceil(Number(day.rooms.upper)));
        return <article key={day.date}><strong>{new Date(`${day.date}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', weekday: 'short' })}</strong><span>About {roomEstimate(day.rooms.value)} rooms expected</span><span>{number(day.rooms.on_books)} already booked</span><span>About {roomEstimate(additional)} more may still be booked</span><small>Reasonable total range: {possibleLow}–{possibleHigh} rooms</small></article>;
      })}</div>
    </>}
    <div className="analytics-owner-action"><strong>What to do</strong><ul>
      {eligible && <li>Prepare rooms, housekeeping and staffing around the expected counts above, while keeping the uncertainty range in mind.</li>}
      {eligible && additionalTotal > 0 && <li>Keep suitable inventory visible and follow up promising inquiries; the forecast suggests demand remains beyond current confirmed reservations.</li>}
      {pendingTotal > 0 && <li>Review the {number(pendingTotal)} pending room request{pendingTotal === 1 ? '' : 's'} separately—they are not counted as confirmed bookings.</li>}
      <li>Check actual capacity before accepting reservations; a forecast is planning guidance, not permission to overbook.</li>
    </ul></div>
  </section>;
}

export default function AnalyticsPage({ csrfToken, onLogout, onOpenBookings }) {
  const [draft, setDraft] = useState(defaults);
  const [filters, setFilters] = useState(defaults);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [insights, setInsights] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [mockBusy, setMockBusy] = useState(false);
  const [mockError, setMockError] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    const controller = new AbortController(); generation.current++; setLoading(true); setError(''); setReport(null); setInsights(null); setAiError(''); setAiBusy(false);
    fetch(`/api/admin/analytics.php?${new URLSearchParams(filters)}`, { signal: controller.signal, headers: { Accept: 'application/json' } })
      .then(async response => {
        if (response.status === 401) { onLogout(); return; }
        const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Analytics could not be loaded.');
        setReport(data.analytics);
      }).catch(err => { if (err.name !== 'AbortError') setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); generation.current++; };
  }, [filters, reload, onLogout]);
  const generate = async () => {
    const current = generation.current; let responseStatus = null; let diagnostic = null; setAiBusy(true); setAiError('');
    try {
      const response = await fetch('/api/admin/analytics-insights.php', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify(filters) });
      responseStatus = response.status;
      if (response.status === 401) { onLogout(); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'AI insights are unavailable.');
      if (current !== generation.current) return;
      diagnostic = data.result.diagnostic || null;
      if (!data.result.available) throw new Error(data.result.message);
      if (data.result.data_hash !== report.data_hash) throw new Error('The underlying data changed. Refresh analytics before generating insights.');
      setInsights(data.result);
    } catch (err) {
      console.error('[Analytics AI] Insight generation failed', { endpoint: '/api/admin/analytics-insights.php', httpStatus: responseStatus, diagnostic, message: err.message });
      if (current === generation.current) setAiError(diagnostic?.reference ? `${err.message} Diagnostic reference: ${diagnostic.reference}.` : err.message);
    }
    finally { if (current === generation.current) setAiBusy(false); }
  };
  const generateMock = async () => {
    setMockBusy(true); setMockError('');
    try {
      const response = await fetch('/api/admin/analytics-mock.php', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': csrfToken }, body: '{}' });
      if (response.status === 401) { onLogout(); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not generate mock data.');
      const next = { ...defaults, dataset: 'mock', seed: String(data.seed) };
      setDraft(next); setFilters(next);
    } catch (err) { setMockError(err.message); }
    finally { setMockBusy(false); }
  };
  const mock = report?.dataset === 'mock';
  const open = (basis, overrides = {}) => onOpenBookings({ status: overrides.status || report.filters.status, analytics: { ...report.filters, basis, ...overrides } });
  const forecast = report?.forecast;
  const model = forecast?.models.rooms;
  const dayRows = forecast?.daily.map(day => ({ date: day.date, projected: day.rooms.value, booked: day.rooms.on_books, lower: day.rooms.lower, upper: day.rooms.upper })) || [];
  return <section className="analytics-page admin-view" aria-labelledby="analytics-heading">
    <div className="analytics-heading"><div><span className="admin-kicker">Performance & planning</span><h2 id="analytics-heading">Analytics</h2><p>Understand your bookings. Plan the next season.</p></div><div className="analytics-actions"><button type="button" disabled={loading || mockBusy} onClick={() => setReload(value => value + 1)}>Refresh data</button>{report?.mock_available && <button type="button" disabled={loading || mockBusy || aiBusy} onClick={generateMock}>{mockBusy ? 'Generating mock data…' : 'Generate mock data'}</button>}{filters.dataset === 'mock' && <button type="button" disabled={loading || mockBusy} onClick={() => { setDraft(defaults); setFilters(defaults); setMockError(''); }}>Use real data</button>}</div></div>
    {mockError && <p className="admin-error" role="alert">{mockError}</p>}
    {filters.dataset === 'mock' && <div className="analytics-quality" role="status"><strong>Mock data · testing only</strong><span>{report?.mock_booking_count ? `${report.mock_booking_count.toLocaleString()} synthetic bookings. ` : ''}Two years of sample history and upcoming reservations. Real bookings, availability and payments are unchanged. AI insights in this view describe sample data.</span></div>}
    <form className="analytics-filters" onSubmit={event => { event.preventDefault(); setFilters({ ...draft }); }}>
      <label>Period<select value={draft.preset} onChange={event => setDraft({ ...draft, preset: event.target.value })}><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Trailing 12 months</option><option value="custom">Custom dates</option></select></label>
      {draft.preset === 'custom' && <><label>From<input type="date" required value={draft.from} onChange={event => setDraft({ ...draft, from: event.target.value })} /></label><label>To<input type="date" required value={draft.to} onChange={event => setDraft({ ...draft, to: event.target.value })} /></label></>}
      <label>Accommodation<select value={draft.stay_id} onChange={event => setDraft({ ...draft, stay_id: event.target.value })}><option value="0">All accommodations</option>{report?.accommodations.map(stay => <option key={stay.id} value={stay.id}>{stay.name}</option>)}</select></label>
      <label>Source<select value={draft.source} onChange={event => setDraft({ ...draft, source: event.target.value })}>{['all','website','website_chat','facebook','manual','unknown'].map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
      <label>Status<select value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value })}>{['all','pending','confirmed','checked_in','completed','cancelled','no_show'].map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
      <button type="submit" disabled={loading}>Apply filters</button>
    </form>
    {loading && <p role="status">Calculating analytics…</p>}{error && <p className="admin-error" role="alert">{error}</p>}
    {report && <>
      <p className="analytics-meta">{report.filters.from} – {report.filters.to} · Generated {new Date(report.generated_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} Manila time</p>
      <div className="analytics-kpis">{[
        ['requests','Booking requests','Created in selected period','requests'], ['room_nights','Occupied room-nights','Realized scheduled nights before today','stays'],
        ['occupancy','Occupancy','Against current available inventory','stays'], ['guest_arrivals','Guest arrivals','Checked-in / completed parties','stays'],
        ['booked_value','Agreed booking value','Active / completed bookings overlapping period','stays'], ['collected','Payments collected','By transaction date'],
        ['refunded','Refunds recorded','By transaction date'], ['outstanding','Outstanding balance','Current balance for matching active stays','stays'],
      ].map(([key, title, note, basis]) => <article key={key}><span>{title}</span><strong>{format(key, report.metrics[key])}</strong><small>{note}</small>{basis && !mock && <button type="button" onClick={() => open(basis)}>View bookings →</button>}</article>)}</div>
      <div className="analytics-secondary">{['arrivals','realized_stays','average_stay','average_lead_days','conversion_rate','cancellation_rate','no_show_rate','financial_coverage'].map(key => <div key={key}><span>{label(key)}</span><strong>{format(key, report.metrics[key])}</strong></div>)}</div>
      <div className="analytics-quality" role="status"><strong>Data coverage</strong><span>{report.metrics.missing_totals} matching bookings without totals · {report.metrics.unknown_sources} requests with unknown source · {report.metrics.unmapped_stays} stays without mapped inventory · {report.metrics.overdue_checkouts} overdue checkouts</span></div>
      <div className="analytics-grid"><Trend title="Booking and stay trends" caption="Requests by creation date; arrivals by check-in date; room-nights exclude today." rows={report.series} lines={[{ key: 'requests', label: 'Requests', color: '#b07634' }, { key: 'arrivals', label: 'Arrivals', color: '#6b7ca0' }, { key: 'room_nights', label: 'Room-nights', color: '#27654e' }]} />
        <Trend title="Collections and refunds" caption="Recorded transactions in PHP, by payment date." rows={report.series} lines={[{ key: 'collected', label: 'Collected', color: '#27654e' }, { key: 'refunded', label: 'Refunded', color: '#b07634' }]} />
        <Breakdown title="Request outcomes" values={report.breakdowns.status} unit="Current status of requests created in the period" onChoose={mock ? undefined : status => open('requests', { status })} />
        <Breakdown title="Booking sources" values={report.breakdowns.source} unit="Requests created in the period" onChoose={mock ? undefined : source => open('requests', { source })} />
        <Breakdown title="Accommodation demand" values={report.breakdowns.accommodation} unit="Realized scheduled room-nights" />
        <Breakdown title="Recorded activities" values={report.breakdowns.activity} unit="Arriving parties with a single structured activity" />
        <Breakdown title="Days of the week" values={report.breakdowns.weekday} unit="Realized scheduled room-nights" />
        <Breakdown title="Monthly demand" values={report.breakdowns.month} unit="Realized scheduled room-nights" />
      </div>
      <section className="analytics-forecast" aria-labelledby="forecast-heading">
        <div className="analytics-heading"><div><span className="admin-kicker">Next 90 days</span><h3 id="forecast-heading">Demand forecast</h3><p>Uses history for the selected accommodation and source. Report dates and status do not restrict model training.</p></div><span className="analytics-badge">{model.eligible ? label(model.model) : 'On-the-books demand only'}</span></div>
        {!model.eligible ? <p className="analytics-quality">Insufficient history for prediction: {model.samples} finalized bookings across {model.history_days} days. A baseline needs 30 finalized bookings and 12 weeks; ML evaluation needs 60 bookings and 26 weeks.</p> : <p className="analytics-quality">{label(model.confidence)} · Training: {model.training_start} – {model.training_end}. {model.interval_note}</p>}
        {[...forecast.daily, ...forecast.weekly].some(day => day.over_capacity) && <p className="admin-error">Some existing reservations exceed current configured capacity. Review inventory and room assignments.</p>}
        <OwnerForecastSummary forecast={forecast} />
        <Trend title="Next 30 days · room demand" caption="Confirmed reservations form a scenario floor. Pending requests are listed separately in the table." rows={dayRows} lines={[{ key: 'projected', label: model.eligible ? 'Forecast' : 'Reserved room-nights', color: '#27654e' }, { key: 'booked', label: 'On books', color: '#b07634', dashed: true }, ...(model.eligible ? [{ key: 'upper', label: 'Upper band', color: '#9eaaa1', dashed: true }, { key: 'lower', label: 'Lower band', color: '#bbc8ba', dashed: true }] : [])]} />
        <details><summary>Daily arrivals, guests and occupancy</summary><div className="analytics-table-wrap"><table><thead><tr><th>Date</th><th>Arrivals</th><th>Guests arriving</th><th>Room-nights</th><th>Occupancy</th><th>Pending room requests</th></tr></thead><tbody>{forecast.daily.map(day => <tr key={day.date}><th>{day.date}</th><td>{number(day.arrivals.value)}</td><td>{number(day.guests.value)}</td><td>{number(day.rooms.value)}</td><td>{format('occupancy', day.occupancy)}</td><td>{day.pending_room_nights}</td></tr>)}</tbody></table></div></details>
        <h4>Days 31–90 · weekly outlook</h4><div className="analytics-table-wrap"><table><thead><tr><th>Period</th><th>Room-nights</th><th>On books</th><th>Band</th><th>Arrivals</th><th>Guests</th><th>Occupancy</th></tr></thead><tbody>{forecast.weekly.map(week => <tr key={week.from}><th>{week.from} – {week.to}</th><td>{number(week.rooms.value)}</td><td>{number(week.rooms.on_books)}</td><td>{week.rooms.lower === null ? 'Unavailable' : `${number(week.rooms.lower)}–${number(week.rooms.upper)}`}</td><td>{number(week.arrivals.value)}</td><td>{number(week.guests.value)}</td><td>{format('occupancy', week.occupancy)}</td></tr>)}</tbody></table></div>
        <details><summary>Model validation and limitations</summary><p>Models train on earlier dates and are evaluated at later dates across available 14, 30, 60 and 90-day validation windows. The candidate must reduce validation MAE by at least 2% to replace the current baseline. Annual features require two years. Errors shown describe historical performance, not guaranteed future accuracy.</p><div className="analytics-table-wrap"><table><thead><tr><th>Target</th><th>Candidate</th><th>MAE</th><th>WAPE</th><th>Validation points</th></tr></thead><tbody>{Object.entries(forecast.models).flatMap(([target, info]) => Object.entries(info.scores).map(([name, score]) => <tr key={`${target}-${name}`}><th>{label(target)}{name === info.model ? ' · selected' : ''}</th><td>{label(name)}</td><td>{number(score.mae)}</td><td>{score.wape === null ? 'Undefined (zero demand)' : `${number(score.wape)}%`}</td><td>{score.validation_points}</td></tr>))}</tbody></table></div><p>Model version: {forecast.version}. Unobserved demand, old status corrections, closures and historical capacity changes cannot be reconstructed.</p></details>
      </section>
      <section className="analytics-ai" aria-labelledby="analytics-ai-heading"><div className="analytics-heading"><div><span className="admin-kicker">Gemini analysis</span><h3 id="analytics-ai-heading">AI insights</h3><p>Generate explanations and suggested actions from aggregate metrics. Identical results are reused for up to six hours.</p></div><button type="button" disabled={aiBusy} onClick={generate}>{aiBusy ? 'Generating…' : 'Generate AI insights'}</button></div>
        {aiError && <p role="alert">{aiError}</p>}{aiBusy && <p role="status">Interpreting aggregate results…</p>}
        {insights && <><p>{insights.insights.summary}</p><div className="analytics-grid">{insights.insights.insights.map((item, index) => <article className="analytics-panel" key={index}><span className="analytics-badge">{label(item.confidence)} confidence</span><h4>{item.title}</h4><p>{item.observation}</p><p><strong>Suggested action:</strong> {item.action}</p><dl>{item.evidence.map(key => <div key={key}><dt>{label(key)}</dt><dd>{format(key, insights.evidence[key])}</dd></div>)}</dl></article>)}</div><p>{insights.insights.caveat}</p><small>{insights.cached ? 'Cached analysis' : 'Generated analysis'} · {new Date(insights.generated_at).toLocaleString('en-PH')}</small></>}
      </section>
      <details className="analytics-methodology"><summary>How these numbers are calculated</summary>{report.notes.map(note => <p key={note}>{note}</p>)}<p>Recorded status transitions in this period: {Object.entries(report.recorded_transitions).map(([key, value]) => `${label(key)}: ${value}`).join(' · ') || 'None since tracking began'}</p></details>
    </>}
  </section>;
}
