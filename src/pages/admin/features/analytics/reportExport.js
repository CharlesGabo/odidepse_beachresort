export const money = value => value === null ? '—' : new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(Number(value));
export const number = value => value === null ? '—' : new Intl.NumberFormat('en-PH', { maximumFractionDigits: 1 }).format(Number(value));
export const label = value => value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
export const monthLabel = period => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return period;
  const [year, month] = period.split('-').map(Number);
  return new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)));
};
export const columns = [
  ['period', 'Month'], ['agreed', 'Agreed value', true], ['estimated', 'Estimated value', true], ['booked', 'Booked value', true],
  ['paid', 'Payments', true], ['refunded', 'Refunds', true], ['net', 'Net cash', true], ['outstanding', 'Outstanding', true],
  ['pipeline', 'Pending pipeline', true], ['requests', 'Requests'], ['stays', 'Stays'], ['guests', 'Guests'], ['unpriced', 'Unpriced stays'],
];
export function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s]*[=+@-]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function reportCsv(report) {
  const context = Object.entries(report.filters).map(([key, value]) => [label(key), value]);
  const rows = [['Odidepse financial report (PHP)'], ['Generated', report.generated_at], ...context,
    ['Booked values use check-in dates; cash uses transaction dates. Estimates are room-only.'], [],
    columns.map(([, title]) => title), ...report.monthly.map(row => columns.map(([key]) => key === 'period' ? monthLabel(row[key]) : row[key])),
    columns.map(([key]) => key === 'period' ? 'Total' : report.metrics[key])];
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}
export function downloadReport(report) {
  const url = URL.createObjectURL(new Blob([reportCsv(report)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url;
  link.download = `odidepse-financial-${report.filters.from}-${report.filters.to}.csv`;
  link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
