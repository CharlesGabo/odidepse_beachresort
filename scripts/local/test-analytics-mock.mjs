import assert from 'node:assert/strict';
import { generateMockReport } from '../../src/pages/admin/features/analytics/mockReport.js';
import { mockDetailPage, mockDetailRows } from '../../src/pages/admin/features/analytics/mockDetail.js';

const live = {
  filters: { group: 'month', status: 'all', source: 'all', stay_id: 0, activity_id: 0 },
  options: {
    stays: [{ id: 1, name: 'Actual Stay One' }, { id: 2, name: 'Actual Stay Two' }],
    activities: [{ id: 3, name: 'Actual Activity' }],
  },
  monthly: [{ period: '2026-01' }, { period: '2026-02' }, { period: '2026-03' }],
};
const mock = generateMockReport(live, 5);
assert.equal(mock.mock, true);
assert.deepEqual(mock.accommodations.map(stay => stay.name).sort(), ['Actual Stay One', 'Actual Stay Two']);
assert.deepEqual(mock.activities.map(activity => activity.name), ['Actual Activity']);
assert.equal(mock.metrics.requests, mock.monthly.reduce((sum, row) => sum + row.requests, 0));
assert.equal(mock.metrics.booked, mock.monthly.reduce((sum, row) => sum + row.booked, 0));
assert.equal(mock.metrics.booked, mock.accommodations.reduce((sum, stay) => sum + stay.booked, 0));
assert.equal(mock.metrics.requests, Object.values(mock.status).reduce((sum, value) => sum + value, 0));
assert.equal(mock.metrics.requests, Object.values(mock.sources).reduce((sum, value) => sum + value, 0));
assert.equal(mock.series.length, 3);
assert.notDeepEqual(generateMockReport(live, 6).monthly, mock.monthly);
for (const metric of ['booked', 'net', 'outstanding', 'pipeline']) {
  const sum = mockDetailRows(mock, metric).reduce((value, row) => value + Math.round(Number(row.contribution) * 100), 0) / 100;
  assert.equal(sum, mock.metrics[metric], `${metric} sample bookings reconcile`);
}
for (const metric of ['requests', 'guests']) {
  const sum = mockDetailRows(mock, metric).reduce((value, row) => value + row.contribution, 0);
  assert.equal(sum, mock.metrics[metric], `${metric} sample bookings reconcile`);
}
assert.equal(mockDetailRows(mock, 'average').length, mock.metrics.priced_bookings);
assert.equal(mockDetailRows(mock, 'cancelled').length, mock.metrics.requests);
assert.equal(mockDetailRows(mock, 'cancelled').reduce((value, row) => value + row.contribution, 0), mock.metrics.cancelled_requests);
assert.equal(mockDetailPage(mock, 'booked', 1).rows.length, Math.min(25, mock.metrics.priced_bookings));
assert.ok(mockDetailRows(mock, 'booked').every(row => row.reference.startsWith('MOCK-') && row.booking_id === null));

const filtered = generateMockReport({ ...live, filters: { ...live.filters, group: 'year', status: 'pending', source: 'website', stay_id: 2, activity_id: 3 } }, 5);
assert.equal(filtered.series.length, 1);
assert.deepEqual(filtered.accommodations, []);
assert.deepEqual(filtered.activities.map(activity => activity.name), ['Actual Activity']);
assert.deepEqual(Object.keys(filtered.status), ['pending']);
assert.deepEqual(Object.keys(filtered.sources), ['website']);
assert.equal(filtered.metrics.booked, 0);
assert.ok(filtered.metrics.pipeline > 0);
assert.equal(mockDetailRows(filtered, 'pipeline').reduce((value, row) => value + Number(row.contribution), 0), filtered.metrics.pipeline);

const emptyCatalog = generateMockReport({ ...live, options: { stays: [], activities: [] } }, 5);
assert.deepEqual(emptyCatalog.accommodations, []);
assert.deepEqual(emptyCatalog.activities, []);
assert.equal(emptyCatalog.metrics.booked, 0);
assert.deepEqual(mockDetailRows(emptyCatalog, 'booked'), []);
console.log('Analytics mock generation uses live catalog names and consistent report totals.');
