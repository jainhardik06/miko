# Miko Development Checklist (Adapted Phase 0 -> Phase 1)

## Phase 0: Foundation & Prototyping (Weeks 1–6)
### Week 1: Setup & Architecture
- [ ] Team roles assigned (Lead, Contracts, Frontend, Design)
- [ ] Project board created (link: TBD)
- [ ] Discord/Slack channel created
- [ ] Repos initialized (`miko-contracts`, `miko-dapp`) – (PoC combined here)
- [ ] Technical whitepaper draft started
- [ ] TreeNFT data schema finalized (geo, species, age, metadata_uri, rate_ppm)
- [ ] IPFS provider chosen (Pinata/Fleek/Web3.Storage)

### Weeks 2–3: Smart Contracts (Core)
- [ ] Roles module (admin/oracle/validator)
- [ ] CCT coin module init & mint
- [ ] TreeNFT mint + claim accrual logic
- [ ] Marketplace (ESCROW VERSION PENDING) – current PoC placeholder
- [ ] Unit tests for init/mint/claim

### Weeks 4–5: dApp Basic Interface
- [ ] Wallet connect (Petra/Martian)
- [ ] Mint Tree form (uploads metadata to IPFS)
- [ ] My Trees dashboard (pending accrual + claim action)
- [ ] Basic marketplace browse & list

### Week 6: Testing & Internal Demo
- [ ] Deploy to Devnet
- [ ] End-to-end test path executed
- [ ] Internal demo & feedback notes logged

## Phase 1: MVP (Months 2–4)
- [ ] Marketplace escrow redesign (lock seller CCT, fee distribution)
- [ ] Admin verification workflow (pending->approved tree requests)
- [ ] Centralized oracle service computing rate_ppm
- [ ] User profiles & registration metadata
- [ ] Enhanced dashboard charts (offset totals)
- [ ] Contract security review (internal + external audit slot booked)
- [ ] Testnet deployment & beta onboarding

## Phase 2+: (See roadmap) Highlights
- [ ] CCT staking
- [ ] Insurance pool
- [ ] Validator decentralization path
- [ ] AI photo species/health model integration
- [ ] Public transparency dashboard + 3D globe

---
This checklist will be updated as tasks move from PoC into production readiness. Maintain this as the single authoritative progress artifact.
