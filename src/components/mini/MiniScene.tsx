"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import * as THREE from 'three';

/**
 * MiniScene
 * Wrapper for small decorative / explanatory 3D scenes.
 * - demand frameloop until hovered / animated
 * - adaptive DPR (lower while idle)
 * - hover activates higher refresh for subtle motion
 */
export function MiniScene({ children, className = "" }: { children: React.ReactNode; className?: string; }) {
  const [needsRefresh, setNeedsRefresh] = useState(0);
  const [visible, setVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement|null>(null);

  // Observe visibility to disable costly re-renders
  useEffect(() => {
    if(!containerRef.current) return;
    const el = containerRef.current;
    const obs = new IntersectionObserver((entries)=>{
      entries.forEach(e => {
        setVisible(e.isIntersecting);
        if(e.isIntersecting) setNeedsRefresh(n=>n+1);
      });
    }, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={containerRef} className={`mini-scene-wrapper ${className}`}>
      <Canvas
        className="mini-scene-canvas"
        dpr={[0.9, 1.6]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ position: [0,0,6], fov: 38 }}
        frameloop={visible ? 'always' : 'demand'}
        onCreated={(state) => {
          state.gl.setClearColor(new THREE.Color(0x000000), 0);
        }}
      >
        <Suspense fallback={null}>
          <SceneInvalidator trigger={needsRefresh} />
          {children}
        </Suspense>
      </Canvas>
      <div className="mini-scene-overlay-gradient" />
    </div>
  );
}

// Forces a single frame on prop change (e.g., hover start)
function SceneInvalidator({ trigger }: { trigger: number }) {
  const invalidate = useThree(s => s.invalidate);
  useEffect(() => { invalidate(); }, [trigger, invalidate]);
  return null;
}

/** Simple orbit sway for idle motion */
export function IdleSway({ speed=0.4, amp=0.15, children }:{ speed?: number; amp?: number; children: React.ReactNode; }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * speed;
    if(ref.current){
      ref.current.rotation.y = Math.sin(t * 0.7) * amp * 1.6;
      ref.current.rotation.x = Math.sin(t * 0.45) * amp;
    }
  });
  return <group ref={ref}>{children}</group>;
}
