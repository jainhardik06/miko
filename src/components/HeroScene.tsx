"use client";
import { useEffect, useRef } from "react";

// Lightweight seed + particle orbit animation (no three.js) using Canvas 2D.
// Particles increase & brighten with scroll progress of first viewport height.

interface Particle { x:number; y:number; r:number; a:number; speed:number; orbit:number; baseOrbit:number; }

export default function HeroScene(){
  const canvasRef = useRef<HTMLCanvasElement|null>(null);
  const containerRef = useRef<HTMLDivElement|null>(null);

  useEffect(()=>{
    const canvas = canvasRef.current; if(!canvas) return;
    const ctx = canvas.getContext('2d',{ alpha:true }); if(!ctx) return;
    let width = canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    let height = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    const particles: Particle[] = [];
    const MAX = 140; // light weight
    for(let i=0;i<MAX;i++){
      const orbit = 20 + Math.random()*140;
      particles.push({ x:0,y:0,r:1+Math.random()*2,a:Math.random()*Math.PI*2,speed:0.001+Math.random()*0.003,orbit,baseOrbit:orbit });
    }
    let running = true; let last=performance.now();
    const seedPulse = { t:0 };
    function scrollProgress(){
      if(!containerRef.current) return 0;
      const rect = containerRef.current.getBoundingClientRect();
      const visible = Math.min(1, Math.max(0, 1 - rect.top / (window.innerHeight||1)));
      return visible; // 0 -> 1 first screen
    }
    function tick(now:number){
      if(!running || !canvas || !ctx) return; const dt = now-last; last=now; const prog = scrollProgress();
      if(width!==canvas.offsetWidth*window.devicePixelRatio || height!==canvas.offsetHeight*window.devicePixelRatio){
        width = canvas.width = canvas.offsetWidth*window.devicePixelRatio; 
        height = canvas.height = canvas.offsetHeight*window.devicePixelRatio; 
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
      ctx.clearRect(0,0,canvas.width,canvas.height);
      const cx = canvas.width/2, cy = canvas.height/2;
      // Seed glow
      seedPulse.t += dt*0.002;
      const glowR = 28 + Math.sin(seedPulse.t)*4 + prog*24;
      const gradient = ctx.createRadialGradient(cx,cy,4,cx,cy,glowR*window.devicePixelRatio);
      gradient.addColorStop(0, `rgba(0,255,180,${0.55+prog*0.3})`);
      gradient.addColorStop(1, 'rgba(0,40,30,0)');
      ctx.beginPath();
      ctx.fillStyle = gradient;
      ctx.arc(cx,cy,glowR*window.devicePixelRatio,0,Math.PI*2);
      ctx.fill();
      // Core seed
      ctx.beginPath();
      ctx.fillStyle = '#0fe7aa';
      ctx.shadowBlur = 18; ctx.shadowColor = '#0fe7aa';
      ctx.arc(cx,cy,(8+prog*4)*window.devicePixelRatio,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
      const visibleCount = Math.floor(prog * particles.length);
      for(let i=0;i<visibleCount;i++){
        const p = particles[i];
        p.a += p.speed * dt * (0.06 + prog*1.2);
        p.orbit = p.baseOrbit * (0.4 + prog*1.1);
        const px = cx + Math.cos(p.a)*p.orbit*window.devicePixelRatio;
        const py = cy + Math.sin(p.a)*p.orbit*window.devicePixelRatio;
        ctx.beginPath();
        ctx.fillStyle = `rgba(0,255,200,${0.15 + prog*0.6})`;
        ctx.arc(px,py,p.r*window.devicePixelRatio,0,Math.PI*2);
        ctx.fill();
      }
      requestAnimationFrame(tick);
    }
    const raf = requestAnimationFrame(tick);
    function onVis(){ running = !document.hidden; if(running) { last=performance.now(); requestAnimationFrame(tick);} }
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('resize', ()=>{ /* will resize next frame */ });
    return ()=>{ running=false; cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onVis); };
  },[]);

  return (
    <div ref={containerRef} className="relative w-full h-full flex items-center justify-center">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      {/* Fallback seed text (hidden visually for SEO) */}
      <span className="sr-only">Glowing seed of potential with orbiting particles</span>
    </div>
  );
}
