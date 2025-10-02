# Miko Architecture (Phase 0 PoC)

## Domain Overview
Miko is a decentralized carbon credit marketplace on Aptos with a two‑token model:
- **Tree Digital Twin (TreeNFT)**: Non-fungible representation of a real tree / plot. Stores immutable + mutable metadata references (geo, species, age, photos hash, status).
- **Carbon Credit Token (CCT)**: Fungible token representing 1 ton (configurable) of CO₂ offset over a standardized period.

Farmers mint TreeNFTs after validator approval. Each TreeNFT accrues CCTs over time at a rate determined by an Oracle formula. Farmers claim accrued CCTs, optionally list them for sale in a marketplace where industries purchase to offset emissions.

## Core On‑Chain Modules (PoC Scope)
1. **roles.move** (lightweight role registry)
   - Admin address (set at publish).
   - Oracle / Validator capability assignment by Admin.
2. **tree_nft.move**
   - Struct `Tree` with: id, owner, created_at_sec, last_claim_sec, rate_ppm (CCT micro‑units per second), status (Active/Paused/Destroyed), metadata_uri (points to IPFS JSON), cumulative_claimed.
   - Mint only after `Validator` approval (simulated in PoC by Admin / Oracle call `approve_and_mint`).
   - Functions: `request_tree` (register intent + metadata), `approve_and_mint`, `pause_for_reverify`, `destroy_tree` (catastrophic), `set_rate` (Oracle), `pending_cct` (view), `claim_cct` (mints CCT to owner and updates accounting).
3. **cct.move**
   - Fungible token resource using Aptos `fungible_asset` standard (or legacy coin in PoC for simplicity).
   - Admin creates the coin, Oracle module mints via capability exposed to `tree_nft` module only.
4. **marketplace.move**
   - Simple order book (fixed‑price listings) for CCT.
   - Listing struct: id, seller, amount, unit_price, created_at.
   - Functions: `list(amount, unit_price)`, `buy(listing_id, amount)` handling partial fills, fee take (configurable platform_fee_bps to Admin treasury).

## Off‑Chain Components (Phase 0)
- **Oracle / Validator Panel (centralized)**: Web admin page to review tree requests, set rates, trigger pause/destroy.
- **IPFS Pinning Service**: Stores tree metadata JSON + images (hash saved on-chain as `metadata_uri`).
- **Indexing Service (optional)**: Index events (TreeMinted, RateSet, TreeDestroyed, ListingCreated, TradeExecuted) into a DB for fast UI queries.

## Data Flow (Farmer Journey)
1. Farmer submits tree data -> `request_tree(metadata_uri)` emits `TreeRequested` (off-chain queue).
2. Validator reviews off-chain, calculates initial rate (using formula incorporating species, age, health) -> calls `approve_and_mint(tree_id, rate_ppm)`.
3. Tree accrues CCT linearly: pending = (now - last_claim) * rate_ppm / 1_000_000.
4. Farmer calls `claim_cct(tree_id)` -> CCT minted to wallet.
5. Farmer lists tokens: `marketplace::list(amount, price)`.
6. Buyer purchases -> transfers CCT; fee portion to Admin treasury account.

## Event & Accounting Considerations
- Events for transparency; indexer consumes.
- Rate changes logged with old/new values.
- Destroy / pause halts accrual by freezing `last_claim_sec` update semantics.

## Catastrophic Event Handling
- `destroy_tree(tree_id, reason_hash)` sets status to Destroyed; future claims return zero.
- Optional later: insurance pool smart contract consuming a % fee to reimburse.

## Security & Trust (PoC Simplifications)
- Centralized Oracle & Validator (admin keys) initially.
- No slashing / staking yet.
- Basic access control; future upgrade to decentralized governance + multi-sig.

## Token Economics (Early Assumptions)
- 1 CCT == 1 ton CO₂ (configurable constant in code for display; true certification may require alignment with standards later).
- Linear accrual; no decay or retroactive adjustments in PoC.
- Platform fee basis points (e.g., 200 = 2%) configurable by Admin.

## Future Evolution Hooks
- Replace centralized Oracle with DON feed updating rates and catastrophic flags.
- Dynamic NFT art derived from health metrics (metadata updates + off-chain renderer service).
- Staking & future yield tokenization modules referencing locked CCT balances.
- DAO governance controlling fee, validator onboarding, insurance pool parameters.

## Directory / Package Plan
```
move/
  Move.toml
  sources/
    roles.move
    tree_nft.move
    cct.move
    marketplace.move
```
Frontend integrates via Aptos SDK to call entry functions & read view functions; metadata + images via IPFS gateways.

## Minimal Rate Formula (PoC)
Will hardcode: rate_ppm = base * species_factor * health_factor.
Off-chain computes and passes resolved `rate_ppm` integer; on-chain stores only the resolved number to keep logic simple initially.

## Glossary
- rate_ppm: micro CCT units per second (parts per million) to allow fractional accrual without floating point.
- metadata_uri: IPFS URI or HTTPS fallback.

---
Phase 0 scope intentionally limited to accelerate hackathon delivery while leaving clear upgrade paths.
