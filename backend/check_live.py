"""Opt-in real service check; no credentials are logged. Not part of offline CI."""
import argparse
import json
import os
from pathlib import Path
from dotenv import load_dotenv
from data import fetch_and_normalize_buildings
from llm_filter import parse_query, apply_filter


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--require-llm', action='store_true', help='Fail if real LLM inference is unavailable')
    args = parser.parse_args()
    load_dotenv(Path(__file__).with_name('.env'))
    buildings, _ = fetch_and_normalize_buildings()
    report = {'buildings':len(buildings), 'parcel_matches':sum(b['parcel_id'] is not None for b in buildings), 'queries':[]}
    failed = False
    for query in ['highlight buildings over 100 feet','show commercial buildings','show buildings in RC-G zoning','show buildings less than $500,000 in value']:
        filt, mode, warning = parse_query(query, os.getenv('HF_API_KEY') or os.getenv('HF_TOKEN'))
        report['queries'].append({'query':query,'filter':filt,'parser':mode,'matches':len(apply_filter(buildings,filt)), 'warning':warning})
        failed = failed or (args.require_llm and mode != 'llm')
    print(json.dumps(report,indent=2))
    return 1 if failed else 0


if __name__ == '__main__':
    raise SystemExit(main())
