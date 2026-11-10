import unittest
from copy import deepcopy
from landmarks import get_landmark,search_landmarks,enrich_buildings
from reference import local_point,resolve_reference

class LandmarkTests(unittest.TestCase):
    def test_aliases_names_and_addresses_are_searchable_with_sources(self):
        for query,expected in [('Brookfield Place','brookfield-place'),('BOW TOWER','the-bow'),('Suncore Building','suncor-energy-centre'),('CORE mall','the-core'),('101 9 AV SW','calgary-tower')]:
            matches=search_landmarks(query)
            self.assertTrue(any(m['landmarkId']==expected for m in matches));self.assertTrue(matches[0]['source']['url'].startswith('https://'))
        self.assertEqual(search_landmarks('Not a real landmark'),[])
        with self.assertRaises(ValueError):get_landmark('injected')
    def test_names_require_both_reviewed_id_and_current_geometry(self):
        place=get_landmark('brookfield-place');component=place['components'][0];origin=(-114.07,51.05)
        x,y=local_point(component['longitude'],component['latitude'],origin)
        b={'id':component['id'],'footprint':[[x-10,y-10],[x+10,y-10],[x+10,y+10],[x-10,y+10]]}
        self.assertEqual(enrich_buildings([b],origin)[0]['name'],'Brookfield Place')
        changed={**b,'footprint':[[0,0],[1,0],[1,1],[0,1]],'name':'An obsolete name'}
        self.assertNotIn('name',enrich_buildings([changed],origin)[0])
        self.assertNotIn('name',enrich_buildings([{**b,'id':'another'}],origin)[0])
    def test_missing_reviewed_building_cannot_fall_back_to_an_unrelated_containing_shape(self):
        place=get_landmark('brookfield-place');area={'landmark':place,'address':place['address'],'center':{'lon':place['longitude'],'lat':place['latitude']}}
        snapshot={'origin':(place['longitude'],place['latitude']),'buildings':[{'id':'wrong','footprint':[[-10,-10],[10,-10],[10,10],[-10,10]]}]}
        self.assertIsNone(resolve_reference(area,snapshot)['buildingId'])
