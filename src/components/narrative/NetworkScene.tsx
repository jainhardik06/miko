"use client";
import { MiniScene } from "../mini/MiniScene";
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { SceneBackground } from '../../components/SceneBackground';
import { ACCENT_BASE, ACCENT_AMBER, BLOOM_INTENSITY } from '../../components/themeColors';
import { useTheme } from '../../components/ThemeProvider';

export function NetworkSceneContainer(){
  return (
    <div className="glass-card h-72 rounded-2xl p-2 relative">
      <span className="mini-scene-overlay-label">NETWORK</span>
      <MiniScene>
        <NetworkScene />
      </MiniScene>
    </div>
  );
}

export function NetworkSceneFull({ offsetX=4.5 }: { offsetX?: number }){
  return (
    <div className="absolute inset-0">
      <MiniScene className="!h-full !w-full">
        <group position={[offsetX,0,0]}>
          <NetworkScene reducedBloom />
        </group>
      </MiniScene>
    </div>
  );
}

function NetworkScene({ reducedBloom=false }:{ reducedBloom?: boolean }){
  const { resolved } = useTheme();
  const isLight = resolved === 'light';
  const bloomBase = BLOOM_INTENSITY.mini[isLight ? 'light' : 'dark'];
  const bloomIntensity = reducedBloom ? bloomBase * 0.72 : bloomBase;
  const pointIntensity = isLight ? (reducedBloom?10:16) : (reducedBloom?18:34);
  return (
    <>
      <SceneBackground />
      <hemisphereLight args={[ isLight?0xffffff:0x0b1d18, isLight?0xdddddd:0x020507, isLight?0.75:0.32 ]} />
      <ambientLight intensity={isLight?0.55:0.42} />
      <pointLight position={[5,6,4]} intensity={pointIntensity} distance={34} color={ACCENT_BASE} />
      <Hub isLight={isLight} />
      <PerimeterNodes isLight={isLight} />
      <DynamicEdges isLight={isLight} />
      <EffectComposer enableNormalPass={false}>
        <Bloom intensity={bloomIntensity} luminanceThreshold={isLight?0.3:0.25} luminanceSmoothing={0.28} radius={0.78} mipmapBlur />
      </EffectComposer>
    </>
  );
}

function Hub({ isLight=false }:{ isLight?: boolean }){
  const inner = useRef<THREE.Mesh>(null);
  const shell = useRef<THREE.Mesh>(null);
  useFrame(({ clock }, dt)=>{
    const t = clock.getElapsedTime();
    if(inner.current){
      inner.current.rotation.y += dt * 0.18;
      const pulse = (Math.sin(t*1.4)+1)/2;
      (inner.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.9 + pulse*0.9;
    }
    if(shell.current){
      shell.current.rotation.y -= dt * 0.11;
      const mat = shell.current.material as THREE.MeshPhysicalMaterial;
      mat.thickness = 0.45 + (Math.sin(t*0.9)+1)/2 * 0.22;
    }
  });
  return (
    <group position={[0,0.2,0]}>
      <mesh ref={shell}>
        <icosahedronGeometry args={[1.5,1]} />
  <meshPhysicalMaterial transmission={0.95} thickness={0.65} roughness={0.24} metalness={0.14} clearcoat={0.7} clearcoatRoughness={0.28} attenuationColor={ACCENT_BASE} attenuationDistance={6} transparent opacity={isLight?0.94:0.9} color={isLight?'#093229':'#062a23'} />
      </mesh>
      <mesh ref={inner}>
        <icosahedronGeometry args={[1.05,0]} />
  <meshStandardMaterial emissive={ACCENT_BASE} emissiveIntensity={isLight?0.4:1.2} color={ACCENT_BASE} metalness={0.6} roughness={0.22} />
      </mesh>
    </group>
  );
}

interface EdgeDescriptor { a:THREE.Vector3; b:THREE.Vector3; speed:number; }

function PerimeterNodes({ isLight=false }:{ isLight?: boolean }){
  const group = useRef<THREE.Group>(null);
  const COUNT = 14;
  const nodes = useMemo(()=> new Array(COUNT).fill(0).map((_,i)=>({ angle:(i/COUNT)*Math.PI*2, radius:4.2 + Math.sin(i)*0.2, y:0.2, scale:0.34 })), []);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if(group.current){
      group.current.children.forEach((c,i)=>{
        const n = nodes[i];
        const a = n.angle + t*0.18;
        const r = n.radius + Math.sin(t*0.6 + i)*0.15;
  c.position.set(Math.cos(a)*r, n.y + Math.sin(t*0.5 + i)*0.13, Math.sin(a)*r);
  c.rotation.y = a*0.8;
      });
    }
  });
  return (
    <group ref={group}>
      {nodes.map((n,i)=>(
        <mesh key={i} scale={n.scale}>
          <icosahedronGeometry args={[1,0]} />
          <meshStandardMaterial emissive={ACCENT_BASE} emissiveIntensity={isLight?0.28:0.7} color={ACCENT_BASE} roughness={0.42} metalness={0.22} />
        </mesh>
      ))}
    </group>
  );
}

function DynamicEdges({ isLight=false }:{ isLight?: boolean }){
  const group = useRef<THREE.Group>(null);
  const edges = useMemo(()=>{
    const arr: EdgeDescriptor[] = [];
    const COUNT = 22;
    for(let i=0;i<COUNT;i++){
      const a = new THREE.Vector3(0,0.2,0);
      const angle = Math.random()*Math.PI*2;
      const radius = 4 + Math.random()*0.6;
      const b = new THREE.Vector3(Math.cos(angle)*radius, (Math.random()*0.5)-0.25 + 0.2, Math.sin(angle)*radius);
      arr.push({ a, b, speed: 0.4 + Math.random()*0.5 });
    }
    return arr;
  }, []);
  // build tube-like edges as simple quads (two triangles) oriented along direction for low cost
  const geometries = useMemo(()=> edges.map(e=>{
    const geo = new THREE.BufferGeometry();
    const dir = new THREE.Vector3().subVectors(e.b, e.a);
    const len = dir.length(); dir.normalize();
    const up = new THREE.Vector3(0,1,0);
    const side = new THREE.Vector3().crossVectors(dir, up).normalize().multiplyScalar(0.04);
    const p0 = e.a.clone().add(side);
    const p1 = e.a.clone().sub(side);
    const p2 = e.b.clone().add(side);
    const p3 = e.b.clone().sub(side);
    const positions = new Float32Array([
      p0.x,p0.y,p0.z, p1.x,p1.y,p1.z, p2.x,p2.y,p2.z,
      p2.x,p2.y,p2.z, p1.x,p1.y,p1.z, p3.x,p3.y,p3.z
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(positions,3));
    return geo;
  }), [edges]);
  const packets = useRef<THREE.Points>(null);
  const PACKET_COUNT = 160;
  const { packetPositions, packetEdgeIndex, packetT } = useMemo(()=>{
    const pp = new Float32Array(PACKET_COUNT*3);
    const edgeIdx = new Uint16Array(PACKET_COUNT);
    const tArr = new Float32Array(PACKET_COUNT);
    for(let i=0;i<PACKET_COUNT;i++){
      edgeIdx[i] = i % edges.length;
      tArr[i] = Math.random();
    }
    return { packetPositions: pp, packetEdgeIndex: edgeIdx, packetT: tArr };
  }, [edges]);
  useFrame((_, dt)=>{
    for(let i=0;i<PACKET_COUNT;i++){
      const edge = edges[packetEdgeIndex[i]];
  packetT[i] += edge.speed * dt * 0.13;
      if(packetT[i] > 1) packetT[i] = 0;
      const pos = new THREE.Vector3().lerpVectors(edge.a, edge.b, packetT[i]);
      packetPositions[i*3] = pos.x; packetPositions[i*3+1]=pos.y; packetPositions[i*3+2]=pos.z;
    }
    if(packets.current){
      const geo = packets.current.geometry as THREE.BufferGeometry;
      (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
  });
  return (
    <group ref={group}>
      {geometries.map((g,i)=>(
        <mesh key={i} geometry={g}>
          <meshBasicMaterial color={ACCENT_BASE} transparent opacity={isLight?0.22:0.3} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
      <points ref={packets}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" array={packetPositions} count={PACKET_COUNT} itemSize={3} />
        </bufferGeometry>
  <pointsMaterial color={'#ffb347'} size={0.12} sizeAttenuation transparent opacity={isLight?0.55:0.85} />
      </points>
    </group>
  );
}
