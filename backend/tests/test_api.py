import importlib
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import database
from test_queries import BUILDINGS

class ApiTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(); self.old_db=database.DB_PATH
        database.DB_PATH=str(Path(self.temp.name)/'test.db')
        self.env=patch.dict(os.environ,{'HF_API_KEY':'','HF_TOKEN':'','BUILDINGS_CACHE_PATH':str(Path(self.temp.name)/'cache.json')});self.env.start()
        module=importlib.import_module('app'); self.app=module.create_app();self.client=self.app.test_client()
        self.fetch=patch('app.fetch_and_normalize_buildings',return_value=(BUILDINGS,(-114.07,51.05))); self.mock_fetch=self.fetch.start()

    def tearDown(self):
        self.fetch.stop();self.env.stop();database.DB_PATH=self.old_db;self.temp.cleanup()

    def test_save_reload_and_user_isolation(self):
        data=self.client.get('/api/buildings').get_json()
        result=self.client.post('/api/query',json={'query':'over 100 feet','datasetVersion':data['datasetVersion']}).get_json()
        self.assertEqual(result['buildingIds'],['b'])
        self.assertEqual(self.client.post('/api/user',json={'username':'Alice'}).status_code,200)
        saved=self.client.post('/api/users/Alice/projects',json={'name':'Tall','filters':result['filters'],'query':'over 100 feet'})
        self.assertEqual(saved.status_code,201); pid=saved.get_json()['id']
        loaded=self.client.get(f'/api/projects/{pid}?username=Alice').get_json()
        self.assertIsInstance(loaded['filters'],dict)
        self.assertEqual(self.client.post('/api/query',json={'filters':loaded['filters']}).get_json()['buildingIds'],result['buildingIds'])
        self.assertEqual(self.client.get(f'/api/projects/{pid}?username=Bob').status_code,404)
        from app import create_app
        self.assertEqual(create_app().test_client().get('/api/users/Alice/projects').get_json()['projects'][0]['name'],'Tall')

    def test_invalid_json_and_fields(self):
        for data in [[],None,{'query':7},{'query':''},{'filters':{}},{'filters':{'attribute':[],'operator':'>','value':1}}]:
            with self.subTest(data=data):
                response=self.client.post('/api/query',json=data)
                self.assertEqual(response.status_code,400);self.assertIn('error',response.get_json())
        for name in ['', '   ',None,7]:
            self.assertEqual(self.client.post('/api/user',json={'username':name}).status_code,400)
        self.assertEqual(self.client.post('/api/query',data='{',content_type='application/json').status_code,400)
        self.assertEqual(self.client.get('/api/missing').status_code,404)

    def test_upstream_failure_recovers(self):
        self.mock_fetch.side_effect=[RuntimeError('Source unavailable'),(BUILDINGS,(0,0))]
        self.assertEqual(self.client.get('/api/buildings').status_code,503)
        self.assertEqual(self.client.get('/api/buildings').status_code,200)
        self.assertEqual(self.mock_fetch.call_count,2)
        self.assertEqual(self.client.get('/api/buildings').status_code,200)
        self.assertEqual(self.mock_fetch.call_count,2)

    def test_refresh_failure_preserves_last_success(self):
        self.client.get('/api/buildings');self.mock_fetch.side_effect=RuntimeError('Source unavailable')
        self.assertEqual(self.client.get('/api/buildings?refresh=1').status_code,503)
        self.assertEqual(self.client.get('/api/buildings').status_code,200)

    def test_map_version_mismatch(self):
        self.assertEqual(self.client.post('/api/query',json={'query':'over 100 feet','datasetVersion':'old'}).status_code,409)

    def test_reads_do_not_create_users(self):
        self.assertEqual(self.client.get('/api/users/New/projects').get_json(),{'projects':[]})
        self.assertIsNone(database.get_user('New'))

    def test_names_and_sql_parameters(self):
        self.assertEqual(self.client.post('/api/user',json={'username':"O'Connor"}).status_code,200)
        self.assertEqual(database.get_user("O'Connor")['username'],"O'Connor")
        self.assertEqual(self.client.post('/api/users/Alice/projects',json={'name':'','filters':{'attribute':'height','operator':'>','value':30}}).status_code,400)

    def test_area_caches_are_isolated_and_inputs_bounded(self):
        areas=self.client.get('/api/areas').get_json()['areas']
        self.assertEqual(len(areas),5)
        downtown=self.client.get('/api/buildings?area=downtown').get_json()
        beltline=self.client.get('/api/buildings?area=beltline').get_json()
        self.assertNotEqual(downtown['datasetVersion'],beltline['datasetVersion'])
        self.client.get('/api/buildings?area=downtown')
        self.assertEqual(self.mock_fetch.call_count,2)
        self.assertNotEqual(self.mock_fetch.call_args_list[0].args[0],self.mock_fetch.call_args_list[1].args[0])
        self.assertEqual(self.client.get('/api/buildings?area=world').status_code,400)
        self.assertEqual(self.client.post('/api/query',json={'query':'over 100 feet','area':[]}).status_code,400)

    def test_project_area_notes_edit_delete_and_ownership(self):
        saved=self.client.post('/api/users/Alice/projects',json={'name':'Beltline analysis','filters':{'attribute':'height_m','operator':'>','value':30},'area':'beltline','notes':'Check low-rise blocks'}).get_json()
        pid=saved['id'];self.assertEqual(saved['area'],'beltline')
        self.assertEqual(saved['notes'],'Check low-rise blocks')
        url=f'/api/projects/{pid}?username=Alice'
        self.assertEqual(self.client.patch(url,json={'name':'Renamed','notes':'x'*4001}).status_code,400)
        edited=self.client.patch(url,json={'name':'Renamed','notes':'Reviewed'}).get_json()
        self.assertEqual(edited['name'],'Renamed');self.assertEqual(edited['area'],'beltline')
        self.assertEqual(self.client.delete(f'/api/projects/{pid}?username=Bob').status_code,404)
        self.assertEqual(self.client.delete(url).status_code,204)
        self.assertEqual(self.client.get(url).status_code,404)

    def test_old_projects_default_to_downtown_on_migration(self):
        with database.get_db() as conn:
            conn.execute('DROP TABLE project')
            conn.execute('CREATE TABLE project (id INTEGER PRIMARY KEY,user_id INTEGER,name TEXT,filters TEXT,created_at TEXT)')
            user=database.get_or_create_user('Legacy')
            conn.execute('INSERT INTO project VALUES (1,?,?,?,?)',(user['id'],'Old','{"attribute":"height","operator":">","value":100}','2025-01-01'))
        database.init_db()
        project=database.get_project(1,user['id'])
        self.assertEqual(project['area'],'downtown');self.assertEqual(project['notes'],'')
        self.assertEqual(project['filters']['value'],100)

    @patch('app.verify_address',return_value={'address':'800 MACLEOD TR SE','latitude':51.045397,'longitude':-114.057927})
    def test_address_area_round_trip_survives_restart(self,verify):
        response=self.client.post('/api/areas/address',json={'address':'800 MACLEOD TR SE','latitude':51.045397,'longitude':-114.057927,'size_m':600})
        self.assertEqual(response.status_code,201);area=response.get_json()
        self.assertTrue(area['id'].startswith('address-'));self.assertEqual(area['size_m'],600)
        self.assertLess(area['bbox']['max_lat']-area['bbox']['min_lat'],.01)
        data=self.client.get('/api/buildings?area='+area['id']).get_json();self.assertEqual(data['areaDescriptor']['address'],'800 MACLEOD TR SE')
        saved=self.client.post('/api/users/Alice/projects',json={'name':'Address study','area':area['id'],'filters':{'attribute':'height_m','operator':'>','value':30}}).get_json()
        from app import create_app
        loaded=create_app().test_client().get(f"/api/projects/{saved['id']}?username=Alice").get_json()
        self.assertEqual(loaded['areaDescriptor']['id'],area['id'])
        self.assertEqual(self.client.post('/api/areas/address',json={'size_m':50000}).status_code,400)

    @patch('app.verify_address',return_value={'address':'800 MACLEOD TR SE','latitude':51.045397,'longitude':-114.057927})
    def test_larger_address_areas_are_bounded_and_keep_distinct_identities(self,verify):
        import math
        body={'address':'800 MACLEOD TR SE','latitude':51.045397,'longitude':-114.057927}
        areas=[]
        for size in (800,1200,1600):
            response=self.client.post('/api/areas/address',json={**body,'size_m':size})
            self.assertEqual(response.status_code,201);area=response.get_json();areas.append(area)
            width=(area['bbox']['max_lon']-area['bbox']['min_lon'])*111320*math.cos(math.radians(body['latitude']))
            self.assertAlmostEqual(width,size,delta=.02)
        self.assertEqual(len({a['id'] for a in areas}),3)
        for size in (True,1601,100000):
            self.assertEqual(self.client.post('/api/areas/address',json={**body,'size_m':size}).status_code,400)

    @patch('app.verify_address',return_value={'address':'Test address','latitude':51.05,'longitude':-114.07})
    def test_manual_reference_survives_project_reload_and_rejects_unknown_ids(self,verify):
        self.mock_fetch.return_value=([{**BUILDINGS[0],'footprint':[[15,15],[25,15],[25,25],[15,25]]}],(-114.07,51.05))
        area=self.client.post('/api/areas/address',json={'address':'Test address','latitude':51.05,'longitude':-114.07,'size_m':600}).get_json()
        body={'name':'Reference study','area':area['id'],'filters':{'attribute':'height_m','operator':'>','value':0},'referenceId':BUILDINGS[0]['id']}
        saved=self.client.post('/api/users/Alice/projects',json=body)
        self.assertEqual(saved.status_code,201);pid=saved.get_json()['id']
        from app import create_app
        loaded=create_app().test_client().get(f'/api/projects/{pid}?username=Alice').get_json()
        self.assertEqual(loaded['reference_id'],BUILDINGS[0]['id'])
        self.assertEqual(self.client.post('/api/users/Alice/projects',json={**body,'referenceId':'unknown'}).status_code,400)

    def test_landmark_creation_uses_registry_not_client_supplied_coordinates(self):
        response=self.client.post('/api/areas/address',json={'landmarkId':'brookfield-place','latitude':0,'longitude':0,'address':'Fake','size_m':600})
        self.assertEqual(response.status_code,201);area=response.get_json()
        self.assertEqual(area['address'],'225 6 AV SW');self.assertLess(area['center']['lon'],-114)
        self.assertEqual(area['landmark']['name'],'Brookfield Place')
        self.assertEqual(self.client.post('/api/areas/address',json={'landmarkId':'missing','size_m':600}).status_code,400)
        matches=self.client.get('/api/addresses?q=Brookfield%20Place').get_json()
        self.assertEqual(matches['matches'],[]);self.assertEqual(matches['landmarks'][0]['landmarkId'],'brookfield-place')
