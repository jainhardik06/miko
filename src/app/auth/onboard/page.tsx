import loadDynamic from 'next/dynamic';

// Load client component only on client; disable SSR so build doesn't evaluate useSearchParams
const OnboardClient = loadDynamic(()=>import('./onboardClient'), { ssr:false, loading: ()=> <div style={{padding:'3rem'}}>Loading…</div> });

export const dynamic = 'force-dynamic';

export default function AuthOnboard(){
  return <OnboardClient />;
}

