import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ResortManager from './features/resort-management/ResortManager.jsx';
import FacebookAutomations from './features/facebook-automation/FacebookAutomations.jsx';
import { dashboardData } from './features/dashboard/dashboardData.js';
import { overlaps, roomPlanning } from './features/bookings/bookingRoomPlanning.js';
import useVisibilityPolling from './features/polling/useVisibilityPolling.js';
import Notifications from './features/notifications/Notifications.jsx';
import BookingEmailConfirmation from './features/notifications/BookingEmailConfirmation.jsx';
import './styles/admin-responsive.css';

const statusLabels = {
  pending: 'New request',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  completed: 'Completed',
  no_show: 'No show · room held',
  cancelled: 'Cancelled',
};

const terminalBookingStatuses = ['completed', 'no_show', 'cancelled'];

const statusActions = {
  pending: [
    { status: 'confirmed', label: 'Confirm', tone: 'primary' },
    { status: 'cancelled', label: 'Cancel', tone: 'danger' },
  ],
  confirmed: [{ status: 'checked_in', label: 'Check in', tone: 'primary' }],
  checked_in: [{ status: 'completed', label: 'Check out', tone: 'checked-in' }],
  no_show: [
    { status: 'checked_in', label: 'Correct to checked in', tone: 'primary' },
    { status: 'cancelled', label: 'Cancel booking', tone: 'danger' },
  ],
};

function BookingStatusActions({ booking, updateStatus }) {
  const [selectedAction, setSelectedAction] = useState(null);
  const actions = statusActions[booking.status] || [];
  if (actions.length === 0) return null;

  return <div className="booking-status-actions" aria-label={`Actions for ${booking.guest_name}`}>
    {actions.map(action => <button type="button" className={`booking-status-action booking-status-action--${action.tone}`} key={action.status}
      onClick={() => setSelectedAction(action)}>{action.label}</button>)}
    {selectedAction && <BookingEmailConfirmation booking={booking} status={selectedAction.status} label={selectedAction.label} onClose={() => setSelectedAction(null)} onConfirm={details => updateStatus(booking.id, selectedAction.status, details)} />}
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

function escapeSpreadsheetXml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

function spreadsheetCell(value, type = 'String', style = '') {
  const safeType = type === 'Number' ? 'Number' : 'String';
  const safeValue = safeType === 'Number' && Number.isFinite(Number(value)) ? Number(value) : escapeSpreadsheetXml(value);
  return `<Cell${style ? ` ss:StyleID="${style}"` : ''}><Data ss:Type="${safeType}">${safeValue}</Data></Cell>`;
}

function spreadsheetRow(values, style = '') {
  return `<Row>${values.map(value => spreadsheetCell(value, typeof value === 'number' ? 'Number' : 'String', style)).join('')}</Row>`;
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

  return { visible, overflow, laneCount: Math.max(1, visible.reduce((count, segment) => Math.max(count, segment.lane + 1), 0)) };
}

function layoutCalendarUnitSummary(weekDays, units, overflowBookings = []) {
  const visible = [];
  let laneOffset = 0;
  [...units.map(unit => unit.bookings), overflowBookings].forEach(bookings => {
    const layout = layoutCalendarWeek(weekDays, bookings, Math.max(1, bookings.length));
    if (layout.visible.length === 0) return;
    layout.visible.forEach(segment => visible.push({ ...segment, lane: segment.lane + laneOffset }));
    laneOffset += layout.laneCount;
  });
  return { visible, laneCount: Math.max(1, laneOffset) };
}

function allocateBookingsToUnits(bookings, unitCount, accommodationName) {
  const units = Array.from({ length: unitCount }, (_, index) => ({
    key: `${accommodationName.toLowerCase()}-unit-${index + 1}`,
    name: unitCount === 1 ? accommodationName : `${accommodationName.replace(/s?$/i, '')} #${index + 1}`,
    bookings: [],
  }));
  const overflowBookings = [];
  if (bookings.every(booking => Object.hasOwn(booking, 'calendar_room'))) {
    bookings.forEach(booking => {
      const index = Number(booking.calendar_room) - 1;
      if (!units[index]) overflowBookings.push(booking);
      else units[index].bookings.push({ ...booking, calendar_unit: units[index].name });
    });
    return { units, overflowBookings, cancelledBookings: [] };
  }
  const cancelledBookings = bookings.filter(booking => booking.status === 'cancelled');
  const activeBookings = bookings.filter(booking => booking.status !== 'cancelled');
  const blockingStatuses = new Set(['confirmed', 'checked_in', 'completed', 'no_show']);
  const overlaps = (first, second) => first.check_in <= second.check_out && first.check_out >= second.check_in;
  const byDate = (first, second) => first.check_in.localeCompare(second.check_in) || first.check_out.localeCompare(second.check_out) || String(first.id).localeCompare(String(second.id));

  activeBookings.filter(booking => blockingStatuses.has(booking.status)).sort(byDate).forEach(booking => {
    const unit = units.find(candidate => !candidate.bookings.some(existing => overlaps(existing, booking)));
    if (!unit) {
      overflowBookings.push(booking);
      return;
    }
    unit.bookings.push({ ...booking, calendar_unit: unit.name });
  });

  activeBookings.filter(booking => !blockingStatuses.has(booking.status)).sort(byDate).forEach(booking => {
    const eligibleUnits = units.filter(candidate => !candidate.bookings.some(existing => blockingStatuses.has(existing.status) && overlaps(existing, booking)));
    const unit = eligibleUnits.find(candidate => candidate.bookings.some(existing => existing.status === 'pending' && overlaps(existing, booking)))
      || eligibleUnits.find(candidate => !candidate.bookings.some(existing => overlaps(existing, booking)))
      || eligibleUnits.sort((first, second) => first.bookings.length - second.bookings.length)[0];
    if (!unit) {
      overflowBookings.push(booking);
      return;
    }
    unit.bookings.push({ ...booking, calendar_unit: unit.name });
  });

  return { units, overflowBookings, cancelledBookings };
}

function bookingsOverlap(first, second) {
  return overlaps(first, second);
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

function sameDayTurnoverLabel(booking, unit) {
  const departures = unit.bookings.filter(other => String(other.id) !== String(booking.id)
    && other.status !== 'cancelled' && other.check_out === booking.check_in);
  if (departures.length === 0) return '';
  const departure = departures.map(other => getBookingNotes(other.message).departure || '12:00').sort().at(-1);
  const arrival = getBookingNotes(booking.message).arrival || '14:00';
  return `Same-day turnover · checkout ${formatBookingTime(departure)} → arrival ${formatBookingTime(arrival)}`;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'overview' },
  { id: 'bookings', label: 'Bookings', icon: 'calendar' },
  { id: 'stays', label: 'Stays', icon: 'home' },
  { id: 'guests', label: 'Guests', icon: 'users' },
  { id: 'services', label: 'Activities', icon: 'home' },
  { id: 'facebook', label: 'Facebook Automations', icon: 'automation' },
  { id: 'notifications', label: 'Email notifications', icon: 'mail' },
];

function AdminIcon({ name }) {
  const paths = {
    automation: <><rect x="3" y="4" width="18" height="13" rx="3" /><path d="m7 17-2 4 7-4M8 9h8M8 12h5" /></>,
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

function BookingCalendar({ bookings, accommodations, statusFilter, onStatusFilterChange, onViewBooking, highlightedBookingId, onMoveBooking, canUndoRoomMove, onUndoRoomMove, onSaveRoomMoves }) {
  const [roomChangeNote, setRoomChangeNote] = useState('');
  const [draggedId, setDraggedId] = useState(null);
  const [floatingCard, setFloatingCard] = useState(null);
  const [dropRoom, setDropRoom] = useState('');
  const floatingCardRef = useRef(null);
  const [moveNotice, setMoveNotice] = useState('');
  const [moveWarning, setMoveWarning] = useState(null);
  const [moving, setMoving] = useState(false);
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
  const moveWarningDialogRef = useRef(null);
  const handledCalendarFocusRef = useRef(null);
  const timelineDragRef = useRef(null);
  const cardDragRef = useRef(null);
  const suppressCardClickUntilRef = useRef(0);

  const releaseTimelinePointer = useCallback(() => {
    const drag = timelineDragRef.current;
    timelineDragRef.current = null;
    if (!drag) return;
    drag.scroller.classList.remove('is-dragging');
    try {
      if (drag.scroller.hasPointerCapture(drag.pointerId)) drag.scroller.releasePointerCapture(drag.pointerId);
    } catch { /* The browser may have already cancelled this pointer. */ }
  }, []);
  const finishCardDrag = useCallback(() => {
    const drag = cardDragRef.current;
    if (drag?.active) suppressCardClickUntilRef.current = Date.now() + 400;
    cardDragRef.current = null;
    try {
      if (drag?.element.hasPointerCapture(drag.pointerId)) drag.element.releasePointerCapture(drag.pointerId);
    } catch { /* The browser may have already cancelled this pointer. */ }
    if (floatingCardRef.current?.matches(':popover-open')) floatingCardRef.current.hidePopover();
    setDraggedId(null);
    setFloatingCard(null);
    setDropRoom('');
    releaseTimelinePointer();
  }, [releaseTimelinePointer]);
  useEffect(() => {
    const recoverStaleCapture = () => {
      if (timelineDragRef.current || cardDragRef.current) finishCardDrag();
    };
    const releaseForSelection = () => {
      if (timelineDragRef.current && !window.getSelection()?.isCollapsed) releaseTimelinePointer();
    };
    window.addEventListener('blur', finishCardDrag);
    window.addEventListener('pointerup', finishCardDrag);
    window.addEventListener('pointercancel', finishCardDrag);
    window.addEventListener('mouseup', finishCardDrag);
    window.addEventListener('dragend', finishCardDrag);
    window.addEventListener('pointerdown', recoverStaleCapture, true);
    document.addEventListener('selectionchange', releaseForSelection);
    const escape = event => { if (event.key === 'Escape') finishCardDrag(); };
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('blur', finishCardDrag);
      window.removeEventListener('pointerup', finishCardDrag);
      window.removeEventListener('pointercancel', finishCardDrag);
      window.removeEventListener('mouseup', finishCardDrag);
      window.removeEventListener('dragend', finishCardDrag);
      window.removeEventListener('pointerdown', recoverStaleCapture, true);
      document.removeEventListener('selectionchange', releaseForSelection);
      window.removeEventListener('keydown', escape);
      releaseTimelinePointer();
    };
  }, [finishCardDrag, releaseTimelinePointer]);
  useEffect(() => {
    if (floatingCard) floatingCardRef.current?.showPopover?.();
  }, [floatingCard]);
  const days = useMemo(() => Array.from({ length: new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate() }, (_, index) => addCalendarDays(visibleMonth, index)), [visibleMonth]);
  const calendarBookings = useMemo(() => bookings.filter(booking => (
    terminalBookingStatuses.includes(statusFilter)
      ? booking.status === statusFilter
      : (booking.status === 'no_show' || !terminalBookingStatuses.includes(booking.status)) && (statusFilter === 'all' || booking.status === statusFilter)
  )), [bookings, statusFilter]);
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
      const matchingBookings = calendarBookings.filter(booking => {
        if (catalogStay && Number(booking.stay_id) === Number(catalogStay.id)) return true;
        return (booking.stay_type || '').toLowerCase() === key;
      });
      const allocation = allocateBookingsToUnits(matchingBookings, unitCount, name);
      const activeBookings = bookings.filter(booking => ['pending', 'confirmed', 'checked_in', 'no_show'].includes(booking.status)
        && ((catalogStay && Number(booking.stay_id) === Number(catalogStay.id)) || (booking.stay_type || '').toLowerCase() === key));
      const planningAllocation = allocateBookingsToUnits(activeBookings, unitCount, name);
      const planning = roomPlanning(planningAllocation.units, planningAllocation.overflowBookings);
      const suggestions = planning.suggestions.filter(item => matchingBookings.some(booking => String(booking.id) === String(item.booking.id)))
        .map(item => ({ ...item, unit: allocation.units.find(unit => unit.key === item.unit.key) }));
      return { key, name, stayId: catalogStay?.id, unitCount, bookings: matchingBookings, ...allocation, priorities: planning.priorities, suggestions };
    });
  }, [calendarBookings, accommodations, bookings]);
  const monthLabel = new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(visibleMonth);

  useEffect(() => {
    if (!highlightedBookingId) {
      handledCalendarFocusRef.current = null;
      return;
    }
    const focusId = String(highlightedBookingId);
    if (handledCalendarFocusRef.current === focusId) return;
    const booking = calendarBookings.find(item => String(item.id) === String(highlightedBookingId));
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
  }, [highlightedBookingId, calendarBookings, resources, visibleMonth, expandedGroups]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (dialogContent && !dialog.open && !cardDragRef.current) dialog.showModal();
    if (!dialogContent && dialog.open) dialog.close();
  }, [dialogContent]);
  useEffect(() => {
    const dialog = moveWarningDialogRef.current;
    if (!dialog) return;
    if (moveWarning && !dialog.open) dialog.showModal();
    if (!moveWarning && dialog.open) dialog.close();
  }, [moveWarning]);

  const closeDialog = () => {
    if (dialogRef.current?.open) dialogRef.current.close();
    setDialogContent(null);
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
    if (cardDragRef.current || Date.now() < suppressCardClickUntilRef.current) return;
    setDialogContent({ type: 'booking', booking });
  };
  const moveBooking = async (booking, resource, unit, confirmWarnings = false) => {
    if (moving || !resource.stayId) return;
    setMoving(true);
    setMoveNotice('Saving room assignment…');
    try {
      const result = await onMoveBooking(booking, resource.stayId, resource.units.indexOf(unit) + 1, confirmWarnings);
      if (result?.requires_confirmation) {
        setMoveWarning({ booking, resource, unit, warnings: result.warnings || [result.message], canProceed: result.can_proceed !== false });
        setMoveNotice('');
        return;
      }
      setMoveNotice(`${booking.guest_name} moved to ${unit.name}.`);
      setMoveWarning(null);
      closeDialog();
    } catch (error) {
      setMoveNotice('');
      setMoveWarning({ booking, resource, unit, warnings: error.moveWarnings || [error.message], canProceed: false });
    }
    finally { setMoving(false); setDraggedId(null); }
  };
  const undoRoomMove = async () => {
    if (moving || !canUndoRoomMove) return;
    setMoving(true);
    setMoveNotice('Restoring the previous room…');
    try {
      const result = await onUndoRoomMove();
      setMoveNotice(`${result.reference} returned to ${result.restored_room}.`);
      closeDialog();
    } catch (error) { setMoveNotice(error.message); }
    finally { setMoving(false); finishCardDrag(); }
  };
  const saveRoomMoves = async () => {
    if (moving || !canUndoRoomMove) return;
    setMoving(true);
    setMoveNotice('Saving room changes...');
    try {
      const result = await onSaveRoomMoves(roomChangeNote);
      setRoomChangeNote('');
      const count = Number(result.saved_moves || 0);
      setMoveNotice(`${count} room ${count === 1 ? 'change' : 'changes'} saved.`);
    } catch (error) { setMoveNotice(error.message); }
    finally { setMoving(false); finishCardDrag(); }
  };
  const dragProps = booking => ({
    draggable: false,
    'data-room-draggable': !moving && ['pending', 'confirmed', 'checked_in'].includes(booking.status) ? 'true' : undefined,
    'data-room-dragging': draggedId === String(booking.id) ? 'true' : undefined,
    onDragStart: event => event.preventDefault(),
    onPointerDown: event => {
      event.stopPropagation();
      if (moving || !event.isPrimary || event.button !== 0 || !['pending', 'confirmed', 'checked_in'].includes(booking.status)) return;
      releaseTimelinePointer();
      cardDragRef.current = { booking, element: event.currentTarget, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, active: false };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: event => {
      const drag = cardDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.stopPropagation();
      if (!drag.active && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6) return;
      event.preventDefault();
      if (!drag.active) {
        drag.active = true;
        setDraggedId(String(booking.id));
        setFloatingCard({ booking, x: event.clientX + 16, y: event.clientY + 16 });
      }
      if (floatingCardRef.current) {
        floatingCardRef.current.style.left = `${Math.min(event.clientX + 16, window.innerWidth - 290)}px`;
        floatingCardRef.current.style.top = `${Math.min(event.clientY + 16, window.innerHeight - 90)}px`;
      }
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      setDropRoom(hit?.closest('[data-drop-room]')?.dataset.dropRoom || '');
      const group = hit?.closest('[data-drop-group]')?.dataset.dropGroup;
      if (group && !expandedGroups.has(group)) setExpandedGroups(current => new Set(current).add(group));
      const scroller = drag.element.closest('.reservation-timeline-scroll');
      if (scroller) {
        const bounds = scroller.getBoundingClientRect();
        if (event.clientX > bounds.right - 35) scroller.scrollLeft += 16;
        if (event.clientX < bounds.left + 35) scroller.scrollLeft -= 16;
      }
      if (event.clientY > window.innerHeight - 45) window.scrollBy(0, 16);
      if (event.clientY < 45) window.scrollBy(0, -16);
    },
    onPointerUp: event => {
      const drag = cardDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.stopPropagation();
      const target = drag.active ? document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-drop-room]')?.dataset.dropRoom : null;
      const resource = resources.find(item => item.units.some(unit => unit.key === target));
      finishCardDrag();
      if (resource) moveBooking(drag.booking, resource, resource.units.find(unit => unit.key === target));
    },
    onPointerCancel: finishCardDrag,
    onLostPointerCapture: finishCardDrag,
  });
  const startTimelineDrag = event => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || event.target.closest('button, a, input, select, textarea')) return;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;
    const scroller = event.currentTarget;
    timelineDragRef.current = { scroller, pointerId: event.pointerId, startX: event.clientX, scrollLeft: scroller.scrollLeft };
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
    releaseTimelinePointer();
  };

  const renderCalendarGrid = (labelSuffix = '', isLandscape = false) => {
    const displayedDays = days;
    const renderedRowCount = resources.reduce((count, resource) => count + 1 + (expandedGroups.has(resource.key) ? resource.units.length : 0), 0);
    const monthStart = calendarDateKey(days[0]);
    const monthEnd = calendarDateKey(days.at(-1));
    const dateCells = () => <div className="reservation-timeline__cells" aria-hidden="true">{displayedDays.map(date => <div key={calendarDateKey(date)} className={calendarDateKey(date) === calendarDateKey(today) ? 'is-today' : ''} />)}</div>;
    return <div className="booking-calendar__scroll reservation-timeline-scroll" tabIndex="0" aria-label={`${monthLabel} accommodation timeline${labelSuffix}`} onPointerDown={startTimelineDrag} onPointerMove={moveTimelineDrag} onPointerUp={stopTimelineDrag} onPointerCancel={stopTimelineDrag} onLostPointerCapture={stopTimelineDrag}>
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
        const blockingStatuses = new Set(['confirmed', 'checked_in', 'no_show']);
        const bookingTouchesMonth = booking => booking.check_in <= monthEnd && booking.check_out >= monthStart;
        const occupiedUnits = resource.units.filter(unit => unit.bookings.some(booking => blockingStatuses.has(booking.status) && bookingTouchesMonth(booking))).length;
        const pendingRequests = resource.units.reduce((count, unit) => count + unit.bookings.filter(booking => booking.status === 'pending' && bookingTouchesMonth(booking)).length, 0);
        const groupName = resource.name.toLowerCase().endsWith('room') ? `${resource.name}s` : resource.name;
        const summaryBookings = [...resource.units.flatMap(unit => unit.bookings), ...resource.overflowBookings, ...resource.cancelledBookings];
        const { visible: summarySegments, laneCount: summaryLaneCount } = layoutCalendarUnitSummary(displayedDays, resource.units, [...resource.overflowBookings, ...resource.cancelledBookings]);
        return <div className="reservation-timeline__group-wrap" key={resource.key}>
          <div className="reservation-timeline__group" data-drop-group={resource.key} style={{ '--group-unit-count': Math.max(1, summaryLaneCount), minHeight: `${Math.max(74, summaryLaneCount * 30 + 6)}px` }}>
            <button type="button" className="reservation-timeline__resource reservation-timeline__group-toggle" aria-expanded={isExpanded} onClick={() => setExpandedGroups(current => {
              const next = new Set(current);
              if (next.has(resource.key)) next.delete(resource.key);
              else next.add(resource.key);
              return next;
            })}>
              <span><i aria-hidden="true">{isExpanded ? '⌄' : '›'}</i><strong>{groupName} ({resource.unitCount} {resource.unitCount === 1 ? 'unit' : 'units'})</strong></span>
              <small>{occupiedUnits} / {resource.unitCount} unavailable{pendingRequests ? ` · ${pendingRequests} new ${pendingRequests === 1 ? 'request' : 'requests'}` : ''}</small>
            </button>
            <div className="reservation-timeline__track">
              {dateCells()}
              <div className="reservation-timeline__bars reservation-timeline__group-statuses">
                {summarySegments.map(({ booking, start, end, lane }) => {
                  const conflict = ['pending', 'confirmed', 'checked_in', 'no_show'].includes(booking.status) && summaryBookings.some(other => String(other.id) !== String(booking.id)
                    && ['pending', 'confirmed', 'checked_in', 'no_show'].includes(other.status) && (!booking.calendar_room || booking.calendar_room === other.calendar_room) && bookingsOverlap(booking, other));
                  const fromFacebook = Number(booking.is_facebook_booking) === 1;
                  return <button type="button" className={`booking-calendar__occupancy-alert booking-calendar__occupancy-alert--${booking.status}${fromFacebook ? ' is-facebook-booking' : ''}${conflict ? ' is-conflict' : ''}${String(highlightedBookingId) === String(booking.id) ? ' is-booking-highlighted' : ''}`} key={`summary-${booking.id}-${start}-${end}`}
                    style={{ gridColumn: `${start + 1} / ${end + 2}`, gridRow: lane + 1 }}
                    data-calendar-booking-id={booking.id}
                    {...dragProps(booking)}
                    aria-label={`${booking.guest_name}: ${statusLabels[booking.status]}${fromFacebook ? ', from Facebook Page' : ''} from ${formatBookingDate(booking.check_in)} to ${formatBookingDate(booking.check_out)}; open booking details`}
                    onClick={() => selectBooking(booking)}><i aria-hidden="true" /><span>{resource.priorities.has(String(booking.id)) && <strong className="booking-calendar__priority" title="Request order: oldest first">#{resource.priorities.get(String(booking.id))}</strong>}{booking.guest_name} · {statusLabels[booking.status]}{fromFacebook && <strong className="booking-calendar__source">Facebook</strong>}</span></button>;
                })}
              </div>
            </div>
          </div>
          {isExpanded && resource.units.map(unit => {
            const { visible, laneCount } = layoutCalendarWeek(displayedDays, unit.bookings, Math.max(1, unit.bookings.length));
            const unitSuggestions = resource.suggestions.filter(suggestion => suggestion.unit?.key === unit.key).flatMap(suggestion => {
              const checkIn = parseCalendarDate(suggestion.booking.check_in);
              const checkOut = parseCalendarDate(suggestion.booking.check_out);
              if (!checkIn || !checkOut || checkOut < days[0] || checkIn > days.at(-1)) return [];
              return [{ ...suggestion, start: Math.max(0, calendarDayDifference(days[0], checkIn)), end: Math.min(days.length - 1, calendarDayDifference(days[0], checkOut)) }];
            });
            const occupied = unit.bookings.some(booking => blockingStatuses.has(booking.status) && bookingTouchesMonth(booking));
            const hasPending = unit.bookings.some(booking => booking.status === 'pending' && bookingTouchesMonth(booking));
            return <div className={`reservation-timeline__row reservation-timeline__unit${dropRoom === unit.key ? ' is-drop-target' : ''}`} data-drop-room={unit.key} key={unit.key} style={{ minHeight: `${Math.max(70, laneCount * 58 + 8)}px` }}>
              <div className="reservation-timeline__resource"><strong>{unit.name}</strong><small className={occupied ? 'is-occupied' : hasPending ? 'is-pending' : ''}><i />{occupied ? 'Occupied' : hasPending ? 'New requests' : 'Available'}</small></div>
              <div className="reservation-timeline__track">
                {dateCells()}
                <div className="reservation-timeline__bars reservation-timeline__unit-bars" style={{ '--unit-lane-count': laneCount, minHeight: `${laneCount * 58}px` }}>
                  {visible.map(({ booking, start, end, startsHere, endsHere, lane }) => {
                    const schedule = getBookingNotes(booking.message);
                    const arrival = formatBookingTime(schedule.arrival) || 'Time not set';
                    const departure = formatBookingTime(schedule.departure) || 'Time not set';
                    const conflict = unit.bookings.some(other => String(other.id) !== String(booking.id) && other.status !== 'cancelled' && bookingsOverlap(booking, other));
                    const fromFacebook = Number(booking.is_facebook_booking) === 1;
                    const suggestion = resource.suggestions.find(item => String(item.booking.id) === String(booking.id));
                    return <div role="button" tabIndex="0" key={booking.id}
                      className={`booking-calendar__bar booking-calendar__bar--${booking.status}${fromFacebook ? ' is-facebook-booking' : ''}${startsHere ? ' is-check-in' : ''}${endsHere ? ' is-check-out' : ''}${conflict ? ' is-conflict' : ''}${String(highlightedBookingId) === String(booking.id) ? ' is-booking-highlighted' : ''}`}
                      style={{ gridColumn: `${start + 1} / ${end + 2}`, gridRow: lane + 1 }}
                      data-calendar-booking-id={booking.id}
                      {...dragProps(booking)}
                      aria-label={`${booking.guest_name}, ${unit.name}, check-in ${formatBookingDate(booking.check_in)} at ${arrival}, check-out ${formatBookingDate(booking.check_out)} at ${departure}, ${statusLabels[booking.status]}${fromFacebook ? ', from Facebook Page' : ''}`}
                      title={`Check-in: ${formatBookingDate(booking.check_in)} at ${arrival} • Check-out: ${formatBookingDate(booking.check_out)} at ${departure}`}
                      onClick={() => selectBooking(booking)}
                      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectBooking(booking); } }}>
                      <span>{resource.priorities.has(String(booking.id)) && <strong className="booking-calendar__priority" title="Request order: oldest first">#{resource.priorities.get(String(booking.id))}</strong>}{booking.guest_name}{fromFacebook && <strong className="booking-calendar__source">Facebook</strong>}</span>
                      <small>{statusLabels[booking.status]} · {formatBookingDate(booking.check_in, true)} {arrival} – {formatBookingDate(booking.check_out, true)} {departure}</small>
                      {suggestion && <button type="button" className="booking-calendar__suggestion-move" disabled={moving} onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); moveBooking(booking, resource, suggestion.unit); }}>Move to {suggestion.unit.name}</button>}
                    </div>;
                  })}
                  {unitSuggestions.map(({ booking, unit: suggestedUnit, start, end }) => {
                    const turnover = sameDayTurnoverLabel(booking, suggestedUnit);
                    return <div className="booking-calendar__suggestion-preview" key={`suggestion-${booking.id}-${unit.key}`} style={{ gridColumn: `${start + 1} / ${end + 2}`, gridRow: 1 }} title={turnover || undefined}>
                      <span><strong>Suggested: #{resource.priorities.get(String(booking.id)) || 1} {booking.guest_name}</strong>{turnover && <small>{turnover}</small>}</span>
                      <button type="button" disabled={moving} onClick={() => moveBooking(booking, resource, suggestedUnit)}>Move here</button>
                    </div>;
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
      {floatingCard && createPortal(<div ref={floatingCardRef} popover="manual" className="calendar-floating-card" aria-hidden="true" style={{ left: floatingCard.x, top: floatingCard.y }}>
        <strong>{floatingCard.booking.guest_name}</strong>
        <span>{formatBookingDate(floatingCard.booking.check_in, true)}–{formatBookingDate(floatingCard.booking.check_out, true)}</span>
        <small>{dropRoom ? 'Release to move to this room' : 'Drag onto a room row'}</small>
      </div>, document.body)}
      <div className="booking-calendar__header">
        <div>
          <span className="admin-kicker">Reservation schedule</span>
          <h2 id="booking-calendar-heading">Booking Calendar</h2>
        </div>
        <div className="booking-calendar__legend" aria-label="Booking status legend">
          <button type="button" aria-pressed={statusFilter === 'all'} onClick={() => onStatusFilterChange('all')}>All</button>
          {['pending', 'confirmed', 'checked_in', 'no_show'].map(status => <button type="button" key={status} aria-pressed={statusFilter === status} onClick={() => onStatusFilterChange(status)}><i className={`booking-calendar__status-dot booking-calendar__status-dot--${status}`} />{statusLabels[status]}</button>)}
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
      <div className="calendar-move-tools">
        <p className="calendar-move-help">Drag a card onto a room row to move it, or open the card to choose a room. Overlapping requests: #1 is the oldest.</p>
        <div className="calendar-move-actions">
          <button type="button" className="calendar-undo-move" disabled={!canUndoRoomMove || moving} onClick={undoRoomMove} title="Temporary testing control">↶ Undo last move</button>
          <button type="button" className="calendar-save-moves" disabled={!canUndoRoomMove || moving} onClick={saveRoomMoves}>Save room changes</button>
        </div>
      </div>
      {moveNotice && <p className="admin-notice" role="status">{moveNotice}</p>}
      {canUndoRoomMove && <label className="notification-field">Optional message about saved accommodation changes (sent to affected guests)<textarea maxLength={1000} value={roomChangeNote} onChange={event => setRoomChangeNote(event.target.value)} /><small>Save room changes to send accommodation updates. Internal room-number moves do not send email.</small></label>}
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
      <div className="booking-calendar__legend booking-calendar-landscape__legend" aria-label="Filter landscape calendar by booking status">
        <button type="button" aria-pressed={statusFilter === 'all'} onClick={() => onStatusFilterChange('all')}>All</button>
        {['pending', 'confirmed', 'checked_in', 'no_show'].map(status => <button type="button" key={status} aria-pressed={statusFilter === status} onClick={() => onStatusFilterChange(status)}><i className={`booking-calendar__status-dot booking-calendar__status-dot--${status}`} />{statusLabels[status]}</button>)}
      </div>
      {resourceSummary}
      {renderCalendarGrid(' in landscape view', true)}
      {moveNotice && <p className="admin-notice" role="status">{moveNotice}</p>}
    </dialog>

    <dialog ref={dialogRef} className={`booking-calendar-dialog${landscapeOpen ? ' is-landscape' : ''}`} aria-labelledby="booking-calendar-dialog-title" onClose={() => setDialogContent(null)} onCancel={() => setDialogContent(null)}>
      {dialogContent?.type === 'booking' && (() => {
        const { booking } = dialogContent;
        const schedule = getBookingNotes(booking.message);
        return <>
          <div className="booking-calendar-dialog__header">
            <div><span className="admin-kicker">{booking.reference_code}</span>{Number(booking.is_facebook_booking) === 1 && <span className="booking-source booking-source--facebook">Facebook Page</span>}<h3 id="booking-calendar-dialog-title">{booking.guest_name}</h3></div>
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

    <dialog ref={moveWarningDialogRef} className="calendar-move-warning" aria-labelledby="calendar-move-warning-title" onClose={() => setMoveWarning(null)} onCancel={() => setMoveWarning(null)}>
      {moveWarning && <form method="dialog" onSubmit={event => event.preventDefault()}>
        <div className="calendar-move-warning__head">
          <div><span className="admin-kicker">Room move warning</span><h3 id="calendar-move-warning-title">Review before moving</h3></div>
          <button type="button" onClick={() => setMoveWarning(null)} aria-label="Close warning">×</button>
        </div>
        <p><strong>{moveWarning.booking.guest_name}</strong>: {moveWarning.booking.calendar_unit || moveWarning.booking.stay_type || 'Current room'} → {moveWarning.unit.name}</p>
        <ul>{moveWarning.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
        <div className="calendar-move-warning__actions">
          <button type="button" onClick={() => setMoveWarning(null)}>Cancel</button>
          {moveWarning.canProceed && <button type="button" className="is-primary" disabled={moving} onClick={() => moveBooking(moveWarning.booking, moveWarning.resource, moveWarning.unit, true)}>{moving ? 'Moving…' : 'Confirm move'}</button>}
        </div>
      </form>}
    </dialog>
  </>;
}

function BookingRequestModal({ booking, onClose, updateStatus, updateDates }) {
  const dialogRef = useRef(null);
  const [dates, setDates] = useState({ checkIn: '', checkOut: '' });
  const [dateSaving, setDateSaving] = useState(false);
  const [dateError, setDateError] = useState('');
  const [dateNote, setDateNote] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (booking && dialog && !dialog.open) dialog.showModal();
  }, [booking]);
  useEffect(() => {
    setDates({ checkIn: booking?.check_in || '', checkOut: booking?.check_out || '' });
    setDateError('');
    setDateNote('');
  }, [booking?.id, booking?.check_in, booking?.check_out]);

  if (!booking) return null;
  const nights = getBookingNights({ check_in: dates.checkIn, check_out: dates.checkOut });
  const request = getBookingNotes(booking.message);
  const datesChanged = dates.checkIn !== booking.check_in || dates.checkOut !== booking.check_out;
  const saveDates = async event => {
    event.preventDefault();
    if (!dates.checkIn || !dates.checkOut || dates.checkOut <= dates.checkIn) {
      setDateError('Check-out must be after check-in.');
      return;
    }
    setDateSaving(true);
    setDateError('');
    try {
      await updateDates(booking, dates.checkIn, dates.checkOut, dateNote);
    } catch (error) {
      setDateError(error.message);
    } finally {
      setDateSaving(false);
    }
  };
  return <dialog ref={dialogRef} className="admin-request-modal" aria-labelledby="request-modal-title" onClose={onClose} onCancel={onClose}>
    <div className="admin-request-modal__head">
      <div><span className="admin-kicker">Reservation · {booking.reference_code}</span>{Number(booking.is_facebook_booking) === 1 && <span className="booking-source booking-source--facebook">Facebook Page</span>}<h2 id="request-modal-title">View &amp; manage</h2></div>
      <button type="button" className="admin-request-modal__close" onClick={onClose} aria-label="Close request details">×</button>
    </div>
    <div className={`admin-request-modal__guest admin-request-modal__guest--${booking.status}`}>
      <div><span>Guest</span><strong>{booking.guest_name}</strong><small>{booking.guests} {Number(booking.guests) === 1 ? 'guest' : 'guests'}</small></div>
      <span className={`booking-status booking-status--${booking.status}`}>{statusLabels[booking.status]}</span>
    </div>
    <div className="admin-request-modal__layout">
      <div className="admin-request-modal__main">
        <form className="request-panel request-panel--stay" aria-labelledby="stay-summary-title" onSubmit={saveDates}>
          <div className="request-panel__heading"><span>Stay summary</span><strong id="stay-summary-title">{booking.stay_type || 'Flexible stay'}</strong></div>
          <div className="request-date-route">
            <label><span>Check-in</span><input type="date" value={dates.checkIn} onChange={event => setDates(current => ({ ...current, checkIn: event.target.value }))} required /></label>
            <div className="request-date-route__line"><span>{nights ? `${nights + 1} ${nights + 1 === 1 ? 'day' : 'days'} · ${nights} ${nights === 1 ? 'night' : 'nights'}` : 'Stay'}</span></div>
            <label><span>Check-out</span><input type="date" min={dates.checkIn || undefined} value={dates.checkOut} onChange={event => setDates(current => ({ ...current, checkOut: event.target.value }))} required /></label>
          </div>
          <div className="request-date-editor__actions">
            {dateError && <span role="alert">{dateError}</span>}
            <button type="submit" disabled={!datesChanged || dateSaving}>{dateSaving ? 'Saving…' : 'Save dates'}</button>
          </div>
          {datesChanged && <label className="notification-field">Optional message about these dates (sent to guest)<textarea maxLength={1000} value={dateNote} onChange={event => setDateNote(event.target.value)} /><small>Saving sends the updated dates when email notifications are enabled.</small></label>}
          {(request.arrival || request.departure) && <div className="request-times">
            <AdminIcon name="clock" />
            <span>Arrival <strong>{formatBookingTime(request.arrival) || 'Not set'}</strong></span>
            <span>Departure <strong>{formatBookingTime(request.departure) || 'Not set'}</strong></span>
          </div>}
        </form>
        <section className="request-panel">
          <div className="request-panel__heading"><span>Request details</span><strong>Guest preferences</strong></div>
          <dl className="request-facts">
            <div><dt>Requested activity</dt><dd>{booking.service_name || 'None selected'}</dd></div>
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

function BookingsView({ bookings, accommodations, notice, setNotice, updateStatus, updateDates, ManualBookingModal, csrfToken, onBookingSaved, navigationIntent, canUndoRoomMove }) {
  const moveBooking = async (booking, stayId, roomIndex, confirmWarnings = false) => {
    const response = await fetch('/api/admin/bookings.php', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ action: 'move_room', id: Number(booking.id), stay_id: Number(stayId), room_index: roomIndex, expected_updated_at: booking.updated_at, confirm_warnings: confirmWarnings }),
    });
    const data = await response.json();
    if (!response.ok && data.requires_confirmation) return data;
    if (!response.ok) {
      const error = new Error(data.message || 'Could not move this booking.');
      error.moveWarnings = Array.isArray(data.warnings) ? data.warnings : [error.message];
      throw error;
    }
    await onBookingSaved(data);
    return data;
  };
  const saveRoomMoves = async (staffNote = '') => {
    const response = await fetch('/api/admin/bookings.php', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ action: 'save_room_moves', staff_note: staffNote }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Could not save the room changes.');
    await onBookingSaved(data);
    return data;
  };
  const undoRoomMove = async () => {
    const response = await fetch('/api/admin/bookings.php', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ action: 'undo_room_move' }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Could not undo the room move.');
    await onBookingSaved(data);
    return data;
  };
  const [manualBookingOpen, setManualBookingOpen] = useState(false);
  const [bookingChildView, setBookingChildView] = useState('requests');
  const [calendarFilter, setCalendarFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeQuery, setActiveQuery] = useState('');
  const [historyFilter, setHistoryFilter] = useState('all');
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyDateMode, setHistoryDateMode] = useState('all');
  const [historyDateValue, setHistoryDateValue] = useState('');
  const [historyDateEnd, setHistoryDateEnd] = useState('');
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [highlightedBookingId, setHighlightedBookingId] = useState(null);
  const [highlightedCalendarBookingId, setHighlightedCalendarBookingId] = useState(null);
  const highlightTimerRef = useRef(null);
  const calendarHighlightTimerRef = useRef(null);
  const calendarModalTimerRef = useRef(null);
  const calendarScrollEndRef = useRef(null);
  useEffect(() => {
    if (!navigationIntent) return;
    setManualBookingOpen(Boolean(navigationIntent.openManualBooking));
    const id = navigationIntent.bookingId ? String(navigationIntent.bookingId) : null;
    const targetBooking = id ? bookings.find(item => String(item.id) === id) : null;
    const targetIsHistory = terminalBookingStatuses.includes(targetBooking?.status);
    const focusCalendar = navigationIntent.focus === 'calendar';
    if (focusCalendar) {
      setBookingChildView('requests');
      setCalendarFilter(targetBooking?.status || navigationIntent.status || 'all');
    } else if (targetIsHistory) {
      setBookingChildView('history');
      setHistoryFilter('all');
      setHistoryQuery('');
    } else {
      setBookingChildView('requests');
      setActiveFilter(navigationIntent.status || 'all');
      setActiveQuery('');
    }
    if (id && focusCalendar) setHighlightedCalendarBookingId(id);
    else if (id) setHighlightedBookingId(id);
    const timer = window.setTimeout(() => {
      const targetId = targetIsHistory && window.matchMedia('(max-width: 700px)').matches ? `booking-mobile-${id}` : `booking-${id}`;
      const target = focusCalendar ? document.querySelector('.booking-calendar') : id ? document.getElementById(targetId) : document.getElementById('bookings-heading');
      if (id && !focusCalendar) target?.focus({ preventScroll: true });
      target?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: focusCalendar ? 'start' : id ? 'center' : 'start' });
    }, 0);
    if (id && focusCalendar) calendarHighlightTimerRef.current = window.setTimeout(() => setHighlightedCalendarBookingId(null), 2500);
    else if (id) highlightTimerRef.current = window.setTimeout(() => setHighlightedBookingId(null), 2500);
    return () => window.clearTimeout(timer);
  }, [navigationIntent]);
  const visibleActiveBookings = useMemo(() => {
    return bookings.filter(item => (
      !terminalBookingStatuses.includes(item.status)
      && (activeFilter === 'all' || item.status === activeFilter)
      && `${item.guest_name} ${item.reference_code} ${item.email} ${item.phone || ''} ${item.stay_type || ''} ${item.service_name || ''} ${item.message || ''}`.toLowerCase().includes(activeQuery.toLowerCase())
    )).sort((a, b) => {
      if (activeFilter === 'all') {
        const statusOrder = ['pending', 'confirmed', 'checked_in'];
        const statusDifference = statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
        if (statusDifference) return statusDifference;
      }
      return a.check_in.localeCompare(b.check_in)
        || a.check_out.localeCompare(b.check_out)
        || String(a.id).localeCompare(String(b.id));
    });
  }, [bookings, activeFilter, activeQuery]);
  const historyYears = useMemo(() => [...new Set(bookings
    .filter(item => terminalBookingStatuses.includes(item.status) && /^\d{4}-/.test(item.check_in || ''))
    .map(item => item.check_in.slice(0, 4)))].sort((a, b) => b.localeCompare(a)), [bookings]);
  const visibleHistoryBookings = useMemo(() => bookings.filter(item => (
    terminalBookingStatuses.includes(item.status)
    && (historyFilter === 'all' || item.status === historyFilter)
    && (historyDateMode === 'all'
      || (historyDateMode === 'range'
        ? (!historyDateValue || item.check_in >= historyDateValue) && (!historyDateEnd || item.check_in <= historyDateEnd)
        : !historyDateValue
          || (historyDateMode === 'date' && item.check_in === historyDateValue)
          || (historyDateMode === 'month' && item.check_in?.startsWith(historyDateValue))
          || (historyDateMode === 'year' && item.check_in?.startsWith(`${historyDateValue}-`))))
    && `${item.guest_name} ${item.reference_code} ${item.email} ${item.phone || ''} ${item.stay_type || ''} ${item.service_name || ''} ${item.message || ''}`.toLowerCase().includes(historyQuery.toLowerCase())
  )).sort((a, b) => (
    (b.check_out || '').localeCompare(a.check_out || '')
    || (b.check_in || '').localeCompare(a.check_in || '')
    || String(b.id).localeCompare(String(a.id))
  )), [bookings, historyFilter, historyQuery, historyDateMode, historyDateValue, historyDateEnd]);
  const historySummary = useMemo(() => {
    const uniqueGuests = new Set(visibleHistoryBookings.map(item => (item.email || item.guest_name || '').trim().toLowerCase()).filter(Boolean));
    const checkIns = visibleHistoryBookings.map(item => item.check_in).filter(Boolean).sort();
    const checkOuts = visibleHistoryBookings.map(item => item.check_out).filter(Boolean).sort();
    return {
      bookings: visibleHistoryBookings.length,
      uniqueGuests: uniqueGuests.size,
      partyGuests: visibleHistoryBookings.reduce((total, item) => total + (Number(item.guests) || 0), 0),
      completed: visibleHistoryBookings.filter(item => item.status === 'completed').length,
      noShow: visibleHistoryBookings.filter(item => item.status === 'no_show').length,
      cancelled: visibleHistoryBookings.filter(item => item.status === 'cancelled').length,
      firstCheckIn: checkIns[0] || '',
      lastCheckOut: checkOuts.at(-1) || '',
    };
  }, [visibleHistoryBookings]);

  const bookingUnitName = booking => {
    const roomIndex = Number(booking.room_index);
    if (!Number.isInteger(roomIndex) || roomIndex < 1) return 'Not assigned';
    const accommodation = accommodations.find(item => Number(item.id) === Number(booking.stay_id))
      || accommodations.find(item => item.name.toLowerCase() === String(booking.stay_type || '').toLowerCase());
    const accommodationName = (accommodation?.name || booking.stay_type || '').trim();
    if (!accommodationName) return 'Not assigned';
    return Number(accommodation?.room_count) === 1 ? accommodationName : `${accommodationName} #${roomIndex}`;
  };

  const exportBookingHistory = () => {
    const dateFilter = historyDateMode === 'all' ? 'All dates'
      : historyDateMode === 'range' ? `${historyDateValue || 'Beginning'} to ${historyDateEnd || 'Latest'}`
        : `${historyDateMode}: ${historyDateValue || 'Not selected'}`;
    const summaryRows = [
      ['Booking History Summary', ''],
      ['Generated', new Date().toLocaleString('en-PH')],
      ['Status filter', historyFilter === 'all' ? 'All history' : statusLabels[historyFilter]],
      ['Date filter (check-in)', dateFilter],
      ['Search', historyQuery || 'None'],
      ['Matching bookings', historySummary.bookings],
      ['Unique guests', historySummary.uniqueGuests],
      ['Total party guests', historySummary.partyGuests],
      ['Completed', historySummary.completed],
      ['No show', historySummary.noShow],
      ['Cancelled', historySummary.cancelled],
      ['Coverage', historySummary.firstCheckIn ? `${historySummary.firstCheckIn} to ${historySummary.lastCheckOut}` : 'No matching dates'],
    ];
    const detailHeaders = ['Reference', 'Guest', 'Email', 'Phone', 'Stay', 'Accommodation / room', 'Party', 'Check-in', 'Check-out', 'Status', 'Source'];
    const bookingExportRow = booking => [
      booking.reference_code,
      booking.guest_name,
      booking.email,
      booking.phone || '',
      booking.stay_type || booking.service_name || 'Flexible stay',
      bookingUnitName(booking),
      Number(booking.guests) || 0,
      booking.check_in,
      booking.check_out,
      statusLabels[booking.status] || booking.status,
      Number(booking.is_facebook_booking) === 1 ? 'Facebook Page' : 'Website / Manual',
    ];
    const detailGroups = terminalBookingStatuses.map(status => ({
      status,
      rows: visibleHistoryBookings.filter(booking => booking.status === status).map(bookingExportRow),
    })).filter(group => group.rows.length > 0);
    const summaryColumns = '<Column ss:AutoFitWidth="0" ss:Width="145"/><Column ss:AutoFitWidth="0" ss:Width="250"/>';
    const detailWidths = [110, 145, 190, 110, 155, 110, 55, 90, 90, 85, 105];
    const detailColumns = detailWidths.map(width => `<Column ss:AutoFitWidth="0" ss:Width="${width}"/>`).join('');
    const detailSections = detailGroups.map((group, index) => `<Row ss:Height="24"><Cell ss:MergeAcross="10" ss:StyleID="Section${group.status}"><Data ss:Type="String">${escapeSpreadsheetXml(statusLabels[group.status])} (${group.rows.length})</Data></Cell></Row>${spreadsheetRow(detailHeaders, 'Header')}${group.rows.map(row => spreadsheetRow(row, 'Body')).join('')}${index < detailGroups.length - 1 ? '<Row ss:Height="10"/>' : ''}`).join('');
    const workbook = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="10"/></Style><Style ss:ID="Header"><Alignment ss:Vertical="Center" ss:WrapText="1"/><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1"/><Interior ss:Color="#E8F0EC" ss:Pattern="Solid"/></Style><Style ss:ID="Body"><Alignment ss:Vertical="Center" ss:WrapText="1"/><Font ss:FontName="Arial" ss:Size="10"/></Style><Style ss:ID="Sectioncompleted"><Alignment ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#53635E" ss:Pattern="Solid"/></Style><Style ss:ID="Sectionno_show"><Alignment ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#75551F" ss:Pattern="Solid"/></Style><Style ss:ID="Sectioncancelled"><Alignment ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#A9473F" ss:Pattern="Solid"/></Style></Styles><Worksheet ss:Name="Summary"><Table>${summaryColumns}${summaryRows.map((row, index) => spreadsheetRow(row, index === 0 ? 'Header' : 'Body')).join('')}</Table></Worksheet><Worksheet ss:Name="Booking History"><Table>${detailColumns}${detailSections}</Table></Worksheet></Workbook>`;
    const url = URL.createObjectURL(new Blob([`\uFEFF${workbook}`], { type: 'application/vnd.ms-excel;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `odidepse-booking-history-${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  useEffect(() => () => {
    window.clearTimeout(highlightTimerRef.current);
    window.clearTimeout(calendarHighlightTimerRef.current);
    window.clearTimeout(calendarModalTimerRef.current);
    if (calendarScrollEndRef.current) window.removeEventListener('scrollend', calendarScrollEndRef.current);
  }, []);

  const viewBookingFromCalendar = bookingId => {
    const booking = bookings.find(item => String(item.id) === String(bookingId));
    if (terminalBookingStatuses.includes(booking?.status)) {
      setBookingChildView('history');
      setHistoryFilter('all');
      setHistoryQuery('');
    } else {
      setBookingChildView('requests');
      setActiveFilter('all');
      setActiveQuery('');
    }
    setHighlightedBookingId(String(bookingId));
    window.clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = window.setTimeout(() => setHighlightedBookingId(null), 2500);
    window.clearTimeout(calendarModalTimerRef.current);
    if (calendarScrollEndRef.current) window.removeEventListener('scrollend', calendarScrollEndRef.current);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const targetId = terminalBookingStatuses.includes(booking?.status) && window.matchMedia('(max-width: 700px)').matches ? `booking-mobile-${bookingId}` : `booking-${bookingId}`;
      const target = document.getElementById(targetId);
      const openBookingModal = () => {
        window.clearTimeout(calendarModalTimerRef.current);
        if (calendarScrollEndRef.current) window.removeEventListener('scrollend', calendarScrollEndRef.current);
        calendarScrollEndRef.current = null;
        setSelectedBookingId(bookingId);
      };
      if (!target) {
        openBookingModal();
        return;
      }
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const targetTop = target.getBoundingClientRect().top + window.scrollY - (window.innerHeight - target.offsetHeight) / 2;
      if (reducedMotion || Math.abs(window.scrollY - targetTop) < 2) {
        target.scrollIntoView({ behavior: 'auto', block: 'center' });
        openBookingModal();
        return;
      }
      calendarScrollEndRef.current = openBookingModal;
      window.addEventListener('scrollend', openBookingModal, { once: true });
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      calendarModalTimerRef.current = window.setTimeout(openBookingModal, 1200);
    }));
  };

  const viewBookingInCalendar = booking => {
    setBookingChildView('requests');
    setCalendarFilter(terminalBookingStatuses.includes(booking.status) ? booking.status : 'all');
    setHighlightedCalendarBookingId(String(booking.id));
    window.clearTimeout(calendarHighlightTimerRef.current);
    calendarHighlightTimerRef.current = window.setTimeout(() => setHighlightedCalendarBookingId(null), 2500);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => document.querySelector('.booking-calendar')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })));
  };

  const renderBookingCard = (booking, showPhone = false, idPrefix = 'booking') => {
    const nights = getBookingNights(booking);
    return <article className={`booking-card booking-card--calendar-link${highlightedBookingId === String(booking.id) ? ' is-calendar-highlighted' : ''}`} id={`${idPrefix}-${booking.id}`} key={booking.id}
      tabIndex="0" role="button" aria-label={`Show ${booking.guest_name}'s booking in the calendar`}
      onClick={event => { if (!event.target.closest('button,select,input,label,a')) viewBookingInCalendar(booking); }}
      onKeyDown={event => { if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) { event.preventDefault(); viewBookingInCalendar(booking); } }}>
      <div className="booking-card__top">
        <div className="booking-card__reference"><span>{booking.reference_code}</span>{Number(booking.is_facebook_booking) === 1 && <span className="booking-source booking-source--facebook">Facebook Page</span>}</div>
        <span className={`booking-status booking-status--${booking.status}`}>{statusLabels[booking.status]}</span>
      </div>
      <div className="booking-card__guest">
        <div><strong>{booking.guest_name}</strong><small>{booking.email}</small>{showPhone && <small>{booking.phone || 'No phone provided'}</small>}</div>
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
  };

  const renderBookingCards = (items, filter, showPhone, emptyTitle, emptyMessage, keyPrefix) => <div className="booking-table booking-card-grid">
    {items.flatMap((booking, index) => {
      const card = renderBookingCard(booking, showPhone, keyPrefix === 'history' ? 'booking-mobile' : 'booking');
      const startsStatusGroup = filter === 'all' && (index === 0 || items[index - 1].status !== booking.status);
      return startsStatusGroup
        ? [<h3 className={`booking-status-group-heading booking-status-group-heading--${booking.status}`} key={`${keyPrefix}-${booking.status}-heading`}>{statusLabels[booking.status]}</h3>, card]
        : [card];
    })}
    {items.length === 0 && <div className="empty-state"><AdminIcon name="calendar" /><h3>{emptyTitle}</h3><p>{emptyMessage}</p></div>}
  </div>;

  return <>
    <nav className="booking-subnav" aria-label="Booking pages">
      <button type="button" className={bookingChildView === 'requests' ? 'active' : ''} aria-current={bookingChildView === 'requests' ? 'page' : undefined} onClick={() => setBookingChildView('requests')}>Booking Requests</button>
      <button type="button" className={bookingChildView === 'history' ? 'active' : ''} aria-current={bookingChildView === 'history' ? 'page' : undefined} onClick={() => setBookingChildView('history')}>Booking History</button>
    </nav>
    {bookingChildView === 'requests' && <>
    <BookingCalendar bookings={bookings} accommodations={accommodations} statusFilter={calendarFilter} onStatusFilterChange={setCalendarFilter} onViewBooking={viewBookingFromCalendar} highlightedBookingId={highlightedCalendarBookingId} onMoveBooking={moveBooking} canUndoRoomMove={canUndoRoomMove} onUndoRoomMove={undoRoomMove} onSaveRoomMoves={saveRoomMoves} />
    <section className="booking-board admin-view" aria-labelledby="bookings-heading">
    <div className="booking-board__head">
      <div className="booking-board__summary"><div><h2 id="bookings-heading">Booking requests</h2><p>{visibleActiveBookings.length} {visibleActiveBookings.length === 1 ? 'reservation' : 'reservations'}</p></div><button type="button" className="filter-row__add-booking booking-board__mobile-add" onClick={() => setManualBookingOpen(true)}>+ Add booking</button></div>
      <label className="admin-search"><AdminIcon name="search" /><input aria-label="Search active bookings" placeholder="Search guest or reference" value={activeQuery} onChange={event => setActiveQuery(event.target.value)} /></label>
    </div>
    <div className="filter-row">{['all', 'pending', 'confirmed', 'checked_in'].map(value => <button type="button" key={value} className={activeFilter === value ? 'active' : ''} onClick={() => setActiveFilter(value)}>{value === 'all' ? 'All' : statusLabels[value]}</button>)}<button type="button" className="filter-row__add-booking" onClick={() => setManualBookingOpen(true)}>+ Add booking</button></div>
    {notice && <p className="admin-notice" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss notification">×</button></p>}
    <div className="booking-table booking-card-grid">
      {visibleActiveBookings.flatMap((booking, index) => {
        const nights = getBookingNights(booking);
        const card = <article className={`booking-card booking-card--calendar-link${highlightedBookingId === String(booking.id) ? ' is-calendar-highlighted' : ''}`} id={`booking-${booking.id}`} key={booking.id}
          tabIndex="0" role="button" aria-label={`Show ${booking.guest_name}'s booking in the calendar`}
          onClick={event => { if (!event.target.closest('button,select,input,label,a')) viewBookingInCalendar(booking); }}
          onKeyDown={event => { if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) { event.preventDefault(); viewBookingInCalendar(booking); } }}>
          <div className="booking-card__top">
            <div className="booking-card__reference"><span>{booking.reference_code}</span>{Number(booking.is_facebook_booking) === 1 && <span className="booking-source booking-source--facebook">Facebook Page</span>}</div>
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
        const startsStatusGroup = activeFilter === 'all' && (index === 0 || visibleActiveBookings[index - 1].status !== booking.status);
        return startsStatusGroup
          ? [<h3 className={`booking-status-group-heading booking-status-group-heading--${booking.status}`} key={`${booking.status}-heading`}>{statusLabels[booking.status]}</h3>, card]
          : [card];
      })}
      {visibleActiveBookings.length === 0 && <div className="empty-state"><AdminIcon name="calendar" /><h3>No active reservations here.</h3><p>New booking requests will appear automatically.</p></div>}
    </div>
    <BookingRequestModal booking={bookings.find(item => item.id === selectedBookingId) || null} onClose={() => setSelectedBookingId(null)} updateStatus={updateStatus} updateDates={updateDates} />
    {manualBookingOpen && <ManualBookingModal open onClose={() => setManualBookingOpen(false)} csrfToken={csrfToken} onSaved={data => { setActiveFilter('pending'); setActiveQuery(''); onBookingSaved(data); }} />}
    </section>
    </>}
    {bookingChildView === 'history' && <>
    <section className="booking-board booking-history admin-view" aria-labelledby="booking-history-heading">
      <div className="booking-board__head">
        <div className="booking-board__summary"><h2 id="booking-history-heading">Booking History</h2><p>{visibleHistoryBookings.length} past {visibleHistoryBookings.length === 1 ? 'reservation' : 'reservations'}</p></div>
        <div className="booking-history-head-actions"><label className="admin-search"><AdminIcon name="search" /><input aria-label="Search booking history" placeholder="Search past guest or reference" value={historyQuery} onChange={event => setHistoryQuery(event.target.value)} /></label><button type="button" className="booking-history-export" disabled={visibleHistoryBookings.length === 0} onClick={exportBookingHistory}>Export to Excel</button></div>
      </div>
      <div className="booking-history-date-filters">
        <label><span>Filter by check-in</span><select value={historyDateMode} onChange={event => { setHistoryDateMode(event.target.value); setHistoryDateValue(''); setHistoryDateEnd(''); }}><option value="all">All dates</option><option value="date">Exact date</option><option value="month">Month</option><option value="year">Year</option><option value="range">Date range</option></select></label>
        {historyDateMode === 'date' && <label><span>Date</span><input type="date" value={historyDateValue} onChange={event => setHistoryDateValue(event.target.value)} /></label>}
        {historyDateMode === 'month' && <label><span>Month</span><input type="month" value={historyDateValue} onChange={event => setHistoryDateValue(event.target.value)} /></label>}
        {historyDateMode === 'year' && <label><span>Year</span><select value={historyDateValue} onChange={event => setHistoryDateValue(event.target.value)}><option value="">Choose year</option>{historyYears.map(year => <option key={year} value={year}>{year}</option>)}</select></label>}
        {historyDateMode === 'range' && <><label><span>From</span><input type="date" value={historyDateValue} max={historyDateEnd || undefined} onChange={event => setHistoryDateValue(event.target.value)} /></label><label><span>To</span><input type="date" value={historyDateEnd} min={historyDateValue || undefined} onChange={event => setHistoryDateEnd(event.target.value)} /></label></>}
        {historyDateMode !== 'all' && <button type="button" onClick={() => { setHistoryDateMode('all'); setHistoryDateValue(''); setHistoryDateEnd(''); }}>Show all dates</button>}
      </div>
      <div className="filter-row">{['all', ...terminalBookingStatuses].map(value => <button type="button" key={value} className={historyFilter === value ? 'active' : ''} onClick={() => setHistoryFilter(value)}>{value === 'all' ? 'All history' : statusLabels[value]}</button>)}</div>
      <div className="booking-history-summary" aria-live="polite">
        <article><span>Bookings</span><strong>{historySummary.bookings}</strong></article>
        <article><span>Unique guests</span><strong>{historySummary.uniqueGuests}</strong></article>
        <article><span>Total party guests</span><strong>{historySummary.partyGuests}</strong></article>
        <article><span>Completed</span><strong>{historySummary.completed}</strong></article>
        <article><span>No show</span><strong>{historySummary.noShow}</strong></article>
        <article><span>Cancelled</span><strong>{historySummary.cancelled}</strong></article>
      </div>
      {historySummary.firstCheckIn && <p className="booking-history-coverage">Showing stays from {formatBookingDate(historySummary.firstCheckIn)} through {formatBookingDate(historySummary.lastCheckOut)}.</p>}
      <div className="booking-history-table-wrap">
        <table className="booking-history-table">
          <thead><tr><th>Reference</th><th>Guest</th><th>Contact</th><th>Stay</th><th>Accommodation / room</th><th>Party</th><th>Check-in</th><th>Check-out</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {visibleHistoryBookings.map(booking => <tr key={booking.id} id={`booking-${booking.id}`} className={highlightedBookingId === String(booking.id) ? 'is-calendar-highlighted' : ''}>
              <td><strong>{booking.reference_code}</strong>{Number(booking.is_facebook_booking) === 1 && <small>Facebook Page</small>}</td>
              <td><strong>{booking.guest_name}</strong></td>
              <td><a href={`mailto:${booking.email}`}>{booking.email}</a><small>{booking.phone || 'No phone provided'}</small></td>
              <td>{booking.stay_type || booking.service_name || 'Flexible stay'}</td>
              <td>{bookingUnitName(booking)}</td>
              <td>{booking.guests}</td>
              <td>{formatBookingDate(booking.check_in, true)}</td>
              <td>{formatBookingDate(booking.check_out, true)}</td>
              <td><span className={`booking-status booking-status--${booking.status}`}>{statusLabels[booking.status]}</span></td>
              <td><div className="booking-history-table__actions"><BookingStatusActions booking={booking} updateStatus={updateStatus} /><button className="booking-history-view" type="button" onClick={() => setSelectedBookingId(booking.id)}>View</button></div></td>
            </tr>)}
            {visibleHistoryBookings.length === 0 && <tr><td className="booking-history-table__empty" colSpan="10"><strong>No booking history found.</strong><span>Completed, no-show, and cancelled bookings will appear here.</span></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="booking-history-cards">{renderBookingCards(visibleHistoryBookings, 'history', true, 'No booking history found.', 'Completed, no-show, and cancelled bookings will appear here.', 'history')}</div>
    </section>
    <BookingRequestModal booking={bookings.find(item => item.id === selectedBookingId) || null} onClose={() => setSelectedBookingId(null)} updateStatus={updateStatus} updateDates={updateDates} />
    </>}
  </>;
}

function GuestsView({ bookings }) {
  const [query, setQuery] = useState('');
  const guests = useMemo(() => {
    const grouped = new Map();
    bookings.forEach(booking => {
      const email = String(booking.email || '').trim();
      const phone = String(booking.phone || '').trim();
      const guestName = String(booking.guest_name || 'Guest').trim();
      const key = email ? `email:${email.toLowerCase()}` : phone ? `phone:${phone.replace(/\D/g, '')}` : `name:${guestName.toLowerCase()}`;
      const existing = grouped.get(key);
      const isLatest = !existing || booking.created_at > existing.createdAt;
      grouped.set(key, {
        key,
        name: isLatest ? guestName : existing.name,
        email: isLatest ? (email || existing?.email || '') : (existing?.email || email),
        phone: isLatest ? (phone || existing?.phone || '') : (existing?.phone || phone),
        totalBookings: (existing?.totalBookings || 0) + 1,
        latestStay: isLatest ? (booking.stay_type || 'Flexible stay') : existing.latestStay,
        createdAt: isLatest ? booking.created_at : existing.createdAt,
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
      {guests.map(guest => <article className="guest-row" key={guest.key}>
        <div className="guest-name"><i>{guest.name.charAt(0).toUpperCase()}</i><strong>{guest.name}</strong></div>
        <div className="guest-contact">{guest.email && <strong><a href={`mailto:${guest.email}`}>{guest.email}</a></strong>}{guest.phone && <small><a href={`tel:${guest.phone.replace(/[^\d+]/g, '')}`}>{guest.phone}</a></small>}{!guest.email && !guest.phone && <small>No contact information</small>}</div>
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
  const [canUndoRoomMove, setCanUndoRoomMove] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');
  const [emailFailures, setEmailFailures] = useState(0);
  const [emailSetupRequired, setEmailSetupRequired] = useState(false);
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
      setCanUndoRoomMove(Boolean(data.can_undo_room_move));
      setEmailFailures(Number(data.email_failures || 0));
      setEmailSetupRequired(Boolean(data.email_setup_required));
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => { load(); }, [load]);
  useVisibilityPolling(load, { enabled: ['dashboard', 'bookings', 'stays', 'services', 'facebook'].includes(activeView) });
  useEffect(() => { document.title = `${navItems.find(item => item.id === activeView)?.label} · Odidepse Admin`; }, [activeView]);

  const updateStatus = async (id, status, details = {}) => {
    try {
      const response = await fetch('/api/admin/bookings.php', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ id: Number(id), status, ...details }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Update failed.');
      await load();
      setNotice(`Booking ${data.reference} updated. Customer email: ${data.notification?.customer?.replaceAll('_', ' ') || 'not queued'}.`);
    } catch (error) {
      setNotice(error.message);
      throw error;
    }
  };

  const updateDates = async (booking, checkIn, checkOut, staffNote = '') => {
    const response = await fetch('/api/admin/bookings.php', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ action: 'update_dates', id: Number(booking.id), check_in: checkIn, check_out: checkOut, staff_note: staffNote, expected_updated_at: booking.updated_at }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Could not update the booking dates.');
    await load();
    setNotice(`Booking ${data.reference} dates updated.`);
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
      {emailSetupRequired && <p className="notification-failure-banner" role="status">Email setup is incomplete. Bookings remain available; notifications will start after the database setup is completed.</p>}
      {emailFailures > 0 && <p className="notification-failure-banner" role="status">{emailFailures} email deliveries need attention. <button type="button" onClick={() => navigate('notifications')}>Open delivery log</button></p>}
      {activeView === 'dashboard' && <header><div><span className="admin-kicker">Daily operations</span><h1>Good day, {user.display_name.split(' ')[0]}.</h1></div><div className="admin-avatar">{user.display_name.charAt(0).toUpperCase()}</div></header>}
      <nav className="admin-mobile-nav" aria-label="Admin sections">{navItems.map(item => <button type="button" key={item.id} className={activeView === item.id ? 'active' : ''} aria-current={activeView === item.id ? 'page' : undefined} title={item.label} onClick={() => navigate(item.id)}><AdminIcon name={item.icon} /><span className="admin-mobile-nav__label">{item.label}</span></button>)}</nav>
      {loading ? <div className="admin-section-loading"><span>Loading resort data…</span></div> : <>
        {activeView === 'notifications' && <Notifications csrfToken={csrfToken} onLogout={onLogout} onRefresh={load} />}
        {activeView === 'dashboard' && <OperationsDashboard bookings={bookings} notice={notice} setNotice={setNotice} onOpenBookings={intent => { navigate('bookings'); setNavigationIntent(intent); }} />}
        {activeView === 'bookings' && <BookingsView navigationIntent={navigationIntent} bookings={bookings} accommodations={accommodations} notice={notice} setNotice={setNotice} updateStatus={updateStatus} updateDates={updateDates} ManualBookingModal={ManualBookingModal} csrfToken={csrfToken} canUndoRoomMove={canUndoRoomMove} onBookingSaved={async data => { if (data.reference) setNotice(`Booking ${data.reference} saved.`); await load(); }} />}
        {['stays','services'].includes(activeView) && <ResortManager key={activeView} kind={activeView} csrfToken={csrfToken} onLogout={onLogout} bookings={bookings} />}
        {activeView === 'guests' && <GuestsView bookings={bookings} />}
        {activeView === 'facebook' && <FacebookAutomations csrfToken={csrfToken} onLogout={onLogout} BookingRequestModal={BookingRequestModal} bookings={bookings} updateStatus={updateStatus} updateDates={updateDates} onOpenBooking={id => {
          const booking = bookings.find(item => Number(item.id) === Number(id));
          navigate('bookings');
          setNavigationIntent({ bookingId: id, focus: 'calendar', status: ['no_show', 'cancelled'].includes(booking?.status) ? booking.status : 'all' });
        }} />}
      </>}
    </main>
  </div>;
}

export default function AdminPage({ ManualBookingModal }) {
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
