/// <reference types="react" />
"use client";
import dynamic from 'next/dynamic';

const MinimalR3FProbe = dynamic(() => import('./MinimalR3FProbe'), { ssr:false, loading: () => <div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-600">Loading R3F Probe…</div> });

export default function MinimalR3FProbeWrapper(){
  return <MinimalR3FProbe />;
}
