export default function SearchReference({reference,building,buildings,onChoose,onZoom,onCompare,compared,full,landmark,source,onContinue}) {
  if(!reference)return null;
  return <section id="search-reference-tools" className="search-reference" aria-label="Your search reference">
    <h3>{building ? "Your building is ready" : "Confirm your building"}</h3><strong>{reference.label}</strong><p className="data-note">{reference.address}</p>
    {building ? <><p className="reference-badge">Reference building · {building.name || building.address || `Building ${building.id}`} · ID {building.id}</p>
      <div className="form-row"><button className="btn btn-secondary" onClick={()=>onZoom(building)}>Show reference building</button><button className="btn btn-secondary" disabled={!compared && full} onClick={()=>onCompare(building.id)}>{compared ? 'Remove reference from comparison' : 'Add reference to comparison'}</button></div>{onContinue && <button className="btn btn-primary" onClick={onContinue}>Choose nearby buildings →</button>}</> : <p className="data-note">The purple pin marks the searched location. A building has not been confirmed.</p>}
    {!!reference.candidates.length && <details open={!building}><summary>{building ? 'Choose a different reference footprint' : 'Choose a reference footprint'}</summary><ul className="reference-candidates">{reference.candidates.map(c=>{
      const b=buildings.find(b=>b.id===c.id);return b ? <li key={c.id}><p>{b.name || b.address || `Building ${b.id}`}<small>ID {b.id} · {c.containsPoint ? 'Contains the search point' : `${c.distanceM} m from the search point`}</small></p><button className="text-button" onClick={()=>onZoom(b)}>Inspect</button><button className="text-button" aria-pressed={building?.id===c.id} onClick={()=>onChoose(c.id)}>Use building {c.id} as reference</button></li> : null;
    })}</ul></details>}
    <details><summary>Match and source details</summary><p className="data-note">{reference.explanation}</p>
      {landmark && <><p className="data-note">{landmark.complex ? 'This landmark is a complex. Nearby candidates are not a complete inventory of its buildings.' : 'Landmark name and footprint association were reviewed separately.'} Reviewed {landmark.reviewedAt}. {landmark.anchorSource}.</p><a href={source.url} target="_blank" rel="noreferrer">Landmark name and address source</a></>}
    </details>
    <p className="data-note">The reference stays marked through filters and other building selections. Add it to Compare when ready.</p>
  </section>;
}
