import {buildingsGeoJSON,boundaryGeoJSON,buildingColor,evidenceStyle,buildingFocusBounds} from './mapGeometry';
const origin={lon:-114.073,lat:51.047};
const outer=[[0,0],[10,0],[10,10],[0,10],[0,0]],hole=[[2,2],[2,4],[4,4],[4,2],[2,2]];
const buildings=[{id:'a',height_m:40,polygons:[{outer,holes:[hole]},{outer:outer.map(([x,y])=>[x+20,y]),holes:[]}]},{id:'b',height_m:null,footprint:outer}];
const bbox={min_lon:-114.078,max_lon:-114.068,min_lat:51.044,max_lat:51.050};
test('geographic features preserve metre heights, multipart footprints, courtyard holes and stable IDs',()=>{
  const data=buildingsGeoJSON(buildings,origin);
  expect(data.features[0].id).toBe('a');expect(data.features[0].properties.height).toBe(40);
  const coordinates=data.features[0].geometry.coordinates;
  expect(coordinates).toHaveLength(2);expect(coordinates[0]).toHaveLength(2);expect(coordinates[0][0][0]).toEqual([origin.lon,origin.lat]);
  expect((coordinates[0][0][1][0]-origin.lon)*111320*Math.cos(origin.lat*Math.PI/180)).toBeCloseTo(10);
  expect((coordinates[0][0][2][1]-origin.lat)*110540).toBeCloseTo(10);
  expect(data.features[1].properties.height).toBe(1);
});
test('basemap buildings cannot masquerade as Calgary evidence and boundary stays closed',()=>{
  const style=evidenceStyle({version:8,sources:{base:{}},layers:[{id:'building',type:'fill'},{id:'other-extrusions',type:'fill-extrusion'},{id:'roads',type:'line'}]},buildings,origin,bbox);
  expect(style.layers.map(l=>l.id)).toEqual(['plain-ground','roads','calgary-buildings','study-boundary']);
  expect(style.sources['calgary-buildings'].data.features).toHaveLength(2);
  const ring=boundaryGeoJSON(bbox).geometry.coordinates;expect(ring[0]).toEqual(ring.at(-1));
  expect(buildingColor('a',['b'])).toContain('#f97316');expect(buildingColor('a',['b'])).toContain('#38bdf8');
});

test('focusing a narrow tall tower leaves room for its vertical extent',()=>{
  const [southWest,northEast]=buildingFocusBounds({...buildings[0],height_m:240},origin);
  const width=(northEast[0]-southWest[0])*111320*Math.cos(origin.lat*Math.PI/180);
  const depth=(northEast[1]-southWest[1])*110540;
  expect(width).toBeGreaterThan(480);expect(depth).toBeGreaterThan(480);
});
