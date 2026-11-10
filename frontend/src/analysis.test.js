import { summarize, sortBuildings, resultsCsv } from "./analysis";
import { mapTiles, localPoint } from "./mapTiles";
const buildings=[
  {id:"a",height_m:10,parcel_id:"p",assessed_value:400000,zoning_codes:["R-CG"]},
  {id:"b",height_m:40,parcel_id:"p",assessed_value:400000,zoning_codes:["R-CG"]},
  {id:"c",height_m:null,parcel_id:null,assessed_value:null,parcel_overlap:0.2},
  {id:"d",height_m:70,parcel_id:null,assessed_value:null,parcel_overlap:null},
];
test("summary deduplicates parcels and excludes unknown heights",() => {
  const s=summarize(buildings);expect(s.medianHeight).toBe(40);expect(s.missingHeights).toBe(1);
  expect(s.parcels).toBe(1);expect(s.medianAssessment).toBe(400000);expect(s.assessedParcels).toBe(1);
  expect(s.bins).toEqual([1,0,1,1]);expect(s.lowOverlap).toBe(1);expect(s.noOverlap).toBe(1);
  expect(s.zones).toEqual([["R-CG",2]]);
});
test("sorting keeps unknown heights last and leaves input order intact",() => {
  expect(sortBuildings(buildings,"tallest").map(b=>b.id)).toEqual(["d","b","a","c"]);
  expect(sortBuildings(buildings,"shortest").map(b=>b.id)).toEqual(["a","b","d","c"]);
  expect(buildings[0].id).toBe("a");expect(summarize([]).medianHeight).toBeNull();
});
test("CSV escapes commas, quotes, and formula text and includes provenance",() => {
  const csv=resultsCsv([{...buildings[0],address:'=HYPERLINK("bad"), unsafe'}],{area:"downtown",datasetVersion:"v1",sources:[{url:"https://data.calgary.ca"}]});
  expect(csv).toContain('"\'=HYPERLINK(""bad""), unsafe"');expect(csv).toContain('"downtown"');expect(csv).toContain('"v1"');expect(csv).toContain('"https://data.calgary.ca"');
});
test("street tiles cover only the study area and use the building projection",() => {
  const bbox={min_lon:-114.078,max_lon:-114.068,min_lat:51.044,max_lat:51.050},origin={lon:-114.073,lat:51.047};
  const tiles=mapTiles(bbox,origin);expect(tiles.length).toBeGreaterThan(0);expect(tiles.length).toBeLessThanOrEqual(12);
  expect(localPoint(origin.lon,origin.lat,origin)).toEqual([0,0]);expect(mapTiles(null,origin)).toEqual([]);
  expect(new Set(tiles.map(t=>t.id)).size).toBe(tiles.length);
  for(const tile of tiles){expect(tile.width).toBeGreaterThan(0);expect(tile.height).toBeGreaterThan(0);expect(tile.url).toMatch(/^https:\/\/tile.openstreetmap.org\/16\//);}
});
