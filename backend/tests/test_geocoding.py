import unittest
from unittest.mock import patch,Mock
from geocoding import search_addresses,verify_address
MATCH={'address':'800 MACLEOD TR SE','latitude':'51.045397','longitude':'-114.057927'}

class GeocodingTests(unittest.TestCase):
    @patch('geocoding.requests.get')
    def test_normalized_lookup_uses_bounded_city_source(self,get):
        get.return_value=Mock(json=lambda:[MATCH])
        result=search_addresses('800 Macleod Trail SE')
        params=get.call_args.kwargs['params']
        self.assertEqual(params['$limit'],8);self.assertIn("800 %MACLEOD%TR%SE%",params['$where'])
        self.assertEqual(result[0]['address'],'800 MACLEOD TR SE')

    @patch('geocoding.requests.get')
    def test_selection_is_verified_not_arbitrary_coordinates(self,get):
        get.return_value=Mock(json=lambda:[MATCH])
        self.assertEqual(verify_address(MATCH['address'],float(MATCH['latitude']),float(MATCH['longitude']))['address'],MATCH['address'])
        with self.assertRaises(ValueError):verify_address(MATCH['address'],51.2,-114.2)

    def test_invalid_lookup_is_rejected(self):
        for query in [None,7,'ab','%%%','a'*121]:
            with self.subTest(query=query),self.assertRaises(ValueError):search_addresses(query)
