# Sync Overhaul Codex Brief — One Writer, One Truth, Camera Is Just a Lens

Context: terminal phase of the six-generators program (AGENTS.md "Client State & Sync Guardrails" is binding). Branch
`feat/single-world-blitz`. KISS: this plan is measured in deletions — every phase must remove more sync machinery than
it adds, and each phase ships independently.

North star: **RECS is the single client store. One session-owned runtime feeds it. The camera filters what is rendered,
never what is known.** No new store is introduced anywhere in this plan.

## Why now — hard data (live torii, game 13, a full played blitz game)

| Model     | Rows | Model                | Rows     |
| --------- | ---- | -------------------- | -------- |
| TileOpt   | 566  | ExplorerTroops       | 40       |
| Building  | 324  | StructureBuildings   | 31       |
| Resource  | 87   | Hyperstructure       | 16       |
| Structure | 47   | everything else live | ≤11 each |

**Total live entity state of a finished game: ~1,200 rows.** The only large table is `StoryEvent` (4,856) — pure
history, which never enters RECS. A game-wide subscription costs nothing at blitz scale, and the client already holds
full-game state 2–3× over (boot snapshot in RECS + MapDataStore SQL copies + scene-local maps), so this plan reduces
memory. The s2 pivot (`game_id` at key[0]) is what makes "everything for this game" a single static keys clause.

## The two rules (encode these, cite them in PRs)

1. **Fact-level ownership.** Every fact has exactly one owner. Live entity state → RECS via the runtime. History and
   aggregates RECS deliberately never holds (story events, battle logs, swaps, leaderboards, token transfers) → SQL. _If
   the same fact is reachable from two places, that is a defect_ — the bug class behind the minimap staleness, the chest
   panel, and the provision/labor race.
2. **Headless by construction.** The runtime and the spatial projection live in `packages/core` with zero
   DOM/Three/React imports. Acceptance: a node process can instantiate runtime + RECS + provider and know the full game
   state. This is deliberate groundwork for game-playing agents — they consume the same truth and the same hex index as
   the renderer, with no extra sync code.

## Current state — the writer inventory to consolidate

| #   | Writer today                                                                                              | Owner/lifetime | Models                                                                                             | Target                                                           |
| --- | --------------------------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | Global entity stream (`sync.ts:145`)                                                                      | session        | configs, GameRegistry, social, leaderboard                                                         | keep, re-homed into runtime                                      |
| 2   | Global event stream (`sync.ts` `getGlobalEventModels`)                                                    | session        | events → toasts/effects                                                                            | keep, re-homed; events never write entity truth                  |
| 3   | Boot spatial snapshot (`torii-spatial-models.ts:39`)                                                      | boot, one-shot | spatial set **minus Structure**                                                                    | becomes the runtime's paginated snapshot step                    |
| 4   | Bounded spatial stream (`worldmap.tsx:1206`, `torii-stream-manager.ts`)                                   | **scene**      | TileOpt, Structure, StructureBuildings, Building, ExplorerTroops, ExplorerRewardEvent, BattleEvent | game-wide clause, session-owned; camera clause machinery deleted |
| 5   | Player structure sync (`use-player-structure-sync.ts`)                                                    | react hook     | Structure by owner + Building + 10s backstop                                                       | covered by #4 game-wide; one cheap reconciliation kept           |
| 6   | MapDataStore SQL polls (`map-data-store.ts:411`)                                                          | store interval | all structures/armies/tiles                                                                        | **deleted as truth**; consumers move to spatial projection       |
| 7   | Targeted repair fetches (`ensureStructureSynced`, `getTilesForPositionsFromTorii`, provision resync)      | ad hoc         | various                                                                                            | kept through S3 as belt-and-suspenders, deleted in S4            |
| 8   | Scene-local truth maps (`armiesPositions`, `structureHexes`, `chestHexes`, `exploredTiles`, manager maps) | scene          | positions/occupancy                                                                                | replaced by RECS-derived spatial projection                      |

Known ownership hole to fix in S1: `torii-spatial-models.ts:34` claims "the live all-entity stream owns Structure", but
`Structure` is absent from `GLOBAL_ENTITY_STREAM_MODEL_NAMES` (`sync.ts:145`). Structure truth is currently assembled
from writers 4+5+7. After S1 the game-wide stream owns it, full stop.

## Target architecture

```
        paginated snapshot + game-wide live subscriptions (one static game_id clause)
                          │
                          v
              GameSyncRuntime (packages/core, headless)
        one lifecycle · gap-free ordering · per-frame batch ingest
        one health state · one recovery (re-snapshot + diff)
                          │
                          v
                     RECS — truth
                          │                    PendingOverlay (the ONLY other layer)
                          │◄──── single read accessor merges: pending > RECS
                          v
          WorldSpatialProjection (packages/core, headless)
        hex → entityIds · entity → renderable · fully rebuildable
                          │
        ┌─────────────────┼──────────────────────┐
        v                 v                      v
  Three managers      minimap / panels      agents (node)
  (visible-set diff   (read projection,
   from camera bounds) no SQL live state)
```

Runtime invariants (build once, in one place):

- **Gap-free ordering:** subscribe → buffer live updates → paginated snapshot → apply snapshot → replay buffer. This
  replaces every hand-rolled freshness guard (MapDataStore fetch-start-vs-live-write, hydration generations, stale-fetch
  rejection).
- **Batch ingest:** coalesce RECS writes per animation frame at the single ingest point. Scattered writers make this
  impossible today; the runtime makes it one `flush()`.
- **Recovery = the same routine re-run.** Torii has no resume cursor; on stream death, re-snapshot (~1.2k rows) and diff
  into RECS. One reconnect path replaces the global/spatial/player trio.
- **Convergent rendering:** on any relevant component change, read ALL components for that entity from RECS, build one
  complete Renderable{Structure,Army,Chest}, idempotently upsert/remove in the projection. Update order becomes
  irrelevant — this deletes the per-stream sequence-scoping class of bugs.

## Phases — each ships, each deletes

**S1 — GameSyncRuntime (ownership refactor, no behavior change).** Create the runtime in `packages/core` (headless rule
applies). Move writers 1, 2, 3, 5 into it; session lifetime, torn down/rebuilt by `setActiveGame`. Add `Structure` to
the game-wide entity stream (closes the ownership hole). The scene neither creates nor owns any subscription afterwards.
Deliverable includes the fact-ownership audit: classify every `SqlApi` method (`packages/torii/src/queries/sql/api.ts`)
as history/aggregate (keep) or live-state (scheduled for deletion, listed in the S4 manifest). Obvious calls:
`fetchAll{Structures,Armies}MapData`, `fetchAllTiles`, `fetchExploredTilesInBounds`, `fetchStructureByCoord`,
`fetchResourceBalances*` → live-state; `fetchStoryEvents*`, `fetchBattleLogs`, `fetchSwapEvents`, `fetchTokenTransfers`,
`fetchLeaderboard*` → keep. Flag judgment calls, don't decide silently.

**S2 — spatial models go game-wide.** Replace camera-bounds clauses with the static game_id clause for the spatial set;
implement the gap-free ordering invariant and snapshot pagination in the runtime. Keep the bounded path behind
`VITE_PUBLIC_WORLDMAP_BOUNDED_SPATIAL_SYNC` (flag now selects legacy vs game-wide) for one release as rollback. Delete:
subscription clause updates on camera move, `updateEntitySubscription` churn, chunk-driven resubscribe recovery. Measure
with the existing worldmap render counters before/after.

**S3 — WorldSpatialProjection + convergent managers.** Build the projection (RECS-subscribed, rebuildable, headless).
Convert managers one entity type per PR, smallest blast radius first: **chests → structures → armies**. Each PR deletes
its compensations: render-area hydration, hydration fetch generations, `shouldApplyWorldmapFetchResult` family, the
scene-local truth maps for that type, per-stream sequence scoping once the last consumer is convergent. Army movement
animation keeps its pending-overlay handoff — that complexity is inherent; only its _truth_ source changes.

**S4 — the deletion harvest.** Point minimap/find-resource/panels at the projection; delete MapDataStore's live facets
and its polls; delete the bounded-sync legacy path and flag; delete the live-state SqlApi methods from the S1 manifest;
delete targeted repair fetches; collapse the army-stamina 4-source comparator to pending > RECS. Prove recovery before
deleting the old paths (acceptance tests below).

## Acceptance tests (the plan is done when all four pass)

1. **Offscreen mutation:** update an army/chest/structure while it is offscreen; pan there later; correct state renders
   with zero network requests, hydration waits, reselects, or scene re-entry.
2. **Network kill:** sever the connection for 30s mid-game, restore; the map converges without a reload.
3. **Mid-game reload:** hard-reload during an active game; everything (units included) is fresh with no manual resync
   affordance needed.
4. **Headless smoke:** a node script instantiates runtime + RECS, joins a live game, and prints the correct hex
   occupancy for a coordinate — no DOM, no Three.

## Explicitly NOT yours

- Deploys and torii/infra tuning (Claude).
- The eternum-long-world contingency (semantic partitioning / server delta feed): out of scope unless S2 measurement
  forces it — do not design for it.
- Deleting repair-on-action paths before S4's recovery proof.

## Branch strategy

One short-lived branch per phase, based off `feat/single-world-blitz` (the overhaul depends on the s2 `game_id` work
that lives only there): `feat/sync-s1-runtime`, `feat/sync-s2-gamewide`, `feat/sync-s3-projection`,
`feat/sync-s4-deletions`. Each phase PRs back into `feat/single-world-blitz` when its acceptance criteria pass. Do NOT
work directly on `feat/single-world-blitz` (it is the live playtest deploy source and must stay deployable at all times)
and do NOT keep one long-running overhaul branch (it rots against daily commits — merge each phase promptly, then branch
the next phase from the updated base).

## Constraints

- AGENTS.md guardrails are binding; cite the fact-ownership rule in every PR description.
- Never share stateful core code into the client via relative src imports — package subpath exports only (dist/src
  dual-instance lesson; see `@bibliothecadao/eternum/game-entity-keys` for the pattern).
- Source-pin tests: update the pins to assert the new architecture; never delete them to make room.
- Net-negative LOC per phase, or the PR explains why not.
- No `git add -A`. Run the game-app suite via `scripts/run-vitest.mjs` (no extra `run` arg).
