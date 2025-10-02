"use client";
import { useEffect, useState } from 'react';

interface SectionMeta { id:string; label:string; }

const SECTIONS: SectionMeta[] = [
  { id: 'hero', label: 'Hero' },
  { id: 'annadata', label: 'Verify' },
  { id: 'tokenize', label: 'Stream' },
  { id: 'network', label: 'Network' },
  { id: 'impact', label: 'Impact' }
];

export function VerticalSectionNav(){
  const [active, setActive] = useState('hero');
  const [mounted, setMounted] = useState(false);
  useEffect(()=>{ setMounted(true); },[]);
  useEffect(()=>{
    const obs = new IntersectionObserver((entries)=>{
      let best: IntersectionObserverEntry | null = null;
      entries.forEach(e=>{ if(e.isIntersecting){ if(!best || e.boundingClientRect.top < best.boundingClientRect.top) best = e; }});
  if(best){ const tgt = (best as IntersectionObserverEntry).target as HTMLElement; if(tgt && tgt.id) setActive(tgt.id); }
    }, { threshold:[0.35,0.55] });
    SECTIONS.forEach(s=>{ const el = document.getElementById(s.id); if(el) obs.observe(el); });
    return ()=> obs.disconnect();
  },[]);

  if(!mounted) return null;
  return (
    <nav aria-label="Section navigation" className="fixed top-1/2 -translate-y-1/2 right-6 z-40 hidden lg:flex flex-col gap-5">
      {SECTIONS.map(s=>{
        const is = active===s.id;
        return (
          <button key={s.id}
            onClick={()=>{
              const el=document.getElementById(s.id); if(el){ el.scrollIntoView({ behavior:'smooth', block:'start' }); }
            }}
            aria-current={is? 'true': undefined}
            aria-label={`Jump to ${s.label} section`}
            className={`relative group w-4 h-4 rounded-full transition-colors duration-500 ${is? 'bg-emerald-400 shadow-[0_0_0_4px_rgba(16,255,200,0.15)]':'bg-neutral-600/40 hover:bg-neutral-500/60'}`}
          >
            <span className="absolute left-1/2 -translate-x-full -translate-y-1/2 -ml-5 opacity-0 group-hover:opacity-100 transition-opacity text-[11px] tracking-wide font-medium pointer-events-none select-none bg-neutral-900/70 px-2 py-1 rounded-md border border-neutral-700/60 text-neutral-200">
              {s.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export default VerticalSectionNav;