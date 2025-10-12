"use client";
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../components/auth/AuthProvider';
import { fetchWalletChallenge, linkEmailRequest, linkEmailVerify, linkWallet, linkGoogleInitUrl, updateCurrentUser, deleteAccount } from '../../lib/authClient';
import { connectPetra, signMessagePetra } from '../../lib/petra';
import ThemeToggle from '../../components/ThemeToggle';

export default function ProfilePage(){
  const { user, methods, token, refresh, logout } = useAuth();
  const [username, setUsername] = useState(user?.username || '');
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string| null>(null);

  useEffect(()=>{ setUsername(user?.username || ''); }, [user?.username]);

  const canSave = useMemo(()=> token && username && username !== (user?.username||'') , [token, username, user?.username]);

  if(!token){
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-2xl font-semibold mb-4">Profile</h1>
        <p>Please <Link className="underline" href="/auth/login">login</Link> to view your profile.</p>
      </div>
    );
  }

  async function onSave(){
    if(!token) return;
    try {
      setSaving(true); setStatusMsg(null);
      await updateCurrentUser(token, { username });
      setStatusMsg('Saved');
      await refresh();
    } catch(e:any){ setStatusMsg(e?.message||'Failed'); }
    finally{ setSaving(false); }
  }

  async function onLinkEmail(){
    const email = prompt('Enter email to link');
    if(!email || !token) return;
    try {
      await linkEmailRequest(token, email);
      const code = prompt('Enter the OTP code sent to '+email);
      if(!code) return;
      await linkEmailVerify(token, email, code);
      setStatusMsg('Email linked');
      await refresh();
    } catch(e:any){ alert(e?.message||'Failed to link email'); }
  }

  async function onLinkGoogle(){
    if(!token) return;
    const url = linkGoogleInitUrl(token);
    window.location.href = url; // after callback, we expect redirect to /auth/link-success
  }

  async function onLinkWallet(){
    if(!token) return;
    try {
      const provider = await connectPetra();
      const challenge = await fetchWalletChallenge();
      const message = challenge?.message || `Miko Auth :: ${Date.now().toString(36)}`;
      const { signature, full } = await signMessagePetra(message);
      await linkWallet(token, { address: provider.address, publicKey: (full?.publicKeyHex||full?.publicKey || full?.publicKeyBytes), network:'aptos' });
      setStatusMsg('Wallet linked');
      await refresh();
    } catch(e:any){ alert(e?.message||'Failed to link Petra'); }
  }

  async function onDelete(){
    if(!token) return;
    if(!confirm('This will permanently delete your account. Continue?')) return;
    try {
      await deleteAccount(token);
      await logout();
      window.location.href = '/';
    } catch(e:any){ alert(e?.message||'Failed to delete account'); }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">Your Profile</h1>
      {statusMsg ? <div className="mb-4 text-sm text-emerald-400">{statusMsg}</div> : null}

      <section className="mb-8 p-4 rounded-xl border border-neutral-800 bg-neutral-900/40">
        <h2 className="text-lg font-semibold mb-3">Account</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-neutral-400">Username</span>
            <input value={username} onChange={e=>setUsername(e.target.value)} className="px-3 py-2 rounded-md bg-neutral-800 border border-neutral-700 outline-none focus:ring-2 focus:ring-emerald-500/40" placeholder="yourname" />
          </label>
          <div className="flex items-end">
            <button onClick={onSave} disabled={!canSave || saving} className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50">Save</button>
          </div>
        </div>
        <div className="mt-3 text-sm text-neutral-400">Role: {user?.role}</div>
      </section>

      <section className="mb-8 p-4 rounded-xl border border-neutral-800 bg-neutral-900/40">
        <h2 className="text-lg font-semibold mb-3">Linked methods</h2>
        <div className="flex flex-wrap gap-2">
          <Badge active={!!methods?.google}>Google</Badge>
          <Badge active={!!methods?.passwordless}>Email OTP</Badge>
          <Badge active={(methods?.wallets?.length||0)>0}>Wallet</Badge>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={onLinkGoogle} className="nav-btn">Link Google</button>
          <button onClick={onLinkEmail} className="nav-btn">Link Email</button>
          <button onClick={onLinkWallet} className="nav-btn">Link Petra Wallet</button>
        </div>
      </section>

      <section className="mb-8 p-4 rounded-xl border border-neutral-800 bg-neutral-900/40">
        <h2 className="text-lg font-semibold mb-3">Preferences</h2>
        <ThemeToggle variant="square" />
      </section>

      <section className="p-4 rounded-xl border border-red-900 bg-red-950/30">
        <h2 className="text-lg font-semibold mb-3 text-red-300">Danger zone</h2>
        <div className="flex flex-wrap gap-3">
          <button onClick={()=>{ void logout(); }} className="px-4 py-2 rounded-md bg-neutral-800 hover:bg-neutral-700">Sign out</button>
          <button onClick={onDelete} className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-500">Delete account</button>
        </div>
      </section>
    </div>
  );
}

function Badge({ active, children }:{ active:boolean; children:React.ReactNode }){
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${active? 'bg-emerald-600 text-neutral-900':'bg-neutral-800 text-neutral-400'}`}>{children}</span>
  );
}
