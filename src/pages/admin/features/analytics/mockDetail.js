const cents = value => Math.round(Number(value || 0) * 100);
const decimal = value => (value / 100).toFixed(2);

function allocate(total, capacities) {
  if (!capacities.length) return [];
  const sum = capacities.reduce((value, capacity) => value + capacity, 0);
  if (!sum) return capacities.map(() => 0);
  const result = capacities.map(capacity => Math.floor(total * capacity / sum));
  let remainder = total - result.reduce((value, amount) => value + amount, 0);
  for (let index = 0; remainder; index = (index + 1) % result.length) {
    if (result[index] < capacities[index]) { result[index]++; remainder--; }
  }
  return result;
}

function split(total, count) {
  if (!count) return [];
  const quotient = Math.floor(total / count);
  return Array.from({ length: count }, (_, index) => quotient + (index < total % count ? 1 : 0));
}

/** Browser-only sample rows that reconcile with the generated monthly KPI values. */
export function mockDetailRows(report, metric) {
  const rows = [];
  for (const month of report.monthly) {
    const breakdown = report.mockBreakdown[month.period];
    const statuses = Object.entries(breakdown.statuses).flatMap(([status, count]) => Array(count).fill(status));
    const stays = Object.entries(breakdown.stays).flatMap(([stay, count]) => Array(count).fill(stay));
    const date = report.filters.from && report.filters.from > `${month.period}-01` ? report.filters.from : `${month.period}-01`;
    const bookings = statuses.map((status, index) => ({
      booking_id: null, reference: `MOCK-${month.period.replace('-', '')}-${String(index + 1).padStart(3, '0')}`,
      guest: `Sample guest ${index + 1}`, stay: 'Not selected', status, date,
    }));
    const accepted = bookings.filter(booking => ['confirmed', 'checked_in', 'completed'].includes(booking.status)).slice(0, month.stays);
    const guestCounts = split(month.guests, accepted.length);
    const estimated = split(cents(month.estimated), month.estimated_bookings);
    const agreed = split(cents(month.agreed), accepted.length - estimated.length);
    const prices = [...estimated, ...agreed];
    accepted.forEach((booking, index) => {
      booking.stay = stays[index] || 'Sample stay';
      booking.guests = guestCounts[index];
      booking.price = prices[index];
      booking.basis = index < estimated.length ? 'Room estimate' : 'Agreed price';
    });
    const pending = bookings.filter(booking => booking.status === 'pending');
    const pipeline = split(cents(month.pipeline), pending.length);
    pending.forEach((booking, index) => { booking.pipeline = pipeline[index]; });
    const paid = allocate(cents(month.paid), prices);
    const refunded = allocate(cents(month.refunded), paid);
    const add = (booking, contribution, basis) => rows.push({ ...booking, contribution, basis });
    if (metric === 'requests' || metric === 'cancelled') {
      bookings.forEach(booking => add(booking, metric === 'requests' ? 1 : Number(booking.status === 'cancelled'), metric === 'requests' ? 'Request created' : booking.status === 'cancelled' ? 'Cancelled' : 'Not cancelled'));
    } else if (metric === 'booked' || metric === 'average') {
      accepted.forEach(booking => add(booking, decimal(booking.price), booking.basis));
    } else if (metric === 'guests') {
      accepted.forEach(booking => add(booking, booking.guests, 'Guests in party'));
    } else if (metric === 'pipeline') {
      pending.forEach(booking => add(booking, decimal(booking.pipeline), 'Pending estimate'));
    } else if (metric === 'outstanding') {
      accepted.forEach((booking, index) => {
        const due = booking.price - paid[index] + refunded[index];
        if (due > 0) add(booking, decimal(due), booking.basis);
      });
    } else if (metric === 'net') {
      accepted.forEach((booking, index) => {
        if (paid[index]) add(booking, decimal(paid[index]), 'Payment');
        if (refunded[index]) add(booking, decimal(-refunded[index]), 'Refund');
      });
    }
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date) || b.reference.localeCompare(a.reference));
}

export function mockDetailPage(report, metric, page) {
  const rows = mockDetailRows(report, metric);
  const field = metric === 'average' ? 'average_value' : metric === 'cancelled' ? 'cancellation_rate' : metric;
  return { metric, value: report.metrics[field], total_rows: rows.length, page, page_size: 25, rows: rows.slice((page - 1) * 25, page * 25) };
}
