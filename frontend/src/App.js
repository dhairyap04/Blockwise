/** Explore real Calgary buildings, inspect query results, and save named filters. */
import React, { useCallback, useEffect, useRef, useState } from "react";
import Visualizer from "./Visualizer";
import { api, describeFilter } from "./api";
import FilterEditor from "./FilterEditor";
import AnalysisSummary from "./AnalysisSummary";
import ProjectList from "./ProjectList";
import { sortBuildings, resultsCsv, downloadFile } from "./analysis";
import "./App.css";

class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return <div className="error-boundary"><h2>The 3D view could not start</h2><p>Try reloading the page in a browser with WebGL enabled.</p><button className="btn btn-primary" onClick={() => window.location.reload()}>Reload</button></div>;
    return this.props.children;
  }
}

function BuildingPopup({ building, onClose, onZoom }) {
  const close = useRef();
  useEffect(() => {
    const previous = document.activeElement;
    close.current?.focus();
    const key = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); if (previous?.isConnected) previous.focus(); };
  }, [building.id, onClose]);
  const value = building.assessed_value == null ? "Unavailable" : new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(building.assessed_value);
  return <div className="popup-card" role="dialog" aria-label="Building details" aria-modal="false">
    <div className="popup-header"><h2 className="popup-title">Building {building.id}</h2><button ref={close} className="popup-close" onClick={onClose} aria-label="Close building details">×</button></div>
    <table className="popup-table"><tbody>
      <tr><th>Address</th><td>{building.address || "Unavailable"}{building.address_count > 1 && ` (+${building.address_count - 1} other parcel addresses)`}</td></tr>
      <tr><th>Height</th><td>{building.height_m == null ? "Unavailable (shown at 1 m)" : `${building.height_m} m · ${building.height} ft`}</td></tr>
      <tr><th>Zoning</th><td>{building.zoning || "Unavailable"}</td></tr>
      <tr><th>Parcel assessment</th><td>{value}{building.assessment_year && ` (${building.assessment_year})`}</td></tr>
      <tr><th>Parcel overlap</th><td>{building.parcel_overlap==null ? "None recorded" : `${(building.parcel_overlap*100).toFixed(1)}% of footprint`}</td></tr>
      <tr><th>Stage</th><td>{building.stage}</td></tr>
      <tr><th>Coordinates</th><td>{building.latitude}, {building.longitude}</td></tr>
    </tbody></table>
    <p className="data-note">{building.parcel_id ? `Matched to parcel ${building.parcel_id} by majority footprint overlap. Assessment is for the parcel${building.assessment_rolls > 1 ? ` (${building.assessment_rolls} assessment rolls combined)` : ""}, and may cover several buildings.` : "No reliable parcel match. Address, zoning, and assessment are unavailable; no values have been invented."}</p>
    {building.property_match_reason && <p className="data-note">{building.property_match_reason}</p>}
    <button className="btn btn-secondary" onClick={() => onZoom(building)}>Zoom to this building</button><br />
    <a href="https://data.calgary.ca/d/cchr-krqg" target="_blank" rel="noreferrer">Building source</a>{building.parcel_id && <> · <a href="https://data.calgary.ca/d/4bsw-nn7w" target="_blank" rel="noreferrer">Parcel source</a></>}
  </div>;
}

function storedUsername() { try { return localStorage.getItem("city-username") || ""; } catch { return ""; } }

export default function App() {
  const [map, setMap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState("");
  const [query, setQuery] = useState("");
  const [queryBusy, setQueryBusy] = useState(false);
  const [queryError, setQueryError] = useState("");
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(null);
  const [username, setUsername] = useState(storedUsername);
  const [nameInput, setNameInput] = useState(storedUsername);
  const [projectName, setProjectName] = useState("");
  const [projects, setProjects] = useState([]);
  const [projectsBusy, setProjectsBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [identityBusy, setIdentityBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [projectsError, setProjectsError] = useState("");
  const [projectsRevision, setProjectsRevision] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [areaId, setAreaId] = useState("downtown");
  const [areas, setAreas] = useState([{id:"downtown",name:"Downtown"}]);
  const [areaError, setAreaError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("address");
  const [notes, setNotes] = useState("");
  const [focusTarget, setFocusTarget] = useState(null);
  const [streets, setStreets] = useState(true);
  const [viewMode, setViewMode] = useState("3d");
  const mapSequence = useRef(0);
  const querySequence = useRef(0);
  const identitySequence = useRef(0);
  const closeBuilding = useCallback(() => setSelected(null), []);

  const fetchBuildings = useCallback(async (signal, refresh = false, area = "downtown", projectSequence) => {
    const requestId = ++mapSequence.current;
    setLoading(true); setMapError(""); setMap(null); setFocusTarget(null); setSearch("");
    if (projectSequence == null) querySequence.current += 1;
    setQueryBusy(projectSequence != null); setQueryError(""); setResult(null); setSelected(null);
    try {
      const params = new URLSearchParams({area}); if (refresh) params.set("refresh","1");
      const data = await api(`/api/buildings?${params}`, { signal });
      if (!signal?.aborted && requestId===mapSequence.current) { setMap(data);setAreaId(data.area || area);return data; }
    } catch (error) { if (error.name !== "AbortError" && requestId===mapSequence.current) setMapError(error.message); }
    finally { if (!signal?.aborted && requestId===mapSequence.current) setLoading(false); }
    return null;
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    api("/api/areas",{signal:controller.signal}).then(data => {if (!controller.signal.aborted) setAreas(data.areas);}).catch(error => {if (error.name!=="AbortError") setAreaError("Neighbourhood list unavailable. Reload to retry; downtown is still available.");});
    return () => controller.abort();
  },[]);
  useEffect(() => {
    const controller = new AbortController(); fetchBuildings(controller.signal);
    return () => controller.abort();
  }, [fetchBuildings]);

  useEffect(() => {
    const controller = new AbortController();
    setProjects([]); setProjectsError("");
    if (!username) { setProjectsBusy(false); return () => controller.abort(); }
    setProjectsBusy(true);
    api(`/api/users/${encodeURIComponent(username)}/projects`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setProjects(data.projects); })
      .catch(error => { if (error.name !== "AbortError") setProjectsError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setProjectsBusy(false); });
    return () => controller.abort();
  }, [username, projectsRevision]);

  async function runQuery(body, sequence = ++querySequence.current, queryMap = map) {
    setQueryBusy(true); setQueryError(""); setMessage(null);
    try {
      const data = await api("/api/query", { method: "POST", body: { ...body, area:queryMap?.area || "downtown", datasetVersion: queryMap?.datasetVersion } });
      if (sequence !== querySequence.current) return false;
      setResult({ ...data, query: body.query ?? "", area:queryMap?.area || "downtown" });
      return true;
    } catch (error) {
      if (sequence === querySequence.current) setQueryError(error.message);
      return false;
    } finally { if (sequence === querySequence.current) setQueryBusy(false); }
  }

  async function identify(event) {
    event.preventDefault(); setMessage(null); setIdentityBusy(true);
    const sequence = ++identitySequence.current;
    try {
      const user = await api("/api/user", { method: "POST", body: { username: nameInput.trim() } });
      if (sequence !== identitySequence.current) return;
      setUsername(user.username); setNameInput(user.username);
      try { localStorage.setItem("city-username", user.username); } catch { /* Storage may be disabled. */ }
      setMessage({ type: "success", text: `Using ${user.username}.` });
    } catch (error) { setMessage({ type: "error", text: error.message }); }
    finally { setIdentityBusy(false); }
  }

  async function saveProject(event) {
    event.preventDefault(); setMessage(null);
    if (!username || !result) { setMessage({ type: "error", text: "Choose a username and apply a query first." }); return; }
    setSaveBusy(true);
    try {
      await api(`/api/users/${encodeURIComponent(username)}/projects`, { method: "POST", body: { name: projectName.trim(), filters: result.filters, query: result.query, area:result.area, notes } });
      setMessage({ type: "success", text: `Saved “${projectName.trim()}”.` });
      setProjectName(""); setProjectsRevision(value => value + 1);
    } catch (error) { setMessage({ type: "error", text: error.message }); }
    finally { setSaveBusy(false); }
  }

  async function loadProject(id) {
    const sequence = ++querySequence.current;
    setMessage(null); setQueryBusy(true);
    try {
      const project = await api(`/api/projects/${id}?username=${encodeURIComponent(username)}`);
      if (sequence !== querySequence.current) return;
      const targetArea = project.area || "downtown";
      let targetMap = map;
      if (!map || (map.area || "downtown")!==targetArea) {
        setAreaId(targetArea);
        targetMap = await fetchBuildings(undefined,false,targetArea,sequence);
      }
      if (sequence !== querySequence.current) return;
      if (!targetMap) {setQueryBusy(false);return;}
      if (await runQuery({ filters: project.filters, query: project.query || "" }, sequence, targetMap)) {
        setNotes(project.notes || "");
        setQuery(project.query || "");
        setMessage({ type: "success", text: `Loaded “${project.name}” and applied its filters.` });
      }
    } catch (error) {
      if (sequence === querySequence.current) {
        setQueryBusy(false); setMessage({ type: "error", text: error.message });
      }
    }
  }

  const idSet = new Set(result?.buildingIds || []);
  const visibleBuildings = sortBuildings((map?.buildings || []).filter(b => (!result || idSet.has(b.id)) &&
    (!search.trim() || `${b.address || ""} ${b.id}`.toLowerCase().includes(search.trim().toLowerCase()))), sort);
  const highlightedIds = search.trim() ? visibleBuildings.map(b => b.id) : result?.buildingIds || [];
  function zoomTo(building) {setSelected(building);setFocusTarget({building,revision:Date.now()});}
  function exportData(format) {
    const context = {area:map?.area || areaId, bbox:map?.bbox, sort, filters:result?.filters || null,query:result?.query || "",search,notes,
      datasetVersion:map?.datasetVersion,fetchedAt:map?.fetchedAt,sources:map?.sources || []};
    const name = `calgary-${context.area}-results`;
    if (format==="csv") downloadFile(`${name}.csv`,resultsCsv(visibleBuildings,context),"text/csv;charset=utf-8");
    else downloadFile(`${name}.json`,JSON.stringify({...context,exportedAt:new Date().toISOString(),
      assessmentNote:"Assessments are parcel values, repeated across buildings on the same parcel. Do not sum them as building values.",
      buildings:visibleBuildings},null,2),"application/json");
  }
  return <div className="app-root">
    <aside className="sidebar">
      <header className="sidebar-header"><h1 className="sidebar-title">Urban Design 3D</h1><p className="sidebar-subtitle">Explore Calgary through its buildings.</p></header>
      <section className="sidebar-section"><h2 className="sidebar-section-title">Explore an area</h2>
        <label htmlFor="area">Neighbourhood</label><select id="area" className="input-text" value={areaId} disabled={loading || queryBusy || saveBusy} onChange={e => {setAreaId(e.target.value);setNotes("");fetchBuildings(undefined,false,e.target.value);}}>{areas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}</select>
        <p className="data-note">A bounded study area of several blocks. Switching areas clears active filters.</p>{areaError && <p className="message message-info">{areaError}</p>}
      </section>
      <section className="sidebar-section"><h2 className="sidebar-section-title">Your projects</h2>
        <form onSubmit={identify} className="identity-form"><label htmlFor="username">Username</label><input id="username" className="input-text" value={nameInput} onChange={e => setNameInput(e.target.value)} maxLength={80} required placeholder="e.g. Alex" />
          <button className="btn btn-secondary" disabled={identityBusy || saveBusy || queryBusy || !nameInput.trim()}>{identityBusy ? "Choosing…" : "Use name"}</button></form>
        <p className="data-note">{username ? `Current name: ${username}. ` : ""}Names identify saved projects; they are not private accounts.</p>
      </section>
      <section className="sidebar-section"><h2 className="sidebar-section-title">Query the map</h2>
        <form onSubmit={e => { e.preventDefault(); runQuery({ query: query.trim() }); }}>
          <label className="sr-only" htmlFor="query">Natural language query</label><input id="query" className="input-text" value={query} onChange={e => setQuery(e.target.value)} maxLength={1000} required placeholder="Buildings over 100 feet" />
          <p className="data-note">Try “over 30 metres”, “commercial buildings”, “RC-G zoning”, or “under $500,000”. Assessment queries use parcel values.</p>
          <div className="form-row"><button className="btn btn-primary" disabled={loading || !map || queryBusy || !query.trim()}>{queryBusy ? "Applying…" : "Apply"}</button>
            <button type="button" className="btn btn-secondary" disabled={!result && !queryError} onClick={() => { querySequence.current += 1; setResult(null); setQueryError(""); setQueryBusy(false); }}>Clear filters</button></div>
        </form>
        <FilterEditor filter={result?.filters} onApply={filters => runQuery({filters,source:"controls"})} disabled={loading || !map || queryBusy} />
        {queryError && <p className="message message-error" role="alert">{queryError}</p>}
        {result && <div className="query-result" role="status"><strong>{highlightedIds.length} {highlightedIds.length === 1 ? "match" : "matches"}</strong><p>{describeFilter(result.filters)}</p><small>{result.parser === "llm" ? "Interpreted by LLM" : result.parser === "saved" ? "Saved filters reapplied" : result.parser === "controls" ? "Applied filter controls" : "Interpreted by query rules"}</small>{result.warning && <p className="data-note">{result.warning}</p>}{!highlightedIds.length && <p>No buildings match in this area. Try a different condition.</p>}</div>}
      </section>
      <section className="sidebar-section"><h2 className="sidebar-section-title">Save analysis</h2><form onSubmit={saveProject}>
        <label className="sr-only" htmlFor="project-name">Project name</label><input id="project-name" className="input-text" value={projectName} onChange={e => setProjectName(e.target.value)} maxLength={120} placeholder="Project name" required />
        <label htmlFor="analysis-notes">Analysis notes</label><textarea id="analysis-notes" className="input-text" maxLength={4000} value={notes} onChange={e => setNotes(e.target.value)} placeholder="What did you notice?" />
        <button className="btn btn-success" disabled={!username || !result || queryBusy || saveBusy || !projectName.trim()}>{saveBusy ? "Saving…" : "Save project"}</button></form>
        {projectsBusy ? <p role="status">Loading projects…</p> : projectsError ? <p className="message message-error" role="alert">{projectsError} <button className="text-button" onClick={() => setProjectsRevision(v => v + 1)}>Retry projects</button></p> : projects.length ? <ProjectList key={username} projects={projects} username={username} areas={areas} disabled={queryBusy || loading || !map || saveBusy} onLoad={loadProject} onNotice={setMessage} onRefresh={() => setProjectsRevision(v => v+1)} /> : <p className="empty-hint">{username ? "No saved projects yet." : "Choose a name to load and save analyses."}</p>}
        {message && <p className={`message message-${message.type}`} role={message.type === "error" ? "alert" : "status"}>{message.text}</p>}
      </section>
      {map && <section className="sidebar-section"><h2 className="sidebar-section-title">{result ? "Matching buildings" : "Buildings in this area"}</h2>
        <label htmlFor="address-search">Find address or building ID in this area</label><input id="address-search" className="input-text" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="e.g. 6 AV or 1427820" />
        <label htmlFor="result-sort">Sort results</label><select id="result-sort" className="input-text" value={sort} onChange={e => setSort(e.target.value)}><option value="address">Address</option><option value="tallest">Tallest first</option><option value="shortest">Shortest first</option><option value="assessment">Highest parcel assessment</option></select>
        <p className="data-note">{visibleBuildings.length} displayed. Select for details, or zoom directly to a building.</p>
        <ul className="building-list">{visibleBuildings.map(b => <li key={b.id} className="result-item"><button className="project-item" aria-pressed={selected?.id === b.id} onClick={() => setSelected(b)}>{b.address || `Building ${b.id}`}<small>{b.height_m == null ? "Height unavailable" : `${b.height_m} m`}</small></button><button className="text-button" aria-label={`Zoom to building ${b.id}`} onClick={() => zoomTo(b)}>Zoom to building</button></li>)}</ul>
        {!visibleBuildings.length && <p className="empty-hint">No displayed results. Clear the address search or adjust your filters.</p>}
        <AnalysisSummary buildings={visibleBuildings} />
        <div className="form-row"><button className="btn btn-secondary" disabled={!visibleBuildings.length || loading} onClick={() => exportData("csv")}>Export CSV</button><button className="btn btn-secondary" disabled={!visibleBuildings.length || loading} onClick={() => exportData("json")}>Export analysis JSON</button></div>
      </section>}
      {map && <footer className="data-note">{map.buildings.length} buildings · {map.matchedParcels} parcel matches.<br />Fetched {new Date(map.fetchedAt * 1000).toLocaleString()}.<br />{map.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.name}</a>)}<p>Unmatched property fields are unavailable. Zoning categories follow district-code prefixes.</p></footer>}
    </aside>
    <main className="map-container" aria-label="Calgary building map">
      {loading ? <div className="map-overlay"><div className="loading-content" role="status"><div className="spinner" aria-hidden="true" /><span>Loading Calgary buildings and parcel data…</span></div></div> : mapError ? <div className="map-overlay error"><div className="loading-content"><p role="alert">{mapError}</p><button className="btn btn-primary" onClick={() => fetchBuildings(undefined, true, areaId)}>Retry map</button></div></div> : map?.buildings.length ? <>
        <div className="map-toolbar"><button className="btn btn-secondary" onClick={() => {setViewMode("3d");setResetKey(v => v+1);}}>Reset view</button><button className="btn btn-secondary" onClick={() => {setViewMode("top");setResetKey(v => v+1);}}>Top view</button><label className="map-layer-toggle"><input type="checkbox" checked={streets} onChange={e => setStreets(e.target.checked)} /> Street map</label><span>Drag to orbit · Scroll to zoom · Right-drag to pan</span></div>
        <ErrorBoundary><Visualizer buildings={map.buildings} origin={map.origin} bbox={map.bbox} streets={streets} viewMode={viewMode} focusTarget={focusTarget} highlightedIds={highlightedIds} selectedBuilding={selected} onSelectBuilding={setSelected} resetKey={resetKey} /></ErrorBoundary>
        <div className="map-legend" aria-label="Map legend"><span><i className="legend-default" />Buildings</span><span><i className="legend-match" />Matches</span><span><i className="legend-selected" />Selected</span><span><i className="legend-area" />Study area</span><span>Metres · True height scale</span></div>
      </> : <div className="map-overlay"><p>No buildings were returned. <button className="btn btn-primary" onClick={() => fetchBuildings(undefined, true, areaId)}>Retry map</button></p></div>}
      {selected && !loading && !mapError && <BuildingPopup building={selected} onClose={closeBuilding} onZoom={zoomTo} />}
    </main>
  </div>;
}
