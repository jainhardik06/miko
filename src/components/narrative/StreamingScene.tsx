"use client";
import { MiniScene } from "../mini/MiniScene";
import { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { SceneBackground } from '../../components/SceneBackground';
import { ACCENT_BASE, BLOOM_INTENSITY } from '../../components/themeColors';
import { useTheme } from '../../components/ThemeProvider';

export function StreamingSceneContainer(){
  return (
    <div className="glass-card h-72 rounded-2xl p-2 relative">
      <span className="mini-scene-overlay-label">STREAM</span>
      <MiniScene>
        <StreamingScene />
      </MiniScene>
    </div>
  );
}

export function StreamingSceneFull({ offsetX=4.5 }: { offsetX?: number }){
  return (
    <div className="absolute inset-0">
      <MiniScene className="!h-full !w-full">
        <group position={[offsetX,0,0]}>
          <StreamingScene reducedBloom />
        </group>
      </MiniScene>
    </div>
  );
}

function StreamingScene({ reducedBloom=false }:{ reducedBloom?: boolean }){
  const { resolved } = useTheme();
  const isLight = resolved === 'light';
  const bloomBase = BLOOM_INTENSITY.mini[isLight ? 'light' : 'dark'];
  const bloomIntensity = reducedBloom ? bloomBase * 0.78 : bloomBase;
  const spotIntensity = isLight ? (reducedBloom?420:780) : (reducedBloom?900:1600);
  return (
    <>
      <SceneBackground />
      <hemisphereLight args={[ isLight?0xffffff:0x0b1d18, isLight?0xdddddd:0x020507, isLight?0.8:0.35 ]} />
      <ambientLight intensity={isLight?0.58:0.45} />
      <spotLight position={[6,8,6]} intensity={spotIntensity} distance={40} angle={0.6} penumbra={0.8} color={ACCENT_BASE} />
      <Card isLight={isLight} />
      <TokenSpiral isLight={isLight} />
      <RateMeter isLight={isLight} />
      <EffectComposer enableNormalPass={false}>
        <Bloom intensity={bloomIntensity} luminanceThreshold={isLight?0.3:0.24} luminanceSmoothing={0.3} radius={0.75} mipmapBlur />
      </EffectComposer>
    </>
  );
}

function Card({ isLight=false }:{ isLight?: boolean }){
  const frame = useRef<THREE.Mesh>(null);
  const holo = useRef<THREE.LineSegments>(null);
  useFrame((_,dt)=>{
  if(frame.current){ frame.current.rotation.y += dt*0.14; }
  if(holo.current){ holo.current.rotation.y -= dt*0.11; }
  });
  const lattice = useMemo(()=>{
    const g = new THREE.IcosahedronGeometry(0.95,1);
    return new THREE.WireframeGeometry(g);
  }, []);
  return (
    <group position={[0,0.2,0]}>
      <mesh ref={frame} scale={[3.1,4.2,0.12]}> 
        <boxGeometry args={[1,1,0.02]} />
  <meshPhysicalMaterial transmission={1} thickness={0.45} roughness={0.3} metalness={0.14} clearcoat={0.85} clearcoatRoughness={0.28} attenuationColor={ACCENT_BASE} attenuationDistance={4.5} transparent opacity={isLight?0.62:0.5} color={isLight?'#0a332b':'#062a23'} />
      </mesh>
      <lineSegments ref={holo} geometry={lattice} position={[0,0,0]}>
  <lineBasicMaterial color={ACCENT_BASE} transparent opacity={isLight?0.32:0.4} />
      </lineSegments>
    </group>
  );
}

interface Pellet { pos:THREE.Vector3; t:number; speed:number; }

function TokenSpiral({ isLight=false }:{ isLight?: boolean }){
  const group = useRef<THREE.Group>(null);
  const pelletsRef = useRef<THREE.InstancedMesh>(null);
  const MAX = 90;
  const pellets = useRef<Pellet[]>([]);
  const dummy = useMemo(()=>new THREE.Object3D(),[]);
  const pathCache = useMemo(()=>{
    const points:THREE.Vector3[] = [];
    const turns = 3.2; const height= -2.2; const radiusStart=0.2; const radiusEnd=1.8; const STEPS=260;
    for(let i=0;i<=STEPS;i++){
      const u = i/STEPS;
      const angle = u * Math.PI * 2 * turns;
      const r = THREE.MathUtils.lerp(radiusStart, radiusEnd, u);
      const x = Math.cos(angle) * r;
      const y = u * height;
      const z = Math.sin(angle) * r;
      points.push(new THREE.Vector3(x,y,z));
    }
    return points;
  }, []);
  // spawn pellets lazily
  useFrame((_,dt)=>{
    if(pellets.current.length < MAX){
  pellets.current.push({ pos:pathCache[0].clone(), t:0, speed: 0.11 + Math.random()*0.12 });
    }
    pellets.current.forEach(p => {
  p.t += p.speed * dt * 0.25;
      if(p.t > 1){ p.t = 0; }
      const idx = Math.floor(p.t * (pathCache.length-1));
      p.pos.copy(pathCache[idx]);
    });
    if(pelletsRef.current){
      pellets.current.forEach((p,i)=>{
        dummy.position.copy(p.pos);
        const scale = 0.12 + (1 - p.t)*0.18;
        dummy.scale.setScalar(scale);
        dummy.rotation.y = p.t * Math.PI * 8;
        dummy.updateMatrix();
        pelletsRef.current!.setMatrixAt(i, dummy.matrix);
      });
      pelletsRef.current.instanceMatrix.needsUpdate = true;
    }
  });
  return (
    <group ref={group} position={[0,0.4,0]}>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-2.25,0]}> 
        <ringGeometry args={[1.9,2.05,96]} />
  <meshBasicMaterial color={ACCENT_BASE} transparent opacity={isLight?0.14:0.18} blending={THREE.AdditiveBlending} />
      </mesh>
      <instancedMesh ref={pelletsRef} args={[undefined as any, undefined as any, MAX]}> 
        <sphereGeometry args={[0.2,16,16]} />
  <meshBasicMaterial color={ACCENT_BASE} transparent opacity={isLight?0.6:0.85} blending={THREE.AdditiveBlending} />
      </instancedMesh>
    </group>
  );
}

function RateMeter({ isLight=false }:{ isLight?: boolean }){
  const bar = useRef<THREE.Mesh>(null);
  useFrame(({ clock })=>{
    const t = clock.getElapsedTime();
    if(bar.current){
  const pulse = (Math.sin(t*1.4)+1)/2; // slowed
      bar.current.scale.y = 0.4 + pulse*0.6;
    }
  });
  return (
    <group position={[2.1,-0.4,0]}>
      <mesh position={[0,0,0]}> <boxGeometry args={[0.08,2.2,0.08]} /> <meshBasicMaterial color={'#07342c'} /> </mesh>
  <mesh ref={bar} position={[0,-1.1,0]} scale={[0.16,0.4,0.16]}> <boxGeometry args={[0.3,1,0.3]} /> <meshBasicMaterial color={ACCENT_BASE} transparent opacity={isLight?0.55:0.85} blending={THREE.AdditiveBlending} /> </mesh>
    </group>
  );
}
