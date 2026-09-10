import { useCallback, useEffect, useState } from 'react';
import { formatPrice } from './ResortContent.jsx';
import { photoAssets } from './resortPhotos.js';
import './resort-admin.css';

const label = key => key.replace(/^copy\./, '').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
const clone = value => structuredClone(value);
const empty = value => Array.isArray(value) ? [] : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k,v]) => [k,empty(v)])) : typeof value === 'number' ? 1 : '';
const iconNames = ['wave','wifi','snow','paw','tv','mic','kitchen','pin'];

function ContentFields({ value, template, onChange, path }) {
  if (Array.isArray(value)) return <div className="resort-editor__list">
    {value.map((item, index) => <fieldset key={index}><legend>{label(path.split('.').at(-1))} {index + 1}</legend>
      <ContentFields value={item} template={path === 'photos' ? template[index] : template[0]} path={`${path}.${index}`} onChange={next => onChange(value.map((v,i) => i === index ? next : v))} />
      {path !== 'photos' && <button className="admin-mock-button" type="button" onClick={() => onChange(value.filter((_,i) => i !== index))}>Remove item</button>}
    </fieldset>)}
    {path !== 'photos' && <button className="admin-mock-button" type="button" disabled={value.length >= 100} onClick={() => onChange([...value, empty(template[0])])}>Add item</button>}
  </div>;
  if (value && typeof value === 'object') return <div className="resort-editor__fields">{Object.entries(value).map(([key,item]) => <ContentFields key={key} value={item} template={template[key]} path={`${path}.${key}`} onChange={next => onChange({...value, [key]:next})} />)}</div>;
  const key = path.split('.').at(-1);
  return <label>{label(key)}{key === 'icon' ? <select value={value} onChange={event => onChange(event.target.value)}><option value="" disabled>Choose an icon</option>{iconNames.map(icon => <option key={icon}>{icon}</option>)}</select> : typeof value === 'number' ? <input type="number" min="1" max="5" step="1" required value={value} onChange={event => onChange(Number(event.target.value))} /> : <textarea rows={value.length > 120 ? 4 : 2} maxLength="2000" readOnly={key === 'id'} value={value} onChange={event => onChange(event.target.value)} />}</label>;
}

function CatalogFields({ value, fields, onChange, photos }) {
  return <div className="resort-editor__fields">{Object.entries(fields).map(([key,spec]) => <label key={key}>
    {key === 'price' ? 'Price (PHP; blank = upon inquiry, 0 = free)' : label(key)}
    {spec[0] === 'boolean' ? <input type="checkbox" checked={value[key]} onChange={event => onChange({...value,[key]:event.target.checked})} /> : spec[0] === 'select' ? <select value={value[key]} onChange={event => onChange({...value,[key]:event.target.value})}>{spec[1].map(option => <option key={option} value={option}>{key === 'asset' ? (photos.find(p=>p.id === option)?.title || 'Icon only') : label(option)}</option>)}</select> : spec[0] === 'textarea' ? <textarea rows="4" maxLength={spec[1]} value={value[key]} onChange={event => onChange({...value,[key]:event.target.value})} /> : <input type={['number','price'].includes(spec[0]) ? 'number' : 'text'} value={value[key] ?? ''} min={spec[0] === 'price' ? 0 : spec[1]} max={spec[0] === 'price' ? 9999999999.99 : spec[2]} step={spec[0] === 'price' ? '.01' : '1'} maxLength={spec[0] === 'text' ? spec[1] : undefined} required={key === 'name' || spec[0] === 'number'} onChange={event => onChange({...value,[key]:spec[0] === 'number' ? Number(event.target.value) : spec[0] === 'price' && event.target.value === '' ? null : event.target.value})} />}
  </label>)}</div>;
}

export default function ResortManager({ kind, csrfToken, onLogout, bookings = [] }) {
  const [data,setData] = useState(null);
  const [selected,setSelected] = useState(null);
  const [draft,setDraft] = useState(null);
  const [notice,setNotice] = useState('');
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [conflict,setConflict] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);setError('');
    try {
      const response=await fetch('/api/admin/resort.php',{headers:{Accept:'application/json'},cache:'no-store'});
      if(response.status===401){onLogout();return;}
      const next=await response.json();if(!response.ok)throw new Error(next.message);
      setData(next);setDraft(null);setSelected(null);setConflict(false);
    } catch(exception){setError(exception.message || 'Could not load resort data.');}
    finally{setBusy(false);}
  },[onLogout]);
  useEffect(()=>{load();},[load,kind]);
  const choose = (id, value) => {
    if(draft && !window.confirm('Discard unsaved edits and open another item?')) return;
    setSelected(id);setDraft(clone(value));setNotice('');setError('');
  };
  const create = () => {
    const fields=data.fields[kind];
    const value=Object.fromEntries(Object.entries(fields).map(([key,spec])=>[key,spec[0]==='boolean'?key==='enabled':spec[0]==='price'?null:spec[0]==='number'?spec[1]:spec[0]==='select'?spec[1][0]:'']));
    if(kind==='stays'){value.max_guests=100;value.guests=2;}
    value.availability='inquiry';value.sort_order=data[kind].length;
    choose('new',value);
  };
  const save=async event=>{
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try{
      const value=clone(draft);delete value.id;
      const response=await fetch('/api/admin/resort.php',{method:kind==='content'||selected!=='new'?'PATCH':'POST',headers:{'Content-Type':'application/json',Accept:'application/json','X-CSRF-Token':csrfToken},body:JSON.stringify({kind,revision:data.revision,...(kind==='content'?{section:selected}:{id:selected==='new'?undefined:selected}),value})});
      if(response.status===401){onLogout();return;}
      const result=await response.json();if(!response.ok){if(response.status===409)setConflict(true);throw new Error(result.message);}
      await load();setNotice('Saved. Website updates appear on reload, when returning to its tab, or within 60 seconds.');
    }catch(exception){setError(exception.message || 'Save failed. Your edits are still here.');}
    finally{setBusy(false);}
  };
  const title=kind==='content'?'Website content':kind==='stays'?'Your stays':'Services';
  return <section className="admin-view resort-manager" aria-label={title}>
    <div className="admin-view__heading"><div><span className="admin-kicker">Public resort information</span><h2>{title}</h2></div><div className="resort-editor__actions"><button className="admin-mock-button" type="button" disabled={busy} onClick={()=>{if(!draft || window.confirm('Discard edits and reload the latest data?'))load();}}>Reload latest data</button>{kind!=='content'&&data&&<button className="admin-mock-button" type="button" disabled={busy} onClick={create}>Add {kind==='stays'?'stay':'service'}</button>}</div></div>
    <p>Availability is managed manually. Saving publishes changes immediately. Disabled or archived offers are hidden; unavailable offers remain open for inquiries.</p>
    {notice&&<p className="admin-notice" role="status">{notice}</p>}{error&&<p className="admin-error" role="alert">{error}</p>}
    {!data?<p role="status">{busy?'Loading resort information…':'Use Reload latest data to try again.'}</p>:<>
      {kind==='content'?<div className="filter-row">{Object.keys(data.sections).map(key=><button type="button" disabled={busy} className={selected===key?'active':''} key={key} onClick={()=>choose(key,data.sections[key])}>{label(key)}</button>)}</div>:<div className="admin-stay-grid">{data[kind].map(record=>{
        const active=bookings.filter(b=>(Number(b.stay_id)===record.id||(!b.stay_id&&b.stay_type===record.name))&&['confirmed','checked_in'].includes(b.status));
        return <article className="admin-stay-card" key={record.id}><div className="admin-stay-card__top"><span>{record.archived?'Archived':record.enabled?'Published':'Disabled'}</span><i className={record.availability==='unavailable'?'is-busy':''}>{label(record.availability)}</i></div><h3>{record.name}</h3><dl><div><dt>Price</dt><dd>{formatPrice(record)||'Upon inquiry'}</dd></div>{kind==='stays'&&<><div><dt>Capacity</dt><dd>{record.capacity} guests</dd></div><div><dt>Rooms</dt><dd>{record.room_count}</dd></div><div><dt>Active bookings</dt><dd>{active.length}</dd></div></>}</dl><button className="admin-mock-button" type="button" disabled={busy} onClick={()=>choose(record.id,record)}>Edit {record.name}</button></article>;
      })}</div>}
      {draft&&<form className="resort-editor" onSubmit={save}><h3>{selected==='new'?'New '+(kind==='stays'?'stay':'service'):kind==='content'?label(selected):draft.name}</h3>
        {kind==='content'?<ContentFields value={draft} template={data.templates[selected]} path={selected} onChange={setDraft}/>:<><CatalogFields value={draft} fields={data.fields[kind]} onChange={setDraft} photos={data.sections.photos}/>{kind==='stays'&&<p>Detail accepts {'{room_count}'} and {'{room_word}'} to keep the displayed room count in sync. Guest limits describe the offer; requests are not confirmed reservations.</p>}{draft.asset&&<img className="resort-editor__preview" src={photoAssets[draft.asset]} alt="Selected service image"/>}</>}
        {conflict&&<p role="alert">Reload the latest data before saving. Your unsaved text remains available here to copy.</p>}
        <div className="resort-editor__actions"><button className="admin-mock-button" disabled={busy||conflict}>{busy?'Saving…':'Save and publish'}</button><button className="admin-mock-button" type="button" disabled={busy} onClick={()=>{setDraft(null);setSelected(null);}}>Cancel</button></div>
      </form>}
    </>}
  </section>;
}
