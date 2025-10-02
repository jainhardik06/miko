"use client";
import { MiniScene, IdleSway } from "../mini/MiniScene";
import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { SceneBackground } from '../../components/SceneBackground';
import { ACCENT_BASE, ACCENT_AMBER, BLOOM_INTENSITY } from '../../components/themeColors';
import { useTheme } from '../../components/ThemeProvider';

export function VerificationSceneContainer(){
  return (
    <div className="glass-card h-72 rounded-2xl p-2 relative">
      <span className="mini-scene-overlay-label">VERIFY</span>
      <MiniScene>
        <VerificationScene />
      </MiniScene>
    </div>
  );
}

// Full-bleed background variant (no glass card) used for section embedding
export function VerificationSceneFull({ offsetX = 4.5 }: { offsetX?: number }){
  return (
    <CanvasShell>
      <group position={[offsetX,0,0]}>
        <VerificationScene reducedBloom />
      </group>
    </CanvasShell>
  );
}

// Reusable shell to avoid card styling
function CanvasShell({ children }: { children: React.ReactNode }){
  return (
    <div className="absolute inset-0">
      <MiniScene className="!h-full !w-full">
        {children}
      </MiniScene>
    </div>
  );
}

function VerificationScene({ reducedBloom = false }:{ reducedBloom?: boolean }){
  const { resolved } = useTheme();
  const isLight = resolved === 'light';
  const bloomBase = BLOOM_INTENSITY.mini[isLight ? 'light' : 'dark'];
  const bloomIntensity = reducedBloom ? bloomBase * 0.72 : bloomBase;
  const pointIntensity = isLight ? (reducedBloom?8:13) : (reducedBloom?12:20);
  return (
    <>
      <SceneBackground />
      <hemisphereLight args={[ isLight?0xffffff:0x0b1d18, isLight?0xdddddd:0x020507, isLight?0.75:0.3 ]} />
      <ambientLight intensity={isLight?0.5:0.38} />
      <pointLight position={[4,5,4]} intensity={pointIntensity} distance={32} color={ACCENT_BASE} />
      <Seedling isLight={isLight} />
      <GeoLattice isLight={isLight} />
      <ScanRing isLight={isLight} />
      <AuxScanRings isLight={isLight} />
      <ValidationBurst isLight={isLight} />
      <AmbientParticles isLight={isLight} />
      <DriftCamera />
      <EffectComposer enableNormalPass={false}>
        <Bloom intensity={bloomIntensity} luminanceThreshold={isLight?0.3:0.24} luminanceSmoothing={0.28} radius={0.75} mipmapBlur />
      </EffectComposer>
    </>
  );
}

function Seedling({ isLight=false }:{ isLight?: boolean }){
  const group = useRef<THREE.Group>(null);
  const trunkMat = useRef<THREE.MeshStandardMaterial>(null);
  const leafMat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
  if(group.current){ group.current.rotation.y = Math.sin(t*0.25)*0.22; }
  const pulse = (Math.sin(t*1.8)+1)/2;
    const scale = isLight?0.45:1;
    if(trunkMat.current){ trunkMat.current.emissiveIntensity = (0.4 + pulse*0.6) * scale; }
    if(leafMat.current){ leafMat.current.emissiveIntensity = (0.6 + pulse*0.8) * scale; }
  });
  return (
    <group ref={group} position={[0,-1.2,0]}>
      <mesh>
        <cylinderGeometry args={[0.08,0.1,1.4, 12]} />
  <meshStandardMaterial ref={trunkMat} color={ACCENT_BASE} emissive={ACCENT_BASE} emissiveIntensity={isLight?0.45:0.8} roughness={0.52} metalness={0.18} />
      </mesh>
      {[-0.15,0.15].map((x,i)=>(
        <mesh key={i} position={[x,0.6+i*0.18,0]} rotation={[Math.PI/2,0,x>0?0.4:-0.4]}> 
          <planeGeometry args={[0.7,0.35,1,1]} />
          <meshStandardMaterial ref={i===0?leafMat:undefined} color={ACCENT_BASE} emissive={ACCENT_BASE} transparent opacity={0.82} emissiveIntensity={isLight?0.5:0.9} roughness={0.38} metalness={0.22} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

function GeoLattice({ isLight=false }:{ isLight?: boolean }){
  const lines = useRef<THREE.LineSegments>(null);
  const geo = useMemo(()=>{
    const radius = 3.2; const rings=8; const seg=50; const pts:number[]=[];
    for(let r=1; r<=rings; r++){
      const rad = (r/rings)*radius;
      for(let i=0;i<seg;i++){
        const a = (i/seg)*Math.PI*2; const a2 = ((i+1)/seg)*Math.PI*2;
        pts.push(Math.cos(a)*rad, -1.2, Math.sin(a)*rad, Math.cos(a2)*rad, -1.2, Math.sin(a2)*rad);
      }
    }
    // spokes
    for(let i=0;i<seg;i+=4){
      const a = (i/seg)*Math.PI*2;
      pts.push(0,-1.2,0, Math.cos(a)*radius,-1.2,Math.sin(a)*radius);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts),3));
    return g;
  }, []);
  return (
    <lineSegments ref={lines} geometry={geo}>
  <lineBasicMaterial color={isLight?'#0f4339':'#0b3e35'} transparent opacity={isLight?0.38:0.45} />
    </lineSegments>
  );
}

function ScanRing({ isLight=false }:{ isLight?: boolean }){
  const ring = useRef<THREE.Mesh>(null);
  const flashRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const cycle = (t % 7)/7; // slowed cycle
    if(ring.current){
      ring.current.position.y = -1.2 + cycle*2.4;
      const mat = ring.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.15 + (1 - Math.abs(0.5 - cycle)*2)*0.35;
    }
    if(flashRef.current){
      const pulse = Math.max(0, 1 - Math.abs(0.5 - cycle)*4);
      (flashRef.current.material as THREE.MeshBasicMaterial).opacity = pulse*0.35;
    }
  });
  return (
    <group>
      <mesh ref={ring} rotation={[Math.PI/2,0,0]}> 
        <ringGeometry args={[1.2,1.28,64]} />
  <meshBasicMaterial color={ACCENT_BASE} transparent opacity={isLight?0.22:0.3} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={flashRef} rotation={[-Math.PI/2,0,0]} position={[0,-0.05,0]}> 
        <circleGeometry args={[1.15, 48]} />
        <meshBasicMaterial color={'#ffb347'} transparent opacity={0} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

function AuxScanRings({ isLight=false }:{ isLight?: boolean }){
  const rings = useRef<THREE.Mesh[]>([]);
  useFrame(({ clock })=>{
    const t = clock.getElapsedTime();
    rings.current.forEach((mesh,i)=>{
      const localT = (t + i*1.6) % 9 / 9; // staggered slower waves
      const s = 1.4 + localT*3.8 + i*0.4;
      mesh.scale.set(s,s,s);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = (1-localT) * 0.18;
    });
  });
  return (
    <group position={[0,-1.2,0]}>
      {[0,1,2].map(i=> (
        <mesh key={i} ref={el=>{ if(el) rings.current[i]=el; }} rotation={[Math.PI/2,0,0]}> 
          <ringGeometry args={[1.1,1.16,64]} />
          <meshBasicMaterial color={ACCENT_BASE} transparent opacity={isLight?0.11:0.15} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
    </group>
  );
}

function ValidationBurst({ isLight=false }:{ isLight?: boolean }){
  const group = useRef<THREE.Points>(null);
  const COUNT = 90;
  const { positions, speeds } = useMemo(()=>{
    const pos = new Float32Array(COUNT*3);
    const sp = new Float32Array(COUNT);
    for(let i=0;i<COUNT;i++){
      const a = Math.random()*Math.PI*2;
      const r = Math.random()*0.4;
      pos[i*3] = Math.cos(a)*r;
      pos[i*3+1] = 0.05 + Math.random()*0.1;
      pos[i*3+2] = Math.sin(a)*r;
      sp[i] = 0.25 + Math.random()*0.35;
    }
    return { positions: pos, speeds: sp };
  },[]);
  useFrame(({ clock })=>{
    if(!group.current) return;
    const t = clock.getElapsedTime();
    const baseCycle = (t % 6)/6; // burst every 6s
    const arr = (group.current.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    for(let i=0;i<COUNT;i++){
      const i3 = i*3;
      let y = arr[i3+1];
      y += speeds[i]*0.008; // gentle rise
      if(y > 2.0 || baseCycle < 0.02){ // reset at burst or cycle start
        const a = Math.random()*Math.PI*2;
        const r = Math.random()*0.3;
        arr[i3] = Math.cos(a)*r;
        arr[i3+1] = 0.05;
        arr[i3+2] = Math.sin(a)*r;
      } else {
        arr[i3+1] = y;
      }
    }
    (group.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });
  return (
    <points ref={group} position={[0,-1.25,0]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={COUNT} itemSize={3} />
      </bufferGeometry>
  <pointsMaterial size={0.05} color={ACCENT_BASE} transparent opacity={isLight?0.42:0.55} sizeAttenuation />
    </points>
  );
}

function AmbientParticles({ isLight=false }:{ isLight?: boolean }){
  const pts = useRef<THREE.Points>(null);
  // Reduced COUNT from 260 -> 180 for lighter fill while preserving depth
  const COUNT = 180;
  const positions = useMemo(()=>{
    const arr = new Float32Array(COUNT*3);
    for(let i=0;i<COUNT;i++){
      const r = 5 + Math.random()*6;
      const a = Math.random()*Math.PI*2;
      arr[i*3] = Math.cos(a)*r;
      arr[i*3+2] = Math.sin(a)*r;
      arr[i*3+1] = -1 + Math.random()*3.2;
    }
    return arr;
  },[]);
  useFrame((_,dt)=>{
    if(!pts.current) return;
    pts.current.rotation.y += dt*0.02;
  });
  return (
    <points ref={pts} position={[0,0,0]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={COUNT} itemSize={3} />
      </bufferGeometry>
  <pointsMaterial size={0.04} color={isLight?'#136050':'#0f564a'} transparent opacity={isLight?0.28:0.35} sizeAttenuation />
    </points>
  );
}

function DriftCamera(){
  const { camera } = useThree();
  useFrame(({ clock })=>{
    const t = clock.getElapsedTime();
    camera.position.x = Math.sin(t*0.05)*0.25;
    camera.position.y = Math.sin(t*0.04)*0.15;
    camera.lookAt(0,0,0);
  });
  return null;
}
