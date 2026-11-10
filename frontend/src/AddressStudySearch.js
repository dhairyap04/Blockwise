import { useEffect,useRef,useState } from "react";
import {api} from "./api";
export default function AddressStudySearch({onChoose,disabled}) {
  const [query,setQuery]=useState("");const [size,setSize]=useState("600");const [matches,setMatches]=useState(null);
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");
  const controller=useRef(null),generation=useRef(0);
  useEffect(()=>()=>{controller.current?.abort();generation.current++;},[]);
  async function search(event) {
    event.preventDefault();controller.current?.abort();controller.current=new AbortController();const current=++generation.current;
    setBusy(true);setError("");setNotice("");setMatches(null);
    try {const data=await api(`/api/addresses?q=${encodeURIComponent(query.trim())}`,{signal:controller.current.signal});if(current===generation.current)setMatches(data.matches);}
    catch(e){if(e.name!=="AbortError" && current===generation.current)setError(e.message);}
    finally{if(current===generation.current)setBusy(false);}
  }
  async function choose(match) {
    setBusy(true);setError("");setNotice("");
    try {const area=await api("/api/areas/address",{method:"POST",body:{...match,size_m:Number(size)}});onChoose(area);setNotice(`Study area prepared for ${match.address}. Confirm any draft warning to switch.`);}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return <details className="address-study" open><summary>Study a Calgary address</summary><form onSubmit={search}>
    <label htmlFor="city-address">Calgary street address</label><input id="city-address" className="input-text" required minLength={3} maxLength={120} value={query} onChange={e=>setQuery(e.target.value)} placeholder="e.g. 800 Macleod Trail SE" disabled={disabled || busy} />
    <label htmlFor="study-size">Study square width</label><select id="study-size" className="input-text" value={size} onChange={e=>setSize(e.target.value)} disabled={disabled || busy}><option value="400">400 metres</option><option value="600">600 metres</option><option value="800">800 metres</option><option value="1200">1.2 kilometres</option><option value="1600">1.6 kilometres</option></select>
    <button className="btn btn-secondary" disabled={disabled || busy || query.trim().length<3}>{busy ? "Looking up address…" : "Find Calgary address"}</button>
  </form><p className="data-note">Search the City’s parcel-address records, then choose a match. Include the street quadrant; omit the city and postal code. Larger squares load more buildings and may take longer. Save a project to reopen the exact area later.</p>
    {error && <p className="message message-error" role="alert">{error}</p>}{notice && <p className="data-note" role="status">{notice}</p>}
    {matches && (matches.length ? <><p className="data-note">Up to 8 matches. Choose the correct address point.</p><ul className="address-matches">{matches.map((m,i)=><li key={`${m.address}-${i}`}><button className="project-item" disabled={disabled || busy} onClick={()=>choose(m)}>Use {m.address}<small>{m.latitude.toFixed(5)}, {m.longitude.toFixed(5)} · {size} m square</small></button></li>)}</ul></> : <p role="status">No matching parcel addresses. Try a shorter street address with its quadrant.</p>)}
    <a href="https://data.calgary.ca/d/9zvu-p8uz" target="_blank" rel="noreferrer">Calgary parcel-address source</a>
  </details>;
}
