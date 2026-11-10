"""Calgary-owned parcel-address lookup; selected points are verified at source."""
import math
import re
import requests

ADDRESS_URL='https://data.calgary.ca/resource/9zvu-p8uz.json'
ADDRESS_SOURCE={'name':'Calgary Parcel Address','url':'https://data.calgary.ca/d/9zvu-p8uz'}
ABBREVIATIONS={'AVENUE':'AV','STREET':'ST','ROAD':'RD','TRAIL':'TR','BOULEVARD':'BV','DRIVE':'DR','CRESCENT':'CR','COURT':'CO','PLACE':'PL','LANE':'LN','NORTHWEST':'NW','NORTHEAST':'NE','SOUTHWEST':'SW','SOUTHEAST':'SE'}


def _query(where):
    try:
        response=requests.get(ADDRESS_URL,params={'$select':'address,latitude,longitude','$where':where,
            '$group':'address,latitude,longitude','$order':'address,latitude,longitude','$limit':8},timeout=(10,30))
        response.raise_for_status();rows=response.json()
        if not isinstance(rows,list):raise ValueError('Unexpected source response')
        matches=[]
        for row in rows:
            try:
                lat,lon=float(row['latitude']),float(row['longitude'])
                if not math.isfinite(lat) or not math.isfinite(lon) or not (50.7<=lat<=51.4 and -114.5<=lon<=-113.7):continue
                if isinstance(row.get('address'),str):matches.append({'address':row['address'],'latitude':lat,'longitude':lon})
            except (KeyError,ValueError,TypeError):continue
        return matches
    except (requests.RequestException,ValueError) as error:
        raise RuntimeError('Calgary address search is unavailable. Please retry or use a preset area.') from error


def search_addresses(query):
    if not isinstance(query,str) or not 3<=len(query.strip())<=120:
        raise ValueError('Enter 3-120 characters of a Calgary street address.')
    normalized=re.sub(r'(\d+)(?:ST|ND|RD|TH)\b',r'\1',query.upper())
    tokens=[ABBREVIATIONS.get(token,token) for token in re.findall(r'[A-Z0-9]+',normalized)]
    if not tokens or len(''.join(tokens))<3:raise ValueError('Enter a Calgary street address, not punctuation.')
    # Tokens are alphanumeric; users cannot inject SoQL or supply wildcards.
    pattern=('%'.join(tokens)+'%') if re.fullmatch(r'\d+[A-Z]?',tokens[0]) else ('%'+'%'.join(tokens)+'%')
    if re.fullmatch(r'\d+[A-Z]?',tokens[0]):pattern=tokens[0]+' %'+'%'.join(tokens[1:])+'%'
    return _query(f"upper(address) like '{pattern}'")


def verify_address(address,latitude,longitude):
    if not isinstance(address,str) or not 3<=len(address.strip())<=160:raise ValueError('Choose a returned address match.')
    if isinstance(latitude,bool) or isinstance(longitude,bool):raise ValueError('Choose a returned address point.')
    try:lat,lon=float(latitude),float(longitude)
    except (TypeError,ValueError) as error:raise ValueError('Choose a returned address point.') from error
    if not math.isfinite(lat) or not math.isfinite(lon):raise ValueError('Choose a finite address point.')
    escaped=address.strip().upper().replace("'","''")
    matches=_query(f"upper(address) = '{escaped}'")
    match=next((m for m in matches if abs(m['latitude']-lat)<1e-6 and abs(m['longitude']-lon)<1e-6),None)
    if match is None:raise ValueError('That address point could not be verified. Search and choose a match again.')
    return match
