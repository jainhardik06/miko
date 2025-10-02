"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectWalletButton } from "./ConnectWallet";
import ThemeToggle from "./ThemeToggle";
import { useMikoStore } from "../state/store";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useState } from "react";

type SimpleLink = { label: string; href: string; cta?: boolean };
const mainButtons: SimpleLink[] = [
  { label: "Test Net", href: "/marketplace" },
  { label: "Docs", href: "/how-it-works" },
  { label: "Contact us", href: "/about", cta: true }
];
// Legacy informational links kept for mobile expansion
const secondaryLinks: SimpleLink[] = [
  { label: "Transparency", href: "/transparency" },
  { label: "Farmer", href: "/dashboard/farmer" },
  { label: "Industry", href: "/dashboard/industry" }
];

function SegButton({ link }: { link: SimpleLink }) {
  const pathname = usePathname();
  const active = pathname === link.href;
  return (
    <Link
      href={link.href}
      className={`nav-btn ${active ? 'active' : ''} ${link.cta ? 'cta' : ''}`}
    >{link.label}</Link>
  );
}

export function Navbar() {
  const { connected, connect, wallets } = useWallet();
  const account = useMikoStore(s=>s.account);
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 inset-x-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mt-4 nav-shell w-full items-center gap-8">
          {/* Left Brand Square */}
          <div className="flex items-center">
            <Link href="/" className="brand-badge flex items-center gap-2 font-semibold text-[18px] tracking-wide px-3 py-3 rounded-2xl">
            <span>Miko.</span>
            </Link>
          </div>
          {/* Center Buttons */}
          <div className="hidden md:flex flex-1 justify-center">
            <div className="nav-btn-group">
              {mainButtons.map(btn => <SegButton key={btn.href} link={btn} />)}
              {!connected && !account && (
                <button onClick={()=>{ const first = wallets?.[0]; if(first) connect(first.name); }} className="nav-btn cta">Login / Signup</button>
              )}
              {(connected || account) && (
                <ConnectWalletButton />
              )}
            </div>
          </div>
          {/* Right controls */}
            <div className="ml-auto hidden md:flex items-center pl-4">
              <ThemeToggle variant="square" />
            </div>
            <button onClick={()=>setOpen(o=>!o)} aria-label="Toggle menu" className="md:hidden ml-auto inline-flex items-center justify-center w-10 h-10 rounded-xl border border-neutral-700 text-neutral-400 hover:text-neutral-200 hover:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
        </div>
        {/* Mobile menu */}
        {open && (
          <div className="md:hidden mt-2 nav-shell flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              {mainButtons.map(btn => (
                <Link key={btn.href} href={btn.href} onClick={()=>setOpen(false)} className={`nav-btn ${btn.cta? 'cta':''}`}>{btn.label}</Link>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1">
              {secondaryLinks.map(s => (
                <Link key={s.href} href={s.href} onClick={()=>setOpen(false)} className="nav-btn text-[10px] py-2 px-2">{s.label}</Link>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between gap-4">
              <ThemeToggle variant="square" />
              {(!connected && !account) ? (
                <button onClick={()=>{ const first = wallets?.[0]; if(first) connect(first.name); setOpen(false); }} className="nav-btn cta text-[12px] py-3 px-4">Login / Signup</button>
              ) : <ConnectWalletButton />}
            </div>
          </div>
        )}
      </div>
      <div className="h-[92px]" />
    </header>
  );
}
