"use client";
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
// Removed framer-motion-3d; we'll animate manually with useFrame.

// Scroll progress hook (viewport based)
function useScrollProgress(containerRef: React.RefObject<HTMLDivElement>) {
  const progressRef = useRef(0);
  useEffect(() => {
    function onScroll() {
      const el = containerRef.current; if(!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // visible from top until one viewport height consumed
      const p = 1 - rect.top / vh; // 0 when top at viewport top, increases as user scrolls down
      progressRef.current = Math.min(1, Math.max(0, p));
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [containerRef]);
  return progressRef;
}

interface ParticlesProps { count?: number; getProgress: () => number; }

function SeedCore({ getProgress }: { getProgress: () => number }) {
  const ref = useRef<THREE.Mesh>(null);
  // intro interpolation timeline
  const introRef = useRef({ t: 0 });
  useFrame((_, delta) => {
    const mesh = ref.current; if(!mesh) return;
    const p = getProgress();
    // intro ease (first ~1.2s) then rely partly on scroll
    if(introRef.current.t < 1) {
      introRef.current.t = Math.min(1, introRef.current.t + delta / 1.2);
    }
    const intro = 1 - Math.pow(1 - introRef.current.t, 3); // easeOutCubic
    const scale = 0.4 + (0.6 * intro) + p * 0.15; // slight growth with scroll
    mesh.scale.setScalar(scale);
    const emissiveBoost = 1 + p * 1.4;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 1.6 * intro * emissiveBoost;
    mat.opacity = 0.4 + 0.55 * intro + p * 0.05;
  });
  return (
    <mesh ref={ref} position={[0,0,0]}>
      <sphereGeometry args={[0.55, 48, 48]} />
      <meshStandardMaterial
        emissive={'#0fe7aa'}
        emissiveIntensity={0.2}
        color={'#0fe7aa'}
        roughness={0.3}
        metalness={0.1}
        transparent
        opacity={0.25}
      />
    </mesh>
  );
}

function Particles({ count = 160, getProgress }: ParticlesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const baseRadii = useMemo(() => new Array(count).fill(0).map(() => 0.6 + Math.random() * 3.2), [count]);
  const speeds = useMemo(() => new Array(count).fill(0).map(()=> 0.2 + Math.random()*0.8), [count]);
  const angles = useMemo(()=> new Array(count).fill(0).map(()=> Math.random()*Math.PI*2), [count]);

  useFrame((state, delta) => {
    const p = getProgress();
    if(!meshRef.current) return;
    const visible = Math.floor(p * count);
    for(let i=0;i<visible;i++) {
      angles[i] += speeds[i] * delta * (0.2 + p * 2.2);
      const orbit = baseRadii[i] * (0.3 + p * 1.1);
      const x = Math.cos(angles[i]) * orbit;
      const y = (Math.sin(angles[i]*1.2) * 0.3 * (0.4 + p));
      const z = Math.sin(angles[i]) * orbit;
      dummy.position.set(x, y, z);
      const scale = 0.02 + (baseRadii[i] * 0.015) * (0.4 + p);
      dummy.scale.setScalar(scale);
      dummy.rotation.y = angles[i];
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      const alpha = 0.1 + p * 0.65;
      meshRef.current.setColorAt(i, new THREE.Color(`rgba(0,255,200,${alpha})`));
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  // Instance color (available when using meshBasicMaterial with vertexColors)
  const instanced = meshRef.current as unknown as { instanceColor?: { needsUpdate: boolean } };
  if(instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
  });

  return (
  <instancedMesh ref={meshRef} args={[undefined as unknown as THREE.BufferGeometry, undefined as unknown as THREE.Material, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial transparent color={'#00ffe0'} opacity={0.4} />
    </instancedMesh>
  );
}

function CameraRig({ getProgress }: { getProgress: () => number }) {
  const { camera } = useThree();
  useFrame(() => {
    const p = getProgress();
    const targetZ = 6 - p * 2.8; // dolly slightly inward
    camera.position.z += (targetZ - camera.position.z) * 0.08;
    camera.lookAt(0,0,0);
  });
  return null;
}

export default function SeedScene3D(){
  // (Diagnostics removed after stabilization)
  const containerRef = useRef<HTMLDivElement>(null);
  const progRef = useScrollProgress(containerRef);
  const getProgress = () => progRef.current;

  // Pause render when tab hidden
  const shouldRender = useRef(true);
  useEffect(() => {
    function vis() { shouldRender.current = !document.hidden; }
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <Canvas gl={{ antialias: true }} dpr={[1, 2]} camera={{ position:[0,0,6], fov: 42 }} frameloop="always">
        <Suspense fallback={null}>
          <CameraRig getProgress={getProgress} />
          {/* Glowing core seed (manual animated) */}
          <SeedCore getProgress={getProgress} />
          {/* Atmospheric gradient via large sphere */}
          <mesh>
            <sphereGeometry args={[6, 32, 32]} />
            <meshBasicMaterial side={THREE.BackSide} color={'#00110d'} />
          </mesh>
          <Particles getProgress={getProgress} />
          <ambientLight intensity={0.6} />
          <pointLight position={[2,2,3]} intensity={2} color={'#0fe7aa'} />
        </Suspense>
      </Canvas>
      <span className="sr-only">3D seed with orbiting particles responding to scroll</span>
    </div>
  );
}
