"use client";
// Unified multi-act scroll driven canvas (Acts 1-4) implementing the "Living Canvas" concept.
// Acts:
// 1 Seed & ambient particles idle
// 2 Tree growth
// 3 Crystal zoom (camera push inside trunk)
// 4 Network reveal (pull back & show mycorrhiza nodes)
// Sticky behaviour handled by parent layout; this component just maps section progress.

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useRef, useEffect, useState, useCallback } from 'react';

interface LivingCanvasProps {
  sectionIds: string[]; // [hero, annadata, tokenize, network]
}

interface SectionMetrics { id: string; start: number; end: number; }

// Utility: clamp
const clamp = (v: number, a=0, b=1) => Math.min(b, Math.max(a, v));

function useSectionProgress(sectionIds: string[]) {
  const [metrics, setMetrics] = useState<SectionMetrics[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});

  const measure = useCallback(() => {
    const vh = window.innerHeight;
    const list: SectionMetrics[] = sectionIds.map(id => {
      const el = document.getElementById(id);
      if(!el) return { id, start: 0, end: 0 };
      const rect = el.getBoundingClientRect();
      const top = rect.top + window.scrollY; // document position
      const start = top - vh * 0.5; // when center hits top half viewport
      const end = top + rect.height - vh * 0.5;
      return { id, start, end };
    });
    setMetrics(list);
  }, [sectionIds]);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  useEffect(() => {
    function onScroll() {
      const yCenter = window.scrollY + window.innerHeight * 0.5;
      const map: Record<string, number> = {};
      metrics.forEach(m => {
        if(m.end <= m.start) { map[m.id] = 0; return; }
        map[m.id] = clamp((yCenter - m.start) / (m.end - m.start));
      });
      setProgressMap(map);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [metrics]);

  return progressMap; // values 0..1 for each id (may be undefined until first measure)
}

// Easing helpers
const easeInOut = (t: number) => t < 0.5
  ? 0.5 * Math.pow(t*2, 3)
  : 1 - 0.5 * Math.pow((1 - t)*2, 3);
const smoothstep = (t: number) => t * t * (3 - 2 * t);

// Blend utility
function blend(a: number, b: number, t: number) { return a + (b - a) * t; }

// ---------- Scene Objects ----------

function Seed({ act1 }: { act1: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if(!ref.current || !mat.current) return;
    const idlePulse = (Math.sin(performance.now()*0.0012)+1)/2; // 0..1
    const baseScale = 0.55 + idlePulse*0.05; // gentle breathing
    const grow = 0.3 + act1 * 0.7; // appears early (act1 starts >0 immediately)
    ref.current.scale.setScalar(baseScale * grow);
    mat.current.opacity = 0.25 + act1 * 0.6;
    mat.current.emissiveIntensity = 0.6 + act1 * 1.4 + idlePulse*0.3;
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.5, 48, 48]} />
      <meshStandardMaterial ref={mat} color="#16e4b1" emissive="#16e4b1" emissiveIntensity={0.8} roughness={0.35} metalness={0.05} transparent opacity={0.1} />
    </mesh>
  );
}

function Particles({ act1, hoverBoost }: { act1: number; hoverBoost: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useRef(new THREE.Object3D());
  const COUNT = 140;
  // static arrays
  const radii = useRef(Float32Array.from({ length: COUNT }, () => 0.8 + Math.random()*3.2));
  const ang = useRef(Float32Array.from({ length: COUNT }, () => Math.random()*Math.PI*2));

  useFrame((_, delta) => {
    if(!ref.current) return;
    const visCount = Math.floor(COUNT * (0.15 + act1*0.85));
    for(let i=0;i<visCount;i++) {
      ang.current[i] += delta * (0.12 + act1*0.9 + hoverBoost*0.3) * (0.3 + i/visCount);
      const r = radii.current[i] * (0.6 + act1*0.9);
      const x = Math.cos(ang.current[i]) * r;
      const z = Math.sin(ang.current[i]) * r;
      const y = Math.sin(ang.current[i]*1.3)*0.25;
      dummy.current.position.set(x,y,z);
      dummy.current.scale.setScalar(0.02 + r*0.015*(0.6+act1));
      dummy.current.updateMatrix();
      ref.current.setMatrixAt(i, dummy.current.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
    (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.05 + act1*0.55;
  });
  return (
    <instancedMesh ref={ref} args={[undefined as any, undefined as any, COUNT]}>
      <sphereGeometry args={[1,8,8]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0} />
    </instancedMesh>
  );
}

function Tree({ act2, act3 }: { act2: number; act3: number }) {
  // Simple stylised trunk (cylinder) + crystal (icosahedron)
  const trunk = useRef<THREE.Mesh>(null);
  const crystal = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if(trunk.current) {
      const h = 0.2 + act2 * 3.2; // height growth
      trunk.current.scale.set(1, h, 1);
      (trunk.current.material as THREE.MeshStandardMaterial).opacity = 0.15 + act2*0.55;
    }
    if(crystal.current) {
      // Crystal only fully appears during act3
      const t = act3;
      crystal.current.rotation.y += 0.01 + t*0.05;
      crystal.current.scale.setScalar(0.3 + t*0.6);
      (crystal.current.material as THREE.MeshStandardMaterial).opacity = 0.05 + t*0.95;
      (crystal.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3 + t*1.7;
    }
  });
  return (
    <group position={[0,-0.5,0]}>
      <mesh ref={trunk} position={[0,1.2,0]}>
        <cylinderGeometry args={[0.15,0.28,2.4, 32, 1, true]} />
        <meshStandardMaterial color="#19f5c3" emissive="#19f5c3" transparent opacity={0.1} roughness={0.2} metalness={0.4} />
      </mesh>
      <mesh ref={crystal} position={[0,2.4,0]}>
        <icosahedronGeometry args={[0.5,0]} />
        <meshStandardMaterial color="#00ffe0" emissive="#00ffe0" emissiveIntensity={0.4} metalness={0.9} roughness={0.1} transparent opacity={0} />
      </mesh>
    </group>
  );
}

function Network({ act4 }: { act4: number }) {
  const nodes = useRef<THREE.Points>(null);
  const [geo] = useState(() => {
    const g = new THREE.BufferGeometry();
    const COUNT = 240;
    const positions = new Float32Array(COUNT*3);
    for(let i=0;i<COUNT;i++) {
      const r = 4 + Math.random()*6;
      const a = Math.random()*Math.PI*2;
      const x = Math.cos(a)*r;
      const z = Math.sin(a)*r;
      const y = (Math.random()-0.5)*2.5;
      positions.set([x,y,z], i*3);
    }
    g.setAttribute('position', new THREE.BufferAttribute(positions,3));
    return g;
  });
  const mat = useRef<THREE.PointsMaterial>(null);
  useFrame(() => {
    if(!nodes.current || !mat.current) return;
    mat.current.size = 0.05 + act4*0.15;
    mat.current.opacity = clamp(act4*1.1);
    nodes.current.rotation.y += 0.001 + act4*0.01;
  });
  return (
    <points ref={nodes} geometry={geo}>
      <pointsMaterial ref={mat} color="#00ffe0" size={0.05} sizeAttenuation transparent opacity={0} />
    </points>
  );
}

function CameraRig({ act1, act2, act3, act4, hoverBoost }: { act1: number; act2: number; act3: number; act4: number; hoverBoost: number }) {
  const target = new THREE.Vector3();
  useFrame(({ camera }) => {
    // Keyed camera states per act
    // Act1: wide establishing
    const cam1 = { pos: new THREE.Vector3(0, 0.4, 7.5), look: new THREE.Vector3(0,1.2,0.0), fov: 45 };
    // Act2: subtle push & lift
    const cam2 = { pos: new THREE.Vector3(0.1, 0.9, 5.6), look: new THREE.Vector3(0,1.5,0), fov: 46 };
    // Act3: intimate crystal dive
    const cam3 = { pos: new THREE.Vector3(0.15, 1.5, 2.4), look: new THREE.Vector3(0,2.3,0), fov: 52 };
    // Act4: dramatic pullback reveal
    const cam4 = { pos: new THREE.Vector3(0.0, 1.3, 10.5), look: new THREE.Vector3(0,1.8,0), fov: 50 };

    // Progressive blending chain
    // Phase blends: A->B via t, then result->C, etc.
    function lerpVec(a: THREE.Vector3, b: THREE.Vector3, t: number){ return a.clone().lerp(b, t); }
    const ab = lerpVec(cam1.pos, cam2.pos, act2);
    const lookAB = lerpVec(cam1.look, cam2.look, act2);
    const fovAB = cam1.fov + (cam2.fov - cam1.fov) * act2;

    const abc = lerpVec(ab, cam3.pos, act3);
    const lookABC = lerpVec(lookAB, cam3.look, act3);
    const fovABC = fovAB + (cam3.fov - fovAB) * act3;

    const finalPos = lerpVec(abc, cam4.pos, act4);
    const finalLook = lerpVec(lookABC, cam4.look, act4);
    let finalFov = fovABC + (cam4.fov - fovABC) * act4;

    // Micro parallax: subtle x offset from hover + early scroll
    const lateral = (act1 * 0.4 + act2 * 0.2) * (0.2 + hoverBoost*0.4);
    finalPos.x += lateral * 0.4;
    finalLook.x += lateral * 0.15;

    // Smooth move
    camera.position.lerp(finalPos, 0.08);
    target.copy(finalLook);
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const pc = camera as THREE.PerspectiveCamera;
      pc.fov += (finalFov - pc.fov) * 0.08;
      pc.updateProjectionMatrix();
    }
    camera.lookAt(target);
  });
  return null;
}

export default function LivingCanvas({ sectionIds }: LivingCanvasProps) {
  const progress = useSectionProgress(sectionIds);
  // Raw per-section progress
  const raw1 = clamp(progress[sectionIds[0]] ?? 0);
  const raw2 = clamp(progress[sectionIds[1]] ?? 0);
  const raw3 = clamp(progress[sectionIds[2]] ?? 0);
  const raw4 = clamp(progress[sectionIds[3]] ?? 0);

  // Segmented + eased acts (allow slight overlap for continuity)
  const act1 = smoothstep(raw1);
  const act2 = raw2 > 0 ? easeInOut(raw2) : 0;
  // Act3 softly waits for act2 tail: gate start until raw2 > ~0.15
  const act3Gate = clamp((raw2 - 0.15) / 0.85);
  const act3 = easeInOut(raw3) * act3Gate;
  // Act4 builds only after act3 ~20%
  const act4Gate = clamp((act3 - 0.2) / 0.8);
  const act4 = easeInOut(raw4) * act4Gate;

  // Expose for quick debugging when running in browser
  if (typeof window !== 'undefined') {
    // @ts-ignore
    window.__acts = { raw1, raw2, raw3, raw4, act1, act2, act3, act4 };
  }

  const [hoverBoost, setHoverBoost] = useState(0);
  const hoverRef = useRef<number>(0);
  // Hover decay must occur inside Canvas via a helper component to satisfy R3F hook rules.
  function HoverDecay(){
    useFrame(() => {
      hoverRef.current += (0 - hoverRef.current) * 0.05;
      // Only update state when value meaningfully changes to avoid extra renders
      setHoverBoost(prev => {
        const next = hoverRef.current;
        return Math.abs(prev - next) > 0.002 ? next : prev;
      });
    });
    return null;
  }

  // Bridge to access r3f's invalidate outside direct Canvas children
  const invalidateRef = useRef<() => void>(() => {});
  const onPointerMove = () => { hoverRef.current = 1; invalidateRef.current(); };

  // Invalidate on scroll (throttled) when acts are transitioning
  useEffect(() => {
    let ticking = false;
    function onScroll(){
      if(!ticking){
        ticking = true;
        requestAnimationFrame(() => {
          ticking = false;
          invalidateRef.current();
        });
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function InvalidateBridge(){
    const { invalidate } = useThree();
    useEffect(() => { invalidateRef.current = invalidate; }, [invalidate]);
    return null;
  }

  return (
    <Canvas
      frameloop="demand"
      onPointerMove={onPointerMove}
      onPointerDown={onPointerMove}
      camera={{ position:[0,0,6], fov:45 }}
      gl={{ antialias:true }}
      dpr={[1,2]}
      className="living-canvas"
    >
  <color attach="background" args={["#000"]} />
  <InvalidateBridge />
      <fog attach="fog" args={["#030609", 6, 26]} />
      <ambientLight intensity={0.5} />
      <pointLight position={[2,3,4]} intensity={1.8} color="#16e4b1" />
      <spotLight
        position={[0,8,6]}
        angle={0.7}
        penumbra={0.9}
        intensity={2.5}
        color="#19f5c3"
        distance={40}
        decay={2}
      />
      <group position={[0,0,0]}>
        <Seed act1={act1} />
        <Particles act1={act1} hoverBoost={hoverBoost} />
        <Tree act2={act2} act3={act3} />
        <Network act4={act4} />
      </group>
  <CameraRig act1={act1} act2={act2} act3={act3} act4={act4} hoverBoost={hoverBoost} />
      <HoverDecay />
  <EffectComposer enableNormalPass={false}>
        <Bloom
          mipmapBlur
          intensity={1.2}
          luminanceThreshold={0.18}
          luminanceSmoothing={0.12}
          radius={0.85}
        />
      </EffectComposer>
    </Canvas>
  );
}
