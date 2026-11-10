import { summarize } from "./analysis";
const metres = value => value==null ? "—" : `${value.toFixed(1)} m`;
export default function AnalysisSummary({ buildings }) {
  const s=summarize(buildings);
  return <details className="analysis-summary" open><summary>Result summary</summary>
    <p className="data-note">Based on displayed results, including the address search.</p>
    <dl className="stats-grid"><div><dt>Buildings</dt><dd>{s.count}</dd></div><div><dt>Median height</dt><dd>{metres(s.medianHeight)}</dd></div><div><dt>Tallest</dt><dd>{metres(s.maxHeight)}</dd></div></dl>
    <div className="height-bars" role="img" aria-label="Building height distribution">{["Under 15 m","15–30 m","30–60 m","60 m and over"].map((label,i) => <div key={label}><span>{label}</span><meter min={0} max={Math.max(1,...s.bins)} value={s.bins[i]} aria-label={label} /><b>{s.bins[i]}</b></div>)}</div>
    <p className="data-note">{s.missingHeights} buildings have unknown height.</p>
    <details><summary>Property data coverage</summary><p>{s.matched} of {s.count} buildings matched to {s.parcels} distinct parcels.</p><ul><li>{s.noOverlap} have no overlapping parcel.</li><li>{s.lowOverlap} have insufficient overlap (under 50%).</li></ul>
      <p className="data-note">{s.assessedParcels} distinct parcels have an assessment. Median: {s.medianAssessment==null ? "Unavailable" : new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD",maximumFractionDigits:0}).format(s.medianAssessment)}. Each parcel is counted once.</p></details>
    <details><summary>Zoning breakdown</summary>{s.zones.length ? <ul className="zone-breakdown">{s.zones.map(([zone,count]) => <li key={zone}><span>{zone}</span><b>{count}</b></li>)}</ul> : <p>No zoning data in these results.</p>}<p className="data-note">Building counts by district; a building with several codes appears in each.</p></details>
  </details>;
}
