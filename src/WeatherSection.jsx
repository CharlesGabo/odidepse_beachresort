import { useEffect, useRef, useState } from 'react';
import { useResort } from './ResortContent.jsx';

function conditions(symbol = '') {
  if (symbol.includes('thunder')) return ['⛈', 'Thunderstorms'];
  if (symbol.includes('snow') || symbol.includes('sleet')) return ['❄', 'Wintry showers'];
  if (symbol.includes('heavyrain')) return ['🌧', 'Heavy rain'];
  if (symbol.includes('rain')) return ['🌦', 'Rain showers'];
  if (symbol.includes('fog')) return ['🌫', 'Fog'];
  if (symbol.includes('partlycloudy') || symbol.includes('fair')) return [symbol.endsWith('_night') ? '☁' : '🌤', 'Partly cloudy'];
  if (symbol.includes('clearsky')) return [symbol.endsWith('_night') ? '☾' : '☀', 'Clear skies'];
  return ['☁', 'Cloudy'];
}

const localDate = date => new Date(`${date}T12:00:00+08:00`);
const dateLabel = date => localDate(date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
const timeLabel = date => new Date(date).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' });

export default function WeatherSection({ onBook }) {
  const { copy } = useResort();
  const [forecast, setForecast] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const refreshRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const compactRef = useRef(null);
  const collapseRef = useRef(null);
  const fullscreenScrollRef = useRef(0);
  const fullscreenReturnExpandedRef = useRef(false);

  const toggleForecast = () => {
    const scrollPosition = window.scrollY;
    setExpanded(!expanded);
    if (expanded) setFullscreen(false);
    if (expanded) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        window.scrollTo({ top: scrollPosition, left: 0, behavior: 'auto' });
        compactRef.current?.focus({ preventScroll: true });
      }));
    } else {
      requestAnimationFrame(() => collapseRef.current?.focus({ preventScroll: true }));
    }
  };

  const openFullscreen = () => {
    fullscreenScrollRef.current = window.scrollY;
    fullscreenReturnExpandedRef.current = expanded;
    setFullscreen(true);
    setExpanded(true);
    requestAnimationFrame(() => collapseRef.current?.focus({ preventScroll: true }));
  };

  const closeFullscreen = () => {
    const returnExpanded = fullscreenReturnExpandedRef.current;
    setFullscreen(false);
    setExpanded(returnExpanded);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.scrollTo({ top: fullscreenScrollRef.current, left: 0, behavior: 'auto' });
      (returnExpanded ? collapseRef : compactRef).current?.focus({ preventScroll: true });
    }));
  };

  useEffect(() => {
    if (!fullscreen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = event => {
      if (event.key !== 'Escape') return;
      closeFullscreen();
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [fullscreen]);

  useEffect(() => {
    let alive = true;
    let controller;
    let pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 18000);
      setBusy(true);
      try {
        const response = await fetch('/api/weather.php', { signal: controller.signal, headers: { Accept: 'application/json' } });
        const data = await response.json();
        if (!response.ok || data.forecast?.days?.length !== 7 || !data.forecast?.current) throw new Error('unavailable');
        if (alive) { setForecast(data.forecast); setError(''); }
      } catch {
        if (alive) { setForecast(null); setError('Weather is temporarily unavailable. Please try again shortly.'); }
      } finally {
        clearTimeout(timeout);
        pending = false;
        if (alive) setBusy(false);
      }
    };
    refreshRef.current = refresh;
    refresh();
    const timer = setInterval(() => { if (!document.hidden) refresh(); }, 10 * 60 * 1000);
    const visible = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { alive = false; controller?.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, []);

  const day = forecast?.days.find(item => item.date === selectedDate) || forecast?.days[0];
  const current = forecast?.current;
  return <section className={`weather-section section ${expanded ? 'weather-section--expanded' : 'weather-section--compact'}`} id="weather" aria-labelledby="weather-title">
    <div className="section-heading"><div><div className="section-label"><span>05</span>{copy.weather["a_little_outlook"]}</div><h2 id="weather-title">{copy.weather["meet_the"]}<em>{copy.weather["forecast"]}</em></h2></div><p>{copy.weather["sun_on_your_mind_get_a_feel_for_the_next_seven_days_before_choosi"]}</p></div>
    {!expanded && <div className="weather-compact weather-panel">
      <button ref={compactRef} type="button" className="weather-compact__open" aria-label="View 7-day forecast" aria-expanded={false} aria-controls="weather-details" onClick={toggleForecast} />
      <span className="weather-compact__location-row"><span className="weather-compact__location">{copy.weather["san_felipe_zambales"]}<small>{copy.weather["near_odidepse_philippine_time"]}</small></span><button type="button" className="weather-compact__fullscreen" title="Open fullscreen forecast" aria-label="Open fullscreen forecast" onClick={openFullscreen}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" /><rect x="7" y="8" width="10" height="8" rx="1" /></svg></button></span>
      <span className="weather-compact__current"><span className="weather-kicker">Current forecast</span>
        {current ? <><span className="weather-temperature"><span>{Math.round(current.temperature)}<sup>°C</sup></span><span className="weather-symbol" aria-hidden="true">{conditions(current.symbol)[0]}</span></span><span className="weather-compact__condition">{conditions(current.symbol)[1]}</span><small>Forecast for {timeLabel(current.time)} PHT</small></> : <span className="weather-compact__status" role="status">{error ? 'Weather temporarily unavailable' : 'Checking the coastal skies…'}</span>}
      </span>
      <span className="weather-compact__hint">{error ? 'Open forecast to retry' : 'View 7-day forecast'}</span>
    </div>}
    <div id="weather-details" className={`weather-panel${fullscreen ? ' weather-panel--fullscreen' : ''}`} hidden={!expanded} aria-busy={busy} role={fullscreen ? 'dialog' : undefined} aria-modal={fullscreen || undefined} aria-label={fullscreen ? 'San Felipe seven-day weather forecast' : undefined}>
      <div className="weather-toolbar"><span>{copy.weather["san_felipe_zambales_1"]}<small>{copy.weather["near_odidepse_philippine_time"]}</small></span><div className="weather-toolbar__actions"><button type="button" className="weather-refresh" disabled={busy} onClick={() => refreshRef.current?.()}>{busy ? 'Updating…' : '↻ Refresh'}</button>{!fullscreen && <button type="button" className="weather-refresh" onClick={openFullscreen}>Open fullscreen forecast</button>}<button ref={collapseRef} type="button" className="weather-refresh" aria-expanded={true} aria-controls="weather-details" onClick={fullscreen ? closeFullscreen : toggleForecast}>{fullscreen ? 'Close ×' : 'Collapse ↑'}</button></div></div>
      {error ? <div className="weather-empty" role="status"><span aria-hidden="true">☁</span><h3>A little pause in the forecast.</h3><p>{error}</p><button type="button" className="button button--light" disabled={busy} onClick={() => refreshRef.current?.()}>Try again</button></div> : !forecast ? <div className="weather-empty" role="status"><span aria-hidden="true">☀</span><h3>Checking the coastal skies…</h3><p>Fetching the latest forecast for your stay.</p></div> : <>
        <div className="weather-now"><div><span className="weather-kicker">Current forecast</span><div className="weather-temperature"><span>{Math.round(current.temperature)}<sup>°C</sup></span><span className="weather-symbol" aria-hidden="true">{conditions(current.symbol)[0]}</span></div><h3>{conditions(current.symbol)[1]}</h3><p>Forecast for {timeLabel(current.time)} PHT</p></div><dl><div><dt>Wind</dt><dd>{current.wind} <small>km/h</small></dd></div><div><dt>Humidity</dt><dd>{current.humidity == null ? '—' : `${Math.round(current.humidity)}%`}</dd></div><div><dt>Model updated</dt><dd className="weather-update">{timeLabel(forecast.updatedAt)} PHT</dd></div></dl></div>
        <div className="weather-days" aria-label="Seven day forecast">{forecast.days.map((item, index) => <button type="button" key={item.date} className={`weather-day ${day.date === item.date ? 'is-selected' : ''}`} aria-pressed={day.date === item.date} onClick={() => setSelectedDate(item.date)}><strong>{index === 0 ? 'Today' : localDate(item.date).toLocaleDateString('en-PH', { weekday: 'short', timeZone: 'Asia/Manila' })}</strong><small>{dateLabel(item.date)}</small><span className="weather-day__icon" aria-hidden="true">{conditions(item.symbol)[0]}</span><span className="weather-day__condition">{conditions(item.symbol)[1]}</span><span><b>{Math.round(item.high)}°</b> <span className="weather-low">{Math.round(item.low)}°</span></span><small className="weather-rain">{item.rain} mm rain</small></button>)}</div>
        <div className="weather-selection"><div aria-live="polite"><strong>{dateLabel(day.date)} · {conditions(day.symbol)[1]}</strong><p>Estimated rainfall {day.rain} mm · Wind up to {day.wind} km/h</p></div><button type="button" className="button button--light" disabled={day.date === forecast.days[0].date} onClick={() => onBook(day.date)}>{day.date === forecast.days[0].date ? 'Bookings start tomorrow' : 'Plan for this date ↗'}</button></div>
      </>}
    </div>
    <p className="weather-note" hidden={!expanded}>Forecasts can change. Temperatures and rainfall are estimates summarized from forecast intervals; today covers the remaining day. This is model data, not a live weather-station reading. For later bookings, check back within seven days of arrival.</p>
    <p className="weather-credit">Weather data: <a href="https://api.met.no/" target="_blank" rel="noreferrer">MET Norway</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a> · Refreshes every 10 minutes while this page is active.</p>
  </section>;
}
