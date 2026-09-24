export function overlaps(a, b) {
  const time = (booking, label, fallback) => booking.message?.match(new RegExp(`Preferred ${label}:\\s*(\\d{2}:\\d{2})`, 'i'))?.[1] || fallback;
  return `${a.check_in} ${time(a, 'arrival', '14:00')}` < `${b.check_out} ${time(b, 'departure', '12:00')}`
    && `${b.check_in} ${time(b, 'arrival', '14:00')}` < `${a.check_out} ${time(a, 'departure', '12:00')}`;
}
const oldestFirst = (a, b) => (a.created_at || '').localeCompare(b.created_at || '') || Number(a.id) - Number(b.id);
export function roomPlanning(units, overflow = []) {
  const pending = [...units.flatMap(unit => unit.bookings), ...overflow].filter(b => b.status === 'pending').sort(oldestFirst);
  const priorities = new Map();
  const unseen = new Set(pending);
  for (const first of pending) {
    if (!unseen.delete(first)) continue;
    const group = [first];
    for (let i = 0; i < group.length; i++) for (const candidate of unseen) {
      if (overlaps(group[i], candidate)) { unseen.delete(candidate); group.push(candidate); }
    }
    if (group.length > 1) group.sort(oldestFirst).forEach((booking, index) => priorities.set(String(booking.id), index + 1));
  }
  const reserved = new Map(units.map(unit => [unit.key, []]));
  const suggestions = [];
  for (const booking of pending) {
    const current = units.find(unit => unit.bookings.some(b => String(b.id) === String(booking.id)));
    if (current && !current.bookings.some(other => other.id !== booking.id && overlaps(other, booking))) continue;
    const target = units.find(unit => unit !== current && ![...unit.bookings, ...reserved.get(unit.key)].some(other => overlaps(other, booking)));
    if (target) { suggestions.push({ booking, unit: target }); reserved.get(target.key).push(booking); }
  }
  return { priorities, suggestions };
}
