// src/Visualizer.js
import React, { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from 'three';

function Building({ footprint, height, onClick }) {
  if (!footprint || !Array.isArray(footprint) || footprint.length === 0) {
    console.warn("Invalid or missing footprint for building:", footprint);
    return null; // Skip rendering this building
  }

  // Convert footprint to shape for Three.js
  const shape = new THREE.Shape();
  footprint.forEach(([x, y], i) => {
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.lineTo(...footprint[0]); // Close shape

  const extrudeSettings = {
    steps: 1,
    depth: height / 10, // Scale down for scene
    bevelEnabled: false
  };

  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

  return (
    <mesh geometry={geometry} onClick={onClick}>
      <meshStandardMaterial attach="material" color="orange" />
    </mesh>
  );
}

function Scene({ buildings }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[100, 100, 100]} />
      {buildings.map((b) => (
        <Building
          key={b.id}
          footprint={b.footprint}
          height={b.height}
          onClick={() => alert(`${b.address}\nHeight: ${b.height}`)}
        />
      ))}
    </>
  );
}

export default function Visualizer({ buildings }) {
  return (
    <Canvas camera={{ position: [50, 50, 100], fov: 45 }}>
      <OrbitControls />
      <Scene buildings={buildings} />
    </Canvas>
  );
}
