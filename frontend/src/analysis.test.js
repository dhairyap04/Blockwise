import { summarize, sortBuildings, resultsCsv } from "./analysis";
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

test('nearby suggestions use geographic distance, exclude the anchor and invalid coordinates, and break ties deterministically', () => {
  const {nearestBuildings}=require('./analysis');
  const anchor={id:'home',latitude:51,longitude:-114};
  const candidates=[anchor,{id:'far',latitude:51.002,longitude:-114},{id:'z',latitude:51.001,longitude:-114},{id:'a',latitude:51.001,longitude:-114},{id:'missing',latitude:null,longitude:-114},{id:'invalid',latitude:100,longitude:0}];
  const result=nearestBuildings(candidates,anchor,2);
  expect(result.map(r=>r.building.id)).toEqual(['a','z']);
  expect(result[0].distanceM).toBeCloseTo(111.195,1);
  expect(nearestBuildings(candidates,{id:'bad',latitude:NaN,longitude:0})).toEqual([]);
});
