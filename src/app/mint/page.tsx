"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MODULE_ADDRESS } from "@/config";
import { connectPetra } from "@/lib/petra";

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
  species: string;
  otherSpecies?: string;
  age?: number | "";
  diseases?: string;
  heightM?: number | "";
  girthCm?: number | "";
  details?: string;
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
  const [sensors, setSensors] = useState<LiveSensors>({});
  const [watchId, setWatchId] = useState<number | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [form, setForm] = useState<TreeForm>({ name: "", species: "", otherSpecies: "", age: "", heightM: "", girthCm: "", diseases: "", details: "" });
  const [estimate, setEstimate] = useState<number | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const speciesOptions = useMemo(
    () => [
      "Banyan",
      "Neem",
      "Peepal",
      "Teak",
      "Mango",
      "Coconut",
      "Eucalyptus",
      "Acacia",
      "Other",
    ],
    []
  );

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

  const startVideo = useCallback(async () => {
    setStreamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setVideoReady(true);
    } catch (e: any) {
      setStreamError(e?.message || "Unable to access camera");
      setVideoReady(false);
    }
  }, []);

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
    setStep("permissions");
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
    // Camera
    await startVideo();
    setStep("capture");
  }, [onDeviceOrientation, startVideo]);

  const handleSnap = useCallback(() => {
    setError(null);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedDataUrl(dataUrl);
    // Keep the camera running but move to form step
    setStep("form");
  }, []);

  const handleBackToCapture = useCallback(() => {
    setStep("capture");
  }, []);

  const handleFormChange = useCallback(<K extends keyof TreeForm>(key: K, value: TreeForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  const proceedProcessing = useCallback(() => {
    setError(null);
    setStep("processing");
    // We no longer need camera/sensors during analysis
    stopVideo();
    clearSensors();
    // Fake analysis delay, compute simple heuristic estimate
    const h = Number(form.heightM || 0);
    const g = Number(form.girthCm || 0);
    const a = Number(form.age || 0);
    // simple model: growth factor from height and girth, boosted by maturity; clamp
    const est = Math.max(1, Math.min(500, Math.round(0.3 * h * (g / 50 + 1) + 0.1 * a)));
    setTimeout(() => {
      setEstimate(est);
      setStep("confirm");
    }, 1400);
  }, [clearSensors, form.age, form.girthCm, form.heightM, stopVideo]);

  const metadataJson = useMemo(() => {
    const payload = {
      schema: "miko.tree-request@v1",
      capturedAt: Date.now(),
      location: sensors.lat && sensors.lon ? { lat: sensors.lat, lon: sensors.lon } : undefined,
      heading: sensors.heading,
      photo: capturedDataUrl,
      form: {
        name: form.name,
        species: form.species === "Other" ? form.otherSpecies || "Other" : form.species,
        age: form.age ? Number(form.age) : undefined,
        diseases: form.diseases || undefined,
        heightM: form.heightM ? Number(form.heightM) : undefined,
        girthCm: form.girthCm ? Number(form.girthCm) : undefined,
        details: form.details || undefined,
      },
      estimateCCT: estimate ?? undefined,
    } as const;
    return JSON.stringify(payload);
  }, [capturedDataUrl, estimate, form.age, form.details, form.diseases, form.girthCm, form.heightM, form.name, form.otherSpecies, form.species, sensors.heading, sensors.lat, sensors.lon]);

  const explorerUrl = useMemo(() => (txHash ? `https://explorer.aptoslabs.com/txn/${txHash}?network=devnet` : null), [txHash]);

  const confirmAndMint = useCallback(async () => {
    setError(null);
    setStep("minting");
    try {
      const { address } = await connectPetra();
      // Pack metadata as data URL JSON to satisfy vector<u8> metadata_uri
      const dataUrl = `data:application/json;base64,${toBase64Utf8(metadataJson)}`;
      const arg0 = toHexUtf8(dataUrl);
      const payload: any = {
        type: "entry_function_payload",
        function: `${MODULE_ADDRESS}::tree_requests::submit`,
        type_arguments: [],
        arguments: [arg0],
      };
      const provider: any = (window as any).petra || (window as any).aptos;
      if (!provider?.signAndSubmitTransaction) throw new Error("Petra wallet not available");
      const res = await provider.signAndSubmitTransaction(payload);
      const txh = res?.hash || res?.transactionHash || res?.hashHex || null;
      if (!txh) throw new Error("Wallet did not return a transaction hash");
      setTxHash(txh);
      // Optional: await confirmation
      try { await provider?.waitForTransaction?.(txh); } catch {}
      setStep("success");
    } catch (e: any) {
      setError(e?.message || "Failed to submit transaction");
      setStep("confirm");
    }
  }, [metadataJson]);

  const startOver = useCallback(() => {
    setStep("intro");
    stopVideo();
    clearSensors();
    setCapturedDataUrl(null);
    setEstimate(null);
    setTxHash(null);
    setError(null);
    setForm({ name: "", species: "", otherSpecies: "", age: "", heightM: "", girthCm: "", diseases: "", details: "" });
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
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
            <div className="absolute inset-0 backdrop-blur-md bg-black/40" />
            <div className="relative glass-card w-full max-w-3xl rounded-2xl border border-[var(--surface-glass-border)] bg-[var(--surface-glass)] p-6">
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
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
            <div className="absolute inset-0 backdrop-blur-md bg-black/40" />
            <div className="relative w-full max-w-5xl rounded-2xl overflow-hidden border border-[var(--surface-glass-border)] bg-black/60">
              <div className="relative aspect-video bg-black">
                <video ref={videoRef} playsInline muted className="w-full h-full object-contain" onCanPlay={() => setVideoReady(true)} />
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
              </div>
              <div className="flex items-center justify-between p-4 bg-[var(--surface-glass)]">
                <button className="btn-secondary" onClick={() => { setStep("intro"); stopVideo(); clearSensors(); }}>
                  Back
                </button>
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
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
            <div className="absolute inset-0 backdrop-blur-md bg-black/40" />
            <div className="relative glass-card w-full max-w-4xl rounded-2xl border border-[var(--surface-glass-border)] bg-[var(--surface-glass)] p-6">
              <h2 className="text-2xl font-semibold mb-4">Describe Your Tree</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  {capturedDataUrl ? (
                    <img src={capturedDataUrl} alt="Captured tree" className="rounded-lg border border-white/10 object-cover w-full max-h-56" />
                  ) : (
                    <div className="h-56 rounded-lg border border-white/10 bg-black/30 flex items-center justify-center text-neutral-400">No photo</div>
                  )}
                </div>
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1">Tree Name/Nickname</label>
                    <input value={form.name} onChange={(e) => handleFormChange("name", e.target.value)} className="w-full bg-transparent border rounded-md px-3 py-2 focus:outline-none focus:border-emerald-400" placeholder="The Old Banyan" />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Species</label>
                    <select value={form.species} onChange={(e) => handleFormChange("species", e.target.value)} className="w-full bg-transparent border rounded-md px-3 py-2 focus:outline-none focus:border-emerald-400">
                      <option value="" disabled hidden>
                        Select species
                      </option>
                      {speciesOptions.map((sp) => (
                        <option key={sp} value={sp} className="bg-[#0a0d0f]">
                          {sp}
                        </option>
                      ))}
                    </select>
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
                    <label className="block text-sm mb-1">Known Diseases or Conditions (optional)</label>
                    <textarea value={form.diseases} onChange={(e) => handleFormChange("diseases", e.target.value)} className="w-full bg-transparent border rounded-md px-3 py-2 focus:outline-none focus:border-emerald-400" rows={2} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm mb-1">Additional Details</label>
                    <textarea value={form.details} onChange={(e) => handleFormChange("details", e.target.value)} className="w-full bg-transparent border rounded-md px-3 py-2 focus:outline-none focus:border-emerald-400" rows={3} />
                  </div>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between">
                <button className="btn-secondary" onClick={handleBackToCapture}>
                  Back
                </button>
                <button
                  className={classNames(
                    "btn-primary",
                    (!form.name || !form.species || (form.species === "Other" && !form.otherSpecies)) && "opacity-60 cursor-not-allowed"
                  )}
                  onClick={proceedProcessing}
                  disabled={!form.name || !form.species || (form.species === "Other" && !form.otherSpecies)}
                >
                  Proceed
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Processing + Confirmation */}
        {(step === "processing" || step === "confirm") && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
            <div className="absolute inset-0 backdrop-blur-md bg-black/40" />
            <div className="relative glass-card w-full max-w-3xl rounded-2xl border border-[var(--surface-glass-border)] bg-[var(--surface-glass)] p-6">
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
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
            <div className="absolute inset-0 backdrop-blur-md bg-black/40" />
            <div className="relative glass-card w-full max-w-3xl rounded-2xl border border-[var(--surface-glass-border)] bg-[var(--surface-glass)] p-6 text-center">
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
