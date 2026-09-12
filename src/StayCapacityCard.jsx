import { useRef, useState } from 'react';
import { StayPhotoBackground, StayPhotoModal } from './StayPhotos.jsx';

export default function StayCapacityCard({ stay, copy, onBook, photoStep = 0 }) {
  const photos = Array.isArray(stay.photos) ? stay.photos.filter(Boolean) : [];
  const [galleryOpen, setGalleryOpen] = useState(false);
  const photoButtonRef = useRef(null);
  const closeGallery = () => {
    setGalleryOpen(false);
    window.requestAnimationFrame(() => photoButtonRef.current?.blur());
  };
  return <>
    <article className={`capacity-card is-visible ${stay.featured ? 'capacity-card--group' : ''} ${stay.exclusive ? 'capacity-card--exclusive' : ''}${photos.length ? ' capacity-card--photos' : ''}`}>
      {photos.length > 0 && <><StayPhotoBackground photos={photos} step={photoStep} /><button ref={photoButtonRef} type="button" className="capacity-photo-open" onClick={() => setGalleryOpen(true)} aria-label={`View ${stay.name} photos`} /></>}
      <div className="capacity-card__information">
        {stay.badge && <span className="capacity-badge">{stay.badge}</span>}
        <h3><strong>{stay.capacity}</strong><span>{copy.guests}</span></h3><p className="capacity-detail">{stay.detail}</p><p>{stay.description}</p>
      </div>
      <button className={`text-link ${stay.exclusive ? 'text-link--light' : ''}`} type="button" onClick={onBook} aria-label={`Inquire about ${stay.name}`}>{stay.featured || stay.exclusive ? copy.group_cta : copy.room_cta} <span aria-hidden="true">→</span></button>
      {photos.length > 0 && <div className="capacity-photo-actions"><span>{photos.length} photos · Tap to view</span></div>}
    </article>
    {galleryOpen && <StayPhotoModal photos={photos} name={stay.name} onClose={closeGallery} />}
  </>;
}
