"use client";
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Suspense, useRef } from 'react';
import { ACCENT_BASE, ACCENT_AMBER } from '../themeColors';
import { useTheme } from '../ThemeProvider';

function HeartCore(){
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((_,dt)=>{ if(mesh.current){ mesh.current.rotation.y += dt*0.35; mesh.current.rotation.x += dt*0.12; }});
  return (
    <mesh ref={mesh} position={[0,0,0]}> 
      <icosahedronGeometry args={[1.2,1]} />
      <meshStandardMaterial color={ACCENT_BASE} emissive={ACCENT_BASE} emissiveIntensity={0.4} metalness={0.65} roughness={0.25} />
    </mesh>
  );
}

function Halo(){
  const ring = useRef<THREE.Mesh>(null);
  useFrame((state)=>{ if(ring.current){ ring.current.rotation.y = state.clock.getElapsedTime()*0.15; }});
  return (
    <mesh ref={ring}>
      <torusGeometry args={[1.8,0.015,16,160]} />
      <meshBasicMaterial color={ACCENT_BASE} transparent opacity={0.25} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

export function CrystalHeartCanvas(){
  const { resolved } = useTheme();
  const isLight = resolved === 'light';
  return (
    <div className="crystal-heart-wrapper">
      <Canvas dpr={[1,1.8]} camera={{ position:[0,0,6], fov:42 }} gl={{ antialias:true }}>
        <color attach="background" args={[isLight? '#f7f7f7':'#000000']} />
        <ambientLight intensity={isLight?0.55:0.4} />
        <hemisphereLight args={[ isLight?0xffffff:0x0b1d18, isLight?0xdddddd:0x020507, isLight?0.8:0.35 ]} />
        <pointLight position={[3,4,5]} intensity={isLight?4:6} color={ACCENT_BASE} distance={40} />
        <Suspense fallback={null}>
          <group position={[0,0,0]}> <HeartCore /> <Halo /> </group>
        </Suspense>
      </Canvas>
    </div>
  );
}

export default CrystalHeartCanvas;