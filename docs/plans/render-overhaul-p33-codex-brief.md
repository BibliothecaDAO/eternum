# Render overhaul P3.3 — Codex brief

Motto: **KISS, always. Systemic fixes over point patches.**

Context: first live-game playtest (Blitz world, real tx traffic) exposed a responsiveness class our spectate-based gates
never measured. Items 1–3 are corrections to uncommitted P3.1/P3.2 work already in this tree. Items 4–7 are the
live-play responsiveness fixes. Items 8–9 are polish. Land 1–3 first.

Governing principle for everything here: **spread ambient/bulk work; apply player-initiated and single-logical events
atomically.** Batching must never be visible in the result of one action.

---

## P0 — corrections to in-tree work

### 1. Initial-phase refresh retry (review finding F1, MEDIUM)

`worldmap-warp-travel-refresh.ts` gives `initial` only 1 attempt. With the new honest commit statuses, a benign
supersession race during entry (subscriptions + RECS replay are armed _before_ `refreshScene`; live tx traffic can
schedule a refresh that stale-drops the initial switch) now returns `false` → throw → the lifecycle **rethrows on
initial** → `hasInitialized` stays false → boot hangs at "Waiting for world map".

**Fix:** `attemptCount = 2` for both phases. Flip the "keeps initial entry fail-closed without retrying" test. Still
fail-closed: two false attempts throw.

**Gate:** cold entry into a live world with active tx traffic never hangs; supersession during entry self-heals on the
retry.

### 2. Drop the visibility toggle in new-model prewarm

`requestNewModelPipelinePrewarm` (worldmap.tsx ~1360) sets `object.visible = false` on model load and restores it when
the prefetch-lane slot _launches_ the compile — not when the compile completes. Result: loaded, instanced content
(armies re-apply instances before the prewarm request; biome models via `onBiomeModelLoaded`) is invisible for the queue
delay, and the first-render stall is not prevented anyway. Worst of both worlds; likely the "buildings/content appear
late" playtest feel.

**Fix:** remove the visibility toggling entirely. Just launch the background compile; it races first render. Keep the
prefetch-lane scheduling and the single-object `compileAsync(object, camera, scene)` path — those are right.

**Gate:** no loaded model is ever hidden by the prewarm path; grep gate: no `visible = false` in
`requestNewModelPipelinePrewarm`.

### 3. Restore atomic structure count application

`finalizeVisibleStructureModelPass` (structure-manager.ts) now awaits **one frame-budget slot per model** for
`setCount`, serially. A provisioned realm touches many model types, so its tile pops in over several frames — the
"appears in several bursts" playtest report. `setCount` is cheap; the split bought nothing.

**Fix:** apply **all** `setCount` calls + `hideStaleModels` + bounds/endBatch in **one** queued task (the pre-split
shape). Keep the `hideStaleModels` improvement (only zeroing models leaving the active set).

**Gate:** a newly provisioned realm's structures/decor appear in one frame once its data is applied.

---

## P1 — live-play responsiveness

### 4. Ingest slicing: one logical event = one visible step

`packages/core/src/sync/entity-ingest-queue.ts` slices at `MAX_ENTITY_CHANGES_PER_STORE_WRITE = 50` changes per store
write. Measured apply cost is 9–18ms against the 100ms gate — we slice ~5× more aggressively than the budget requires,
so a realm provision (~hundreds of entities) becomes 3–6 visible steps.

**Fix:** drop the count cap (or raise it high enough to be a runaway backstop only, e.g. 1000); keep the **time** budget
as the real limiter (~25ms per slice). A typical logical event then applies in one slice.

**Gate:** `maxBatchApplyDurationMs` stays ≤ 50ms under live traffic; a realm provision renders in one burst, not
several.

### 5. Army movement: unlock input on confirmation, not on torii echo

Two playtest symptoms, one machinery:

- Army snaps back to origin and replays the move when the tx echo arrives (optimistic lock failed to suppress a stale
  authoritative position).
- Army with full stamina is input-locked "until the sync goes through" — `isArmyMovementActionUnavailable`
  (worldmap.tsx:3680) gates on `hasUnresolvedOptimisticMovement`, which only clears on a matching torii echo or the 30s
  fallback (`authoritativePendingArmyMovementMs`, worldmap.tsx:811).

**Fix (behavior):**

- Input gate = movement tween still playing OR move tx not yet confirmed. Once the tx is confirmed, the optimistic
  position _is_ the authoritative position — stop gating input on the torii entity echo. Keep the position lock itself
  for stale-echo suppression.
- Reduce the stale fallback 30s → 8s (block-time-scaled).

**Fix (instrumentation, DEV):** log every authoritative position application for an entity holding an optimistic lock:
`[ArmyLock] entity=… applied|suppressed authoritative=(x,y) lock=(src→dst) reason=…`. Suspects for the snap-back: torii
preconfirmed fallback emitting a pre-move echo the lock matching misses, or the P2 dirty-flush presentation path
bypassing the lock check. Fix what the log convicts; do not guess-fix the matcher.

**Gate:** after a move's tween completes and its tx is confirmed, the army is immediately movable again; no
snap-back-and-replay in a session of successive move/explore actions (verify with the lock log).

### 6. Event-message stream recovery (root cause of the chest hang)

`SubscribeEventMessages` died with `ERR_HTTP2_PROTOCOL_ERROR` and never re-subscribed;
`[GameSyncMetrics] totalLiveEventUpdates` stayed **0** for the entire session. Everything event-driven is silently dead
after the first stream failure. Entry points: `client/apps/game/src/dojo/torii-stream-lifecycle-observer.ts`,
`gamewide-sync-adapter.ts`.

**Fix:** give the event-message subscription the same failure-detection + re-subscribe-with-backoff treatment as the
entity stream, and log stream health transitions (`[Sync] event stream lost/restored`). (Server-side nginx/torii HTTP2
config for this route is being handled separately — client recovery is required regardless.)

**Gate:** kill the event stream mid-session (dev-tools network block) → it re-subscribes within seconds of the route
recovering; `totalLiveEventUpdates` > 0 after chain events fire.

### 7. Relic chest reveal fallback

`chest-container.tsx:363` — the reveal waits exclusively on a live `OpenRelicChestEvent` component update. With the
event stream dead, the tx succeeds, resources land via the entity stream, and the modal spins forever.

**Fix:** after `open_chest` succeeds, if no matching event arrives within ~10s, fetch the `OpenRelicChestEvent` for this
explorer/chest via a direct torii query and run the same reveal path. Never infinite-load.

**Gate:** with the event stream blocked, opening a chest still reveals the relics within ~10s.

---

## P2 — polish

### 8. Hexception predictive prewarm

Only the worldmap calls `prewarmPipeline()`. The first local-mode switch pays raw on-render pipeline compiles — while
the worldmap's timed-out warm-up is still compiling in the background and contending for the same serial driver compile
path. That's the "first local switch is very long" report.

**Fix:** once the worldmap announces ready, kick the **hexception** scene's `prewarmPipeline()` in the background
(fire-and-forget; it is already memoized + time-boxed). Never gate the visible scene transition on it.

**Gate:** first local switch after ~30s on the worldmap shows no multi-second freeze;
`[GpuBackendPerf] pipeline prewarm` logs appear for both scenes.

### 9. No shadows on the unexplored void

Tall structures cast large shadows across unexplored (fog) hexes at close zoom — the dark ground plane has
`receiveShadow = true` (`hexagon-scene.ts` `createGroundMesh`). Visual artifact only; shadows are not the frame-spike
cause (verify with the spike log, don't remove shadows wholesale).

**Fix:** `mesh.receiveShadow = false` on the ground/fog plane. Explored terrain tiles keep receiving shadows.

**Gate:** at max zoom-in, no shadow renders on unexplored hexes; shadows on explored terrain unchanged.

---

## Validation (all items)

- Focused tests per touched module; full suite (known flake: `instanced-model.material-semantics`).
- Typecheck, format, knip.
- Playtest gates: entry <10s always; one-burst provisioning; army re-movable on confirmation; chest reveals with event
  stream blocked; no void shadows; first local switch smooth after worldmap idle.
