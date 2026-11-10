# Blockwise · Calgary building explorer

A personal-project dashboard for exploring bounded Calgary study areas in 3D, filtering and comparing buildings, and saving named analyses. React and MapLibre GL JS provide the map; Flask handles public data, query interpretation, and SQLite persistence.

## What works

- Complete, paginated **area-specific** building fetching from Calgary Open Data.
- Footprints extruded at true metre-scale height, including courtyards and multipart polygons. Rotate/tilt, zoom, pan, reset, query highlighting, and click selection.
- Building details with fetched height, stage, and location for every usable geometry. Real addresses, zoning, and assessments where a reliable parcel overlap exists.
- Hugging Face Inference Providers translates text into validated filters. A clearly labelled rule-based fallback handles supported questions if inference is unavailable.
- Named filters saved in SQLite, listed by username, and reapplied on load. Username identification intentionally is not authentication.
- MapLibre with an OpenFreeMap Positron vector basemap, compass/tilt and zoom controls, metric scale, north-up top view, and a marked study-area boundary.
- City address lookup with verified 400/600/800/1200/1600 m study squares, preserved with saved projects.
- Five preset study areas: Downtown, Beltline, East Village, Kensington, and Marda Loop. Each has its own source cache.
- Editable typed filters (including AND/OR conditions), address/building-ID search within the loaded area, result sorting, and zoom-to-building actions.
- Result summaries: median/maximum height, height distribution, zoning breakdown, and parcel match evidence. Parcel assessment summaries count distinct parcels once.
- Project rename, notes, and explicit delete confirmation; saved analyses retain their area.
- CSV and analysis JSON exports with filters, source links, retrieval time, and dataset version.
- Keyboard-accessible building list, explicit zero results, retryable source errors, mobile layout, and source links.

The original assignment's UML and submission ZIP are deliberately outside this personal project's scope.

## Explore without an LLM account

1. Search **Study a Calgary address or landmark**, choose a City parcel-address match and square width, or choose a preset **Neighbourhood**. Each choice loads a bounded area of several blocks, not the entire neighbourhood. Switching clears the current filters and address search. Choose 1.2 or 1.6 kilometres for more building coverage; first loads can take around a minute because geometry and parcel assessments are fetched and joined. Existing smaller areas remain available.
2. Use **Filter controls** to choose a field, operator, and value. Add conditions and choose AND/OR, then click **Apply controls**. The interpreted filter is visible and can be saved just like a text query. Editing a draft does not change results until applied.
3. Use **Find name, address or building ID in this area** to narrow the current results. This searches already-loaded names, aliases, addresses, and IDs; it is not a citywide geocoder. Buildings without matched addresses can be found by ID.
4. Sort by address, height, or parcel assessment. **Zoom to building** focuses the camera and opens its details. **Reset view** fits the full area; **Top view** faces north from above. The compass follows orbit rotation.
5. Open **Result summary** for heights, zoning, and property-data coverage of displayed results (including the address search). Median assessment uses distinct matched parcels, not repeated building values.
6. **Export CSV** downloads displayed rows plus filter/source metadata. **Export analysis JSON** also retains notes, the search, area bounds, and complete building geometry. No map tiles or offline basemap are exported.

The map uses **MapLibre GL JS** with the muted [OpenFreeMap Positron](https://openfreemap.org/quick_start/) vector basemap. One geographic camera handles streets and Calgary building extrusions, avoiding the old separate raster ground planes. Source polygon holes and multipart footprints are retained and heights remain in metres; unknown heights still use a labelled 1 m placeholder. Basemap building layers are removed so only the loaded City geometry is selectable or treated as evidence. Attribution remains available in the lower-right corner. No API key is required for the default basemap.

Drag to pan; right-drag to rotate/tilt; scroll or +/− to zoom. Arrow keys pan, Shift+arrows rotate/tilt, R resets and T opens top view. Navigation controls include north reset, zoom, and a metric scale. Switching filters or selecting buildings preserves the map camera. Toggle **Street map** off for a plain background. If the external basemap fails, local Calgary building geometry and the results list remain usable, with **Retry basemap** offered. Source-vintage differences and the orange study boundary still apply. The map does not fetch additional Calgary evidence as you pan. `REACT_APP_MAP_STYLE_URL` can override the style JSON; satisfy the provider's attribution and usage terms. Workers are bundled as versioned same-origin build assets; no CDN script is executed.

## Search references and landmark names

**Calgary address or landmark** accepts City street addresses and a five-entry, source-backed landmark directory: Brookfield Place, The Bow, Calgary Tower, Suncor Energy Centre, and The CORE Shopping Centre. Aliases include Bow Tower, Suncore Building, and CORE mall. Choose a returned match before loading its bounded area. Names are curated metadata, separate from the City's geometry and parcel attributes; the directory is not a complete citywide place index.

A persistent purple **Your search** pin marks the searched location. Ordinary addresses become an automatic reference only when their point falls inside one footprint. When it falls outside buildings, in a courtyard, or inside overlapping footprints, the app offers up to six candidates within approximately 80 m for explicit inspection and confirmation. Proximity alone never establishes identity. **Add reference to comparison** is optional; the reference remains marked through filtering and other building selections. Manual choices are labelled as user-confirmed, saved with projects, and validated against current candidates when saved or exported. Reloading a project recomputes current candidates; an unavailable old choice is not silently attached to another building.

For Brookfield Place, The Bow, and Calgary Tower, reviewed landmark associations check both the stored City structure ID and a reviewed point against the current footprint before adding a name or choosing that reference. If the check fails, users must inspect candidates. Suncor and The CORE are complexes and always require a reference choice. Suncor's directory pin is an **approximate complex study centre**, not a verified City parcel-address point; the interface discloses this. The CORE uses a reviewed City parcel-address point. Neither complex entry claims an exhaustive set of constituent buildings.

[backend/landmarks.json](backend/landmarks.json) records canonical names, search aliases, source URLs, anchors, review dates, and reviewed components. Name source/review details appear in building details; names and addresses are shown together in results and comparisons. CSV/JSON/PDF exports retain name provenance and search-reference context. The PDF diagram distinguishes the reference in purple and labels it R if it is separate from A/B/C comparison members. The directory needs periodic manual review as names or source geometry change; no external geocoding account is required for these entries.

## Compare evidence and navigate the workspace

The primary journey is **1 · Find → 2 · Compare → 3 · Review**. The sticky navigation moves the viewport and keyboard focus to each step. Search is visible on first visit; after a place loads, it collapses to **Find a different place** and focus moves to the reference panel. Ambiguous searches require an explicit footprint choice before nearby suggestions appear. Alternatively, select a map building to start exploring a preset neighbourhood.

**Compare with two neighbours** starts a shortlist containing the reference (or selected map building) and the two nearest loaded building centres with valid coordinates. Distances are approximate centre-to-centre distances, not footprint gaps; suggestions ignore active filters, do not imply ownership or similarity, and flag shared recorded parcels. The quick-start action is unavailable once a custom shortlist contains another building, so it cannot overwrite that selection. Individual suggestions can be inspected and added/removed within the three-building limit.

**What stands out** explains recorded height and zoning differences relative to the confirmed reference when it is included, otherwise the first shortlist member. Missing values are explicitly unavailable. Detailed evidence, source coverage, and PDF options expand on demand. **More tools** holds filters, the full searchable building list, exports, and saved projects. First-time exploration does not require a name or an applied filter. Quick filters demonstrate supported questions without requiring inference credits. **How to use this map** explains controls, data interpretation, and the link to Calgary's official Development Map.

Choose **Compare** beside a result or in building details to build a temporary shortlist of up to three buildings. The sidebar uses stacked building cards so it needs no sideways scrolling. The wide table compares height, zoning, parcel assessment/year, parcel IDs, and footprint overlap. **Open wide comparison** provides a native modal table; Escape closes it and returns focus. Shared parcel assessments are explicitly identified. Export comparison CSV includes source metadata and `scope=comparison`; shortlist members can have been selected before the current filter was applied. **Create meeting brief (PDF)** downloads a printable footprint plan, comparison evidence, discussion notes, source links, and limitations. Title and notes can be edited before download; notes are shared with the analysis. The server validates the selected IDs and dataset version. No street-map tiles are exported. The comparison is separate from saved filters, and is not retained on page refresh. Export it before refreshing or changing study areas.

Area changes and loading saved analyses warn before replacing changed notes or a comparison shortlist. Saved notes are tracked separately from changed drafts. These safeguards do not persist unsaved drafts across a browser refresh. Focus the map to use arrow-key pan, +/− zoom, R reset, and T top view. Major actions use 44 px minimum target heights, explicit focus styling, and textual result counts as an alternative to map colours.

## Audience and product direction

The primary audience hypothesis is **community association planning volunteers preparing neighbourhood discussions**, with planning/architecture students as a secondary group. The task is to find comparable existing buildings, inspect their height/zoning and data quality, and export a source-backed comparison. This is a product hypothesis, not validated demand. Calgary's [development permit process](https://www.calgary.ca/development/permits/process.html) and [Development Map FAQ](https://www.calgary.ca/development/permits/dmap-faq.html) describe the real community-review context. The dashboard complements official application information; it does not determine development permissions or building-specific market values.

The UX review used [Nielsen's ten heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) and contrast, repetition, alignment, and proximity. Changes addressed viewport discontinuity, hidden actions in a long sidebar, keyboard camera access, unclear saving prerequisites, destructive draft transitions, and narrow comparison tables. Sampled text contrast was 6.02:1 for muted sidebar text, 13.21:1 for navigation text, and 8.81:1 for primary-button text. These samples do not constitute accessibility certification; raster labels and assistive technologies still need testing.

The simplified journey has automated workflow tests and desktop/mobile browser checks, but has not been validated with target users. A first five-person usability session should ask each participant, without coaching, to find a named landmark, confirm an ambiguous footprint, compare two neighbours, explain a height difference and a missing field, and export a brief. Record completion, hesitation, wrong selections, and whether parcel assessments are mistaken for building values.

Address-based study areas and meeting-ready PDF briefs are now implemented. Highest-priority product follow-ups are source-acquisition dates distinct from retrieval dates and target-user validation. Bounded square areas, unsaved-draft refresh behaviour, raster-label density, permanent project deletion, and unverified building-to-property identities remain practical limits. Validate whether volunteers can prepare a correct comparison in a short session, especially whether they understand parcel assessments and unavailable data, before adding sophisticated scenarios.

## Data: what the numbers mean

Sources:

- [3D Buildings – Citywide](https://data.calgary.ca/d/cchr-krqg): geometry, rooftop/ground elevation, stage, and structure ID. Height is rooftop elevation minus minimum ground elevation.
- [Parcel Address](https://data.calgary.ca/d/9zvu-p8uz): verified address points for custom study-area centres.
- [Current Year Property Assessments (Parcel)](https://data.calgary.ca/d/4bsw-nn7w): address, land-use district, assessment year/class, and value.

The default bounding box is longitude **−114.078 to −114.068**, latitude **51.044 to 51.050**: several downtown blocks. Source requests use `intersects` and stable pagination, so edge buildings are included. Data is cached for one hour; failed fetches never become successful empty results. An expired snapshot is not silently served as fresh data.

A building is linked to the parcel with the greatest footprint overlap, only if it covers at least 50% of the building. This is a spatial association, not an official building-to-property identifier. A parcel may contain multiple buildings and assessment rolls. Distinct rolls are summed once, and that **parcel assessment** is displayed on each matched building; it is not the building's individual market value. Do not sum values across building matches as though they were unique properties. Where a parcel has several addresses, the popup shows one and the number of other addresses.

Unmatched properties stay **Unavailable**. Match details show the actual footprint-overlap percentage and whether the result failed the 50% threshold or had no overlapping parcel. A downtown audit found 44 insufficient-overlap cases and five with no overlap; no nearest-neighbour values were substituted. No zoning, address, or value is generated. Buildings with unknown height are labelled and displayed at 1 metre. The projection uses a local geographic approximation appropriate for the displayed area, not survey-grade measurements. Source vintages can differ; assessment year and retrieval time are shown. Data use is subject to [Calgary's Open Data Terms](https://data.calgary.ca/d/u45n-7awa).

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
4. Click a saved project to load its neighbourhood and reapply its filters to that area's current dataset.
5. Use **Edit** to rename it or change notes. **Delete** requires an explicit confirmation in the interface.

Projects save the filter, original question, study area (including the exact bounds of custom address areas), notes, and any manually chosen reference building, not camera position or a dataset snapshot. Legacy projects migrate to Downtown with empty notes. Results may change when source data updates. Anyone using the same username can access its projects: these are not private accounts. SQLite projects survive process restarts as long as the database file is retained. Existing prototype databases are migrated automatically to retain saved filters and add area/notes/reference columns.

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
docker build -t blockwise .
docker run --rm -p 7860:7860 --env-file backend/.env \
  -e PORT=7860 -v urban-city-data:/app/data blockwise
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
| `REACT_APP_MAP_STYLE_URL` | `https://tiles.openfreemap.org/styles/positron`; MapLibre style JSON |

## Verification

```sh
cd backend
venv/bin/pip install -r requirements-dev.txt
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

GitHub Actions runs backend tests, frontend tests, and a production build. The current suite contains 38 backend and 49 frontend tests, including area isolation/migration, project edits/deletion, export safety, typed filters, distinct-parcel statistics, and stale-request handling. Offline tests cover pagination, real-vs-missing attributes, unique assessment-roll aggregation, units/currency, numeric equality, invalid filters, LLM response validation/fallback, user isolation, database round trips across app instances, source recovery, query results, building selection, save/load, and geographic footprint/height preservation and map lifecycle regressions. `check_live.py --require-llm` fails if inference falls back, so rule-based behavior cannot be mistaken for verified LLM integration.

During implementation, live requests returned **166 buildings / 117 parcel matches** in the downtown preset and **676 buildings / 603 parcel matches** in a 1.6 km City Hall square; counts can change. The larger area took 51.6 seconds on its first fetch and 0.049 seconds from the local cache (measurements from this development machine, not a performance guarantee). The local production browser workflow was checked for selection, query highlighting, persistence/reload, area-aware project loading, typed controls, address search, sorting, zoom-to-building, project edits/deletion, exports, and desktop/mobile layout. The existing account's inference request returned HTTP 402 (credits required); successful LLM execution is therefore pending. Docker execution additionally needs the local daemon running.

## API

All mutation bodies are JSON objects. Validation errors return JSON 400; upstream data errors return JSON 503 and can be retried.

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Process status and whether an LLM token is configured (not a provider availability probe) |
| `/api/areas` | GET | Preset study areas and their coordinates |
| `/api/addresses?q=...` | GET | Up to eight City parcel-address matches plus matching curated landmarks and source metadata |
| `/api/areas/address` | POST | Verify `{address, latitude, longitude, size_m}` or use a server-owned `{landmarkId, size_m}` entry, then persist the bounded area |
| `/api/brief` | POST | PDF from `{area, buildingIds, datasetVersion, title, notes?, filters?, query?, search?, referenceId?}`; 1–3 distinct current IDs required |
| `/api/buildings?area=downtown` | GET | Buildings, origin, source links, retrieval time, area, and dataset version; add `&refresh=1` to refetch |
| `/api/query` | POST | `{query, area?}` or `{filters, area?}`; returns IDs, interpreted filter, parser, and fallback warning; `source: "controls"` labels manual filters |
| `/api/user` | POST | `{username}`: identify/create user |
| `/api/users/<username>/projects` | GET | List saved projects without creating users |
| `/api/users/<username>/projects` | POST | `{name, filters, query?, area?, notes?, referenceId?}`: save analysis |
| `/api/projects/<id>?username=...` | GET | Load a named user's project |
| `/api/projects/<id>?username=...` | PATCH | Update `{name, notes}` while preserving filters and area |
| `/api/projects/<id>?username=...` | DELETE | Delete a project belonging to the supplied username |

For projects and briefs, `referenceId` can be a current candidate ID (an explicit user choice), `null`/omitted (use the current automatic association), or `""` (leave the searched location unconfirmed). Project responses retain the choice as `reference_id`. An unavailable saved choice is displayed as unconfirmed until another candidate is chosen.

A filter is `{ "attribute": "height_m", "operator": ">", "value": 30 }`. Numeric attributes are `height` (ft), `height_m`, and `assessed_value`; text attributes are `zoning`, `address`, `stage`, and `assessment_class`. Combined filters use `{ "logic": "and", "conditions": [...] }`. Including `datasetVersion` in a query rejects mismatched map data with HTTP 409 rather than highlighting IDs from a different snapshot.

## Next, after the baseline is verified

Potential follow-ups: arbitrary study-area drawing, authoritative building-to-property identifiers, richer geographic queries, and scenario comparison. These remain ideas rather than implemented promises. Authentication is a prerequisite if projects become private or shared beyond the username-based demo.

## License

[MIT](LICENSE). Public source datasets have their own terms.
