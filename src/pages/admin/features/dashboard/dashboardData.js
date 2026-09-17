function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && dateKey(date) === value;
}

export function dashboardData(bookings, now = new Date()) {
  const today = dateKey(now);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 12);
  const active = bookings.filter(item => ['pending', 'confirmed', 'checked_in'].includes(item.status));
  const sort = (items, field, timeLabel) => items.sort((a, b) => {
    const dateOrder = (a[field] || '').localeCompare(b[field] || '');
    const time = item => typeof item.message === 'string'
      ? item.message.match(new RegExp(`Preferred ${timeLabel}:\\s*(\\d{1,2}:\\d{2})`, 'i'))?.[1]?.padStart(5, '0') || '99:99' : '99:99';
    return dateOrder || time(a).localeCompare(time(b)) || String(a.id).localeCompare(String(b.id));
  });
  const arrivals = sort(bookings.filter(item => item.status === 'confirmed' && validDate(item.check_in) && item.check_in === today), 'check_in', 'arrival');
  const checkedIn = sort(bookings.filter(item => item.status === 'checked_in'), 'check_in', 'arrival');
  const departures = sort(active.filter(item => validDate(item.check_out) && item.check_out === today), 'check_out', 'departure');
  const attention = sort(bookings.filter(item => item.status === 'pending'), 'check_in', 'arrival');
  return {
    today, arrivals, checkedIn, departures, attention,
    upcoming: sort(bookings.filter(item => item.status === 'confirmed' && validDate(item.check_in) && item.check_in > today && item.check_in <= dateKey(end)), 'check_in', 'arrival'),
    pending: bookings.filter(item => item.status === 'pending').length,
    guests: bookings.filter(item => item.status === 'checked_in').reduce((total, item) => total + (Number.isFinite(Number(item.guests)) ? Math.max(0, Number(item.guests)) : 0), 0),
  };
}
