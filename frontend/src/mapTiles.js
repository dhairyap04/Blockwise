/** Visible-area slippy tiles positioned in the same local projection as buildings. */
export const TILE_TEMPLATE = process.env.REACT_APP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export function localPoint(lon,lat,origin) {
  return [(lon-origin.lon)*111320*Math.cos(origin.lat*Math.PI/180),(lat-origin.lat)*110540];
}
export function mapTiles(bbox,origin,zoom=16) {
  if (!bbox || !origin) return [];
  const n=2**zoom, tileX=lon => (lon+180)/360*n;
  const tileY=lat => (1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n;
  const lon=x => x/n*360-180, lat=y => Math.atan(Math.sinh(Math.PI*(1-2*y/n)))*180/Math.PI;
  const tiles=[];
  for(let x=Math.floor(tileX(bbox.min_lon));x<=Math.floor(tileX(bbox.max_lon));x++) {
    for(let y=Math.floor(tileY(bbox.max_lat));y<=Math.floor(tileY(bbox.min_lat));y++) {
      const [west,north]=localPoint(lon(x),lat(y),origin), [east,south]=localPoint(lon(x+1),lat(y+1),origin);
      tiles.push({id:`${zoom}/${x}/${y}`,url:TILE_TEMPLATE.replace("{z}",zoom).replace("{x}",x).replace("{y}",y),
        width:east-west,height:north-south,position:[(west+east)/2,-0.15,-(north+south)/2]});
    }
  }
  return tiles;
}
