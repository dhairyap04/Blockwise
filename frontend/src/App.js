import React, { useState } from "react";
import { BrowserRouter as Router, Route, Routes, Link } from "react-router-dom";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "20px", color: "red" }}>
          <h2>Something went wrong.</h2>
          <pre>{this.state.error?.toString()}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}

function BuildingDetails({ building }) {
  return (
    <div style={{ padding: "20px" }}>
      <h2>{building.name}</h2>
      <pre style={{ background: "#f4f4f4", padding: "10px" }}>
        {JSON.stringify(building, null, 2)}
      </pre>
      <Link to="/" style={{ marginTop: "10px", display: "inline-block" }}>Back to Results</Link>
    </div>
  );
}

function App() {
  const [buildings, setBuildings] = useState([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [results, setResults] = useState(null); // State to store JSON results

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Submitting query:", query);

    try {
      const res = await fetch("http://127.0.0.1:5000/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) {
        console.error("API call failed with status:", res.status);
        setMessage("Failed to fetch buildings. Please try again.");
        return;
      }

      const data = await res.json();
      console.log("API response:", data);
      setResults(data); // Store the JSON results
      setMessage(""); // Clear any previous messages
    } catch (error) {
      console.error("Error during API call:", error);
      setMessage("An error occurred. Please try again.");
    }
  };

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <form onSubmit={handleSubmit} style={{ padding: "10px" }}>
                  <input
                    type="text"
                    value={query}
                    placeholder="e.g. asset_type = HISTORIC BUILDING"
                    onChange={(e) => setQuery(e.target.value)}
                    style={{ width: "300px", padding: "5px" }}
                  />
                  <button type="submit" style={{ marginLeft: "10px" }}>Search</button>
                </form>

                {message && <p>{message}</p>}

                {results && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginTop: "20px" }}>
                    {results.map((result, index) => (
                      <Link
                        to={`/building/${index}`}
                        key={index}
                        style={{ textDecoration: "none", color: "inherit" }}
                      >
                        <div style={{ border: "1px solid #ccc", borderRadius: "5px", padding: "10px", background: "#f9f9f9" }}>
                          <h3>{result.name || "Unknown Name"}</h3>
                          <p>{result.location_detail || "Unknown Location"}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            }
          />
          <Route
            path="/building/:id"
            element={<BuildingDetails building={results ? results[parseInt(window.location.pathname.split("/").pop())] : {}} />}
          />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
