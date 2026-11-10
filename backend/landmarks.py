"""Small, source-backed directory. Names are not City assessment attributes."""
import json
import re
from pathlib import Path
from shapely.geometry import Point
from reference import building_shapes,local_point

LANDMARKS=json.loads(Path(__file__).with_name('landmarks.json').read_text())
NAME_FIELDS=('name','name_source_url','name_match','name_reviewed_at','name_aliases')


def get_landmark(identifier):
    if not isinstance(identifier,str):raise ValueError('Choose a listed Calgary landmark.')
    result=next((p for p in LANDMARKS if p['id']==identifier),None)
    if result is None:raise ValueError('Choose a listed Calgary landmark.')
    return result


def search_landmarks(query):
    if not isinstance(query,str) or not 3<=len(query.strip())<=120:raise ValueError('Enter 3-120 characters of an address or landmark name.')
    tokens=re.findall(r'[a-z0-9]+',query.lower())
    if not tokens:raise ValueError('Enter an address or landmark name, not punctuation.')
    matches=[]
    for place in LANDMARKS:
        text=' '.join([place['name'],place['address'],*place['aliases']]).lower()
        if all(token in text for token in tokens):
            matches.append({**{k:place[k] for k in ('name','address','latitude','longitude','complex','source','reviewedAt','anchorSource')},'landmarkId':place['id']})
    return matches


def reviewed_components(place,buildings,origin):
    index={b['id']:b for b in buildings};result=[]
    for component in place['components']:
        b=index.get(component['id'])
        if not b:continue
        point=Point(local_point(component['longitude'],component['latitude'],origin))
        if any(shape.covers(point) for shape in building_shapes(b)):result.append(b['id'])
    return result


def enrich_buildings(buildings,origin):
    names={}
    for place in LANDMARKS:
        for identifier in reviewed_components(place,buildings,origin):
            names[identifier]={'name':place['name'],'name_source_url':place['source']['url'],
                'name_match':'Reviewed landmark-to-footprint association; not a City building identifier',
                'name_reviewed_at':place['reviewedAt'],'name_aliases':place['aliases']}
    return [{**{k:v for k,v in b.items() if k not in NAME_FIELDS},**names.get(b['id'],{})} for b in buildings]


def landmark_sources(buildings,area):
    urls={b['name_source_url']:b['name']+' - name source' for b in buildings if b.get('name_source_url')}
    if area.get('landmark'):urls[area['source']['url']]=area['source']['name']
    return [{'name':name,'url':url} for url,name in urls.items()]
