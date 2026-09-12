import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ResortManager from './ResortManager.jsx';
import { dashboardData } from './dashboardData.js';

const statusLabels = {
  pending: 'New request',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const statusActions = {
  pending: [
    { status: 'confirmed', label: 'Confirm', tone: 'primary' },
    { status: 'cancelled', label: 'Cancel', tone: 'danger' },
  ],
  confirmed: [{ status: 'checked_in', label: 'Check in', tone: 'primary' }],
  checked_in: [{ status: 'completed', label: 'Check out', tone: 'checked-in' }],
};

function BookingStatusActions({ booking, updateStatus }) {
  const [updating, setUpdating] = useState(false);
  const actions = statusActions[booking.status] || [];
  if (actions.length === 0) return null;

  const applyStatus = async status => {
    setUpdating(true);
    try {
      await updateStatus(booking.id, status);
    } finally {
      setUpdating(false);
    }
  };

  return <div className="booking-status-actions" aria-label={`Actions for ${booking.guest_name}`}>
    {actions.map(action => <button type="button" className={`booking-status-action booking-status-action--${action.tone}`} key={action.status}
      disabled={updating} onClick={() => applyStatus(action.status)}>{updating ? 'Updating…' : action.label}</button>)}
  </div>;
}

function formatBookingDate(value, compact = false) {
  if (!value) return 'Not set';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-PH', compact
    ? { month: 'short', day: 'numeric' }
    : { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }
  ).format(date);
}

function getBookingNights(booking) {
  const checkIn = new Date(`${booking.check_in}T12:00:00`);
  const checkOut = new Date(`${booking.check_out}T12:00:00`);
  const nights = Math.round((checkOut - checkIn) / 86400000);
  return Number.isFinite(nights) && nights > 0 ? nights : null;
}

function formatBookingTime(value) {
  if (!value) return null;
  const [hour, minute] = value.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  return new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' })
    .format(new Date(2000, 0, 1, hour, minute));
}

function parseCalendarDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function calendarDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addCalendarDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function calendarDayDifference(start, end) {
  return Math.round((end - start) / 86400000);
}

function calendarMonthWeeks(monthDate) {
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 12);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const calendarStart = addCalendarDays(firstOfMonth, -mondayOffset);
  const lastOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 12);
  const totalDays = calendarDayDifference(calendarStart, lastOfMonth) + 1;
  const weekCount = Math.max(5, Math.ceil(totalDays / 7));

  return Array.from({ length: weekCount }, (_, weekIndex) => (
    Array.from({ length: 7 }, (__, dayIndex) => addCalendarDays(calendarStart, weekIndex * 7 + dayIndex))
  ));
}

function layoutCalendarWeek(weekDays, bookings, maximumLanes = 3) {
  const weekStart = weekDays[0];
  const weekEnd = weekDays[weekDays.length - 1];
  const segments = bookings.flatMap(booking => {
    const checkIn = parseCalendarDate(booking.check_in);
    const checkOut = parseCalendarDate(booking.check_out);
    if (!checkIn || !checkOut || checkOut < checkIn || checkOut < weekStart || checkIn > weekEnd) return [];

    return [{
      booking,
      start: Math.max(0, calendarDayDifference(weekStart, checkIn)),
      end: Math.min(weekDays.length - 1, calendarDayDifference(weekStart, checkOut)),
      startsHere: checkIn >= weekStart,
      endsHere: checkOut <= weekEnd,
    }];
  }).sort((a, b) => a.start - b.start || b.end - a.end);

  const laneEnds = Array(maximumLanes).fill(-1);
  const visible = [];
  const hidden = [];

  segments.forEach(segment => {
    const lane = laneEnds.findIndex(end => end < segment.start);
    if (lane === -1) {
      hidden.push(segment);
      return;
    }
    laneEnds[lane] = segment.end;
    visible.push({ ...segment, lane });
  });

  const overflow = weekDays.map((date, dayIndex) => ({
    date,
    bookings: hidden
      .filter(segment => segment.start <= dayIndex && segment.end >= dayIndex)
      .map(segment => segment.booking),
  })).filter(item => item.bookings.length > 0);

  return { visible, overflow };
}

function allocateBookingsToUnits(bookings, unitCount, accommodationName) {
  const units = Array.from({ length: unitCount }, (_, index) => ({
    key: `${accommodationName.toLowerCase()}-unit-${index + 1}`,
    name: unitCount === 1 ? accommodationName : `${accommodationName.replace(/s?$/i, '')} #${index + 1}`,
    bookings: [],
    lastCheckout: null,
  }));
  const overflowBookings = [];
  const cancelledBookings = bookings.filter(booking => booking.status === 'cancelled');

  bookings.filter(booking => booking.status !== 'cancelled').sort((a, b) => a.check_in.localeCompare(b.check_in) || a.check_out.localeCompare(b.check_out) || String(a.id).localeCompare(String(b.id))).forEach(booking => {
    const unit = units.find(candidate => !candidate.lastCheckout || candidate.lastCheckout < booking.check_in);
    if (!unit) {
      overflowBookings.push(booking);
      return;
    }
    unit.bookings.push({ ...booking, calendar_unit: unit.name });
    unit.lastCheckout = booking.check_out;
  });

  return { units: units.map(({ lastCheckout, ...unit }) => unit), overflowBookings, cancelledBookings };
}

function buildOccupancySegments(days, bookings) {
  const statusOrder = ['checked_in', 'confirmed', 'pending', 'completed', 'cancelled'];
  const segments = [];

  days.forEach((date, dayIndex) => {
    const dateValue = calendarDateKey(date);
    const activeBookings = bookings.filter(booking => booking.check_in <= dateValue && booking.check_out >= dateValue);
    if (activeBookings.length === 0) return;
    const status = statusOrder.find(value => activeBookings.some(booking => booking.status === value)) || activeBookings[0].status;
    const bookingKey = activeBookings.map(booking => String(booking.id)).sort().join('|');
    const previous = segments.at(-1);

    if (previous && previous.end === dayIndex - 1 && previous.status === status && previous.bookingKey === bookingKey) {
      previous.end = dayIndex;
      return;
    }
    segments.push({ start: dayIndex, end: dayIndex, status, bookings: activeBookings, bookingKey });
  });

  return segments;
}

function getBookingNotes(message = '') {
  const text = typeof message === 'string' ? message : '';
  const arrival = text.match(/Preferred arrival:\s*(\d{1,2}:\d{2})/i)?.[1] || null;
  const departure = text.match(/Preferred departure:\s*(\d{1,2}:\d{2})/i)?.[1] || null;
  const activities = text.match(/Requested rental activities:\s*([^\n]+)/i)?.[1]?.trim() || null;
  const note = text
    .replace(/Preferred arrival:\s*\d{1,2}:\d{2}/gi, '')
    .replace(/Preferred departure:\s*\d{1,2}:\d{2}/gi, '')
    .replace(/Requested rental activities:\s*[^\n]+/gi, '')
    .replace(/^[\s|·,-]+|[\s|·,-]+$/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { arrival, departure, activities, note };
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'overview' },
  { id: 'bookings', label: 'Bookings', icon: 'calendar' },
  { id: 'stays', label: 'Stays', icon: 'home' },
  { id: 'guests', label: 'Guests', icon: 'users' },
  { id: 'services', label: 'Services', icon: 'home' },
  { id: 'content', label: 'Website Content', icon: 'home' },
];

function AdminIcon({ name }) {
  const paths = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    home: <><path d="m3 11 9-8 9 8v10H3Z" /><path d="M9 21v-7h6v7" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3M21 19V5a2 2 0 0 0-2-2h-6" /></>,
    search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    phone: <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92Z" /></>,
    landscape: <><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" /><rect x="7" y="8" width="10" height="8" rx="1" /></>,
  };

  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function AdminLogin({ onLogin }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/login.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Sign in failed.');
      onLogin(data.user, data.csrf_token);
    } catch (exception) {
      setError(exception.message);
    } finally {
      setLoading(false);
    }
  };

  return <main className="admin-login">
    <div className="admin-login__art"><div><span className="admin-wordmark">ODIDEPSE</span><p>Reservations, quietly organized.</p></div></div>
    <section className="admin-login__panel">
      <div className="admin-login__form">
        <span className="admin-kicker">Private staff area</span>
        <h1>Welcome back.</h1>
        <p>Sign in to manage guest requests and upcoming stays.</p>
        <form onSubmit={submit}>
          <label>Email address<input type="email" name="email" autoComplete="username" required /></label>
          <label>Password<input type="password" name="password" autoComplete="current-password" required /></label>
          {error && <p className="admin-error" role="alert">{error}</p>}
          <button disabled={loading}>{loading ? 'Signing in…' : 'Sign in securely'}</button>
        </form>
        <a href="./">← Return to resort website</a>
      </div>
    </section>
  </main>;
}

function StatCards({ stats }) {
  return <section className="admin-stats" aria-label="Reservation summary">
    <article><span>New requests</span><strong>{stats.pending.toString().padStart(2, '0')}</strong><small>Awaiting your reply</small></article>
    <article><span>Arriving today</span><strong>{stats.arrivals.length.toString().padStart(2, '0')}</strong><small>Confirmed check-ins</small></article>
    <article><span>Guests checked in</span><strong>{stats.guests.toString().padStart(2, '0')}</strong><small>Currently staying</small></article>
  </section>;
}

function BookingCalendar({ bookings, accommodations, onViewBooking, highlightedBookingId }) {
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  }, []);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1, 12));
  const [dialogContent, setDialogContent] = useState(null);
  const [landscapeOpen, setLandscapeOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());
  const dialogRef = useRef(null);
  const landscapeDialogRef = useRef(null);
  const handledCalendarFocusRef = useRef(null);
  const timelineDragRef = useRef(null);
  const days = useMemo(() => Array.from({ length: new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate() }, (_, index) => addCalendarDays(visibleMonth, index)), [visibleMonth]);
  const resources = useMemo(() => {
    const accommodationOrder = [
      ['5-guest room', 1],
      ['8-guest room', 3],
      ['9-guest room', 1],
      ['10-guest room', 5],
      ['Entire building exclusive', 1],
      ['Large-group accommodation', 6],
    ];
    const catalogByName = new Map(accommodations.map(stay => [stay.name.toLowerCase(), stay]));

    return accommodationOrder.map(([name, fallbackCount]) => {
      const key = name.toLowerCase();
      const catalogStay = catalogByName.get(key);
      const configuredCount = Number(catalogStay?.room_count);
      const unitCount = catalogStay?.style === 'exclusive'
        ? 1
        : Number.isInteger(configuredCount) && configuredCount > 0 ? configuredCount : fallbackCount;
      const matchingBookings = bookings.filter(booking => {
        if (catalogStay && Number(booking.stay_id) === Number(catalogStay.id)) return true;
        return (booking.stay_type || '').toLowerCase() === key;
      });
      const allocation = allocateBookingsToUnits(matchingBookings, unitCount, name);
      return { key, name, unitCount, bookings: matchingBookings, ...allocation };
    });
  }, [bookings, accommodations]);
  const monthLabel = new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(visibleMonth);

  useEffect(() => {
    if (!highlightedBookingId) {
      handledCalendarFocusRef.current = null;
      return;
    }
    const focusId = String(highlightedBookingId);
    if (handledCalendarFocusRef.current === focusId) return;
    const booking = bookings.find(item => String(item.id) === String(highlightedBookingId));
    if (!booking) {
      handledCalendarFocusRef.current = focusId;
      return;
    }

    const bookingMonth = new Date(`${booking.check_in}T12:00:00`);
    if (visibleMonth.getFullYear() !== bookingMonth.getFullYear() || visibleMonth.getMonth() !== bookingMonth.getMonth()) {
      setVisibleMonth(new Date(bookingMonth.getFullYear(), bookingMonth.getMonth(), 1, 12));
      return;
    }

    const resource = resources.find(item => item.bookings.some(candidate => String(candidate.id) === String(booking.id)));
    if (resource && !expandedGroups.has(resource.key)) {
      setExpandedGroups(current => new Set(current).add(resource.key));
      return;
    }

    handledCalendarFocusRef.current = focusId;
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const selector = `[data-calendar-booking-id="${String(booking.id)}"]`;
      const target = document.querySelector(`.booking-calendar .reservation-timeline__unit ${selector}`)
        || document.querySelector(`.booking-calendar ${selector}`)
        || document.querySelector(selector);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }));
  }, [highlightedBookingId, bookings, resources, visibleMonth, expandedGroups]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialogContent && dialog && !dialog.open) dialog.showModal();
  }, [dialogContent]);

  const closeDialog = () => {
    if (dialogRef.current?.open) dialogRef.current.close();
    else setDialogContent(null);
  };

  const closeLandscape = () => {
    if (landscapeDialogRef.current?.open) landscapeDialogRef.current.close();
    setLandscapeOpen(false);
  };

  const openLandscape = () => {
    setLandscapeOpen(true);
    landscapeDialogRef.current?.showModal();
  };

  const moveMonth = amount => setVisibleMonth(current => new Date(current.getFullYear(), current.getMonth() + amount, 1, 12));
  const selectBooking = booking => {
    setDialogContent({ type: 'booking', booking });
  };
  const showOverflow = (date, hiddenBookings) => {
    setDialogContent({ type: 'more', date, bookings: hiddenBookings });
  };

  const startTimelineDrag = event => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || event.target.closest('button, a, input, select, textarea')) return;
    const scroller = event.currentTarget;
    timelineDragRef.current = { pointerId: event.pointerId, startX: event.clientX, scrollLeft: scroller.scrollLeft };
    scroller.setPointerCapture(event.pointerId);
    scroller.classList.add('is-dragging');
  };

  const moveTimelineDrag = event => {
    const drag = timelineDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.currentTarget.scrollLeft = drag.scrollLeft - (event.clientX - drag.startX);
  };

  const stopTimelineDrag = event => {
    const drag = timelineDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    timelineDragRef.current = null;
    event.currentTarget.classList.remove('is-dragging');
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const renderCalendarGrid = (labelSuffix = '', isLandscape = false) => {
    const displayedDays = days;
    const renderedRowCount = resources.reduce((count, resource) => count + 1 + (expandedGroups.has(resource.key) ? resource.units.length : 0), 0);
    const monthStart = calendarDateKey(days[0]);
    const monthEnd = calendarDateKey(days.at(-1));
    const dateCells = () => <div className="reservation-timeline__cells" aria-hidden="true">{displayedDays.map(date => <div key={calendarDateKey(date)} className={calendarDateKey(date) === calendarDateKey(today) ? 'is-today' : ''} />)}</div>;
    return <div className="booking-calendar__scroll reservation-timeline-scroll" tabIndex="0" aria-label={`${monthLabel} accommodation timeline${labelSuffix}`} onPointerDown={startTimelineDrag} onPointerMove={moveTimelineDrag} onPointerUp={stopTimelineDrag} onPointerCancel={stopTimelineDrag}>
    <div className="reservation-timeline" style={{ '--timeline-days': displayedDays.length, '--resource-count': Math.max(1, renderedRowCount) }}>
      <div className="reservation-timeline__header">
        <strong className="reservation-timeline__resource">Accommodation</strong>
        {displayedDays.map(date => <div key={calendarDateKey(date)} className={calendarDateKey(date) === calendarDateKey(today) ? 'is-today' : ''}>
          <small>{date.toLocaleDateString('en-PH', { weekday: 'short' })}</small>
          <time dateTime={calendarDateKey(date)}>{date.getDate()}</time>
        </div>)}
      </div>
      {resources.map(resource => {
        const isExpanded = expandedGroups.has(resource.key);
        const occupiedUnits = resource.units.filter(unit => unit.bookings.some(booking => booking.status !== 'cancelled' && booking.check_in <= monthEnd && booking.check_out > monthStart)).length;
        const groupName = resource.name.toLowerCase().endsWith('room') ? `${resource.name}s` : resource.name;
        const occupiedUnitSummaries = resource.units.map((unit, unitIndex) => ({
          unit,
          unitIndex,
          segments: buildOccupancySegments(displayedDays, unit.bookings),
        })).filter(summary => summary.segments.length > 0);
        const conflictSummaries = resource.overflowBookings.map(booking => ({
          booking,
          segments: buildOccupancySegments(displayedDays, [booking]),
        })).filter(summary => summary.segments.length > 0);
        const cancelledSummaries = resource.cancelledBookings.map(booking => ({
          booking,
          segments: buildOccupancySegments(displayedDays, [booking]),
        })).filter(summary => summary.segments.length > 0);
        const summaryLaneCount = occupiedUnitSummaries.length + conflictSummaries.length + cancelledSummaries.length;
        return <div className="reservation-timeline__group-wrap" key={resource.key}>
          <div className="reservation-timeline__group" style={{ '--group-unit-count': Math.max(1, summaryLaneCount), minHeight: `${Math.max(74, summaryLaneCount * 30 + 6)}px` }}>
            <button type="button" className="reservation-timeline__resource reservation-timeline__group-toggle" aria-expanded={isExpanded} onClick={() => setExpandedGroups(current => {
              const next = new Set(current);
              if (next.has(resource.key)) next.delete(resource.key);
              else next.add(resource.key);
              return next;
            })}>
              <span><i aria-hidden="true">{isExpanded ? '⌄' : '›'}</i><strong>{groupName} ({resource.unitCount} {resource.unitCount === 1 ? 'unit' : 'units'})</strong></span>
              <small>{occupiedUnits} / {resource.unitCount} occupied</small>
            </button>
            <div className="reservation-timeline__track">
              {dateCells()}
              <div className="reservation-timeline__bars reservation-timeline__group-statuses">
                {occupiedUnitSummaries.flatMap(({ unit, unitIndex, segments }, laneIndex) => segments.map(({ start, end, status, bookings: activeBookings }) => {
                  const segmentDate = displayedDays[start];
                  const unitLabel = `Room ${unitIndex + 1}`;
                  return <button type="button" className={`booking-calendar__more booking-calendar__occupancy-alert booking-calendar__occupancy-alert--${status}${activeBookings.some(booking => String(booking.id) === String(highlightedBookingId)) ? ' is-booking-highlighted' : ''}`} key={`${unit.key}-${start}-${end}-${status}`}
                    style={{ gridColumn: `${start + 1} / ${end + 2}`, gridRow: laneIndex + 1 }}
                    data-calendar-booking-id={activeBookings.length === 1 ? activeBookings[0].id : undefined}
                    aria-label={`${unitLabel}: ${statusLabels[status]} from ${formatBookingDate(calendarDateKey(segmentDate))}; open booking details`}
                    onClick={() => activeBookings.length === 1 ? selectBooking(activeBookings[0]) : showOverflow(segmentDate, activeBookings)}><i aria-hidden="true" /><span>{unitLabel} · {statusLabels[status]}</span></button>;
                }))}
                {conflictSummaries.flatMap(({ booking, segments }, conflictIndex) => segments.map(({ start, end, status, bookings: activeBookings }) => {
                  const segmentDate = displayedDays[start];
                  return <button type="button" className={`booking-calendar__more booking-calendar__occupancy-alert booking-calendar__occupancy-alert--${status} is-conflict${String(highlightedBookingId) === String(booking.id) ? ' is-booking-highlighted' : ''}`} key={`conflict-${booking.id}-${start}-${end}`}
                    style={{ gridColumn: `${start + 1} / ${end + 2}`, gridRow: occupiedUnitSummaries.length + conflictIndex + 1 }}
                    data-calendar-booking-id={booking.id}
                    aria-label={`Unassigned overlapping booking: ${statusLabels[status]} from ${formatBookingDate(calendarDateKey(segmentDate))}`}
                    onClick={() => selectBooking(activeBookings[0])}><i aria-hidden="true" /><span>Conflict · {statusLabels[status]}</span></button>;
                }))}
                {cancelledSummaries.flatMap(({ booking, segments }, cancelledIndex) => segments.map(({ start, end, status, bookings: cancelled }) => {
                  const segmentDate = displayedDays[start];
                  return <button type="button" className={`booking-calendar__more booking-calendar__occupancy-alert booking-calendar__occupancy-alert--${status}${String(highlightedBookingId) === String(booking.id) ? ' is-booking-highlighted' : ''}`} key={`cancelled-${booking.id}-${start}-${end}`}
                    style={{ gridColumn: `${start + 1} / ${end + 2}`, gridRow: occupiedUnitSummaries.length + conflictSummaries.length + cancelledIndex + 1 }}
                    data-calendar-booking-id={booking.id}
                    aria-label={`Cancelled booking from ${formatBookingDate(calendarDateKey(segmentDate))}; open booking details`}
                    onClick={() => selectBooking(cancelled[0])}><i aria-hidden="true" /><span>Cancelled</span></button>;
                }))}
              </div>
            </div>
          </div>
          {isExpanded && resource.units.map(unit => {
            const { visible } = layoutCalendarWeek(displayedDays, unit.bookings, 1);
            const occupied = unit.bookings.some(booking => booking.status !== 'cancelled' && booking.check_in <= monthEnd && booking.check_out > monthStart);
            return <div className="reservation-timeline__row reservation-timeline__unit" key={unit.key}>
              <div className="reservation-timeline__resource"><strong>{unit.name}</strong><small className={occupied ? 'is-occupied' : ''}><i />{occupied ? 'Occupied' : 'Available'}</small></div>
              <div className="reservation-timeline__track">
                {dateCells()}
                <div className="reservation-timeline__bars">
                  {visible.map(({ booking, start, end, startsHere, endsHere }) => {
                    const schedule = getBookingNotes(booking.message);
                    const arrival = formatBookingTime(schedule.arrival) || 'Time not set';
                    const departure = formatBookingTime(schedule.departure) || 'Time not set';
                    return <button type="button" key={booking.id}
                      className={`booking-calendar__bar booking-calendar__bar--${booking.status}${startsHere ? ' is-check-in' : ''}${endsHere ? ' is-check-out' : ''}${String(highlightedBookingId) === String(booking.id) ? ' is-booking-highlighted' : ''}`}
                      style={{ gridColumn: `${start + 1} / ${end + 2}` }}
                      data-calendar-booking-id={booking.id}
                      aria-label={`${booking.guest_name}, ${unit.name}, check-in ${formatBookingDate(booking.check_in)} at ${arrival}, check-out ${formatBookingDate(booking.check_out)} at ${departure}, ${statusLabels[booking.status]}`}
                      title={`Check-in: ${formatBookingDate(booking.check_in)} at ${arrival} • Check-out: ${formatBookingDate(booking.check_out)} at ${departure}`}
                      onClick={() => selectBooking(booking)}><span>{booking.guest_name}</span><small>{statusLabels[booking.status]} · {formatBookingDate(booking.check_in, true)} {arrival} – {formatBookingDate(booking.check_out, true)} {departure}</small></button>;
                  })}
                </div>
              </div>
            </div>;
          })}
        </div>;
      })}
    </div>
  </div>;
  };

  const resourceSummary = <p className="timeline-resource-summary">6 accommodation types · {resources.reduce((total, resource) => total + resource.unitCount, 0)} physical units</p>;
  return <>
    <section className="booking-calendar admin-view" aria-labelledby="booking-calendar-heading">
      <div className="booking-calendar__header">
        <div>
          <span className="admin-kicker">Reservation schedule</span>
          <h2 id="booking-calendar-heading">Booking Calendar</h2>
        </div>
        <div className="booking-calendar__legend" aria-label="Booking status legend">
          {Object.entries(statusLabels).map(([status, label]) => <span key={status}><i className={`booking-calendar__status-dot booking-calendar__status-dot--${status}`} />{label}</span>)}
        </div>
      </div>
      <div className="booking-calendar__toolbar">
        <button type="button" className="reservation-timeline__today" onClick={() => setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1, 12))}>Today</button>
        <button type="button" onClick={() => moveMonth(-1)} aria-label="Previous month">‹</button>
        <strong aria-live="polite">{monthLabel}</strong>
        <button type="button" onClick={() => moveMonth(1)} aria-label="Next month">›</button>
        <button type="button" className="booking-calendar__landscape-button" title="Open fullscreen landscape calendar" aria-label="Open fullscreen landscape calendar" onClick={openLandscape}><AdminIcon name="landscape" /></button>
      </div>
      {resourceSummary}
      {renderCalendarGrid()}
    </section>

    <dialog ref={landscapeDialogRef} className="booking-calendar-landscape" aria-labelledby="booking-calendar-landscape-title" onClose={() => setLandscapeOpen(false)}>
      <div className="booking-calendar-landscape__header">
        <div><span className="admin-kicker">Landscape calendar</span><h2 id="booking-calendar-landscape-title">{monthLabel}</h2></div>
        <div className="booking-calendar__toolbar booking-calendar-landscape__toolbar">
          <button type="button" className="reservation-timeline__today" onClick={() => setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1, 12))}>Today</button>
          <button type="button" onClick={() => moveMonth(-1)} aria-label="Previous month">‹</button>
          <button type="button" onClick={() => moveMonth(1)} aria-label="Next month">›</button>
        </div>
        <button type="button" onClick={closeLandscape} aria-label="Close landscape calendar">×</button>
      </div>
      {resourceSummary}
      {renderCalendarGrid(' in landscape view', true)}
    </dialog>

    <dialog ref={dialogRef} className={`booking-calendar-dialog${landscapeOpen ? ' is-landscape' : ''}`} aria-labelledby="booking-calendar-dialog-title" onClose={() => setDialogContent(null)} onCancel={() => setDialogContent(null)}>
      {dialogContent?.type === 'booking' && (() => {
        const { booking } = dialogContent;
        const schedule = getBookingNotes(booking.message);
        return <>
          <div className="booking-calendar-dialog__header">
            <div><span className="admin-kicker">{booking.reference_code}</span><h3 id="booking-calendar-dialog-title">{booking.guest_name}</h3></div>
            <button type="button" onClick={closeDialog} aria-label="Close calendar booking details">×</button>
          </div>
          <span className={`booking-status booking-status--${booking.status}`}>{statusLabels[booking.status]}</span>
          <dl className="booking-calendar-dialog__facts">
            <div><dt>Stay</dt><dd>{booking.stay_type || booking.service_name || 'Flexible stay'}</dd></div>
            <div><dt>Unit</dt><dd>{booking.calendar_unit || 'Specific unit not assigned'}</dd></div>
            <div><dt>Check-in</dt><dd>{formatBookingDate(booking.check_in)}</dd></div>
            <div><dt>Check-out</dt><dd>{formatBookingDate(booking.check_out)}</dd></div>
            <div><dt>Arrival</dt><dd>{formatBookingTime(schedule.arrival) || 'Not set'}</dd></div>
            <div><dt>Departure</dt><dd>{formatBookingTime(schedule.departure) || 'Not set'}</dd></div>
            <div><dt>Guests</dt><dd>{booking.guests} {Number(booking.guests) === 1 ? 'guest' : 'guests'}</dd></div>
          </dl>
          <button type="button" className="booking-calendar-dialog__view" onClick={() => { closeDialog(); closeLandscape(); onViewBooking(booking.id); }}>View Booking <AdminIcon name="arrow" /></button>
        </>;
      })()}
      {dialogContent?.type === 'more' && <>
        <div className="booking-calendar-dialog__header">
          <div><span className="admin-kicker">Reservations by status</span><h3 id="booking-calendar-dialog-title">{formatBookingDate(calendarDateKey(dialogContent.date))}</h3></div>
          <button type="button" onClick={closeDialog} aria-label="Close additional bookings">×</button>
        </div>
        <div className="booking-calendar-dialog__list">
          {dialogContent.bookings.map(booking => <button type="button" key={booking.id} onClick={() => selectBooking(booking)}>
            <span><strong>{booking.guest_name}</strong><small>{booking.reference_code}</small></span>
            <span className={`booking-status booking-status--${booking.status}`}>{statusLabels[booking.status]}</span>
          </button>)}
        </div>
      </>}
    </dialog>
  </>;
}

function BookingRequestModal({ booking, onClose, updateStatus }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (booking && dialog && !dialog.open) dialog.showModal();
  }, [booking]);

  if (!booking) return null;
  const nights = getBookingNights(booking);
  const request = getBookingNotes(booking.message);
  return <dialog ref={dialogRef} className="admin-request-modal" aria-labelledby="request-modal-title" onClose={onClose} onCancel={onClose}>
    <div className="admin-request-modal__head">
      <div><span className="admin-kicker">Reservation · {booking.reference_code}</span><h2 id="request-modal-title">View &amp; manage</h2></div>
      <button type="button" className="admin-request-modal__close" onClick={onClose} aria-label="Close request details">×</button>
    </div>
    <div className={`admin-request-modal__guest admin-request-modal__guest--${booking.status}`}>
      <div><span>Guest</span><strong>{booking.guest_name}</strong><small>{booking.guests} {Number(booking.guests) === 1 ? 'guest' : 'guests'}</small></div>
      <span className={`booking-status booking-status--${booking.status}`}>{statusLabels[booking.status]}</span>
    </div>
    <div className="admin-request-modal__layout">
      <div className="admin-request-modal__main">
        <section className="request-panel request-panel--stay" aria-labelledby="stay-summary-title">
          <div className="request-panel__heading"><span>Stay summary</span><strong id="stay-summary-title">{booking.stay_type || 'Flexible stay'}</strong></div>
          <div className="request-date-route">
            <div><span>Check-in</span><strong>{formatBookingDate(booking.check_in)}</strong></div>
            <div className="request-date-route__line"><span>{nights ? `${nights + 1} ${nights + 1 === 1 ? 'day' : 'days'} · ${nights} ${nights === 1 ? 'night' : 'nights'}` : 'Stay'}</span></div>
            <div><span>Check-out</span><strong>{formatBookingDate(booking.check_out)}</strong></div>
          </div>
          {(request.arrival || request.departure) && <div className="request-times">
            <AdminIcon name="clock" />
            <span>Arrival <strong>{formatBookingTime(request.arrival) || 'Not set'}</strong></span>
            <span>Departure <strong>{formatBookingTime(request.departure) || 'Not set'}</strong></span>
          </div>}
        </section>
        <section className="request-panel">
          <div className="request-panel__heading"><span>Request details</span><strong>Guest preferences</strong></div>
          <dl className="request-facts">
            <div><dt>Requested service</dt><dd>{booking.service_name || 'None selected'}</dd></div>
            <div><dt>Activities</dt><dd>{request.activities || 'None selected'}</dd></div>
          </dl>
          <div className="request-note"><span>Message from guest</span><p>{request.note || 'No additional message provided.'}</p></div>
        </section>
      </div>
      <aside className="admin-request-modal__aside">
        <section className="request-panel request-contact">
          <div className="request-panel__heading"><span>Contact</span><strong>Reach the guest</strong></div>
          <a href={`mailto:${booking.email}`}><AdminIcon name="mail" /><span><small>Email</small>{booking.email}</span></a>
          <a href={`tel:${booking.phone}`}><AdminIcon name="phone" /><span><small>Mobile</small>{booking.phone}</span></a>
        </section>
        <section className="admin-request-modal__status"><span>Manage status</span><small>Continue this reservation through its next available step.</small>
          <BookingStatusActions booking={booking} updateStatus={updateStatus} />
          {!statusActions[booking.status] && <strong className="booking-status-workflow-complete">{statusLabels[booking.status]}</strong>}
        </section>
      </aside>
    </div>
  </dialog>;
}

function BookingsView({ bookings, accommodations, notice, setNotice, updateStatus, ManualBookingModal, csrfToken, onBookingSaved, navigationIntent }) {
  const [manualBookingOpen, setManualBookingOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [highlightedBookingId, setHighlightedBookingId] = useState(null);
  const [highlightedCalendarBookingId, setHighlightedCalendarBookingId] = useState(null);
  const highlightTimerRef = useRef(null);
  const calendarHighlightTimerRef = useRef(null);
  useEffect(() => {
    if (!navigationIntent) return;
    setFilter(navigationIntent.status || 'all');
    setQuery('');
    setManualBookingOpen(Boolean(navigationIntent.openManualBooking));
    const id = navigationIntent.bookingId ? String(navigationIntent.bookingId) : null;
    if (id) setHighlightedBookingId(id);
    const timer = window.setTimeout(() => {
      const target = id ? document.getElementById(`booking-${id}`) : document.getElementById('bookings-heading');
      if (id) target?.focus({ preventScroll: true });
      target?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: id ? 'center' : 'start' });
    }, 0);
    if (id) highlightTimerRef.current = window.setTimeout(() => setHighlightedBookingId(null), 2500);
    return () => window.clearTimeout(timer);
  }, [navigationIntent]);
  const visible = useMemo(() => {
    const todayKey = calendarDateKey(new Date());
    return bookings.filter(item => (
      (filter === 'all' || item.status === filter)
      && `${item.guest_name} ${item.reference_code} ${item.email} ${item.phone || ''} ${item.stay_type || ''} ${item.service_name || ''} ${item.message || ''}`.toLowerCase().includes(query.toLowerCase())
    )).sort((a, b) => {
      const aIsUpcoming = a.check_in >= todayKey;
      const bIsUpcoming = b.check_in >= todayKey;
      if (aIsUpcoming !== bIsUpcoming) return aIsUpcoming ? -1 : 1;
      const dateOrder = aIsUpcoming
        ? a.check_in.localeCompare(b.check_in)
        : b.check_in.localeCompare(a.check_in);
      return dateOrder || String(a.id).localeCompare(String(b.id));
    });
  }, [bookings, filter, query]);

  useEffect(() => () => {
    window.clearTimeout(highlightTimerRef.current);
    window.clearTimeout(calendarHighlightTimerRef.current);
  }, []);

  const viewBookingFromCalendar = bookingId => {
    setFilter('all');
    setQuery('');
    setHighlightedBookingId(String(bookingId));
    window.clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = window.setTimeout(() => setHighlightedBookingId(null), 2500);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      document.getElementById(`booking-${bookingId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }));
  };

  const viewBookingInCalendar = bookingId => {
    setHighlightedCalendarBookingId(String(bookingId));
    window.clearTimeout(calendarHighlightTimerRef.current);
    calendarHighlightTimerRef.current = window.setTimeout(() => setHighlightedCalendarBookingId(null), 2500);
  };

  return <>
    <BookingCalendar bookings={bookings} accommodations={accommodations} onViewBooking={viewBookingFromCalendar} highlightedBookingId={highlightedCalendarBookingId} />
    <section className="booking-board admin-view" aria-labelledby="bookings-heading">
    <div className="booking-board__head">
      <div className="booking-board__summary"><div><h2 id="bookings-heading">Booking requests</h2><p>{visible.length} {visible.length === 1 ? 'reservation' : 'reservations'}</p></div><button type="button" className="filter-row__add-booking booking-board__mobile-add" onClick={() => setManualBookingOpen(true)}>+ Add booking</button></div>
      <label className="admin-search"><AdminIcon name="search" /><input aria-label="Search bookings" placeholder="Search guest or reference" value={query} onChange={event => setQuery(event.target.value)} /></label>
    </div>
    <div className="filter-row">{['all', 'pending', 'confirmed', 'checked_in', 'completed', 'cancelled'].map(value => <button type="button" key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value === 'all' ? 'All' : statusLabels[value]}</button>)}<button type="button" className="filter-row__add-booking" onClick={() => setManualBookingOpen(true)}>+ Add booking</button></div>
    {notice && <p className="admin-notice" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss notification">×</button></p>}
    <div className="booking-table booking-card-grid">
      {visible.map(booking => {
        const nights = getBookingNights(booking);
        return <article className={`booking-card booking-card--calendar-link${highlightedBookingId === String(booking.id) ? ' is-calendar-highlighted' : ''}`} id={`booking-${booking.id}`} key={booking.id}
          tabIndex="0" role="button" aria-label={`Show ${booking.guest_name}'s booking in the calendar`}
          onClick={event => { if (!event.target.closest('button,select,input,label,a')) viewBookingInCalendar(booking.id); }}
          onKeyDown={event => { if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) { event.preventDefault(); viewBookingInCalendar(booking.id); } }}>
          <div className="booking-card__top">
            <span>{booking.reference_code}</span>
            <span className={`booking-status booking-status--${booking.status}`}>{statusLabels[booking.status]}</span>
          </div>
          <div className="booking-card__guest">
            <div><strong>{booking.guest_name}</strong><small>{booking.email}</small></div>
          </div>
          <div className="booking-card__stay">
            <div><span>Stay</span><strong>{booking.stay_type || booking.service_name || 'Flexible stay'}</strong></div>
            <div><span>Party</span><strong>{booking.guests} {Number(booking.guests) === 1 ? 'guest' : 'guests'}</strong></div>
          </div>
          <div className="booking-card__footer">
            <div className="booking-card__dates">
              <div><span>Check-in</span><strong>{formatBookingDate(booking.check_in, true)}</strong></div>
              <div className="booking-card__route"><span>{nights ? `${nights + 1}D · ${nights}N` : '→'}</span></div>
              <div><span>Check-out</span><strong>{formatBookingDate(booking.check_out, true)}</strong></div>
            </div>
            <div className="booking-card__actions">
              <BookingStatusActions booking={booking} updateStatus={updateStatus} />
              <button className="booking-manage-button" type="button" onClick={() => setSelectedBookingId(booking.id)}>View &amp; manage <AdminIcon name="arrow" /></button>
            </div>
          </div>
        </article>;
      })}
      {visible.length === 0 && <div className="empty-state"><AdminIcon name="calendar" /><h3>No reservations here yet.</h3><p>New booking requests will appear automatically.</p></div>}
    </div>
    <BookingRequestModal booking={bookings.find(item => item.id === selectedBookingId) || null} onClose={() => setSelectedBookingId(null)} updateStatus={updateStatus} />
    {manualBookingOpen && <ManualBookingModal open onClose={() => setManualBookingOpen(false)} csrfToken={csrfToken} onSaved={data => { setFilter('pending'); setQuery(''); onBookingSaved(data); }} />}
    </section>
  </>;
}

function GuestsView({ bookings }) {
  const [query, setQuery] = useState('');
  const guests = useMemo(() => {
    const grouped = new Map();
    bookings.forEach(booking => {
      const key = booking.email.toLowerCase();
      const existing = grouped.get(key);
      grouped.set(key, {
        name: booking.guest_name,
        email: booking.email,
        phone: booking.phone,
        totalBookings: (existing?.totalBookings || 0) + 1,
        latestStay: !existing || booking.created_at > existing.createdAt ? (booking.stay_type || 'Flexible stay') : existing.latestStay,
        createdAt: !existing || booking.created_at > existing.createdAt ? booking.created_at : existing.createdAt,
      });
    });
    return [...grouped.values()].filter(guest => `${guest.name} ${guest.email} ${guest.phone}`.toLowerCase().includes(query.toLowerCase()));
  }, [bookings, query]);

  return <section className="admin-view guest-directory" aria-labelledby="guests-heading">
    <div className="admin-view__heading">
      <div><span className="admin-kicker">Guest directory</span><h2 id="guests-heading">Your guests</h2></div>
      <label className="admin-search"><AdminIcon name="search" /><input aria-label="Search guests" placeholder="Search guest details" value={query} onChange={event => setQuery(event.target.value)} /></label>
    </div>
    <div className="guest-list">
      <div className="guest-row guest-row--head"><span>Guest</span><span>Contact</span><span>Latest preference</span><span>Requests</span></div>
      {guests.map(guest => <article className="guest-row" key={guest.email}>
        <div className="guest-name"><i>{guest.name.charAt(0).toUpperCase()}</i><strong>{guest.name}</strong></div>
        <div><strong>{guest.email}</strong><small>{guest.phone}</small></div>
        <span>{guest.latestStay}</span><b>{guest.totalBookings}</b>
      </article>)}
      {guests.length === 0 && <div className="empty-state"><AdminIcon name="users" /><h3>No guests found.</h3><p>Guest profiles are created automatically from booking requests.</p></div>}
    </div>
  </section>;
}

function OperationsDashboard({ bookings, notice, setNotice, onOpenBookings }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const data = useMemo(() => dashboardData(bookings, now), [bookings, now]);
  const list = (items, empty, departure = false, attention = false) => items.length ? <div className="operations-list">{items.map(booking => {
    const schedule = getBookingNotes(booking.message);
    const reason = 'Awaiting your reply';
    return <button type="button" className="operations-booking" key={booking.id} onClick={() => onOpenBookings({ bookingId: booking.id })}>
      <span><strong>{booking.guest_name || 'Guest'}</strong><small>{booking.reference_code} · {booking.stay_type || booking.service_name || 'Flexible stay'}</small></span>
      <span><span className={`booking-status booking-status--${booking.status}`}>{statusLabels[booking.status]}</span><small>{attention ? reason : `${formatBookingDate(departure ? booking.check_out : booking.check_in, true)} · ${formatBookingTime(departure ? schedule.departure : schedule.arrival) || 'Time not set'}`}</small></span>
      <AdminIcon name="arrow" />
    </button>;
  })}</div> : <p className="operations-empty">{empty}</p>;
  return <section className="operations-dashboard admin-view" aria-labelledby="dashboard-heading">
    <div className="admin-view__heading"><div><h2 id="dashboard-heading">Dashboard</h2><p>{formatBookingDate(data.today)}</p></div><button type="button" className="admin-mock-button operations-add-booking operations-add-booking--desktop" onClick={() => onOpenBookings({ openManualBooking: true })}>+ Add booking</button></div>
    {notice && <p className="admin-notice" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss notification">×</button></p>}
    <StatCards stats={data} />
    <button type="button" className="admin-mock-button operations-add-booking operations-add-booking--mobile" onClick={() => onOpenBookings({ openManualBooking: true })}>+ Add booking</button>
    <section className="operations-panel" aria-labelledby="attention-heading"><div className="operations-panel__heading"><h3 id="attention-heading">Needs attention <span>{data.attention.length}</span></h3><button type="button" className="admin-mock-button" onClick={() => onOpenBookings({ status: 'pending' })}>View all pending</button></div>{list(data.attention, 'You’re all caught up. No bookings need attention.', false, true)}</section>
    <section className="operations-panel" aria-labelledby="today-heading"><h3 id="today-heading">Today</h3><div className="operations-today"><section><h4>Arriving · {data.arrivals.length}</h4>{list(data.arrivals, 'No confirmed arrivals scheduled today.')}</section><section><h4>Checked In · {data.checkedIn.length}</h4>{list(data.checkedIn, 'No guests are currently checked in.')}</section><section><h4>Check Out · {data.departures.length}</h4>{list(data.departures, 'No checkouts scheduled today.', true)}</section></div></section>
    <section className="operations-panel" aria-labelledby="week-heading"><h3 id="week-heading">Next 7 days</h3><p className="operations-caption">Upcoming check-ins from tomorrow through the next seven days.</p>{list(data.upcoming, 'No arrivals scheduled for the next seven days.')}</section>
  </section>;
}

function AdminWorkspace({ user, csrfToken, onLogout, ManualBookingModal }) {
  const [bookings, setBookings] = useState([]);
  const [accommodations, setAccommodations] = useState([]);
  const [activeView, setActiveView] = useState('dashboard');
  const [navigationIntent, setNavigationIntent] = useState(null);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/bookings.php', { headers: { Accept: 'application/json' } });
      if (response.status === 401) return onLogout();
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load bookings.');
      setBookings(data.bookings);
      setAccommodations(data.accommodations || []);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { document.title = `${navItems.find(item => item.id === activeView)?.label} · Odidepse Admin`; }, [activeView]);

  const updateStatus = async (id, status) => {
    try {
      const response = await fetch('/api/admin/bookings.php', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ id: Number(id), status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Update failed.');
      setBookings(current => current.map(item => Number(item.id) === Number(id) ? { ...item, status } : item));
      setNotice(`Booking ${data.reference} updated.`);
    } catch (error) {
      setNotice(error.message);
    }
  };

  const logout = async () => {
    await fetch('/api/admin/logout.php', { method: 'POST', headers: { 'X-CSRF-Token': csrfToken, Accept: 'application/json' } });
    onLogout();
  };

  const navigate = view => {
    setNavigationIntent(null);
    setActiveView(view);
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <span className="admin-wordmark admin-sidebar__label">ODIDEPSE</span>
      <nav aria-label="Admin navigation"><span className="admin-sidebar__label">Workspace</span>{navItems.map(item => <button type="button" key={item.id} className={activeView === item.id ? 'active' : ''} aria-current={activeView === item.id ? 'page' : undefined} title={item.label} onClick={() => navigate(item.id)}><AdminIcon name={item.icon} /><span className="admin-sidebar__label">{item.label}</span></button>)}</nav>
      <button type="button" title="Sign out" onClick={logout}><AdminIcon name="logout" /><span className="admin-sidebar__label">Sign out</span></button>
    </aside>
    <main className="admin-main">
      {activeView === 'dashboard' && <header><div><span className="admin-kicker">Daily operations</span><h1>Good day, {user.display_name.split(' ')[0]}.</h1></div><div className="admin-avatar">{user.display_name.charAt(0).toUpperCase()}</div></header>}
      <nav className="admin-mobile-nav" aria-label="Admin sections">{navItems.map(item => <button type="button" key={item.id} className={activeView === item.id ? 'active' : ''} aria-current={activeView === item.id ? 'page' : undefined} title={item.label} onClick={() => navigate(item.id)}><AdminIcon name={item.icon} /><span className="admin-mobile-nav__label">{item.label}</span></button>)}</nav>
      {loading ? <div className="admin-section-loading"><span>Loading resort data…</span></div> : <>
        {activeView === 'dashboard' && <OperationsDashboard bookings={bookings} notice={notice} setNotice={setNotice} onOpenBookings={intent => { navigate('bookings'); setNavigationIntent(intent); }} />}
        {activeView === 'bookings' && <BookingsView navigationIntent={navigationIntent} bookings={bookings} accommodations={accommodations} notice={notice} setNotice={setNotice} updateStatus={updateStatus} ManualBookingModal={ManualBookingModal} csrfToken={csrfToken} onBookingSaved={data => { setNotice(`Booking ${data.reference} saved.`); load(); }} />}
        {['stays','services','content'].includes(activeView) && <ResortManager key={activeView} kind={activeView} csrfToken={csrfToken} onLogout={onLogout} bookings={bookings} />}
        {activeView === 'guests' && <GuestsView bookings={bookings} />}
      </>}
    </main>
  </div>;
}

export default function AdminApp({ ManualBookingModal }) {
  const [session, setSession] = useState({ loading: true, user: null, csrfToken: '' });
  const mobileSplashEnabled = window.matchMedia('(max-width: 900px)').matches;
  const [showSplash, setShowSplash] = useState(mobileSplashEnabled);
  const [splashLeaving, setSplashLeaving] = useState(false);
  const logout = useCallback(() => setSession({ loading: false, user: null, csrfToken: '' }), []);

  const check = useCallback(async () => {
    const splashStartedAt = performance.now();
    let nextSession;

    try {
      const response = await fetch('/api/admin/session.php', { headers: { Accept: 'application/json' } });
      const data = await response.json();
      nextSession = response.ok && data.authenticated
        ? { loading: false, user: data.user, csrfToken: data.csrf_token }
        : { loading: false, user: null, csrfToken: '' };
    } catch {
      nextSession = { loading: false, user: null, csrfToken: '' };
    }

    setSession(nextSession);
    if (mobileSplashEnabled) {
      const remainingSplashTime = Math.max(0, 1400 - (performance.now() - splashStartedAt));
      await new Promise(resolve => window.setTimeout(resolve, remainingSplashTime));
      setSplashLeaving(true);
      await new Promise(resolve => window.setTimeout(resolve, 650));
      setShowSplash(false);
    }
  }, [mobileSplashEnabled]);

  useEffect(() => { check(); }, [check]);
  if (session.loading && !showSplash) return null;
  const content = session.loading ? null : !session.user
    ? <AdminLogin onLogin={(user, csrfToken) => setSession({ loading: false, user, csrfToken })} />
    : <AdminWorkspace user={session.user} csrfToken={session.csrfToken} onLogout={logout} ManualBookingModal={ManualBookingModal} />;
  return <>{content}{showSplash && <div className={`admin-loading${splashLeaving ? ' is-leaving' : ''}`} role="status" aria-label="Loading Odidepse administration"><span>ODIDEPSE</span></div>}</>;
}
