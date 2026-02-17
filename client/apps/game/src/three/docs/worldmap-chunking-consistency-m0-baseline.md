# Worldmap Chunking Consistency M0 Baseline

## Metadata

- Milestone: M0 (Baseline and Test Harness Setup)
- PRD: `client/apps/game/src/three/docs/worldmap-chunking-consistency-prd.md`
- Captured: 2026-02-17

## Baseline Snapshot

### Current Test Footprint

1. Scene test files under `src/three/scenes`: `15`
2. Manager test files under `src/three/managers`: `9`

### Known Fragile Test Pattern (Source-Shape Assertions)

Status:

1. The two identified high-risk regex/source-shape tests were replaced with behavior tests in this milestone:
   1. `client/apps/game/src/three/scenes/worldmap-lifecycle.test.ts`
   2. `client/apps/game/src/three/scenes/worldmap-update-explored-hex.integration.test.ts`
2. Additional regex/source-shape tests outside this focused chunking slice were not evaluated in this document.

### Runtime Chunk Paths Not Directly Covered by Scene Behavior Tests

No direct scene behavior tests currently target orchestration methods such as:

1. `getRenderAreaKeyForChunk`
2. `getRenderFetchBoundsForArea`
3. `updatePinnedChunks`
4. `performChunkSwitch`
5. `updateToriiBoundsSubscription`
6. `computeTileEntities`

## M0 Deliverables Completed in This Change

### D1: Reusable Async Harness Utility for Scene-Orchestration Tests

Added:

1. `client/apps/game/src/three/scenes/worldmap-test-harness.ts`

Provided primitives:

1. `createDeferred`
2. `flushMicrotasks`
3. `createControlledAsyncCall`

Purpose:

1. Deterministic control of async boundaries for upcoming scene-level chunk switch tests.

### D2: Harness Validation Tests

Added:

1. `client/apps/game/src/three/scenes/worldmap-test-harness.test.ts`

Coverage:

1. Deferred stays pending until explicit resolve.
2. Controlled async call captures call order and resolves FIFO.
3. Controlled async call throws on invalid resolve without pending calls.

Validation command executed:

1. `pnpm --dir client/apps/game test src/three/scenes/worldmap-test-harness.test.ts`
2. Result: pass (`1` file, `3` tests)

### D3: Chunk Orchestration Fixture Seam for Behavior Tests

Added:

1. `client/apps/game/src/three/scenes/worldmap-chunk-orchestration-fixture.ts`
2. `client/apps/game/src/three/scenes/worldmap-chunk-orchestration-fixture.test.ts`

Coverage:

1. Verifies chunk-switch orchestration starts tile fetch + bounds switch before awaiting grid update.
2. Verifies failed tile fetch path skips manager updates and marks rollback behavior.
3. Uses controlled async fixtures (no source-regex assertions) for deterministic runtime sequencing checks.

Validation commands executed:

1. `pnpm --dir client/apps/game test src/three/scenes/worldmap-chunk-orchestration-fixture.test.ts`
   1. RED phase observed first with missing-module failure.
2. `pnpm --dir client/apps/game test src/three/scenes/worldmap-test-harness.test.ts src/three/scenes/worldmap-chunk-orchestration-fixture.test.ts`
   1. GREEN phase pass (`2` files, `5` tests).

### D4: First Regex-to-Behavior Test Replacement

Updated:

1. `client/apps/game/src/three/scenes/worldmap-update-explored-hex.integration.test.ts`

Added:

1. `client/apps/game/src/three/scenes/worldmap-update-explored-hex-fixture.ts`

What changed:

1. Replaced source-regex assertions with behavior assertions for duplicate-tile reconcile outcomes:
   1. immediate strategy -> `updateVisibleChunks(true)`
   2. deferred strategy -> `requestChunkRefresh(true)`
   3. none strategy -> no refresh path

Validation commands executed:

1. `pnpm --dir client/apps/game test src/three/scenes/worldmap-update-explored-hex.integration.test.ts`
   1. RED phase observed first with missing-module failure.
   2. GREEN phase pass after minimal fixture implementation.
2. `pnpm --dir client/apps/game test src/three/scenes/worldmap-test-harness.test.ts src/three/scenes/worldmap-chunk-orchestration-fixture.test.ts src/three/scenes/worldmap-update-explored-hex.integration.test.ts`
   1. Combined pass (`3` files, `8` tests).

### D5: Second Regex-to-Behavior Test Replacement (Lifecycle)

Updated:

1. `client/apps/game/src/three/scenes/worldmap-lifecycle.test.ts`

Added:

1. `client/apps/game/src/three/scenes/worldmap-lifecycle-fixture.ts`

What changed:

1. Replaced source-regex assertions with behavior assertions for:
   1. stable listener attach/detach identity
   2. switch-off short-circuit for `updateVisibleChunks`
   3. switch-off short-circuit for `requestChunkRefresh`
   4. destroy reusing switch-off cleanup path

Validation commands executed:

1. `pnpm --dir client/apps/game test src/three/scenes/worldmap-lifecycle.test.ts`
   1. RED phase observed first with missing-module failure.
   2. GREEN phase pass after minimal fixture implementation.
2. `pnpm --dir client/apps/game test src/three/scenes/worldmap-test-harness.test.ts src/three/scenes/worldmap-chunk-orchestration-fixture.test.ts src/three/scenes/worldmap-update-explored-hex.integration.test.ts src/three/scenes/worldmap-lifecycle.test.ts src/three/scenes/worldmap-lifecycle-policy.test.ts`
   1. Combined pass (`5` files, `16` tests).

### D6: Diagnostics Baseline Capture Helper Extraction

Added:

1. `client/apps/game/src/three/scenes/worldmap-chunk-diagnostics-baseline.ts`
2. `client/apps/game/src/three/scenes/worldmap-chunk-diagnostics-baseline.test.ts`

Updated:

1. `client/apps/game/src/three/scenes/worldmap.tsx` now routes baseline snapshot/capture cloning through the extracted helper.

Coverage:

1. Label sanitization and fallback behavior.
2. Snapshot cloning semantics.
3. Baseline append + max-cap trimming behavior.
4. Baseline deep clone semantics for debug snapshots.

Validation command executed:

1. `pnpm --dir client/apps/game test src/three/scenes/worldmap-chunk-diagnostics-baseline.test.ts src/three/scenes/worldmap-chunk-diagnostics.test.ts src/three/scenes/worldmap-lifecycle.test.ts src/three/scenes/worldmap-update-explored-hex.integration.test.ts src/three/scenes/worldmap-chunk-orchestration-fixture.test.ts src/three/scenes/worldmap-test-harness.test.ts`
   1. Combined pass (`6` files, `23` tests).

## Pre-M1 Runtime Baseline Capture Runbook

Status:

1. Completed on 2026-02-17 (UTC) in a live worldmap dev session.

Artifacts:

1. `.context/worldmap-pre-m1-baseline.json`
2. `.context/worldmap-pre-m1-baseline.png`

Captured summary (`pre-m1-start` -> `pre-m1-end`):

1. `transitionStarted`: `0` -> `1`
2. `transitionCommitted`: `0` -> `1`
3. `transitionRolledBack`: `0` -> `0`
4. `tileFetchStarted`: `0` -> `4`
5. `tileFetchFailed`: `0` -> `0`
6. `refreshRequested`: `0` -> `91`
7. `switchDurationMsMax`: `0` -> `1708.5999999046326`

Steps:

1. Start dev client and open worldmap in browser.
2. In browser console:
   1. `window.resetWorldmapChunkDiagnostics?.()`
   2. `window.captureWorldmapChunkBaseline?.("pre-m1-start")`
3. Execute a repeatable traversal routine (pan/zoom/chunk-boundary movement) for 2-3 minutes.
4. Capture end baseline:
   1. `window.captureWorldmapChunkBaseline?.("pre-m1-end")`
   2. `const snapshot = window.getWorldmapChunkDiagnostics?.();`
5. Persist the snapshot to a local artifact file (recommended: `.context/worldmap-pre-m1-baseline.json`) for milestone comparison.

Validation commands executed:

1. `export PATH=/Users/os/.nvm/versions/node/v22.22.0/bin:$PATH && corepack pnpm --dir client/apps/game dev --host 127.0.0.1 --port 4173`
2. `node .context/browser-run/capture-pre-m1.js`

## Next M0 Work Items

1. M0 close checklist complete.
2. Status reflected in PRD update log; next active milestone is M1 hardening.
