"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EcoGenesisHeroCanvas } from "../components/narrative/EcoGenesisHeroCanvas";
import { VerticalSectionNav } from "../components/VerticalSectionNav";
import { ImpactMetrics } from "../components/ImpactMetrics";
import useReducedMotion from "../lib/useReducedMotion";
import { VerificationSceneFull } from "../components/narrative/VerificationScene";
import { StreamingSceneFull } from "../components/narrative/StreamingScene";
import { NetworkSceneFull } from "../components/narrative/NetworkScene";


function useResponsiveOffset(base:number){
  const [val,setVal]=useState(base);
  useEffect(()=>{
    function recalc(){
      const w=window.innerWidth;
      if(w<640) setVal(base*0.4); else if(w<900) setVal(base*0.65); else if(w<1200) setVal(base*0.85); else setVal(base);
    }
    recalc();
    window.addEventListener('resize',recalc);
    return ()=>window.removeEventListener('resize',recalc);
  },[base]);
  return val;
}

export default function LandingPage(){
  const heroOffset = useResponsiveOffset(4.5);
  const featureOffset = useResponsiveOffset(4.5);
  const reducedMotion = useReducedMotion();
  useEffect(()=>{
    if(reducedMotion) document.documentElement.classList.add('reduced-motion');
    else document.documentElement.classList.remove('reduced-motion');
  },[reducedMotion]);
  useEffect(() => {
  const sections = Array.from(document.querySelectorAll("main section"));
  const transitions = Array.from(document.querySelectorAll('.section-transition')) as HTMLElement[];
    const revealTargets = Array.from(document.querySelectorAll(".reveal-seed"));
    const activeObserver = new IntersectionObserver((entries) => {
      let topMost: IntersectionObserverEntry | null = null;
      entries.forEach(e => {
        if(e.isIntersecting){
          if(!topMost || e.boundingClientRect.top < topMost.boundingClientRect.top){
            topMost = e;
          }
        }
      });
      sections.forEach(sec => sec.removeAttribute('data-active'));
      if(topMost) {
        const anyEntry: any = topMost;
        const el = anyEntry.target as HTMLElement | undefined;
        if(el) el.setAttribute('data-active','true');
      }
    }, { root: null, threshold: [0.35, 0.55] });

    sections.forEach(s => activeObserver.observe(s));

    const transitionObserver = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{
        if(e.isIntersecting && e.target instanceof HTMLElement){
          e.target.classList.add('in-view');
          transitionObserver.unobserve(e.target);
        }
      });
    }, { threshold:0.25 });
    transitions.forEach(t=>transitionObserver.observe(t));

    const revealObserver = new IntersectionObserver((entries: IntersectionObserverEntry[]) => {
      entries.forEach(e => {
        if(e.isIntersecting && e.target instanceof HTMLElement){
          e.target.classList.add('is-visible');
          revealObserver.unobserve(e.target);
        }
      });
    }, { threshold: 0.3 });
    revealTargets.forEach(t => revealObserver.observe(t));

    return () => {
  activeObserver.disconnect();
  transitionObserver.disconnect();
      revealObserver.disconnect();
    };
  }, []);

  return (
    <main className="w-full min-h-screen flex flex-col overflow-hidden">
      <VerticalSectionNav />
      {/* HERO FULL-BLEED CANVAS BACKDROP */}
      <section id="hero" className="relative w-full pt-28 md:pt-32 pb-32 overflow-visible">
        {/* Canvas absolutely fills hero; no clipping so geometry can extend under text */}
        <div className="absolute inset-0 -z-10 pointer-events-none">
              <EcoGenesisHeroCanvas offsetX={heroOffset} />
        </div>
        <div className="mx-auto max-w-6xl px-6">
          <div className="relative text-left max-w-2xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-tight reveal-seed">
              <span className="block">Turn India&apos;s</span>
              <span className="block">
                <span className="text-emerald-400/90">Green</span>{' '}
                <span className="hero-highlight">Cover</span>{' '}
                <span className="text-emerald-400/90">into</span>
              </span>
              <span className="block">Digital Gold</span>
            </h1>
            <p className="mt-6 max-w-lg text-sm md:text-base text-neutral-300/90 leading-relaxed reveal-seed reveal-delay-100">
              Tokenize ecological assets, stream carbon credits on-chain, and build a transparent offset marketplace grounded in cryptographic verifiability.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link href="/marketplace" className="px-6 py-3 rounded-md bg-emerald-600 hover:bg-emerald-500 text-sm font-medium shadow-lg shadow-emerald-600/30 transition">Launch App</Link>
              <Link href="/how-it-works" className="px-6 py-3 rounded-md bg-neutral-800/70 hover:bg-neutral-700 text-sm font-medium border border-neutral-700 backdrop-blur-md">Learn More</Link>
            </div>
            <div className="mt-14 flex flex-wrap items-center gap-x-10 gap-y-6 opacity-70 text-[10px] tracking-wider font-medium reveal-seed reveal-delay-200">
              <span className="inline-flex items-center gap-1"> <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> ON-CHAIN MRV </span>
              <span className="inline-flex items-center gap-1"> TRANSPARENT CREDITS </span>
              <span className="inline-flex items-center gap-1"> FARMER FIRST </span>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE BLOCKS */}
      <section id="annadata" className="relative py-40 overflow-hidden">
  <VerificationSceneFull offsetX={featureOffset} />
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="max-w-xl">
            <h2 className="text-3xl font-semibold mb-5 reveal-seed">Empower the Annadata</h2>
            <p className="text-sm text-neutral-300/90 leading-relaxed reveal-seed reveal-delay-100">Onboard farmers with verifiable ecological data. Each approved tree becomes a cryptographic accrual point for carbon credit generation.</p>
          </div>
        </div>
      </section>
      <section id="tokenize" className="relative py-40 overflow-hidden">
  <StreamingSceneFull offsetX={-featureOffset} />
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="max-w-xl md:ml-auto text-left md:text-left">
            <h2 className="text-3xl font-semibold mb-5 reveal-seed">Tokenize & Stream</h2>
            <p className="text-sm text-neutral-300/90 leading-relaxed reveal-seed reveal-delay-100">Approved TreeNFTs stream CCT over time. Farmers retain ownership while liquidity and offset demand grow organically.</p>
          </div>
        </div>
      </section>
      <section id="network" className="relative py-40 overflow-hidden">
  <NetworkSceneFull offsetX={featureOffset} />
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="max-w-xl">
            <h2 className="text-3xl font-semibold mb-5 reveal-seed">Network Effects</h2>
            <p className="text-sm text-neutral-300/90 leading-relaxed reveal-seed reveal-delay-100">A mesh of ecological assets underpins transparent offset markets— enabling capital efficiency, composability, and public verifiability.</p>
          </div>
        </div>
      </section>
      <section id="impact" className="relative py-44" aria-labelledby="impact-heading">
        <div className="relative max-w-6xl mx-auto px-6 section-transition">
          <div className="max-w-2xl mb-10">
            <h2 id="impact-heading" className="text-3xl font-semibold mb-5">Protocol Impact</h2>
            <p className="text-sm text-neutral-300/90 leading-relaxed">Early momentum indicators from pilot regions demonstrating verifiable ecological asset onboarding and transparent credit streaming. (Sample data placeholders.)</p>
          </div>
          <ImpactMetrics />
        </div>
      </section>
  {/* CTA Section */}
  <section className="border-t border-neutral-800/60 bg-neutral-950/60 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-6 py-24 text-center">
          <h2 className="text-3xl font-semibold tracking-tight">Build an Atmanirbhar Green Economy</h2>
          <p className="mt-4 text-sm text-neutral-400 max-w-2xl mx-auto">Join us in creating a transparent, farmer-first regenerative finance substrate. Miko is a living protocol evolving with open data and cryptographic integrity.</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/about" className="px-6 py-3 rounded-md bg-neutral-800/70 hover:bg-neutral-700 text-sm font-medium border border-neutral-700">Why Miko</Link>
            <Link href="/marketplace" className="px-6 py-3 rounded-md bg-emerald-600 hover:bg-emerald-500 text-sm font-medium shadow shadow-emerald-600/30">Launch dApp</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
