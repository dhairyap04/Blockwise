/** Explore real Calgary buildings, inspect query results, and save named filters. */
import React, { useCallback, useEffect, useRef, useState } from "react";
import Visualizer from "./Visualizer";
import { api, describeFilter } from "./api";
import "./App.css";

class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return <div className="error-boundary"><h2>The 3D view could not start</h2><p>Try reloading the page in a browser with WebGL enabled.</p><button className="btn btn-primary" onClick={() => window.location.reload()}>Reload</button></div>;
    return this.props.children;
  }
}

function BuildingPopup({ building, onClose }) {
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
      <tr><th>Stage</th><td>{building.stage}</td></tr>
      <tr><th>Coordinates</th><td>{building.latitude}, {building.longitude}</td></tr>
    </tbody></table>
    <p className="data-note">{building.parcel_id ? `Matched to parcel ${building.parcel_id} by majority footprint overlap. Assessment is for the parcel${building.assessment_rolls > 1 ? ` (${building.assessment_rolls} assessment rolls combined)` : ""}, and may cover several buildings.` : "No reliable parcel match. Address, zoning, and assessment are unavailable; no values have been invented."}</p>
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
  const querySequence = useRef(0);
  const identitySequence = useRef(0);
  const closeBuilding = useCallback(() => setSelected(null), []);

  const fetchBuildings = useCallback(async (signal, refresh = false) => {
    setLoading(true); setMapError("");
    querySequence.current += 1;
    setQueryBusy(false); setResult(null); setSelected(null);
    try {
      const data = await api(`/api/buildings${refresh ? "?refresh=1" : ""}`, { signal });
      if (!signal?.aborted) setMap(data);
    } catch (error) { if (error.name !== "AbortError") setMapError(error.message); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);
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

  async function runQuery(body) {
    const sequence = ++querySequence.current;
    setQueryBusy(true); setQueryError("");
    try {
      const data = await api("/api/query", { method: "POST", body: { ...body, datasetVersion: map?.datasetVersion } });
      if (sequence !== querySequence.current) return false;
      setResult({ ...data, query: body.query ?? "" });
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
      await api(`/api/users/${encodeURIComponent(username)}/projects`, { method: "POST", body: { name: projectName.trim(), filters: result.filters, query: result.query } });
      setMessage({ type: "success", text: `Saved “${projectName.trim()}”.` });
      setProjectName(""); setProjectsRevision(value => value + 1);
    } catch (error) { setMessage({ type: "error", text: error.message }); }
    finally { setSaveBusy(false); }
  }

  async function loadProject(id) {
    setMessage(null); setQueryBusy(true);
    try {
      const project = await api(`/api/projects/${id}?username=${encodeURIComponent(username)}`);
      if (await runQuery({ filters: project.filters, query: project.query || "" })) {
        setQuery(project.query || "");
        setMessage({ type: "success", text: `Loaded “${project.name}” and applied its filters.` });
      }
    } catch (error) { setQueryBusy(false); setMessage({ type: "error", text: error.message }); }
  }

  const highlightedIds = result?.buildingIds || [];
  const idSet = new Set(highlightedIds);
  const visibleBuildings = (map?.buildings || []).filter(b => !result || idSet.has(b.id));
  return <div className="app-root">
    <aside className="sidebar">
      <header className="sidebar-header"><h1 className="sidebar-title">Urban Design 3D</h1><p className="sidebar-subtitle">Explore downtown Calgary through its buildings.</p></header>
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
        {queryError && <p className="message message-error" role="alert">{queryError}</p>}
        {result && <div className="query-result" role="status"><strong>{highlightedIds.length} {highlightedIds.length === 1 ? "match" : "matches"}</strong><p>{describeFilter(result.filters)}</p><small>{result.parser === "llm" ? "Interpreted by LLM" : result.parser === "saved" ? "Saved filters reapplied" : "Interpreted by query rules"}</small>{result.warning && <p className="data-note">{result.warning}</p>}{!highlightedIds.length && <p>No buildings match in this area. Try a different condition.</p>}</div>}
      </section>
      <section className="sidebar-section"><h2 className="sidebar-section-title">Save analysis</h2><form onSubmit={saveProject}>
        <label className="sr-only" htmlFor="project-name">Project name</label><input id="project-name" className="input-text" value={projectName} onChange={e => setProjectName(e.target.value)} maxLength={120} placeholder="Project name" required />
        <button className="btn btn-success" disabled={!username || !result || queryBusy || saveBusy || !projectName.trim()}>{saveBusy ? "Saving…" : "Save project"}</button></form>
        {projectsBusy ? <p role="status">Loading projects…</p> : projectsError ? <p className="message message-error" role="alert">{projectsError} <button className="text-button" onClick={() => setProjectsRevision(v => v + 1)}>Retry projects</button></p> : projects.length ? <ul className="project-list">{projects.map(p => <li key={p.id}><button className="project-item" disabled={queryBusy || loading || !map} onClick={() => loadProject(p.id)}>{p.name}</button></li>)}</ul> : <p className="empty-hint">{username ? "No saved projects yet." : "Choose a name to load and save analyses."}</p>}
        {message && <p className={`message message-${message.type}`} role={message.type === "error" ? "alert" : "status"}>{message.text}</p>}
      </section>
      {map && <section className="sidebar-section"><h2 className="sidebar-section-title">{result ? "Matching buildings" : "Buildings in this area"}</h2><p className="data-note">Select a building here or on the map.</p><ul className="building-list">{visibleBuildings.map(b => <li key={b.id}><button className="project-item" aria-pressed={selected?.id === b.id} onClick={() => setSelected(b)}>{b.address || `Building ${b.id}`}<small>{b.height_m == null ? "Height unavailable" : `${b.height_m} m`}</small></button></li>)}</ul></section>}
      {map && <footer className="data-note">{map.buildings.length} buildings · {map.matchedParcels} parcel matches.<br />Fetched {new Date(map.fetchedAt * 1000).toLocaleString()}.<br />{map.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.name}</a>)}<p>Unmatched property fields are unavailable. Zoning categories follow district-code prefixes.</p></footer>}
    </aside>
    <main className="map-container" aria-label="Calgary building map">
      {loading ? <div className="map-overlay"><div className="loading-content" role="status"><div className="spinner" aria-hidden="true" /><span>Loading Calgary buildings and parcel data…</span></div></div> : mapError ? <div className="map-overlay error"><div className="loading-content"><p role="alert">{mapError}</p><button className="btn btn-primary" onClick={() => fetchBuildings(undefined, true)}>Retry map</button></div></div> : map?.buildings.length ? <>
        <div className="map-toolbar"><button className="btn btn-secondary" onClick={() => setResetKey(v => v + 1)}>Reset view</button><span>Drag to orbit · Scroll to zoom · Right-drag to pan</span></div>
        <ErrorBoundary><Visualizer buildings={map.buildings} highlightedIds={highlightedIds} selectedBuilding={selected} onSelectBuilding={setSelected} resetKey={resetKey} /></ErrorBoundary>
        <div className="map-legend" aria-label="Map legend"><span><i className="legend-default" />Buildings</span><span><i className="legend-match" />Matches</span><span><i className="legend-selected" />Selected</span><span>Metres · True height scale</span></div>
      </> : <div className="map-overlay"><p>No buildings were returned. <button className="btn btn-primary" onClick={() => fetchBuildings(undefined, true)}>Retry map</button></p></div>}
      {selected && !loading && !mapError && <BuildingPopup building={selected} onClose={closeBuilding} />}
    </main>
  </div>;
}
