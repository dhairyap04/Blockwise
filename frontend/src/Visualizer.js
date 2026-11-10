/** Metre-scale buildings: east=X, height=Y, north=-Z. */
import React, { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import * as THREE from "three";
import { createBuildingGeometries } from "./geometry";

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

function Scene({ buildings, highlightedIds, selectedBuilding, onSelectBuilding, resetKey, bounds }) {
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
    orbit.addEventListener("change", invalidate);
    controls.current = orbit;
    return () => { orbit.removeEventListener("change", invalidate); orbit.dispose(); controls.current = null; };
  }, [camera, gl, cx, cy, distance, height, invalidate]);
  useFrame(() => controls.current?.update());
  useEffect(() => {
    // Fit the whole area even on a narrow viewport and include tall buildings.
    const radius = Math.sqrt(distance * distance * 2 + height * height) / 2;
    const angle = Math.min(THREE.MathUtils.degToRad(camera.fov / 2), Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * size.width / size.height));
    const range = radius / Math.sin(angle) * 1.12;
    const target = new THREE.Vector3(cx, height / 3, -cy);
    camera.position.copy(target).add(new THREE.Vector3(0.7, 1.1, 1.25).normalize().multiplyScalar(range));
    camera.near = 0.5;
    camera.far = range + distance * 12 + height;
    camera.updateProjectionMatrix();
    camera.lookAt(target);
    if (controls.current) { controls.current.target.copy(target); controls.current.update(); }
    invalidate();
  }, [camera, size.width, size.height, cx, cy, distance, height, resetKey, invalidate]);
  useEffect(() => () => { document.body.style.cursor = "auto"; }, []);
  return <>
    <color attach="background" args={["#e8eef1"]} />
    <ambientLight intensity={1.3} />
    <directionalLight position={[distance, distance * 2, distance]} intensity={2.2} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.5, -cy]}>
      <planeGeometry args={[distance * 2.5, distance * 2.5]} /><meshStandardMaterial color="#d5dfe1" />
    </mesh>
    <gridHelper args={[distance * 2, 20, "#a7b8be", "#c0cdd1"]} position={[cx, -0.3, -cy]} />
    {buildings.map(b => <Building key={b.id} building={b} highlighted={selected.has(b.id)} selected={selectedBuilding?.id === b.id} onSelect={onSelectBuilding} />)}
  </>;
}

export default function Visualizer(props) {
  const bounds = useMemo(() => computeBounds(props.buildings), [props.buildings]);
  return <Canvas camera={{ fov: 45, near: 0.5, far: bounds.distance * 30 }}
    dpr={[1, 1.5]} frameloop="demand" onPointerMissed={() => props.onSelectBuilding(null)}
    fallback={<p className="webgl-fallback">3D requires WebGL. You can still inspect buildings using the results list.</p>}>
    <Scene {...props} bounds={bounds} />
  </Canvas>;
}
