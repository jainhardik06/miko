"use client";
import { MiniScene, IdleSway } from "../mini/MiniScene";
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

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
  return (
    <>
      <color attach="background" args={["#000"]} />
      <ambientLight intensity={0.4} />
      <pointLight position={[4,5,4]} intensity={reducedBloom?14:24} distance={30} color={'#19ffc0'} />
      <Seedling />
      <GeoLattice />
      <ScanRing />
      <EffectComposer enableNormalPass={false}>
        <Bloom intensity={reducedBloom?0.55:0.8} luminanceThreshold={0.22} luminanceSmoothing={0.28} radius={0.85} mipmapBlur />
      </EffectComposer>
    </>
  );
}

function Seedling(){
  const group = useRef<THREE.Group>(null);
  const trunkMat = useRef<THREE.MeshStandardMaterial>(null);
  const leafMat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
  if(group.current){ group.current.rotation.y = Math.sin(t*0.25)*0.22; }
  const pulse = (Math.sin(t*1.8)+1)/2;
    if(trunkMat.current){ trunkMat.current.emissiveIntensity = 0.4 + pulse*0.6; }
    if(leafMat.current){ leafMat.current.emissiveIntensity = 0.6 + pulse*0.8; }
  });
  return (
    <group ref={group} position={[0,-1.2,0]}>
      <mesh>
        <cylinderGeometry args={[0.08,0.1,1.4, 12]} />
        <meshStandardMaterial ref={trunkMat} color={'#19ffc0'} emissive={'#19ffc0'} emissiveIntensity={0.8} roughness={0.5} metalness={0.2} />
      </mesh>
      {[-0.15,0.15].map((x,i)=>(
        <mesh key={i} position={[x,0.6+i*0.18,0]} rotation={[Math.PI/2,0,x>0?0.4:-0.4]}> 
          <planeGeometry args={[0.7,0.35,1,1]} />
          <meshStandardMaterial ref={i===0?leafMat:undefined} color={'#19ffc0'} emissive={'#19ffc0'} transparent opacity={0.85} emissiveIntensity={0.9} roughness={0.35} metalness={0.25} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

function GeoLattice(){
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
      <lineBasicMaterial color={'#0b3e35'} transparent opacity={0.45} />
    </lineSegments>
  );
}

function ScanRing(){
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
        <meshBasicMaterial color={'#19ffc0'} transparent opacity={0.3} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={flashRef} rotation={[-Math.PI/2,0,0]} position={[0,-0.05,0]}> 
        <circleGeometry args={[1.15, 48]} />
        <meshBasicMaterial color={'#ffb347'} transparent opacity={0} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}
