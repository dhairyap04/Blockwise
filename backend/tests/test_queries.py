import unittest
from unittest.mock import Mock, patch
from llm_filter import parse_query, apply_filter, validate_filter

BUILDINGS = [
    {'id':'a', 'height':100.0, 'height_m':30.48, 'assessed_value':450000, 'zoning':'R-CG', 'zoning_codes':['R-CG']},
    {'id':'b', 'height':200, 'height_m':60.96, 'assessed_value':2000000, 'zoning':'C-COR2', 'zoning_codes':['C-COR2']},
    {'id':'c', 'height':None, 'height_m':None, 'assessed_value':None, 'zoning':None},
]

class QueryTests(unittest.TestCase):
    def test_fallback_interpretation_and_matches(self):
        cases = [('over 100 feet',['b']), ('over $500,000',['b']), ('over 30 metres',['a','b']),
                 ('under 500 feet',['a','b']), ('height >= 100',['a','b']), ('height = 100',['a']),
                 ('RC-G zoning',['a']), ('MU-2 zoning',[]), ('commercial buildings',['b']),
                 ('under $1.5 million',['a']), ('over 30m',['a','b']),
                 ('RC-G zoning and under 150 feet',['a']), ('RC-G zoning or over 150 feet',['a','b'])]
        for query, ids in cases:
            with self.subTest(query=query):
                filt, parser, warning = parse_query(query)
                self.assertEqual(apply_filter(BUILDINGS,filt),ids)
                self.assertEqual(parser,'rules'); self.assertIsNotNone(warning)

    def test_unsupported_queries(self):
        for query in ['hello','',None,7,'RC-G buildings over 100 feet','a'*1001]:
            with self.subTest(query=query), self.assertRaises(ValueError): parse_query(query)

    def test_invalid_filters(self):
        for filt in [None,[],{}, {'attribute':[],'operator':'>','value':10},
                     {'attribute':'nonsense','operator':'>','value':10},
                     {'attribute':'height','operator':'BAD','value':10},
                     {'attribute':'height','operator':'>','value':'NaN'},
                     {'attribute':'height','operator':'>','value':True},
                     {'attribute':'zoning','operator':'>','value':'RC-G'},
                     {'logic':'and','conditions':[]}]:
            with self.subTest(filter=filt), self.assertRaises(ValueError): validate_filter(filt)

    @patch('llm_filter.requests.post')
    def test_llm_request_and_validation(self, post):
        post.return_value=Mock(json=lambda:{'choices':[{'message':{'content':'{"attribute":"height_m","operator":">","value":30}'}}]})
        filt,parser,warning=parse_query('buildings taller than thirty metres','test-key')
        self.assertEqual(parser,'llm'); self.assertIsNone(warning)
        self.assertEqual(filt['attribute'],'height_m')
        self.assertEqual(post.call_args.args[0],'https://router.huggingface.co/v1/chat/completions')
        self.assertNotIn('test-key',str(post.call_args.kwargs['json']))

    @patch('llm_filter.requests.post')
    def test_invalid_llm_output_explicit_fallback(self, post):
        post.return_value=Mock(json=lambda:{'choices':[{'message':{'content':'{"attribute":"invalid","operator":">","value":30}'}}]})
        filt,parser,warning=parse_query('over 100 feet','test-key')
        self.assertEqual(parser,'rules'); self.assertIn('unavailable',warning)
        self.assertEqual(filt['value'],100)

    def test_real_district_codes_and_categories(self):
        self.assertEqual(parse_query('CR20-C20/R20 zoning')[0]['value'],'CR20-C20/R20')
        self.assertEqual(apply_filter([{'id':'x','zoning':'MU-1'}],{'attribute':'zoning','operator':'category','value':'residential'}),[])
