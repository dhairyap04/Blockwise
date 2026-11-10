import { useRef } from "react";
import MeetingBriefForm from "./MeetingBriefForm";
export default function BuildingComparison({buildings,onRemove,onClear,onExport,briefContext,onNotesChange}) {
  const dialog=useRef(null),returnFocus=useRef(null);
  const heights=buildings.map(b=>b.height_m).filter(h=>typeof h==="number");
  const parcels=buildings.map(b=>b.parcel_id).filter(Boolean);
  const shared=new Set(parcels).size<parcels.length;
  const money=value=>value==null ? "Unavailable" : new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD",maximumFractionDigits:0}).format(value);
  const table=(<div className="comparison-scroll" tabIndex={0} aria-label="Scrollable comparison table"><table className="comparison-table"><caption>Selected building evidence</caption><thead><tr><th scope="col">Attribute</th>{buildings.map(b=><th scope="col" key={b.id}>{b.address || `Building ${b.id}`}<small>ID {b.id}</small></th>)}</tr></thead><tbody>
        <tr><th scope="row">Height</th>{buildings.map(b=><td key={b.id}>{b.height_m==null ? "Unavailable" : `${b.height_m} m`}</td>)}</tr>
        <tr><th scope="row">Zoning</th>{buildings.map(b=><td key={b.id}>{b.zoning || "Unavailable"}</td>)}</tr>
        <tr><th scope="row">Parcel assessment</th>{buildings.map(b=><td key={b.id}>{money(b.assessed_value)}{b.assessment_year && <small>{b.assessment_year}</small>}</td>)}</tr>
        <tr><th scope="row">Parcel ID</th>{buildings.map(b=><td key={b.id}>{b.parcel_id || "Unmatched"}</td>)}</tr>
        <tr><th scope="row">Footprint overlap</th>{buildings.map(b=><td key={b.id}>{b.parcel_overlap==null ? "No overlap recorded" : `${(b.parcel_overlap*100).toFixed(1)}%`}</td>)}</tr>
        <tr><th scope="row">Remove</th>{buildings.map(b=><td key={b.id}><button className="text-button" onClick={()=>onRemove(b.id)} aria-label={`Remove building ${b.id} from comparison`}>Remove</button></td>)}</tr>
      </tbody></table></div>);
  return <section id="compare-tools" className="sidebar-section workspace-group" aria-label="Building comparison">
    <h2 className="sidebar-section-title">Compare buildings · {buildings.length}/3</h2>
    <p className="data-note">Build a small evidence table for a neighbourhood discussion. Choose Compare on a result or building details. This temporary shortlist clears when you change areas.</p>
    {buildings.length ? <>
      {table}
      <button className="btn btn-secondary" onClick={()=>{returnFocus.current=document.activeElement;dialog.current.showModal();}}>Open wide comparison</button>
      {heights.length>=2 && <p className="comparison-insight">Height range: {(Math.max(...heights)-Math.min(...heights)).toFixed(1)} m between the shortest and tallest known heights.</p>}
      <p className="data-note">{shared ? "Some buildings share a parcel, so their assessment is repeated. " : ""}Assessments describe parcels, not individual building values. Missing data does not imply a zero value or unrestricted development.</p>
      <div className="form-row"><button className="btn btn-secondary" onClick={onExport}>Export comparison CSV</button><button className="text-button" onClick={onClear}>Clear comparison</button></div>
      {briefContext && <MeetingBriefForm buildings={buildings} context={briefContext} onNotesChange={onNotesChange} />}
    </> : <p className="empty-hint">No buildings compared yet. Start with two nearby buildings to compare height, zoning, and data coverage.</p>}
    <dialog ref={dialog} className="comparison-dialog" aria-label="Wide building comparison" onClose={()=>returnFocus.current?.focus()}><header><h2>Building comparison</h2><button className="btn btn-secondary" onClick={()=>dialog.current.close()}>Close comparison</button></header>{buildings.length ? table : <p>No buildings in the comparison.</p>}<p className="data-note">Assessments are parcel values. Shared parcels repeat the same assessment; unknown fields are not zero.</p><button className="btn btn-secondary" disabled={!buildings.length} onClick={onExport}>Export this comparison CSV</button></dialog>
    <a href="https://data.calgary.ca/d/cchr-krqg" target="_blank" rel="noreferrer">Building source</a><a href="https://data.calgary.ca/d/4bsw-nn7w" target="_blank" rel="noreferrer">Parcel source</a>
  </section>;
}
