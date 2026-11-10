/** Reverse the server's local metre projection without altering source geometry. */
export function geographicPoint(x,north,origin) {
  return [origin.lon+x/(111320*Math.cos(origin.lat*Math.PI/180)),origin.lat+north/110540];
}
export function buildingsGeoJSON(buildings,origin) {
  return {type:'FeatureCollection',features:buildings.map(b=>({type:'Feature',id:b.id,
    properties:{buildingId:b.id,height:b.height_m ?? 1},
    geometry:{type:'MultiPolygon',coordinates:(b.polygons || [{outer:b.footprint,holes:[]}]).map(p=>[p.outer,...(p.holes || [])].map(ring=>ring.map(([x,north])=>geographicPoint(x,north,origin))))}
  }))};
}
export function boundaryGeoJSON(bbox) {
  const {min_lon:w,min_lat:s,max_lon:e,max_lat:n}=bbox;
  return {type:'Feature',properties:{},geometry:{type:'LineString',coordinates:[[w,s],[e,s],[e,n],[w,n],[w,s]]}};
}
export function buildingColor(selected,highlighted) {
  return ['case',['==',['get','buildingId'],selected || ''], '#f97316',
    ['in',['get','buildingId'],['literal',highlighted]],'#38bdf8','#237c77'];
}
export const EMPTY_STYLE={version:8,sources:{},layers:[{id:'plain-ground',type:'background',paint:{'background-color':'#edf1ed'}}]};
export function evidenceStyle(base,buildings,origin,bbox) {
  return {...base,sources:{...base.sources,'calgary-buildings':{type:'geojson',data:buildingsGeoJSON(buildings,origin)},'study-boundary':{type:'geojson',data:boundaryGeoJSON(bbox)}},
    layers:[...EMPTY_STYLE.layers,...base.layers.filter(l=>l.id!=='plain-ground' && !l.id.includes('building') && l.type!=='fill-extrusion'),
      {id:'calgary-buildings',type:'fill-extrusion',source:'calgary-buildings',paint:{'fill-extrusion-color':buildingColor(null,[]),'fill-extrusion-height':['get','height'],'fill-extrusion-opacity':1,'fill-extrusion-vertical-gradient':true}},
      {id:'study-boundary',type:'line',source:'study-boundary',paint:{'line-color':'#b7791f','line-width':2,'line-dasharray':[3,2]}}]};
}

export function buildingFocusBounds(building,origin) {
  const points=(building.polygons || [{outer:building.footprint}]).flatMap(p=>p.outer);
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  // fitBounds measures ground area; include height as context so an extrusion
  // does not fill or clip the screen when focusing on a narrow tall tower.
  const margin=Math.max(45,(building.height_m ?? 1)*1.1);
  return [geographicPoint(Math.min(...xs)-margin,Math.min(...ys)-margin,origin),
    geographicPoint(Math.max(...xs)+margin,Math.max(...ys)+margin,origin)];
}
