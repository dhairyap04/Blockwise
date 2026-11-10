# Urban Design 3D City Dashboard

A full-stack web dashboard that visualizes **Calgary city buildings in 3D**, with natural-language query (LLM), building click details, and save/load of map analyses.

## Features

- **Calgary Open Data**: Fetches 3D building footprints and heights from [City of Calgary Open Data](https://data.calgary.ca) (3D Buildings – Citywide) for a bounded downtown area (3–4+ blocks).
- **3D map**: Three.js (React Three Fiber) extruded buildings; orbit controls; click any building for a popup (address, height, zoning, assessed value, stage).
- **Natural language queries**: Text input (e.g. “highlight buildings over 100 feet”, “show RC-G zoning”, “buildings under $500,000”). The backend uses the **Hugging Face Inference API** to turn the query into a filter, then highlights matching buildings. Works without an API key via a rule-based fallback.
- **Project persistence**: Enter a username, run a query, then **Save project** with a name. **Load** a saved project to re-apply its filters and highlight the same set of buildings. Data is stored in SQLite.

## Stack

- **Backend**: Python, Flask, SQLite, Hugging Face Inference API (optional).
- **Frontend**: React, Three.js (@react-three/fiber, @react-three/drei).

## Setup

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Optional: create `backend/.env` with your Hugging Face API key for LLM-powered query parsing:

```env
HF_API_KEY=hf_xxxxxxxxxxxx
```

Get a free key at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) (enable “Inference” if required).

### Frontend

```bash
cd frontend
npm install
```

## Run

1. Start the backend (from `backend/` with venv active):

```bash
python app.py
```

Runs at `http://127.0.0.1:5000`.

2. Start the frontend (from `frontend/`):

```bash
npm start
```

Opens at `http://localhost:3000`. The app will request building data from the backend; ensure the backend is running.

## API (backend)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/buildings` | GET | Normalized buildings + origin for the 3D view |
| `/api/query` | POST | Body: `{ "query": "..." }` or `{ "filters": { ... } }`. Returns `{ buildingIds, filters }` |
| `/api/user` | POST | Body: `{ "username": "..." }`. Get or create user |
| `/api/users/<username>/projects` | GET | List saved projects for user |
| `/api/users/<username>/projects` | POST | Body: `{ "name", "filters" }`. Save project |
| `/api/projects/<id>?username=...` | GET | Load one project (filters) |

## Data and filters

- Building attributes used for filtering: `height` (ft), `height_m`, `zoning`, `assessed_value`, `address`, `stage`. Zoning and assessed value are synthetic for the demo (deterministic from building id/geometry) so every building has filterable fields.
- Saved projects store only the current **filters** (attribute, operator, value). Loading a project re-applies those filters on the backend and returns the matching building ids so the 3D view can highlight them again.

## License

Use and modify as needed for your project.
