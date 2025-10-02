<div align="center">
<h1>Miko – Narrative Cascade</h1>
<p><strong>Turn India's Green Cover into Digital Gold</strong></p>
<p>Cinematic WebGL storytelling for ecological asset tokenization.</p>
</div>

## Overview
This repository hosts the immersive landing experience built with Next.js + React Three Fiber plus the on‑chain carbon credit prototype (Move modules). The new "Narrative Cascade" architecture replaces a monolithic scroll canvas with:

1. Hero Forest (parallax, instancing, embers, glass crystal tree)
2. Modular feature mini-scenes (Seed, Asset Card, Network) inside performance-managed glass cards
3. Demand-based rendering + intersection visibility throttling

## Tech Stack
- Next.js 14.2.5 / React 18.2
- @react-three/fiber, three.js, @react-three/postprocessing (Bloom only for now)
- Tailwind via global import + bespoke design tokens in `globals.css`
- Move (Aptos) smart contracts for TreeNFT + Carbon Credit Token (CCT)

## Directory Highlights
```
src/app/page.tsx                  # Narrative composition & scroll observers
src/components/narrative/         # Hero + mini scene set
	HeroForestCanvas.tsx            # Instanced forest & parallax camera
	SeedHandsScene.tsx              # Luminous seed placeholder
	TreeAssetCardScene.tsx          # Holographic asset card
	NetworkConnectionScene.tsx      # Pulsar + satellites + arc beams
src/components/mini/MiniScene.tsx # Shared wrapper (demand frameloop + DPR adapt)
move/                             # On-chain carbon credit modules (Aptos)
```

## Performance Strategy
- Mini-scenes: IntersectionObserver toggles between `frameloop='always'` while visible/hovered and `demand` while offscreen.
- Hero: Converted to `demand` with manual `invalidate()` on pointer parallax.
- Instancing for background trees; additive blending for lightweight glow vs heavy postprocessing.
- Adaptive DPR (0.8–1.3 idle, up to 2 on hover) to reduce fill cost on large displays.

## Extending a Mini-Scene
1. Create `YourSceneNameContainer` similar to existing containers.
2. Wrap contents in `<MiniScene>`.
3. Use small primitive / procedural geometry first; only introduce GLTF when necessary.
4. If a scene idles without animation, keep pure demand; call `invalidate()` manually on state/UI changes.

## Parallax Camera Controls
`ParallaxCameraController` exposes props: `intensity`, `smooth`, `maxYaw`, `maxPitch` for fine tuning. Values are intentionally modest for comfort and to preserve composition stability.

## Visual Language
- Glass cards: layered radial blend, subtle border luminescence on hover.
- Emissive ecology green (`#19ffc0`) unified across seed, crystal, network arcs.
- Background gradient + animated grain for cinematic depth without large textures.

## Future Enhancements (Shortlist)
- Replace placeholder tree + seed with authored GLTF assets (baked normals / AO)
- Shader-based atmospheric scattering & screen-space height fog
- GPU particle rewrite (instanced / attribute animated) for embers
- Procedural network arc ribbon shader (fading head, gradient energy pulse)
- Caustics / light shaft pass over hero crystal

## Quick Start (Web)
```bash
npm install
npm run dev
```
Visit http://localhost:3000

If you encounter React duplicate/hook errors, clear artifacts:
```bash
Remove-Item -Recurse -Force node_modules,.next,package-lock.json
npm install
```

## Move Contracts Quick Start
```powershell
aptos move compile --package-dir move
aptos move publish --package-dir move --profile default
```
Initialize (order): roles::init → cct::init → tree_nft::init → marketplace::init

## React 19 Canary Conflict Resolution (Historical)
The project formerly pulled a React 19 canary causing `ReactCurrentOwner` undefined errors in R3F. Mitigation: pin React/ReactDOM 18.2, downgrade Next to 14.2.5, purge lockfile, avoid transitive experimental deps.

## Accessibility & Motion
- Focus-visible outlines retained inside glass cards.
- Parallax and background grain kept under low amplitude; add a user motion toggle before introducing more aggressive camera moves.

## Contributing
PRs welcome. Prefer procedural / lightweight solutions before adding dependencies. Keep scenes modular. Document any new postprocessing passes.

---

# Legacy Protocol README (On-Chain PoC)

Miko is a decentralized carbon credit marketplace on the Aptos blockchain featuring a two‑token model:

* TreeNFT: Digital twin NFT of a real-world tree / plot (geo + metadata on IPFS).
* CCT (Carbon Credit Token): Fungible token representing standardized CO₂ offset units generated over time by each active TreeNFT at a rate set by an Oracle.

## Current PoC Scope
* Role registry (admin/oracle/validator) – centralized for now.
* Mint + manage Tree NFTs (validator approval + oracle rate setting planned).
* Linear CCT accrual and claim function.
* Escrow marketplace (per‑listing resource WIP; interim seller‑owned escrow, fee logic) – NOT production safe.

Move package lives in `move/`.

## Repository Structure
```
move/
	Move.toml
	sources/
		roles.move
		cct.move
		tree_nft.move
		marketplace.move
docs/
	architecture.md
src/
	lib/aptos.ts (frontend client helpers placeholder)
```

## Building Move Contracts (Devnet)
Requires Aptos CLI installed.

```powershell
aptos move compile --package-dir move
```

Publish (replace with your account):

```powershell
aptos move publish --package-dir move --profile default
```

Initialize modules (order):
1. roles::init
2. cct::init
3. tree_nft::init
4. marketplace::init(fee_bps)

Example (using CLI entry function invocations once published):

```powershell
aptos move run --function <address>::roles::init
aptos move run --function <address>::cct::init
aptos move run --function <address>::tree_nft::init
aptos move run --function <address>::marketplace::init --args u64:200
```

## Claim Flow Example
1. Validator adds itself via roles (admin adds_validator).
2. Approve + mint tree: `approve_and_mint(owner, metadata_uri, rate_ppm)`.
3. Farmer calls `claim` after some seconds to mint CCT.

`rate_ppm` = micro CCT / second. Example: 50000 means 0.05 CCT per second.

## Marketplace Warning
Escrow design is an evolving prototype. Listing escrow currently resides under seller account; will migrate to admin‑owned table for safer multi‑listing isolation. No stable economic guarantees yet.

## Roadmap Snapshot
| Phase | Focus | Key Deliverables |
|-------|-------|------------------|
| 0 (PoC) | Core primitives | Roles, TreeNFT accrual, basic escrow marketplace, wallet connect, polling UI |
| 1 (MVP) | Production hardening | Admin tools, per‑listing admin escrow, indexer integration, oracle service, listing enumeration views |
| 2 (Expansion) | Risk + incentives | Staking, insurance pool, AI validation pipeline, richer dashboards, partial fills & batch ops |
| 3 (Launch) | Scale + UX | Mobile/offline capture, catastrophic event automation, yield tokenization, multi‑region deployments |
| 4 (Governance) | Decentralization | DAO modules, grants, multi‑asset ecological expansion (soil, biodiversity credits) |

See `docs/architecture.md` and `docs/roadmap.md` for complete detail & status tracking.

## Frontend Integration Progress
Completed:
* Wallet provider + connect/disconnect
* Tree accrual polling with optimistic claim UI
* Basic 3D hero scene (scaffold) 
* Real Aptos SDK wrappers (view + tx building)

Upcoming (Phase 1 targets):
* Marketplace listing enumeration UI (after on-chain view function)
* Listing creation & buy flows with partial fill states
* Enhanced animation & scroll‑driven 3D transitions

## Dependency Strategy
See `docs/dependencies.md` (to be added) for:
* React 18 baseline rationale (wallet adapter + R3F stability)
* Planned React 19 migration path & library compatibility audit
* 3D stack version pinning and upgrade cadence
* Wallet plugin availability notes & fallback behavior

## Contributing
Open PRs for incremental improvements toward MVP. Please include tests (Move unit tests) for any logic changes.

---

## Docker & Team Workflow (Hackathon Ready)

This repository ships with a production-capable multi-stage `Dockerfile` plus a dev-friendly `docker-compose.yml` for uniform local environments.

### Prerequisites
* Docker Desktop (20+)
* Node 20 LTS (only if you want to run locally without Docker)
* Git + GitHub access (repo: `miko-sih-2025` suggested)

### First-Time Clone
```powershell
git clone https://github.com/<org-or-user>/miko-sih-2025.git
cd miko-sih-2025
```

### Environment Variable
If you have a deployed Move package, expose it via:
```powershell
$env:NEXT_PUBLIC_MIKO_ADDRESS="0x<published_address>"
```
Docker Compose reads this automatically.

### Development (Hot Reload)
```powershell
docker-compose up --build
```
Then open http://localhost:3000

Code edits on the host trigger immediate refresh because the project folder is mounted as a volume.

### Stopping
Press CTRL+C in the terminal or:
```powershell
docker-compose down
```

### Production Image (Optimized)
```powershell
docker build -t miko-web:prod .
docker run -p 3000:3000 --env NEXT_PUBLIC_MIKO_ADDRESS=0xADMINPLACEHOLDER miko-web:prod
```

### Branch & Commit Strategy
| Branch | Purpose |
|--------|---------|
| `main` | Stable demo lineage (green build) |
| `feat/*` | Individual feature branches |
| `fix/*` | Bug / regression fixes |
| `docs/*` | Documentation-only updates |

Suggested commit prefix convention:
* `feat:` new user-facing or contract capability
* `chore:` tooling / config / dependency updates
* `fix:` bug fix
* `docs:` documentation change
* `refactor:` internal code restructuring (no behavior change)

### Daily Sync Ritual
1. `git pull origin main`
2. Create/checkout branch: `git checkout -b feat/validator-actions`
3. Run `docker-compose up`
4. Implement changes / commit often
5. Rebase (optional) `git fetch --all && git rebase origin/main`
6. Push & open PR

### Common Docker Issues
| Symptom | Fix |
|---------|-----|
| Stale dependencies | `docker-compose build --no-cache` |
| Node modules mismatch | Remove anonymous volume: `docker volume prune` then rebuild |
| Port already in use | Adjust `3000:3000` mapping or free the port |

### Future Enhancements
* Add a service for an Aptos indexer or mock oracle
* Multi-stage test layer executing Move unit tests
* GitHub Actions workflow building and pushing container image on PR merge

---

## License
TBD (Add a suitable open-source or business license later).

---

## Frontend 3D / React Compatibility Troubleshooting

### Root Cause Encountered
While integrating the scroll‑reactive 3D hero (React Three Fiber + three.js), running on **Next.js 15.5.x with Turbopack** surfaced a runtime crash:

```
TypeError: Cannot read properties of undefined (reading 'ReactCurrentOwner')
	at react-reconciler ... during @react-three/fiber module evaluation
```

Debug logs revealed a **React 19 canary build** was being pulled into the bundle (`reactVersion: 19.2.0-canary-...`) even though the project intended to use stable React 18.2.0. R3F 8.18.x internally expects the stable React 18 reconciler contract; the canary introduced an evaluation ordering mismatch under Turbopack, leaving `ReactCurrentOwner` undefined when R3F's renderer initialized.

### Resolutions Applied
1. **Pinned React & ReactDOM** to `18.2.0` via `dependencies` + a `resolutions` block to force yarn/pnpm style overrides (lockfile regeneration required).
2. Added **Webpack-level alias** in `next.config.ts` ensuring all modules resolve the single canonical `react` and `react-dom` instances.
3. **Downgraded Next.js to 14.2.5**, which stays on the React 18 line (Next 15 snapshot was opt‑in to React 19 canary features at the time of testing).
4. Removed temporary CommonJS `require()` workaround after stability was achieved.
5. Cleaned `.next`, lockfile, and `node_modules` to eliminate stale canary artifacts.

### If You Re‑Enable Next 15 / Turbopack Later
Before upgrading again:
1. Ensure R3F + drei versions explicitly support React 19 (check changelogs).
2. Remove the forced downgrade of `next` only after confirming upstream compatibility.
3. Test with a minimal `<Canvas />` first; then layer in the scene objects.
4. If Turbopack triggers reconciler issues, temporarily fall back to `next dev` (webpack) or keep a `dev:turbopack` script for A/B testing.

### Performance Notes
The hero `Canvas` now runs `frameloop="demand"` with parallax-driven invalidation.

### Quick Recovery Checklist (If Crash Reappears)
```
rm -rf .next node_modules package-lock.json
npm install
npm ls react   # must show 18.2.0 (single dedupe)
npm run dev
```
If a canary React reappears, search transitive deps: `npm ls react-dom` and ensure no experimental preview lib forces a range like `19.x`.

### Future Migration Path
1. Wait for R3F major/minor release explicitly citing React 19 support.
2. Upgrade `next` first in a feature branch.
3. Run visual + performance regression (FPS, memory) with WebGL inspector.
4. Re‑introduce Turbopack after confirming no reconciler mismatch.

---

