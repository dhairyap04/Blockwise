"""Conservative address-to-footprint association; proximity is never identity."""
import math
from shapely.geometry import Point, Polygon


def local_point(lon,lat,origin):
    return ((lon-origin[0])*111320*math.cos(math.radians(origin[1])),(lat-origin[1])*110540)


def building_shapes(building):
    return [Polygon(p['outer'],p.get('holes',[])) for p in building.get('polygons',[{'outer':building.get('footprint',[])}]) if len(p['outer'])>=3]


def resolve_reference(area,snapshot):
    if not area.get('center'):return None
    center=area['center'];point=Point(local_point(center['lon'],center['lat'],snapshot['origin']))
    distances=[]
    for building in snapshot['buildings']:
        shapes=building_shapes(building)
        if not shapes:continue
        distance=min(s.distance(point) for s in shapes)
        distances.append({'id':building['id'],'distanceM':round(distance,1),'containsPoint':any(s.covers(point) for s in shapes)})
    containing=[c for c in distances if c['containsPoint']]
    candidates=sorted([c for c in distances if c['distanceM']<=80],key=lambda c:(c['distanceM'],c['id']))[:6]
    matched=containing[0]['id'] if len(containing)==1 and not area.get('landmark',{}).get('complex') else None
    return {'point':center,'label':area.get('landmark',{}).get('name') or area['address'],
        'address':area['address'],'buildingId':matched,'status':'matched' if matched else 'ambiguous' if candidates else 'unmatched',
        'method':'point-in-footprint' if matched else None,'candidates':candidates,
        'explanation':'The address point lies inside one City building footprint. This is a spatial association, not an official building identifier.' if matched else 'Choose a candidate after inspecting the map. Nearby footprints are suggestions, not address matches.' if candidates else 'No building footprint was identified within 80 m. The pin still marks the searched location.'}


def reference_context(area,snapshot,chosen=None):
    reference=resolve_reference(area,snapshot)
    if chosen is not None:
        if not isinstance(chosen,str) or not reference or chosen not in {c['id'] for c in reference['candidates']}:
            raise ValueError('The reference must be a current candidate near the searched location. Reload the study and choose again.')
        reference={**reference,'buildingId':chosen,'status':'user-confirmed','method':'user-confirmed',
            'explanation':'You chose this footprint as the reference. This choice is not an official building-to-address link.'}
    return reference
