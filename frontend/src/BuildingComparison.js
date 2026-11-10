import { useRef } from "react";
import MeetingBriefForm from "./MeetingBriefForm";
export default function BuildingComparison({buildings,onRemove,onClear,onExport,briefContext,onNotesChange,referenceId}) {
  const dialog=useRef(null),returnFocus=useRef(null);
  const heights=buildings.map(b=>b.height_m).filter(h=>typeof h==="number" && Number.isFinite(h));
  const parcels=buildings.map(b=>b.parcel_id).filter(Boolean);
  const shared=new Set(parcels).size<parcels.length;
  const reference=buildings.find(b=>b.id===referenceId) || buildings[0];
  const label=b=>b.name || b.address || `Building ${b.id}`;
  const knownHeight=b=>typeof b.height_m==="number" && Number.isFinite(b.height_m);
  const money=value=>value==null ? "Unavailable" : new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD",maximumFractionDigits:0}).format(value);
  const table=(<div className="comparison-scroll" tabIndex={0} aria-label="Scrollable comparison table"><table className="comparison-table"><caption>Selected building evidence</caption><thead><tr><th scope="col">Attribute</th>{buildings.map(b=><th scope="col" key={b.id}>{b.name || b.address || `Building ${b.id}`}<small>{b.name && `${b.address || "Address unavailable"} · `}ID {b.id}</small></th>)}</tr></thead><tbody>
        <tr><th scope="row">Height</th>{buildings.map(b=><td key={b.id}>{b.height_m==null ? "Unavailable" : `${b.height_m} m`}</td>)}</tr>
        <tr><th scope="row">Zoning</th>{buildings.map(b=><td key={b.id}>{b.zoning || "Unavailable"}</td>)}</tr>
        <tr><th scope="row">Parcel assessment</th>{buildings.map(b=><td key={b.id}>{money(b.assessed_value)}{b.assessment_year && <small>{b.assessment_year}</small>}</td>)}</tr>
        <tr><th scope="row">Parcel ID</th>{buildings.map(b=><td key={b.id}>{b.parcel_id || "Unmatched"}</td>)}</tr>
        <tr><th scope="row">Footprint overlap</th>{buildings.map(b=><td key={b.id}>{b.parcel_overlap==null ? "No overlap recorded" : `${(b.parcel_overlap*100).toFixed(1)}%`}</td>)}</tr>
        <tr><th scope="row">Remove</th>{buildings.map(b=><td key={b.id}><button className="text-button" onClick={()=>onRemove(b.id)} aria-label={`Remove building ${b.id} from comparison`}>Remove</button></td>)}</tr>
      </tbody></table></div>);
  return <section id="compare-tools" className="sidebar-section workspace-group" aria-label="Building comparison">
    <h2 className="sidebar-section-title">3 · Review your comparison · {buildings.length}/3</h2>
    <p className="data-note">Compare up to three buildings, then take a brief to your neighbourhood discussion. Your shortlist clears when you change areas.</p>
    {buildings.length ? <>

      {buildings.length >= 2 ? <div className="comparison-takeaway" role="region" aria-label="What this comparison shows"><h3>What stands out</h3><p>Compared with <strong>{label(reference)}</strong>:</p><ul>{buildings.filter(b=>b.id!==reference.id).map(b=>{
        const difference=knownHeight(b) && knownHeight(reference) ? b.height_m-reference.height_m : null;
        return <li key={b.id}><strong>{label(b)}</strong>: {difference==null ? "a height comparison is unavailable" : Math.abs(difference)<0.05 ? "about the same recorded height" : `${Math.abs(difference).toFixed(1)} m ${difference>0 ? "taller" : "shorter"}`}.
          {b.zoning && reference.zoning ? b.zoning===reference.zoning ? ` Same recorded zoning (${b.zoning}).` : ` Different recorded zoning (${b.zoning} versus ${reference.zoning}).` : " Zoning comparison unavailable."}</li>;
      })}</ul><p className="data-note">These differences describe recorded data. Zoning codes alone do not establish what can be built.</p></div> : <p className="empty-hint">Add one more building to see height and zoning differences.</p>}
      <ul className="comparison-shortlist">{buildings.map(b=><li key={b.id}><span>{label(b)}{b.id===referenceId && <small>Reference building</small>}</span><button className="text-button" onClick={()=>onRemove(b.id)} aria-label={`Remove building ${b.id} from comparison`}>Remove</button></li>)}</ul>
      <details className="comparison-evidence"><summary>Building details & data coverage</summary><div className="comparison-cards">{buildings.map(b=><article className="comparison-card" key={b.id} aria-label={`Compared building ${b.id}`}>
        <header><h3>{b.name || b.address || `Building ${b.id}`}<small>{b.name && `${b.address || "Address unavailable"} · `}ID {b.id}</small></h3><button className="text-button" onClick={()=>onRemove(b.id)} aria-label={`Remove detailed building ${b.id} from comparison`}>Remove</button></header>
        <dl>{[['Height',b.height_m==null ? 'Unavailable' : `${b.height_m} m`],['Zoning',b.zoning || 'Unavailable'],['Parcel assessment',money(b.assessed_value)+(b.assessment_year ? ` (${b.assessment_year})` : '')],['Parcel ID',b.parcel_id || 'Unmatched'],['Footprint overlap',b.parcel_overlap==null ? 'No overlap recorded' : `${(b.parcel_overlap*100).toFixed(1)}%`]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      </article>)}</div>
      </details><button className="btn btn-secondary" onClick={()=>{returnFocus.current=document.activeElement;dialog.current.showModal();}}>Open wide comparison</button>
      {heights.length>=2 && <p className="comparison-insight">Height range: {(Math.max(...heights)-Math.min(...heights)).toFixed(1)} m between the shortest and tallest known heights.</p>}
      <p className="data-note">{shared ? "Some buildings share a parcel, so their assessment is repeated. " : ""}Assessments describe parcels, not individual building values. Missing data does not imply a zero value or unrestricted development.</p>
      <div className="form-row"><button className="btn btn-secondary" onClick={onExport}>Export comparison CSV</button><button className="text-button" onClick={onClear}>Clear comparison</button></div>
      {briefContext && <details className="brief-options"><summary>Export a comparison brief (PDF)</summary><MeetingBriefForm buildings={buildings} context={briefContext} onNotesChange={onNotesChange} /></details>}
    </> : <p className="empty-hint">No buildings compared yet. Start with two nearby buildings to compare height, zoning, and data coverage.</p>}
    <dialog ref={dialog} className="comparison-dialog" aria-label="Wide building comparison" onClose={()=>returnFocus.current?.focus()}><header><h2>Building comparison</h2><button className="btn btn-secondary" onClick={()=>dialog.current.close()}>Close comparison</button></header>{buildings.length ? table : <p>No buildings in the comparison.</p>}<p className="data-note">Assessments are parcel values. Shared parcels repeat the same assessment; unknown fields are not zero.</p><button className="btn btn-secondary" disabled={!buildings.length} onClick={onExport}>Export this comparison CSV</button></dialog>
    <details><summary>Comparison data sources</summary><a href="https://data.calgary.ca/d/cchr-krqg" target="_blank" rel="noreferrer">Building source</a><a href="https://data.calgary.ca/d/4bsw-nn7w" target="_blank" rel="noreferrer">Parcel source</a></details>
  </section>;
}
