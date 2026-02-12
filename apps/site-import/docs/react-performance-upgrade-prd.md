# PRD: Realms World Frontend Performance and Dependency Modernization

## 1. Document Control
- Product: `realms-world-site` (`istanbul-v3`)
- Owner: Frontend Engineering
- Date: February 11, 2026
- Status: In Progress
- Related branch: `ponderingdemocritus/prd-high-priority`

## 2. Context and Problem Statement
The current site has excellent visual richness but carries frontend performance and maintenance risk:

- Production bundles are oversized and trigger chunk warnings during build.
- Dev-only tooling is included in the app shell path.
- Core dependencies are materially behind latest stable versions.
- Lint quality gate is red, creating delivery risk for future changes.

These issues increase load latency on slower devices/networks and raise the cost of future feature delivery.

## 3. Baseline (Current State)
From `pnpm build` baseline on this branch before implementation:

- Largest JS assets:
  - `dist/assets/index-C0Wt1sHc.js`: `1,059.50 kB` (gzip `327.05 kB`)
  - `dist/assets/index-D-G9--gZ.js`: `647.05 kB` (gzip `181.92 kB`)
- Build warning: chunks larger than `500 kB`.

Dependency baseline:
- Outdated packages: `45` total (`26` prod, `19` dev)
- Major upgrades pending: `11`
- Deprecated package present: `@types/react-helmet-async`

Quality baseline:
- `pnpm lint`: failing (`12` errors, `11` warnings)

## 4. Goals
1. Reduce initial payload and improve route-level load behavior.
2. Ensure development tooling is excluded from production runtime path.
3. Re-establish a green quality gate for lint/build.
4. Create a safe, staged package modernization plan.

## 5. Non-Goals
- Full redesign of page visuals or content architecture.
- Migration from Vite to another framework.
- Major runtime library migrations in one shot (e.g. Starknet v3->v5 + Zod v3->v4 simultaneously).

## 6. Users and Impact
- End users: faster first interactive experience and lower data usage.
- Engineering: lower regression risk and clearer upgrade runway.
- Product/ops: fewer deployment surprises, better performance predictability.

## 7. Requirements

### 7.1 Functional Requirements
1. Home route must support lazy loading of below-the-fold sections.
2. Router devtools must only load in development.
3. Build should complete without introducing new runtime errors.
4. Existing navigation and route behavior must remain unchanged.

### 7.2 Non-Functional Requirements
1. Performance:
  - Remove >500 kB warning from main entry chunks or materially reduce largest chunks.
2. Reliability:
  - `pnpm build` must pass after each priority implementation wave.
3. Maintainability:
  - Dependency upgrades must be staged by risk.

## 8. Scope by Priority

### P0 (Start Immediately)
1. Isolate dev-only tooling from production shell.
2. Introduce lazy boundaries for heavy homepage sections.
3. Preserve current UX behavior and SEO metadata.

### P1 (Next)
1. Resolve lint errors/warnings that indicate real behavior risk.
2. Normalize duplicate query keys and data-fetch strategy.
3. Remove deprecated and unused dependencies.

### P2 (Later, Controlled Waves)
1. Toolchain major upgrades (`vite`, `eslint`, plugins).
2. Runtime major upgrades (`@starknet-react/*`, `zod`, `recharts`) with targeted regression plans.

## 9. Implementation Plan

### Milestone A: Bundle and Shell Safety (P0)
- Deliverables:
  - Devtools dynamic import + dev-only render.
  - Home section lazy imports with suspense fallbacks.
- Validation:
  - Compare `pnpm build` chunk table before/after.

### Milestone B: Quality Gate Recovery (P1)
- Deliverables:
  - Fix lint errors in `use-velords`, chart typing, OG API typing, unused schemas.
  - Stabilize high-churn hooks/effects.
- Validation:
  - `pnpm lint` passes.
  - `pnpm build` still passes.

### Milestone C: Low-Risk Dependency Refresh (P1)
- Deliverables:
  - Remove deprecated types package.
  - Upgrade minor/patch packages only.
- Validation:
  - Lint/build pass.
  - Smoke-check key routes (`/`, `/games`, `/games/:slug`).

### Milestone D: Major Upgrade Waves (P2)
- Deliverables:
  - Execute majors in isolated PRs by domain (toolchain/runtime/data libs).
- Validation:
  - Per-wave migration checklist and focused regression checks.

## 10. Success Metrics

### Primary
1. Largest initial JS chunk reduced by at least `30%` from baseline.
2. No devtools code path in production build.
3. `pnpm lint` and `pnpm build` both green.

### Secondary
1. No route behavior regressions on `/`, `/games`, `/games/:slug`.
2. Dependency risk profile reduced (deprecated packages removed, outdated minors reduced).

## 10.1 Progress Snapshot (After P0 Start)
- Build status: passing.
- Lint status: still failing (`12` errors, `11` warnings), unchanged from baseline.
- Bundle shape after P0 changes:
  - App shell entry chunk: `121.27 kB` (gzip `41.03 kB`)
  - `react-vendor`: `185.46 kB` (gzip `58.52 kB`)
  - `tanstack-vendor`: `106.99 kB` (gzip `34.12 kB`)
  - `motion-vendor`: `122.02 kB` (gzip `40.52 kB`)
  - `starknet-vendor`: `485.77 kB` (gzip `145.13 kB`)
- Result:
  - Previous single >1 MB app shell is eliminated.
  - Rollup chunk-size warning is eliminated (largest chunk now < 500 kB).

## 11. Risks and Mitigations
- Risk: Over-aggressive splitting causes loading jank.
  - Mitigation: section-level fallbacks and progressive lazy boundaries.
- Risk: Major upgrades break wallet/data integrations.
  - Mitigation: isolate majors into dedicated waves and regressions by area.
- Risk: Lint fixes alter behavior.
  - Mitigation: small focused commits and build verification after each wave.

## 12. Rollout and Verification
1. Implement P0.
2. Run `pnpm build` and compare bundle outputs.
3. Run `pnpm lint` to quantify remaining scope.
4. Continue with P1 in small slices until quality gate is green.

## 13. Work Started (This PR)
- [x] PRD authored.
- [x] P0 started: devtools isolated from production path.
- [x] P0 started: homepage heavy sections moved behind lazy boundaries.
- [x] P0 validation complete (post-change build comparison).
- [ ] P1 lint/error remediation started.
