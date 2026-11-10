"""Calgary open data, in local metres, with spatially matched parcel assessments.

Assessment values belong to parcels, not individual buildings. A building is linked
only where its footprint overlaps a parcel; unmatched attributes remain null.
"""
import math
from collections import defaultdict

import requests
from shapely.geometry import shape
from shapely.strtree import STRtree
from areas import AREAS

CALGARY_3D_URL = "https://data.calgary.ca/resource/cchr-krqg.json"
ASSESSMENT_URL = "https://data.calgary.ca/resource/4bsw-nn7w.json"
# Several downtown blocks, rather than an arbitrary citywide row sample.
DEFAULT_BBOX = AREAS["downtown"]["bbox"]
FETCH_LIMIT = 1000
SOURCES = [
    {"name": "3D Buildings – Citywide", "url": "https://data.calgary.ca/d/cchr-krqg"},
    {"name": "Current Year Property Assessments (Parcel)", "url": "https://data.calgary.ca/d/4bsw-nn7w"},
]


def _fetch_rows(url, geometry_field, bbox, order):
    """Filter at source and paginate deterministically; never truncate silently."""
    w, s, e, n = (bbox[k] for k in ("min_lon", "min_lat", "max_lon", "max_lat"))
    polygon = f"POLYGON (({w} {s}, {e} {s}, {e} {n}, {w} {n}, {w} {s}))"
    rows = []
    for offset in range(0, 100_000, FETCH_LIMIT):
        params = {"$where": f"intersects({geometry_field}, '{polygon}')", "$limit": FETCH_LIMIT,
                  "$offset": offset, "$order": order}
        for attempt in range(2):
            try:
                response = requests.get(url, params=params, timeout=(10, 40))
                response.raise_for_status()
                page = response.json()
                break
            except (requests.RequestException, ValueError) as exc:
                if attempt == 1:
                    raise RuntimeError("Calgary Open Data could not be reached. Please retry.") from exc
        if not isinstance(page, list):
            raise RuntimeError("Calgary Open Data returned an unexpected response.")
        rows.extend(page)
        if len(page) < FETCH_LIMIT:
            return rows
    raise RuntimeError("The selected area exceeds the data limit; no partial result was returned.")


def _number(value):
    try:
        number = float(value)
        return number if math.isfinite(number) else None
    except (ValueError, TypeError):
        return None


def _height_meters(raw):
    roof, ground = _number(raw.get("rooftop_elev_z")), _number(raw.get("grd_elev_min_z"))
    return round(roof - ground, 2) if roof is not None and ground is not None and roof >= ground else None


def _footprint_for_three(coords, origin_lon, origin_lat):
    return [[(p[0] - origin_lon) * 111320 * math.cos(math.radians(origin_lat)),
             (p[1] - origin_lat) * 110540] for p in coords]


def _parcel_index(rows):
    groups = defaultdict(list)
    for row in rows:
        if row.get("multipolygon"):
            groups[row.get("cpid") or row.get("unique_key")].append(row)
    geometries, attributes = [], []
    for parcel_id, records in groups.items():
        try:
            geometry = shape(records[0]["multipolygon"])
            if not geometry.is_valid:
                geometry = geometry.buffer(0)
            if geometry.is_empty:
                continue
        except (ValueError, TypeError, KeyError):
            continue
        # One parcel may have many separately assessed condo units. Count each roll once.
        rolls = {r.get("roll_number") or r.get("unique_key"): r for r in records}
        values = [_number(r.get("assessed_value")) for r in rolls.values()]
        zones = sorted({z.strip() for r in records for z in r.get("land_use_designation", "").split(",") if z.strip()})
        addresses = sorted({r["address"] for r in records if r.get("address")})
        classes = sorted({r["assessment_class_description"] for r in records if r.get("assessment_class_description")})
        geometries.append(geometry)
        attributes.append({
            "parcel_id": parcel_id, "address": addresses[0] if addresses else None,
            "address_count": len(addresses), "zoning": ", ".join(zones) or None,
            "zoning_codes": zones, "assessment_class": ", ".join(classes) or None,
            "assessed_value": round(sum(values)) if values and all(v is not None for v in values) else None,
            "assessment_year": records[0].get("roll_year"), "assessment_rolls": len(rolls),
        })
    return geometries, attributes, STRtree(geometries) if geometries else None


def fetch_and_normalize_buildings(bbox=None):
    bbox = bbox or DEFAULT_BBOX
    rows = _fetch_rows(CALGARY_3D_URL, "polygon", bbox, "struct_id, :id")
    if not rows:
        raise RuntimeError("No buildings were returned for the selected area. Please retry.")
    # Failure is surfaced rather than fabricating attributes or silently omitting a source.
    parcels = _fetch_rows(ASSESSMENT_URL, "multipolygon", bbox, "unique_key, :id")
    geometries, attributes, tree = _parcel_index(parcels)
    origin = ((bbox["min_lon"] + bbox["max_lon"]) / 2, (bbox["min_lat"] + bbox["max_lat"]) / 2)
    normalized, seen = [], set()
    for raw in rows:
        struct_id = str(raw.get("struct_id") or "")
        if not struct_id or struct_id in seen or not raw.get("polygon"):
            continue
        try:
            geometry = shape(raw["polygon"])
            if not geometry.is_valid:
                geometry = geometry.buffer(0)
            if geometry.is_empty or geometry.geom_type not in ("Polygon", "MultiPolygon"):
                continue
        except (ValueError, TypeError, KeyError):
            continue
        seen.add(struct_id)
        pieces = [geometry] if geometry.geom_type == "Polygon" else list(geometry.geoms)
        polygons = [{"outer": _footprint_for_three(p.exterior.coords, *origin),
                     "holes": [_footprint_for_three(r.coords, *origin) for r in p.interiors]} for p in pieces]
        point, height = geometry.representative_point(), _height_meters(raw)
        building = {"id": struct_id, "struct_id": struct_id, "footprint": polygons[0]["outer"],
                    "polygons": polygons, "height_m": height,
                    "height": round(height * 3.28084, 1) if height is not None else None,
                    "stage": raw.get("stage") or "Unknown", "latitude": round(point.y, 7),
                    "longitude": round(point.x, 7), "address": None, "zoning": None,
                    "zoning_codes": [], "assessed_value": None, "parcel_id": None,
                    "property_match": "unmatched", "parcel_overlap": None,
                    "property_match_reason": "No overlapping parcel in the assessment source."}
        if tree is not None:
            candidates = tree.query(geometry, predicate="intersects")
            overlaps = [(geometry.intersection(geometries[int(i)]).area, int(i)) for i in candidates]
            if overlaps:
                area, index = max(overlaps)
                # Avoid assigning a neighbour's parcel on a sliver of overlap.
                ratio = area / geometry.area if geometry.area > 0 else 0
                building["parcel_overlap"] = round(ratio, 4)
                if ratio >= 0.5:
                    building.update(attributes[index])
                    building["property_match"] = "footprint_overlap"
                    building["property_match_reason"] = "Majority footprint overlap with an assessment parcel."
                else:
                    building["property_match_reason"] = "Parcel overlap is below 50%; no property attributes assigned."
        normalized.append(building)
    if not normalized:
        raise RuntimeError("No usable building geometry was returned. Please retry.")
    return normalized, origin
