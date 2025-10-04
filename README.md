<div align="center">
<h1>Miko – Narrative Cascade</h1>
<p><strong>Turn India's Green Cover into Digital Gold</strong></p>
<p>Cinematic WebGL storytelling for ecological asset tokenization.</p>
</div>

## Overview
This repository hosts the immersive landing experience built with Next.js + React Three Fiber plus the on‑chain carbon credit prototype (Move modules). The evolved "Narrative Cascade" architecture replaces a monolithic scroll canvas with:

1. EcoGenesis Hero (core crystal shell + orbit oracles + root veins + carbon flux + growth halo)
2. Modular feature mini-scenes (Verification, Streaming, Network) inside performance-managed glass cards
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
	EcoGenesisHeroCanvas.tsx        # Hero genesis scene (core + orbits + flux)
	VerificationScene.tsx           # Seed validation scan ring + lattice
	StreamingScene.tsx              # Token streaming spiral + card
	NetworkScene.tsx                # Dynamic network hub, edges & packets
	(Legacy: HeroForestCanvas.tsx, SeedHandsScene.tsx, TreeAssetCardScene.tsx, NetworkConnectionScene.tsx)
src/components/mini/MiniScene.tsx # Shared wrapper (frameloop & DPR adapt)
move/                             # On-chain carbon credit modules (Aptos)
```

## Performance Strategy
- Mini-scenes: IntersectionObserver toggles between `frameloop="always"` while visible / actively animating and `demand` when offscreen.
- Hero: Runs `frameloop="demand"` and uses pointer parallax + internal animated systems (core pulse, orbit oracles, carbon flux) to call `invalidate()` implicitly each frame.
- Instancing & batched attributes: token spiral pellets, carbon flux particles, network nodes/edges minimize draw calls.
- Adaptive DPR (controlled in `MiniScene`): lowers pixel cost when idle while preserving sharpness on interaction.
- Minimal post (single Bloom pass) with tuned `luminanceThreshold` to avoid over-glow.

## Extending a Mini-Scene
1. Create `YourSceneNameContainer` similar to existing containers.
2. Wrap contents in `<MiniScene>`.
3. Use small primitive / procedural geometry first; only introduce GLTF when necessary.
4. If a scene idles without animation, keep pure demand; call `invalidate()` manually on state/UI changes.

## Parallax Camera Controls
`ParallaxCameraController` exposes props: `intensity`, `smooth`, `maxYaw`, `maxPitch` for fine tuning. Values are intentionally modest for comfort and to preserve composition stability.

## Visual Language
- Glass cards: layered radial blend, subtle border luminescence on hover.
- Dual accent palette: ecology emerald `#19ffc0` (growth / energy) + amber `#ffb347` (oracle / validation signals).
- Background radial gradient + animated grain for filmic depth without heavy textures.

## Authentication – "Digital Atrium"
The platform ships a multi‑stage, cinematic authentication & onboarding funnel called the **Digital Atrium**. It blends glassmorphism, subtle grid/particle motifs, and staged micro‑interactions to make login / signup feel like an intentional part of the narrative rather than a blocking form.

### Goals
1. Unify login & new account pathways (email / phone, federated, wallet) inside one adaptive modal.
2. Provide progressive disclosure: collect only what is needed per stage (entry → verification → role → corporate details).
3. Maintain light & dark theme fidelity (studio light theme restrains bloom / emissive for readability).
4. Offer enterprise readiness hooks (future: SSO, deeper KYC) via an extendable state machine.

### Architecture Overview
```
<AuthProvider>
	state: { open, stage, loading, error, role, identifiers, corporate }
	actions: openModal(), closeModal(), go(nextStage), back(), submitOtp(code), selectRole(r), submitCorporate(data)
<AuthModal /> (portal/dialog semantics)
	├─ EntryStage        (#1 choose method + capture email/phone)
	├─ OtpStage          (#2 6-digit verification)
	├─ RoleStage         (#3 Individual vs Corporate)
	└─ CorporateStage    (#4 Company Name, CIN, GSTIN)
```
Render integration lives near the root layout so the modal is globally accessible (`layout.tsx` wraps children with `AuthProvider` + mounts `<AuthModal />`). A navbar button simply calls `openModal()` via the context.

### Stage Flow Logic
| Stage | Purpose | Exit Condition | Next |
|-------|---------|----------------|------|
| entry | Collect user identifier or federated trigger | Valid email/phone submit OR Google/Wallet click | otp / role (federated may bypass) |
| otp | Verify short‑lived code (6 boxes) | Code accepted | role |
| role | Choose user type | Selection + Continue | corporate (if Corporate) or close (if Individual) |
| corporate | Gather org metadata | Valid form submit | close / downstream dashboard |

### Validation Summary
| Field | Pattern (simplified) | Notes |
|-------|----------------------|-------|
| Email | `/^[^@\s]+@[^@\s]+\.[^@\s]+$/` | Intentionally lightweight – replace with robust RFC lib if needed |
| Phone | `/^[0-9]{10}$/` (example) | Regional logic TBD; pluggable adapter recommended |
| OTP   | 6 numeric chars | Auto‑advance & backspace navigation |
| CIN   | `/^[A-Z0-9]{21}$/i` (placeholder) | Adjust to authoritative jurisdiction spec |
| GSTIN | `/^[0-9A-Z]{15}$/i` | Replace with official checksum validator |

### Styling & Micro‑Interactions
Implemented primarily in `globals.css`:
* **Glass Atrium Container**: layered gradient border + backdrop blur + internal radial fade.
* **Grid / Substrate Pattern**: subtle opacity to avoid moiré on light theme.
* **Sheen Animation** (`atriumSheen`): timed horizontal pass for premium feel (throttled to avoid distraction).
* **Role Card Pulse** (`rolePulse`): minimal scale/opacity breathing when not focused; stops when active.
* **Press Scale**: shared interaction class scales buttons 0.97 for tactile feedback.
* **Cross‑Fade Stages**: framer‑motion or CSS fade ensures zero layout jump between stages.

### Theming
Tokens use existing dark/light CSS variables; the modal avoids pure white (#FFF) in light mode—opting for elevated neutral surfaces to preserve depth against high‑key backgrounds. Emissive elements in the adjacent 3D crystal are reduced in light mode to keep focus on form elements.

### Accessibility Notes
* ESC + overlay click close.
* Focus outlines preserved (`:focus-visible`).
* OTP inputs maintain logical tab order and support paste of full code.
* ARIA: Dialog semantics can be enhanced further (next iteration: trap focus + aria-live for errors).

### Replacing Async Stubs
Current async functions simulate latency with `setTimeout`. Replace them:
```ts
// Example inside AuthProvider
async function submitOtp(code: string) {
	setLoading(true);
	try {
		await api.verifyOtp(identifier, code); // real API
		go('role');
	} catch (e) {
		setError('Invalid or expired code');
	} finally {
		setLoading(false);
	}
}
```
Recommended real endpoints:
1. `POST /auth/request-code` { identifier }
2. `POST /auth/verify-code` { identifier, code }
3. `POST /auth/profile` { role, ...corporate }
4. Optional wallet: signature challenge `GET /auth/wallet-challenge` → `POST /auth/wallet-verify`.

### Extensibility Hooks
| Use Case | Extension Point |
|----------|-----------------|
| Add WebAuthn | Insert new stage after `entry` before `otp`; or replace OTP with WebAuthn challenge/resume. |
| Social / SSO (e.g., GitHub) | Add provider button in `EntryStage` dispatching `go('role')` on success. |
| KYC Tiering | Split corporate stage into multiple sub‑stages; update state machine enum. |
| Analytics | Wrap `go()` calls to emit events (`auth_stage_transition`). |

### Minimal Integration Checklist
1. Ensure `<AuthProvider>` wraps `app` root.
2. Add a trigger (e.g., Navbar Login) calling `openModal()`.
3. Supply real API adapters; remove simulation delays.
4. Strengthen regex patterns or introduce a dedicated validation util.
5. (Optional) Implement focus trap & inert background for WCAG AA.

### Future Enhancements (Auth)
* WebAuthn + device binding fallback to OTP.
* Progressive wallet connect merging on‑chain identity with email.
* Rate limiting + lockout visuals (animated cooldown arc on button).
* Frictionless re‑entry (skip stages when session still warm).
* Audit trail & structured error telemetry.

For contributor onboarding, this section should provide enough surface area to extend auth without reversing existing design decisions.


## Future Enhancements (Shortlist)
- Replace legacy forest + seed placeholders with authored GLTF assets (baked normals / AO)
- Shader-based atmospheric scattering & screen-space height fog
- GPU particle rewrite (instanced attribute animation) for carbon flux & spiral tokens
- Procedural network edge ribbon shader (trail fade, energy gradient)
- Caustics / volumetric light shafts over hero core crystal

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

### Publishing Images to Docker Hub

Two images are produced:

| Image | Context | Purpose |
|-------|---------|---------|
| `jainhardik06/miko-web` | project root (Next.js multi-stage) | Frontend / static + server components |
| `jainhardik06/miko-api` | `backend/` folder | Auth/API service |

Build & push (replace tag if versioning):
```powershell
docker build -t jainhardik06/miko-web:latest .
docker build -t jainhardik06/miko-api:latest backend
docker push jainhardik06/miko-web:latest
docker push jainhardik06/miko-api:latest
```

Run everything (production style) with pre-built images:
```powershell
docker compose -f docker-compose.prod.yml up -d
```

Environment required (supply via `.env` or inline):
```
DATABASE_URL=mongodb://mongo:27017/miko   # Or remote Atlas cluster
JWT_SECRET=replace_me
NEXT_PUBLIC_MIKO_ADDRESS=0xADMINPLACEHOLDER
EMAIL_FROM=noreply@yourdomain
RESEND_API_KEY= # optional if using Resend
```

To override images locally (for a quick test without pushing):
```powershell
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

### Shipping Your Teammate a One-Command Setup
1. Push both images to Docker Hub.
2. Send them a small `.env` file containing the secrets above.
3. They run: `docker compose -f docker-compose.prod.yml --env-file .env up -d`
4. Open: Frontend http://localhost:3000, API http://localhost:5001, DB UI http://localhost:8081

If you later host Mongo remotely (Atlas), remove the `mongo` & `mongo-express` services or comment them out and set `DATABASE_URL` to the remote connection string.


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

