import { useEffect, useRef, useState } from 'react';
import { useResort } from './ResortContent.jsx';

export function PhotoViewer({ photos, index, onClose, onChange }) {
  const ref = useRef(null);
  useEffect(() => {
    if (index !== null && !ref.current.open) ref.current.showModal();
    if (index === null && ref.current.open) ref.current.close();
  }, [index]);
  const move = amount => onChange((index + amount + photos.length) % photos.length);
  return <dialog ref={ref} className="photo-viewer" aria-label="Resort photo viewer" onClose={onClose} onCancel={onClose} onKeyDown={event => { if (event.key === 'ArrowRight') { event.preventDefault(); move(1); } if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); } }}>
    <button type="button" className="photo-viewer__close" onClick={onClose} aria-label="Close photo viewer">✕</button>
    {index !== null && <><img src={photos[index].src} alt={photos[index].alt} /><div className="photo-viewer__footer"><button type="button" onClick={() => move(-1)} aria-label="Previous photo">←</button><p>{photos[index].alt}<small>{index + 1} / {photos.length}</small></p><button type="button" onClick={() => move(1)} aria-label="Next photo">→</button></div></>}
  </dialog>;
}

export default function ResortGallery() {
  const { copy, roomPhotos } = useResort();
  const [index, setIndex] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const tilt = event => {
    if (event.pointerType !== 'mouse' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--tilt-x', `${(0.5 - (event.clientY - rect.top) / rect.height) * 9}deg`);
    card.style.setProperty('--tilt-y', `${((event.clientX - rect.left) / rect.width - 0.5) * 9}deg`);
  };
  return <section className="resort-gallery section" id="gallery" aria-labelledby="gallery-title">
    <div className="section-heading"><div><div className="section-label"><span>03</span>{copy.gallery["a_closer_look"]}</div><h2 id="gallery-title">{copy.gallery["your_place"]}<br />{copy.gallery["in_the"]}<em>{copy.gallery["sun"]}</em></h2></div><p>{copy.gallery["a_few_little_windows_into_odidepse_explore_our_rooms_the_pool_and"]}<br /><span className="gallery-hint">{copy.gallery["tap_any_photo_to_wander_closer"]}</span></p></div>
    <div className="floating-gallery">{roomPhotos.slice(0, expanded ? undefined : 6).map((photo, i) => <button type="button" className="floating-photo" key={photo.id} style={{ '--angle': `${[-3, 3, -2, 2, -3, 3][i % 6]}deg`, '--lift': `${[0, 35, 5, 15, -10, 25][i % 6]}px` }} onPointerMove={tilt} onPointerLeave={event => { event.currentTarget.style.setProperty('--tilt-x', '0deg'); event.currentTarget.style.setProperty('--tilt-y', '0deg'); }} onClick={() => setIndex(i)} aria-label={`View ${photo.alt}`}><img src={photo.src} alt={photo.alt} loading="lazy" decoding="async" /><span><small>{String(i + 1).padStart(2, '0')} / ODIDEPSE</small><strong>{photo.title}</strong><i aria-hidden="true">↗</i></span></button>)}</div>
    <div className="gallery-actions"><span>{expanded ? roomPhotos.length : 6} glimpses of life here</span><button type="button" className="text-link" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Show fewer photos' : `Explore all ${roomPhotos.length} photos`} {expanded ? '−' : '+'}</button></div>
    <PhotoViewer photos={roomPhotos} index={index} onClose={() => setIndex(null)} onChange={setIndex} />
  </section>;
}

export function GuestStories() {
  const { copy, customerPhotos, reviews } = useResort();
  const [index, setIndex] = useState(null);
  return <section className="guest-stories" id="guest-stories" aria-labelledby="guest-title"><div className="section">
    <div className="section-heading"><div><div className="section-label"><span>06</span>{copy.guest_stories["the_good_days_shared"]}</div><h2 id="guest-title">{copy.guest_stories["you_make"]}<br />{copy.guest_stories["the"]}<em>{copy.guest_stories["memories"]}</em></h2></div><div className="guest-intro"><span className="sample-badge">Sample feedback</span><p>Real moments from your photo collection. The names, ratings, and reviews below are fictional examples for this preview, not testimonials from the people pictured.</p></div></div>
    <div className="guest-photo-strip" aria-label="Guest photo album">{customerPhotos.map((photo, i) => <button type="button" key={photo.src} onClick={() => setIndex(i)} aria-label={`View ${photo.alt}`}><img src={photo.src} alt={photo.alt} loading="lazy" decoding="async" /><span aria-hidden="true">↗</span></button>)}</div>
    <div className="guest-album-note"><span>{copy.guest_stories["little_moments_lasting_memories"]}</span><span>{copy.guest_stories["swipe_or_scroll_to_explore"]}</span></div>
    <div className="review-grid">{reviews.map(review => <article className="review-card" key={review.name}><div className="review-card__top"><span aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span><small>Sample review</small></div><blockquote>“{review.quote}”</blockquote><footer><span className="review-avatar" aria-hidden="true">{review.name.charAt(0)}</span><div><strong>{review.name}</strong><small>{review.type} · Fictional guest</small></div></footer></article>)}</div>
    <PhotoViewer photos={customerPhotos} index={index} onClose={() => setIndex(null)} onChange={setIndex} />
  </div></section>;
}
