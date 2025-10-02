"use client";
import { MiniScene, IdleSway } from "../mini/MiniScene";
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

/**
 * NetworkConnectionScene
 * Central pulsar node with orbiting satellites and animated arc beams to convey network effects.
 */
export function NetworkConnectionSceneContainer(){
  return (
    <div className="glass-card h-72 rounded-2xl p-2 relative">
      <span className="mini-scene-overlay-label">NETWORK</span>
      <MiniScene>
        <NetworkConnectionScene />
      </MiniScene>
    </div>
  );
}

function NetworkConnectionScene(){
  return (
    <>
      <color attach="background" args={["#000000"]} />
      <ambientLight intensity={0.4} />
      <pointLight position={[5,6,4]} intensity={40} distance={30} color={'#19ffc0'} />
      <IdleSway amp={0.08} speed={0.4}>
        <Pulsar />
        <Satellites />
        <ArcBeams />
      </IdleSway>
      <EffectComposer enableNormalPass={false}>
        <Bloom luminanceThreshold={0.16} luminanceSmoothing={0.32} intensity={0.95} radius={0.9} mipmapBlur />
      </EffectComposer>
    </>
  );
}

function Pulsar(){
  const core = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if(core.current){
      core.current.rotation.y = t * 0.6;
      const pulse = (Math.sin(t*3)+1)/2; // 0..1
      (core.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.2 + pulse * 0.8;
    }
    if(halo.current){
      halo.current.scale.setScalar(2.2 + Math.sin(t*2.2)*0.12);
      (halo.current.material as THREE.MeshBasicMaterial).opacity = 0.18 + (Math.sin(t*2.2)+1)/2 * 0.15;
    }
  });
  return (
    <group>
      <mesh ref={halo}>
        <sphereGeometry args={[1, 42, 42]} />
        <meshBasicMaterial transparent color={'#19ffc0'} opacity={0.2} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={core}>
        <icosahedronGeometry args={[0.9,1]} />
        <meshStandardMaterial color={'#19ffc0'} emissive={'#19ffc0'} emissiveIntensity={1.4} roughness={0.25} metalness={0.2} />
      </mesh>
    </group>
  );
}

function Satellites(){
  const group = useRef<THREE.Group>(null);
  const COUNT = 8;
  const sats = useMemo(() => new Array(COUNT).fill(0).map((_,i)=>({ angle:(i/COUNT)*Math.PI*2, radius:2.6 + (i%2)*0.3, speed:0.3 + (i%3)*0.07 })), []);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if(group.current){
      sats.forEach((s,i) => {
        const child = group.current!.children[i];
        const a = s.angle + t * s.speed;
        child.position.set(Math.cos(a)*s.radius, Math.sin(t*0.5 + i)*0.15, Math.sin(a)*s.radius);
        child.rotation.y = a + t*0.5;
      });
    }
  });
  return (
    <group ref={group}>
      {sats.map((s,i)=>(
        <mesh key={i} scale={0.22}>
          <icosahedronGeometry args={[1,0]} />
          <meshStandardMaterial color={'#19ffc0'} emissive={'#19ffc0'} emissiveIntensity={0.9} roughness={0.3} metalness={0.15} />
        </mesh>
      ))}
    </group>
  );
}

function ArcBeams(){
  const group = useRef<THREE.Group>(null);
  const arcGeom = useMemo(()=>createArcGeometry(2.2, 2.8, 64),[]);
  const COUNT = 5;
  const speeds = useMemo(()=> new Array(COUNT).fill(0).map((_,i)=> 0.4 + i*0.12),[]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if(group.current){
      group.current.children.forEach((child, idx) => {
        child.rotation.y = t * speeds[idx];
        const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        mat.opacity = 0.25 + (Math.sin(t*2 + idx) + 1)/2 * 0.4;
      });
    }
  });
  return (
    <group ref={group}>
      {new Array(COUNT).fill(0).map((_,i)=>(
        <mesh key={i} rotation={[Math.PI/2,0, (i/COUNT)*Math.PI*2]} geometry={arcGeom}>
          <meshBasicMaterial color={'#19ffc0'} transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function createArcGeometry(inner:number, outer:number, segments:number){
  const shape = new THREE.Shape();
  const start = 0; // full ring but we can segment
  const end = Math.PI * 2 * 0.6; // 60% arc
  const points: THREE.Vector2[] = [];
  for(let i=0;i<=segments;i++){
    const t = start + (i/segments)*(end-start);
    points.push(new THREE.Vector2(Math.cos(t)*outer, Math.sin(t)*outer));
  }
  for(let i=segments;i>=0;i--){
    const t = start + (i/segments)*(end-start);
    points.push(new THREE.Vector2(Math.cos(t)*inner, Math.sin(t)*inner));
  }
  const geometry = new THREE.ShapeGeometry(new THREE.Shape(points));
  geometry.rotateX(Math.PI/2);
  return geometry;
}
