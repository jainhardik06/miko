"use client";
import { useEffect, useRef } from 'react';

interface Metric { label:string; value:number; suffix?:string; }
const METRICS: Metric[] = [
  { label:'Trees Onboarded', value:12840 },
  { label:'CCT Streamed', value:421000, suffix:' +' },
  { label:'Validators', value:27 },
  { label:'Avg Verification Time (s)', value:46 }
];

export function ImpactMetrics(){
  const ref = useRef<HTMLDivElement|null>(null);
  useEffect(()=>{
    if(!ref.current) return;
    const nums = Array.from(ref.current.querySelectorAll('[data-target]')) as HTMLElement[];
    let animated=false;
    const obs = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{
        if(e.isIntersecting && !animated){
          animated=true;
          nums.forEach(el=>{
            const target = Number(el.dataset.target||'0');
            const dur = 1400 + Math.random()*800;
            const start = performance.now();
            function tick(now:number){
              const t = Math.min(1,(now-start)/dur);
              const eased = 1 - Math.pow(1-t,3);
              const val = Math.floor(eased*target).toLocaleString();
              el.textContent = val;
              if(t<1) requestAnimationFrame(tick); else el.classList.add('metric-finished');
            }
            requestAnimationFrame(tick);
          });
        }
      });
    }, { threshold:0.35 });
    obs.observe(ref.current);
    return ()=> obs.disconnect();
  },[]);
  return (
    <div ref={ref} className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 mt-12">
      {METRICS.map(m=> (
        <div key={m.label} className="relative p-6 rounded-2xl border border-neutral-800/60 bg-neutral-900/40 backdrop-blur-md overflow-hidden group">
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-[radial-gradient(circle_at_30%_30%,rgba(15,231,170,0.12),transparent_70%)]" />
          <div className="text-3xl font-semibold tracking-tight text-emerald-300 mb-2 flex items-baseline gap-1"><span data-target={m.value}>0</span>{m.suffix && <span className="text-sm font-medium text-emerald-400/70">{m.suffix}</span>}</div>
          <div className="text-[12px] uppercase tracking-wide text-neutral-400 font-medium">{m.label}</div>
        </div>
      ))}
    </div>
  );
}

export default ImpactMetrics;