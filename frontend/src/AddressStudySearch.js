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
    try {const data=await api(`/api/addresses?q=${encodeURIComponent(query.trim())}`,{signal:controller.current.signal});if(current===generation.current)setMatches([...(data.landmarks || []),...data.matches]);}
    catch(e){if(e.name!=="AbortError" && current===generation.current)setError(e.message);}
    finally{if(current===generation.current)setBusy(false);}
  }
  async function choose(match) {
    setBusy(true);setError("");setNotice("");
    try {const area=await api("/api/areas/address",{method:"POST",body:{...match,size_m:Number(size)}});onChoose(area);setNotice(`Study area prepared for ${match.name || match.address}. Confirm any draft warning to switch.`);}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return <div className="address-study"><form onSubmit={search}>
    <label htmlFor="city-address">Calgary address or landmark</label><input id="city-address" className="input-text" required minLength={3} maxLength={120} value={query} onChange={e=>setQuery(e.target.value)} placeholder="e.g. Brookfield Place or 800 Macleod Trail SE" disabled={disabled || busy} />
    <details className="study-options"><summary>Search area · {Number(size)/1000} km wide</summary><label htmlFor="study-size">Study square width</label><select id="study-size" className="input-text" value={size} onChange={e=>setSize(e.target.value)} disabled={disabled || busy}><option value="400">400 metres</option><option value="600">600 metres</option><option value="800">800 metres</option><option value="1200">1.2 kilometres</option><option value="1600">1.6 kilometres</option></select></details>
    <button className="btn btn-primary" disabled={disabled || busy || query.trim().length<3}>{busy ? "Finding places…" : "Find address or landmark"}</button>
  </form><p className="data-note">Use a street address with its quadrant, or one of five reviewed Calgary landmarks.</p><details><summary>Search coverage & tips</summary><p className="data-note">Landmarks: Brookfield Place, The Bow, Calgary Tower, Suncor Energy Centre, and The CORE. For addresses, omit the city and postal code. Larger search areas load more buildings and may take longer.</p><a href="https://data.calgary.ca/d/9zvu-p8uz" target="_blank" rel="noreferrer">Calgary parcel-address source</a></details>
    {error && <p className="message message-error" role="alert">{error}</p>}{notice && <p className="data-note" role="status">{notice}</p>}
    {matches && (matches.length ? <><p className="data-note">Choose a landmark or one of up to 8 City address matches.</p><ul className="address-matches">{matches.map((m,i)=><li key={`${m.address}-${i}`}><button className="project-item" disabled={disabled || busy} onClick={()=>choose(m)}>Use {m.name || m.address}<small>{m.name && `${m.address} · `}{m.latitude.toFixed(5)}, {m.longitude.toFixed(5)} · {size} m square</small></button>{m.source && <><small className="data-note">{m.complex ? "Complex — choose a reference footprint after loading." : "Reviewed landmark entry."} Reviewed {m.reviewedAt}.</small><a href={m.source.url} target="_blank" rel="noreferrer">Name and address source</a></>}</li>)}</ul></> : <p role="status">No address or listed landmark matched. Try a street address with its quadrant. Landmark coverage currently includes Brookfield Place, The Bow, Calgary Tower, Suncor Energy Centre, and The CORE.</p>)}
  </div>;
}
