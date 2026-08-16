# P4 — systemic consolidation (sync + render) — Codex brief

Motto: **KISS, always. Systemic fixes over point patches.**

Context: P3.1–P3.4 stopped the bleeding with correct point fixes, but the live sessions exposed three systemic roots
that keep _generating_ those symptoms. This phase fixes causes so the symptom classes die. Sequencing matters: **item 0
is time-sensitive** (it can replace P3.4 item 3 before that hold heuristic gets built), item 1 is small and kills two
live symptom classes, items 2–3 are the big rocks (2 is sync-side, 3 is render-side — they can proceed in parallel).

Success criterion for this phase is **deletion**: the bespoke fallbacks, holds, TTLs, and timers we accumulated should
mostly disappear because the layer beneath them became trustworthy.

Infra dependency (not Codex): the nginx/torii HTTP2 config causing `ERR_HTTP2_PROTOCOL_ERROR` on long-lived streams is
being fixed on the deploy side, independently. Client work below is required regardless.

---

## 0. Torii update ordering → ingest monotonicity (DO FIRST — may replace P3.4 item 3)

The P3.4 source_match hold is a heuristic for detecting stale echoes. The generic fix is ordering: **check whether torii
entity-subscription payloads expose a monotonic version** (block number, event id, `updated_at` — inspect the actual
grpc/wasm payload, not the SQL schema).

- **If yes:** enforce per-entity monotonicity in `packages/core/src/sync/entity-ingest-queue.ts` — drop any update older
  than the last-applied version for that entity, count drops in GameSyncMetrics. This kills the stale-echo class for
  _every_ entity type, not just locked armies, and it is a perfect discriminator for the treasure-roll case: a
  coord=source update with a _newer_ version is genuinely authoritative (rewind correct); an older one is stale
  (dropped). The P3.4 source_match hold then becomes unnecessary — don't build it, or delete it if built.
- **If no:** document exactly what the payload carries, keep the hold heuristic, and note the torii-side feature request
  so we can revisit.

**Gate:** with monotonicity on, a session of successive army moves logs zero stale-echo applications; drop counter
visible in GameSyncMetrics.

## 1. Event feed: gap-fill replay on reconnect (revised P3.4 item 7)

The recovering event subscription restores the _pipe_ but loses every event fired during a gap — which is why chest and
battle-FX each needed bespoke fallbacks. Fix it once at the feed layer:

- Track the timestamp/cursor of the last event received (`recovering-torii-event-subscription.ts` /
  `gamewide-sync-adapter.ts`).
- On every (re)subscribe — **including lease renewals** — query `getEventMessages` for events since that mark and replay
  them through the normal handler path, deduped (consumers already dedupe: battle by `entityId-timestamp`, chest by
  explorer+coords). Log `[Sync] event gap-fill replayed N events`.
- Policy, applied here: **persistent world state renders from entities; events drive only ephemera.** Move the battle-FX
  clear (`resolvePendingAttackFxOnBattleUpdate`) to entity-stream evidence — battle resolution is entity-visible state.
  Keep the 45s stale timeout as last resort only. Add `[PendingFx] start/clear key=… reason=…` DEV logging so the
  reported forever-persisting decals can be convicted if anything survives this fix.

**Gate:** block the event route for 60s mid-session while opening a chest and finishing a battle → on recovery both
resolve within seconds via replay, no per-feature fallback involved; `[PendingFx]` shows a normal clear reason, never
`stale_timeout`, in ordinary play.

## 2. Optimistic state unification (sync-side big rock)

Evidence: we currently run **five parallel hand-rolled optimistic implementations** — army position locks + TTL (+ the
P3.4 hold), pending-movement records with a fallback timer that fires routinely, the pending-stamina store, tile-manager
building overrides that the overhauled render path no longer observes (the missing optimistic buildings bug), and
nothing at all for chests. Every army bug this week (snap-back, frozen input, 8s unlocks) was reconciliation scatter
between these channels.

**Rule:** optimistic writes flow through the **same ingest/update path as authoritative data**, tagged provisional and
bound to a tx handle; reconciliation is centralized on the tx lifecycle (submitted → provisional applied via the normal
path; confirmed → provisional held until the authoritative echo — or item 0's version — supersedes it; failed → reverted
through the same path). Renderers and UI never learn a second channel: if it's in the store, it renders.

**Scope (KISS — migrate, don't rewrite):**

- **2A.** Build the single provisional-write API in the sync layer (one module; applies a change through the existing
  ingest path with a provisional tag + tx handle; confirm/revert centralized).
- **2B.** Migrate **buildings first** — smallest surface, and it fixes the optimistic-building bug _by construction_
  (the provisional write is renderer-visible because it uses the normal path).
- **2C.** Migrate armies — then delete the bespoke machinery piece by piece: input gating derives from provisional-tx
  state; stale-echo suppression comes from item 0 / central reconciliation; the lock maps, hold timers, and fallback
  timeouts go away.
- **2D.** Fold in the pending-stamina store.

**Gates:** building appears ≤1 frame after placement via the unified path and reverts cleanly on tx failure; army
move/attack flows work with the bespoke lock/fallback logs gone; **net-negative LOC** across the optimistic machinery;
no regression on the P3.4 gates.

## 3. Material & texture consolidation (render-side big rock — the compile root cause)

Every warm-up mechanism we built (time-box, background continuation, hexception pre-kick, per-model compiles) manages
the _cost_ of compilation without shrinking it. The session data names the cause:

```
MaterialPool Stats: Unique Materials: 84 • Total References: 87 • Sharing Ratio: 1.0:1
```

A pool sharing nothing — nearly every model carries a unique material, each spawning its own shader programs × shadow ×
morph variants. That is _why_ a full warm-up is 45–120s of serial compiles and why new models still cost pipeline
spikes. Likewise the endless one-off `285x51` UUID label textures behind the `createBindings=132x` spike frames.

- **3.1** Audit why the pool shares nothing (materials likely differ only by texture reference or stray per-model
  params). Normalize so models with identical shader shape share one material instance. Target: unique materials well
  under half of current, sharing ratio ≥ 2:1.
- **3.2** Label texture atlas (long-standing backlog): pack label textures into shared atlas pages, labels reference UV
  regions. Kills per-label texture + binding creation.
- **3.3** Measure with the instrumentation we now have: pipeline count and `[GpuBackendPerf] pipeline prewarm` duration
  before/after on the same machine.

**Gates:** warm-up duration at least halved on the same machine; sharing ratio ≥ 2:1; no label-driven `createBindings` >
50/frame spikes; zero visual diffs (screenshot comparison on a fixed scene).

---

## Deferred, on record (do not build now)

Refresh convergence semantics: `completeWorldmapInteractiveRefresh`'s retry (attemptCount = 2) papers over callers being
unable to distinguish "superseded but world converged" from "failed". If this class bites a third time, the fix is
awaiting _convergence at some authoritative chunk_ rather than _my-transition-committed_ — not a third attempt.

## Validation

- Focused tests per touched module; full suite (known flake: `instanced-model.material-semantics`); typecheck, format,
  knip. Core sync suite for items 0/1/2.
- Live gates per item as above. For item 2, run the full P3.4 live gate list again — the point fixes' behavior must
  survive their machinery being replaced.
