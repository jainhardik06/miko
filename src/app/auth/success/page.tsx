import loadDynamic from 'next/dynamic';
export const dynamic = 'force-dynamic';
const SuccessClient = loadDynamic(()=>import('./successClient'), { ssr:false, loading: ()=> <div style={{padding:'3rem'}}>Signing you in…</div> });
export default function AuthSuccess(){ return <SuccessClient />; }

