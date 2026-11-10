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
