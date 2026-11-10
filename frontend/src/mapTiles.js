/** Visible-area slippy tiles in the same local projection as buildings. */
export const TILE_TEMPLATE = process.env.REACT_APP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export function localPoint(lon,lat,origin) {
  return [(lon-origin.lon)*111320*Math.cos(origin.lat*Math.PI/180),(lat-origin.lat)*110540];
}
export function geographicPoint(x,north,origin) {
  return [origin.lon+x/(111320*Math.cos(origin.lat*Math.PI/180)),origin.lat+north/110540];
}
function tileRange(bbox,zoom) {
  const n=2**zoom, x=lon => (lon+180)/360*n;
  const y=lat => (1-Math.asinh(Math.tan(Math.max(-85,Math.min(85,lat))*Math.PI/180))/Math.PI)/2*n;
  return {left:Math.floor(x(bbox.min_lon)),right:Math.floor(x(bbox.max_lon)),top:Math.floor(y(bbox.max_lat)),bottom:Math.floor(y(bbox.min_lat))};
}
export function mapTiles(bbox,origin,zoom=16) {
  if (!bbox || !origin) return [];
  const n=2**zoom, range=tileRange(bbox,zoom);
  const lon=x => x/n*360-180, lat=y => Math.atan(Math.sinh(Math.PI*(1-2*y/n)))*180/Math.PI;
  const tiles=[];
  for(let x=range.left;x<=range.right;x++) for(let y=range.top;y<=range.bottom;y++) {
    const [west,north]=localPoint(lon(x),lat(y),origin),[east,south]=localPoint(lon(x+1),lat(y+1),origin);
    tiles.push({id:`${zoom}/${x}/${y}`,url:TILE_TEMPLATE.replace("{z}",zoom).replace("{x}",x).replace("{y}",y),
      width:east-west,height:north-south,position:[(west+east)/2,-0.15,-(north+south)/2]});
  }
  return tiles;
}
// Separating-axis test: reject tiles outside the ground footprint of the camera.
export function intersectsFootprint(tile,polygon) {
  const [cx,,cz]=tile.position,w=tile.width/2,h=tile.height/2;
  const rectangle=[[cx-w,cz-h],[cx+w,cz-h],[cx+w,cz+h],[cx-w,cz+h]];
  const axes=[[1,0],[0,1],...polygon.map((p,i) => {const q=polygon[(i+1)%polygon.length];return [p[1]-q[1],q[0]-p[0]];})];
  return axes.every(([x,y]) => {
    const a=polygon.map(p => p[0]*x+p[1]*y),b=rectangle.map(p => p[0]*x+p[1]*y);
    return Math.max(...a)>=Math.min(...b) && Math.max(...b)>=Math.min(...a);
  });
}
export function viewportTiles(polygon,origin,maxTiles=36) {
  if(!polygon?.length || !origin) return [];
  const coordinates=polygon.map(([x,z]) => geographicPoint(x,-z,origin));
  const bbox={min_lon:Math.min(...coordinates.map(p=>p[0])),max_lon:Math.max(...coordinates.map(p=>p[0])),min_lat:Math.min(...coordinates.map(p=>p[1])),max_lat:Math.max(...coordinates.map(p=>p[1]))};
  let zoom=16;
  while(zoom>1) {const r=tileRange(bbox,zoom);if((r.right-r.left+1)*(r.bottom-r.top+1)<=maxTiles) break;zoom--;}
  return mapTiles(bbox,origin,zoom).filter(tile=>intersectsFootprint(tile,polygon));
}
