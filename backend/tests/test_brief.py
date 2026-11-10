from io import BytesIO
import unittest
from pypdf import PdfReader
from brief import build_brief
import test_api
from test_queries import BUILDINGS
from data import DEFAULT_BBOX

class BriefTests(unittest.TestCase):
    def test_pdf_contains_evidence_missing_values_and_escaped_notes(self):
        buildings=[{**b,'footprint':[[0,0],[10,0],[10,10],[0,10]],'parcel_id':'p' if b['id']!='c' else None} for b in BUILDINGS]
        snapshot={'buildings':buildings,'origin':(-114.073,51.047),'fetched_at':1794260000,'version':'test-version'}
        pdf=build_brief(snapshot,{'name':'Downtown','bbox':DEFAULT_BBOX},buildings,'Neighbourhood discussion','Notes <script> & details')
        reader=PdfReader(BytesIO(pdf));text='\n'.join(p.extract_text() for p in reader.pages)
        for required in ['Neighbourhood discussion','Unavailable','SHARED PARCEL','test-version','Notes <script> & details','https://data.calgary.ca/d/cchr-krqg']:
            self.assertIn(required,text)
        self.assertLessEqual(len(reader.pages),3)

class BriefApiTests(unittest.TestCase):
    setUp=test_api.ApiTests.setUp
    tearDown=test_api.ApiTests.tearDown
    def test_brief_uses_snapshot_and_rejects_unknown_or_stale_ids(self):
        data=self.client.get('/api/buildings').get_json()
        body={'area':'downtown','buildingIds':['a','c'],'title':'Meeting brief','datasetVersion':data['datasetVersion']}
        response=self.client.post('/api/brief',json=body)
        self.assertEqual(response.status_code,200);self.assertEqual(response.mimetype,'application/pdf')
        self.assertIn('Meeting brief',PdfReader(BytesIO(response.data)).pages[0].extract_text())
        self.assertEqual(self.client.post('/api/brief',json={**body,'buildingIds':['missing']}).status_code,400)
        self.assertEqual(self.client.post('/api/brief',json={**body,'buildingIds':['a','a']}).status_code,400)
        self.assertEqual(self.client.post('/api/brief',json={**body,'datasetVersion':'stale'}).status_code,409)
