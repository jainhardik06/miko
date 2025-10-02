"use client";
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useRef, useMemo, useEffect } from 'react';
import { SceneBackground } from '../SceneBackground';
import { ACCENT_BASE } from '../themeColors';

/* HeroForestCanvas
 * First-pass immersive hero scene with:
 * - Obsidian floor plane
 * - Instanced background trees (placeholder geometry)
 * - Ember particles
 * - Hero tree (placeholder glass trunk + crystal)
 * - Subtle dolly + parallax camera
 */

const clamp = (v:number,a=0,b=1)=>Math.min(b,Math.max(a,v));

function ParallaxCameraController({ intensity=0.4, smooth=0.065, maxYaw=0.4, maxPitch=0.28 }: { intensity?: number; smooth?: number; maxYaw?: number; maxPitch?: number; }){
  const { camera, invalidate } = useThree();
  const target = useRef({x:0,y:0});
  const eased = useRef({x:0,y:0});
  useEffect(() => {
    function onPointerMove(e:PointerEvent){
      const nx = (e.clientX / window.innerWidth) - 0.5;
      const ny = (e.clientY / window.innerHeight) - 0.5;
      target.current.y = THREE.MathUtils.clamp(nx * intensity, -maxYaw, maxYaw);
      target.current.x = THREE.MathUtils.clamp(ny * intensity * 0.65, -maxPitch, maxPitch);
      invalidate();
    }
    window.addEventListener('pointermove', onPointerMove, { passive:true });
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, [intensity, maxYaw, maxPitch, invalidate]);
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    // ease rotations
    eased.current.x += (target.current.x - eased.current.x) * smooth;
    eased.current.y += (target.current.y - eased.current.y) * smooth;
    const baseZ = 9 + Math.sin(t * 0.07) * 0.6;
    camera.position.z += (baseZ - camera.position.z) * 0.04;
    camera.position.y += ((1.8) - camera.position.y) * 0.05;
    camera.rotation.x = eased.current.x;
    camera.rotation.y = eased.current.y;
    camera.lookAt(0,1.8,0);
  });
  return null;
}

function HeroTree(){
  const group = useRef<THREE.Group>(null);
  const crystal = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if(crystal.current){
      crystal.current.rotation.y += dt * 0.25;
      const pulse = (Math.sin(performance.now()*0.0012)+1)/2; // 0..1
      (crystal.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.9 + pulse*1.2;
    }
  });
  return (
    <group ref={group}>
      <mesh position={[0,1.4,0]}>
        <cylinderGeometry args={[0.35,0.55,2.8, 48, 1, true]} />
        <meshPhysicalMaterial
          transmission={0.85}
          thickness={0.6}
          roughness={0.25}
          metalness={0.15}
          clearcoat={0.4}
          attenuationDistance={4}
          attenuationColor={ACCENT_BASE}
          color="#0a3026"
          emissive="#0a3026"
          transparent
          opacity={0.85}
        />
      </mesh>
      <mesh ref={crystal} position={[0,2.25,0]}>
        <icosahedronGeometry args={[0.9,0]} />
  <meshStandardMaterial color={ACCENT_BASE} emissive={ACCENT_BASE} emissiveIntensity={1.2} metalness={0.6} roughness={0.15} />
      </mesh>
    </group>
  );
}

function InstancedTrees(){
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(()=>new THREE.Object3D(),[]);
  const COUNT = 60;
  const data = useMemo(() => {
    const arr = [] as {pos:THREE.Vector3; scale:number; rot:number}[];
    for(let i=0;i<COUNT;i++){
      const r = 8 + Math.random()*40;
      const a = Math.random()*Math.PI*2;
      const x = Math.cos(a)*r;
      const z = Math.sin(a)*r;
      const y = 0;
      const scale = 0.6 + Math.random()*1.8;
      const rot = Math.random()*Math.PI*2;
      arr.push({pos:new THREE.Vector3(x,y,z), scale, rot});
    }
    return arr;
  },[]);
  useEffect(() => {
    if(!ref.current) return;
    data.forEach((d,i)=>{
      dummy.position.copy(d.pos);
      dummy.rotation.y = d.rot;
      dummy.scale.setScalar(d.scale);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  },[data,dummy]);
  return (
    <instancedMesh ref={ref} args={[undefined as any, undefined as any, COUNT]}>
      <cylinderGeometry args={[0.08,0.14,2.4, 16, 1, true]} />
      <meshStandardMaterial color="#0f3c33" emissive="#0f3c33" emissiveIntensity={0.25} transparent opacity={0.55} roughness={0.7} metalness={0.1} />
    </instancedMesh>
  );
}

function EmberParticles(){
  const ref = useRef<THREE.Points>(null);
  const COUNT = 400;
  const positions = useMemo(()=>{
    const arr = new Float32Array(COUNT*3);
    for(let i=0;i<COUNT;i++){
      const r = Math.random()*26;
      const a = Math.random()*Math.PI*2;
      const x = Math.cos(a)*r;
      const z = Math.sin(a)*r;
      const y = Math.random()*4 + 0.2;
      arr.set([x,y,z], i*3);
    }
    return arr;
  },[]);
  const mat = useRef<THREE.PointsMaterial>(null);
  useFrame((_,dt)=>{
    if(!ref.current) return;
    ref.current.rotation.y += dt*0.02;
    if(mat.current){
      const pulse = (Math.sin(performance.now()*0.0008)+1)/2;
      mat.current.size = 0.02 + pulse*0.015;
    }
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={COUNT} array={positions} itemSize={3} />
      </bufferGeometry>
  <pointsMaterial ref={mat} color={ACCENT_BASE} size={0.03} sizeAttenuation transparent opacity={0.55} />
    </points>
  );
}

export function HeroForestCanvas(){
  return (
    <Canvas
      frameloop="demand"
      camera={{ position:[0,2,12], fov:48 }}
      dpr={[1,2]}
      gl={{ antialias:true }}
      className="hero-forest-canvas"
    >
      <SceneBackground />
      <fog attach="fog" args={["#03070c", 12, 60]} />
      <ambientLight intensity={0.4} />
  <spotLight position={[4,15,8]} intensity={2.5} angle={0.6} penumbra={0.9} color={ACCENT_BASE} distance={120} decay={2} />
      <pointLight position={[-6,6,-4]} intensity={0.6} color="#0d4033" />
      <group position={[0,0,0]}>
        <HeroTree />
        <InstancedTrees />
        <EmberParticles />
        <mesh rotation={[-Math.PI/2,0,0]} position={[0,0,0]} receiveShadow>
          <planeGeometry args={[400,400,1,1]} />
          <meshStandardMaterial color="#050807" roughness={0.9} metalness={0.35} />
        </mesh>
      </group>
    <ParallaxCameraController intensity={0.35} />
      <EffectComposer enableNormalPass={false}>
        <Bloom mipmapBlur intensity={1.1} luminanceThreshold={0.15} luminanceSmoothing={0.18} radius={0.85} />
      </EffectComposer>
    </Canvas>
  );
}

export default HeroForestCanvas;
