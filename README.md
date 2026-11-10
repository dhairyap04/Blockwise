# Urban Design 3D · Calgary

A personal-project dashboard for exploring several downtown Calgary blocks in 3D, asking natural-language questions about buildings, and saving named analyses. React and Three.js provide the map; Flask handles public data, query interpretation, and SQLite persistence.

## What works

- Complete, paginated **area-specific** building fetching from Calgary Open Data.
- Footprints extruded at true metre-scale height, including courtyards and multipart polygons. Orbit, zoom, pan, reset, query highlighting, and click selection.
- Building details with fetched height, stage, and location for every usable geometry. Real addresses, zoning, and assessments where a reliable parcel overlap exists.
- Hugging Face Inference Providers translates text into validated filters. A clearly labelled rule-based fallback handles supported questions if inference is unavailable.
- Named filters saved in SQLite, listed by username, and reapplied on load. Username identification intentionally is not authentication.
- Keyboard-accessible building list, explicit zero results, retryable source errors, mobile layout, and source links.

The original assignment's UML and submission ZIP are deliberately outside this personal project's scope.

## Data: what the numbers mean

Sources:

- [3D Buildings – Citywide](https://data.calgary.ca/d/cchr-krqg): geometry, rooftop/ground elevation, stage, and structure ID. Height is rooftop elevation minus minimum ground elevation.
- [Current Year Property Assessments (Parcel)](https://data.calgary.ca/d/4bsw-nn7w): address, land-use district, assessment year/class, and value.

The default bounding box is longitude **−114.078 to −114.068**, latitude **51.044 to 51.050**: several downtown blocks. Source requests use `intersects` and stable pagination, so edge buildings are included. Data is cached for one hour; failed fetches never become successful empty results. An expired snapshot is not silently served as fresh data.

A building is linked to the parcel with the greatest footprint overlap, only if it covers at least 50% of the building. This is a spatial association, not an official building-to-property identifier. A parcel may contain multiple buildings and assessment rolls. Distinct rolls are summed once, and that **parcel assessment** is displayed on each matched building; it is not the building's individual market value. Do not sum values across building matches as though they were unique properties. Where a parcel has several addresses, the popup shows one and the number of other addresses.

Unmatched properties stay **Unavailable**. No zoning, address, or value is generated. Buildings with unknown height are labelled and displayed at 1 metre. The projection uses a local geographic approximation appropriate for the displayed area, not survey-grade measurements. Source vintages can differ; assessment year and retrieval time are shown. Data use is subject to [Calgary's Open Data Terms](https://data.calgary.ca/d/u45n-7awa).

## Local setup

Use Python 3.10+ and Node 22. From the repository root:

```sh
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python app.py
```

If you already have `.env`, preserve it and add any missing settings. The backend runs on **http://127.0.0.1:5001**. In another terminal:

```sh
cd frontend
npm ci
npm start
```

Open **http://localhost:3000**. The development server proxies `/api` to port 5001. `REACT_APP_API_BASE_URL` is optional for separate-origin deployments; keep credentials out of all frontend variables.

### LLM setup

Create a token with **Inference Providers** permission at [Hugging Face token settings](https://huggingface.co/settings/tokens), then set `HF_API_KEY` in `backend/.env`. `HF_TOKEN` is also accepted. Restart the backend after changing environment settings.

```env
HF_API_KEY=your_token_here
HF_MODEL=meta-llama/Llama-3.1-8B-Instruct
```

The integration uses the [current chat-completions router](https://huggingface.co/docs/inference-providers/tasks/chat-completion), not the retired model inference URL. Availability depends on enabled providers and remaining account credits; a token alone does not guarantee inference. The model is configurable because provider availability changes. A failed request falls back explicitly to supported rules, with its interpretation displayed in the UI. LLM outputs pass the same attribute, operator, type, size, and numeric validation as saved filters. The provider receives the question and filter instructions, not the building dataset.

Examples:

- `highlight buildings over 100 feet`
- `show buildings over 30 metres`
- `show commercial buildings`
- `show buildings in RC-G zoning`
- `show buildings less than $500,000 in value`
- `height >= 100`
- `RC-G zoning and under 150 feet`
- `address contains 6 AV`

`RC-G` and `R-CG` match the same normalized district code. Commercial zoning means a district code beginning with C; industrial begins with I; residential begins with R or M (excluding MU); mixed use begins with MU. These are transparent code-prefix categories, not independent parcel use classifications. Currency abbreviations are supported. A bare height threshold defaults to feet; use metres/meters/m explicitly for metric queries. Supported conditions can be joined by AND or OR (up to eight; mixed/nested logic is rejected). Unsupported questions return an error instead of a guessed filter. Zero RC-G or low-value results in this downtown area are legitimate.

### Save and load

1. Enter a username and click **Use name**. Typing alone does not create users.
2. Apply a query and review the interpreted condition and match count.
3. Enter a project name and choose **Save project**.
4. Click a saved project to load and reapply its filters to the current dataset.

Projects save the filter and original question, not camera position or a dataset snapshot. Results may change when source data updates. Anyone using the same username can access its projects: these are not private accounts. SQLite projects survive process restarts as long as the database file is retained. Existing prototype databases are migrated automatically to retain saved filters.

## Production and hosting

Flask serves the built frontend and API from one origin:

```sh
cd frontend
npm ci
npm run build
cd ../backend
venv/bin/gunicorn --bind 0.0.0.0:7860 --workers 1 --threads 4 --timeout 120 app:app
```

Or use the multi-stage Docker image (requires a running Docker daemon):

```sh
docker build -t urban-city-dashboard .
docker run --rm -p 7860:7860 --env-file backend/.env \
  -e PORT=7860 -v urban-city-data:/app/data urban-city-dashboard
```

Open **http://localhost:7860**. The Docker build excludes credentials, local databases, caches, and Git metadata. Python runs as a non-root user, with Gunicorn and debugging disabled. The named volume preserves SQLite data across container replacements. Use one worker with threads; the successful building snapshot is shared within that process and on disk.

`render.yaml` is an optional [Render Blueprint](https://render.com/docs/blueprint-spec) for the free Docker plan. Connect this **private repository** in your Render account, choose the implementation branch, and configure the server-side token. Nothing provisions paid hardware automatically. **Free Render disks are ephemeral:** local SQLite projects disappear on instance replacement/redeploy. For durable hosted analyses, choose a host with persistent storage and set `DATABASE_PATH` and `BUILDINGS_CACHE_PATH` to that volume. The local/Docker-volume setup provides durable persistence; the free hosting template is only a demonstration deployment. See [Render's free-instance limitations](https://render.com/docs/free).

There is no public deployment URL yet. Hosted deployment needs an account connection; live inference verification also needs available provider credits. These external requirements are not reported as completed.

## Configuration

| Variable | Default / purpose |
|---|---|
| `HF_API_KEY` / `HF_TOKEN` | Optional server-side inference token |
| `HF_MODEL` | `meta-llama/Llama-3.1-8B-Instruct` |
| `PORT` | 5001 for `python app.py`; 7860 in Docker |
| `DATABASE_PATH` | `backend/dashboard.db`; use a persistent volume in production |
| `BUILDINGS_CACHE_PATH` | `backend/.cache/buildings.json` |
| `BUILDINGS_CACHE_TTL` | 3600 seconds |
| `CORS_ORIGINS` | Local React development origins, comma-separated |
| `FLASK_DEBUG` | Off; set to `1` only for local development |
| `REACT_APP_API_BASE_URL` | Empty: same-origin API or development proxy |

## Verification

```sh
cd backend
venv/bin/python -m unittest discover -s tests -v
# Opt-in public API and query check; never logs tokens:
venv/bin/python check_live.py
# Require actual LLM inference rather than accepting fallback:
venv/bin/python check_live.py --require-llm
```

```sh
cd frontend
CI=true npm test -- --watchAll=false --runInBand
CI=true npm run build
```

GitHub Actions runs backend tests, frontend tests, and a production build. Offline tests cover pagination, real-vs-missing attributes, unique assessment-roll aggregation, units/currency, numeric equality, invalid filters, LLM response validation/fallback, user isolation, database round trips across app instances, source recovery, query results, building selection, save/load, and roof-cap/height geometry regressions. `check_live.py --require-llm` fails if inference falls back, so rule-based behavior cannot be mistaken for verified LLM integration.

During implementation, live requests returned **166 buildings / 117 parcel matches**; counts can change. The local production browser workflow was checked for selection, query highlighting, persistence/reload, and desktop/mobile layout. The existing account's inference request returned HTTP 402 (credits required); successful LLM execution is therefore pending. Docker execution additionally needs the local daemon running.

## API

All mutation bodies are JSON objects. Validation errors return JSON 400; upstream data errors return JSON 503 and can be retried.

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Process status and whether an LLM token is configured (not a provider availability probe) |
| `/api/buildings` | GET | Buildings, origin, source links, retrieval time, area, and dataset version; `?refresh=1` refetches |
| `/api/query` | POST | `{query}` or `{filters}`; returns IDs, interpreted filter, parser, and fallback warning |
| `/api/user` | POST | `{username}`: identify/create user |
| `/api/users/<username>/projects` | GET | List saved projects without creating users |
| `/api/users/<username>/projects` | POST | `{name, filters, query?}`: save analysis |
| `/api/projects/<id>?username=...` | GET | Load a named user's project |

A filter is `{ "attribute": "height_m", "operator": ">", "value": 30 }`. Numeric attributes are `height` (ft), `height_m`, and `assessed_value`; text attributes are `zoning`, `address`, `stage`, and `assessment_class`. Combined filters use `{ "logic": "and", "conditions": [...] }`. Including `datasetVersion` in a query rejects mismatched map data with HTTP 409 rather than highlighting IDs from a different snapshot.

## Next, after the baseline is verified

Potential follow-ups: street/basemap context, address search, improved parcel matching, project editing/deletion, export, richer geographic queries, and scenario comparison. These remain ideas rather than implemented promises. Authentication is a prerequisite if projects become private or shared beyond the username-based demo.

## License

[MIT](LICENSE). Public source datasets have their own terms.
