"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MODULE_ADDRESS, getConfig } from "@/config";
import { connectPetra } from "@/lib/petra";
import { verifyTree, type VerifyResult, VerifyApiError } from "@/lib/api/verify";
import { SPECIES_LIST } from "@/lib/speciesData";

type Step =
  | "intro"
  | "permissions"
  | "capture"
  | "form"
  | "processing"
  | "confirm"
  | "minting"
  | "success";

type TreeForm = {
  name: string;
  species: string; // common name
  speciesScientific?: string; // scientific name
  otherSpecies?: string;
  age?: number | "";
  diseases?: string;
  heightM?: number | "";
  girthCm?: number | "";
  details?: string;
  diseaseEntries: Array<{ id: string; name: string; appearance: string; photoDataUrl?: string }>
};

type LiveSensors = {
  lat?: number;
  lon?: number;
  heading?: number; // degrees 0-360
};

function classNames(...s: (string | false | null | undefined)[]) {
  return s.filter(Boolean).join(" ");
}

function toHexUtf8(input: string) {
  const bytes = new TextEncoder().encode(input);
  return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function toBase64Utf8(input: string) {
  // Handles UTF-8 properly in browser
  return btoa(unescape(encodeURIComponent(input)));
}

function isValidHexAddress(addr: string) {
  // Accept addresses like 0x1, 0xa550c18, or full-length. Petra/Aptos SDK will normalize, but
  // the wallet simulator requires only hex characters after 0x. We'll also ensure even length.
  if (typeof addr !== "string") return false;
  if (!addr.startsWith("0x")) return false;
  const hex = addr.slice(2);
  if (!/^[0-9a-fA-F]*$/.test(hex)) return false;
  return hex.length > 0; // do not enforce even here; SDK pads if needed
}

// Minimal helper to read APT balance (in octas) for the connected account so we can cap gas below balance
async function fetchAptBalanceOctas(address: string): Promise<bigint | null> {
  try {
    const net = (process.env.NEXT_PUBLIC_APTOS_NETWORK || 'devnet').toLowerCase();
    const base = net.includes('main')
      ? 'https://fullnode.mainnet.aptoslabs.com'
      : net.includes('test')
        ? 'https://fullnode.testnet.aptoslabs.com'
        : 'https://fullnode.devnet.aptoslabs.com';
    const type = encodeURIComponent('0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>');
    const resp = await fetch(`${base}/v1/accounts/${address}/resource/${type}`, { cache: 'no-store' });
    if (!resp.ok) return null;
    const json = await resp.json();
    const val = json?.data?.coin?.value;
    if (val == null) return null;
    return BigInt(String(val));
  } catch {
    return null;
  }
}

function getFullnodeBase(): string {
  const net = (process.env.NEXT_PUBLIC_APTOS_NETWORK || 'devnet').toLowerCase();
  if (net.includes('main')) return 'https://fullnode.mainnet.aptoslabs.com';
  if (net.includes('test')) return 'https://fullnode.testnet.aptoslabs.com';
  return 'https://fullnode.devnet.aptoslabs.com';
}

// Preflight: verify contract resources exist under the admin/module address. Returns an error message if any missing.
async function checkContractInitialized(adminAddr: string): Promise<string | null> {
  try {
    const base = getFullnodeBase();
    const types = [
      `${MODULE_ADDRESS}::roles::Roles`,
      `${MODULE_ADDRESS}::cct::MintCap`,
      `${MODULE_ADDRESS}::tree_nft::Trees`,
      `${MODULE_ADDRESS}::tree_requests::Requests`,
      `${MODULE_ADDRESS}::marketplace::Registry`,
    ];
    const missing: string[] = [];
    for (const t of types) {
      const url = `${base}/v1/accounts/${adminAddr}/resource/${encodeURIComponent(t)}`;
      const resp = await fetch(url, { cache: 'no-store' });
      if (!resp.ok) missing.push(t);
    }
    if (missing.length) {
      return `Contract not initialized. Missing resources: ${missing.join(', ')}. Ask the admin (${adminAddr}) to run init: roles::init, cct::init, tree_nft::init, tree_requests::init, marketplace::init(fee_bps).`;
    }
    return null;
  } catch {
    // On network error, skip blocking but allow proceeding (wallet may still succeed)
    return null;
  }
}

function prettyHeading(deg?: number) {
  if (deg == null || isNaN(deg)) return "-";
  const dirs = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];
  const idx = Math.round(deg / 22.5) % 16;
  return `${dirs[idx]} (${Math.round(deg)}°)`;
}

export default function MintPage() {
  const [step, setStep] = useState<Step>("intro");
  const [videoReady, setVideoReady] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [nextRetryIn, setNextRetryIn] = useState<number | null>(null);
  const [sensors, setSensors] = useState<LiveSensors>({});
  const [watchId, setWatchId] = useState<number | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<null | { state: 'idle'|'running'|'passed'|'rejected'|'flagged'; message?: string }>(null);
  const [verifyDetails, setVerifyDetails] = useState<VerifyResult | null>(null);
  const [form, setForm] = useState<TreeForm>({ name: "", species: "", speciesScientific: "", otherSpecies: "", age: "", heightM: "", girthCm: "", diseases: "", details: "", diseaseEntries: [] });
  const [estimate, setEstimate] = useState<number | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

  const speciesCommonOptions = useMemo(() =>
    [...SPECIES_LIST].sort((a,b)=> a.commonName.localeCompare(b.commonName)), []);
  const speciesScientificOptions = useMemo(() =>
    [...SPECIES_LIST].sort((a,b)=> a.scientificName.localeCompare(b.scientificName)), []);

  // Clean up media stream on unmount
  useEffect(() => {
    return () => {
      stopVideo();
      // Also clear any sensor listeners/watchers on unmount
      try {
        if (watchId != null) navigator.geolocation.clearWatch(watchId);
      } catch {}
      window.removeEventListener("deviceorientation", onDeviceOrientation as any, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Smooth-scroll this page and restore on unmount
  useEffect(() => {
    const prev = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "smooth";
    return () => {
      document.documentElement.style.scrollBehavior = prev;
    };
  }, []);

  // Prevent background scrolling when any modal step is active
  useEffect(() => {
    const prev = document.body.style.overflow;
    if (step !== "intro") {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = prev;
    };
  }, [step]);

  const onDeviceOrientation = useCallback((ev: any) => {
    // iOS provides webkitCompassHeading (0 = North, clockwise)
    const heading = typeof ev.webkitCompassHeading === "number" ? ev.webkitCompassHeading : (typeof ev.alpha === "number" ? (360 - ev.alpha) % 360 : undefined);
    setSensors((s) => ({ ...s, heading }));
  }, []);

  async function requestOrientationPermissionIfNeeded() {
    try {
      const AnyDeviceOrientation: any = (window as any).DeviceOrientationEvent;
      if (AnyDeviceOrientation && typeof AnyDeviceOrientation.requestPermission === "function") {
        const res = await AnyDeviceOrientation.requestPermission();
        if (res !== "granted") throw new Error("Compass permission denied");
      }
    } catch (e) {
      // Non iOS or no permission API; continue best-effort
    }
  }

  const startVideo = useCallback(async (preferredFacing?: "environment" | "user") => {
    const facing = preferredFacing ?? cameraFacing;
    setStreamError(null);
    setVideoReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try { await videoRef.current.play(); } catch {}
      }
      setTimeout(() => setVideoReady(Boolean(videoRef.current && (videoRef.current.videoWidth || 0) > 0)), 200);
    } catch (e: any) {
      // Fallback: try opposite facing if back camera not available
      if (facing === "environment") {
        try {
          const altStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: "user" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
          mediaStreamRef.current = altStream;
          setCameraFacing("user");
          setStreamError("Back camera unavailable, switched to front camera.");
          if (videoRef.current) {
            videoRef.current.srcObject = altStream;
            try { await videoRef.current.play(); } catch {}
          }
          setTimeout(() => setVideoReady(Boolean(videoRef.current && (videoRef.current.videoWidth || 0) > 0)), 200);
          return;
        } catch {}
      }
      // Final fallback: let the browser choose
      try {
        const anyStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        mediaStreamRef.current = anyStream;
        setStreamError("Using default camera.");
        if (videoRef.current) {
          videoRef.current.srcObject = anyStream;
          try { await videoRef.current.play(); } catch {}
        }
        setTimeout(() => setVideoReady(Boolean(videoRef.current && (videoRef.current.videoWidth || 0) > 0)), 200);
      } catch (e3: any) {
        setStreamError(e3?.message || "Unable to access camera");
        setVideoReady(false);
      }
    }
  }, [cameraFacing]);

  const stopVideo = useCallback(() => {
    const ms = mediaStreamRef.current;
    if (ms) {
      ms.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      try { videoRef.current.pause(); } catch {}
      videoRef.current.srcObject = null;
    }
    setVideoReady(false);
  }, []);

  const clearSensors = useCallback(() => {
    try {
      if (watchId != null) {
        navigator.geolocation.clearWatch(watchId);
      }
    } catch {}
    setWatchId(null);
    window.removeEventListener("deviceorientation", onDeviceOrientation as any, true);
  }, [onDeviceOrientation, watchId]);

  const beginCapture = useCallback(async () => {
    setError(null);
    // Request sensors first
    try {
      // Request Geolocation
      const id = navigator.geolocation.watchPosition(
        (pos) => setSensors((s) => ({ ...s, lat: pos.coords.latitude, lon: pos.coords.longitude })),
        () => {},
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
      );
      setWatchId(id);
    } catch {}
    // Orientation
    await requestOrientationPermissionIfNeeded();
    window.addEventListener("deviceorientation", onDeviceOrientation as any, true);
    // Move to capture first so <video> mounts, then start camera
    setStep("capture");
    setTimeout(() => { void startVideo(); }, 0);
  }, [onDeviceOrientation, startVideo]);

  const handleSnap = useCallback(() => {
    setError(null);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if ((video.videoWidth || 0) === 0 || (video.videoHeight || 0) === 0){
      setError("Camera not ready yet. Please wait a moment and try again.");
      return;
    }
    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedDataUrl(dataUrl);
    // Move to form step (gated by AI verify which runs immediately)
    setStep("form");
    setVerifyStatus({ state: 'running' });
  }, []);

  // Ensure stream starts when entering capture step (in case previous start failed)
  useEffect(()=>{
    if(step === "capture"){
      const v = videoRef.current as HTMLVideoElement | null;
      const src = mediaStreamRef.current;
      if(!src){
        void startVideo();
      } else if (v) {
        if (v.srcObject !== src) v.srcObject = src;
        try { v.play(); } catch {}
        if(v.videoWidth === 0 || v.videoHeight === 0){
          v.onloadedmetadata = () => setVideoReady((v.videoWidth||0) > 0 && (v.videoHeight||0) > 0);
        } else {
          setVideoReady(true);
        }
      }
    }
  }, [step, startVideo]);

  const attemptAttachOrStart = useCallback(async () => {
    const v = videoRef.current;
    const ms = mediaStreamRef.current;
    if (v && ms) {
      if (v.srcObject !== ms) v.srcObject = ms;
      try { await v.play(); } catch {}
      setTimeout(() => setVideoReady((v.videoWidth || 0) > 0 && (v.videoHeight || 0) > 0), 200);
      if ((v.videoWidth || 0) > 0 && (v.videoHeight || 0) > 0) return;
    }
    await startVideo();
  }, [startVideo]);

  // Retry/backoff while waiting for camera readiness
  useEffect(() => {
    // Clear timers helper
    const clearTimers = () => {
      if (retryTimeoutRef.current) { clearTimeout(retryTimeoutRef.current); retryTimeoutRef.current = null; }
      if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null; }
      setNextRetryIn(null);
    };

    if (step !== "capture" || videoReady) {
      clearTimers();
      return;
    }

    const delay = Math.min(8000, 1500 * Math.pow(2, retryAttempt));
    let remaining = Math.ceil(delay / 1000);
    setNextRetryIn(remaining);
    countdownIntervalRef.current = window.setInterval(() => {
      remaining -= 1;
      setNextRetryIn(Math.max(0, remaining));
      if (remaining <= 0 && countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    }, 1000);
    retryTimeoutRef.current = window.setTimeout(async () => {
      await attemptAttachOrStart();
      setRetryAttempt((a) => a + 1);
    }, delay);

    return () => clearTimers();
  }, [step, videoReady, retryAttempt, attemptAttachOrStart]);

  const flipCamera = useCallback(async () => {
    const next = cameraFacing === "environment" ? "user" : "environment";
    setCameraFacing(next);
    setVideoReady(false);
    stopVideo();
    await startVideo(next);
    setRetryAttempt(0);
  }, [cameraFacing, startVideo, stopVideo]);

  const handleBackToCapture = useCallback(() => {
    setStep("capture");
  }, []);

  // Temporary: allow skipping AI verification to unblock the flow during development
  const skipVerification = useCallback(() => {
    setVerifyStatus({ state: 'passed', message: 'AI verification skipped' });
    setVerifyDetails({ status: 'PASSED', reason: 'skipped', degraded: true });
  }, []);

  const handleFormChange = useCallback(<K extends keyof TreeForm>(key: K, value: TreeForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  // Sync species dropdowns
  const handleSelectCommon = useCallback((common: string) => {
    const match = SPECIES_LIST.find(s => s.commonName === common);
    setForm(f => ({ ...f, species: common, speciesScientific: match?.scientificName || "" }));
  }, []);
  const handleSelectScientific = useCallback((scientific: string) => {
    const match = SPECIES_LIST.find(s => s.scientificName === scientific);
    setForm(f => ({ ...f, species: match?.commonName || "", speciesScientific: scientific }));
  }, []);

  // Disease inner form helpers
  const addDiseaseEntry = useCallback(() => {
    setForm(f => ({ ...f, diseaseEntries: [...f.diseaseEntries, { id: String(Date.now())+Math.random().toString(36).slice(2,7), name: "", appearance: "" }] }));
  }, []);
  const removeDiseaseEntry = useCallback((id: string) => {
    setForm(f => ({ ...f, diseaseEntries: f.diseaseEntries.filter(d => d.id !== id) }));
  }, []);
  const updateDiseaseField = useCallback((id: string, field: 'name'|'appearance', value: string) => {
    setForm(f => ({ ...f, diseaseEntries: f.diseaseEntries.map(d => d.id===id ? { ...d, [field]: value } : d) }));
  }, []);
  const updateDiseasePhoto = useCallback((id: string, file?: File) => {
    if(!file){
      setForm(f => ({ ...f, diseaseEntries: f.diseaseEntries.map(d => d.id===id ? { ...d, photoDataUrl: undefined } : d) }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setForm(f => ({ ...f, diseaseEntries: f.diseaseEntries.map(d => d.id===id ? { ...d, photoDataUrl: dataUrl } : d) }));
    };
    reader.readAsDataURL(file);
  }, []);

  const proceedProcessing = useCallback(() => {
    setError(null);
    setStep("processing");
    // We no longer need camera/sensors during analysis
    stopVideo();
    clearSensors();
    // Fake analysis delay, compute conservative heuristic estimate
    const h = Number(form.heightM || 0);
    const g = Number(form.girthCm || 0);
    const a = Number(form.age || 0);
    // If measurements are missing, fall back to a small baseline so users don't see huge numbers by mistake
    let est: number;
    if (h <= 0 || g <= 0) {
      // baseline from age only (very conservative)
      est = Math.max(1, Math.min(40, Math.round(0.02 * a + 8)));
    } else {
      // modest biomass proxy; keep a tight cap to prevent unrealistic spikes
      const biomass = h * (g / 100); // meters * meters (~area proxy)
      est = Math.max(1, Math.min(200, Math.round(8 * biomass + 0.02 * a)));
    }
    setTimeout(() => {
      setEstimate(est);
      setStep("confirm");
    }, 1400);
  }, [clearSensors, form.age, form.girthCm, form.heightM, stopVideo]);

  const metadataObject = useMemo(() => {
    const payload = {
      schema: "miko.tree-request@v1",
      capturedAt: Date.now(),
      location: sensors.lat && sensors.lon ? { lat: sensors.lat, lon: sensors.lon } : undefined,
      heading: sensors.heading,
      // NOTE: image will be uploaded off-chain; we link its URL in backend response
      form: {
        name: form.name,
        speciesCommon: form.species === "Other" ? form.otherSpecies || "Other" : form.species,
        speciesScientific: form.speciesScientific || undefined,
        age: form.age ? Number(form.age) : undefined,
        diseaseNotes: form.diseases || undefined,
        diseases: (form.diseaseEntries && form.diseaseEntries.length>0) ? form.diseaseEntries.map(d=> ({ name: d.name, appearance: d.appearance, photo: d.photoDataUrl })) : undefined,
        heightM: form.heightM ? Number(form.heightM) : undefined,
        girthCm: form.girthCm ? Number(form.girthCm) : undefined,
        details: form.details || undefined,
      },
      estimateCCT: estimate ?? undefined,
    } as const;
    return payload;
  }, [estimate, form.age, form.details, form.diseases, form.diseaseEntries, form.girthCm, form.heightM, form.name, form.otherSpecies, form.species, form.speciesScientific, sensors.heading, sensors.lat, sensors.lon]);

  const explorerUrl = useMemo(() => {
    const net = (process.env.NEXT_PUBLIC_APTOS_NETWORK || 'devnet').toLowerCase();
    const n = net.includes('main') ? 'mainnet' : net.includes('test') ? 'testnet' : 'devnet';
    return txHash ? `https://explorer.aptoslabs.com/txn/${txHash}?network=${n}` : null;
  }, [txHash]);

  const confirmAndMint = useCallback(async () => {
    setError(null);
    setStep("minting");
    try {
      // Guard: make sure module address is configured; otherwise Petra will throw
      if (!isValidHexAddress(MODULE_ADDRESS) || MODULE_ADDRESS.includes("ADMINPLACEHOLDER")) {
        throw new Error(
          "On-chain module address is not configured. Set NEXT_PUBLIC_MIKO_ADDRESS to your published package address (e.g., 0xabc...)."
        );
      }
      const { address } = await connectPetra();

      // Preflight contract initialization (roles/cct/tree_nft/tree_requests/marketplace)
      const initErr = await checkContractInitialized(MODULE_ADDRESS);
      if (initErr) {
        throw new Error(initErr);
      }

      // Upload image and metadata to backend; get compact metadata URL
      const api = getConfig().apiOrigin;
      const uploadResp = await fetch(`${api}/api/storage/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl: capturedDataUrl, metadata: metadataObject })
      });
      if (!uploadResp.ok) throw new Error(`Upload failed (${uploadResp.status})`);
      const { metadataUrl } = await uploadResp.json();
      if (!metadataUrl || typeof metadataUrl !== 'string') throw new Error('Upload did not return metadataUrl');

      // Submit only the URL as vector<u8> (UTF-8) to keep tx small
      const arg0 = toHexUtf8(metadataUrl);
      const payload: any = {
        type: "entry_function_payload",
        function: `${MODULE_ADDRESS}::tree_requests::submit`,
        type_arguments: [],
        arguments: [arg0],
      };
      const provider: any = (window as any).petra || (window as any).aptos;
      if (!provider?.signAndSubmitTransaction) throw new Error("Petra wallet not available");
      // Provide explicit gas options up-front to avoid wallet under-estimating below minimums.
      // Also cap maxGasAmount to a safe value based on the account's current APT balance to avoid faucet issues.
      const now = Math.floor(Date.now() / 1000);
  const GAS_PRICE = BigInt(100); // octas per unit; safe default for dev/test
  let maxGas = BigInt(200000);   // default ceiling

      // Preflight: cap gas budget by current balance (leave a small reserve)
      try {
        const bal = await fetchAptBalanceOctas(address);
        if (bal != null) {
          const reserve = BigInt(50000); // keep some dust in the account
          const affordable = (bal > reserve) ? (bal - reserve) / GAS_PRICE : BigInt(0);
          // Ensure we don't exceed affordable gas
          maxGas = affordable > BigInt(0) ? (affordable < maxGas ? affordable : maxGas) : BigInt(0);
          const MIN_UNITS = BigInt(2000); // network minimum units guard
          if (maxGas < MIN_UNITS) {
            throw new Error("Insufficient APT to cover minimum transaction fee. Please top up your Devnet/Testnet APT.");
          }
        }
      } catch (e: any) {
        // If balance check fails, proceed with defaults; wallet may still succeed if funded
      }

      const opts: any = {
        maxGasAmount: String(maxGas),
        gasUnitPrice: String(GAS_PRICE),
        expirationTimestampSecs: String(now + 600),
        // Estimation toggles used by Aptos SDK; set false so our overrides are used
        estimateGasUnitPrice: false,
        estimateMaxGasAmount: false,
        estimatePrioritizedGasUnitPrice: false,
      };
      let txRes: any;
      try {
        txRes = await provider.signAndSubmitTransaction(payload, opts);
      } catch (err: any) {
        // Final fallback: try with a higher max gas amount if balance allows; otherwise surface a clear error
        const opts2: any = { ...opts };
        try {
          const bal = await fetchAptBalanceOctas(address);
          if (bal != null) {
            const reserve = BigInt(50000);
            const affordable = (bal > reserve) ? (bal - reserve) / GAS_PRICE : BigInt(0);
            const bumped = affordable > BigInt(0) ? affordable : BigInt(0);
            if (bumped === BigInt(0)) throw new Error("Insufficient APT to cover transaction fee.");
            opts2.maxGasAmount = String(bumped);
          } else {
            // If unknown, bump to a safe upper bound
            opts2.maxGasAmount = "400000";
          }
        } catch (e: any) {
          throw new Error(e?.message || "Insufficient APT to cover transaction fee.");
        }
        txRes = await provider.signAndSubmitTransaction(payload, opts2);
      }
  const txh = txRes?.hash || txRes?.transactionHash || txRes?.hashHex || null;
      if (!txh) throw new Error("Wallet did not return a transaction hash");
      setTxHash(txh);
      // Optional: await confirmation
      try { await provider?.waitForTransaction?.(txh); } catch {}
      setStep("success");
    } catch (e: any) {
      setError(e?.message || "Failed to submit transaction");
      setStep("confirm");
    }
  }, [capturedDataUrl, metadataObject]);

  const startOver = useCallback(() => {
    setStep("intro");
    stopVideo();
    clearSensors();
    setCapturedDataUrl(null);
    setEstimate(null);
    setTxHash(null);
    setError(null);
  setForm({ name: "", species: "", speciesScientific: "", otherSpecies: "", age: "", heightM: "", girthCm: "", diseases: "", details: "", diseaseEntries: [] });
  }, [clearSensors, stopVideo]);

  const scrollToHowItWorks = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault?.();
    const el = document.getElementById("how-it-works");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
  <div className="w-full ">
      <div className="relative w-full">
        {/* Intro Section */}
        {step === "intro" && (
          <div className="relative w-full overflow-x-hidden">
            {/* Background glows */}
            <div className="pointer-events-none absolute inset-0 -z-10">
              <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full blur-3xl" style={{ background: "radial-gradient(closest-side, rgba(13,227,165,0.22), transparent)" }} />
              <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full blur-3xl" style={{ background: "radial-gradient(closest-side, rgba(0,200,255,0.18), transparent)" }} />
            </div>

            {/* Hero Section */}
            <section className="relative w-full min-h-[100svh] flex items-center">
              <div className="mx-auto w-full max-w-6xl px-6 md:px-8 py-6 md:py-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
                {/* Left copy */}
                <div>
                  
                  <h1 className="mt-4 text-4xl md:text-5xl font-extrabold leading-tight">
                    Tokenize a real tree into a trusted digital asset.
                  </h1>
                  <p className="mt-4 text-neutral-300 text-base md:text-lg max-w-prose">
                    Use your phone to capture your tree with live location and compass data. We’ll create a secure digital twin and submit it for validator approval.
                  </p>

                  {/* Permission chips */}
                  <div className="mt-6 flex flex-wrap gap-3 text-sm">
                    <div className="px-3 py-1 rounded-full border border-white/10 bg-white/5">Location</div>
                    <div className="px-3 py-1 rounded-full border border-white/10 bg-white/5">Camera</div>
                    <div className="px-3 py-1 rounded-full border border-white/10 bg-white/5">Compass</div>
                  </div>

                  <div className="mt-8 flex flex-wrap items-center gap-4">
                    <button
                      className="btn-primary px-8 py-4 rounded-xl text-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      style={{ boxShadow: "0 0 0 2px rgba(46,204,113,0.25), 0 0 28px rgba(46,204,113,0.25)" }}
                      onClick={() => setStep("permissions")}
                    >
                      Mint TreeNFT
                    </button>
                    <a href="#how-it-works" onClick={scrollToHowItWorks} className="btn-secondary px-6 py-4 rounded-xl">How it works</a>
                  </div>

                  {/* Mini stats */}
                  <div className="mt-8 grid grid-cols-3 max-w-md gap-3 text-center text-sm">
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <div className="text-emerald-300 font-semibold">Secure</div>
                      <div className="text-neutral-400">On‑chain proofs</div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <div className="text-emerald-300 font-semibold">Simple</div>
                      <div className="text-neutral-400">3‑step capture</div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <div className="text-emerald-300 font-semibold">Verified</div>
                      <div className="text-neutral-400">Validator review</div>
                    </div>
                  </div>
                </div>

                {/* Right visual: refined info panel (no inner scroll) */}
                <div className="relative md:justify-self-end md:flex md:justify-end md:items-center">
                  <div className="relative mx-auto w-full max-w-lg aspect-[4/5] md:aspect-auto md:w-[28rem] md:h-[60vh] md:min-h-[340px] rounded-2xl border border-white/10 bg-white/5 overflow-hidden shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]">
                    {/* Ambient gradient */}
                    <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full blur-3xl opacity-70" style={{ background: "radial-gradient(closest-side, rgba(13,227,165,0.18), transparent)" }} />
                    <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full blur-3xl opacity-60" style={{ background: "radial-gradient(closest-side, rgba(0,200,255,0.14), transparent)" }} />

                    {/* Compass ring */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[58%] w-[58%] rounded-full border border-emerald-400/40" />
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[46%] w-[46%] rounded-full border border-emerald-400/25 animate-[spin_12s_linear_infinite]" />
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[34%] w-[34%] rounded-full border border-emerald-400/15" />

                    {/* Feature chips */}
                    <div className="absolute inset-x-0 top-6 flex justify-center gap-2 text-[11px]">
                      <div className="px-2.5 py-1 rounded-full border border-white/10 bg-black/40">Live GPS</div>
                      <div className="px-2.5 py-1 rounded-full border border-white/10 bg-black/40">Compass</div>
                      <div className="px-2.5 py-1 rounded-full border border-white/10 bg-black/40">Framing</div>
                    </div>

                    {/* Cards */}
                    <div className="absolute inset-x-0 bottom-6 grid grid-cols-3 gap-3 px-6">
                      <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-center">
                        <div className="text-emerald-300 text-xs font-semibold">Capture</div>
                        <div className="text-neutral-400 text-[11px]">Camera + GPS</div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-center">
                        <div className="text-emerald-300 text-xs font-semibold">Describe</div>
                        <div className="text-neutral-400 text-[11px]">Tree details</div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-center">
                        <div className="text-emerald-300 text-xs font-semibold">Submit</div>
                        <div className="text-neutral-400 text-[11px]">Validator review</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </section>

            <div className="w-full">
            {/* How it works */}
            <section id="how-it-works" className="mx-auto max-w-6xl px-6 md:px-8 pb-12 md:pb-16">
              <div className="rounded-2xl border border-[var(--surface-glass-border)] bg-[var(--surface-glass)] p-6 md:p-8 glass-card">
                <h2 className="text-xl md:text-2xl font-semibold mb-6">How it works</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                    <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-semibold">1</div>
                    <div className="font-semibold mb-1">Capture</div>
                    <div className="text-sm text-neutral-300">Grant permissions and frame your tree with the live camera.</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                    <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-semibold">2</div>
                    <div className="font-semibold mb-1">Describe</div>
                    <div className="text-sm text-neutral-300">Add species, age, and measurements for better estimates.</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                    <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-semibold">3</div>
                    <div className="font-semibold mb-1">Submit</div>
                    <div className="text-sm text-neutral-300">Confirm to submit your request. Validators review and mint.</div>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    className="btn-primary px-6 py-3 rounded-lg"
                    onClick={() => setStep("permissions")}
                  >
                    Start Mint
                  </button>
                  <a href="/dashboard/farmer" className="btn-secondary px-6 py-3 rounded-lg">Back to Dashboard</a>
                </div>
              </div>
            </section>
            {/* Requirements / Tips */}
            <section className="mx-auto max-w-6xl px-6 md:px-8 pb-16">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8">
                <h3 className="text-lg md:text-xl font-semibold mb-3">Before you start</h3>
                <ul className="text-sm text-neutral-300 grid grid-cols-1 md:grid-cols-2 gap-2 list-disc pl-5">
                  <li>Stand a few meters away to fit the full tree in frame.</li>
                  <li>Enable location and motion/compass permissions when asked.</li>
                  <li>Ensure good daylight for a clear picture.</li>
                  <li>Have your wallet extension (Petra) installed and unlocked.</li>
                </ul>
              </div>
            </section>
            </div>
          </div>
        )}

        {/* Step 2: Permissions & Instruction */}
        {step === "permissions" && (
          <div className="fixed inset-x-0 top-24 md:top-28 bottom-0 z-40 flex items-start md:items-center justify-center p-4 overflow-y-auto">
            <div className="absolute inset-0 backdrop-blur-md bg-black/40 pointer-events-none z-0" />
            <div className="relative z-10 my-4 glass-card w-full max-w-3xl rounded-2xl border border-[var(--surface-glass-border)] bg-[var(--surface-glass)] p-6">
              <h2 className="text-2xl font-semibold mb-2">Capture Your Green Asset</h2>
              <p className="text-neutral-300 mb-6">
                We’ll request access to your Location, Camera, and Compass to verify your tree’s existence and create a secure digital twin.
              </p>
              {/* Stylized phone scanning graphic placeholder */}
              <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <div className="col-span-2 flex items-center justify-center">
                  <div className="relative w-64 h-40 rounded-xl border border-emerald-400/30 bg-emerald-300/5">
                    <div className="absolute inset-4 rounded-lg border border-emerald-400/50 animate-pulse" />
                    <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-emerald-500/30 border border-emerald-400/60" />
                    <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-400/60" />
                    <div className="absolute left-6 top-6 w-10 h-14 rounded-md bg-emerald-600/30" />
                    <div className="absolute right-10 bottom-6 w-12 h-12 rounded-full bg-emerald-600/25" />
                  </div>
                </div>
                <ul className="text-sm text-neutral-300 space-y-2">
                  <li>• Location to geo-verify your tree</li>
                  <li>• Camera to capture the tree</li>
                  <li>• Compass to add direction context</li>
                </ul>
              </div>
              <div className="flex items-center gap-3">
                <button className="btn-primary" onClick={beginCapture}>Begin Capture</button>
                <button className="btn-secondary" onClick={() => setStep("intro")}>Cancel</button>
              </div>
              {streamError && <p className="text-red-400 mt-4">{streamError}</p>}
            </div>
          </div>
        )}

        {/* Step 2 ->  Capture Interface */}
        {step === "capture" && (
          <div className="fixed inset-x-0 top-24 md:top-28 bottom-0 z-40 flex items-center justify-center p-4 overflow-y-auto ">
            <div className="absolute inset-0 backdrop-blur-md bg-black/40 pointer-events-none z-0" />
            <div className="relative z-10 w-full max-w-5xl rounded-2xl overflow-hidden border border-[var(--surface-glass-border)] bg-black/60">
              <div className="relative aspect-video bg-black">
                <video ref={videoRef} playsInline muted autoPlay className="w-full h-full object-contain" onLoadedMetadata={() => setVideoReady(true)} onCanPlay={() => setVideoReady(true)} />
                {/* HUD overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  {/* Frame guide */}
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2/3 h-2/3 border-2 border-emerald-400/70 rounded-xl" />
                  {/* Live data */}
                  <div className="absolute top-3 left-3 text-xs bg-black/50 rounded px-2 py-1 border border-white/10">
                    <div>Lat: {sensors.lat?.toFixed(6) ?? "-"}</div>
                    <div>Lon: {sensors.lon?.toFixed(6) ?? "-"}</div>
                  </div>
                  <div className="absolute top-3 right-3 text-xs bg-black/50 rounded px-2 py-1 border border-white/10">
                    <div>Heading: {prettyHeading(sensors.heading)}</div>
                  </div>
                </div>
                {/* Retry/Backoff overlay when camera isn't ready */}
                {!videoReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-auto">
                    <div className="text-center space-y-3">
                      <div className="mx-auto w-10 h-10 border-4 border-emerald-400/60 border-t-transparent rounded-full animate-spin" />
                      <div className="text-sm text-neutral-200">Starting camera…</div>
                      {typeof nextRetryIn === "number" && (
                        <div className="text-xs text-neutral-400">Retrying in {nextRetryIn}s</div>
                      )}
                      {streamError && <div className="text-xs text-red-400">{streamError}</div>}
                      <div className="flex gap-2 justify-center">
                        <button className="btn-secondary px-3 py-1" onClick={() => { setRetryAttempt(0); void attemptAttachOrStart(); }}>Retry now</button>
                        <button className="btn-secondary px-3 py-1" onClick={() => { void flipCamera(); }}>Flip camera</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between p-4 bg-[var(--surface-glass)]">
                <div className="flex items-center gap-2">
                  <button className="btn-secondary" onClick={() => { setStep("intro"); stopVideo(); clearSensors(); }}>
                    Back
                  </button>
                  <button className="btn-secondary" onClick={() => void flipCamera()}>
                    Flip
                  </button>
                </div>
                <button
                  className={classNames(
                    "px-6 py-3 rounded-full text-black font-semibold",
                    videoReady ? "bg-emerald-400 hover:bg-emerald-300" : "bg-gray-600 cursor-not-allowed"
                  )}
                  onClick={handleSnap}
                  disabled={!videoReady}
                >
                  Capture
                </button>
              </div>
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}

        {/* Step 3: Data Form */}
        {step === "form" && (
          <div className="fixed inset-x-0 top-24 md:top-28 bottom-0 z-40 flex items-start md:items-center justify-center p-4 overflow-y-auto">
            <div className="absolute inset-0 backdrop-blur-md bg-black/40 pointer-events-none z-0" />
            <div className="relative z-10 my-4 glass-card w-full max-w-4xl rounded-2xl border border-[var(--surface-glass-border)] bg-[var(--surface-glass)] p-6">
              <h2 className="text-2xl font-semibold mb-4">Describe Your Tree</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  {capturedDataUrl ? (
                    <img src={capturedDataUrl} alt="Captured tree" className="rounded-lg border border-white/10 object-cover w-full max-h-56" />
                  ) : (
                    <div className="h-56 rounded-lg border border-white/10 bg-black/30 flex items-center justify-center text-neutral-400">No photo</div>
                  )}
                  {/* Verify status */}
                  <VerifyGate
                    dataUrl={capturedDataUrl}
                    lat={sensors.lat}
                    lon={sensors.lon}
                    status={verifyStatus}
                    onStatusChange={setVerifyStatus}
                    onResult={setVerifyDetails}
                    onRetry={() => { setVerifyStatus({ state: 'running' }); }}
                  />
                </div>
                <div className="md:col-span-2">
                  {!(verifyStatus?.state === 'passed' || verifyStatus?.state === 'flagged') ? (
                    <div className="h-full min-h-56 rounded-lg border border-white/10 bg-black/30 p-4 text-sm text-neutral-300 flex items-center">
                      {verifyStatus?.state === 'rejected' ? (
                        <div>
                          <div className="font-semibold text-red-300">{verifyStatus?.message || 'Photo rejected by AI'}</div>
                          <div className="text-neutral-400 mt-2">
                            {renderVerifyHints(verifyDetails)}
                          </div>
                          <div className="mt-3 flex gap-2">
                            <button className="btn-secondary" onClick={() => { setVerifyStatus({ state: 'running' }); }}>Retry verification</button>
                            <button className="btn-secondary" onClick={skipVerification}>Skip AI check for now</button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="font-semibold">Waiting for AI approval…</div>
                          <div className="text-neutral-400 mt-1">Once approved, the form will unlock for details.</div>
                          <div className="mt-3">
                            <button className="btn-secondary" onClick={skipVerification}>Skip AI check for now</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm mb-1">Tree Name/Nickname</label>
                        <input value={form.name} onChange={(e) => handleFormChange("name", e.target.value)} className="w-full bg-transparent border rounded-md px-3 py-2 focus:outline-none focus:border-emerald-400" placeholder="The Old Banyan" />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">Common Name</label>
                        <div className="relative">
                          <select value={form.species} onChange={(e)=>handleSelectCommon(e.target.value)} className="w-full appearance-none bg-black/30 border border-white/10 rounded-md px-3 pr-9 py-2 focus:outline-none focus:border-emerald-400 text-neutral-200">
                            <option value="" disabled hidden>Select common name</option>
                            {speciesCommonOptions.map((s) => (
                              <option key={s.id} value={s.commonName} className="bg-[#0a0d0f]">{s.commonName}</option>
                            ))}
                          </select>
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">▾</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm mb-1">Scientific Name</label>
                        <div className="relative">
                          <select value={form.speciesScientific} onChange={(e)=>handleSelectScientific(e.target.value)} className="w-full appearance-none bg-black/30 border border-white/10 rounded-md px-3 pr-9 py-2 focus:outline-none focus:border-emerald-400 text-neutral-200">
                            <option value="" disabled hidden>Select scientific name</option>
                            {speciesScientificOptions.map((s) => (
                              <option key={s.id} value={s.scientificName} className="bg-[#0a0d0f]">{s.scientificName}</option>
                            ))}
                          </select>
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">▾</span>
                        </div>
                      </div>
                      {form.species === "Other" && (
                        <div className="md:col-span-2">
                          <label className="block text-sm mb-1">Other Species</label>
                          <input value={form.otherSpecies} onChange={(e) => handleFormChange("otherSpecies", e.target.value)} className="w-full bg-transparent border rounded-md px-3 py-2 focus:outline-none focus:border-emerald-400" placeholder="Enter species" />
                        </div>
                      )}
                      <div>
                        <label className="block text-sm mb-1">Estimated Age (years)</label>
                        <input type="number" value={form.age as any} onChange={(e) => handleFormChange("age", e.target.value === "" ? "" : Number(e.target.value))} className="w-full bg-transparent border rounded-md px-3 py-2 focus:outline-none focus:border-emerald-400" />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">Estimated Height (meters)</label>
                        <input type="number" value={form.heightM as any} onChange={(e) => handleFormChange("heightM", e.target.value === "" ? "" : Number(e.target.value))} className="w-full bg-transparent border rounded-md px-3 py-2 focus:outline-none focus:border-emerald-400" />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">Trunk Girth (cm)</label>
                        <input type="number" value={form.girthCm as any} onChange={(e) => handleFormChange("girthCm", e.target.value === "" ? "" : Number(e.target.value))} className="w-full bg-transparent border rounded-md px-3 py-2 focus:outline-none focus:border-emerald-400" />
                      </div>
                      <div className="md:col-span-2">
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-sm">Diseases / Conditions (optional)</label>
                          <button type="button" className="btn-secondary px-3 py-1" onClick={addDiseaseEntry}>Add disease</button>
                        </div>
                        {form.diseaseEntries.length === 0 && (
                          <div className="text-xs text-neutral-400 mb-2">No diseases added.</div>
                        )}
                        <div className="space-y-3">
                          {form.diseaseEntries.map((d) => (
                            <div key={d.id} className="rounded-md border border-white/10 bg-black/30 p-3">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                  <label className="block text-xs mb-1">Name</label>
                                  <input value={d.name} onChange={(e)=>updateDiseaseField(d.id,'name', e.target.value)} className="w-full bg-transparent border rounded-md px-3 py-2 focus:outline-none focus:border-emerald-400" placeholder="e.g., Powdery mildew" />
                                </div>
                                <div className="md:col-span-2">
                                  <label className="block text-xs mb-1">How it looks / notes</label>
                                  <input value={d.appearance} onChange={(e)=>updateDiseaseField(d.id,'appearance', e.target.value)} className="w-full bg-transparent border rounded-md px-3 py-2 focus:outline-none focus:border-emerald-400" placeholder="White powdery spots on leaves" />
                                </div>
                              </div>
                              <div className="mt-2 flex items-center gap-3">
                                <input type="file" accept="image/*" onChange={(e)=>updateDiseasePhoto(d.id, e.target.files?.[0])} />
                                {d.photoDataUrl && <img src={d.photoDataUrl} alt="disease" className="h-16 w-16 object-cover rounded border border-white/10" />}
                                <button type="button" className="btn-secondary ml-auto" onClick={()=>removeDiseaseEntry(d.id)}>Remove</button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3">
                          <label className="block text-xs mb-1">General disease notes</label>
                          <textarea value={form.diseases} onChange={(e) => handleFormChange("diseases", e.target.value)} className="w-full bg-transparent border rounded-md px-3 py-2 focus:outline-none focus:border-emerald-400" rows={2} />
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm mb-1">Additional Details</label>
                        <textarea value={form.details} onChange={(e) => handleFormChange("details", e.target.value)} className="w-full bg-transparent border rounded-md px-3 py-2 focus:outline-none focus:border-emerald-400" rows={3} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between">
                <button className="btn-secondary" onClick={handleBackToCapture}>
                  Back
                </button>
                <button
                  className={classNames(
                    "btn-primary",
                    (
                      !form.name ||
                      !form.species ||
                      (form.species === "Other" && !form.otherSpecies) ||
                      (verifyStatus?.state !== 'passed' && verifyStatus?.state !== 'flagged')
                    ) && "opacity-60 cursor-not-allowed"
                  )}
                  onClick={proceedProcessing}
                  disabled={
                    !form.name ||
                    !form.species ||
                    (form.species === "Other" && !form.otherSpecies) ||
                    (verifyStatus?.state !== 'passed' && verifyStatus?.state !== 'flagged')
                  }
                >
                  Proceed
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Processing + Confirmation */}
        {(step === "processing" || step === "confirm") && (
          <div className="fixed inset-x-0 top-24 md:top-28 bottom-0 z-40 flex items-start md:items-center justify-center p-4 overflow-y-auto">
            <div className="absolute inset-0 backdrop-blur-md bg-black/40 pointer-events-none z-0" />
            <div className="relative z-10 my-4 glass-card w-full max-w-3xl rounded-2xl border border-[var(--surface-glass-border)] bg-[var(--surface-glass)] p-6">
              {step === "processing" && (
                <div className="text-center">
                  <h3 className="text-xl font-semibold mb-2">Analyzing Your Asset...</h3>
                  <p className="text-neutral-300 mb-6">Verifying location, estimating yield, and preparing metadata.</p>
                  <div className="mx-auto w-40 h-40 rounded-full border-2 border-emerald-400/40 animate-pulse relative">
                    <div className="absolute inset-6 rounded-full border-2 border-emerald-400/30 animate-[spin_3s_linear_infinite]" />
                    <div className="absolute inset-12 rounded-full border-2 border-emerald-400/20 animate-[spin_5s_linear_infinite]" />
                  </div>
                </div>
              )}
              {step === "confirm" && (
                <div>
                  <h3 className="text-xl font-semibold mb-2">Estimated Annual CCT Yield</h3>
                  <div className="text-4xl font-bold text-emerald-400 mb-2">{estimate} CCTs</div>
                  <p className="text-neutral-400 mb-6 text-sm">This is an estimate. The final yield is subject to validator approval and network conditions.</p>
                  {error && <p className="text-red-400 mb-3">{error}</p>}
                  <div className="flex items-center gap-3">
                    <button className="btn-primary" onClick={confirmAndMint}>Confirm & Mint NFT</button>
                    <button className="btn-secondary" onClick={() => setStep("form")}>Back</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 5: Minting & Success */}
        {(step === "minting" || step === "success") && (
          <div className="fixed inset-x-0 top-24 md:top-28 bottom-0 z-40 flex items-start md:items-center justify-center p-4 overflow-y-auto">
            <div className="absolute inset-0 backdrop-blur-md bg-black/40 pointer-events-none z-0" />
            <div className="relative z-10 my-4 glass-card w-full max-w-3xl rounded-2xl border border-[var(--surface-glass-border)] bg-[var(--surface-glass)] p-6 text-center">
              {step === "minting" && (
                <div>
                  <h3 className="text-xl font-semibold mb-2">Minting in Progress...</h3>
                  <p className="text-neutral-300 mb-6">Please approve the transaction in your wallet.</p>
                  <div className="mx-auto w-16 h-16 border-4 border-emerald-400/60 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {step === "success" && (
                <div>
                  <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-emerald-500/30 flex items-center justify-center" style={{ boxShadow: "0 0 64px rgba(46,204,113,0.45) inset, 0 0 64px rgba(46,204,113,0.25)" }}>
                    <svg width="32" height="32" viewBox="0 0 20 20" fill="none"><path d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 111.4-1.4l3.1 3.1 6.8-6.8a1 1 0 011.4 0z" fill="#2ECC71"/></svg>
                  </div>
                  <h3 className="text-2xl font-semibold mb-2">Congratulations!</h3>
                  <p className="text-neutral-300 mb-4">Your TreeNFT request has been submitted and is pending validation.</p>
                  {txHash && (
                    <p className="mb-6 text-sm">
                      Tx Hash: {explorerUrl ? (
                        <a href={explorerUrl} target="_blank" rel="noreferrer" className="underline text-emerald-300">{txHash}</a>
                      ) : (
                        <span className="text-neutral-300">{txHash}</span>
                      )}
                    </p>
                  )}
                  <div className="flex items-center justify-center gap-3">
                    <a href="/dashboard/farmer" className="btn-primary">Return to Dashboard</a>
                    <button className="btn-secondary" onClick={startOver}>Mint another</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function dataUrlToFile(dataUrl: string, filename = 'capture.jpg'): File {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], filename, { type: mime });
}

function VerifyGate({
  dataUrl,
  lat,
  lon,
  status,
  onStatusChange,
  onRetry,
  onResult,
}:{
  dataUrl: string | null;
  lat?: number;
  lon?: number;
  status: { state: 'idle'|'running'|'passed'|'rejected'|'flagged'; message?: string } | null;
  onStatusChange: (s: { state: 'idle'|'running'|'passed'|'rejected'|'flagged'; message?: string }) => void;
  onRetry: () => void;
  onResult: (res: VerifyResult | null) => void;
}){
  useEffect(()=>{
    let cancelled = false;
    async function run(){
      if(!dataUrl) return;
      if(lat==null || lon==null) return; // wait for GPS
      if(status?.state !== 'running') return;
      try {
        const file = dataUrlToFile(dataUrl);
        const res: VerifyResult = await verifyTree(file, lat, lon);
        if(cancelled) return;
        if(res.status === 'PASSED') onStatusChange({ state: 'passed', message: 'AI check passed' });
        else if(res.status === 'FLAGGED') onStatusChange({ state: 'flagged', message: res.reason || 'AI flagged for review' });
        else onStatusChange({ state: 'rejected', message: classifyRejectReason(res) });
        onResult(res);
      } catch(err:any){
        if(cancelled) return;
        // Distinguish backend connectivity/proxy vs AI rejection
        if(err instanceof VerifyApiError){
          if(err.status >= 500 || err.status === 0){
            onStatusChange({ state: 'rejected', message: 'AI service unavailable' });
            onResult(err.data || null);
          } else if(err.status === 422){
            const msg = classifyRejectReason(err.data as VerifyResult | undefined) || 'Photo rejected by AI';
            onStatusChange({ state: 'rejected', message: msg });
            onResult(err.data as VerifyResult || null);
          } else {
            const msg = (err.data && (err.data.error || err.data.reason)) || err.message;
            onStatusChange({ state: 'rejected', message: msg || 'Verification failed' });
            onResult(err.data || null);
          }
        } else {
          onStatusChange({ state: 'rejected', message: 'Network error contacting AI service' });
          onResult(null);
        }
      }
    }
    void run();
    return ()=>{ cancelled = true; };
  }, [dataUrl, lat, lon, status?.state, onStatusChange]);

  if(!dataUrl){
    return null;
  }

  const waitingForGps = (lat==null || lon==null);
  const state = status?.state || 'idle';
  return (
    <div className="mt-3 text-xs">
      {waitingForGps && (
        <div className="rounded border border-white/10 bg-black/30 px-2 py-1 text-neutral-300">Waiting for GPS lock… please ensure location is enabled.</div>
      )}
      {!waitingForGps && state === 'running' && (
        <div className="flex items-center gap-2 rounded border border-emerald-400/30 bg-emerald-500/10 px-2 py-1">
          <div className="w-3 h-3 border-2 border-emerald-400/60 border-t-transparent rounded-full animate-spin" />
          <div>Verifying photo with AI…</div>
        </div>
      )}
      {!waitingForGps && state === 'passed' && (
        <div className="rounded border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-emerald-300">AI check passed. You can proceed.</div>
      )}
      {!waitingForGps && state === 'flagged' && (
        <div className="rounded border border-yellow-400/40 bg-yellow-500/10 px-2 py-1 text-yellow-300">AI flagged for manual review. You may proceed, but validators will review.</div>
      )}
      {!waitingForGps && state === 'rejected' && (
        <div className="rounded border border-red-400/40 bg-red-500/10 px-2 py-2 text-red-300">
          {status?.message || 'AI rejected the photo' }
          <div className="mt-2">
            <button className="btn-secondary px-2 py-1" onClick={onRetry}>Retry verification</button>
          </div>
        </div>
      )}
    </div>
  );
}

function classifyRejectReason(res?: VerifyResult){
  if(!res) return '';
  // Direct known reasons from AI service
  if(res.reason){
    // Normalize known substrings to friendlier messages
    const r = res.reason.toLowerCase();
    if(r.includes('no tree')) return 'No tree detected. Please retake with the full tree in frame and better lighting.';
    if(r.includes('duplicate by perceptual hash')) return 'Looks like a duplicate photo near this location.';
    if(r.includes('duplicate by deep visual similarity')) return 'This appears visually identical to an existing tree nearby.';
    if(r.includes('dense cluster')) return 'This location is very dense with trees; it will need manual review.';
    if(r.includes('too similar (phash)')) return 'Multiple views are too similar. Capture from different angles.';
    if(r.includes('unrelated objects')) return 'Views look unrelated to the same object. Ensure photos are of the same tree.';
  }
  // Heuristic on metrics
  if(res.metrics){
    if(typeof res.metrics.tree_score === 'number' && res.metrics.tree_score < 0.5){
      return 'Tree not confidently detected. Try framing the full tree and better lighting.';
    }
    if(typeof (res.metrics as any).avg_blur === 'number' && (res.metrics as any).avg_blur < 0.2){
      return 'Photo seems blurry. Hold steady and try again.';
    }
  }
  return res.reason || 'Photo rejected by AI';
}

function renderVerifyHints(res: VerifyResult | null){
  if(!res) return (
    <div>If this persists, try again later or ensure the AI service is running.</div>
  );
  const items: string[] = [];
  if(res.reason){ items.push(res.reason); }
  if(res.metrics){
    if(typeof (res.metrics as any).tree_score === 'number') items.push(`Tree score: ${(res.metrics as any).tree_score.toFixed(2)}`);
    if(typeof (res.metrics as any).phash_hamming === 'number') items.push(`pHash distance: ${(res.metrics as any).phash_hamming}`);
    if(typeof (res.metrics as any).cosine === 'number') items.push(`Visual similarity: ${(res.metrics as any).cosine.toFixed(3)}`);
    if(typeof (res.metrics as any).cluster_count === 'number') items.push(`Nearby trees in radius: ${(res.metrics as any).cluster_count}`);
    if(typeof (res.metrics as any).avg_blur === 'number') items.push(`Blur score: ${(res.metrics as any).avg_blur.toFixed(3)}`);
    if(typeof (res.metrics as any).avg_ela === 'number') items.push(`ELA score: ${(res.metrics as any).avg_ela.toFixed(3)}`);
  }
  if(items.length === 0) return <div>Photo did not pass automated checks. Try reframing with the full tree and better lighting.</div>;
  return (
    <ul className="list-disc pl-5 space-y-1">
      {items.map((t,i)=> <li key={i}>{t}</li>)}
    </ul>
  );
}

