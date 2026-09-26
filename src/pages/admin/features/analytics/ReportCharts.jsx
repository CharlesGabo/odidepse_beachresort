import { useId } from 'react';
import { label, money, monthLabel, number } from './reportExport.js';

export const colors = ['#6366f1', '#14b8a6', '#f59e0b', '#f43f5e', '#0ea5e9', '#94a3b8'];

export function Trend({ title, caption, rows, lines, currency = false, percent = false, bars = false, showData = false, latestValues = false }) {
  const id = useId();
  const hasValue = value => value !== null && value !== undefined && Number.isFinite(Number(value));
  const values = rows.flatMap(row => lines.map(line => row[line.key]).filter(hasValue).map(Number));
  const min = Math.min(0, ...values); const max = Math.max(1, ...values);
  const span = max - min; const low = min < 0 ? min - span * .08 : 0; const high = max + span * .1;
  const x = index => 64 + (index + .5) * 600 / Math.max(1, rows.length);
  const y = value => 220 - (value - low) / (high - low) * 185;
  const tick = value => currency ? `₱${new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}` : percent ? `${number(value)}%` : number(value);
  const format = percent ? value => value === null ? '—' : `${number(value)}%` : currency ? money : number;
  const finalPoint = line => {
    for (let index = rows.length - 1; index >= 0; index--) if (hasValue(rows[index][line.key])) return { index, value: Number(rows[index][line.key]) };
    return null;
  };
  const chartTable = <div className="bi-table-wrap" tabIndex="0"><table><caption>{title}</caption><thead><tr><th>Period</th>{lines.map(line => <th key={line.key}>{line.label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.period}><th scope="row">{monthLabel(row.period)}</th>{lines.map(line => <td key={line.key}>{format(row[line.key])}</td>)}</tr>)}</tbody></table></div>;
  return <article className="bi-panel bi-trend" aria-labelledby={id}>
    <header><div><h3 id={id}>{title}</h3><p>{caption}</p></div><span className="bi-panel-mark" aria-hidden="true">•••</span></header>
    <div className="bi-legend">{lines.map((line, index) => <span key={line.key}><i style={{ background: colors[index] }} />{line.label}</span>)}</div>
    {latestValues && <div className="bi-trend-latest" aria-label="Latest values">{lines.map((line, index) => { const point = finalPoint(line); return point && <span key={line.key} style={{ color: colors[index] }}>{line.endLabel || line.label} <strong>{tick(point.value)}</strong></span>; })}</div>}
    <svg viewBox="0 0 690 265" role="img" aria-labelledby={`${id} ${id}-desc`}>
      <desc id={`${id}-desc`}>Trend by reporting period. Exact values are available in the data table below.</desc>
      <defs><linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={colors[0]} stopOpacity=".18" /><stop offset="100%" stopColor={colors[0]} stopOpacity="0" /></linearGradient></defs>
      {Array.from({ length: 5 }, (_, i) => low + (high - low) * i / 4).map((v, i) => <g key={i}><line x1="64" x2="665" y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeDasharray="3 5" /><text x="55" y={y(v) + 4} textAnchor="end">{tick(v)}</text></g>)}
      {rows.map((row, i) => (i % Math.max(1, Math.ceil(rows.length / 12)) === 0 || i === rows.length - 1) && <text key={row.period} x={x(i)} y="247" textAnchor="middle">{row.period.length === 4 ? row.period : new Date(`${row.period}-01T12:00:00`).toLocaleDateString('en', { month: 'short', year: rows.length > 12 ? '2-digit' : undefined })}</text>)}
      {lines.map((line, lineIndex) => <g key={line.key}>
        {!bars && lineIndex === 0 && rows.length > 1 && rows.every(row => hasValue(row[line.key])) && <polygon fill={`url(#${id}-fill)`} points={`${x(0)},${y(0)} ${rows.map((row, i) => `${x(i)},${y(Number(row[line.key]))}`).join(' ')} ${x(rows.length - 1)},${y(0)}`} />}
        {!bars && <path fill="none" stroke={colors[lineIndex]} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={line.dashed ? '6 4' : undefined} d={rows.map((row, i) => hasValue(row[line.key]) ? `${i > 0 && hasValue(rows[i - 1][line.key]) ? 'L' : 'M'}${x(i)},${y(Number(row[line.key]))}` : '').join(' ')} />}
        {rows.map((row, i) => {
          if (!hasValue(row[line.key])) return null;
          const value = Number(row[line.key]); const width = Math.max(.5, Math.min(24, 460 / Math.max(1, rows.length) / lines.length));
          const tip = `${row.period} · ${line.label}: ${format(value)}`;
          if (!bars) return <circle key={row.period} cx={x(i)} cy={y(value)} r={rows.length > 50 ? 1.5 : 3} fill={colors[lineIndex]} stroke="white" strokeWidth="1"><title>{tip}</title></circle>;
          const barX = x(i) + (lineIndex - lines.length / 2) * width;
          const barY = Math.min(y(0), y(value));
          const barHeight = Math.max(1, Math.abs(y(value) - y(0)));
          const labelY = value >= 0 ? Math.min(232, Math.max(12, barY - 7 + lineIndex % 2 * 10)) : Math.min(232, barY + barHeight + 12 + lineIndex % 2 * 10);
          return <g key={row.period}><rect x={barX} y={barY} width={width * .8} height={barHeight} rx="2.5" fill={colors[lineIndex]}><title>{tip}</title></rect>{rows.length <= 24 && <text aria-hidden="true" className="bi-trend-bar-label" x={barX + width * .4} y={labelY} textAnchor="middle" fill={colors[lineIndex]}>{tick(value)}</text>}</g>;
        })}
        {(() => {
          if (bars || latestValues) return null;
          const point = finalPoint(line);
          if (!point) return null;
          const width = Math.max(.5, Math.min(24, 460 / Math.max(1, rows.length) / lines.length));
          const labelX = bars ? x(point.index) + (lineIndex - lines.length / 2) * width + width * .4 : x(point.index);
          const offsets = [-10, 14, -24, 28];
          return <text aria-hidden="true" className="bi-trend-end-label" x={labelX} y={y(point.value) + (offsets[lineIndex] ?? -10)} textAnchor="middle" fill={colors[lineIndex]}>{line.endLabel ? `${line.endLabel} ${tick(point.value)}` : tick(point.value)}</text>;
        })()}
      </g>)}
    </svg>
    {showData ? <div className="bi-chart-data"><h4>Period values</h4>{chartTable}</div> : <details className="bi-chart-data"><summary>View chart data</summary>{chartTable}</details>}
  </article>;
}

export function Breakdown({ title, caption, values, donut = false }) {
  const id = useId(); const entries = Object.entries(values).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0); const max = Math.max(1, ...entries.map(([, v]) => v));
  let offset = 0;
  return <article className="bi-panel" aria-labelledby={id}><header><div><h3 id={id}>{title}</h3><p>{caption}</p></div></header>
    {total === 0 ? <p className="bi-empty">No matching requests in this period.</p> : <div className={donut ? 'bi-donut-layout' : ''}>
      {donut && <svg className="bi-donut" viewBox="0 0 180 180" role="img" aria-label={`${title}: ${number(total)} requests`}>
        {entries.map(([name, value], i) => { const length = value / total * 100; const start = offset; offset += length; return <circle key={name} cx="90" cy="90" r="64" fill="none" stroke={colors[i % colors.length]} strokeWidth="24" pathLength="100" strokeDasharray={`${length} ${100 - length}`} strokeDashoffset={-start} transform="rotate(-90 90 90)"><title>{label(name)}: {value}</title></circle>; })}
        <text x="90" y="88" textAnchor="middle" className="bi-donut-number">{number(total)}</text><text x="90" y="109" textAnchor="middle">REQUESTS</text>
      </svg>}
      <ul className="bi-breakdown">{entries.map(([name, value], i) => <li key={name}><div><span><i style={{ background: colors[i % colors.length] }} />{label(name)}</span><strong>{number(value)}</strong></div>{!donut && <div className="bi-bar-track"><span style={{ width: `${value / max * 100}%`, background: colors[i % colors.length] }} /></div>}</li>)}</ul>
    </div>}
  </article>;
}
