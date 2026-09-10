import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ResortManager from './ResortManager.jsx';

const statusLabels = {
  pending: 'New request',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

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

function BookingRequestModal({ booking, onClose, updateStatus }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (booking && dialog && !dialog.open) dialog.showModal();
  }, [booking]);

  if (!booking) return null;
  return <dialog ref={dialogRef} className="admin-request-modal" aria-labelledby="request-modal-title" onClose={onClose} onCancel={onClose}>
    <div className="admin-request-modal__head">
      <div><span className="admin-kicker">{booking.reference_code}</span><h2 id="request-modal-title">Booking request</h2></div>
      <button type="button" className="admin-request-modal__close" onClick={onClose} aria-label="Close request details">×</button>
    </div>
    <dl className="admin-request-modal__details">
      <div><dt>Guest</dt><dd>{booking.guest_name}</dd></div>
      <div><dt>Guests</dt><dd>{booking.guests}</dd></div>
      <div><dt>Email</dt><dd><a href={`mailto:${booking.email}`}>{booking.email}</a></dd></div>
      <div><dt>Phone</dt><dd><a href={`tel:${booking.phone}`}>{booking.phone}</a></dd></div>
      <div><dt>Stay</dt><dd>{booking.stay_type || 'Flexible stay'}</dd></div>
      <div><dt>Requested service</dt><dd>{booking.service_name || 'None selected'}</dd></div>
      <div><dt>Check-in</dt><dd>{booking.check_in}</dd></div>
      <div><dt>Check-out</dt><dd>{booking.check_out}</dd></div>
      <div className="admin-request-modal__message"><dt>Guest request</dt><dd>{booking.message || 'No additional request provided.'}</dd></div>
    </dl>
    <label className="admin-request-modal__status">Manage status
      <select value={booking.status} onChange={event => updateStatus(booking.id, event.target.value)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
    </label>
  </dialog>;
}

function BookingsView({ bookings, notice, setNotice, updateStatus }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const visible = useMemo(() => bookings.filter(item => (
    (filter === 'all' || item.status === filter)
    && `${item.guest_name} ${item.reference_code} ${item.email} ${item.phone || ''} ${item.stay_type || ''} ${item.service_name || ''} ${item.message || ''}`.toLowerCase().includes(query.toLowerCase())
  )), [bookings, filter, query]);

  return <section className="booking-board admin-view" aria-labelledby="bookings-heading">
    <div className="booking-board__head">
      <div><h2 id="bookings-heading">Booking requests</h2><p>{visible.length} {visible.length === 1 ? 'reservation' : 'reservations'}</p></div>
      <label className="admin-search"><AdminIcon name="search" /><input aria-label="Search bookings" placeholder="Search guest or reference" value={query} onChange={event => setQuery(event.target.value)} /></label>
    </div>
    <div className="filter-row">{['all', 'pending', 'confirmed', 'checked_in', 'completed', 'cancelled'].map(value => <button type="button" key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value === 'all' ? 'All' : statusLabels[value]}</button>)}</div>
    {notice && <p className="admin-notice" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss notification">×</button></p>}
    <div className="booking-table">
      <div className="booking-row booking-row--head"><span>Guest</span><span>Stay</span><span>Dates</span><span>Status</span></div>
      {visible.map(booking => <article className="booking-row" key={booking.id}>
        <div><strong>{booking.guest_name}</strong><small>{booking.reference_code} · {booking.guests} guests</small></div>
        <div><strong>{booking.stay_type || booking.service_name || 'Flexible'}</strong><small>{booking.email}</small></div>
        <div><strong>{booking.check_in}</strong><small>to {booking.check_out}</small></div>
        <select aria-label={`Status for ${booking.guest_name}`} value={booking.status} onChange={event => updateStatus(booking.id, event.target.value)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <button className="booking-manage-button" type="button" onClick={() => setSelectedBookingId(booking.id)}>View &amp; manage</button>
      </article>)}
      {visible.length === 0 && <div className="empty-state"><AdminIcon name="calendar" /><h3>No reservations here yet.</h3><p>New booking requests will appear automatically.</p></div>}
    </div>
    <BookingRequestModal booking={bookings.find(item => item.id === selectedBookingId) || null} onClose={() => setSelectedBookingId(null)} updateStatus={updateStatus} />
  </section>;
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
      <span className="admin-wordmark">ODIDEPSE</span>
      <nav aria-label="Admin navigation"><span>Workspace</span>{navItems.map(item => <button type="button" key={item.id} className={activeView === item.id ? 'active' : ''} aria-current={activeView === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}><AdminIcon name={item.icon} />{item.label}</button>)}</nav>
      <button type="button" onClick={logout}><AdminIcon name="logout" />Sign out</button>
    </aside>
    <main className="admin-main">
      <header><div><span className="admin-kicker">{activeView === 'bookings' ? 'Reservations overview' : ['stays','services','content'].includes(activeView) ? 'Property overview' : 'Guest relationships'}</span><h1>Good day, {user.display_name.split(' ')[0]}.</h1></div><div className="admin-header-actions"><button type="button" className={mockBookings ? 'admin-mock-button is-active' : 'admin-mock-button'} aria-pressed={Boolean(mockBookings)} disabled={loading} onClick={toggleMockData}>{mockBookings ? 'Show live data' : 'Generate mock data'}</button><div className="admin-avatar">{user.display_name.charAt(0).toUpperCase()}</div></div></header>
      <nav className="admin-mobile-nav" aria-label="Admin sections">{navItems.map(item => <button type="button" key={item.id} className={activeView === item.id ? 'active' : ''} onClick={() => navigate(item.id)}><AdminIcon name={item.icon} />{item.label}</button>)}</nav>
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
