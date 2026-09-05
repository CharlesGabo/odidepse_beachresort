import { useEffect, useRef, useState } from 'react';
import AdminApp from './AdminApp.jsx';
import ResortGallery, { GuestStories } from './ResortGallery.jsx';
import WeatherSection from './WeatherSection.jsx';
import './guest-features.css';
import heroImage from './assets/photos/odidepse-hero.png';
import casitaImage from './assets/photos/casita.png';
import sunsetImage from './assets/photos/sunset-table.png';
import surfImage from './assets/photos/surf-morning.png';

const stays = [
  {
    name: 'Dagat Casita',
    meta: '2 guests · king bed · plunge pool',
    price: 'From ₱8,900 / night',
    image: casitaImage,
    description: 'A private shoreline hideaway framed in native timber, linen, and the sound of the tide.',
  },
  {
    name: 'Puno Villa',
    meta: '4 guests · 2 bedrooms · garden deck',
    price: 'From ₱13,800 / night',
    image: surfImage,
    description: 'A generous family retreat tucked beneath the palms, just a barefoot walk from the water.',
  },
];

const experiences = [
  { number: '01', title: 'Dawn patrol', copy: 'Follow a local guide to gentle breaks and hidden coves before the rest of the coast wakes.', image: surfImage },
  { number: '02', title: 'Table by the tide', copy: 'A private sunset menu built around the day’s catch and produce grown just beyond our gates.', image: sunsetImage },
  { number: '03', title: 'Slow mornings', copy: 'Coffee, warm pandesal, and nowhere you need to be. The best itinerary is sometimes no itinerary.', image: casitaImage },
];

function Icon({ name, size = 20 }) {
  const paths = {
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
  return <a className={`logo ${light ? 'logo--light' : ''}`} href="#top" aria-label="Odidepse Beach Resort home"><span className="logo__mark"><i /><i /><i /></span><span>Odidepse<small>Beach Resort · Zambales</small></span></a>;
}

function BookingModal({ open, onClose, initialStay = '', initialDate = '' }) {
  const dialogRef = useRef(null);
  const [status, setStatus] = useState({ type: 'idle', message: '' });
  const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + 86400000));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    if (!open) {
      if (dialog?.open) dialog.close();
      if (status.type !== 'idle') setStatus({ type: 'idle', message: '' });
    }
  }, [open]);

  const submit = async (event) => {
    event.preventDefault();
    setStatus({ type: 'loading', message: 'Sending your request…' });
    const body = Object.fromEntries(new FormData(event.currentTarget));
    body.guests = Number(body.guests);
    try {
      const response = await fetch('/api/bookings.php', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'We could not send your request.');
      event.currentTarget.reset();
      setStatus({ type: 'success', message: `Request ${data.reference} received. We’ll contact you within 24 hours.` });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  };

  return <dialog ref={dialogRef} className="booking-modal" onClose={onClose} onCancel={onClose} aria-labelledby="booking-title">
    <button className="icon-button modal-close" type="button" onClick={onClose} aria-label="Close booking form"><Icon name="close" /></button>
    <div className="modal-intro"><span className="eyebrow">Your escape starts here</span><h2 id="booking-title">Request your stay.</h2><p>Share your ideal dates and we’ll personally confirm availability and final pricing within 24 hours.</p></div>
    {status.type === 'success' ? <div className="booking-success" role="status"><span className="success-orbit"><Icon name="wave" size={30} /></span><h3>See you by the sea.</h3><p>{status.message}</p><button className="text-link" type="button" onClick={onClose}>Close <Icon name="arrow" size={16} /></button></div> :
      <form className="booking-form" onSubmit={submit}>
        <div className="field field--wide"><label htmlFor="guest-name">Full name</label><input id="guest-name" name="guest_name" autoComplete="name" maxLength="100" required placeholder="Juan dela Cruz" /></div>
        <div className="field"><label htmlFor="email">Email address</label><input id="email" type="email" name="email" autoComplete="email" maxLength="190" required placeholder="you@example.com" /></div>
        <div className="field"><label htmlFor="phone">Mobile number</label><input id="phone" name="phone" autoComplete="tel" maxLength="30" required placeholder="+63 9XX XXX XXXX" /></div>
        <div className="field"><label htmlFor="check-in">Check in</label><input id="check-in" type="date" name="check_in" min={tomorrow} key={initialDate} defaultValue={initialDate} required /></div>
        <div className="field"><label htmlFor="check-out">Check out</label><input id="check-out" type="date" name="check_out" min={tomorrow} required /></div>
        <div className="field"><label htmlFor="stay-type">Your stay</label><select id="stay-type" name="stay_type" key={initialStay} defaultValue={initialStay}><option value="">Help me choose</option><option>Dagat Casita</option><option>Puno Villa</option><option>Exclusive resort buyout</option></select></div>
        <div className="field"><label htmlFor="guests">Guests</label><select id="guests" name="guests" defaultValue="2">{[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n} {n === 1 ? 'guest' : 'guests'}</option>)}</select></div>
        <div className="field field--wide"><label htmlFor="message">Anything we should know? <span>Optional</span></label><textarea id="message" name="message" maxLength="1000" rows="3" placeholder="Celebrations, food preferences, or a little about your trip…" /></div>
        {status.type === 'error' && <p className="form-error field--wide" role="alert">{status.message}</p>}
        <button className="button button--dark field--wide" disabled={status.type === 'loading'}>{status.type === 'loading' ? 'Sending…' : 'Send booking request'} <Icon name="arrow" size={18} /></button>
        <p className="form-note field--wide">No payment is taken today. Your stay is confirmed only after our team contacts you.</p>
      </form>}
  </dialog>;
}

function PublicSite() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedStay, setSelectedStay] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const heroRef = useRef(null);

  useEffect(() => {
    const items = document.querySelectorAll('[data-reveal]');
    const observer = new IntersectionObserver(entries => entries.forEach(entry => entry.isIntersecting && entry.target.classList.add('is-visible')), { threshold: 0.14 });
    items.forEach(item => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const move = event => { hero.style.setProperty('--mx', `${(event.clientX / innerWidth - 0.5) * 12}px`); hero.style.setProperty('--my', `${(event.clientY / innerHeight - 0.5) * 8}px`); };
    addEventListener('pointermove', move, { passive: true });
    return () => removeEventListener('pointermove', move);
  }, []);

  const openBooking = (stay = '', date = '') => { setSelectedStay(stay); setSelectedDate(date); setBookingOpen(true); setMenuOpen(false); };

  return <div className="site-shell" id="top">
    <header className="site-header"><Logo light /><nav className="desktop-nav" aria-label="Main navigation"><a href="#story">Our story</a><a href="#stays">Stay</a><a href="#experiences">Experience</a><a href="#weather">Weather</a><a href="#location">Find us</a></nav><button className="button button--light header-book" type="button" onClick={() => openBooking()}>Plan your stay <Icon name="arrow" size={17} /></button><button className="icon-button menu-button" type="button" aria-expanded={menuOpen} aria-label="Open menu" onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? 'close' : 'menu'} /></button></header>
    <div className={`mobile-menu ${menuOpen ? 'is-open' : ''}`} aria-hidden={!menuOpen}><nav><a href="#story" onClick={() => setMenuOpen(false)}>Our story</a><a href="#stays" onClick={() => setMenuOpen(false)}>Stay</a><a href="#experiences" onClick={() => setMenuOpen(false)}>Experience</a><a href="#gallery" onClick={() => setMenuOpen(false)}>Gallery</a><a href="#weather" onClick={() => setMenuOpen(false)}>Weather</a><a href="#guest-stories" onClick={() => setMenuOpen(false)}>Guest stories</a><a href="#location" onClick={() => setMenuOpen(false)}>Find us</a></nav><button className="button button--coral" type="button" onClick={() => openBooking()}>Plan your stay <Icon name="arrow" /></button></div>
    <main>
      <section className="hero" ref={heroRef}><img src={heroImage} alt="A serene tropical shoreline and pavilion at the foot of the Zambales mountains" fetchPriority="high" /><div className="hero__wash" /><div className="hero__orb hero__orb--one" /><div className="hero__orb hero__orb--two" /><div className="hero__content"><span className="eyebrow eyebrow--light hero__eyebrow">San Felipe · Zambales · Philippines</span><h1>Come back<br />to <em>yourself.</em></h1><p>A barefoot hideaway where the mountains meet the sea—and time finally slows down.</p><button className="button button--coral" type="button" onClick={() => openBooking()}>Find your way here <Icon name="arrow" /></button></div><div className="hero__aside"><span>Plus code</span><span>3355+4P</span></div><a className="scroll-cue" href="#story"><span>Scroll to wander</span><i /></a></section>
      <section className="manifesto section" id="story" data-reveal><div className="section-label"><span>01</span> Our philosophy</div><div className="manifesto__grid"><h2>Less resort.<br />More <em>feeling.</em></h2><div className="manifesto__copy"><p className="lead">We made Odidepse for the kind of days you never want to rush.</p><p>Here, mornings begin with salt air and mountain light. Food comes from nearby waters and farms. Spaces are made by local hands, with a gentle footprint and an open view of the horizon.</p><p>This is Zambales at its most honest: wild, warm, and wonderfully unhurried.</p><a className="text-link" href="#experiences">Discover our world <Icon name="arrow" size={17} /></a></div></div><div className="manifesto__seal" aria-hidden="true"><span>STAY<br />SLOW</span><svg viewBox="0 0 100 100"><path id="seal-path" d="M50,8 a42,42 0 1,1 0,84 a42,42 0 1,1 0,-84" fill="none"/><text><textPath href="#seal-path">ODIDEPSE · SAN FELIPE · ZAMBALES · </textPath></text></svg></div></section>
      <section className="stays section" id="stays"><div className="section-heading" data-reveal><div><div className="section-label"><span>02</span> Rest by the sea</div><h2>Room to <em>breathe.</em></h2></div><p>Thoughtful spaces, natural textures, and the ocean never more than a few quiet steps away.</p></div><div className="stay-grid">{stays.map((stay,index) => <article className="stay-card" key={stay.name} data-reveal style={{'--delay':`${index*90}ms`}}><div className="stay-card__image"><img src={stay.image} alt={`${stay.name} accommodation at Odidepse`} loading="lazy" /><span>{index === 0 ? 'Most loved' : 'For togetherness'}</span></div><div className="stay-card__body"><div><span className="stay-card__meta">{stay.meta}</span><h3>{stay.name}</h3><p>{stay.description}</p></div><div className="stay-card__footer"><span>{stay.price}</span><button className="circle-button" onClick={() => openBooking(stay.name)} aria-label={`Request ${stay.name}`}><Icon name="arrow" /></button></div></div></article>)}</div></section>
      <ResortGallery />
      <section className="interlude" aria-label="Resort promise"><div className="interlude__inner" data-reveal><span className="eyebrow eyebrow--light">A gentler kind of luxury</span><blockquote>“The real indulgence<br />is having nowhere else<br />you need to be.”</blockquote><span className="interlude__mark"><Icon name="wave" size={40} /></span></div></section>
      <section className="experiences section" id="experiences"><div className="section-heading" data-reveal><div><div className="section-label"><span>04</span> Your day, your rhythm</div><h2>Follow your <em>curiosity.</em></h2></div><p>Go far, stay close, or do absolutely nothing. Every day here belongs entirely to you.</p></div><div className="experience-list">{experiences.map((item,index) => <article className="experience" key={item.title} data-reveal style={{'--delay':`${index*70}ms`}}><span className="experience__number">{item.number}</span><div className="experience__image"><img src={item.image} alt="" loading="lazy" /></div><h3>{item.title}</h3><p>{item.copy}</p><Icon name="arrow" /></article>)}</div></section>
      <WeatherSection onBook={date => openBooking('', date)} />
      <GuestStories />
      <section className="location" id="location">
        <div className="location__visual location__map" data-reveal>
          <iframe
            title="Odidepse Beach Resort location on Google Maps"
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d4770.879904334295!2d120.05674797590211!3d15.057833465717291!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3395d3b36a3db191%3A0x17fc754b019d8bac!2sOdidepse%20Beach%20Resort!5e1!3m2!1sen!2sph!4v1788537994313!5m2!1sen!2sph"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
          <a className="location__map-label" href="https://www.google.com/maps/search/?api=1&query=Odidepse%20Beach%20Resort%2C%20San%20Felipe%2C%20Zambales" target="_blank" rel="noreferrer"><Icon name="pin" size={18} /><span><strong>Odidepse Beach Resort</strong><small>3355+4P · San Felipe, Zambales</small></span></a>
        </div>
        <div className="location__content" data-reveal>
          <div className="section-label section-label--light"><span>07</span> The way here</div>
          <h2>Far enough<br />to feel <em>away.</em></h2>
          <p>Find us along Purok 8 Coastal Road in Brgy. Sto. Niño, where San Felipe meets the West Philippine Sea.</p>
          <dl><div><dt>Plus Code</dt><dd>3355+4P San Felipe, Zambales</dd></div><div><dt>From Manila</dt><dd>Approx. 4 hours</dd></div><div><dt>Transfers</dt><dd>Available on request</dd></div></dl>
          <a className="text-link text-link--light" href="https://www.google.com/maps/search/?api=1&query=Odidepse%20Beach%20Resort%2C%20San%20Felipe%2C%20Zambales" target="_blank" rel="noreferrer">Open in Google Maps <Icon name="arrow" size={17} /></a>
        </div>
      </section>
      <section className="closing section" data-reveal><span className="eyebrow">The sea is waiting</span><h2>Stay a little<br /><em>longer.</em></h2><p>Tell us when you’d like to arrive. We’ll take care of the rest.</p><button className="button button--dark" onClick={() => openBooking()}>Plan your escape <Icon name="arrow" /></button></section>
    </main>
    <footer className="footer"><div className="footer__top"><Logo light /><p>Wild coast. Warm welcome.<br />San Felipe, Zambales.</p><div className="footer__social"><a href="mailto:hello@odidepse.com">Email us</a><a href="https://instagram.com" aria-label="Instagram"><Icon name="instagram" /></a></div></div><div className="footer__bottom"><span>© {new Date().getFullYear()} Odidepse Beach Resort</span><span>Made with care by the coast</span></div></footer>
    <BookingModal open={bookingOpen} onClose={() => setBookingOpen(false)} initialStay={selectedStay} initialDate={selectedDate} />
  </div>;
}

export default function App() {
  const isAdminPath = window.location.pathname.replace(/\/+$/, '').endsWith('/admin');
  return isAdminPath ? <AdminApp /> : <PublicSite />;
}
