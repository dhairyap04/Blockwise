"""
Calgary Open Data integration: fetch and normalize 3D building data for a bounded area.
Uses City of Calgary 3D Buildings - Citywide (cchr-krqg) for footprints and heights.
Enriches with synthetic zoning and assessed_value for demo filtering (all buildings have data).
"""
import requests
import hashlib
from typing import List, Dict, Any, Optional

# Downtown Calgary bounding box: ~3-4+ blocks so we get enough buildings from paginated API
CALGARY_3D_URL = "https://data.calgary.ca/resource/cchr-krqg.json"
DEFAULT_BBOX = {
    "min_lon": -114.085,
    "min_lat": 51.042,
    "max_lon": -114.055,
    "max_lat": 51.058,
}
FETCH_LIMIT = 5000


def _in_bbox(lon: float, lat: float, bbox: Dict[str, float]) -> bool:
    return (
        bbox["min_lon"] <= lon <= bbox["max_lon"]
        and bbox["min_lat"] <= lat <= bbox["max_lat"]
    )


def _polygon_centroid(coords: List[List[float]]) -> tuple:
    """First ring only; (lon, lat)."""
    if not coords:
        return (0.0, 0.0)
    n = len(coords)
    lon = sum(c[0] for c in coords) / n
    lat = sum(c[1] for c in coords) / n
    return (lon, lat)


def _synthetic_zoning(struct_id: str) -> str:
    """Deterministic zoning label for demo filtering (e.g. RC-G, CC, I)."""
    zones = ["RC-G", "RC-1", "CC", "I", "MU-1", "MU-2", "R-C1", "C-COR2"]
    h = int(hashlib.md5(struct_id.encode()).hexdigest()[:8], 16)
    return zones[h % len(zones)]


def _synthetic_assessed_value(struct_id: str, height_m: float, footprint: List[List[float]]) -> Optional[int]:
    """Deterministic assessed value in CAD for demo (all buildings have a value)."""
    # Rough area from footprint (convex approx)
    if len(footprint) < 3:
        area_m2 = 100
    else:
        n = len(footprint)
        area_m2 = 0.5 * abs(
            sum(footprint[i][0] * footprint[(i + 1) % n][1] - footprint[(i + 1) % n][0] * footprint[i][1] for i in range(n))
        )
    h = int(hashlib.md5(struct_id.encode()).hexdigest()[:8], 16)
    base = 200_000 + (h % 800_000)
    return int(base + area_m2 * 500 + height_m * 1000)


def _height_meters(raw: Dict[str, Any]) -> float:
    """Building height from ground elevation to rooftop (metres)."""
    try:
        roof = float(raw.get("rooftop_elev_z") or 0)
        grd = float(raw.get("grd_elev_min_z") or 0)
        return max(0.0, round(roof - grd, 2))
    except (TypeError, ValueError):
        return 0.0


def _footprint_for_three(coords: List[List[float]], origin_lon: float, origin_lat: float) -> List[List[float]]:
    """
    Convert GeoJSON [lon, lat] ring to local x,y for Three.js.
    Use simple scale: 1 degree lat ~ 111km, 1 degree lon ~ 111*cos(lat) km.
    Return list of [x, y] in local metres (y = north, x = east).
    """
    # Local origin at (origin_lon, origin_lat). Scale to metres.
    scale_lon = 111320 * (0.5 + 0.5 * (51.0 / 90.0))  # approx at Calgary lat
    scale_lat = 110540
    out = []
    for lon, lat in coords:
        x = (lon - origin_lon) * scale_lon
        y = (lat - origin_lat) * scale_lat
        out.append([x, y])
    return out


def fetch_and_normalize_buildings(
    bbox: Optional[Dict[str, float]] = None,
) -> tuple[List[Dict[str, Any]], tuple[float, float]]:
    """
    Fetch Calgary 3D buildings, filter by bbox, normalize for frontend.
    Returns (list of building objects, (origin_lon, origin_lat) for local coords).
    """
    bbox = bbox or DEFAULT_BBOX
    params = {"$limit": FETCH_LIMIT}
    try:
        resp = requests.get(CALGARY_3D_URL, params=params, timeout=30)
        resp.raise_for_status()
        rows = resp.json()
    except requests.RequestException as e:
        raise RuntimeError(f"Failed to fetch Calgary 3D buildings: {e}") from e

    origin_lon = (bbox["min_lon"] + bbox["max_lon"]) / 2
    origin_lat = (bbox["min_lat"] + bbox["max_lat"]) / 2
    normalized = []
    seen = set()

    for raw in rows:
        poly = raw.get("polygon")
        if not poly or poly.get("type") != "Polygon":
            continue
        rings = poly.get("coordinates")
        if not rings or not rings[0]:
            continue
        ring = rings[0]
        lon, lat = _polygon_centroid(ring)
        if not _in_bbox(lon, lat, bbox):
            continue
        struct_id = str(raw.get("struct_id", ""))
        if struct_id in seen:
            continue
        seen.add(struct_id)

        height_m = _height_meters(raw)
        # For display: also provide height in feet for queries
        height_ft = round(height_m * 3.28084, 1)
        footprint_local = _footprint_for_three(ring, origin_lon, origin_lat)

        # Placeholder address; real data could come from parcel/address API
        address = f"Building {struct_id}"
        # Synthetic zoning and assessed_value for demo (deterministic from struct_id)
        zoning = _synthetic_zoning(struct_id)
        assessed_value = _synthetic_assessed_value(struct_id, height_m, footprint_local)

        normalized.append({
            "id": struct_id,
            "struct_id": struct_id,
            "footprint": footprint_local,
            "height": height_ft,
            "height_m": height_m,
            "address": address,
            "zoning": zoning,
            "assessed_value": assessed_value,
            "stage": raw.get("stage") or "N/A",
            "latitude": round(lat, 6),
            "longitude": round(lon, 6),
        })
    return normalized, (origin_lon, origin_lat)
