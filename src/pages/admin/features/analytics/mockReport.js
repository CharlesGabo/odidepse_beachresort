const amount = value => Math.round(value * 100) / 100;

function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = Math.imul(state ^ state >>> 15, state | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function distribute(total, names, random) {
  if (!names.length) return {};
  const weights = names.map(() => .5 + random());
  const sum = weights.reduce((value, weight) => value + weight, 0);
  let remaining = total;
  return Object.fromEntries(names.map((name, index) => {
    const count = index === names.length - 1 ? remaining : Math.min(remaining, Math.round(total * weights[index] / sum));
    remaining -= count;
    return [name, count];
  }));
}

/** Illustrative, browser-only report. Catalog labels come only from the live API response. */
export function generateMockReport(liveReport, seed = 1) {
  const random = randomGenerator(seed);
  const { filters, options } = liveReport;
  const stayOptions = options.stays.filter(stay => !filters.stay_id || stay.id === filters.stay_id);
  const activityOptions = options.activities.filter(activity => !filters.activity_id || activity.id === filters.activity_id);
  const statusNames = filters.status === 'all' ? ['pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'] : [filters.status];
  const sourceNames = filters.source === 'all' ? ['website', 'website_chat', 'facebook', 'manual'] : [filters.source];
  const status = Object.fromEntries(statusNames.map(name => [name, 0]));
  const sources = Object.fromEntries(sourceNames.map(name => [name, 0]));
  const accommodationTotals = Object.fromEntries(stayOptions.map(stay => [stay.name, { name: stay.name, stays: 0, guests: 0, booked: 0, nights: 0 }]));

  const monthly = liveReport.monthly.map(({ period }, index) => {
    const seasonal = 1 + .28 * Math.sin(index * Math.PI / 6);
    const requests = Math.max(2, Math.round((8 + random() * 14) * seasonal));
    const statusSplit = distribute(requests, statusNames, random);
    const sourceSplit = distribute(requests, sourceNames, random);
    for (const name of statusNames) status[name] += statusSplit[name];
    for (const name of sourceNames) sources[name] += sourceSplit[name];

    const accepted = ['confirmed', 'checked_in', 'completed'].reduce((sum, name) => sum + (statusSplit[name] || 0), 0);
    const stays = stayOptions.length ? accepted : 0;
    const guests = stays ? stays * (2 + Math.round(random() * 2)) : 0;
    const estimatedBookings = stays ? Math.min(stays, Math.round(stays * (.15 + random() * .2))) : 0;
    const estimated = amount(estimatedBookings * (6800 + Math.round(random() * 5000)));
    const agreed = amount((stays - estimatedBookings) * (7800 + Math.round(random() * 7200)));
    const booked = amount(agreed + estimated);
    const paid = amount(booked * (.48 + random() * .36));
    const refunded = amount(paid * random() * .07);
    const net = amount(paid - refunded);
    const pipeline = amount((statusSplit.pending || 0) * (6500 + Math.round(random() * 4500)));
    const staySplit = distribute(stays, stayOptions.map(stay => stay.name), random);
    let assignedBooked = 0; let assignedGuests = 0;
    stayOptions.forEach((stay, stayIndex) => {
      const count = staySplit[stay.name];
      const bookedShare = stayIndex === stayOptions.length - 1 ? amount(booked - assignedBooked) : amount(booked * count / Math.max(1, stays));
      const guestShare = stayIndex === stayOptions.length - 1 ? guests - assignedGuests : Math.round(guests * count / Math.max(1, stays));
      const total = accommodationTotals[stay.name];
      total.stays += count; total.guests += guestShare; total.booked = amount(total.booked + bookedShare);
      total.nights += count * (1 + Math.round(random() * 2));
      assignedBooked = amount(assignedBooked + bookedShare); assignedGuests += guestShare;
    });
    return { period, requests, cancelled_requests: statusSplit.cancelled || 0, stays, guests,
      agreed, estimated, booked, pipeline, paid, refunded, net, outstanding: amount(Math.max(0, booked - net)),
      unpriced: 0, estimated_bookings: estimatedBookings, priced_bookings: stays };
  });

  const fields = Object.keys(monthly[0] || {}).filter(key => key !== 'period');
  const metrics = Object.fromEntries(fields.map(key => [key, amount(monthly.reduce((sum, row) => sum + row[key], 0))]));
  metrics.average_value = metrics.priced_bookings ? amount(metrics.booked / metrics.priced_bookings) : null;
  metrics.cancellation_rate = metrics.requests ? amount(metrics.cancelled_requests / metrics.requests * 100) : null;

  const series = Object.values(monthly.reduce((groups, row) => {
    const period = filters.group === 'year' ? row.period.slice(0, 4) : row.period;
    if (!groups[period]) groups[period] = Object.fromEntries([['period', period], ...fields.map(key => [key, 0])]);
    for (const key of fields) groups[period][key] = amount(groups[period][key] + row[key]);
    return groups;
  }, {}));
  const activities = activityOptions.map(activity => {
    const requests = Math.min(metrics.requests, Math.round(metrics.requests * (.12 + random() * .27)));
    return { id: activity.id, name: activity.name, requests, guests: requests * (2 + Math.round(random() * 2)) };
  }).sort((a, b) => b.requests - a.requests);
  const accommodations = Object.values(accommodationTotals).filter(stay => stay.stays).map(stay => ({
    name: stay.name, stays: stay.stays, guests: stay.guests, booked: stay.booked,
    average_nights: amount(stay.nights / stay.stays),
  }));

  return { ...liveReport, generated_at: new Date().toISOString(), metrics, series, monthly, status, sources,
    activities, accommodations, unmapped: 0, mock: true };
}
