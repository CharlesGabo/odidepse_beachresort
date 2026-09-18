import { useCallback, useEffect, useRef, useState } from 'react';
import { formatPrice } from '../../../../shared/resort/ResortContent.jsx';
import { photoAssets } from '../../../../shared/resort/resortPhotos.js';
import { StayPhotoEditor } from '../../../../shared/stay-photos/StayPhotos.jsx';
import useVisibilityPolling from '../polling/useVisibilityPolling.js';
import './resort-admin.css';

const label = key => key.replace(/^copy\./, '').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
const clone = value => structuredClone(value);

function StayFields({ value, onChange }) {
  const changeCapacity = event => {
    const capacity = event.target.value;
    const numericCapacity = /^\d+$/.test(capacity) ? Number(capacity) : null;
    onChange({
      ...value,
      capacity,
      ...(numericCapacity >= 1 && numericCapacity <= 100 ? {
        min_guests: Math.min(value.min_guests, numericCapacity),
        max_guests: numericCapacity,
        guests: numericCapacity,
      } : {}),
    });
  };

  return <div className="resort-editor__fields resort-editor__fields--simple">
    <label>Name<input type="text" required maxLength="50" placeholder="e.g. 5-guest room" value={value.name} onChange={event=>onChange({...value,name:event.target.value})}/></label>
    <label>Price (PHP)<input type="number" min="0" max="9999999999.99" step=".01" placeholder="Leave blank for upon inquiry" value={value.price??''} onChange={event=>onChange({...value,price:event.target.value===''?null:event.target.value})}/></label>
    <label>Guest capacity<input type="text" required maxLength="30" inputMode="numeric" placeholder="e.g. 5, 35+, or 88–100" value={value.capacity} onChange={changeCapacity}/></label>
  </div>;
}

function ActivityFields({ value, onChange }) {
  return <div className="resort-editor__fields resort-editor__fields--simple">
    <label>Activity name<input type="text" required maxLength="50" placeholder="e.g. Kayak rental" value={value.name} onChange={event=>onChange({...value,name:event.target.value})}/></label>
    <label>Description<textarea rows="4" maxLength="2000" placeholder="Describe this activity" value={value.description} onChange={event=>onChange({...value,description:event.target.value})}/></label>
    <label>Price (PHP)<input type="number" min="0" max="9999999999.99" step=".01" placeholder="Leave blank for upon inquiry" value={value.price??''} onChange={event=>onChange({...value,price:event.target.value===''?null:event.target.value})}/></label>
  </div>;
}

export default function ResortManager({ kind, csrfToken, onLogout, bookings = [] }) {
  const [data,setData] = useState(null);
  const [selected,setSelected] = useState(null);
  const [draft,setDraft] = useState(null);
  const [notice,setNotice] = useState('');
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [conflict,setConflict] = useState(false);
  const [photoMode,setPhotoMode] = useState(false);
  const [uploading,setUploading] = useState(false);
  const editorDialogRef = useRef(null);
  const load = useCallback(async ({ background = false } = {}) => {
    if(!background){setBusy(true);setError('');}
    try {
      const response=await fetch('/api/admin/resort.php',{headers:{Accept:'application/json'},cache:'no-store'});
      if(response.status===401){onLogout();return;}
      const next=await response.json();if(!response.ok)throw new Error(next.message);
      setData(next);
      if(!background){setDraft(null);setSelected(null);setConflict(false);}
    } catch(exception){setError(exception.message || 'Could not load resort data.');}
    finally{if(!background)setBusy(false);}
  },[onLogout]);
  useEffect(()=>{load();},[load,kind]);
  useVisibilityPolling(() => {
    if(!draft&&!busy&&!uploading)return load({background:true});
    return undefined;
  });
  useEffect(()=>{
    const dialog=editorDialogRef.current;
    if(draft&&dialog&&!dialog.open)dialog.showModal();
  },[draft]);
  const choose = (id, value, showPhotos = false) => {
    if(draft && !window.confirm('Discard unsaved edits and open another item?')) return;
    const next=clone(value);
    if(kind==='services'&&!Array.isArray(next.photos))next.photos=next.asset?[next.asset]:[];
    setPhotoMode(showPhotos);setSelected(id);setDraft(next);setNotice('');setError('');
  };
  const create = () => {
    const fields=data.fields[kind];
    const value=Object.fromEntries(Object.entries(fields).map(([key,spec])=>[key,spec[0]==='boolean'?key==='enabled':spec[0]==='price'?null:spec[0]==='number'?spec[1]:spec[0]==='select'?spec[1][0]:'']));
    if(kind==='stays'){value.max_guests=100;value.guests=2;value.price_unit='night';value.photos=[];}
    else {value.price_unit='activity';value.photos=[];}
    value.availability='inquiry';value.sort_order=data[kind].length;
    choose('new',value);
  };
  const save=async event=>{
    if(uploading){event.preventDefault();return;}
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try{
      const value=clone(draft);delete value.id;
      const response=await fetch('/api/admin/resort.php',{method:selected!=='new'?'PATCH':'POST',headers:{'Content-Type':'application/json',Accept:'application/json','X-CSRF-Token':csrfToken},body:JSON.stringify({kind,revision:data.revision,id:selected==='new'?undefined:selected,value})});
      if(response.status===401){onLogout();return;}
      const result=await response.json();if(!response.ok){if(response.status===409)setConflict(true);throw new Error(result.message);}
      await load();setNotice('Saved. Website updates appear on reload, when returning to its tab, or within 60 seconds.');
    }catch(exception){setError(exception.message || 'Save failed. Your edits are still here.');}
    finally{setBusy(false);}
  };
  const closeEditor=()=>{if(uploading||busy)return;setDraft(null);setSelected(null);setConflict(false);};
  const closeEditorFromBackdrop=event=>{
    if(event.target!==event.currentTarget||busy||uploading)return;
    const bounds=event.currentTarget.getBoundingClientRect();
    if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)event.currentTarget.close();
  };
  const editor=draft&&<form className="resort-editor" onSubmit={save}><h3>{selected==='new'?'New '+(kind==='stays'?'stay':'activity'):draft.name}</h3>
    {error&&<p className="admin-error" role="alert">{error}</p>}
    {kind==='stays'&&photoMode&&<StayPhotoEditor photos={draft.photos || []} name={draft.name} csrfToken={csrfToken} disabled={busy||uploading} onBusy={setUploading} onChange={photos=>setDraft(current=>({...current,photos}))} />}
    {kind==='stays'?(photoMode?null:<StayFields value={draft} onChange={setDraft}/>):<><ActivityFields value={draft} onChange={setDraft}/><StayPhotoEditor photos={draft.photos || []} name={draft.name} subject="Activity" libraryScope="all" csrfToken={csrfToken} disabled={busy||uploading} onBusy={setUploading} onChange={photos=>setDraft(current=>({...current,photos,asset:photoAssets[photos[0]]?photos[0]:''}))} /></>}
    {conflict&&<p role="alert">Reload the latest data before saving. Your unsaved text remains available here to copy.</p>}
    <div className="resort-editor__actions"><button className="admin-mock-button" disabled={busy||uploading||conflict}>{uploading?'Uploading…':busy?'Saving…':'Save and publish'}</button><button className="admin-mock-button" type="button" disabled={busy||uploading} onClick={closeEditor}>Cancel</button></div>
  </form>;
  const title=kind==='stays'?'Your stays':'Activities';
  return <section className="admin-view resort-manager" aria-label={title}>
    <div className="admin-view__heading"><div><span className="admin-kicker">Public resort information</span><h2>{title}</h2></div><div className="resort-editor__actions"><button className="admin-mock-button" type="button" disabled={busy} onClick={()=>{if(!draft || window.confirm('Discard edits and reload the latest data?'))load();}}>Reload latest data</button>{data&&<button className="admin-mock-button" type="button" disabled={busy} onClick={create}>Add {kind==='stays'?'stay':'activity'}</button>}</div></div>
    <p>Availability is managed manually. Saving publishes changes immediately. Disabled or archived offers are hidden; unavailable offers remain open for inquiries.</p>
    {notice&&<p className="admin-notice" role="status">{notice}</p>}{error&&<p className="admin-error" role="alert">{error}</p>}
    {!data?<p role="status">{busy?'Loading resort information…':'Use Reload latest data to try again.'}</p>:<>
      <div className="admin-stay-grid">{data[kind].map(record=>{
        const active=bookings.filter(b=>(Number(b.stay_id)===record.id||(!b.stay_id&&b.stay_type===record.name))&&['confirmed','checked_in'].includes(b.status));
        return <article className={`admin-stay-card${kind==='stays'?' admin-stay-card--photos':''}`} key={record.id} onClick={event=>{if(kind==='stays'&&!busy&&!event.target.closest('button'))choose(record.id,record,true);}}>
          {kind==='stays'&&<button className="admin-stay-photo-link" type="button" disabled={busy} onClick={()=>choose(record.id,record,true)} aria-label={`View and edit photos of ${record.name}`}>View photos</button>}
          <div className="admin-stay-card__top"><span>{record.archived?'Archived':record.enabled?'Published':'Disabled'}</span><i className={record.availability==='unavailable'?'is-busy':''}>{label(record.availability)}</i></div><h3>{record.name}</h3><dl><div><dt>Price</dt><dd>{formatPrice(record)||'Upon inquiry'}</dd></div>{kind==='stays'&&<><div><dt>Capacity</dt><dd>{record.capacity} guests</dd></div><div><dt>Rooms</dt><dd>{record.room_count}</dd></div><div><dt>Active bookings</dt><dd>{active.length}</dd></div></>}</dl><button className="admin-mock-button" type="button" disabled={busy} onClick={()=>choose(record.id,record)}>Edit {record.name}</button></article>;
      })}</div>
      {draft&&<dialog ref={editorDialogRef} className="resort-editor-dialog" aria-label={selected==='new'?`Add ${kind==='stays'?'stay':'activity'}`:`Edit ${draft.name}`} onClick={closeEditorFromBackdrop} onClose={closeEditor} onCancel={event=>{if(busy||uploading)event.preventDefault();}}><button className="resort-editor-dialog__close" type="button" disabled={busy||uploading} aria-label={`Close ${kind==='stays'?'stay':'activity'} editor`} onClick={()=>editorDialogRef.current?.close()}>×</button>{editor}</dialog>}
    </>}
  </section>;
}
