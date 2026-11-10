import * as THREE from "three";

/** Preserve polygon holes and rotate metre-scale extrusion into a Y-up scene. */
export function createBuildingGeometries(building) {
  return (building.polygons || [{ outer: building.footprint, holes: [] }]).map(polygon => {
    const shape = new THREE.Shape(polygon.outer.map(([x, y]) => new THREE.Vector2(x, y)));
    shape.holes = (polygon.holes || []).map(ring => new THREE.Path(ring.map(([x, y]) => new THREE.Vector2(x, y))));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: building.height_m ?? 1, steps: 1, bevelEnabled: false });
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  });
}
