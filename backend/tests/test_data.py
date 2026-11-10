import unittest
from unittest.mock import Mock, patch
import math

from data import _fetch_rows, _footprint_for_three, _height_meters, fetch_and_normalize_buildings, DEFAULT_BBOX

RING = [[-114.074, 51.046], [-114.0739, 51.046], [-114.0739, 51.0461], [-114.074, 51.0461], [-114.074, 51.046]]
BUILDING = {"struct_id": "1", "polygon": {"type": "Polygon", "coordinates": [RING]},
            "rooftop_elev_z": "1040", "grd_elev_min_z": "1000", "stage": "CONSTRUCTED"}
PARCEL = {"cpid": "p1", "roll_number": "r1", "unique_key": "k1", "roll_year": "2026",
          "address": "100 TEST ST SW", "assessed_value": "450000", "land_use_designation": "R-CG",
          "multipolygon": {"type": "MultiPolygon", "coordinates": [[RING]]}}


class DataTests(unittest.TestCase):
    @patch("data.requests.get")
    def test_spatial_pagination(self, get):
        get.side_effect = [Mock(json=lambda: [BUILDING]), Mock(json=lambda: [])]
        with patch("data.FETCH_LIMIT", 1):
            self.assertEqual(_fetch_rows("url", "polygon", DEFAULT_BBOX, "struct_id"), [BUILDING])
        self.assertIn("intersects(polygon", get.call_args_list[0].kwargs["params"]["$where"])
        self.assertEqual(get.call_args_list[1].kwargs["params"]["$offset"], 1)

    @patch("data._fetch_rows")
    def test_real_parcel_match_and_unique_roll_aggregation(self, fetch):
        fetch.side_effect = [[BUILDING], [PARCEL, PARCEL, {**PARCEL, "roll_number": "r2", "assessed_value": "500000"}]]
        buildings, _ = fetch_and_normalize_buildings()
        b = buildings[0]
        self.assertEqual(b["height_m"], 40)
        self.assertEqual(b["assessed_value"], 950000)
        self.assertEqual(b["assessment_rolls"], 2)
        self.assertEqual(b["property_match"], "footprint_overlap")
        self.assertEqual(b["zoning_codes"], ["R-CG"])

    @patch("data._fetch_rows")
    def test_unmatched_building_does_not_get_invented_attributes(self, fetch):
        fetch.side_effect = [[BUILDING], []]
        b = fetch_and_normalize_buildings()[0][0]
        self.assertIsNone(b["address"])
        self.assertIsNone(b["assessed_value"])
        self.assertIsNone(b["zoning"])
        self.assertEqual(b["property_match"], "unmatched")

    def test_units_and_missing_height(self):
        x, y = _footprint_for_three([[1, 1]], 0, 51)[0]
        self.assertAlmostEqual(x, 111320 * math.cos(math.radians(51)))
        self.assertIsNone(_height_meters({}))
        self.assertIsNone(_height_meters({"rooftop_elev_z": "NaN", "grd_elev_min_z": 10}))

    @patch("data._fetch_rows", return_value=[])
    def test_empty_source_is_not_success(self, fetch):
        with self.assertRaises(RuntimeError):
            fetch_and_normalize_buildings()
