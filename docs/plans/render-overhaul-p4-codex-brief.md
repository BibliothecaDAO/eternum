# P4 — systemic consolidation (sync + render) — Codex brief, v2

Motto: **KISS, always. Systemic fixes over point patches. Success is deletion.**

v2 incorporates the pre-implementation code review: torii exposes no entity revision, provisional writes must be an
overlay (never raw `setEntities`), the material target is exact-content sharing (not shader-shape instance sharing), and
the building-override read already landed in P3.4 (now a regression gate). Decisions ratified: (1) accept the
no-torii-revision outcome — keep the source-match hold until P4C centralizes it, and record the torii feature request;
(2) chests get event recovery only — no provisional tile-occupancy removal; (3) exact-material sharing with a direct
compiled-pipeline-count metric, label atlas as its own slice.

Work lands in slices, in order. Each slice is independently shippable and gated.

---

## P4A — feed integrity

**Torii limitation record.** The wasm entity callback payload is `{hashed_keys, models}` only — no block number, event
id, or cursor. Document this (one paragraph in `docs/architecture/sync-s2-recovery-contract.md` or alongside) with the
feature request we want upstream: a monotonic per-entity version in subscription payloads. Client-side monotonic ingest
is NOT implementable honestly today; do not fake it.

**Event gap-fill replay (watermark, not cursor).** Events carry a second-resolution u64 timestamp; subscriptions expose
no server cursor. Design:

- On initial subscription, establish a latest-event baseline without replaying historical effects.
- Before every replacement or lease renewal, freeze the previous watermark.
- Subscribe first, then query backward inclusively to that watermark.
- Replay through the existing handler path, deduped by `model:hashed_keys:timestamp`.
- Count replayed events in GameSyncMetrics; log `[Sync] event gap-fill replayed N events`.
- **Delete the chest-specific `getEventMessages` fallback once this lands** — it currently mis-decodes torii's wrapped
  `{type, value}` field shape anyway (live evidence: "The indexed chest result did not match this chest"), so delete it
  rather than fix it.

**Chest reveal conviction logging.** In the Aug 16 post-TLS session, `totalLiveEventUpdates` incremented right after
`open_chest` completed and the reveal still did not fire from the live listener — the subscription-path match itself may
be failing. Add a DEV log in the `OpenRelicChestEvent` listener printing received vs expected
`explorer_id`/`chest_coord` so one chest attempt convicts the mismatch, and fix what it names.

**Entity-driven pending battle-FX clearing.** The spatial projection intentionally ignores troop counts and cooldowns,
so its army callback cannot prove battle completion. Clear pending attack FX on direct RECS evidence instead:
`ExplorerTroops` troop-count or battle-cooldown change, or `Structure` guard-count/cooldown change. Carry
attacker/defender actor kinds in the pending-FX payload so IDs cannot be confused across entity classes. The 45s timeout
stays as last resort; `[PendingFx] start/clear key=… reason=…` DEV logging included.

**Gate:** block the event route 60s mid-session while opening a chest and finishing a battle → on recovery both resolve
within seconds via replay; `stale_timeout` never appears as a clear reason in ordinary play; gap-fill replay counter
visible in metrics.

## P4B — provisional foundation + buildings

**Precise semantics (ratified).** Provisional writes are an overlay, never raw `setEntities` (that would overwrite
authoritative RECS state un-revertibly):

- One provisional manager owned by `GameSyncRuntime`.
- RECS **overrides** remain the overlay mechanism — observable by projections/renderers without corrupting the
  authoritative base.
- The sync runtime owns applying/removing overrides and observes raw authoritative batches after their base write
  completes.
- Create a pre-transaction intent handle; bind the transaction hash after submission.
- Reconciliation compares only the provisional patch fields — never entire component objects.
- Input locks depend on submitting/pending transaction state only. A confirmed write awaiting its torii echo stays
  rendered but never freezes input.
- Animation, travel FX, and arrival ghosts remain ephemeral visual state — do not force them into the authoritative
  store.

**Migrate buildings and resource/count overrides first.** P3.4 already made override-only buildings visible through the
bounded TileManager read — that behavior is now a **regression gate**, and P4B replaces its hand-written cleanup timers
with the centralized reconciler.

**Gate:** building appears ≤1 frame after placement via the unified overlay, reverts cleanly on tx failure, no flicker
on confirmation; the P3.4 building path's bespoke timers are deleted; net-negative LOC in the migrated area.

## P4C — armies + stamina

Move coordinate and stamina through one provisional `ExplorerTroops` patch. Delete the army lock maps, pending-movement
fallback timers, and the pending-stamina store; retain visual lifecycle state (tweens, path renderer, ghosts) as
ephemera. The source-match stale-echo heuristic moves from army-specific code into the centralized reconciler — same
semantics, one home.

**Gate:** successive move/explore/attack play with zero snap-backs and immediate re-selectability on confirmation;
`[ArmyLock]`-era machinery deleted; all P3.4 army gates still pass.

## P4D — exact material consolidation

Asset audit (measured): 120 GLBs, 297 source materials, 14 shader-feature shapes, 57 exact material/content signatures.
The pool's 84/1.0:1 stat undercounts the problem (embedded textures fall back to random three.js UUIDs) and two
materials with different texture content can never share an instance — the map belongs to the material.

- Fingerprint embedded texture content during the asset pipeline.
- Share only exact materials: texture content + rendering parameters.
- Normalize shader feature flags to reduce pipeline variants (the 14 shapes are the pipeline lever).
- Extend pooling coverage beyond armies/cosmetics to structures and biomes.
- Measure compiled pipeline count directly, before/after, plus `[GpuBackendPerf] pipeline prewarm` duration on the same
  machine.

**Gate:** ≥2:1 exact-material sharing; compiled pipeline count reduced and reported; warm-up duration meaningfully down
on the same machine; zero visual diffs (fixed-scene screenshot comparison).

## P4E — label atlas

Shared canvas pages and materials, per-label UV geometry, atlas uploads coalesced per frame. No custom WebGPU shader.
Kills per-label texture + binding creation (the `createBindings=132x` spike frames and the one-off `285x51` UUID
textures).

**Gate:** no label-driven `createBindings` > 50/frame spikes; label visuals unchanged; independently measurable and
visually reviewable.

---

## Deferred, on record (do not build now)

Refresh convergence semantics: `completeWorldmapInteractiveRefresh`'s retry (attemptCount = 2) papers over callers being
unable to distinguish "superseded but world converged" from "failed". If this class bites a third time, the fix is
awaiting convergence at some authoritative chunk — not a third attempt.

## Validation

- Focused tests per touched module; full suite (known flake: `instanced-model.material-semantics`); typecheck, format,
  knip. Core sync suite for P4A–P4C.
- Each slice re-runs the live gates of the point fixes it replaces — behavior must survive its machinery being deleted.
