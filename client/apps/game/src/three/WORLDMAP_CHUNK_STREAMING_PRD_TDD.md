# Worldmap Chunk Streaming Smoothness PRD + TDD

Status: Draft
Date: 2026-03-18
Scope: `client/apps/game/src/three`
Primary surfaces: worldmap chunk refresh scheduling, chunk boundary policy, directional prefetch, terrain preparation and cache replay, manager fanout, diagnostics, regression gating

## 1. Summary

This document converts the current worldmap chunk-switching review into a staged delivery plan with product requirements, technical design, file-level scope, and test-first implementation steps.

The core conclusion from the review is:

- the worldmap already has the right structural seams for a low-risk streaming upgrade
- the current lag is mostly orchestration lag, not a missing rendering primitive
- the highest-value change is to promote chunk prefetch from `data-ready` to `presentation-ready`
- the chunk switch path should optimize for first visible commit, not for "all work finished"

The plan below uses a milestone approach so that each stage:

- ships a measurable improvement
- preserves rollback paths
- adds tests before behavior changes
- reduces risk before changing the core switch critical path

## 2. Problem Statement

The current worldmap chunk system already has chunk policies, directional prefetch, chunk diagnostics, cache replay, and a prepare/commit split. Despite that, movement between chunks still feels laggy because the runtime optimizes for correctness and convergence, not for first visible response.

### 2.1 Refresh scheduling introduces visible latency

- chunk refreshes are debounced before execution
- the runtime serializes on the previous global chunk switch before reevaluating the current camera position
- camera-driven chunk changes therefore feel delayed under sustained movement

### 2.2 The chunk switch critical path is too wide

- the switch path waits for tile fetch, tile hydration drain, Torii bounds switch, structure hydration drain, and structure asset prewarm before the terrain preparation phase can finish
- this means the first visible terrain commit inherits the slowest secondary dependency
- manager fanout is also included in the end-to-end switch lifecycle

### 2.3 Prefetch is not presentation-ready

- directional prefetch currently warms tile fetches only
- likely-next chunks do not have prebuilt terrain matrices or warmed structure assets ready for an atomic swap
- the matrix cache helps when a chunk was already visible, but it does not proactively prepare the next chunk

### 2.4 Boundary policy is underpowered for smooth traversal

- the active chunk switch delay is a small anchor-based padding check
- the repo already contains a stronger hold-band hysteresis policy, but it is not driving the active switch logic
- this keeps the system more sensitive to boundary timing and refresh scheduling than it needs to be

### 2.5 Diagnostics do not yet isolate first-paint latency

- chunk diagnostics track full switch duration and manager duration
- they do not currently separate:
  - request-to-terrain-ready time
  - terrain commit time
  - manager catch-up time
- that makes the smoothness target harder to optimize directly

## 3. Goals

### 3.1 Product goals

- make chunk boundary crossings feel materially more immediate during camera travel
- reduce visible hitching and "late swap" perception when entering a new chunk
- preserve current correctness guarantees for stale transitions, rollback, and latest-wins scheduling
- avoid increasing pop-in or stale-entity artifacts while smoothing terrain transitions

### 3.2 Technical goals

- shorten the time from chunk-crossing intent to first visible terrain commit
- prebuild likely-next chunks into cache before the camera actually crosses
- move non-critical follow-up work out of the first visible commit path
- strengthen chunk boundary hysteresis without increasing chunk thrash
- expose first-visual-commit metrics and regression gates in diagnostics

## 4. Non-goals

- rewriting worldmap traversal outside `client/apps/game/src/three`
- replacing the current chunk geometry model or chunk key contract
- changing gameplay rules, pathfinding, or Dojo/Torii data ownership
- redesigning world visuals beyond what is required to reduce transition hitching
- moving terrain generation to workers before the main-thread orchestration issues are addressed

## 5. Architecture Assessment

The current architecture is a good fit for staged streaming work and should be preserved.

- `worldmap.tsx` already centralizes refresh scheduling, prefetch enqueue/drain, chunk switching, terrain caching, and diagnostics.
- `warp-travel-chunk-hydration.ts` and `warp-travel-chunk-switch-commit.ts` already separate prepare and commit responsibilities.
- `worldmap-chunk-presentation.ts` gives a clean seam for splitting critical readiness from secondary readiness.
- `worldmap-prefetch-queue.ts` and directional prefetch policy already provide a prioritization seam.
- the matrix cache and prepared terrain path already support hot replay when a chunk is cached.
- `worldmap-chunk-diagnostics.ts` and the debug hook plumbing already support measurable regression gates.

The plan should build on those seams rather than introducing a parallel streaming system.

## 6. Proposed Strategy

Implement `presentation-ready chunk streaming`.

That means the runtime should treat the next likely chunk as a hot standby surface:

1. fetch and hydrate its data early
2. prewarm its structure assets early
3. prepare and cache its terrain presentation early
4. swap to that prepared terrain immediately when the camera crosses
5. let managers and labels reconcile after the terrain becomes visible

In practical terms, the runtime should optimize for:

- first visible terrain commit
- bounded follow-up work
- latest-wins stale-drop behavior
- cache-aware look-ahead preparation

This is the same general pattern used in open-world streaming, map tile engines, and traversal-heavy RTS/worldmap renderers: keep the current chunk on screen, prepare the next chunk off the visible critical path, and only block first paint on what the player can actually perceive.

## 7. Success Metrics

### 7.1 Perceived smoothness metrics

- reduce chunk `request -> first visible terrain commit` p95 by at least 35% against the current baseline
- reduce chunk `request -> first visible terrain commit` max spikes during directional traversal
- keep chunk boundary transitions visually atomic for terrain, with no zero-terrain frames introduced by the new flow

### 7.2 Correctness metrics

- no stale transition applies terrain or manager state after a later transition token wins
- rollback still restores previous terrain and bounds correctly on fetch failure
- no increase in duplicate-tile or stale-visibility regressions

### 7.3 Efficiency metrics

- no more than a 10% increase in tile fetch volume versus baseline for equivalent traversal paths
- bounded prewarm memory growth relative to existing matrix cache policy
- bounded manager catch-up work per frame after terrain commit

### 7.4 Diagnostics metrics

- debug hooks expose separate samples for:
  - switch request to terrain ready
  - terrain commit duration
  - manager catch-up duration
- regression helpers can compare first-visible-commit p95, not just full switch p95

## 8. Rollout Stages

| Stage | Name | Primary outcome |
| --- | --- | --- |
| 0 | Observability and baseline split | Make first-paint cost measurable |
| 1 | Boundary policy and scheduler responsiveness | Reduce artificial trigger latency |
| 2 | Presentation-ready prewarm | Make likely-next chunks hot before crossing |
| 3 | Fast terrain commit and deferred manager catch-up | Shorten visible critical path |
| 4 | Budgeted follow-up work and upload-aware throttling | Keep post-commit work from hitching frames |
| 5 | Regression hardening and rollout controls | Protect the gains and simplify rollback |
| 6 | Deferred experiments | Optional worker/off-main-thread follow-up only if needed |

### Delivery Tracker

- [ ] Stage 0: Observability and baseline split
- [ ] Stage 1: Boundary policy and scheduler responsiveness
- [ ] Stage 2: Presentation-ready prewarm
- [ ] Stage 3: Fast terrain commit and deferred manager catch-up
- [ ] Stage 4: Budgeted follow-up work and upload-aware throttling
- [ ] Stage 5: Regression hardening and rollout controls
- [ ] Stage 6: Deferred experiments behind measured need

## 9. Detailed Stages

### 9.1 Stage 0: Observability and Baseline Split

#### Objective

Measure the chunk path in the way the player feels it: first visible terrain commit first, manager completion second.

#### Scope

- add chunk diagnostics for:
  - request-to-terrain-ready
  - terrain commit duration
  - manager catch-up duration
  - prepared-chunk prewarm hits and misses
- expose those metrics through the existing worldmap debug hooks
- extend regression helpers to compare first-visible-commit p95

#### Files to change

- `client/apps/game/src/three/scenes/worldmap-chunk-diagnostics.ts`
- `client/apps/game/src/three/scenes/worldmap-chunk-latency-regression.ts`
- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/perf/worldmap-render-diagnostics.ts`
- `client/apps/game/src/three/scenes/worldmap-chunk-diagnostics.test.ts`
- `client/apps/game/src/three/scenes/worldmap-chunk-latency-regression.test.ts`

#### TDD plan

Write tests first:

1. diagnostics records separate samples for terrain-ready, terrain-commit, and manager-catch-up durations
2. regression evaluator can compare first-visible-commit p95 independently from full switch duration
3. debug hook snapshot includes the new metrics and sample arrays
4. prewarm hit/miss counters roll up correctly

Implementation steps:

1. extend diagnostics types and event recording
2. record timing boundaries around prepare, commit, and deferred manager fanout
3. expose the new state through existing debug globals only
4. add helper evaluation for first-visible-commit regression

Exit criteria:

- baseline capture includes first-visible-commit samples
- a manual traversal session can inspect the new timings from the debug hooks
- no existing diagnostics tests regress

### 9.2 Stage 1: Boundary Policy and Scheduler Responsiveness

#### Objective

Reduce the amount of perceived lag before a chunk switch even starts.

#### Scope

- replace the current tiny anchor padding gate with a proper hold-band hysteresis policy
- reduce or make dynamic the camera-driven chunk refresh debounce
- keep latest-wins semantics and stale-drop behavior intact
- avoid increasing boundary thrash

#### Files to change

- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/scenes/worldmap-chunk-switch-delay-policy.ts`
- `client/apps/game/src/three/scenes/worldmap-chunk-hysteresis-policy.ts`
- `client/apps/game/src/three/scenes/warp-travel-chunk-runtime.ts`
- `client/apps/game/src/three/scenes/worldmap-chunk-switch-delay-policy.test.ts`
- `client/apps/game/src/three/scenes/worldmap-chunk-hysteresis-policy.test.ts`
- new: `client/apps/game/src/three/scenes/warp-travel-chunk-runtime.scheduler.test.ts`

#### TDD plan

Write tests first:

1. no chunk switch is requested while focus remains inside the hold band
2. chunk switch is requested promptly once focus exits the hold band
3. shortcut navigation still bypasses hysteresis when force semantics require it
4. refresh scheduler uses lower latency for boundary-driven switches without reintroducing redundant refresh storms
5. latest-wins rerun logic still supersedes stale scheduled refreshes

Implementation steps:

1. route visible-chunk decision through the hysteresis policy instead of only the current anchor padding gate
2. keep anchor-based delay only if it still adds value after hysteresis, otherwise remove it
3. make debounce policy explicit, with smaller latency for traversal updates than for generic forced refreshes
4. preserve the existing stale-token and rerun semantics

Exit criteria:

- traversal produces fewer delayed chunk triggers
- boundary oscillation does not increase chunk thrash
- scheduler tests prove stale requests do not win

### 9.3 Stage 2: Presentation-Ready Prewarm

#### Objective

Upgrade prefetch from `data-ready` to `presentation-ready`.

#### Scope

- extend directional prefetch and pinned-neighborhood preparation so likely-next chunks can become hot standby chunks
- prewarm:
  - tile fetch and hydration
  - structure hydration
  - structure assets
  - terrain preparation and cache storage
- reuse the existing prepared terrain and matrix cache paths rather than introducing a second cache model

#### Files to change

- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/scenes/worldmap-prefetch-queue.ts`
- `client/apps/game/src/three/scenes/worldmap-directional-prefetch-policy.ts`
- `client/apps/game/src/three/scenes/warp-travel-chunk-hydration.ts`
- `client/apps/game/src/three/scenes/worldmap-chunk-presentation.ts`
- `client/apps/game/src/three/scenes/worldmap-upload-budget-policy.ts`
- `client/apps/game/src/three/managers/structure-manager.ts`
- `client/apps/game/src/three/scenes/worldmap-prefetch-queue.test.ts`
- `client/apps/game/src/three/scenes/worldmap-directional-prefetch-policy.test.ts`
- `client/apps/game/src/three/scenes/warp-travel-chunk-hydration.test.ts`
- `client/apps/game/src/three/managers/structure-manager.chunk-prewarm.test.ts`
- new: `client/apps/game/src/three/scenes/worldmap-presentation-prewarm.test.ts`

#### TDD plan

Write tests first:

1. queued prewarm work skips chunks whose presentation is already hot
2. directional prefetch can enqueue presentation prewarm work distinct from tile-fetch-only work
3. presentation prewarm writes to the existing terrain cache without mutating the current visible terrain
4. prewarm respects latest-wins chunk ownership and does not commit stale presentation
5. asset prewarm for a chunk dedupes concurrent requests
6. upload-budget helpers can classify prewarm work separately from visible commit work

Implementation steps:

1. introduce explicit prefetch work kinds or stages instead of a single tile-fetch boolean
2. order prefetch priority as:
   - current-chunk correctness work
   - pinned neighborhood
   - forward directional band
3. after successful fetch and hydration, prepare terrain and cache it ahead of time
4. bound how many presentation-ready chunks are retained beyond the existing pinned floor
5. thread upload-aware heuristics into the prewarm scheduler

Exit criteria:

- forward traversal shows repeated cache-hit prepares for likely-next chunks
- the current visible terrain is never replaced by prewarm alone
- memory remains bounded by policy

### 9.4 Stage 3: Fast Terrain Commit and Deferred Manager Catch-up

#### Objective

Make first visible terrain commit the primary switch milestone, and move manager catch-up out of the critical path.

#### Scope

- split critical readiness from secondary readiness
- commit terrain as soon as the target chunk is safe and presentation-ready
- schedule manager fanout after the terrain swap, ideally on the next frame or a small post-commit queue
- preserve rollback and stale-drop correctness

#### Files to change

- `client/apps/game/src/three/scenes/worldmap-chunk-presentation.ts`
- `client/apps/game/src/three/scenes/warp-travel-chunk-hydration.ts`
- `client/apps/game/src/three/scenes/warp-travel-chunk-switch-commit.ts`
- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/scenes/warp-travel-manager-fanout.ts`
- `client/apps/game/src/three/scenes/worldmap-chunk-transition.ts`
- `client/apps/game/src/three/scenes/worldmap-chunk-presentation.test.ts`
- `client/apps/game/src/three/scenes/warp-travel-chunk-hydration.test.ts`
- `client/apps/game/src/three/scenes/warp-travel-chunk-switch-commit.test.ts`
- `client/apps/game/src/three/scenes/worldmap-chunk-transition.test.ts`
- new: `client/apps/game/src/three/scenes/worldmap-fast-commit-manager-catchup.test.ts`

#### TDD plan

Write tests first:

1. terrain commit can occur before manager fanout completes
2. stale transition tokens cannot apply deferred manager work after a newer switch wins
3. rollback still restores previous visuals when fetch fails before commit
4. same-chunk forced refresh can still commit terrain and then run manager catch-up
5. chunk authority changes before deferred manager updates read current state

Implementation steps:

1. split chunk presentation output into:
   - critical presentation readiness
   - secondary manager readiness
2. update switch finalization so it can:
   - set current chunk
   - apply prepared terrain
   - update bounds and visibility
   - schedule manager catch-up
3. keep deferred manager updates cancelable by transition token
4. record separate timing metrics for visible commit and manager completion

Exit criteria:

- switch promise no longer forces first paint to wait for all manager work
- stale deferred work is dropped correctly
- tests prove rollback and same-chunk refresh correctness still hold

### 9.5 Stage 4: Budgeted Follow-up Work and Upload-aware Throttling

#### Objective

Prevent post-commit work from just moving the hitch one frame later.

#### Scope

- add frame-budgeted manager catch-up scheduling where needed
- use the existing upload budget helpers to decide when to defer or spread heavy work
- reduce the chance that a hot terrain swap is followed by a large single-frame upload spike

#### Files to change

- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/scenes/worldmap-upload-budget-policy.ts`
- `client/apps/game/src/three/scenes/warp-travel-manager-fanout.ts`
- `client/apps/game/src/three/perf/worldmap-render-diagnostics.ts`
- `client/apps/game/src/three/perf/renderer-gpu-telemetry.ts`
- `client/apps/game/src/three/scenes/worldmap-upload-budget-policy.test.ts`
- new: `client/apps/game/src/three/scenes/worldmap-post-commit-budgeting.test.ts`

#### TDD plan

Write tests first:

1. oversized post-commit work is deferred rather than executed in one burst
2. manager fanout ordering stays deterministic under budgeting
3. upload budget estimates distinguish cached replay from cold build paths
4. diagnostics reflect deferred versus immediate post-commit work

Implementation steps:

1. use upload byte estimates to classify work before execution
2. introduce a small post-commit scheduler with bounded work per frame
3. keep manager sequencing simple and deterministic
4. surface counters for deferred work so behavior stays observable

Exit criteria:

- no new one-frame hitch replaces the old switch delay
- budgeted work remains deterministic and measurable

### 9.6 Stage 5: Regression Hardening and Rollout Controls

#### Objective

Make the improvement easy to validate, compare, and roll back.

#### Scope

- expand baseline capture and regression helpers around first-visible-commit p95
- gate new behavior behind explicit rollout flags where appropriate
- keep a straightforward fallback to the current all-in-one switch path during rollout

#### Files to change

- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/scenes/worldmap-chunk-diagnostics-baseline.ts`
- `client/apps/game/src/three/scenes/worldmap-chunk-latency-regression.ts`
- `client/apps/game/src/three/scenes/worldmap-tile-fetch-volume-regression.ts`
- `client/apps/game/src/three/scenes/worldmap-runtime-lifecycle.ts`
- `client/apps/game/src/three/scenes/worldmap-chunk-diagnostics-baseline.test.ts`
- `client/apps/game/src/three/scenes/worldmap-chunk-latency-regression.test.ts`
- `client/apps/game/src/three/scenes/worldmap-tile-fetch-volume-regression.test.ts`
- new: `client/apps/game/src/three/scenes/worldmap-streaming-rollout.test.ts`

#### TDD plan

Write tests first:

1. first-visible-commit baselines can be captured and compared
2. tile fetch volume regression checks continue to protect over-prefetching
3. feature-flag fallback keeps the legacy switch path available
4. switch-off and teardown still invalidate pending prewarm and deferred work cleanly

Implementation steps:

1. extend baseline snapshots with the new timing series
2. add rollout flags only at top-level orchestration points
3. ensure switch-off and fetch-generation invalidation cancel prewarm and deferred tasks
4. wire regression helpers into existing debug workflows

Exit criteria:

- new streaming path can be compared against captured baselines
- fallback remains simple enough for fast rollback
- no teardown leaks or stale deferred work survive scene switch-off

### 9.7 Stage 6: Deferred Experiments

#### Objective

Reserve higher-risk follow-up work until the staged main-thread changes are measured.

#### Candidates

- workerized terrain preparation
- deeper prewarm of manager-owned chunk visuals
- larger predictive windows driven by camera velocity
- chunk streaming quality tiers based on device class

#### Rule

Do not start this stage unless Stage 5 data shows the main-thread orchestration changes still leave unacceptable switch p95.

## 10. Test Strategy

The implementation should remain test-first throughout.

### 10.1 Core testing principles

- no production behavior change without a failing test first
- keep tests focused on explicit behavior boundaries
- prefer policy and orchestration tests over broad integration rewrites unless integration coverage is required
- preserve existing stale-token and rollback protections while changing scheduling

### 10.2 Test categories

- policy tests:
  - hysteresis decisions
  - debounce and scheduling decisions
  - upload budget classification
- orchestration tests:
  - prewarm queue behavior
  - terrain-ready versus manager-ready sequencing
  - deferred manager cancellation on stale transition
- regression tests:
  - first-visible-commit p95 comparison
  - tile fetch volume
  - switch-off teardown safety

### 10.3 Manual validation checklist

- pan steadily across several chunk boundaries and verify the terrain swaps earlier than before
- reverse direction near a boundary and verify no visible switch thrash
- use shortcut navigation and confirm it still bypasses normal traversal hysteresis when needed
- inspect debug diagnostics after traversal and compare:
  - switch duration
  - first-visible-commit duration
  - manager catch-up duration
  - prewarm hit/miss counters
- verify no increase in zero-terrain or low-terrain anomaly counters

## 11. Risks and Mitigations

### 11.1 Risk: memory growth from presentation-ready prewarm

Mitigation:

- reuse the existing matrix cache
- cap prepared-ahead retention
- tie retention to current chunk policy and upload budget policy

### 11.2 Risk: stale deferred manager work applies after a later switch

Mitigation:

- make all deferred post-commit work transition-token aware
- keep latest-wins checks in the manager update gate

### 11.3 Risk: smoother switching increases fetch volume

Mitigation:

- keep tile fetch volume regression tests
- prioritize pinned and forward-band work only
- drop obsolete queued work aggressively

### 11.4 Risk: first visible terrain becomes correct before entities are

Mitigation:

- defer managers by a bounded amount only
- keep forced refresh and duplicate-tile repair flows available
- instrument manager catch-up lag directly

## 12. Recommended Delivery Order

If the team wants the best risk-adjusted milestone path, implement in this order:

1. Stage 0: Observability and baseline split
2. Stage 1: Boundary policy and scheduler responsiveness
3. Stage 2: Presentation-ready prewarm
4. Stage 3: Fast terrain commit and deferred manager catch-up
5. Stage 4: Budgeted follow-up work and upload-aware throttling
6. Stage 5: Regression hardening and rollout controls

That order front-loads measurement, then removes artificial latency, then introduces hot standby chunks, and only then changes the commit critical path.

## 13. Open Questions

- should the post-commit manager catch-up be next-frame only, or explicitly frame-budgeted from the start?
- should prewarm include only terrain and structure assets, or also pre-stage manager-owned visual state for armies and chests?
- should the smaller traversal debounce be global, or only enabled when a boundary crossing is imminent?
- is the existing matrix cache size sufficient once forward presentation-ready chunks are retained, or should policy expose a separate prepared-ahead allowance?
