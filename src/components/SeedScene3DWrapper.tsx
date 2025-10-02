/// <reference types="react" />
"use client";
import dynamic from 'next/dynamic';
import React, { Component, ErrorInfo } from 'react';

interface ErrorBoundaryProps { children: React.ReactNode; }
interface ErrorBoundaryState { hasError: boolean; msg?: string; }

class SceneErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState>{
  constructor(props: ErrorBoundaryProps){ super(props); this.state = { hasError:false }; }
  static getDerivedStateFromError(err:Error): ErrorBoundaryState { return { hasError:true, msg: err.message }; }
  componentDidCatch(error:Error, info:ErrorInfo){
    // eslint-disable-next-line no-console
    console.error('[SeedScene3D] runtime error boundary caught:', error, info);
  }
  render(){
    if(this.state.hasError){
      return <div className="w-full h-full flex flex-col items-center justify-center text-[10px] text-red-500/80 bg-neutral-950/70">3D init failed<br/> {this.state.msg}</div>;
    }
    return this.props.children;
  }
}

const SeedScene3D = dynamic(async () => {
  try {
    const m = await import('./SeedScene3D');
    // eslint-disable-next-line no-console
    console.log('[SeedScene3D] module loaded', { reactVersion: (React as any).version, keys: Object.keys(React).length });
    return m;
  } catch(err){
    // eslint-disable-next-line no-console
    console.error('[SeedScene3D] dynamic import failure', err);
    throw err;
  }
}, { ssr:false, loading: () => <div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-600">Initializing 3D…</div> });

export default function SeedScene3DWrapper(){
  return <SceneErrorBoundary><SeedScene3D /></SceneErrorBoundary>;
}
