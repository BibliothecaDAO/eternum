# Render overhaul P3.4 — Codex brief

Motto: **KISS, always. Systemic fixes over point patches.**

Context: P3.3 review passed with one finding; a full live-play session with the new `[ArmyLock]` and spike
instrumentation produced hard convictions for the remaining symptoms. Every item below is evidence-backed from that
session — no speculative work.

---

## 1. Never block a scene transition on prewarm (P3.3 review finding R1)

`scene-manager.ts:96` still **awaits** `scene.prewarmPipeline?.()` inside the visible transition. Switching to local
view before the background warm-up finishes blocks the transition for the remainder of the 10s time-box.

**Fix:** fire-and-forget at that site (`void scene.prewarmPipeline?.()`). While there, kick the fast-travel scene's
prewarm in the background alongside hexception's at worldmap-ready (`prewarmHexceptionPipelineInBackground`,
worldmap.tsx ~4215) so no scene is left cold.

**Gate:** scene transitions fade in without waiting on compilation, even when triggered seconds after entry.

## 2. Restore optimistic building placement (hexception)

Clicking **+** on a building (and confirming placement) must render the building immediately, as it did before the sync
overhaul. The optimistic override machinery still runs — the session log shows
`tile-manager.ts:457 "removing overrides"` — so the write side works; the hexception building rendering no longer
_reacts_ to the override.

**Investigate:** how hexception building visuals consume `Building`/tile state now. Suspects: the renderer listens on a
path that only fires for torii-applied updates (ingest queue) and misses direct RECS `overrideComponent` writes; or the
game-scope entity filter drops override entities. Fix the systemic gap (override writes must flow through the same
update path as authoritative writes), not a special case for farms.

**Gate:** building appears within one frame of the placement action; reverts cleanly if the tx fails; authoritative
confirmation causes no flicker.

## 3. Army snap-back: `source_match` false positives (convicted)

Five occurrences in one session (entities 19075, 18812, 19073, 18808, 19081), all the same shape:

```
[ArmyLock] entity=19081 applied authoritative=(4,-6) lock=(4,-6→4,-7) reason=source_match
```

A stale echo of the army's pre-move position (typically the _previous_ move's destination) matches the new lock's source
and triggers the deliberate rewind built for the treasure-roll no-move case. Follow-on breakage observed:
`Army 18808 no longer available for movement` right after its rewind.

**Fix:** defer the `source_match` rewind instead of executing it immediately. Hold it briefly (~2–3s, or until the next
authoritative echo for that entity): if a `target_match` echo follows, discard the held rewind (it was stale data); if
the window passes with no target echo — the treasure-roll case, where coord=source _is_ the final state — honor it. Log
both outcomes (`source_match_discarded_stale` / `source_match_honored`).

**Gate:** a session of successive moves shows zero rewinds during successful moves; a genuine no-move outcome still
snaps back within the hold window.

## 4. Armies should unlock at tx confirmation, not the 8s fallback

The log shows `[DEBUG] Cleared stale pending movement for army X via fallback timeout` firing routinely (19075, 19079,
18812, 19077, 18810) — the normal cleanup path (`handleTransactionComplete` → `deletePendingArmyMovementTx` →
`prunePendingArmyMovementIfEmpty`) is not clearing records, so input stays locked until the 8s fallback instead of ~2.5s
confirmation.

**Investigate:** why `prunePendingArmyMovementIfEmpty` keeps the record alive after the tx hash is deleted (surviving
`movement` sub-record? `awaitingVisualCompletion` never cleared when the tween finished first?). Fix the lifecycle so
confirmation + completed tween = pruned record.

**Gate:** successive-move play shows no fallback-timeout logs; an army is re-selectable immediately after its tween
completes and its tx confirms.

## 5. Kill the 20–40MB allocation on every army move

Every move start logs both:

```
🗺️ WorldMap Memory Spike: +35.3MB in worldmap-moveArmy-start-19083
🪖 Army Model Memory Spike: +37.8MB in startMovement-19083
```

This correlates with 100–300ms spike frames and GC pressure throughout the session. Something in
`moveArmy`/`ArmyModel.startMovement` allocates tens of MB per move (candidate classes: dense path sampling,
instance-buffer or matrix-array cloning, per-move animation state rebuild).

**Fix:** find it with a heap allocation profile of one move, then make it incremental or pooled.

**Gate:** the memory-spike logs no longer fire for a routine move (<5MB delta); the move-start frame stays under 33ms.

## 6. Profile the ambient no-GPU spikes (profile first, then fix top offenders)

Steady-state play shows recurring 40–90ms frames attributed as `no GPU backend hot paths` or trivial
`updateAttribute=4x/0.0ms`, plus 15× `[Violation] 'setInterval' handler took <N>ms`. The GPU backend is convicted
innocent — this is main-thread JS.

**Approach:** one DevTools performance profile during active play (moves + automation running). Identify the top 1–2
long-task sources (candidate classes: a heavy `setInterval` handler, React commits driven by per-second tx-store
updates, automation planning). Fix only what the profile convicts; bring the evidence into the PR description.

**Gate:** steady play (no chunk transition, no move burst) shows fewer than one >33ms spike per 10 seconds.

---

Out of scope (handled on the infra side, not client code): the recurring
`ERROR: Insufficient transaction data … Required: 10 transactions` fee-estimation spam — chain/RPC config on the
appchain, not a client defect.

## Validation

- Focused tests per touched module; full suite (known flake: `instanced-model.material-semantics`); typecheck, format,
  knip.
- Live gates: instant local-switch transition; optimistic building appears on click; zero false-positive rewinds; armies
  unlock at confirmation; no move-start memory spikes; ambient spike rate under gate.
