import { useEffect, useRef, useState } from 'react';
import { photoAssets } from './resortPhotos.js';
import './stay-photos.css';

export const stayPhotoSource = id => photoAssets[id] || `/api/stay-photo.php?id=${encodeURIComponent(id)}`;

export function StayPhotoCarousel({ photos = [], name }) {
  const [index, setIndex] = useState(0);
  const current = Math.min(index, Math.max(0, photos.length - 1));
  if (!photos.length) return <p className="stay-photo-empty">No room photos yet. Add photos below.</p>;
  const move = amount => setIndex((current + amount + photos.length) % photos.length);
  return <div className="stay-carousel" role="region" aria-label={`${name} photos`}>
    <img className="stay-carousel__image" src={stayPhotoSource(photos[current])} alt={`${name}, photo ${current + 1}`} />
    <div className="stay-carousel__controls"><button type="button" disabled={photos.length < 2} onClick={() => move(-1)} aria-label="Previous photo">← Previous</button><span aria-live="polite">{current + 1} / {photos.length}</span><button type="button" disabled={photos.length < 2} onClick={() => move(1)} aria-label="Next photo">Next →</button></div>
    <div className="stay-carousel__dots" aria-label="Choose photo">{photos.map((id, i) => <button type="button" key={id} aria-label={`Photo ${i + 1}`} aria-current={i === current ? 'true' : undefined} onClick={() => setIndex(i)} />)}</div>
  </div>;
}

export function StayPhotoModal({ photos, name, onClose }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="stay-photo-modal" aria-label={`${name} photo gallery`} onClose={onClose} onCancel={onClose} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const r = event.currentTarget.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) ref.current.close();
  }}><div className="stay-photo-modal__heading"><h2>{name}</h2><button type="button" onClick={() => ref.current.close()} aria-label="Close photo gallery">×</button></div><StayPhotoCarousel photos={photos} name={name} /></dialog>;
}

export function StayPhotoBackground({ photos, step = 0 }) {
  return <div className="stay-photo-background" aria-hidden="true">{photos.map((id, i) => <img key={id} src={stayPhotoSource(id)} alt="" loading="lazy" decoding="async" className={i === step % photos.length ? 'is-active' : ''} />)}</div>;
}

async function compressPhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024) throw new Error('Choose a JPEG, PNG, or WebP photo under 15 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    if (!blob || blob.size > 2 * 1024 * 1024) throw new Error('This image is too large. Choose a smaller photo.');
    return blob;
  } finally { bitmap.close(); }
}

export function StayPhotoEditor({ photos = [], name, onChange, csrfToken, disabled, onBusy }) {
  const [error, setError] = useState('');
  const upload = async event => {
    const files = Array.from(event.target.files || []); event.target.value = '';
    if (files.length + photos.length > 12) { setError('Choose up to 12 photos per stay.'); return; }
    onBusy(true); setError('');
    let next = [...photos];
    try {
      for (const file of files) {
        const body = new FormData(); body.append('photo', await compressPhoto(file), 'room.jpg');
        const response = await fetch('/api/admin/stay-photo-upload.php', { method: 'POST', headers: { 'X-CSRF-Token': csrfToken }, body });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Upload failed.');
        next = [...next, result.id]; onChange(next);
      }
    } catch (exception) { setError(exception.message); }
    finally { onBusy(false); }
  };
  const reorder = (index, offset) => { const next = [...photos]; [next[index], next[index + offset]] = [next[index + offset], next[index]]; onChange(next); };
  return <section className="stay-photo-editor"><h4>Room photos</h4><StayPhotoCarousel photos={photos} name={name || 'Room'} />
    {error && <p role="alert" className="admin-error">{error}</p>}
    <label>Upload photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled || photos.length >= 12} onChange={upload} /></label>
    <p>Up to 12 photos. The first photo is the cover. Save and publish to update the website.</p>
    <div className="stay-photo-editor__items">{photos.map((id, index) => <div key={id}><img src={stayPhotoSource(id)} alt={`${name} photo ${index + 1}`} /><span>{index === 0 ? 'Cover' : `Photo ${index + 1}`}</span><button type="button" disabled={disabled || index === 0} onClick={() => reorder(index, -1)} aria-label={`Move photo ${index + 1} earlier`}>←</button><button type="button" disabled={disabled || index === photos.length - 1} onClick={() => reorder(index, 1)} aria-label={`Move photo ${index + 1} later`}>→</button><button type="button" disabled={disabled} onClick={() => onChange(photos.filter((_, i) => i !== index))}>Remove</button></div>)}</div>
    <details><summary>Choose from existing room photos</summary><div className="stay-photo-library">{Object.keys(photoAssets).filter(id => id.startsWith('room_')).map(id => {
      const selected = photos.includes(id);
      const photoNumber = Number(id.split('_')[1]) + 1;
      return <button type="button" key={id} disabled={disabled || (!selected && photos.length >= 12)} aria-pressed={selected} onClick={() => onChange(selected ? photos.filter(photo => photo !== id) : [...photos, id])} aria-label={`${selected ? 'Remove' : 'Add'} room photo ${photoNumber}`}><img src={photoAssets[id]} alt={`Room photo ${photoNumber}`} loading="lazy" /></button>;
    })}</div></details>
  </section>;
}
