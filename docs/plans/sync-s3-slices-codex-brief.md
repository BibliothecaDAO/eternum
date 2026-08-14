# Sync S3 Slice Brief — Structures, then Armies

Context: executes §S3 of `docs/plans/sync-overhaul-codex-brief.md`. The merged chest slice is the reference
implementation — same projection pattern, same deletion discipline. One slice per PR, short branches off the updated
`feat/single-world-blitz` base: `feat/sync-s3-structures`, then `feat/sync-s3-armies`. KISS: each slice is judged by
what it deletes.

## The truth vs render-resource rule (read before deleting anything in a manager)

The managers hold two kinds of state and only one is a target. **Truth state** — who exists and where (worldmap's
`structureHexes`, `structuresPositions`, `armiesPositions`, manager `armies`/`lastKnownVisibleHexes` maps, stream-driven
add/remove flows) — is replaced by the projection. **Render-resource state** — instanced-model pools, instance-index ↔
entity bindings, label objects, animation/tween bookkeeping, movement listeners, cosmetic registries — is legitimate
GPU/scene bookkeeping and stays. Deleting a binding map is not a win; it is a regression.

## Slice 2 — Structures (`feat/sync-s3-structures`)

**Renderable and source.** Extend the projection with `StructureSpatialRenderable { entityId, hexCoords, occupierType }`
derived from TileOpt exactly like chests: existence and mesh variant come from `occupier_type` (realm levels, wonder
levels, hyperstructure levels, mine/village/bank/holy-site/camp/bitcoin variants — `getStructureInfoFromTileOccupier`
already classifies them), alt rows filtered in the resolver. **Owner is not projection state**: interaction paths
(click, hover label, ally coloring, isMine) read the `Structure` model from RECS at interaction time — the projection
stays identity+location, per its own doc comment. Adjudicate `ReservedHyperstructure` (occupier 39) explicitly: it
renders but has no Structure entity — decide its renderable shape in the projection, don't special-case it in the scene.

**Deletions (the point of the slice):**

- `structureHexes` and `structuresPositions` scene maps (`worldmap.tsx:931,937`) and every read path that walks them.
- The scene's structure stream subscriptions: `Structure.onStructureUpdate` (`worldmap.tsx:1913`) and
  `Structure.onTileUpdate` (`worldmap.tsx:1951`).
- The async enrichment behind them: `resolveStructureTileUpdateFromTileOpt` and the `"structure"`/`"structure-tile"`
  sequential-update scopes in `world-update-listener.ts` — the convergent projection makes update order irrelevant,
  which is the whole reason those scopes exist.
- `hydrateStructuresFromGlobalTileOptRecs` and the structure arm of render-area hydration.
- `ensureStructureSynced` + `ensureStructureQueriedMethod` (`worldmap.tsx:1032-1047`) — the structure repair fetch. Same
  rollback-mode caveat as chests: legacy mode loses this healing; accepted and documented.

**Regression pins to keep green:** hyperstructure construction pops in on the map without leaving bounds (the Aug 13
vanish-bug acceptance); provision/settle flows still surface new realms; the reserved-HS "Create Here" flow still sees
the tile flip. Update source-pin tests to assert the projection wiring; never delete them to make room.

## Slice 3 — Armies (`feat/sync-s3-armies`)

**Source model decision (fact-level ownership applied).** An army's existence and position is ONE fact with ONE owner:
`ExplorerTroops` (exists iff `troops.count > 0`, position = `coord`, mesh variant = category + tier). The projection
derives armies from ExplorerTroops only. TileOpt's explorer occupier values stop driving rendering — today's
`Army.onTileUpdate` path infers army death from tile-leave heuristics ("left tile but still exists — likely moving",
`world-update-listener.ts:297-317`) precisely because it watches the wrong model. Those heuristics, the `"army-tile"`
sequential scope, and `onDeadArmy` are deleted, not ported.

**Rebuild cost (owner-ratified design input, 2026-08-14).** Coalesce projection rebuilds to at most once per scheduler
tick — one rebuild and one listener notification per ingest batch, however many army updates it carried. Measure against
the owner's captured peak update rate (the owner holds the number and supplies it privately — peak-rate figures are NOT
committed to the repo). Move to incremental per-entity updates only if that measurement demands it; at blitz cardinality
(~40 ExplorerTroops rows) coalesced full rebuild is the expected winner.

**Pending movement stays an overlay.** The projection is RECS-pure. The renderer merges valid-pending > RECS through the
existing accessor; the movement animation handoff (start/complete/visual-cancel listeners, transition tokens) is
render-resource state and stays. Idempotent upsert must not restart a tween the army is already running — diff the
authoritative target against the animation's target before touching it.

**Deletions:** `armiesPositions` (`worldmap.tsx:934`) and its lookups (battle positions, entity-action resolver,
selection paths); the scene's army stream subscriptions; the tile-leave inference machinery above;
`lastKnownVisibleHexes` and any manager map whose job was remembering authoritative positions. Adjudicate
`army-authoritative-reconciler.ts`: delete if the game-wide stream + projection supersede it, or state in the PR why it
survives to S4.

## Cross-slice constraints

- Net-negative LOC per slice on tracked files, or the PR explains why not.
- Every renderable resolver filters `alt` rows — no exceptions, ever.
- Camera stays a pure view filter; no new fetch paths. The chunk-hydration fetches that remain after these slices are S4
  deletion targets, not load-bearing dependencies — do not add callers.
- Panels keep reading RECS selectors directly; nothing UI-side routes through the projection.
- Spires and quest tiles: if their rendering turns out to ride the deleted structure streams, convert them in the
  structures slice with the same pattern (flag it in the PR); do not leave them on a dead path and do not start a fourth
  slice without asking.
- AGENTS.md guardrails binding; cite the fact-ownership rule in each PR description.

## Explicitly NOT these slices

- MapDataStore/minimap conversion, stamina comparator collapse, legacy adapter + flag deletion, live-state SqlApi
  deletions — all S4.
- Peak-rate captures in the repo (owner-held, supplied out of band).
