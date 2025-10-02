"use client";
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useMemo, useRef, useEffect, forwardRef } from 'react';

/* EcoGenesisHeroCanvas
 * Replaces forest: focuses on protocol genesis imagery
 * Elements: Core (shell + inner lattice), orbit oracles, root veins, carbon flux, growth halo
 */

function ParallaxCamera(){
  const { camera } = useThree();
  useFrame(({ clock })=>{
    const t = clock.getElapsedTime();
    // gentle autonomous drift
    const yaw = Math.sin(t*0.08) * 0.15;
    const pitch = Math.sin(t*0.055) * 0.09;
    const baseZ = 11 + Math.sin(t*0.025)*0.6;
    camera.position.z += (baseZ - camera.position.z)*0.025;
    camera.rotation.y += (yaw - camera.rotation.y)*0.04;
    camera.rotation.x += (pitch - camera.rotation.x)*0.04;
    camera.lookAt(0,2,0);
  });
  return null;
}

function Core(){
  const crystal = useRef<THREE.Mesh>(null);
  const shell = useRef<THREE.Mesh>(null);
  const lattice = useRef<THREE.LineSegments>(null);
  useFrame((_, dt)=>{
    const t = performance.now()*0.001;
  if(crystal.current){ crystal.current.rotation.y += dt * 0.18; }
    if(shell.current){
      const pulse = (Math.sin(t*2.4)+1)/2; // 0..1
      (shell.current.material as THREE.MeshPhysicalMaterial).thickness = 0.55 + pulse*0.25;
    }
  if(lattice.current){ lattice.current.rotation.y -= dt * 0.07; lattice.current.rotation.x += dt * 0.05; }
  });
  return (
    <group>
      <mesh ref={shell} position={[0,2,0]}>
        <icosahedronGeometry args={[1.9,1]} />
        <meshPhysicalMaterial transmission={0.95} thickness={0.6} roughness={0.15} metalness={0.1} clearcoat={0.6} clearcoatRoughness={0.2} attenuationColor={'#19ffc0'} attenuationDistance={5} transparent opacity={0.9} color="#072b24" />
      </mesh>
      <mesh ref={crystal} position={[0,2,0]}>
        <icosahedronGeometry args={[1.25,0]} />
        <meshStandardMaterial emissive={'#19ffc0'} emissiveIntensity={1.3} color={'#19ffc0'} metalness={0.55} roughness={0.25} />
      </mesh>
      <Lattice position={[0,2,0]} ref={lattice as any} />
    </group>
  );
}

// Wireframe lattice (React forwardRef, not THREE)
const Lattice = forwardRef<THREE.LineSegments, { position:[number,number,number] }>(function Lattice({ position }, ref){
  const geo = useMemo(()=>{
    const g = new THREE.IcosahedronGeometry(1.35,1);
    return new THREE.WireframeGeometry(g);
  }, []);
  return (
    <lineSegments ref={ref} geometry={geo} position={position as any}>
      <lineBasicMaterial color={'#19ffc0'} linewidth={1} transparent opacity={0.35} />
    </lineSegments>
  );
});

function OrbitOracles(){
  const group = useRef<THREE.Group>(null);
  const COUNT = 6;
  const orbs = useMemo(()=> new Array(COUNT).fill(0).map((_,i)=>({ baseAngle:(i/COUNT)*Math.PI*2, radius:4.2, y:2, speed:0.11 + i*0.01 })), []);
  useFrame(({ clock })=>{
    const t = clock.getElapsedTime();
    if(!group.current) return;
    group.current.children.forEach((c,i)=>{
      const o = orbs[i];
      const a = o.baseAngle + t*o.speed;
  c.position.set(Math.cos(a)*o.radius, o.y + Math.sin(t*0.45 + i)*0.22, Math.sin(a)*o.radius);
  c.rotation.y = a + t*0.25;
    });
  });
  return (
    <group ref={group}>
      {orbs.map((o,i)=>(
        <mesh key={i} scale={0.32}>
          <icosahedronGeometry args={[1,0]} />
          <meshStandardMaterial emissive={'#ffb347'} emissiveIntensity={1.1} color={'#ffb347'} roughness={0.35} metalness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function GrowthHalo(){
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock })=>{
    const t = clock.getElapsedTime();
    const cycle = (t % 12)/12; // 0..1
    if(ring.current){
      const s = 2 + cycle * 16;
      ring.current.scale.set(s,s,s);
      const mat = ring.current.material as THREE.MeshBasicMaterial;
      mat.opacity = (1 - cycle) * 0.25;
    }
  });
  return (
    <mesh ref={ring} rotation={[-Math.PI/2,0,0]} position={[0,0.02,0]}> 
      <ringGeometry args={[1.2,1.28,96]} />
      <meshBasicMaterial color={'#19ffc0'} transparent opacity={0.25} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

function RootVeins(){
  const lines = useRef<THREE.LineSegments>(null);
  const geo = useMemo(()=>{
    const g = new THREE.BufferGeometry();
    const branches = 90;
    const points: number[] = [];
    for(let i=0;i<branches;i++){
      const a = Math.random()*Math.PI*2;
      const len = 6 + Math.random()*14;
      const steps = 6 + Math.floor(Math.random()*6);
      let x=0,y=0,z=0;
      let dir = new THREE.Vector3(Math.cos(a), -0.6, Math.sin(a)).normalize();
      for(let s=0; s<steps; s++){
        const nx = x + dir.x * (len/steps);
        const ny = y + dir.y * (len/steps) * (0.4 + Math.random()*0.6);
        const nz = z + dir.z * (len/steps);
        points.push(x, y+2, z, nx, ny+2, nz);
        x=nx; y=ny; z=nz;
        dir.x += (Math.random()-0.5)*0.4; dir.z += (Math.random()-0.5)*0.4; dir.normalize();
      }
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(points),3));
    return g;
  }, []);
  return (
    <lineSegments ref={lines} geometry={geo}>
      <lineBasicMaterial color={'#0a463a'} transparent opacity={0.35} />
    </lineSegments>
  );
}

function CarbonFlux(){
  const pts = useRef<THREE.Points>(null);
  const COUNT = 650;
  const { positions, speeds } = useMemo(()=>{
    const pos = new Float32Array(COUNT*3);
    const sp = new Float32Array(COUNT);
    for(let i=0;i<COUNT;i++){
      const r = Math.random()*14;
      const a = Math.random()*Math.PI*2;
      pos[i*3+0] = Math.cos(a)*r;
      pos[i*3+2] = Math.sin(a)*r;
      pos[i*3+1] = Math.random()*4 + 0.2;
      sp[i] = 0.4 + Math.random()*0.8;
    }
    return { positions: pos, speeds: sp };
  }, []);
  useFrame((_, dt)=>{
    if(!pts.current) return;
    const arr = (pts.current.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    for(let i=0;i<COUNT;i++){
      const i3=i*3;
      const x = arr[i3]; const z = arr[i3+2];
      const radialDist = Math.sqrt(x*x + z*z);
      const accel = radialDist < 3 ? 1.8 : 1;
      arr[i3+1] += speeds[i]*dt*accel;
      if(arr[i3+1] > 14){ arr[i3+1] = 0.2; }
    }
    (pts.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });
  return (
    <points ref={pts} position={[0,0,0]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={COUNT} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color={'#19ffc0'} size={0.06} sizeAttenuation transparent opacity={0.55} />
    </points>
  );
}

export function EcoGenesisHeroCanvas({ offsetX = 3.5 }: { offsetX?: number }){
  return (
    <Canvas frameloop="demand" camera={{ position:[0,2,14], fov:50 }} dpr={[1,2]} gl={{ antialias:true }}>
      <color attach="background" args={["#000000"]} />
      <fog attach="fog" args={["#020507", 14, 80]} />
      <ambientLight intensity={0.45} />
      <spotLight position={[6,18,10]} intensity={2.8} angle={0.6} penumbra={0.9} color="#19ffc0" distance={140} decay={2} />
      <pointLight position={[-8,5,-6]} intensity={0.5} color="#08352c" />
      <group position={[offsetX,0,0]}>
        <Core />
        <OrbitOracles />
        <GrowthHalo />
        <RootVeins />
        <CarbonFlux />
      </group>
      <ParallaxCamera />
      <EffectComposer enableNormalPass={false}>
        <Bloom mipmapBlur intensity={1.05} luminanceThreshold={0.18} luminanceSmoothing={0.22} radius={0.85} />
      </EffectComposer>
    </Canvas>
  );
}

export default EcoGenesisHeroCanvas;
