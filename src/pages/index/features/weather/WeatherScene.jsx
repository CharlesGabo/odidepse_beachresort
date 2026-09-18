import { useEffect, useRef } from 'react';
import './weather-scene.css';

export function sceneCondition(symbol = '') {
  if (!symbol) return 'unknown';
  if (symbol.includes('thunder')) return 'storm';
  if (symbol.includes('sleet')) return 'sleet';
  if (symbol.includes('snow')) return 'snow';
  if (symbol.includes('heavyrain')) return 'heavy';
  if (symbol.includes('lightrain')) return 'drizzle';
  if (symbol.includes('rain')) return 'rain';
  if (symbol.includes('fog')) return 'fog';
  if (symbol.includes('partlycloudy') || symbol.includes('fair')) return 'partial';
  return symbol.includes('clearsky') ? 'clear' : 'cloudy';
}

const palettes = {
  unknown: ['#253c50', '#466071'], clear: ['#12699e', '#75b5c7'],
  partial: ['#315f83', '#85a4b6'], cloudy: ['#435568', '#82919c'],
  drizzle: ['#415e73', '#75909e'], rain: ['#293e56', '#516c80'],
  heavy: ['#182638', '#3c5064'], storm: ['#141b2b', '#3c4059'],
  fog: ['#596c78', '#99a8af'], snow: ['#516c85', '#a1b6c4'], sleet: ['#384e65', '#8096a6'],
};

export default function WeatherScene({ symbol = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    const kind = sceneCondition(symbol);
    const night = symbol.endsWith('_night');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let width = 0, height = 0, frame = 0, last = 0, elapsed = 0, visible = true;
    // Stable positions avoid flicker when switching between panel sizes.
    const random = i => { const n = Math.sin(i * 127.1 + 43.7) * 43758.5453; return n - Math.floor(n); };
    const glow = (x, y, radius, color) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
      g.addColorStop(0, color); g.addColorStop(1, 'transparent');
      ctx.fillStyle = g; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    };
    const draw = () => {
      if (!width || !height) return;
      const colors = night ? ['#0c1930', '#32455d'] : palettes[kind];
      const sky = ctx.createLinearGradient(0, 0, width * .25, height);
      sky.addColorStop(0, colors[0]); sky.addColorStop(1, colors[1]);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
      if (night && ['clear', 'partial'].includes(kind)) {
        for (let i = 0; i < 65; i++) {
          ctx.fillStyle = `rgba(225,239,255,${.2 + random(i + 80) * .5})`;
          ctx.beginPath(); ctx.arc(random(i) * width, random(i + 90) * height * .7, .5 + random(i + 180), 0, Math.PI * 2); ctx.fill();
        }
      }
      if (['clear', 'partial', 'drizzle'].includes(kind)) {
        const x = width * .78, y = Math.min(height * .2, 120), radius = Math.min(width, height) * .065;
        glow(x, y, radius * 7, night ? '#bcd5ef38' : '#fff0bc66');
        ctx.fillStyle = night ? '#e0e8ee' : '#fff3ce';
        ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
      }
      const clouds = kind === 'clear' ? 4 : kind === 'partial' ? 16 : 36;
      for (let i = 0; i < clouds; i++) {
        const drift = elapsed * (3 + random(i + 20) * 6);
        const x = ((random(i + 4) * (width + 400) + drift) % (width + 400)) - 200;
        const y = random(i + 36) * height * (kind === 'fog' ? .95 : .42) - 50;
        const radius = 80 + random(i + 70) * 180;
        ctx.save(); ctx.translate(x, y); ctx.scale(1.8, .55);
        glow(0, 0, radius, night ? '#65788e22' : ['heavy', 'storm'].includes(kind) ? '#9ba9b52b' : '#e6edf03b');
        ctx.restore();
      }
      const counts = { drizzle: 35, rain: 90, heavy: 190, storm: 220, snow: 70, sleet: 110 };
      const count = Math.round((counts[kind] || 0) * Math.min(2, width / 600));
      for (let i = 0; i < count; i++) {
        const depth = .3 + random(i + 30) * .7;
        const snow = kind === 'snow' || (kind === 'sleet' && i % 3 === 0);
        const speed = snow ? 18 : kind === 'heavy' || kind === 'storm' ? 400 : 230;
        const y = (random(i + 100) * (height + 50) + elapsed * speed * depth) % (height + 50) - 25;
        const x = (random(i + 200) * width + Math.sin(elapsed + i) * (snow ? 12 : 2));
        ctx.strokeStyle = `rgba(214,233,249,${depth * .36})`;
        ctx.fillStyle = `rgba(238,247,255,${depth * .65})`;
        ctx.lineWidth = depth;
        ctx.beginPath();
        if (snow) { ctx.arc(x, y, 1 + depth * 2, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.moveTo(x, y); ctx.lineTo(x - 2 * depth, y + 14 * depth); ctx.stroke(); }
      }
      // A dark foreground keeps the forecast legible in every scene.
      const shade = ctx.createLinearGradient(0, 0, 0, height);
      shade.addColorStop(0, '#06142318'); shade.addColorStop(1, '#06142366');
      ctx.fillStyle = shade; ctx.fillRect(0, 0, width, height);
    };
    const tick = now => {
      if (now - last >= 33) { elapsed += Math.min((now - last) / 1000, .05); last = now; draw(); }
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame); last = performance.now(); draw();
      if (visible && !document.hidden && !reduced.matches) frame = requestAnimationFrame(tick);
    };
    const resize = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width; height = entry.contentRect.height;
      const ratio = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = width * ratio; canvas.height = height * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); sync();
    });
    resize.observe(canvas);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    observer.observe(canvas);
    document.addEventListener('visibilitychange', sync); reduced.addEventListener('change', sync);
    return () => { cancelAnimationFrame(frame); resize.disconnect(); observer.disconnect(); document.removeEventListener('visibilitychange', sync); reduced.removeEventListener('change', sync); };
  }, [symbol]);
  return <canvas ref={ref} className="weather-scene" aria-hidden="true" />;
}
