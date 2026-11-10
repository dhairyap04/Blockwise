/**
 * Urban Design 3D City Dashboard – Calgary map with LLM query and project save/load.
 */
import React, { useState, useEffect, useCallback } from "react";
import Visualizer from "./Visualizer";
import "./App.css";

const API_BASE = "http://127.0.0.1:5000";

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("ErrorBoundary:", error, info);
  }
  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <pre>{this.state.error.toString()}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function BuildingPopup({ building, onClose }) {
  if (!building) return null;
  const { address, height, height_m, zoning, assessed_value, stage, id } = building;
  return (
    <>
      <div className="popup-backdrop" aria-hidden onClick={onClose} />
      <div className="popup-card" role="dialog" aria-label="Building details">
        <div className="popup-header">
          <h3 className="popup-title">Building details</h3>
          <button type="button" className="popup-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <table className="popup-table">
          <tbody>
            <tr><td>ID</td><td>{id}</td></tr>
            <tr><td>Address</td><td>{address || "—"}</td></tr>
            <tr><td>Height</td><td>{height != null ? `${height} ft` : "—"} {height_m != null && `(${height_m} m)`}</td></tr>
            <tr><td>Zoning</td><td>{zoning || "—"}</td></tr>
            <tr><td>Assessed value</td><td>{assessed_value != null ? `$${Number(assessed_value).toLocaleString()}` : "—"}</td></tr>
            <tr><td>Stage</td><td>{stage || "—"}</td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function App() {
  const [buildings, setBuildings] = useState([]);
  const [origin, setOrigin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState("");
  const [highlightedIds, setHighlightedIds] = useState([]);
  const [currentFilters, setCurrentFilters] = useState(null);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [username, setUsername] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projects, setProjects] = useState([]);
  const [projectMessage, setProjectMessage] = useState("");
  const [projectMessageType, setProjectMessageType] = useState("info");

  const fetchBuildings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/buildings`);
      if (!res.ok) throw new Error("Failed to load buildings");
      const data = await res.json();
      setBuildings(data.buildings || []);
      setOrigin(data.origin || null);
    } catch (e) {
      setError(e.message);
      setBuildings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBuildings();
  }, [fetchBuildings]);

  const runQuery = useCallback(async (body) => {
    setQueryError("");
    setQueryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Query failed");
      setHighlightedIds(data.buildingIds || []);
      setCurrentFilters(data.filters || null);
    } catch (e) {
      setQueryError(e.message);
      setHighlightedIds([]);
      setCurrentFilters(null);
    } finally {
      setQueryLoading(false);
    }
  }, []);

  const handleQuerySubmit = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    runQuery({ query: query.trim() });
  };

  const ensureUser = useCallback(async () => {
    const name = (username || "").trim();
    if (!name) return null;
    try {
      const res = await fetch(`${API_BASE}/api/user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "User failed");
      return data;
    } catch (e) {
      setProjectMessage(e.message);
      setProjectMessageType("error");
      return null;
    }
  }, [username]);

  const fetchProjects = useCallback(async () => {
    const name = (username || "").trim();
    if (!name) {
      setProjects([]);
      return;
    }
    await ensureUser();
    try {
      const res = await fetch(`${API_BASE}/api/users/${encodeURIComponent(name)}/projects`);
      if (!res.ok) throw new Error("Failed to load projects");
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (e) {
      setProjects([]);
    }
  }, [username, ensureUser]);

  useEffect(() => {
    if (username.trim()) fetchProjects();
    else setProjects([]);
  }, [username, fetchProjects]);

  const handleSaveProject = async (e) => {
    e.preventDefault();
    setProjectMessage("");
    const name = (projectName || "").trim();
    if (!name) {
      setProjectMessage("Enter a project name");
      setProjectMessageType("error");
      return;
    }
    const user = await ensureUser();
    if (!user) return;
    if (!currentFilters) {
      setProjectMessage("Run a query first to save its filters");
      setProjectMessageType("info");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/users/${encodeURIComponent(user.username)}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, filters: currentFilters }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setProjectMessage(`Saved "${name}"`);
      setProjectMessageType("success");
      setProjectName("");
      fetchProjects();
    } catch (e) {
      setProjectMessage(e.message);
      setProjectMessageType("error");
    }
  };

  const handleLoadProject = async (projectId) => {
    const name = (username || "").trim();
    if (!name) {
      setProjectMessage("Enter your username first");
      setProjectMessageType("error");
      return;
    }
    setProjectMessage("");
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}?username=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Load failed");
      const filters = typeof data.filters === "string" ? JSON.parse(data.filters) : data.filters;
      setCurrentFilters(filters);
      runQuery({ filters });
      setProjectMessage(`Loaded "${data.name || "project"}"`);
      setProjectMessageType("success");
    } catch (e) {
      setProjectMessage(e.message);
      setProjectMessageType("error");
    }
  };

  return (
    <ErrorBoundary>
      <div className="app-root">
        <aside className="sidebar">
          <div className="sidebar-header">
            <h1 className="sidebar-title">Urban Design 3D</h1>
            <p className="sidebar-subtitle">
              Calgary city blocks · Click a building for details, or query to highlight matches.
            </p>
          </div>

          <section className="sidebar-section">
            <h2 className="sidebar-section-title">Your name</h2>
            <input
              type="text"
              className="input-text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. Alex"
              aria-label="Your name"
            />
          </section>

          <section className="sidebar-section">
            <h2 className="sidebar-section-title">Query the map</h2>
            <form onSubmit={handleQuerySubmit}>
              <input
                type="text"
                className="input-text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. buildings over 100 feet"
                aria-label="Natural language query"
                style={{ marginBottom: 10 }}
              />
              <p className="sidebar-subtitle" style={{ margin: "0 0 10px 0", fontSize: "0.75rem" }}>
                Try: “over 50 feet”, “RC-G zoning”, “under $500,000”
              </p>
              <div className="form-row">
                <button type="submit" className="btn btn-primary" disabled={queryLoading || !query.trim()}>
                  {queryLoading ? "Applying…" : "Apply"}
                </button>
                {highlightedIds.length > 0 && (
                  <span className="sidebar-subtitle" style={{ alignSelf: "center", fontSize: "0.8rem" }}>
                    {highlightedIds.length} match{highlightedIds.length !== 1 ? "es" : ""}
                  </span>
                )}
              </div>
              {queryError && <p className="message message-error" style={{ marginTop: 8 }}>{queryError}</p>}
            </form>
          </section>

          <hr className="divider" />

          <section className="sidebar-section">
            <h2 className="sidebar-section-title">Save project</h2>
            <form onSubmit={handleSaveProject}>
              <input
                type="text"
                className="input-text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Project name"
                aria-label="Project name"
                style={{ marginBottom: 10 }}
              />
              <button type="submit" className="btn btn-success">
                Save project
              </button>
            </form>
          </section>

          <section className="sidebar-section">
            <h2 className="sidebar-section-title">Your projects</h2>
            {projects.length === 0 ? (
              <p className="empty-hint">None saved yet. Run a query, then save it with a name above.</p>
            ) : (
              <ul className="project-list">
                {projects.map((p) => (
                  <li key={p.id}>
                    <button type="button" className="project-item" onClick={() => handleLoadProject(p.id)}>
                      {p.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {projectMessage && (
            <p className={`message message-${projectMessageType}`}>{projectMessage}</p>
          )}
        </aside>

        <main className="map-container">
          {loading && (
            <div className="map-overlay">
              <div className="loading-content">
                <div className="spinner" aria-hidden />
                <span>Loading map…</span>
              </div>
            </div>
          )}
          {error && !loading && (
            <div className="map-overlay error">
              <div className="loading-content">
                <span>{error}</span>
                <button type="button" className="btn btn-primary" onClick={fetchBuildings}>
                  Retry
                </button>
              </div>
            </div>
          )}
          {!loading && !error && buildings.length > 0 && (
            <Visualizer
              buildings={buildings}
              origin={origin}
              highlightedIds={highlightedIds}
              selectedBuilding={selectedBuilding}
              onSelectBuilding={setSelectedBuilding}
            />
          )}
          {selectedBuilding && (
            <BuildingPopup building={selectedBuilding} onClose={() => setSelectedBuilding(null)} />
          )}
        </main>
      </div>
    </ErrorBoundary>
  );
}
