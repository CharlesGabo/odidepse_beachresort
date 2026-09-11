import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ResortManager from './ResortManager.jsx';

const statusLabels = {
  pending: 'New request',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

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
  const weekEnd = weekDays[6];
  const segments = bookings.flatMap(booking => {
    const checkIn = parseCalendarDate(booking.check_in);
    const checkOut = parseCalendarDate(booking.check_out);
    if (!checkIn || !checkOut || checkOut < weekStart || checkIn > weekEnd) return [];

    return [{
      booking,
      start: Math.max(0, calendarDayDifference(weekStart, checkIn)),
      end: Math.min(6, calendarDayDifference(weekStart, checkOut)),
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

function getBookingNotes(message = '') {
  const arrival = message.match(/Preferred arrival:\s*(\d{1,2}:\d{2})/i)?.[1] || null;
  const departure = message.match(/Preferred departure:\s*(\d{1,2}:\d{2})/i)?.[1] || null;
  const activities = message.match(/Requested rental activities:\s*([^\n]+)/i)?.[1]?.trim() || null;
  const note = message
    .replace(/Preferred arrival:\s*\d{1,2}:\d{2}/gi, '')
    .replace(/Preferred departure:\s*\d{1,2}:\d{2}/gi, '')
    .replace(/Requested rental activities:\s*[^\n]+/gi, '')
    .replace(/^[\s|·,-]+|[\s|·,-]+$/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { arrival, departure, activities, note };
}

const navItems = [
  { id: 'bookings', label: 'Bookings', icon: 'calendar' },
  { id: 'stays', label: 'Stays', icon: 'home' },
  { id: 'guests', label: 'Guests', icon: 'users' },
  { id: 'services', label: 'Services', icon: 'home' },
  { id: 'content', label: 'Website Content', icon: 'home' },
];

const mockGuestProfiles = [
  ['Maya Santos', 'maya.santos@example.com', '+63 917 555 0101'],
  ['Liam Reyes', 'liam.reyes@example.com', '+63 918 555 0102'],
  ['Sofia Cruz', 'sofia.cruz@example.com', '+63 919 555 0103'],
  ['Noah Garcia', 'noah.garcia@example.com', '+63 920 555 0104'],
  ['Amara Lim', 'amara.lim@example.com', '+63 921 555 0105'],
  ['Ethan Flores', 'ethan.flores@example.com', '+63 922 555 0106'],
];

function dateFromToday(days) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function createMockBookings() {
  const scenarios = [
    [0, 'Dagat Casita', 5, 8, 2, 'pending'],
    [1, 'Puno Villa', 2, 6, 4, 'confirmed'],
    [2, 'Dagat Casita', -1, 3, 2, 'checked_in'],
    [3, 'Exclusive resort buyout', 14, 18, 8, 'confirmed'],
    [4, 'Puno Villa', 22, 25, 3, 'pending'],
    [5, 'Dagat Casita', -12, -9, 2, 'completed'],
    [0, 'Puno Villa', 31, 35, 4, 'pending'],
    [2, 'Exclusive resort buyout', -20, -16, 6, 'cancelled'],
  ];

  return scenarios.map(([profileIndex, stayType, checkIn, checkOut, guests, status], index) => {
    const [guestName, email, phone] = mockGuestProfiles[profileIndex];
    return {
      id: `mock-${index + 1}`,
      reference_code: `DEMO-${String(index + 1).padStart(3, '0')}`,
      guest_name: guestName,
      email,
      phone,
      check_in: dateFromToday(checkIn),
      check_out: dateFromToday(checkOut),
      guests,
      stay_type: stayType,
      message: 'Preview-only sample reservation.',
      status,
      created_at: new Date(Date.now() - index * 86400000).toISOString(),
      is_mock: true,
    };
  });
}

function AdminIcon({ name }) {
  const paths = {
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
    <article><span>Confirmed stays</span><strong>{stats.confirmed.toString().padStart(2, '0')}</strong><small>Upcoming arrivals</small></article>
    <article><span>Expected guests</span><strong>{stats.guests.toString().padStart(2, '0')}</strong><small>Across active stays</small></article>
  </section>;
}

function BookingCalendar({ bookings, onViewBooking }) {
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  }, []);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1, 12));
  const [dialogContent, setDialogContent] = useState(null);
  const [landscapeOpen, setLandscapeOpen] = useState(false);
  const dialogRef = useRef(null);
  const landscapeDialogRef = useRef(null);
  const weeks = useMemo(() => calendarMonthWeeks(visibleMonth), [visibleMonth]);
  const monthLabel = new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(visibleMonth);

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

  const renderCalendarGrid = (labelSuffix = '', isLandscape = false) => <div className="booking-calendar__scroll" tabIndex="0" aria-label={`${monthLabel} calendar${labelSuffix}${isLandscape ? '' : '; scroll horizontally when needed'}`}>
    <div className="booking-calendar__grid" style={{ '--calendar-week-count': weeks.length }}>
      <div className="booking-calendar__weekdays" aria-hidden="true">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day}>{day}</span>)}
      </div>
      {weeks.map((weekDays, weekIndex) => {
        const { visible, overflow } = layoutCalendarWeek(weekDays, bookings, isLandscape ? 2 : 3);
        return <div className="booking-calendar__week" key={calendarDateKey(weekDays[0])}>
          {weekDays.map(date => {
            const key = calendarDateKey(date);
            const outsideMonth = date.getMonth() !== visibleMonth.getMonth();
            return <div className={`booking-calendar__day${outsideMonth ? ' is-outside' : ''}${key === calendarDateKey(today) ? ' is-today' : ''}`} key={key}>
              <time dateTime={key}>{date.getDate()}</time>
            </div>;
          })}
          <div className="booking-calendar__bookings">
            {visible.map(({ booking, start, end, startsHere, endsHere, lane }) => <button
              type="button"
              className={`booking-calendar__bar booking-calendar__bar--${booking.status}${startsHere ? ' is-check-in' : ''}${endsHere ? ' is-check-out' : ''}`}
              style={{ gridColumn: `${start + 1} / ${end + 2}`, gridRow: lane + 1 }}
              key={`${booking.id}-${weekIndex}`}
              title={`${booking.guest_name}: ${formatBookingDate(booking.check_in)} to ${formatBookingDate(booking.check_out)}`}
              onClick={() => selectBooking(booking)}
            ><span>{booking.guest_name}</span></button>)}
            {overflow.map(({ date, bookings: hiddenBookings }) => <button
              type="button"
              className="booking-calendar__more"
              style={{ gridColumn: `${calendarDayDifference(weekDays[0], date) + 1}`, gridRow: isLandscape ? 3 : 4 }}
              key={`more-${calendarDateKey(date)}`}
              onClick={() => showOverflow(date, hiddenBookings)}
            >+{hiddenBookings.length} more</button>)}
          </div>
        </div>;
      })}
    </div>
  </div>;

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
        <button type="button" onClick={() => moveMonth(-1)} aria-label="Previous month">‹</button>
        <strong aria-live="polite">{monthLabel}</strong>
        <button type="button" onClick={() => moveMonth(1)} aria-label="Next month">›</button>
        <button type="button" className="booking-calendar__landscape-button" title="Open fullscreen landscape calendar" aria-label="Open fullscreen landscape calendar" onClick={openLandscape}><AdminIcon name="landscape" /></button>
      </div>
      {renderCalendarGrid()}
    </section>

    <dialog ref={landscapeDialogRef} className="booking-calendar-landscape" aria-labelledby="booking-calendar-landscape-title" onClose={() => setLandscapeOpen(false)}>
      <div className="booking-calendar-landscape__header">
        <div><span className="admin-kicker">Landscape calendar</span><h2 id="booking-calendar-landscape-title">{monthLabel}</h2></div>
        <div className="booking-calendar__toolbar booking-calendar-landscape__toolbar">
          <button type="button" onClick={() => moveMonth(-1)} aria-label="Previous month">‹</button>
          <button type="button" onClick={() => moveMonth(1)} aria-label="Next month">›</button>
        </div>
        <button type="button" onClick={closeLandscape} aria-label="Close landscape calendar">×</button>
      </div>
      {renderCalendarGrid(' in landscape view', true)}
    </dialog>

    <dialog ref={dialogRef} className={`booking-calendar-dialog${landscapeOpen ? ' is-landscape' : ''}`} aria-labelledby="booking-calendar-dialog-title" onClose={() => setDialogContent(null)} onCancel={() => setDialogContent(null)}>
      {dialogContent?.type === 'booking' && (() => {
        const { booking } = dialogContent;
        return <>
          <div className="booking-calendar-dialog__header">
            <div><span className="admin-kicker">{booking.reference_code}</span><h3 id="booking-calendar-dialog-title">{booking.guest_name}</h3></div>
            <button type="button" onClick={closeDialog} aria-label="Close calendar booking details">×</button>
          </div>
          <span className={`booking-status booking-status--${booking.status}`}>{statusLabels[booking.status]}</span>
          <dl className="booking-calendar-dialog__facts">
            <div><dt>Stay</dt><dd>{booking.stay_type || booking.service_name || 'Flexible stay'}</dd></div>
            <div><dt>Check-in</dt><dd>{formatBookingDate(booking.check_in)}</dd></div>
            <div><dt>Check-out</dt><dd>{formatBookingDate(booking.check_out)}</dd></div>
            <div><dt>Guests</dt><dd>{booking.guests} {Number(booking.guests) === 1 ? 'guest' : 'guests'}</dd></div>
          </dl>
          <button type="button" className="booking-calendar-dialog__view" onClick={() => { closeDialog(); closeLandscape(); onViewBooking(booking.id); }}>View Booking <AdminIcon name="arrow" /></button>
        </>;
      })()}
      {dialogContent?.type === 'more' && <>
        <div className="booking-calendar-dialog__header">
          <div><span className="admin-kicker">Additional reservations</span><h3 id="booking-calendar-dialog-title">{formatBookingDate(calendarDateKey(dialogContent.date))}</h3></div>
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
        <label className="admin-request-modal__status"><span>Manage status</span><small>Keep the team updated on this reservation.</small>
          <select value={booking.status} onChange={event => updateStatus(booking.id, event.target.value)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </label>
      </aside>
    </div>
  </dialog>;
}

function BookingsView({ bookings, notice, setNotice, updateStatus }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [highlightedBookingId, setHighlightedBookingId] = useState(null);
  const highlightTimerRef = useRef(null);
  const visible = useMemo(() => bookings.filter(item => (
    (filter === 'all' || item.status === filter)
    && `${item.guest_name} ${item.reference_code} ${item.email} ${item.phone || ''} ${item.stay_type || ''} ${item.service_name || ''} ${item.message || ''}`.toLowerCase().includes(query.toLowerCase())
  )), [bookings, filter, query]);

  useEffect(() => () => window.clearTimeout(highlightTimerRef.current), []);

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

  return <>
    <BookingCalendar bookings={bookings} onViewBooking={viewBookingFromCalendar} />
    <section className="booking-board admin-view" aria-labelledby="bookings-heading">
    <div className="booking-board__head">
      <div><h2 id="bookings-heading">Booking requests</h2><p>{visible.length} {visible.length === 1 ? 'reservation' : 'reservations'}</p></div>
      <label className="admin-search"><AdminIcon name="search" /><input aria-label="Search bookings" placeholder="Search guest or reference" value={query} onChange={event => setQuery(event.target.value)} /></label>
    </div>
    <div className="filter-row">{['all', 'pending', 'confirmed', 'checked_in', 'completed', 'cancelled'].map(value => <button type="button" key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value === 'all' ? 'All' : statusLabels[value]}</button>)}</div>
    {notice && <p className="admin-notice" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss notification">×</button></p>}
    <div className="booking-table booking-card-grid">
      {visible.map(booking => {
        const nights = getBookingNights(booking);
        return <article className={`booking-card${highlightedBookingId === String(booking.id) ? ' is-calendar-highlighted' : ''}`} id={`booking-${booking.id}`} key={booking.id}>
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
              <label><select aria-label={`Status for ${booking.guest_name}`} value={booking.status} onChange={event => updateStatus(booking.id, event.target.value)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <button className="booking-manage-button" type="button" onClick={() => setSelectedBookingId(booking.id)}>View &amp; manage <AdminIcon name="arrow" /></button>
            </div>
          </div>
        </article>;
      })}
      {visible.length === 0 && <div className="empty-state"><AdminIcon name="calendar" /><h3>No reservations here yet.</h3><p>New booking requests will appear automatically.</p></div>}
    </div>
    <BookingRequestModal booking={bookings.find(item => item.id === selectedBookingId) || null} onClose={() => setSelectedBookingId(null)} updateStatus={updateStatus} />
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

function Dashboard({ user, csrfToken, onLogout }) {
  const [bookings, setBookings] = useState([]);
  const [mockBookings, setMockBookings] = useState(null);
  const [activeView, setActiveView] = useState('bookings');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/bookings.php', { headers: { Accept: 'application/json' } });
      if (response.status === 401) return onLogout();
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load bookings.');
      setBookings(data.bookings);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { document.title = `${navItems.find(item => item.id === activeView)?.label} · Odidepse Admin`; }, [activeView]);

  const displayedBookings = mockBookings ?? bookings;
  const stats = useMemo(() => ({
    pending: displayedBookings.filter(booking => booking.status === 'pending').length,
    confirmed: displayedBookings.filter(booking => booking.status === 'confirmed').length,
    guests: displayedBookings.filter(booking => ['confirmed', 'checked_in'].includes(booking.status)).reduce((sum, booking) => sum + Number(booking.guests), 0),
  }), [displayedBookings]);

  const updateStatus = async (id, status) => {
    if (String(id).startsWith('mock-')) {
      setMockBookings(current => current.map(item => item.id === id ? { ...item, status } : item));
      setNotice('Mock booking updated locally. No database records were changed.');
      return;
    }

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
    setActiveView(view);
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleMockData = () => {
    if (mockBookings) {
      setMockBookings(null);
      setNotice('Live booking data restored.');
      return;
    }

    setMockBookings(createMockBookings());
    setNotice('Mock preview enabled. This sample data is not saved to the database.');
  };

  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <span className="admin-wordmark admin-sidebar__label">ODIDEPSE</span>
      <nav aria-label="Admin navigation"><span className="admin-sidebar__label">Workspace</span>{navItems.map(item => <button type="button" key={item.id} className={activeView === item.id ? 'active' : ''} aria-current={activeView === item.id ? 'page' : undefined} title={item.label} onClick={() => navigate(item.id)}><AdminIcon name={item.icon} /><span className="admin-sidebar__label">{item.label}</span></button>)}</nav>
      <button type="button" title="Sign out" onClick={logout}><AdminIcon name="logout" /><span className="admin-sidebar__label">Sign out</span></button>
    </aside>
    <main className="admin-main">
      <header><div><span className="admin-kicker">{activeView === 'bookings' ? 'Reservations overview' : ['stays','services','content'].includes(activeView) ? 'Property overview' : 'Guest relationships'}</span><h1>Good day, {user.display_name.split(' ')[0]}.</h1></div><div className="admin-header-actions"><button type="button" className={mockBookings ? 'admin-mock-button is-active' : 'admin-mock-button'} aria-pressed={Boolean(mockBookings)} disabled={loading} onClick={toggleMockData}>{mockBookings ? 'Show live data' : 'Generate mock data'}</button><div className="admin-avatar">{user.display_name.charAt(0).toUpperCase()}</div></div></header>
      <nav className="admin-mobile-nav" aria-label="Admin sections">{navItems.map(item => <button type="button" key={item.id} className={activeView === item.id ? 'active' : ''} aria-current={activeView === item.id ? 'page' : undefined} title={item.label} onClick={() => navigate(item.id)}><AdminIcon name={item.icon} /><span className="admin-mobile-nav__label">{item.label}</span></button>)}</nav>
      <StatCards stats={stats} />
      {loading ? <div className="admin-section-loading"><span>Loading resort data…</span></div> : <>
        {activeView === 'bookings' && <BookingsView bookings={displayedBookings} notice={notice} setNotice={setNotice} updateStatus={updateStatus} />}
        {['stays','services','content'].includes(activeView) && <ResortManager key={activeView} kind={activeView} csrfToken={csrfToken} onLogout={onLogout} bookings={bookings} />}
        {activeView === 'guests' && <GuestsView bookings={displayedBookings} />}
      </>}
    </main>
  </div>;
}

export default function AdminApp() {
  const [session, setSession] = useState({ loading: true, user: null, csrfToken: '' });
  const logout = useCallback(() => setSession({ loading: false, user: null, csrfToken: '' }), []);

  const check = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/session.php', { headers: { Accept: 'application/json' } });
      const data = await response.json();
      setSession(response.ok && data.authenticated
        ? { loading: false, user: data.user, csrfToken: data.csrf_token }
        : { loading: false, user: null, csrfToken: '' });
    } catch {
      setSession({ loading: false, user: null, csrfToken: '' });
    }
  }, []);

  useEffect(() => { check(); }, [check]);
  if (session.loading) return <div className="admin-loading"><span>ODIDEPSE</span></div>;
  if (!session.user) return <AdminLogin onLogin={(user, csrfToken) => setSession({ loading: false, user, csrfToken })} />;
  return <Dashboard user={session.user} csrfToken={session.csrfToken} onLogout={logout} />;
}
