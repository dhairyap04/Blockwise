/**
 * 3D map of Calgary buildings using Three.js (extruded footprints + height).
 * Supports click-to-select (popup in parent), and highlight set from LLM query.
 */
import React, { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

const DEFAULT_COLOR = "#0f766e"; // teal
const HIGHLIGHT_COLOR = "#38bdf8"; // sky blue
const SELECTED_COLOR = "#f97316"; // orange

function computeBounds(buildings) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const b of buildings || []) {
    const fp = b.footprint;
    if (!fp || !Array.isArray(fp)) continue;
    for (const [x, y] of fp) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (!isFinite(minX)) {
    return { center: [0, 0], distance: 100 };
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const distance = Math.max(width, height) || 100;
  const cx = minX + width / 2;
  const cy = minY + height / 2;
  return { center: [cx, cy], distance };
}

function Building({ building, isHighlighted, isSelected, onClick }) {
  const { footprint, height_m } = building;
  const color = isSelected ? SELECTED_COLOR : isHighlighted ? HIGHLIGHT_COLOR : DEFAULT_COLOR;

  const geometry = useMemo(() => {
    if (!footprint || !Array.isArray(footprint) || footprint.length === 0) return null;
    const shape = new THREE.Shape();
    footprint.forEach(([x, y], i) => {
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
    shape.lineTo(...footprint[0]);
    const depth = Math.max(0.5, (height_m || 3) * 0.5);
    return new THREE.ExtrudeGeometry(shape, {
      steps: 1,
      depth,
      bevelEnabled: false,
    });
  }, [footprint, height_m]);

  if (!geometry) return null;

  return (
    <mesh
      geometry={geometry}
      onClick={(e) => {
        e.stopPropagation();
        onClick(building);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "default";
      }}
    >
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function Scene({ buildings, highlightedIds, selectedId, onSelectBuilding, center, distance }) {
  const set = useMemo(() => new Set(highlightedIds || []), [highlightedIds]);
  return (
    <>
      <ambientLight intensity={0.7} />
      <pointLight position={[distance, distance, distance * 1.2]} intensity={0.9} />
      <pointLight position={[-distance, distance / 2, distance]} intensity={0.4} />

      {/* Ground plane – white so buildings stand out */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center[0], center[1], -0.1]}>
        <planeGeometry args={[distance * 3, distance * 3]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>

      {buildings.map((b) => (
        <Building
          key={b.id}
          building={b}
          isHighlighted={set.has(b.id)}
          isSelected={selectedId === b.id}
          onClick={onSelectBuilding}
        />
      ))}
    </>
  );
}

export default function Visualizer({
  buildings,
  origin, // kept for future use; not strictly needed now
  highlightedIds = [],
  selectedBuilding,
  onSelectBuilding,
}) {
  const { center, distance } = useMemo(() => computeBounds(buildings), [buildings]);

  const cameraPos = useMemo(() => {
    const d = distance || 100;
    return [center[0] + d * 1.2, center[1] + d * 0.9, d * 2];
  }, [center, distance]);

  return (
    <Canvas
      camera={{ position: cameraPos, fov: 45 }}
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <OrbitControls enableDamping dampingFactor={0.05} target={[center[0], center[1], 0]} />
      <Scene
        buildings={buildings}
        highlightedIds={highlightedIds}
        selectedId={selectedBuilding?.id}
        onSelectBuilding={onSelectBuilding}
        center={center}
        distance={distance}
      />
    </Canvas>
  );
}
