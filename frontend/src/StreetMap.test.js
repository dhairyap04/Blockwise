import * as THREE from "three";
import {groundFootprint} from "./StreetMap";
import {viewportTiles} from "./mapTiles";
test("visible ground corners are covered by the adaptive street layer",()=>{
  const camera=new THREE.PerspectiveCamera(45,1.6,.5,20000);camera.position.set(100,500,800);camera.lookAt(0,0,0);
  const footprint=groundFootprint(camera);expect(footprint).toHaveLength(4);
  const tiles=viewportTiles(footprint,{lon:-114.073,lat:51.047});
  footprint.forEach(([x,z])=>expect(tiles.some(t=>Math.abs(t.position[0]-x)<=t.width/2+.01 && Math.abs(t.position[2]-z)<=t.height/2+.01)).toBe(true));
});
test("a horizon-facing camera does not return an invalid ground footprint",()=>{
  const camera=new THREE.PerspectiveCamera(45,1.6,.5,20000);camera.position.set(0,1,1000);camera.lookAt(0,0,0);
  expect(groundFootprint(camera)).toBeNull();
});
