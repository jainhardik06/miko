<div align="center">
  <img src="https://raw.githubusercontent.com/jainhardik06/miko/main/public/logo.png" alt="Miko Logo" width="150">
  <h1>Miko – Narrative Cascade</h1>
  <p><strong>Turn India's Green Cover into Digital Gold</strong></p>
  <p>Miko is a full-stack Web3 platform that tokenizes real-world ecological assets, starting with trees, into on-chain Carbon Credit Tokens (CCTs). It combines an immersive WebGL frontend with a robust backend infrastructure and Aptos smart contracts to create a transparent, verifiable, and engaging marketplace for environmental impact.</p>
</div>

---

## 🌟 Project Overview

Miko's mission is to bridge the gap between on-ground conservation efforts and the digital economy. It allows individuals and organizations to get their trees verified, minted as unique TreeNFTs, and accrue CCTs over time. These CCTs can then be sold on a marketplace to corporates or individuals looking to offset their carbon footprint.

**Key Features:**
- **Immersive Frontend:** A cinematic user experience built with Next.js and React Three Fiber (WebGL) that tells the story of environmental impact.
- **On-Chain Verification:** Aptos smart contracts ensure the integrity and ownership of TreeNFTs and the transparent issuance of CCTs.
- **Hybrid Payment Model:** Supports both crypto payments (via Petra Wallet) and traditional fiat payments (via Razorpay).
- **Admin & Validator Roles:** A robust role-based system for approving tree requests and maintaining network integrity.
- **AI-Powered Checks:** An integrated Python service for performing automated checks on user-submitted data.

## 🛠️ Tech Stack

- **Frontend:** Next.js, React, React Three Fiber, three.js, Tailwind CSS
- **Backend:** Node.js, Express.js
- **AI Service:** Python, FastAPI
- **Database:** MongoDB Atlas
- **Blockchain:** Aptos (Move language)
- **File Storage:** IPFS (via Pinata)
- **Deployment:** Vercel (Frontend), Railway (Backend & AI), MongoDB Atlas (Database)

---

## 🚀 Local Development Setup

Follow these steps to get the entire Miko project running on your local machine.

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Python](https://www.python.org/) (v3.9 or later)
- [Aptos CLI](https://aptos.dev/cli-tools/aptos-cli/install-aptos-cli)
- [pnpm](https://pnpm.io/installation) (for faster package installation)
- A code editor like [VS Code](https://code.visualstudio.com/)

### 2. Clone the Repository

```bash
git clone https://github.com/jainhardik06/miko.git
cd miko
```

### 3. Set Up Environment Variables

You need to create three separate `.env` files for the three main services.

**A. Backend (`/backend/.env`)**

Create a file at `backend/.env` and add the following variables. You will need to get these keys from their respective services (MongoDB Atlas, Pinata, Razorpay, etc.).

```properties
# Server
PORT=5001
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:3000

# MongoDB Atlas Connection String
DATABASE_URL="your_mongodb_atlas_connection_string"
DATABASE_NAME=miko

# JWT
JWT_SECRET=a_strong_random_secret
JWT_EXPIRES=1d
ADMIN_JWT_EXPIRES=8h

# Pinata (IPFS)
PINATA_API_KEY="your_pinata_api_key"
PINATA_SECRET_API_KEY="your_pinata_secret_key"

# Aptos Blockchain
# The address where your contracts are published on Devnet
MIKO_ADDRESS="your_aptos_contract_address" 
APTOS_NODE_URL=https://fullnode.devnet.aptoslabs.com/v1
# The private key of your admin/deployer account
ADMIN_PRIVATE_KEY="your_aptos_admin_private_key"

# Super Admin Credentials for the Admin Panel
SUPER_ADMIN_USERNAME=superadmin
SUPER_ADMIN_PASSWORD_HASH="your_bcrypt_hashed_password" # Generate using backend/scripts/generate-admin-hash.js

# Razorpay Test Mode
RAZORPAY_KEY_ID="your_razorpay_test_key_id"
RAZORPAY_KEY_SECRET="your_razorpay_test_key_secret"
RAZORPAY_WEBHOOK_SECRET="a_strong_random_secret_for_webhook"

# Custodial Hot Wallet (for Razorpay-funded transactions)
# A fresh Aptos account's private key to act as the "robot" wallet
FIAT_HOT_WALLET_PRIVATE_KEY="a_new_aptos_private_key"
FIAT_HOT_WALLET_ADDRESS="the_address_for_the_private_key_above"

# AI Service URL
AI_BASE_URL=http://127.0.0.1:8000
```

**B. Frontend (`/.env.local`)**

Create a file at the root of the project named `.env.local`.

```properties
# The address where your contracts are published on Devnet
NEXT_PUBLIC_MIKO_ADDRESS="your_aptos_contract_address"

# The URL of your local backend server
NEXT_PUBLIC_API_ORIGIN=http://localhost:5001

# The Aptos network you are using
NEXT_PUBLIC_APTOS_NETWORK=devnet

# Your Razorpay Test Key ID (this is public)
NEXT_PUBLIC_RAZORPAY_KEY_ID="your_razorpay_test_key_id"
```

**C. AI Service (`/ai-service/.env`)**

Create a file at `ai-service/.env`.

```properties
# The same MongoDB connection string used in the backend
MONGO_URI="your_mongodb_atlas_connection_string"
```

### 4. Install Dependencies

Open three separate terminals for each service.

- **Terminal 1: Frontend (Root)**
  ```bash
  # In the root directory /
  pnpm install
  ```

- **Terminal 2: Backend**
  ```bash
  # In the /backend directory
  cd backend
  pnpm install
  ```

- **Terminal 3: AI Service**
  ```bash
  # In the /ai-service directory
  cd ai-service
  python -m venv .venv
  # Activate the virtual environment
  # Windows
  .\.venv\Scripts\activate
  # macOS/Linux
  # source .venv/bin/activate
  pip install -r requirements.txt
  ```

### 5. Run the Services

- **Terminal 1: Frontend (Root)**
  ```bash
  pnpm run dev
  ```
  Your Next.js app will be running at `http://localhost:3000`.

- **Terminal 2: Backend**
  ```bash
  # In the /backend directory
  pnpm run dev
  ```
  Your Node.js server will be running at `http://localhost:5001`.

- **Terminal 3: AI Service**
  ```bash
  # In the /ai-service directory
  uvicorn app.main:app --reload
  ```
  Your Python AI service will be running at `http://127.0.0.1:8000`.

You should now have the full Miko application running locally!

---

## 📜 Aptos Smart Contract Deployment

If you make changes to the Move modules in the `/move` directory, you need to republish them to the Aptos Devnet.

1.  **Navigate to the `move` directory:**
    ```bash
    cd move
    ```

2.  **Compile the code (Optional):**
    To ensure everything is correct before publishing, you can compile first.
    ```bash
    aptos move compile --named-addresses miko_admin=default
    ```

3.  **Publish to Devnet:**
    This command publishes the compiled modules to the devnet using your `default` Aptos CLI profile. Make sure your `default` profile is funded with devnet APT.
    ```powershell
    aptos move publish --profile default --assume-yes --max-gas 600000
    ```
    After publishing, the CLI will output the new contract address. **You must update this address in your `.env` files (`MIKO_ADDRESS` and `NEXT_PUBLIC_MIKO_ADDRESS`).**

4.  **Initialize On-Chain Resources:**
    After a fresh publish, you must run these `init` functions to set up the on-chain state. Replace `0x...` with your new contract address.
    ```powershell
    # 1. Initialize Roles
    aptos move run --function-id 0x...::roles::init --profile default --assume-yes

    # 2. Initialize CCT Coin
    aptos move run --function-id 0x...::cct::init --profile default --assume-yes

    # 3. Initialize TreeNFT Collection
    aptos move run --function-id 0x...::tree_nft::init --profile default --assume-yes

    # 4. Initialize Tree Requests
    aptos move run --function-id 0x...::tree_requests::init --profile default --assume-yes

    # 5. Initialize Marketplace
    aptos move run --function-id 0x...::marketplace::init --args u64:500 --profile default --assume-yes
    ```

---

## 🔗 Using Ngrok for Razorpay Webhooks

Razorpay needs a public URL to send webhook events (like `payment.captured`). During local development, you can use `ngrok` to expose your local backend server to the internet.

1.  **Install [ngrok](https://ngrok.com/download).**

2.  **Run ngrok:**
    In a new terminal, run the following command to create a public tunnel to your local backend server on port `5001`.
    ```bash
    ngrok http 5001
    ```

3.  **Get the URL:**
    Ngrok will give you a public `https` URL (e.g., `https://<random-string>.ngrok-free.app`).

4.  **Update Razorpay Dashboard:**
    - Go to your Razorpay Test Dashboard -> Settings -> Webhooks.
    - Add a new webhook.
    - Set the **Webhook URL** to `your_ngrok_url/api/payment-webhook` (e.g., `https://<random-string>.ngrok-free.app/api/payment-webhook`).
    - Set the **Secret** to the `RAZORPAY_WEBHOOK_SECRET` you defined in your `backend/.env` file.
    - Select the `payment.captured` event.

Now, when you make a test payment with Razorpay, the webhook will be sent to your local backend server.

---

## 📂 Directory Structure

```
.
├── ai-service/         # Python FastAPI service for AI checks
├── backend/            # Node.js/Express.js backend server
├── docs/               # Project documentation
├── move/               # Aptos (Move) smart contracts
├── public/             # Static assets for the frontend
├── src/                # Next.js frontend source code
│   ├── app/            # App router pages
│   ├── components/     # React components (including WebGL scenes)
│   ├── lib/            # Helper functions and libraries
│   └── state/          # Global state management
├── .env.local          # Frontend environment variables
├── next.config.mjs     # Next.js configuration
└── README.md           # This file
```

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

### Configure Move module address (critical)
By default the frontend points to a placeholder address `0xADMINPLACEHOLDER`, which will cause wallet simulation errors like "Hex characters are invalid". After you publish the Move package, set your package address for the frontend:

1. Publish the package to devnet/testnet and note the package address shown by the CLI (the account address the package was published under).
2. Create a `.env.local` in the project root with:

```
NEXT_PUBLIC_MIKO_ADDRESS=0x<your_package_address>
NEXT_PUBLIC_API_ORIGIN=http://localhost:5001
```

3. Restart `npm run dev` so the env is picked up. The wallet prompt should now show `0x<your_package_address>::tree_requests::submit` and simulation will proceed.

## IPFS Uploads via Pinata (Images + Metadata)
This repo includes secure server-side endpoints to pin files and JSON to IPFS using Pinata.

Backend endpoints (Express):
- `POST /api/ipfs/upload` – multipart/form-data with `file` field. Returns `{ cid, ipfsUri, gatewayUrl }`.
- `POST /api/ipfs/upload-json` – JSON body `{ data, name? }`. Returns `{ cid, ipfsUri, gatewayUrl }`.
- `POST /api/ipfs/upload-bundle` – JSON body `{ imageDataUrl?, metadata? }` to convert a browser data URL to a file, pin it, and pin the metadata JSON that references it.

Frontend helpers are available in `src/lib/api/ipfs.ts`:
- `uploadFileToIPFS(file, name?)`
- `uploadJSONToIPFS(data, name?)`
- `uploadImageDataUrlBundle(imageDataUrl, metadata)`

Configure credentials in `backend/.env` (do NOT commit secrets):
```
# Prefer a scoped JWT from Pinata (recommended)
PINATA_JWT=... 

# Or API key + secret
# PINATA_API_KEY=...
# PINATA_SECRET_API_KEY=...

# Optional custom gateway base
# PINATA_GATEWAY_BASE=https://gateway.pinata.cloud/ipfs
```

Notes:
- Keep Pinata secrets server-side only. Never expose them via `NEXT_PUBLIC_*`.
- Frontend should POST files to the backend; the backend talks to Pinata and returns a CID.
- You can then include `ipfs://<cid>` in your on-chain metadata or app state.

## Database Setup (MongoDB Atlas)
1. Provision a free MongoDB Atlas cluster (or reuse an existing cluster).
2. Create a database user with access to your target database (recommended name: `miko`).
3. Copy the connection string from Atlas ("Connect your application") and paste it into `backend/.env` as `DATABASE_URL`.
4. Set `DATABASE_NAME` in `backend/.env` to the logical database you want the API to use (e.g., `miko`).
5. Restart the backend (`npm run dev` or Docker) so the new environment variables are loaded.
6. Use MongoDB Compass or the Atlas Data Explorer to verify collections (`users`, `otps`, etc.) once traffic starts flowing.

> ℹ️ No MongoDB containers run locally anymore. All environments now rely on the Atlas connection provided via `DATABASE_URL`.

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
Then open http://localhost:3000.

Compose reads environment variables from a `.env` file in the repo root. Create one (or export variables in your shell) containing at least:

```bash
DATABASE_URL=mongodb+srv://<username>:<password>@<cluster-host>.mongodb.net/?retryWrites=true&w=majority
DATABASE_NAME=miko
JWT_SECRET=replace_me
RESEND_API_KEY=<resend-api-key>
EMAIL_FROM=<verified-from-address>
```

> After editing `docker-compose.yml`, run `docker compose down --remove-orphans` to ensure legacy services (e.g., `mongo_express`) are stopped before bringing the stack back with `docker compose up`.

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
| Backend can't reach Mongo | Confirm `DATABASE_URL`/`DATABASE_NAME` are exported for Docker (e.g., store them in a `.env` file that Docker Compose reads). |

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

