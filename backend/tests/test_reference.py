import unittest
from reference import resolve_reference,reference_context

class ReferenceTests(unittest.TestCase):
    def setUp(self):
        self.area={'address':'Test address','center':{'lon':0,'lat':0}}
        self.snapshot={'origin':(0,0),'buildings':[{'id':'inside','footprint':[[-5,-5],[5,-5],[5,5],[-5,5]]},{'id':'near','footprint':[[20,20],[30,20],[30,30],[20,30]]}]}
    def test_single_containing_footprint_matches_but_nearest_never_does(self):
        self.assertEqual(resolve_reference(self.area,self.snapshot)['buildingId'],'inside')
        self.area['center']['lat']=.00012
        result=resolve_reference(self.area,self.snapshot)
        self.assertIsNone(result['buildingId']);self.assertTrue(result['candidates'])
    def test_holes_and_multiple_containing_footprints_require_confirmation(self):
        self.snapshot['buildings'][0]['polygons']=[{'outer':[[-5,-5],[5,-5],[5,5],[-5,5]],'holes':[[[-1,-1],[-1,1],[1,1],[1,-1]]]}]
        self.assertIsNone(resolve_reference(self.area,self.snapshot)['buildingId'])
        self.snapshot['buildings'].append({'id':'overlapping','footprint':[[-8,-8],[8,-8],[8,8],[-8,8]]})
        del self.snapshot['buildings'][0]['polygons']
        self.assertEqual(resolve_reference(self.area,self.snapshot)['status'],'ambiguous')
    def test_manual_choice_is_labelled_and_checked_against_current_candidates(self):
        result=reference_context(self.area,self.snapshot,'near')
        self.assertEqual(result['status'],'user-confirmed');self.assertEqual(result['buildingId'],'near')
        with self.assertRaises(ValueError):reference_context(self.area,self.snapshot,'unknown')
        self.assertIsNone(resolve_reference({'id':'downtown'},self.snapshot))
    def test_complex_is_not_silently_reduced_to_a_single_building(self):
        self.area['landmark']={'name':'A shopping complex','complex':True}
        self.assertIsNone(resolve_reference(self.area,self.snapshot)['buildingId'])
