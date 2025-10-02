"use client";
import { MiniScene, IdleSway } from "../mini/MiniScene";
import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

/** Placeholder SeedHandsScene
 * Future: replace orb + rings with stylized low-poly hand forms cradling a luminous seed.
 */
export function SeedHandsSceneContainer(){
  return (
    <div className="glass-card h-72 rounded-2xl p-2 relative">
      <span className="mini-scene-overlay-label">SEED</span>
      <MiniScene>
        <SeedHandsScene />
      </MiniScene>
    </div>
  );
}

function SeedHandsScene(){
  return (
    <>
      <color attach="background" args={["#000000"]} />
      <ambientLight intensity={0.35} />
      <pointLight position={[4,5,4]} intensity={40} distance={18} color="#4bffe0" />
      <pointLight position={[-4,-3,-2]} intensity={12} distance={14} color="#0aff9d" />
      <IdleSway amp={0.1} speed={0.5}>
        <SeedCore />
      </IdleSway>
  <EffectComposer enableNormalPass={false}>
        <Bloom luminanceThreshold={0.18} luminanceSmoothing={0.35} intensity={0.85} radius={0.85} mipmapBlur />
      </EffectComposer>
    </>
  );
}

function SeedCore(){
  const group = useRef<THREE.Group>(null);
  const glowMat = useRef<THREE.MeshBasicMaterial>(null);
  const inner = useRef<THREE.MeshStandardMaterial>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const [seedColor] = useState(() => new THREE.Color('#19ffc0'));
  const tmp = new THREE.Color();
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if(group.current){
      group.current.rotation.y = t * 0.35;
      group.current.rotation.x = Math.sin(t * 0.4) * 0.25;
    }
    const pulse = (Math.sin(t * 2.4) + 1)/2; // 0..1
    const intensity = 0.55 + pulse * 0.45;
    if(glowMat.current){ glowMat.current.color.copy(seedColor).multiplyScalar(intensity * 1.1); }
    if(inner.current){ inner.current.emissive.copy(seedColor).multiplyScalar(0.6 + pulse * 0.8); }
    if(ringMat.current){ ringMat.current.color.copy(seedColor).multiplyScalar(0.35 + pulse * 0.65); }
  });
  return (
    <group ref={group}>
      {/* Outer translucent glow sphere */}
      <mesh scale={2.4}>
        <sphereGeometry args={[1, 42, 42]} />
        <meshBasicMaterial ref={glowMat} transparent opacity={0.15} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* Core seed */}
      <mesh>
        <icosahedronGeometry args={[0.9, 1]} />
        <meshStandardMaterial ref={inner} roughness={0.2} metalness={0.15} color={seedColor} emissive={seedColor} emissiveIntensity={1.5} />
      </mesh>
      {/* Rotating energy rings */}
      <EnergyRing radius={1.4} speed={0.6} tilt={0.5} matRef={ringMat} />
      <EnergyRing radius={1.7} speed={-0.45} tilt={-0.25} />
      <EnergyRing radius={2.05} speed={0.32} tilt={0.9} />
    </group>
  );
}

function EnergyRing({ radius, speed, tilt, matRef }: { radius: number; speed: number; tilt: number; matRef?: React.RefObject<THREE.MeshBasicMaterial>; }){
  const ref = useRef<THREE.Mesh>(null);
  const localMat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if(ref.current){
      ref.current.rotation.z = clock.getElapsedTime() * speed;
    }
  });
  return (
    <mesh ref={ref} rotation={[tilt,0,0]}> 
      <torusGeometry args={[radius, 0.015, 8, 128]} />
      <meshBasicMaterial ref={matRef || localMat} color={'#19ffc0'} transparent opacity={0.7} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}
