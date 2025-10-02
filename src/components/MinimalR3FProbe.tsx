"use client";
// Minimal probe to test whether @react-three/fiber + three import succeeds in isolation.
// Renders a single spinning box; if this alone fails, issue lies with bundler/react runtime integration.
import { Canvas, useFrame } from '@react-three/fiber';
import React, { useRef } from 'react';
import * as THREE from 'three';

function Spinner(){
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_: any, delta: number) => {
    if(ref.current){
      ref.current.rotation.x += delta * 0.6;
      ref.current.rotation.y += delta * 0.4;
    }
  });
  return (
    <mesh ref={ref}>
      <boxGeometry args={[1,1,1]} />
      <meshStandardMaterial color="#10b981" />
    </mesh>
  );
}

export default function MinimalR3FProbe(){
  return (
    <div className="absolute inset-0">
      <Canvas camera={{ position:[2,2,3], fov:50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3,3,5]} intensity={1.2} />
        <Spinner />
      </Canvas>
    </div>
  );
}
