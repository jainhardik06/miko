/// <reference types="react" />
"use client";
import dynamic from 'next/dynamic';

const HeroSeedScene = dynamic(()=> import('./HeroSeedScene'), { ssr:false, loading: () => <div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-600">Loading 3D…</div>});

export default function HeroSeedSceneWrapper(){
  return <HeroSeedScene />;
}
