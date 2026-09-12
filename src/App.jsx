import { useEffect, useRef, useState } from 'react';
import AdminApp from './AdminApp.jsx';
import StayCapacityCard from './StayCapacityCard.jsx';
import { stayPhotoSource } from './StayPhotos.jsx';
import ResortGallery, { GuestStories } from './ResortGallery.jsx';
import WeatherSection from './WeatherSection.jsx';
import './guest-features.css';
import heroVideoLeft from './assets/photos/videos/AQNCi_7_62Mv61gK2al1G0wsEeWObbCY0mz8j6VCDiUrSlCXt77tyZkEMiOutmuIwNBGxnvbetK9cpIscFAGZmo6n_v5cPZaday73ZagnsPc2g.mp4';
import heroVideoCenter from './assets/photos/videos/AQNhv0XRkIAq4fPmr3uSGu_XmkB8Lhx3F82TT6Wk6O_GGkpE_L7jhcSrh2FQGp2Zl3KHAy-jbFHSKzVZrF_p8fdTuHG2r9HsD_TYHdb14tjqdw.mp4';
import heroVideoRight from './assets/photos/videos/AQOkF-xowAbopqdtYWya5DseSgK-cP_49HcfPjtzShRHLTk5x8Yf9AnML9x9a2ioRxXvBM1uRMq-pA2ZUl4TjsjdDYoAbwX1SJgkUBO8jCPNTw.mp4';
import { ResortProvider, useResort } from './ResortContent.jsx';

const heroVideos = [heroVideoLeft, heroVideoCenter, heroVideoRight];
const loopingHeroVideos = [...heroVideos, ...heroVideos];

function HeroVideoBackground() {
  const videoRefs = useRef([]);
  const started = useRef(false);
  const startTogether = () => {
    const videos = videoRefs.current.filter(Boolean);
    if (started.current || videos.length !== loopingHeroVideos.length || videos.some(video => video.readyState < 2)) return;
    started.current = true;
    videos.forEach(video => { video.currentTime = 0; });
    videos.forEach(video => video.play().catch(() => {}));
  };

  return <div className="hero-video-wall" aria-hidden="true"><div className="hero-video-track">{loopingHeroVideos.map((src, index) => <video
      key={`${src}-${index}`}
      ref={element => { videoRefs.current[index] = element; }}
      src={src}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      onCanPlay={startTogether}
    />)}</div></div>;
}

function Icon({ name, size = 20 }) {
  const paths = {
    wifi: <><path d="M3 8a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0M9 16a5 5 0 0 1 6 0" /><circle cx="12" cy="20" r=".5" /></>,
    snow: <><path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 3 3-3M9 20l3-3 3 3" /></>,
    paw: <><ellipse cx="7" cy="7" rx="2" ry="3" /><ellipse cx="17" cy="7" rx="2" ry="3" /><ellipse cx="3" cy="12" rx="1.5" ry="2" /><ellipse cx="21" cy="12" rx="1.5" ry="2" /><path d="M6 19c0-3 3-7 6-7s6 4 6 7c0 4-4 1-6 1s-6 3-6-1Z" /></>,
    tv: <><rect x="3" y="5" width="18" height="13" rx="2" /><path d="M8 22h8M12 18v4m-2-14 5 3.5-5 3.5Z" /></>,
    mic: <><rect x="9" y="2" width="6" height="13" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" /></>,
    kitchen: <><path d="M4 3v6a3 3 0 0 0 6 0V3M7 3v19M20 22V3c-5 0-5 11 0 11" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    close: <><path d="M6 6l12 12M18 6L6 18" /></>,
    menu: <><path d="M4 8h16M4 16h16" /></>,
    instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5h.01" /></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    wave: <><path d="M2 15c2.4 0 2.4-2 4.8-2s2.4 2 4.8 2 2.4-2 4.8-2 2.4 2 4.8 2M2 19c2.4 0 2.4-2 4.8-2s2.4 2 4.8 2 2.4-2 4.8-2 2.4 2 4.8 2" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function Logo({ light = false }) {
  const { copy } = useResort();
  return <a className={`logo ${light ? 'logo--light' : ''}`} href="#top" aria-label="Odidepse Beach Resort home"><span className="logo__mark"><i /><i /><i /></span><span>{copy.identity["odidepse"]}<small>{copy.identity["beach_resort_zambales"]}</small></span></a>;
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function readableDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

function readableTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' }).format(new Date(`2000-01-01T${value}:00`));
}

function mockStayRate(stay) {
  if (!stay) return 0;
  if (stay.style === 'exclusive') return 75000;
  if (stay.style === 'group') return 30000;
  return Number(stay.guests) * 900;
}

function stayInventoryCount(stay) {
  if (!stay) return 0;
  if (stay.style === 'exclusive') return 1;
  const count = Number(stay.room_count);
  return Number.isInteger(count) && count > 0 ? count : 1;
}

function mockActivityRate(activity) {
  if (/banana/i.test(activity.title)) return 3500;
  if (/jet/i.test(activity.title)) return 2500;
  if (/ufo/i.test(activity.title)) return 4000;
  return 1500;
}

function formatMockPrice(value) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(value);
}

function CompactTimePicker({ label, value, onChange }) {
  const [hourValue, minute = '00'] = value.split(':');
  const hour24 = Number(hourValue);
  const hour12 = String(hour24 % 12 || 12);
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const update = (nextHour = hour12, nextMinute = minute, nextPeriod = period) => {
    const normalizedHour = Number(nextHour) % 12 + (nextPeriod === 'PM' ? 12 : 0);
    onChange(`${String(normalizedHour).padStart(2, '0')}:${nextMinute}`);
  };

  return <div className="booking-time-field">
    <span>{label}</span>
    <div className="booking-time-picker" role="group" aria-label={label}>
      <select value={hour12} onChange={event => update(event.target.value)} aria-label={`${label} hour`}>{Array.from({ length: 12 }, (_, index) => String(index + 1)).map(hour => <option value={hour} key={hour}>{hour.padStart(2, '0')}</option>)}</select>
      <select value={minute} onChange={event => update(hour12, event.target.value)} aria-label={`${label} minutes`}><option value="00">00</option><option value="30">30</option></select>
      <select value={period} onChange={event => update(hour12, minute, event.target.value)} aria-label={`${label} AM or PM`}><option value="AM">AM</option><option value="PM">PM</option></select>
    </div>
  </div>;
}

function BookingModal({ open, onClose, initialStay = '', initialDate = '', initialMessage = '', initialService = '', manual = false, csrfToken = '', onSaved }) {
  const { copy, stays, services, roomPhotos } = useResort();
  const dialogRef = useRef(null);
  const [status, setStatus] = useState({ type: 'idle', message: '' });
  const [selectedStay, setSelectedStay] = useState(String(initialStay));
  const [selectedActivities, setSelectedActivities] = useState(initialService ? [String(initialService)] : []);
  const [checkInDate, setCheckInDate] = useState(initialDate);
  const [checkOutDate, setCheckOutDate] = useState('');
  const [availability, setAvailability] = useState({ type: 'idle' });
  const [calendarAvailability, setCalendarAvailability] = useState({ type: 'idle', days: {} });
  const [arrivalTime, setArrivalTime] = useState('14:00');
  const [departureTime, setDepartureTime] = useState('12:00');
  const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + (manual ? 0 : 86400000)));
  const [calendarMonth, setCalendarMonth] = useState((initialDate || tomorrow).slice(0, 7));
  const bookingActivities = services.some(item => /\bufo\b/i.test(item.title)) ? services : [...services, {
    id: 'ufo-inquiry', title: 'UFO rental', photo: null,
    copy: 'Add a UFO ride to your beach day for a fast, splash-filled group adventure.',
    availabilityLabel: 'Rates and availability upon inquiry.',
  }];
  const selectedStayDetails = stays.find(stay => String(stay.id) === selectedStay);
  const selectedActivityDetails = bookingActivities.filter(service => selectedActivities.includes(String(service.id)));
  const [calendarYear, calendarMonthNumber] = calendarMonth.split('-').map(Number);
  const firstCalendarDay = new Date(calendarYear, calendarMonthNumber - 1, 1);
  const calendarCells = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarYear, calendarMonthNumber - 1, index - firstCalendarDay.getDay() + 1);
    return { key: dateKey(date), day: date.getDate(), inMonth: date.getMonth() === calendarMonthNumber - 1 };
  });
  const calendarLabel = new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(firstCalendarDay);
  const selectingCheckOut = Boolean(checkInDate && !checkOutDate);
  const latestCheckOut = checkInDate ? (() => { const date = new Date(`${checkInDate}T12:00:00`); date.setDate(date.getDate() + 30); return dateKey(date); })() : '';
  const nightCount = checkInDate && checkOutDate ? Math.round((new Date(`${checkOutDate}T12:00:00`) - new Date(`${checkInDate}T12:00:00`)) / 86400000) : 0;
  const stayRate = mockStayRate(selectedStayDetails);
  const staySubtotal = stayRate * nightCount;
  const activitySubtotal = selectedActivityDetails.reduce((total, activity) => total + mockActivityRate(activity), 0);
  const mockTotal = staySubtotal + activitySubtotal;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog && !dialog.open) {
      setSelectedStay(String(initialStay));
      setSelectedActivities(initialService ? [String(initialService)] : []);
      setCheckInDate(initialDate);
      setCheckOutDate('');
      setAvailability({ type: 'idle' });
      setArrivalTime('14:00');
      setDepartureTime('12:00');
      setCalendarMonth((initialDate || tomorrow).slice(0, 7));
      dialog.showModal();
    }
    if (!open) {
      if (dialog?.open) dialog.close();
      if (status.type !== 'idle') setStatus({ type: 'idle', message: '' });
    }
  }, [open]);

  useEffect(() => {
    if (!open || !selectedStay || !checkInDate || !checkOutDate) {
      setAvailability({ type: 'idle' });
      return undefined;
    }

    const controller = new AbortController();
    const parameters = new URLSearchParams({ stay_id: selectedStay, check_in: checkInDate, check_out: checkOutDate });
    setAvailability({ type: 'loading' });
    fetch(`/api/availability.php?${parameters}`, { headers: { Accept: 'application/json' }, cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Availability could not be checked.');
        setAvailability({ type: 'success', ...data });
      })
      .catch(error => {
        if (error.name !== 'AbortError') setAvailability({ type: 'error', message: error.message });
      });
    return () => controller.abort();
  }, [open, selectedStay, checkInDate, checkOutDate]);

  useEffect(() => {
    if (!open || !selectedStay) return;
    const controller = new AbortController();
    const monthStart = `${calendarMonth}-01`;
    const from = checkInDate && checkInDate < monthStart && (new Date(`${monthStart}T12:00:00`) - new Date(`${checkInDate}T12:00:00`)) / 86400000 <= 31 ? checkInDate : monthStart;
    const end = new Date(`${from}T12:00:00`);
    end.setDate(end.getDate() + 62);
    setCalendarAvailability({ type: 'loading', days: {} });
    const parameters = new URLSearchParams({ stay_id: selectedStay, check_in: from, check_out: dateKey(end) });
    fetch(`/api/availability.php?${parameters}`, { headers: { Accept: 'application/json' }, cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Availability could not be loaded.');
        setCalendarAvailability({ type: 'success', days: data.days, stay: selectedStay, month: calendarMonth });
      })
      .catch(error => { if (error.name !== 'AbortError') setCalendarAvailability({ type: 'error', days: {} }); });
    return () => controller.abort();
  }, [open, selectedStay, calendarMonth, checkInDate]);

  const calendarReady = calendarAvailability.type === 'success' && calendarAvailability.stay === selectedStay && calendarAvailability.month === calendarMonth;
  const isBlockedDate = value => {
    if (!calendarReady) return true;
    if (selectingCheckOut && value > checkInDate) {
      return Object.entries(calendarAvailability.days).some(([date, available]) => date >= checkInDate && date < value && available === 0);
    }
    return calendarAvailability.days[value] === 0;
  };

  const chooseCalendarDate = value => {
    if (value < tomorrow) return;
    if (isBlockedDate(value)) return;
    if (!checkInDate || checkOutDate || value <= checkInDate) {
      setCheckInDate(value);
      setCheckOutDate('');
      return;
    }
    setCheckOutDate(value);
  };

  const changeCalendarMonth = offset => {
    const next = new Date(calendarYear, calendarMonthNumber - 1 + offset, 1);
    const earliest = new Date(`${tomorrow.slice(0, 7)}-01T12:00:00`);
    if (!manual && next < earliest) return;
    setCalendarMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
  };

  const closeFromBackdrop = event => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const outside = event.clientX < bounds.left || event.clientX > bounds.right
      || event.clientY < bounds.top || event.clientY > bounds.bottom;
    if (outside) onClose();
  };

  const submit = async (event) => {
    event.preventDefault();
    setStatus({ type: 'loading', message: 'Sending your request…' });
    const form = event.currentTarget;
    const formData = new FormData(form);
    const body = Object.fromEntries(formData);
    if (availability.type !== 'success' || availability.available === 0) {
      setStatus({ type: 'error', message: 'Choose available dates and wait for the availability check before saving.' });
      return;
    }
    delete body.stay_choice;
    const phone = String(body.phone ?? '').trim();
    body.phone = phone ? `+63 ${phone}` : '';
    if (!checkInDate || !checkOutDate) {
      setStatus({ type: 'error', message: 'Please select both your check-in and check-out dates on the calendar.' });
      return;
    }
    const activityNames = selectedActivityDetails.map(activity => activity.title);
    const schedule = `Preferred arrival: ${arrivalTime}\nPreferred departure: ${departureTime}`;
    const activityNote = activityNames.length ? `Requested rental activities: ${activityNames.join(', ')}` : '';
    body.message = [schedule, activityNote, body.message].filter(Boolean).join('\n\n').trim();
    body.check_in = checkInDate;
    body.check_out = checkOutDate;
    if (body.message.length > 1000) {
      setStatus({ type: 'error', message: 'Please shorten your message to leave room for your schedule and selected activities (1,000 characters total).' });
      return;
    }
    body.guests = Number(body.guests);
    body.stay_id = selectedStay ? Number(selectedStay) : null;
    const soleActivityId = selectedActivities.length === 1 ? Number(selectedActivities[0]) : null;
    body.service_id = Number.isInteger(soleActivityId) ? soleActivityId : null;
    try {
      const response = await fetch(manual ? '/api/admin/create-booking.php' : '/api/bookings.php', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(manual ? { 'X-CSRF-Token': csrfToken } : {}) }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'We could not send your request.');
      form.reset();
      setStatus({ type: 'success', message: manual ? `Booking ${data.reference} saved as a new request.` : `Request ${data.reference} received. Our team will contact you to discuss availability and rates.` });
      onSaved?.(data);
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  };

  return <dialog ref={dialogRef} className="booking-modal" onClick={closeFromBackdrop} onClose={onClose} onCancel={onClose} aria-labelledby="booking-title">
    <button className="icon-button modal-close" type="button" onClick={onClose} aria-label="Close booking form"><Icon name="close" /></button>
    <div className="modal-intro">{!manual && <span className="eyebrow">{copy.inquiry["your_escape_starts_here"]}</span>}<h2 id="booking-title">{manual ? 'Add booking' : copy.inquiry["request_your_stay"]}</h2><p>{manual ? 'Record a walk-in, phone, or message booking. Enter the guest details, accommodation, dates, and requested activities.' : copy.inquiry["share_your_dates_and_group_size_our_team_will_confirm_availabilit"]}</p></div>
    {status.type === 'success' ? <div className="booking-success" role="status">
      <span className="success-orbit"><Icon name="wave" size={30} /></span>
      <h3>{manual ? 'Booking saved' : copy.inquiry["see_you_by_the_sea"]}</h3>
      <p>{status.message}</p>
      {!manual && <a className="booking-success__facebook" href="https://www.facebook.com/profile.php?id=61576647053739" target="_blank" rel="noreferrer">Message us on Facebook <Icon name="arrow" size={17} /></a>}
      <button className="text-link" type="button" onClick={onClose}>{copy.inquiry["close"]}<Icon name="arrow" size={16} /></button>
    </div> :
      <form key={open ? 'open' : 'closed'} className="booking-form booking-experience" onSubmit={submit}>
        <section className="booking-step field--wide" aria-labelledby="choose-stay-title">
          <div className="booking-step__heading"><span>01</span><div><h3 id="choose-stay-title">{manual ? 'Select accommodation' : 'Choose your space'}</h3><p>{manual ? 'Select the accommodation requested by the guest. Review availability for the selected dates below.' : 'Browse every stay option. Photos are representative while room assignments are confirmed by our team.'}</p></div></div>
          <div className="booking-card-grid booking-card-grid--stays">
            {stays.map((stay, index) => {
              const inputId = `booking-stay-${stay.id}`;
              const photo = stay.photos?.length ? { src: stayPhotoSource(stay.photos[0]), alt: stay.name } : roomPhotos[index % roomPhotos.length];
              const unitCount = stayInventoryCount(stay);
              return <label className={`booking-choice-card ${selectedStay === String(stay.id) ? 'is-selected' : ''}`} htmlFor={inputId} key={stay.id}>
                <input id={inputId} type="radio" name="stay_choice" value={stay.id} checked={selectedStay === String(stay.id)} onChange={() => { setSelectedStay(String(stay.id)); setCheckInDate(''); setCheckOutDate(''); setAvailability({ type: 'idle' }); }} required />
                <span className="booking-choice-card__image"><img src={photo.src} alt={photo.alt} loading="lazy" decoding="async" /><i>{selectedStay === String(stay.id) ? 'Selected' : 'Select room'}</i></span>
                <span className="booking-choice-card__body"><strong>{stay.name}</strong><small>{stay.capacity} guests · {unitCount} {unitCount === 1 ? 'unit' : 'units'}</small><span>{stay.description}</span>{stay.badge && <em>{stay.badge}</em>}</span>
              </label>;
            })}
          </div>
        </section>
        <section className="booking-step field--wide" aria-labelledby="schedule-title">
          <div className="booking-step__heading"><span>02</span><div><h3 id="schedule-title">{manual ? 'Set booking dates and times' : 'Set your schedule'}</h3><p>{manual ? (!checkInDate ? 'Select the check-in date.' : !checkOutDate ? 'Select the check-out date.' : 'Dates selected. Select another date to start again.') : (!checkInDate ? 'First, tap your check-in date.' : !checkOutDate ? 'Great — now tap your check-out date.' : 'Your dates are ready. You can tap another date to start again.')}</p></div></div>
          <div className="booking-calendar-layout">
            <div className="booking-calendar" aria-label="Choose check-in and check-out dates">
              <div className="booking-calendar__toolbar">
                <button type="button" onClick={() => changeCalendarMonth(-1)} disabled={!manual && calendarMonth <= tomorrow.slice(0, 7)} aria-label="Show previous month">‹</button>
                <strong>{calendarLabel}</strong>
                <button type="button" onClick={() => changeCalendarMonth(1)} aria-label="Show next month">›</button>
              </div>
              <div className="booking-calendar__weekdays" aria-hidden="true">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <span key={day}>{day}</span>)}</div>
              <div className="booking-calendar__days">
                {calendarCells.map(day => {
                  const isCheckIn = day.key === checkInDate;
                  const isCheckOut = day.key === checkOutDate;
                  const inRange = checkInDate && checkOutDate && day.key > checkInDate && day.key < checkOutDate;
                  const fullyBooked = calendarReady && calendarAvailability.days[day.key] === 0;
                  const unavailable = !day.inMonth || day.key < tomorrow || isBlockedDate(day.key) || (selectingCheckOut && day.key > latestCheckOut);
                  return <button type="button" key={day.key} disabled={unavailable} className={`${fullyBooked ? 'is-unavailable' : ''} ${isCheckIn ? 'is-endpoint is-check-in' : ''} ${isCheckOut ? 'is-endpoint is-check-out' : ''} ${inRange ? 'is-in-range' : ''}`} aria-pressed={isCheckIn || isCheckOut} aria-label={`${readableDate(day.key)}${fullyBooked ? ', fully booked for overnight stay' : ''}${isCheckIn ? ', check-in' : ''}${isCheckOut ? ', check-out' : ''}`} onClick={() => chooseCalendarDate(day.key)}>{day.inMonth ? day.day : ''}</button>;
                })}
              </div>
              <p className="booking-calendar__hint"><span /> Check-in <span /> Check-out <i /> Your stay</p>
              <p className="booking-calendar__availability-note" role="status">{!selectedStay ? 'Select an accommodation to see available dates.' : !calendarReady ? (calendarAvailability.type === 'error' ? 'Availability could not be loaded. Select the accommodation again or change month to retry.' : 'Loading available dates…') : 'Crossed-out dates are fully booked. Checkout is allowed on a fully booked date when the preceding nights are available.'}</p>
            </div>
            <div className="booking-schedule-controls">
              <CompactTimePicker label="Arrival time" value={arrivalTime} onChange={setArrivalTime} />
              <CompactTimePicker label="Departure time" value={departureTime} onChange={setDepartureTime} />
              <div className={`booking-schedule-summary ${checkInDate && checkOutDate ? 'is-complete' : ''}`} aria-live="polite">
                <span>Your schedule</span>
                {checkInDate && checkOutDate ? <><strong>{readableDate(checkInDate)} at {readableTime(arrivalTime)}</strong><i>to</i><strong>{readableDate(checkOutDate)} at {readableTime(departureTime)}</strong><p>{nightCount} {nightCount === 1 ? 'night' : 'nights'}</p></> : <p>Select your check-in and check-out dates to see a summary here.</p>}
              </div>
            </div>
          </div>
          <div className={`booking-availability booking-availability--${availability.type}${availability.type === 'success' && availability.available === 0 ? ' is-full' : ''}`} aria-live="polite">
            {availability.type === 'idle' && <p>Select an accommodation and complete date range to check availability.</p>}
            {availability.type === 'loading' && <p>Checking room availability…</p>}
            {availability.type === 'success' && <><strong>{availability.available > 0 ? `${availability.available} of ${availability.capacity} ${availability.capacity === 1 ? 'unit is' : 'units are'} available` : 'No units are currently available'}</strong><p>For your selected dates. Peak confirmed occupancy: {availability.occupied}; pending requests: {availability.pending}. Availability is finalized by the resort team.</p></>}
            {availability.type === 'error' && <p>{availability.message} You can still submit an inquiry.</p>}
          </div>
        </section>
        <section className="booking-step field--wide" aria-labelledby="activities-title-modal">
          <div className="booking-step__heading"><span>03</span><div><h3 id="activities-title-modal">{manual ? 'Requested activities' : 'Add an adventure'} <small>Optional</small></h3><p>{manual ? 'Record the activities requested by the guest. Verify rates and availability separately.' : 'Select as many rental activities as you like. Rates and availability are confirmed separately.'}</p></div></div>
          <div className="booking-card-grid booking-card-grid--activities">
            {bookingActivities.map((activity, index) => {
              const inputId = `booking-activity-${activity.id}`;
              const selected = selectedActivities.includes(String(activity.id));
              const photo = activity.photo || roomPhotos[(index + 5) % roomPhotos.length];
              return <label className={`booking-choice-card booking-choice-card--activity ${selected ? 'is-selected' : ''}`} htmlFor={inputId} key={activity.id}>
                <input id={inputId} type="checkbox" value={activity.id} checked={selected} onChange={() => setSelectedActivities(current => selected ? current.filter(id => id !== String(activity.id)) : [...current, String(activity.id)])} />
                <span className="booking-choice-card__image"><img src={photo.src} alt={activity.photo?.alt || `${activity.title} at Odidepse Beach Resort`} loading="lazy" decoding="async" /><i>{selected ? 'Added' : 'Add activity'}</i></span>
                <span className="booking-choice-card__body"><strong>{activity.title}</strong><span>{activity.copy}</span><small>{activity.availabilityLabel}</small></span>
              </label>;
            })}
          </div>
        </section>
        <section className="booking-step booking-step--details field--wide" aria-labelledby="guest-details-title">
          <div className="booking-step__heading"><span>04</span><div><h3 id="guest-details-title">{manual ? 'Guest details' : 'Tell us about your group'}</h3><p>{manual ? 'Enter the guest’s contact information, party size, and any booking notes.' : (selectedStayDetails ? `${selectedStayDetails.name} is selected. Add your contact details to request availability.` : 'Select a stay above, then add your contact details.')}</p></div></div>
          <div className="booking-details-grid">
            <div className="field field--wide"><label htmlFor="guest-name">{copy.inquiry["full_name"]}</label><input id="guest-name" name="guest_name" autoComplete="name" maxLength="100" required placeholder="Juan dela Cruz" /></div>
            <div className="field"><label htmlFor="email">{copy.inquiry["email_address"]}{manual && <span>{copy.inquiry["optional"]}</span>}</label><input id="email" type="email" name="email" autoComplete="email" maxLength="190" required={!manual} placeholder="you@example.com" /></div>
            <div className="field"><label htmlFor="phone">{copy.inquiry["mobile_number"]}{manual && <span>{copy.inquiry["optional"]}</span>}</label><div className="phone-prefix-field"><span aria-hidden="true">+63</span><input id="phone" name="phone" autoComplete="tel-national" inputMode="numeric" pattern="[0-9]{10}" maxLength="10" required={!manual} placeholder="9XX XXX XXXX" aria-describedby="phone-prefix-note" /></div><small id="phone-prefix-note">{manual ? 'Optional. If provided, enter the 10 digits after +63.' : 'Enter the 10 digits after +63.'}</small></div>
            <div className="field"><label htmlFor="guests">{copy.inquiry["guests"]}</label><input id="guests" name="guests" type="number" min={selectedStayDetails?.min_guests ?? 1} max={selectedStayDetails?.max_guests ?? 100} step="1" required key={selectedStay || 'none'} defaultValue={selectedStayDetails?.guests ?? 2} /></div>
        <div className="field field--wide"><label htmlFor="message">{manual ? 'Additional Information' : copy.inquiry["anything_we_should_know"]}<span>{copy.inquiry["optional"]}</span></label><textarea key={initialMessage} defaultValue={initialMessage} id="message" name="message" maxLength="1000" rows="3" placeholder="Celebrations, food preferences, or a little about your trip…" /></div>
          </div>
        </section>
        {!manual && <aside className="booking-price-summary field--wide" aria-labelledby="price-summary-title">
          <div><span>Preview estimate</span><h3 id="price-summary-title">Your estimated total</h3></div>
          <dl>
            <div><dt>{selectedStayDetails && nightCount ? `${selectedStayDetails.name} × ${nightCount} ${nightCount === 1 ? 'night' : 'nights'}` : 'Stay'}</dt><dd>{staySubtotal ? formatMockPrice(staySubtotal) : 'Select dates'}</dd></div>
            <div><dt>{selectedActivityDetails.length ? `${selectedActivityDetails.length} selected ${selectedActivityDetails.length === 1 ? 'activity' : 'activities'}` : 'Activities'}</dt><dd>{activitySubtotal ? formatMockPrice(activitySubtotal) : 'None'}</dd></div>
          </dl>
          <div className="booking-price-summary__total"><span>Estimated total</span><strong>{mockTotal ? formatMockPrice(mockTotal) : '—'}</strong></div>
          <p>Mock rates for preview only. Final rates and availability will be confirmed by our team.</p>
        </aside>}
        {status.type === 'error' && <p className="form-error field--wide" role="alert">{status.message}</p>}
        <button className="button button--dark field--wide" disabled={status.type === 'loading'}>{manual ? (status.type === 'loading' ? 'Saving booking…' : 'Save booking') : (status.type === 'loading' ? copy.inquiry.sending : copy.inquiry.submit)} <Icon name="arrow" size={18} /></button>
        <p className="form-note field--wide">{manual ? 'Saved bookings appear under New request. Confirm the booking after reviewing availability and arrangements.' : copy.inquiry["no_payment_is_taken_today_your_stay_is_confirmed_only_after_our_t"]}</p>
      </form>}
  </dialog>;
}

function ManualBookingModal(props) {
  return <ResortProvider><BookingModal {...props} manual /></ResortProvider>;
}

function PublicSite() {
  const { copy, stays, highlights, amenityGroups, occasions, roomPhotos, services: experiences, revision } = useResort();
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedStay, setSelectedStay] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedMessage, setSelectedMessage] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [stayPhotoStep, setStayPhotoStep] = useState(0);
  const activityCards = experiences.some(item => /\bufo\b/i.test(item.title)) ? experiences : [...experiences, {
    id: 'ufo-inquiry', title: 'UFO', icon: 'wave', photo: null,
    image_caption: 'A little more adventure',
    copy: 'Add a UFO ride to your beach day. Ask our team about rental options for your visit.',
    availabilityLabel: 'Rates and availability upon inquiry.',
  }];
  const heroRef = useRef(null);

  useEffect(() => {
    const items = document.querySelectorAll('[data-reveal]');
    const observer = new IntersectionObserver(entries => entries.forEach(entry => entry.isIntersecting && entry.target.classList.add('is-visible')), { threshold: 0.14 });
    items.forEach(item => observer.observe(item));
    return () => observer.disconnect();
  }, [revision]);

  useEffect(() => {
    const updateHeader = () => setHeaderScrolled(window.scrollY > 40);
    updateHeader();
    window.addEventListener('scroll', updateHeader, { passive: true });
    return () => window.removeEventListener('scroll', updateHeader);
  }, []);

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = window.setInterval(() => {
      if (!document.hidden) setStayPhotoStep(step => step + 1);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const move = event => { hero.style.setProperty('--mx', `${(event.clientX / innerWidth - 0.5) * 12}px`); hero.style.setProperty('--my', `${(event.clientY / innerHeight - 0.5) * 8}px`); };
    addEventListener('pointermove', move, { passive: true });
    return () => removeEventListener('pointermove', move);
  }, []);

  const openBooking = (stay = '', date = '', message = '', service = '') => { setSelectedService(service); setSelectedStay(stay); setSelectedDate(date); setSelectedMessage(message); setBookingOpen(true); setMenuOpen(false); };
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });

  return <div className="site-shell" id="top">
    <header className={`site-header ${headerScrolled || menuOpen ? 'is-scrolled' : ''}`}><Logo light /><nav className="desktop-nav" aria-label="Main navigation"><a href="#story">{copy.navigation["our_story"]}</a><a href="#stays">{copy.navigation["stay"]}</a><a href="#experiences">{copy.navigation["experience"]}</a><a href="#weather">{copy.navigation["weather"]}</a><a href="#location">{copy.navigation["find_us"]}</a></nav><button className="button button--light header-book" type="button" onClick={() => openBooking()}>{copy.navigation["plan_your_stay"]}<Icon name="arrow" size={17} /></button><button className="icon-button menu-button" type="button" aria-expanded={menuOpen} aria-label="Open menu" onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? 'close' : 'menu'} /></button></header>
    <div className={`mobile-menu ${menuOpen ? 'is-open' : ''}`} aria-hidden={!menuOpen}><nav><a href="#story" onClick={() => setMenuOpen(false)}>{copy.navigation["our_story"]}</a><a href="#stays" onClick={() => setMenuOpen(false)}>{copy.navigation["stay"]}</a><a href="#experiences" onClick={() => setMenuOpen(false)}>{copy.navigation["experience"]}</a><a href="#gallery" onClick={() => setMenuOpen(false)}>{copy.navigation["gallery"]}</a><a href="#weather" onClick={() => setMenuOpen(false)}>{copy.navigation["weather"]}</a><a href="#guest-stories" onClick={() => setMenuOpen(false)}>{copy.navigation["guest_stories"]}</a><a href="#location" onClick={() => setMenuOpen(false)}>{copy.navigation["find_us"]}</a></nav><button className="button button--coral" type="button" onClick={() => openBooking()}>{copy.navigation["plan_your_stay"]}<Icon name="arrow" /></button></div>
    <main>
      <section className="hero hero--groups" ref={heroRef}>
        <HeroVideoBackground />
        <div className="hero__wash" /><div className="hero__orb hero__orb--one" /><div className="hero__orb hero__orb--two" />
        <div className="hero__content"><span className="eyebrow eyebrow--light hero__eyebrow">{copy.hero["san_felipe_zambales_philippines"]}</span>
          <h1>{copy.hero["your_beach_escape"]}<br /><em>{copy.hero["25_seconds"]}</em><br />{copy.hero["from_the_shore"]}</h1>
          <p>{copy.hero["stay_stream_sing_and_grill_with_your_favorite_people_from_a_small"]}</p>
          <div className="hero-actions"><button className="button button--coral" type="button" onClick={() => openBooking()}>{copy.hero["plan_your_stay"]}<Icon name="arrow" /></button><a className="text-link text-link--light" href="#stays">{copy.hero["explore_rooms"]}<Icon name="arrow" size={17} /></a></div>
        </div><a className="scroll-cue" href="#story"><span>{copy.hero["discover_more"]}</span><i /></a>
      </section>
      <section className="quick-highlights" aria-label="Your stay at a glance">
        <dl>{highlights.map(item => <div key={item.title}><Icon name={item.icon} size={26} /><dt>{item.title}</dt><dd>{item.detail}</dd></div>)}</dl>
      </section>
      <section className="manifesto section resort-intro" id="story" data-reveal>
        <div className="section-label"><span>01</span>{copy.story["better_together"]}</div>
        <div className="manifesto__grid"><h2>{copy.story["beach_days"]}<br /><em>{copy.story["your_people"]}</em></h2><div className="manifesto__copy"><p className="lead">{copy.story["a_little_sea_air_a_lot_of_time_together"]}</p><p>{copy.story["odidepse_puts_you_a_25_second_walk_from_the_beach_with_air_condit"]}</p><p>{copy.story["bring_the_family_gather_the_barkada_or_plan_something_bigger_make"]}</p><a className="text-link" href="#amenities">{copy.story["see_what_s_included"]}<Icon name="arrow" size={17} /></a></div></div>
      </section>
      <section className="amenities section" id="amenities" aria-labelledby="amenities-title">
        <div className="section-heading" data-reveal><div><span className="eyebrow">{copy.amenities["the_little_extras_included"]}</span><h2 id="amenities-title">{copy.amenities["settle_in"]}<br /><em>{copy.amenities["we_ve_got_you"]}</em></h2></div><p>{copy.amenities["pack_for_the_beach_enjoy_free_wi_fi_entertainment_and_the_shared_"]}</p></div>
        <div className="amenity-grid">{amenityGroups.map(group => <article className="amenity-card" key={group.title} data-reveal><h3>{group.title}</h3><p>{group.intro}</p><ul>{group.items.map(item => <li key={item}>{item}</li>)}</ul></article>)}</div>
      </section>
      <section className="stays section" id="stays" aria-labelledby="stays-title">
        <div className="section-heading" data-reveal><div><div className="section-label"><span>02</span>{copy.stays["rooms_group_stays"]}</div><h2 id="stays-title">{copy.stays["room_for"]}<br /><em>{copy.stays["your_crew"]}</em></h2></div><p>{copy.stays["from_5_guest_rooms_to_an_exclusive_building_for_88_100_guests_tel"]}</p></div>
        <div className="capacity-grid">{stays.map(stay => <StayCapacityCard key={stay.id} stay={stay} copy={copy.stays} photoStep={stayPhotoStep} onBook={() => openBooking(stay.id)} />)}</div><p className="capacity-note">{copy.stays["room_counts_describe_accommodation_options_not_live_availability_"]}</p>
      </section>
      <ResortGallery />
      <section className="group-highlight" aria-labelledby="group-title">
        <div className="group-highlight__image"><img src={roomPhotos[0].src} alt={roomPhotos[0].alt} loading="lazy" decoding="async" /></div>
        <div className="group-highlight__content" data-reveal><span className="eyebrow eyebrow--light">{copy.group_highlight["big_plans_beach_setting"]}</span><h2 id="group-title">{copy.group_highlight["bringing_the"]}<br /><em>{copy.group_highlight["whole_crew"]}</em></h2><p>{copy.group_highlight["plan_a_reunion_company_outing_or_celebration_with_flexible_room_a"]}</p><button className="button button--coral" type="button" onClick={() => openBooking(stays.find(stay => stay.style === 'group')?.id ?? '')}>{copy.group_highlight["inquire_for_group_rates"]}<Icon name="arrow" /></button>
          <div className="occasion-list"><h3>{copy.group_highlight["perfect_for"]}</h3><ul>{occasions.map(item => <li key={item}>{item}</li>)}</ul></div>
        </div>
      </section>
      <section className="experiences section" id="experiences" aria-labelledby="activities-title">
        <div className="section-heading" data-reveal><div><div className="section-label"><span>04</span>{copy.experiences["a_little_more_adventure"]}</div><h2 id="activities-title">{copy.experiences["make_some"]}<br /><em>{copy.experiences["waves"]}</em></h2></div><p>{copy.experiences["take_your_beach_day_up_a_notch_ask_us_about_rental_availability_w"]}</p></div>
        <div className="activity-grid">{activityCards.map(item => <article className="activity-card" key={item.id} data-reveal><div className={`activity-card__visual ${!item.photo ? 'activity-card__visual--icon' : ''}`}>{item.photo ? <img src={item.photo.src} alt={item.photo.alt} loading="lazy" decoding="async" /> : <><Icon name={item.icon} size={84} /><span>{item.image_caption}</span></>}</div><div className="activity-card__body"><h3>{item.title}</h3><p>{item.copy}</p><span className="activity-availability">{item.availabilityLabel}</span><button className="text-link" type="button" onClick={() => openBooking('', '', `I’d like to ask about ${item.title} availability.`, item.id === 'ufo-inquiry' ? '' : item.id)}>{copy.experiences["ask_about_this_activity"]}<Icon name="arrow" size={17} /></button></div></article>)}</div>
      </section>
      <WeatherSection onBook={date => openBooking('', date)} />
      <GuestStories />
      <section className="location" id="location">
        <div className="location__visual location__map" data-reveal>
          <iframe
            title="Odidepse Beach Resort location on Google Maps"
            src={copy.links.map_embed}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
          <a className="location__map-label" href={copy.links.maps} target="_blank" rel="noreferrer"><Icon name="pin" size={18} /><span><strong>{copy.location["odidepse_beach_resort"]}</strong><small>{copy.location["3355_4p_san_felipe_zambales"]}</small></span></a>
        </div>
        <div className="location__content" data-reveal>
          <div className="section-label section-label--light"><span>07</span>{copy.location["the_way_here"]}</div>
          <h2>{copy.location["far_enough"]}<br />{copy.location["to_feel"]}<em>{copy.location["away"]}</em></h2>
          <p>{copy.location["find_us_along_purok_8_coastal_road_in_brgy_sto_ni_o_where_san_fel"]}</p>
          <dl><div><dt>{copy.location["plus_code"]}</dt><dd>{copy.location["3355_4p_san_felipe_zambales_1"]}</dd></div><div><dt>{copy.location["from_manila"]}</dt><dd>{copy.location["approx_4_hours"]}</dd></div><div><dt>{copy.location["transfers"]}</dt><dd>{copy.location["available_on_request"]}</dd></div></dl>
          <a className="text-link text-link--light" href={copy.links.maps} target="_blank" rel="noreferrer">{copy.location["open_in_google_maps"]}<Icon name="arrow" size={17} /></a>
        </div>
      </section>
      <section className="closing section resort-closing" data-reveal><span className="eyebrow">{copy.closing["the_sea_is_waiting"]}</span><h2>{copy.closing["effortless_fun"]}<br /><em>{copy.closing["a_little_extra"]}</em></h2><p>{copy.closing["because_your_beach_trip_should_be_all_three_from_beach_days_and_j"]}</p><button className="button button--dark" type="button" onClick={() => openBooking()}>{copy.closing["plan_your_stay"]}<Icon name="arrow" /></button></section>
    </main>
    <button type="button" className={`scroll-to-top${headerScrolled ? ' is-visible' : ''}`} aria-label="Scroll to top" aria-hidden={!headerScrolled} tabIndex={headerScrolled ? 0 : -1} onClick={scrollToTop}><Icon name="arrow" size={20} /></button>
    <footer className="footer"><div className="footer__top"><Logo light /><p>{copy.footer["wild_coast_warm_welcome"]}<br />{copy.footer["san_felipe_zambales"]}</p><div className="footer__social"><a href={copy.links.email}>{copy.footer["email_us"]}</a><a href={copy.links.instagram} aria-label="Instagram"><Icon name="instagram" /></a></div></div><div className="footer__bottom"><span>© {new Date().getFullYear()} {copy.footer.copyright_name}</span><span>{copy.footer["made_with_care_by_the_coast"]}</span></div></footer>
    <BookingModal open={bookingOpen} onClose={() => setBookingOpen(false)} initialStay={selectedStay} initialDate={selectedDate} initialMessage={selectedMessage} initialService={selectedService} />
  </div>;
}

export default function App() {
  const isAdminPath = window.location.pathname.replace(/\/+$/, '').endsWith('/admin');
  return isAdminPath ? <AdminApp ManualBookingModal={ManualBookingModal} /> : <ResortProvider><PublicSite /></ResortProvider>;
}
