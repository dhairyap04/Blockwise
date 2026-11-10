/** Metre-scale buildings: east=X, height=Y, north=-Z. */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import * as THREE from "three";
import { createBuildingGeometries } from "./geometry";
import StreetMap from "./StreetMap";
import { localPoint } from "./mapTiles";

export function computeBounds(buildings) {
  const points = buildings.flatMap(b => (b.polygons || [{ outer: b.footprint || [] }]).flatMap(p => p.outer));
  if (!points.length) return { center: [0, 0], distance: 100, height: 10 };
  const xs = points.map(p => p[0]);
  const ys = points.map(p => p[1]);
  return { center: [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2],
    distance: Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 50),
    height: Math.max(...buildings.map(b => b.height_m || 1)) };
}

function Building({ building, highlighted, selected, onSelect }) {
  const geometries = useMemo(() => createBuildingGeometries(building), [building]);
  useEffect(() => () => geometries.forEach(g => g.dispose()), [geometries]);
  return <group>{geometries.map((geometry, index) => <mesh key={index} geometry={geometry}
    onClick={event => { event.stopPropagation(); onSelect(building); }}
    onPointerOver={event => { event.stopPropagation(); document.body.style.cursor = "pointer"; }}
    onPointerOut={() => { document.body.style.cursor = "auto"; }}>
    <meshStandardMaterial color={selected ? "#f97316" : highlighted ? "#38bdf8" : "#0f766e"} roughness={0.75} />
  </mesh>)}</group>;
}

function StudyBoundary({bbox,origin}) {
  const geometry=useMemo(() => {
    if(!bbox || !origin) return null;
    const points=[[bbox.min_lon,bbox.min_lat],[bbox.max_lon,bbox.min_lat],[bbox.max_lon,bbox.max_lat],[bbox.min_lon,bbox.max_lat]].map(([lon,lat]) => {
      const [x,north]=localPoint(lon,lat,origin);return new THREE.Vector3(x,0.2,-north);
    });
    return new THREE.BufferGeometry().setFromPoints(points);
  },[bbox,origin]);
  useEffect(() => () => geometry?.dispose(),[geometry]);
  return geometry ? <lineLoop geometry={geometry}><lineBasicMaterial color="#d97706" /></lineLoop> : null;
}

function Scene({ buildings, highlightedIds, selectedBuilding, onSelectBuilding, resetKey, bounds, bbox, origin, streets, viewMode, focusTarget, onHeading, onStreetStatus }) {
  const { camera, gl, size, invalidate } = useThree();
  const controls = useRef();
  const selected = useMemo(() => new Set(highlightedIds), [highlightedIds]);
  const { center: [cx, cy], distance, height } = bounds;
  useEffect(() => {
    const orbit = new OrbitControls(camera, gl.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.1;
    orbit.minDistance = 10;
    orbit.maxDistance = distance * 8;
    orbit.maxPolarAngle = Math.PI / 2 - 0.03;
    orbit.target.set(cx, height / 3, -cy);
    const changed = () => {
      const north=new THREE.Vector3(0,0,-1);
      const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
      const up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
      onHeading(THREE.MathUtils.radToDeg(Math.atan2(north.dot(right),north.dot(up))));
      invalidate();
    };
    orbit.addEventListener("change",changed);
    controls.current = orbit;
    return () => { orbit.removeEventListener("change",changed); orbit.dispose(); controls.current = null; };
  }, [camera, gl, cx, cy, distance, height, invalidate, onHeading]);
  useFrame(() => controls.current?.update());
  useEffect(() => {
    // Fit the whole area even on a narrow viewport and include tall buildings.
    const radius = Math.sqrt(distance * distance * 2 + height * height) / 2;
    const angle = Math.min(THREE.MathUtils.degToRad(camera.fov / 2), Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * size.width / size.height));
    const range = radius / Math.sin(angle) * 1.12;
    const target = new THREE.Vector3(cx, height / 3, -cy);
    camera.position.copy(target).add((viewMode==="top" ? new THREE.Vector3(0,1,0.001) : new THREE.Vector3(0.7,1.1,1.25)).normalize().multiplyScalar(range));
    camera.near = 0.5;
    camera.far = range + distance * 12 + height;
    camera.updateProjectionMatrix();
    camera.lookAt(target);
    if (controls.current) { controls.current.target.copy(target); controls.current.update(); }
    invalidate();
  }, [camera, size.width, size.height, cx, cy, distance, height, resetKey, viewMode, invalidate]);
  useEffect(() => {
    if(!focusTarget?.building || !controls.current) return;
    const b=focusTarget.building;
    const points=(b.polygons || [{outer:b.footprint || []}]).flatMap(p => p.outer);
    if(!points.length) return;
    const xs=points.map(p => p[0]),ys=points.map(p => p[1]);
    const width=Math.max(...xs)-Math.min(...xs), depth=Math.max(...ys)-Math.min(...ys), h=b.height_m ?? 1;
    const target=new THREE.Vector3((Math.min(...xs)+Math.max(...xs))/2,h/2,-(Math.min(...ys)+Math.max(...ys))/2);
    const direction=camera.position.clone().sub(controls.current.target).normalize();
    const angle=Math.min(THREE.MathUtils.degToRad(camera.fov/2),Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*size.width/size.height));
    const range=Math.max(30,Math.sqrt(width*width+depth*depth+h*h)/2)/Math.sin(angle)*1.25;
    camera.position.copy(target).add(direction.multiplyScalar(range));
    controls.current.target.copy(target);controls.current.update();invalidate();
  },[focusTarget,camera,invalidate,size.width,size.height]);
  useEffect(() => () => { document.body.style.cursor = "auto"; }, []);
  return <>
    <color attach="background" args={["#e8eef1"]} />
    <ambientLight intensity={1.3} />
    <directionalLight position={[distance, distance * 2, distance]} intensity={2.2} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.5, -cy]}>
      <planeGeometry args={[distance * 2.5, distance * 2.5]} /><meshStandardMaterial color="#d5dfe1" />
    </mesh>
    {!streets && <gridHelper args={[distance * 2, 20, "#a7b8be", "#c0cdd1"]} position={[cx, -0.3, -cy]} />}
    {streets && <StreetMap key={`${origin?.lon},${origin?.lat}`} bbox={bbox} origin={origin} onStatus={onStreetStatus} />}
    <StudyBoundary bbox={bbox} origin={origin} />
    {buildings.map(b => <Building key={b.id} building={b} highlighted={selected.has(b.id)} selected={selectedBuilding?.id === b.id} onSelect={onSelectBuilding} />)}
  </>;
}

export default function Visualizer(props) {
  const bounds = useMemo(() => computeBounds(props.buildings), [props.buildings]);
  const [heading,setHeading]=useState(0);const [streetStatus,setStreetStatus]=useState("");
  const onHeading=useCallback(value => setHeading(value),[]);
  return <div className="scene-wrapper"><Canvas camera={{ fov: 45, near: 0.5, far: bounds.distance * 30 }}
    dpr={[1, 1.5]} frameloop="demand" onPointerMissed={() => props.onSelectBuilding(null)}
    fallback={<p className="webgl-fallback">3D requires WebGL. You can still inspect buildings using the results list.</p>}>
    <Scene {...props} bounds={bounds} onHeading={onHeading} onStreetStatus={setStreetStatus} />
  </Canvas>
    <div className="compass" role="img" aria-label="North indicator"><span>N</span><svg viewBox="0 0 40 40" aria-hidden="true" style={{transform:`rotate(${heading}deg)`}}><path d="M20 3 L30 33 L20 26 L10 33 Z" fill="#f97316" stroke="#10202d" strokeWidth="2" /></svg></div>
    {props.streets && <><div className="map-attribution">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></div>{streetStatus && <p className="street-status" role="status">{streetStatus}</p>}</>}
  </div>;
}
