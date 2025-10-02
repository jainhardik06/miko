"use client";
import { MiniScene, IdleSway } from "../mini/MiniScene";
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { ACCENT_BASE } from '../themeColors';

/**
 * TreeAssetCardScene
 * Concept: A semi-transparent rotating card containing a holographic stylized tree core.
 */
export function TreeAssetCardSceneContainer(){
  return (
    <div className="glass-card h-72 rounded-2xl p-2 relative">
      <span className="mini-scene-overlay-label">ASSET</span>
      <MiniScene>
        <TreeAssetCardScene />
      </MiniScene>
    </div>
  );
}

function TreeAssetCardScene(){
  return (
    <>
      <color attach="background" args={["#000000"]} />
      <ambientLight intensity={0.45} />
  <spotLight position={[6,8,6]} intensity={1200} angle={0.6} distance={40} penumbra={0.8} color={ACCENT_BASE} />
      <IdleSway amp={0.08} speed={0.35}>
        <HoloCard />
      </IdleSway>
      <EffectComposer enableNormalPass={false}>
        <Bloom luminanceThreshold={0.22} luminanceSmoothing={0.32} intensity={0.9} radius={0.85} mipmapBlur />
      </EffectComposer>
    </>
  );
}

function HoloCard(){
  const group = useRef<THREE.Group>(null);
  const planeMat = useRef<THREE.MeshPhysicalMaterial>(null);
  const rimMat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if(group.current){
      group.current.rotation.y = t * 0.45;
    }
    if(planeMat.current){
      planeMat.current.opacity = 0.35 + (Math.sin(t*1.8)+1)/2 * 0.12;
      planeMat.current.thickness = 0.28 + (Math.sin(t*0.9)+1)/2 * 0.15;
    }
    if(rimMat.current){
      rimMat.current.color.setHSL(0.45 + Math.sin(t*0.5)*0.05, 1, 0.55);
    }
  });
  return (
    <group ref={group}>
      {/* Card shape */}
      <mesh scale={[3.2,4.4,0.1]}>
        <boxGeometry args={[1,1,0.02,1,1,1]} />
        <meshPhysicalMaterial
          ref={planeMat}
          transmission={1}
          thickness={0.35}
          roughness={0.25}
          metalness={0.1}
          clearcoat={0.8}
          clearcoatRoughness={0.25}
          attenuationColor={ACCENT_BASE}
          attenuationDistance={3.5}
          transparent
          opacity={0.4}
          ior={1.3}
        />
      </mesh>
      {/* Rim / outline */}
      <mesh scale={[3.25,4.45,0.08]}> 
        <boxGeometry args={[1,1,0.02,1,1,1]} />
  <meshBasicMaterial ref={rimMat} color={ACCENT_BASE} wireframe transparent opacity={0.8} blending={THREE.AdditiveBlending} />
      </mesh>
      <HoloTree />
    </group>
  );
}

function HoloTree(){
  const trunk = useRef<THREE.Mesh>(null);
  const leaves = useRef<THREE.Points>(null);
  const leafGeom = new THREE.BufferGeometry();
  // simple radial puff of points
  const COUNT = 420;
  const positions = new Float32Array(COUNT * 3);
  for(let i=0;i<COUNT;i++){
    const r = Math.random() * 0.9;
    const theta = Math.random()*Math.PI*2;
    const y = Math.random()*1.4 + 0.4;
    positions[i*3+0] = Math.cos(theta)*r*0.6;
    positions[i*3+1] = y;
    positions[i*3+2] = Math.sin(theta)*r*0.6;
  }
  leafGeom.setAttribute('position', new THREE.BufferAttribute(positions,3));
  const leafMat = new THREE.PointsMaterial({ size:0.04, color:ACCENT_BASE, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending });
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if(trunk.current){
      trunk.current.rotation.y = Math.sin(t*0.7)*0.2;
    }
    if(leaves.current){
      leaves.current.rotation.y = t*0.3;
    }
  });
  return (
    <group position={[0,-1.6,0]}>
      <mesh ref={trunk} position={[0,0,0]}>
        <cylinderGeometry args={[0.18,0.28,1.6, 12]} />
  <meshStandardMaterial color={ACCENT_BASE} emissive={ACCENT_BASE} emissiveIntensity={0.8} roughness={0.4} metalness={0.15} />
      </mesh>
      <points ref={leaves} geometry={leafGeom} material={leafMat} />
      <mesh position={[0,1.42,0]}>
        <octahedronGeometry args={[0.35,0]} />
  <meshStandardMaterial color={ACCENT_BASE} emissive={ACCENT_BASE} emissiveIntensity={1.2} roughness={0.25} metalness={0.2} />
      </mesh>
    </group>
  );
}
