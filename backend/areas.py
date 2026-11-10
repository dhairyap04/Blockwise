"""Small, bounded Calgary study areas; no arbitrary citywide downloads."""
AREAS = {
    'downtown': {'id':'downtown', 'name':'Downtown', 'bbox':dict(min_lon=-114.078,min_lat=51.044,max_lon=-114.068,max_lat=51.050)},
    'beltline': {'id':'beltline', 'name':'Beltline', 'bbox':dict(min_lon=-114.079,min_lat=51.035,max_lon=-114.069,max_lat=51.041)},
    'east-village': {'id':'east-village', 'name':'East Village', 'bbox':dict(min_lon=-114.053,min_lat=51.043,max_lon=-114.043,max_lat=51.049)},
    'kensington': {'id':'kensington', 'name':'Kensington', 'bbox':dict(min_lon=-114.091,min_lat=51.050,max_lon=-114.081,max_lat=51.056)},
    'marda-loop': {'id':'marda-loop', 'name':'Marda Loop', 'bbox':dict(min_lon=-114.106,min_lat=51.022,max_lon=-114.096,max_lat=51.028)},
}


def get_area(area_id='downtown'):
    if not isinstance(area_id,str) or area_id not in AREAS:
        raise ValueError('Choose a supported Calgary neighbourhood.')
    return AREAS[area_id]
