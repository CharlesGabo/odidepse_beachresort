import assert from 'node:assert/strict';
import { generateMockReport } from '../../src/pages/admin/features/analytics/mockReport.js';

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

const filtered = generateMockReport({ ...live, filters: { ...live.filters, group: 'year', status: 'pending', source: 'website', stay_id: 2, activity_id: 3 } }, 5);
assert.equal(filtered.series.length, 1);
assert.deepEqual(filtered.accommodations, []);
assert.deepEqual(filtered.activities.map(activity => activity.name), ['Actual Activity']);
assert.deepEqual(Object.keys(filtered.status), ['pending']);
assert.deepEqual(Object.keys(filtered.sources), ['website']);
assert.equal(filtered.metrics.booked, 0);
assert.ok(filtered.metrics.pipeline > 0);

const emptyCatalog = generateMockReport({ ...live, options: { stays: [], activities: [] } }, 5);
assert.deepEqual(emptyCatalog.accommodations, []);
assert.deepEqual(emptyCatalog.activities, []);
assert.equal(emptyCatalog.metrics.booked, 0);
console.log('Analytics mock generation uses live catalog names and consistent report totals.');
