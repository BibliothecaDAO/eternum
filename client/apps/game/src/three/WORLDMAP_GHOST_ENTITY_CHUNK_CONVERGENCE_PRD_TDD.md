# Worldmap Ghost Entity Chunk Convergence PRD / TDD

## Status

- Status: Proposed for implementation
- Scope: `client/apps/game/src/three/scenes/worldmap.tsx`
- Scope: `client/apps/game/src/three/scenes/worldmap-refresh-commit-runtime.ts`
- Scope: `client/apps/game/src/three/scenes/worldmap-committed-chunk-manager-catchup.ts`
- Scope: `client/apps/game/src/three/scenes/warp-travel-chunk-switch-commit.ts`
- Scope: worldmap chunk commit ordering, visible entity catch-up, and ghost-state recovery

## Problem Statement

The worldmap currently commits visible terrain before the visible entity managers necessarily converge to the same chunk
token.

That separation is survivable when the follow-up manager fanout lands immediately, but it becomes visible under staged
streaming and recovery refreshes:

1. hydration prepares terrain for the current chunk
2. the scene commits terrain and bounds
3. the visible scene can still contain stale building or unit presentation from the previous commit
4. the deferred manager fanout catches up later, or a second repair refresh is needed

This creates the player-facing ghost state:

- new terrain with stale units
- repaired terrain with stale buildings
- recovery paths that fix terrain first and leave entity presentation one phase behind

## Findings From The Trace

### Stable facts

1. Asset loading is not the primary suspect.
   - chunk hydration prewarms structure assets before terrain preparation
   - `ArmyManager` and `StructureManager` preload required models before binding instances

2. Terrain presentation commits before visible manager convergence.
   - committed chunk switches apply prepared terrain before staged manager catch-up
   - same-chunk refreshes apply prepared terrain before staged manager catch-up

3. Same-chunk refresh is the weakest path.
   - staged streaming defers the refresh manager catch-up
   - route reload, duplicate-tile repair, offscreen recovery, and terrain self-heal all reuse that path

4. The code already carries anti-ghosting guardrails.
   - armies have suppressed-visual, stale-position, deferred-removal, and recovery-refresh logic
   - structures defer world bounds until after instance rebuild and fence async visible passes

### Most important implication

The system needs a stronger visible-commit contract, not a loader rewrite:

> once terrain for the visible chunk is committed, the visible building and unit managers must converge to the same
> chunk token before the refresh or switch is considered complete

## Goals

### User goals

- Visible chunk repairs must not leave ghost units or ghost buildings behind.
- Hard reload into the map route must not show terrain from one commit and entities from another.
- Recovery refreshes must converge the scene instead of only repairing terrain.
- Panning or self-heal should not require an extra follow-up refresh to make entities match terrain.

### Engineering goals

- Define a single visible-commit contract for terrain plus critical visible managers.
- Preserve staged streaming for non-critical/background work.
- Keep chunk/token ownership deterministic.
- Improve diagnostics around visible commit convergence.

## Non-goals

- Reworking GLTF/model loading
- Changing chunk geometry, fetch area size, or prefetch policy
- Disabling staged streaming globally
- Rewriting the army or structure spatial indices

## Proposed Behavior

### Visible commit contract

For any commit that changes the visible worldmap terrain:

1. commit authority and terrain
2. update chunk bounds
3. immediately reconcile the critical visible managers
4. only then resolve the switch or refresh promise
5. defer non-critical manager work afterward

### Critical vs non-critical managers

- Critical visible managers
  - `ArmyManager`
  - `StructureManager`

- Deferred non-critical manager
  - `ChestManager`

### Chunk switch behavior

Committed chunk switches should:

1. keep authority ownership exactly where it is today
2. commit terrain before manager work
3. immediately await army catch-up
4. immediately await structure catch-up
5. schedule chest catch-up on the staged deferred queue

### Same-chunk refresh behavior

Committed same-chunk refreshes should:

1. keep the current stale-token and stale-chunk drop rules
2. commit terrain for the current chunk
3. immediately await army catch-up
4. immediately await structure catch-up
5. schedule chest catch-up on the staged deferred queue

### Failure behavior

If immediate critical catch-up fails:

1. record explicit critical-manager diagnostics
2. log the failing manager label and chunk key
3. keep the committed terrain in place
4. schedule one guarded `visibility_recovery` refresh on the next turn of the event loop
5. reuse the existing chunk-recovery cooldown and dedupe behavior

## Architecture

## 1. Make visible chunk commits atomic for critical managers

Visible commit completion means:

- terrain committed
- bounds applied
- army visuals reconciled
- structure visuals reconciled

## 2. Preserve staged streaming for non-critical work

The deferred queue remains, but its correctness responsibility narrows to non-critical work:

- chest catch-up
- future non-critical managers if added later

## 3. Keep token ownership unchanged

Do not loosen:

- `shouldRunManagerUpdate(...)`
- `shouldAcceptManagerChunkRequest(...)`
- manager pass fences
- structure deferred-bounds logic
- army suppressed and stale-position logic

The fix is ordering, not token semantics.

## 4. Add targeted diagnostics

Add critical-manager diagnostics so we can answer:

- did terrain commit before critical managers converged
- how long critical convergence took
- which manager failed when ghosting is reported

## Implementation Plan

### Step 1. Add this PRD / TDD doc

Create `WORLDMAP_GHOST_ENTITY_CHUNK_CONVERGENCE_PRD_TDD.md`.

### Step 2. Add critical manager catch-up helpers

In `worldmap.tsx` add:

- `updateCriticalManagersForChunk(...)`
- `deferNonCriticalManagerCatchUpForChunk(...)`

### Step 3. Change committed-switch catch-up policy

Update `catchUpCommittedWorldmapChunkManagers(...)` so staged mode performs:

- immediate critical catch-up
- deferred non-critical catch-up

### Step 4. Change same-chunk refresh catch-up policy

Update `handleWorldmapRefreshCommitRuntime(...)` so staged mode performs:

- immediate critical catch-up
- deferred non-critical catch-up

### Step 5. Keep deferred queue only for non-critical managers

Retain the existing queueing and budget logic, but only enqueue chest catch-up from the visible commit path.

### Step 6. Add the user-facing feature note

Add a top entry to `latest-features.ts` describing the fix from the player’s perspective.

## TDD Plan

## Red phase

Add or update tests that assert:

1. committed switch catch-up runs critical managers immediately and only defers non-critical work
2. staged same-chunk refresh runs critical managers immediately after terrain commit
3. critical manager failure records failure and schedules one recovery refresh
4. diagnostics track critical manager catch-up starts, failures, and durations
5. worldmap wiring uses the new critical/deferred split

## Green phase

Implement the smallest clean orchestration change that satisfies those tests.

## Refactor phase

Keep orchestration readable:

- visible commit helpers orchestrate
- runtime helpers encode the staged-policy split
- deferred queue helpers only queue non-critical work
- diagnostics helpers record diagnostics

## Verification

Targeted tests:

- `worldmap-committed-chunk-manager-catchup.test.ts`
- `worldmap-fast-commit-manager-catchup.test.ts`
- `worldmap-refresh-commit-runtime.test.ts`
- `warp-travel-chunk-switch-commit.test.ts`
- `worldmap-critical-manager-catchup-runtime.test.ts`
- `worldmap-critical-manager-catchup.wiring.test.ts`

Broader checks:

- `pnpm run format`
- `pnpm run knip`

## Expected Outcome

After the fix:

- visible terrain repair no longer resolves before visible units and structures do
- route reload and self-heal stop producing mixed terrain/entity frames that can persist as ghosts
- the post-commit queue still exists, but it no longer owns correctness for visible armies and buildings
- the loading sequence stays largely the same; correctness improves because visible commit ordering is stricter
