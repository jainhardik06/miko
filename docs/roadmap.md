# Miko Full Roadmap & Execution Matrix

Status Legend: ☐ Pending · ⟳ In Progress · ✔ Done · △ Stretch

## Phase 0 (Weeks 1–6) – Foundation / PoC
### Week 1 – Project Setup & Architecture
- ☐ Team Roles Assigned (Lead, Contracts, Frontend, Design, DevOps)
- ☐ Project Board (Notion/Jira) link: _TBD_
- ☐ Discord/Slack Workspace created
- ☐ Whitepaper v0 draft (two‑token, accrual model)
- ☐ Data Model: TreeNFT schema locked (geo,species,age,metadata_uri,rate_ppm,status)
- ☐ IPFS Provider chosen (Pinata/Fleek/Web3.Storage)

### Weeks 2–3 – Core Move Modules
- ✔ Roles module (admin/oracle/validator)
- ✔ CCT coin module
- ✔ TreeNFT module (approve + claim accrual)
- ✔ Marketplace v0 (escrow placeholder) → ☐ Refactor per-listing escrow table
- ☐ Request Queue module (tree_requests)
- ☐ Oracle module separating rate updates
- ☐ Unit tests (init, mint tree, claim, pause/destroy)

### Weeks 4–5 – Basic dApp
- ☐ Wallet connect integration
- ☐ Mint Tree form (metadata + IPFS upload)
- ☐ My Trees dashboard (pending accrual calc)
- ☐ Marketplace list/buy UI (warning banner: PoC only)
- ☐ Validator panel (approve/reject requests)

### Week 6 – Internal Demo & Stabilization
- ☐ Deploy to Devnet
- ☐ End‑to‑end test scenario documented
- ☐ Performance baseline (claim gas, list gas)
- ☐ Post-mortem + Phase 1 adjustments

## Phase 1 (Months 2–4) – MVP & Community
Smart Contracts:
- ☐ Marketplace V1 (secure escrow w/ partial fills + fee distribution)
- ☐ Tree Request flow (request -> approve -> mint)
- ☐ Oracle central service integration (off-chain script)
- ☐ Access revocation / validator rotation

Frontend & Product:
- ☐ Public landing hero (video or R3F interactive)
- ☐ Marketplace browse + filters (price, species, rate)
- ☐ User profiles (farmer / industry badges)
- ☐ Basic analytics mini dashboard (total CCT, active trees)

Backend / Services:
- ☐ Indexer (ingest events -> Postgres)
- ☐ Rate calculator microservice (species factors) + job scheduler

Security & Ops:
- ☐ Internal audit checklist
- ☐ External audit booking
- ☐ CI: build + move tests + lint

Community:
- ☐ Website + blog
- ☐ Beta farmer onboarding (target N=10)
- ☐ Feedback loop (survey form + Discord channel)

## Phase 2 (Months 5–9) – Expansion & Decentralization
On-Chain:
- ☐ Staking module (lock CCT → yield)
- ☐ Insurance pool (fee siphon, claim payouts)
- ☐ Governance skeleton (proposal / vote weight by token)
- ☐ Dynamic NFT metadata update hooks
AI / Data:
- ☐ Photo classification pipeline (species / health scoring)
- ☐ Satellite event ingestion (forest loss triggers)
Frontend:
- ☐ Public transparency dashboard (charts + 3D globe)
- ☐ Gamification: achievements, leaderboards

## Phase 3 (Months 10–15) – Mainnet Launch
- ☐ Second audit (post feature expansion)
- ☐ Mainnet deployment plan & dry run
- ☐ Mobile apps (offline capture + queued submission)
- ☐ Future Yield Tokenization (forward accrual tokens)
- ☐ Hyper‑local marketplace segmentation
- ☐ PR + launch campaign

## Phase 4 (16+) – Governance & Ecosystem
- ☐ Governance Token distribution model
- ☐ EcoChain DAO (treasury, grants)
- ☐ Ecosystem grant framework
- ☐ Multi-asset expansion (soil, kelp, wetlands)
- ☐ Standards alignment (Verra / Gold Standard exploration)

## Cross-Cutting Backlog (Any Phase)
- ☐ Gas optimization passes (storage layout, event pruning)
- ☐ Panic / catastrophic revert plan (tree mass-destroy script)
- ☐ Data retention policy (IPFS pinning redundancy)
- ☐ Rate formula transparency site (open models)

## Risk Register (Snapshot)
| Risk | Impact | Mitigation |
|------|--------|------------|
| Oracle centralization early | Trust | Open-source formula + logs |
| Fraudulent tree data | Token dilution | Periodic revalidation; staking/slashing later |
| Marketplace illiquidity | Farmer revenue | Fee incentives + staking integration |
| Satellite false positives | Unfair destruction | Multi-source consensus threshold |
| Regulatory shifts | Listing disruption | Modular compliance layer design |

## KPIs (Initial Targets)
- Time to approve tree < 24h
- Claim tx success rate > 99%
- Average tree revalidation interval: 90 days
- Marketplace daily volume growth MoM > 15%

## Documentation To Maintain
- CHANGELOG.md
- /docs/rate_models.md
- /docs/security_audit_prep.md
- /docs/api/indexer.md

---
Update this file per sprint; treat unchecked items as backlog groomed weekly.
