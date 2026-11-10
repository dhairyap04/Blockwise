"""Small, bounded Calgary study areas; no arbitrary citywide downloads."""
AREAS = {
    'downtown': {'id':'downtown', 'name':'Downtown', 'bbox':dict(min_lon=-114.078,min_lat=51.044,max_lon=-114.068,max_lat=51.050)},
    'beltline': {'id':'beltline', 'name':'Beltline', 'bbox':dict(min_lon=-114.079,min_lat=51.035,max_lon=-114.069,max_lat=51.041)},
    'east-village': {'id':'east-village', 'name':'East Village', 'bbox':dict(min_lon=-114.053,min_lat=51.043,max_lon=-114.043,max_lat=51.049)},
    'kensington': {'id':'kensington', 'name':'Kensington', 'bbox':dict(min_lon=-114.091,min_lat=51.050,max_lon=-114.081,max_lat=51.056)},
    'marda-loop': {'id':'marda-loop', 'name':'Marda Loop', 'bbox':dict(min_lon=-114.106,min_lat=51.022,max_lon=-114.096,max_lat=51.028)},
}


def get_area(area_id='downtown'):
    if isinstance(area_id,str) and area_id in AREAS:return AREAS[area_id]
    import re
    from database import get_study_area
    if isinstance(area_id,str) and re.fullmatch(r'address-[0-9a-f]{16}',area_id):
        area=get_study_area(area_id)
        if area:return area
    raise ValueError('Choose a supported Calgary study area or search for an address again.')


def create_address_area(match,size_m,landmark=None):
    import hashlib
    import math
    from database import save_study_area
    from geocoding import ADDRESS_SOURCE
    if isinstance(size_m,bool) or size_m not in (400,600,800,1200,1600):raise ValueError('Choose a 400, 600, 800, 1200, or 1600 metre study area.')
    lat,lon=match['latitude'],match['longitude']
    half_lat=size_m/2/110540;half_lon=size_m/2/(111320*math.cos(math.radians(lat)))
    key=f"{match['address']}|{lat:.7f}|{lon:.7f}|{size_m}"
    if landmark:key+="|landmark:"+landmark["id"]
    area={'id':'address-'+hashlib.sha256(key.encode()).hexdigest()[:16], 'name':f"{match['address']} - {size_m} m square",
        'bbox':{'min_lon':round(lon-half_lon,7),'max_lon':round(lon+half_lon,7),'min_lat':round(lat-half_lat,7),'max_lat':round(lat+half_lat,7)},
        'address':match['address'],'center':{'lat':lat,'lon':lon},'size_m':size_m,'source':ADDRESS_SOURCE}
    if landmark:
        area['name']=f"{landmark['name']} - {size_m} m square"
        area['landmark']={k:landmark[k] for k in ('id','name','complex','reviewedAt','anchorSource')}
        area['source']=landmark['source']
    return save_study_area(area)
