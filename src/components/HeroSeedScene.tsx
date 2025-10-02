"use client";
import { Canvas, useFrame, invalidate } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useScroll, useTransform, useSpring, MotionValue } from 'framer-motion';
import { useEffect } from 'react';

// Scroll driven central seed + orbiting dust motes

interface SeedProps {
  scaleMV: MotionValue<number>;
  opacityMV: MotionValue<number>;
}

function Seed({ scaleMV, opacityMV }: SeedProps){
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if(!mesh.current || !material.current) return;
    const s = scaleMV.get();
    mesh.current.scale.setScalar(s);
    material.current.opacity = opacityMV.get();
    material.current.emissiveIntensity = 0.5 + 1.2 * opacityMV.get();
  });
  return (
    <mesh ref={mesh}>
      <sphereGeometry args={[0.5, 48, 48]} />
      <meshStandardMaterial ref={material} color="#2ECC71" emissive="#2ECC71" emissiveIntensity={0.5} roughness={0.35} metalness={0.05} transparent opacity={0} />
    </mesh>
  );
}

interface DustProps { opacityMV: MotionValue<number>; speedMV: MotionValue<number>; }
function Dust({ opacityMV, speedMV }: DustProps){
  const count = 70;
  const inst = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(()=> new THREE.Object3D(), []);
  const base = useMemo(()=> new Array(count).fill(0).map(()=> 0.9 + Math.random()*2.4), [count]);
  const angles = useMemo(()=> new Array(count).fill(0).map(()=> Math.random()*Math.PI*2), [count]);
  useFrame((_: any, delta: number) => {
    if(!inst.current) return;
    const speed = speedMV.get();
    const op = opacityMV.get();
    for(let i=0;i<count;i++){
      angles[i] += delta * 0.15 * speed * (0.3 + i/count);
      const r = base[i];
      const x = Math.cos(angles[i]) * r;
      const z = Math.sin(angles[i]) * r;
      const y = Math.sin(angles[i]*0.9)*0.25;
      dummy.position.set(x,y,z);
      const s = 0.02 + (r*0.015)*speed;
      dummy.scale.setScalar(s);
      dummy.rotation.y = angles[i];
      dummy.updateMatrix();
      inst.current.setMatrixAt(i,dummy.matrix);
    }
    inst.current.instanceMatrix.needsUpdate = true;
    (inst.current.material as THREE.MeshBasicMaterial).opacity = op;
  });
  return (
    <instancedMesh ref={inst} args={[undefined as any, undefined as any, count]}>
      <sphereGeometry args={[1,8,8]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0} />
    </instancedMesh>
  );
}

function CameraRig({ dollyMV }: { dollyMV: MotionValue<number> }){
  const group = useRef<THREE.Group>(null);
  useFrame(({ camera }: any) => {
    const z = dollyMV.get();
    camera.position.z += (z - camera.position.z) * 0.08;
    camera.lookAt(0,0,0);
  });
  return <group ref={group} />;
}

export default function HeroSeedScene(){
  // Framer scroll in main document root
  const { scrollYProgress } = useScroll();
  // Work only in the first 25% scroll region
  const clamped = useTransform(scrollYProgress, [0, 0.25], [0,1]);
  // Motion values
  const scaleMV = useSpring(useTransform(clamped, (v: number) => Math.min(1, v)), { stiffness: 90, damping: 18 });
  const opacityMV = useSpring(useTransform(clamped, (v: number) => v), { stiffness: 80, damping: 20 });
  const speedMV = useSpring(useTransform(clamped, (v: number) => 0.4 + v*0.8), { stiffness: 60, damping: 16 });
  const dollyMV = useSpring(useTransform(clamped, (v: number) => 6 - v*2.2), { stiffness: 55, damping: 18 });

  // Ensure initial values trigger one frame
  useEffect(()=>{ scaleMV.set(0); opacityMV.set(0); }, [scaleMV, opacityMV]);

  // Invalidate R3F render only when motion values change (perf)
  useEffect(()=>{
    const unsub = [scaleMV, opacityMV, speedMV, dollyMV].map(mv => mv.on('change', () => invalidate()));
    return () => { unsub.forEach(u=>u()); };
  }, [scaleMV, opacityMV, speedMV, dollyMV]);

  return (
    <Canvas camera={{ position:[0,0,6], fov:45 }} gl={{ antialias:true }} dpr={[1,2]} frameloop="demand">
      <color attach="background" args={["#000000"]} />
      <ambientLight intensity={0.5} />
      <pointLight position={[2,2,3]} intensity={1.8} color="#2ECC71" />
      <Seed scaleMV={scaleMV} opacityMV={opacityMV} />
      <Dust opacityMV={opacityMV} speedMV={speedMV} />
      <CameraRig dollyMV={dollyMV} />
    </Canvas>
  );
}
