import { nearestBuildings } from "./analysis";

export default function NearbyBuildings({ anchor, buildings, comparison, onAdd, onZoom, onStart, needsConfirmation }) {
  const nearby = nearestBuildings(buildings, anchor, 3);
  return <section id="nearby-tools" className="sidebar-section" aria-label="Choose nearby buildings">
    <h2 className="sidebar-section-title">2 · Compare nearby buildings</h2>
    {!anchor ? <p className="empty-hint">{needsConfirmation ? 'Confirm a reference footprint above to see nearby buildings.' : 'Search for a place above, or select a building on the map to start.'}</p> : <>
      <p className="journey-copy">Compare with <strong>{anchor.name || anchor.address || `Building ${anchor.id}`}</strong>.</p>
      <p className="data-note">Suggestions are the nearest loaded building centres, regardless of active filters. They are not recommendations or confirmed parts of the same property.</p>
      {nearby.length ? <>
        {comparison.every(id => id === anchor.id) && <button className="btn btn-primary" onClick={() => onStart([anchor.id, ...nearby.slice(0, 2).map(({building}) => building.id)])}>Compare with {nearby.length === 1 ? 'one neighbour' : 'two neighbours'}</button>}
        <ul className="nearby-list">{nearby.map(({building, distanceM}) => <li key={building.id}>
          <strong>{building.name || building.address || `Building ${building.id}`}</strong>
          <small>About {Math.round(distanceM)} m away · {building.height_m == null ? 'Height unavailable' : `${building.height_m} m tall`}</small>
          <div className="form-row"><button className="text-button" onClick={() => onZoom(building)} aria-label={`Inspect nearby building ${building.id}`}>Inspect on map</button><button className="text-button" disabled={!comparison.includes(building.id) && comparison.length >= 3} aria-pressed={comparison.includes(building.id)} onClick={() => onAdd(building.id)} aria-label={`Compare nearby building ${building.id}`}>{comparison.includes(building.id) ? 'Remove' : 'Add to comparison'}</button></div>
        </li>)}</ul>
      </> : <p className="empty-hint">No other loaded buildings have usable coordinates. Try another location or a larger study area.</p>}
      {comparison.length >= 3 && <p className="data-note">Your comparison has 3 buildings. Remove one below to make room.</p>}
    </>}
  </section>;
}
