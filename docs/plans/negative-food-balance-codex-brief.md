# Negative food balance — Codex brief

Motto: **KISS, always. Systemic fixes over point patches.**

Context: players report wheat balances displaying negative. Investigation (Aug 18) traced it to the provisional resource
override interacting with food's harvest-on-touch accounting, with reconciliation stalls stretching the visible window
to 30s. Every item below cites its evidence; `logs.txt` at repo root is the convicting session.

How the bug works, end to end:

1. Wheat/Fish display is extrapolated: `stored balance + rate × (tick − last_updated_at)`
   (`packages/core/src/managers/resource-manager.ts:146`). On-chain, accrual is lazy — any spend harvests pending
   production into the stored balance and resets `last_updated_at` first
   (`contracts/l3/game/src/models/resource/resource.cairo:78-94`). So the stored RECS balance is routinely far below the
   displayed balance; the difference is un-harvested accrual.
2. The optimistic patch is accrual-blind and absolute: `resolveOptimisticResourceChangesPatch`
   (`resource-manager.ts:207`) pins `WHEAT_BALANCE = raw stored balance + delta`. A spend validated against the
   displayed balance (e.g. explore food costs, `army-action-manager.ts:120,389,418`) can legally exceed the stored
   balance → the pinned value is negative.
3. RECS overrides shallow-merge per top-level field (`overridableComponent` in `@dojoengine/recs`): the patch touches
   only `WHEAT_BALANCE` + `weight`, so when the authoritative echo lands underneath with a harvest-reset
   `WHEAT_PRODUCTION.last_updated_at`, the extrapolation term collapses to ~0 while the stale negative balance stays
   pinned. The UI shows the raw negative number until the override is removed.
4. Removal takes ≥2.5s by design (`PROVISIONAL_RECONCILIATION_HOLD_MS`, `provisional-write-manager.ts:50`) — and
   `logs.txt` shows dozens of `confirmed provisional intent has not reconciled after 30s` with
   `unmatchedWrites: Array(1)`, i.e. the full stall-tripwire window, routinely.

Wheat-only reports are expected: only continuous-production resources carry accrual large enough for a valid spend to
exceed the stored balance, and wheat is the dominant cost on the most frequent actions.

---

## 1. Make provisional resource patches harvest-aware (primary fix)

The override must predict the post-tx row, mirroring what the chain does: harvest, then apply the delta. Today it
predicts a row the chain will never write (pre-harvest balance + delta).

**Fix:** in `resolveOptimisticResourceChangesPatch` (`resource-manager.ts:207`), for each touched resource that has an
active production row, mirror `SingleResourceStoreImpl::retrieve` (`resource.cairo:78-94`):

- fold the capacity-limited accrued production into the patched balance (reuse the existing display math —
  `_amountProduced` + `_limitProductionByStoreCapacity`; do not write new math),
- include the production struct in the patch with `last_updated_at = currentDefaultTick` (same `getBlockTimestamp()`
  source the display uses) and, for non-continuous resources, `output_amount_left` reduced by the harvested amount,
- add the harvested amount's weight to the weight patch alongside the delta's weight.

The pinned balance then equals `extrapolated balance + delta` — non-negative for any UI-validated spend — and because
the production row is pinned too, the echo landing underneath can no longer change what displays. This also removes the
current ~2.5s downward flicker (harvested accrual visually vanishing) on every action, not just the negative case.

Resources without a production row keep the current patch shape unchanged. Reconciliation evidence is untouched:
`baselineDeltaFields` still compares balance fields against the authoritative baseline.

**Gate:** unit tests in `resource-manager.optimistic-update.test.ts`:

- producing wheat row with stale `last_updated_at`, stored balance below the spend → patch balance ≥ 0 and equal to
  extrapolated − cost; patch contains the production row with `last_updated_at` = current tick;
- apply the patch as an override, then write an authoritative echo underneath with a fresh `last_updated_at` → composed
  `balanceWithProduction` never dips below the pinned prediction and never goes negative.

Run with `pnpm exec vitest run` in `packages/core` (bare `pnpm test` there is watch mode).

## 2. Re-evaluate reconciliation matches when the tx hash binds

Baseline-delta evidence is discarded while `transactionHashAtMs === undefined` (`provisional-write-manager.ts:326`), and
a write's match is only re-evaluated on the _next_ observation of that row. If the Torii echo races `account.execute()`
returning the hash (realistic with preconfirmed indexing), the first echo is wasted and an otherwise-idle structure gets
no second Resource update inside 30s → the stalls in `logs.txt`.

**Fix:** in `bindTransaction` (`provisional-write-manager.ts:173`), re-run `updateWriteMatch` for every write that has
an accumulated `authoritativePatch` — the merged patch is already stored on the write, so this is local and cheap. Add a
dev-only log when an observation is evaluated with no bound hash, so the next `logs.txt` convicts any remaining stall
cause by name (the stall message already carries unmatched model names).

**Gate:** unit test in `provisional-write-manager.test.ts`: observe a qualifying echo _before_ `bindTransaction`, then
bind → the write matches with no further observations. Live session: `not reconciled after 30s` count drops to ~zero
during normal play.

## 3. Clamp the sibling extrapolation math

`calculateResourceProductionData` already floors negative tick deltas with a comment acknowledging the case
(`resource-manager.ts:952`), but its siblings `_amountProduced` (`:425`) and `_amountProducedStatic` (`:818`) do not — a
row whose `last_updated_at` is ahead of client chain-time (Torii indexes preconfirmed blocks; the chain-time poller
reads `getBlock("latest")`) contributes _negative_ production. Likewise the instance capacity clamp
(`Math.max(0, capacityLeft)`, `:402`) is missing from `_limitProductionByStoreCapacityStatic` (`:835`), so an
over-capacity structure _subtracts_ from the displayed balance in the static path the resource table uses
(`entity-resource-table-new.tsx:249`).

**Fix:** one shared elapsed-ticks helper (floored at 0) used by all three sites; one capacity-limit implementation
(clamped) with the instance method delegating to it. Success is deletion — three ad-hoc copies become one of each.

**Gate:** unit tests: a production row with `last_updated_at` ahead of the current tick contributes zero (never
negative) production in both instance and static paths; an over-capacity row contributes zero (never negative) in the
static path.

---

Required checks before finishing: `pnpm run format`, `pnpm run knip`. No Cairo changes are in scope. Commit bodies must
describe the change (no subject-only commits).
