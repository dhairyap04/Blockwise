"""
Flask backend: Calgary 3D building data, LLM query parsing, and project persistence.
"""
from flask import Flask, jsonify, request
from flask_cors import CORS
import os
from dotenv import load_dotenv

from data import fetch_and_normalize_buildings
from llm_filter import extract_filter_from_query, apply_filter
from database import init_db, get_or_create_user, list_projects, save_project, get_project

load_dotenv()
HF_API_KEY = os.getenv("HF_API_KEY")
if HF_API_KEY:
    print(f"Hugging Face API Key loaded: {HF_API_KEY[:4]}...")
else:
    print("Hugging Face API key missing; using rule-based query fallback.")

app = Flask(__name__)
CORS(app)

# In-memory cache for building data (one bbox)
_buildings_cache = None
_origin_cache = None


def get_buildings_data():
    global _buildings_cache, _origin_cache
    if _buildings_cache is None:
        try:
            _buildings_cache, _origin_cache = fetch_and_normalize_buildings()
        except Exception as e:
            print("Failed to fetch buildings:", e)
            _buildings_cache, _origin_cache = [], (0.0, 0.0)
    return _buildings_cache, _origin_cache


@app.route("/")
def index():
    return "Urban Design 3D City Dashboard – Flask backend is running."


@app.route("/api/buildings")
def api_buildings():
    """Return normalized buildings and origin for the 3D view (3–4 block area)."""
    try:
        buildings, origin = get_buildings_data()
        return jsonify({"buildings": buildings, "origin": {"lon": origin[0], "lat": origin[1]}})
    except Exception as e:
        print("Error in /api/buildings:", e)
        return jsonify({"error": "Failed to load building data"}), 500


@app.route("/api/query", methods=["POST"])
def api_query():
    """
    Natural language query -> LLM extracts filter -> apply to buildings -> return matching ids.
    Body: { "query": "..." } or { "filters": { "attribute", "operator", "value" } } (for loading saved project).
    Response: { "buildingIds": ["id1", ...], "filters": { ... } }
    """
    data = request.json or {}
    filters = data.get("filters")
    if filters and isinstance(filters, dict):
        # Apply saved filters directly (e.g. when loading a project)
        try:
            buildings, _ = get_buildings_data()
            building_ids = apply_filter(buildings, filters)
            return jsonify({"buildingIds": building_ids, "filters": filters})
        except Exception as e:
            print("Error applying filters:", e)
            return jsonify({"error": "Failed to apply filters"}), 500
    user_input = (data.get("query") or "").strip()
    if not user_input:
        return jsonify({"error": "Query or filters required"}), 400
    try:
        buildings, _ = get_buildings_data()
        filt = extract_filter_from_query(user_input, HF_API_KEY)
        building_ids = apply_filter(buildings, filt)
        return jsonify({"buildingIds": building_ids, "filters": filt})
    except Exception as e:
        print("Error in /api/query:", e)
        return jsonify({"error": "Failed to process query"}), 500


# ---------- User & project persistence ----------
init_db()


@app.route("/api/user", methods=["POST"])
def api_user():
    """Identify user by username. Body: { "username": "..." }. Returns { "id", "username" }."""
    data = request.json or {}
    username = (data.get("username") or "").strip()
    try:
        user = get_or_create_user(username)
        return jsonify(user)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/users/<username>/projects", methods=["GET"])
def api_list_projects(username):
    """List saved projects for the user."""
    try:
        user = get_or_create_user(username)
        projects = list_projects(user["id"])
        return jsonify({"projects": projects})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/users/<username>/projects", methods=["POST"])
def api_save_project(username):
    """Save current filter state as a project. Body: { "name": "...", "filters": { ... } }."""
    data = request.json or {}
    name = (data.get("name") or "").strip()
    filters = data.get("filters") or {}
    try:
        user = get_or_create_user(username)
        project = save_project(user["id"], name, filters)
        return jsonify(project)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/projects/<int:project_id>")
def api_get_project(project_id):
    """Load a project by id. Query: ?username=... (must own the project)."""
    username = (request.args.get("username") or "").strip()
    if not username:
        return jsonify({"error": "username required"}), 400
    try:
        user = get_or_create_user(username)
        project = get_project(project_id, user["id"])
        if not project:
            return jsonify({"error": "Project not found"}), 404
        return jsonify(project)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


if __name__ == "__main__":
    app.run(debug=True, port=5000)
