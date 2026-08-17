# Sync S4 Brief — The Deletion Harvest

Context: final phase of `docs/plans/sync-overhaul-codex-brief.md`. Prerequisite: the S3 armies slice is merged — S3 is
complete and every entity type renders from the projection. Anchors below were verified as of the structures slice
(`d447693240`); re-verify each against the post-armies tree before deleting. Branch `feat/sync-s4-deletions` off the
updated base. This phase is nothing but deletions plus the proofs that make them safe; the KISS payoff lands here.

**Ordering rule: the rollback path dies last.** Workstreams land as separate commits in the order below so the legacy
flag remains a working escape hatch until everything else is proven. If the combined PR exceeds review size, split A–D+F
and B into two PRs — flag it, don't decide silently.

## Workstream F0 — write the missing recovery proofs FIRST

The nine proofs gate every deletion. Several already exist in `packages/core/src/sync` tests (generation fencing,
multi-page pagination, event dedupe across recovery); map each of the nine runbook proofs to an existing test or write
it before deleting anything it guards. The three live acceptance behaviors (offscreen mutation, 30s network kill,
mid-game reload) are exercised in the acceptance playtest and attested by the owner — automate what's scriptable (the
headless smoke's `--watch-ms` machinery is the harness), attest the rest. No live-capture figures in the repo.

## Workstream A — MapDataStore retirement (13 consumer files)

`MapDataStore` is threaded wider than the minimap: `world-update-listener.ts` constructs it and wraps it in
`DataEnhancer` (plus the `resolveEntityId` map-store fallback), `bottom-right-panel.tsx` feeds the minimap from it,
`use-structure-entity-detail.ts`, `ui/utils/utils.ts`, `three/types/common.ts`, `bootstrap.tsx`, `sync.ts`, and the
news/story bridges all touch it. Migration per consumer class:

- **Spatial reads** (minimap tiles/markers, find-resource) → `WorldSpatialProjection`.
- **Entity facts** (names, guards, production, counts) → RECS selectors read at interaction time (the `useTileAt` /
  `getStructureOwnerAddress` precedent).
- **History** (news/story bridges) → they already read `fetchStoryEvents*`; delete only their MapDataStore touches.
- Then delete `map-data-store.ts`, `data-enhancer.ts`, the listener's constructor dependency and `resolveEntityId`
  fallback, and `MAP_DATA_REFRESH_INTERVAL`'s polling wiring. Adjudicate what is left of `world-update-listener.ts`
  after the armies slice — if the survivor is only Building/StructureBuildings plumbing, say so in the PR and shrink the
  file to exactly that.

## Workstream E — stamina comparator collapse (depends on A)

`army-stamina-source.ts`: four sources (`pending > live > snapshot > cached`) collapse to **valid-pending > RECS**.
"snapshot" (one-shot torii fetch) and "cached" (SQL map row) die with their stores. Update the comparator tests to pin
the two-source rule; the April tie-break lesson stays encoded in the surviving pending>live ordering.

## Workstream C — SqlApi live-state deletions (the S1 audit manifest executes)

Delete every `delete-live-state-s4` method in `packages/torii/src/queries/sql/fact-ownership.ts` together with its call
sites (most have 0–2 remaining callers; `fetchExploredTilesInBounds`'s caller `automation/exploration/map-cache.ts`
moves to the projection/RECS). The audit file stays as the permanent record: flip deleted entries to a `deleted-s4`
disposition rather than removing the rows — the `satisfies` guard keeps working for future methods. Final adjudication
for the four review-flagged entries, with the projection now existing: `fetchSurroundingWonderBonus` and
`fetchHyperstructuresWithRealmCount` → convert to projection/RECS-derived or justify keep-aggregate; the leaderboard
pair → likely keep-aggregate for out-of-session landing views, justify explicitly.

## Workstream D — repair fetches, chunk hydration, and the zero-calls finish line

- Delete the remaining chunk-hydration fetch machinery in the worldmap (`getMapFromToriiExact`,
  `settleTileHydrationFetch`, hydration generations, area keys — whatever the armies slice left standing) and the
  `debounced-queries.ts` paths whose only consumers were deleted.
- **Owner adjudication, do not decide silently:** the manual Re-sync button in the bottom-right panel. Recommendation:
  keep it through the acceptance playtest as user comfort, delete it in the S4 wrap-up commit once acceptance test 3
  ("no resync affordance needed") is attested.
- Land the full **camera-movement-performs-zero-torii-calls** assertion — subscriptions were pinned in S2; with the
  chunk fetches gone this becomes the complete invariant.

## Workstream B — legacy adapter and flag teardown (LAST)

Seven files carry the flag surface: `game-sync-mode.ts`, `legacy-bounded-sync-adapter.ts`(+test),
`torii-stream-manager.ts` (~800 lines), the legacy branches in `sync.ts`, the bounded lists in
`torii-spatial-models.ts`, the legacy paths in `worldmap.tsx`, and `use-player-structure-sync.ts` (the whole hook runs
only under the flag — it dies here, along with core's `player-structure-sync-writer.ts`). Also delete:
`VITE_PUBLIC_WORLDMAP_BOUNDED_SPATIAL_SYNC` from `env.ts` and every `.env.*` file; the manifest's legacy channels
(`bounded-spatial`, `spatial-bootstrap`, `player-entity`) and `legacyKeyCount` fields once nothing reads them; the
rollback section of `docs/architecture/sync-s2-recovery-contract.md` (update, don't orphan). After this commit there is
one sync architecture and no mode.

## Workstream F1 — measurement and exit criteria

Re-run the S1 heap protocol (`docs/architecture/sync-s1-performance-baseline.md`) on the same scenario class and record
it in `docs/architecture/`: **mid-game heap strictly below the 565.89 MiB baseline** is an exit criterion, not an
aspiration. Second exit criterion: the **no-fact-in-two-places audit** — for every model in the sync manifest, name its
single owner (RECS via runtime, projection-derived, or SQL history) in the PR description; any fact reachable from two
places is a defect per AGENTS.md guardrail #1. Heap figures belong in the repo; live peak-rate figures remain
owner-held.

## Explicitly NOT S4

- Three.js-specific performance (instancing, draw calls, GPU memory) — later branch.
- Eternum-long-world scope work — the scope-as-input invariant already accommodates it; don't build it.
- New features of any kind. S4 PRs that add capability have failed review before they open.

## Constraints

- AGENTS.md guardrails binding; cite the fact-ownership rule and the runbook proof list in every PR description.
- Massively net-negative LOC — this is the phase that pays for S1/S2's scaffolding; state the cumulative program LOC
  balance in the final PR.
- Source-pin tests: compensation-pinned tests die with their machinery; regression pins are updated, never deleted.
- Run the game-app suite via `scripts/run-vitest.mjs`; knip from the repo root.
