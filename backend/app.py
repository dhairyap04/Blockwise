"""HTTP API and optional same-origin production frontend for the city dashboard."""
import hashlib
import json
import os
import threading
import time
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

# Load paths and provider settings before modules read their environment.
load_dotenv(Path(__file__).with_name(".env"))

import database
from data import fetch_and_normalize_buildings, SOURCES
from areas import AREAS, get_area, create_address_area
from geocoding import search_addresses, verify_address, ADDRESS_SOURCE
from llm_filter import parse_query, apply_filter, validate_filter


class BuildingStore:
    """A successful snapshot expires; errors are never cached as empty successes."""
    def __init__(self):
        self.snapshots = {}
        self.lock = threading.Lock()
        self.path = Path(os.getenv("BUILDINGS_CACHE_PATH", str(Path(__file__).parent / ".cache/buildings.json")))
        self.ttl = int(os.getenv("BUILDINGS_CACHE_TTL", "3600"))

    def get(self, refresh=False, area_id="downtown"):
        area = get_area(area_id)
        with self.lock:
            path = self.path.with_name(f"{self.path.stem}-{area_id}{self.path.suffix}")
            snapshot = self.snapshots.get(area_id)
            if snapshot is None and path.exists():
                try:
                    candidate = json.loads(path.read_text())
                    if candidate.get("schema") == 3 and candidate.get("area") == area_id and candidate.get("buildings"):
                        snapshot = candidate
                except (OSError, ValueError, TypeError):
                    pass
            if refresh or snapshot is None or time.time() - snapshot["fetched_at"] > self.ttl:
                buildings, origin = fetch_and_normalize_buildings(area["bbox"])
                snapshot = {"schema":3,"buildings":buildings,"origin":origin,"area":area_id,"fetched_at":time.time()}
                snapshot["version"] = hashlib.sha256(json.dumps({"area":area_id,"buildings":buildings},sort_keys=True).encode()).hexdigest()[:16]
                try:
                    path.parent.mkdir(parents=True,exist_ok=True)
                    temp = path.with_suffix(".tmp")
                    temp.write_text(json.dumps(snapshot,allow_nan=False)); temp.replace(path)
                except OSError:
                    pass
            self.snapshots[area_id] = snapshot
            while len(self.snapshots)>12:
                oldest=next(key for key in self.snapshots if key!=area_id)
                self.snapshots.pop(oldest)
            return snapshot


def create_app():
    build_dir = Path(__file__).resolve().parent.parent / "frontend/build"
    app = Flask(__name__, static_folder=None)
    app.config["MAX_CONTENT_LENGTH"] = 16 * 1024
    origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")]
    CORS(app, resources={r"/api/*": {"origins": origins}})
    store = BuildingStore()
    app.extensions["buildings"] = store
    database.init_db()

    def body():
        value = request.get_json(silent=True)
        if not isinstance(value, dict):
            raise ValueError("Send a JSON object.")
        return value

    @app.errorhandler(ValueError)
    def invalid(error):
        return jsonify(error=str(error)), 400

    @app.errorhandler(RuntimeError)
    def upstream(error):
        app.logger.warning("Building source unavailable")
        return jsonify(error=str(error)), 503

    @app.errorhandler(HTTPException)
    def http_error(error):
        return jsonify(error=error.description), error.code

    @app.errorhandler(Exception)
    def unexpected(error):
        app.logger.exception("Unhandled request error")
        return jsonify(error="An unexpected server error occurred. Please retry."), 500

    @app.get("/api/health")
    def health():
        return jsonify(status="ok", llmConfigured=bool(os.getenv("HF_API_KEY") or os.getenv("HF_TOKEN")))

    @app.get("/api/areas")
    def areas():
        return jsonify(areas=list(AREAS.values()))

    @app.get("/api/addresses")
    def addresses():
        return jsonify(matches=search_addresses(request.args.get("q")),source=ADDRESS_SOURCE)

    @app.post("/api/areas/address")
    def address_area():
        data=body()
        size=data.get("size_m",600)
        if isinstance(size,bool) or size not in (400,600,800):raise ValueError("Choose a 400, 600, or 800 metre study area.")
        match=verify_address(data.get("address"),data.get("latitude"),data.get("longitude"))
        return jsonify(create_address_area(match,size)),201

    @app.get("/api/buildings")
    def buildings():
        area = get_area(request.args.get("area", "downtown"))
        snapshot = store.get(refresh=request.args.get("refresh") == "1", area_id=area["id"])
        lon, lat = snapshot["origin"]
        return jsonify(buildings=snapshot["buildings"], origin={"lon": lon, "lat": lat},
                       datasetVersion=snapshot["version"], fetchedAt=snapshot["fetched_at"],
                       bbox=area["bbox"], area=area["id"], areaName=area["name"], areaDescriptor=area,
                       sources=SOURCES+([area["source"]] if area.get("source") else []),
                       matchedParcels=sum(b.get("parcel_id") is not None for b in snapshot["buildings"]))

    @app.post("/api/query")
    def query():
        data = body()
        if "filters" in data:
            filt, parser, warning = validate_filter(data["filters"]), "controls" if data.get("source") == "controls" else "saved", None
        else:
            filt, parser, warning = parse_query(data.get("query"), os.getenv("HF_API_KEY") or os.getenv("HF_TOKEN"))
        area = get_area(data.get("area", "downtown"))
        snapshot = store.get(area_id=area["id"])
        if data.get("datasetVersion") and data["datasetVersion"] != snapshot["version"]:
            return jsonify(error="Building data changed. Reload the map before applying this query."), 409
        return jsonify(buildingIds=apply_filter(snapshot["buildings"], filt), filters=filt,
                       parser=parser, warning=warning, datasetVersion=snapshot["version"])

    @app.post("/api/user")
    def user():
        return jsonify(database.get_or_create_user(body().get("username")))

    @app.get("/api/users/<username>/projects")
    def projects(username):
        user = database.get_user(username)
        projects=database.list_projects(user["id"]) if user else []
        for project in projects:project["areaDescriptor"]=get_area(project["area"])
        return jsonify(projects=projects)

    @app.post("/api/users/<username>/projects")
    def save(username):
        data = body()
        # Validate before creating a user or writing anything.
        name = database.validate_name(data.get("name"), "Project name", 120)
        filt = validate_filter(data.get("filters"))
        original_query = data.get("query", "")
        if not isinstance(original_query, str) or len(original_query) > 1000:
            raise ValueError("Query must be text of at most 1,000 characters.")
        area = get_area(data.get("area", "downtown"))
        notes = database.validate_notes(data.get("notes", ""))
        user = database.get_or_create_user(username)
        return jsonify(database.save_project(user["id"], name, filt, original_query, area["id"], notes)), 201

    @app.get("/api/projects/<int:project_id>")
    def load(project_id):
        user = database.get_user(request.args.get("username"))
        project = database.get_project(project_id, user["id"]) if user else None
        if project is None:
            return jsonify(error="Project not found for this username."), 404
        project["areaDescriptor"]=get_area(project["area"])
        return jsonify(project)

    @app.route("/api/projects/<int:project_id>", methods=["PATCH", "DELETE"])
    def edit_project(project_id):
        user = database.get_user(request.args.get("username"))
        if not user or not database.get_project(project_id, user["id"]):
            return jsonify(error="Project not found for this username."), 404
        if request.method == "DELETE":
            database.delete_project(project_id, user["id"])
            return "", 204
        data = body()
        name = database.validate_name(data.get("name"), "Project name", 120)
        notes = database.validate_notes(data.get("notes", ""))
        return jsonify(database.update_project(project_id, user["id"], name, notes))

    @app.get("/")
    @app.get("/<path:path>")
    def frontend(path=""):
        if path.startswith("api/"):
            return jsonify(error="API route not found."), 404
        if (build_dir / path).is_file():
            return send_from_directory(build_dir, path)
        if (build_dir / "index.html").is_file():
            return send_from_directory(build_dir, "index.html")
        return jsonify(status="ok", message="Backend running. Start the React frontend on port 3000.")

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.getenv("PORT", "5001")), debug=os.getenv("FLASK_DEBUG") == "1")
