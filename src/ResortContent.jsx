import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { photoAssets } from './resortPhotos.js';

const ResortContext = createContext(null);
export const useResort = () => useContext(ResortContext);

export function formatPrice(item) {
  if (item.price === null) return '';
  if (Number(item.price) === 0) return 'Free';
  const amount = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(Number(item.price));
  return `${item.price_mode === 'from' ? 'From ' : ''}${amount}${item.price_unit ? ` / ${item.price_unit}` : ''}`;
}

export function ResortProvider({ children }) {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true; let pending = false; let controller;
    const refresh = async () => {
      if (pending) return;
      pending = true; controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch('/api/resort.php', { headers: { Accept: 'application/json' }, cache: 'no-store', signal: controller.signal });
        const data = await response.json();
        if (!response.ok || !data.sections || !Array.isArray(data.stays) || !Array.isArray(data.services)) throw new Error('unavailable');
        if (alive) { setSnapshot(current => current?.revision === data.revision ? current : data); setError(''); }
      } catch { if (alive) setError('Resort information is temporarily unavailable. Please try again.'); }
      finally { clearTimeout(timeout); pending = false; }
    };
    refresh();
    const visible = () => { if (!document.hidden) refresh(); };
    const timer = setInterval(visible, 60000);
    document.addEventListener('visibilitychange', visible);
    return () => { alive = false; controller?.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [retry]);
  const content = useMemo(() => {
    if (!snapshot) return null;
    const copy = Object.fromEntries(Object.entries(snapshot.sections).filter(([key]) => key.startsWith('copy.')).map(([key,value]) => [key.slice(5), value]));
    const photos = snapshot.sections.photos.map(photo => ({ ...photo, src: photoAssets[photo.id] }));
    return { revision: snapshot.revision, copy,
      highlights: snapshot.sections.highlights, amenityGroups: snapshot.sections.amenities, occasions: snapshot.sections.occasions, reviews: snapshot.sections.reviews,
      roomPhotos: photos.filter(p => p.id.startsWith('room_')), customerPhotos: photos.filter(p => p.id.startsWith('guest_')),
      stays: snapshot.stays.map(stay => ({ ...stay, featured: stay.style === 'group', exclusive: stay.style === 'exclusive', detail: stay.detail.replaceAll('{room_count}', String(stay.room_count)).replaceAll('{room_word}', stay.room_count === 1 ? 'room' : 'rooms'), description: [stay.description, stay.availability_text, formatPrice(stay)].filter(Boolean).join(' ') })),
      services: snapshot.services.map(item => ({ ...item, title: item.name, copy: item.description, photo: item.asset ? photos.find(p => p.id === item.asset) : null, availabilityLabel: [item.availability_text || ({available:'Available', unavailable:'Currently unavailable', inquiry:'Available upon inquiry.'})[item.availability], formatPrice(item)].filter(Boolean).join(' · ') })),
    };
  }, [snapshot]);
  if (!content && !error) return null;
  if (!content) return <main className="section"><p role="alert">{error}</p><button className="button button--dark" type="button" onClick={() => { setError(''); setRetry(value => value + 1); }}>Try again</button></main>;
  return <ResortContext.Provider value={content}>{children}</ResortContext.Provider>;
}
