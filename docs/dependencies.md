# Dependency Strategy (Miko)

## Frontend Core
- React 18.x selected for immediate compatibility with current wallet adapter & react-three-fiber versions.
- Plan: Audit React 19 readiness once wallet adapter and R3F publish stable peer ranges. Target upgrade window: Phase 1 late / Phase 2 early.

## 3D & Animation Stack
- `three` pinned (`^0.159.x`) aligned with `@react-three/fiber` 8.15.x and `@react-three/drei` 9.88.x.
- Upgrade Strategy: Bump minor/patch together after verifying breaking changes (mesh-bvh, WebGPU flags) in a feature branch with visual regression screenshots.

## Aptos SDK & Wallet
- Using `@aptos-labs/ts-sdk` latest major (5.x) for stable API surface.
- Wallet adapter: Generic extension detection only (Petra / Martian plugin packages unavailable under expected scope). Future: integrate official plugin packages or Identity Connect when publicly stable & accessible.

## Move Toolchain
- Contracts kept minimal; friend functions used for modular separation (request/oracle). Will consolidate friend declarations or adopt capability pattern in Phase 1.
- Introduce property-test style fuzzing (if available) in Phase 2 for accrual invariants.

## Version Pinning Philosophy
- Pin major & minor where upstream churn is high (3D stack, wallet adapters).
- Allow caret for ecosystem-safe libs (zustand, framer-motion) to pick up bug fixes.

## Security & Audit Considerations
- Before mainnet: lock to exact versions (`~` or exact) and maintain SBOM; conduct dependency vulnerability scan per CI run.

## Planned Near-Term Changes
| Area | Action | Trigger |
|------|--------|---------|
| Wallet Plugins | Add Petra/Martian adapters | When packages resolvable via npm (no 404) |
| Listing Enumeration | Add on-chain view for listings | Needed for marketplace UI |
| React 19 | Migrate & re-test 3D + animations | After wallet adapter peer update |
| R3F/Three | Bump to latest minor | After React 19 migration stable |

## Upgrade Checklist Template
1. Create branch `upgrade/<area>`.
2. Bump versions in `package.json`.
3. Run type check & build.
4. Manual smoke (wallet connect, polling, claim, 3D scene render).
5. Update `docs/dependencies.md` with new versions & rationale.
6. Open PR with changelog snippet.
