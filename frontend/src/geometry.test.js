import { createBuildingGeometries } from "./geometry";
const outer = [[0,0],[10,0],[10,10],[0,10],[0,0]];

test("buildings have roof caps and true metre-scale height on Y", () => {
  const [geometry] = createBuildingGeometries({ footprint: outer, height_m: 40 });
  geometry.computeBoundingBox();
  expect(geometry.boundingBox.max.y).toBeCloseTo(40);
  expect(geometry.boundingBox.min.y).toBeCloseTo(0);
  expect(geometry.boundingBox.min.z).toBeCloseTo(-10);
  // Regression: Three r175 generated zero cap triangles with bevelEnabled=false.
  expect(geometry.groups.find(group => group.materialIndex === 0).count).toBeGreaterThan(0);
  const normals = geometry.attributes.normal;
  expect(Array.from({ length: normals.count }, (_, i) => normals.getY(i)).some(y => y > 0.99)).toBe(true);
  geometry.dispose();
});
test("courtyards remain holes and unknown heights use an explicit 1 m placeholder", () => {
  const [geometry] = createBuildingGeometries({ polygons: [{ outer, holes: [[[3,3],[3,7],[7,7],[7,3],[3,3]]] }], height_m: null });
  expect(geometry.parameters.shapes.holes).toHaveLength(1);
  geometry.computeBoundingBox(); expect(geometry.boundingBox.max.y).toBeCloseTo(1);
  geometry.dispose();
});
