# Sync Overhaul Codex Brief — One Writer, One Truth, Camera Is Just a Lens

Rev 2, incorporating the Codex architecture review (S1/S2 ownership contradictions resolved, recovery contract made
explicit, batching made headless, performance budget added). Context: terminal phase of the six-generators program
(AGENTS.md "Client State & Sync Guardrails" is binding — guardrail #1 now carries the fact-level wording, amended
alongside this revision). Branch strategy below. KISS: this plan is measured in deletions — every phase must remove more
sync machinery than it adds, and each phase ships independently.

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
history, which never enters RECS. A game-wide subscription is comfortably within the measured row-count budget; the
residual risk is **peak update rate**, not stored rows — S2 measures it (below). The client already holds full-game
state 2–3× over (boot snapshot in RECS + MapDataStore SQL copies + scene-local maps), so this plan reduces memory. The
s2 pivot (`game_id` at key[0]) is what makes "everything for this game" a single static keys clause.

## The two rules (encode these, cite them in PRs)

1. **Fact-level ownership** (now AGENTS.md guardrail #1). Current authoritative game facts → RECS only, written by the
   runtime. Immutable history and query-derived aggregates that are not current entity truth (story events, battle logs,
   swaps, token transfers) → SQL read models. **SQL must never provide an alternative or fallback version of a fact that
   is also present in RECS.** _If the same fact is reachable from two places, that is a defect_ — the bug class behind
   the minimap staleness, the chest panel, and the provision/labor race. Note: points/rank models
   (`PlayerRegisteredPoints`, `PlayersRank*`, `RankPrize`) are streamed into RECS and are RECS facts; the SQL
   leaderboard endpoints are adjudicated by the S1 audit under this rule, not assumed either way.
2. **Headless by construction.** The runtime and the spatial projection live in `packages/core` with zero
   DOM/Three/React imports. All batching goes through a scheduler abstraction: browser adapter (animation frame or short
   time slice), node adapter (timer/microtask), test adapter (deterministic manual flush). Acceptance: a node process
   can instantiate runtime + RECS + provider and know the full game state. This is deliberate groundwork for
   game-playing agents — they consume the same truth and the same hex index as the renderer, with no extra sync code.

## Current state — the writer inventory to consolidate

| #   | Writer today                                                                                              | Owner/lifetime | Models                                                                                             | Target                                                              |
| --- | --------------------------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | Global entity stream (`sync.ts:145`)                                                                      | session        | configs, GameRegistry, social, points/rank models                                                  | keep, re-homed into runtime (S1)                                    |
| 2   | Global event stream (`sync.ts` `getGlobalEventModels`)                                                    | session        | events → toasts/effects                                                                            | keep, re-homed (S1); events never write entity truth                |
| 3   | Boot spatial snapshot (`torii-spatial-models.ts:39`)                                                      | boot, one-shot | spatial set **minus Structure**                                                                    | becomes the runtime's paginated snapshot step (S1 re-home, S2 spec) |
| 4   | Bounded spatial stream (`worldmap.tsx:1206`, `torii-stream-manager.ts`)                                   | **scene**      | TileOpt, Structure, StructureBuildings, Building, ExplorerTroops, ExplorerRewardEvent, BattleEvent | **stays scene-owned through S1**; S2 replaces with game-wide clause |
| 5   | Player structure sync (`use-player-structure-sync.ts`)                                                    | react hook     | Structure by owner + Building + 10s backstop                                                       | re-homed S1; retired in S2 when game-wide stream owns Structure     |
| 6   | MapDataStore SQL polls (`map-data-store.ts:411`)                                                          | store interval | all structures/armies/tiles                                                                        | **deleted as truth** (S4); consumers move to spatial projection     |
| 7   | Targeted repair fetches (`ensureStructureSynced`, `getTilesForPositionsFromTorii`, provision resync)      | ad hoc         | various                                                                                            | kept through S3 as belt-and-suspenders, deleted in S4               |
| 8   | Scene-local truth maps (`armiesPositions`, `structureHexes`, `chestHexes`, `exploredTiles`, manager maps) | scene          | positions/occupancy                                                                                | replaced by RECS-derived spatial projection (S3)                    |

Known ownership hole, fixed in **S2**: `torii-spatial-models.ts:34` claims "the live all-entity stream owns Structure",
but `Structure` is absent from `GLOBAL_ENTITY_STREAM_MODEL_NAMES` (`sync.ts:145`). Structure truth is currently
assembled from writers 4+5+7. S2's game-wide clause closes it — described honestly as a behavior change, not a refactor.

## The model manifest (executable, permanent — not planning documentation)

One manifest in code drives, per model: snapshot coverage, entity subscription coverage, event subscription coverage,
game scoping, deletion/reconciliation policy, recovery policy, and the derived tests. This extends the existing
manifest-derived test pattern (torii scope lint, game-scope classification) — a Structure-style mismatch between a
comment and a clause list becomes a failing test, not an archaeology find. The manifest must force a single adjudication
for `ExplorerRewardEvent` and `BattleEvent`, which today ride in both the spatial entity list and the event path —
recommendation: they are events; the event stream drives their effects and they leave the entity subscriptions. Decide
once, in the manifest, in S2.

## Target architecture

```
        paginated snapshot + game-wide live subscriptions (one static game_id clause)
                          │
                          v
              GameSyncRuntime (packages/core, headless)
        one lifecycle · convergent snapshot-and-buffer recovery
        scheduler-driven batch ingest · one health state
                          │
                          v
                     RECS — truth
                          │                    PendingOverlay (the ONLY other layer)
                          │◄──── single read accessor merges: valid pending > RECS
                          v
          WorldSpatialProjection (packages/core, headless)
        hex → entityIds · entity → renderable · fully rebuildable
                          │
        ┌─────────────────┼──────────────────────┐
        v                 v                      v
  Three managers      minimap (spatial)      agents (node)
  (visible-set diff
   from camera bounds)

  Panels/UI read RECS selectors DIRECTLY (useTileAt precedent) — the
  projection is for spatial consumers only, caches only derived
  renderables, and must never become a second gameplay store.
```

Runtime invariants (build once, in one place):

- **Convergent snapshot-and-buffer recovery** (not "gap-free" until proven): subscribe → buffer live updates → paginated
  snapshot → apply snapshot → replay buffer. Replaces every hand-rolled freshness guard (MapDataStore
  fetch-start-vs-live-write, hydration generations, stale-fetch rejection). The S2 PR must specify and test the
  **recovery contract**: (a) when a subscription counts as active; (b) what ordering information buffered updates carry;
  (c) component-level deletion/tombstone behavior; (d) how absent snapshot rows are diffed without deleting sibling
  components; (e) behavior when the connection dies mid-pagination; (f) how a moving, non-transactional paginated
  snapshot converges; (g) generation fencing — late callbacks from a previous game/runtime generation are rejected.
- **Scheduler-driven batch ingest:** coalesce RECS writes per entity+model per scheduler tick. Deletions, event records,
  and lifecycle transitions are **never** collapsed and keep explicit ordering. Browser = animation frame; node = timer;
  tests = manual flush.
- **Subscription scope is a runtime input, not an architecture** (owner decision, 2026-08-13). The runtime subscribes
  with the clause it is handed; today that clause is game-wide and static, set at session start. Nothing in the runtime
  may assume game-wide is the only possible scope — a per-world-mode config (blitz = game-wide; a future oversized
  eternum world = a coarser static clause) must be a data change, not a code change. Two hard limits: the scope is never
  derived from the camera and never changes mid-session without a full re-snapshot; and this does NOT preserve the
  legacy bounded architecture as a permanent toggle — a two-architecture flag rots (the
  `VITE_PUBLIC_WORLDMAP_BOUNDED_SPATIAL_SYNC` default-off incident left four environments silently degraded) and would
  keep alive everything S4 deletes. The legacy adapter still dies in S4.
- **Recovery = the same routine re-run.** Torii has no resume cursor; on stream death, re-snapshot (~1.2k rows) and diff
  into RECS. One reconnect path replaces the global/spatial/player trio. Event effects must not fire twice across a
  recovery.
- **Convergent rendering:** on any relevant component change, read ALL components for that entity from RECS, build one
  complete Renderable{Structure,Army,Chest}, idempotently upsert/remove in the projection. Update order becomes
  irrelevant — this deletes the per-stream sequence-scoping class of bugs.
- **PendingOverlay semantics** (extends AGENTS.md guardrail #4): one record per entity —
  `{kind, txHashes, createdAt, ttlMs}`. A record is _confirmed_ (removed) by the matching authoritative RECS update or
  transaction receipt, and _expired_ by TTL sweep otherwise. "Pending > RECS" applies only while the record is valid;
  expiry without confirmation is a tested path, not an assumption.

## Performance budget (owner requirement — the client is a memory hog today)

Sync-related performance is in scope; Three.js-specific performance (instancing, draw calls, GPU memory) is explicitly a
later branch.

- **S1 captures the baseline:** heap snapshot mid-game, RECS row counts by model, an enumeration of every duplicate copy
  of each live fact (MapDataStore maps, scene maps, manager maps), and an **event-retention audit** — the 40,000-row
  event query limit (`sync.ts:42`) and 4.8k StoryEvents/game suggest event history may accumulate in client memory;
  decide a retention policy (effects + capped buffer, never unbounded rows).
- **Every phase re-measures against the baseline.** Deleting a duplicate store must show up as heap reduction; batch
  ingest is measured as main-thread time per update burst; S2 additionally logs **peak updates/sec during an active
  battle window** (the real residual risk of game-wide sync).
- **S4 exit criteria:** no live fact held in more than one place; mid-game heap strictly below the S1 baseline.

## Phases — each ships, each deletes

**S1 — GameSyncRuntime (purely mechanical, zero behavior change).** Create the runtime in `packages/core` (headless rule
applies). Move writers 1, 2, 3, 5 into it; session lifetime, torn down/rebuilt by `setActiveGame`. Writer 4 (the
scene-owned bounded spatial stream) **explicitly stays put until S2** — do not add a temporary camera/bounds concept to
the runtime. Deliverables: the runtime, the manifest skeleton with derived tests, the performance baseline, and the
fact-ownership audit classifying every `SqlApi` method (`packages/torii/src/queries/sql/api.ts`) as history/aggregate
(keep) or live-state (S4 deletion manifest). Obvious calls: `fetchAll{Structures,Armies}MapData`, `fetchAllTiles`,
`fetchExploredTilesInBounds`, `fetchStructureByCoord`, `fetchResourceBalances*` → live-state; `fetchStoryEvents*`,
`fetchBattleLogs`, `fetchSwapEvents`, `fetchTokenTransfers` → keep. Flag judgment calls, don't decide silently.

**S2 — spatial models go game-wide (a behavior change, stated as such).** Replace camera-bounds clauses with the static
game_id clause; move spatial subscription ownership into the runtime; add `Structure` to the game-wide stream (closes
the ownership hole); retire writer 5. Specify and test the recovery contract (a–g above); implement snapshot pagination;
adjudicate `ExplorerRewardEvent`/`BattleEvent` in the manifest; measure peak update rate. Rollback: the **complete**
legacy bounded adapter is preserved behind one interface and the existing `VITE_PUBLIC_WORLDMAP_BOUNDED_SPATIAL_SYNC`
flag — no half-preserved fallback; its machinery is deleted in S4, not here. (Chosen over SHA-redeploy rollback because
the playtest branch ships daily fixes a redeploy would lose.)

**S3 — WorldSpatialProjection + convergent managers.** Build the projection (RECS-subscribed, rebuildable, headless).
Convert managers one entity type per PR, smallest blast radius first: **chests → structures → armies**. Each PR deletes
its compensations: render-area hydration, hydration fetch generations, `shouldApplyWorldmapFetchResult` family, the
scene-local truth maps for that type, per-stream sequence scoping once the last consumer is convergent. Panels keep
reading RECS selectors directly — do not route UI through the projection. Army movement animation keeps its
pending-overlay handoff — that complexity is inherent; only its _truth_ source changes.

**S4 — the deletion harvest.** Point minimap/find-resource at the projection; delete MapDataStore's live facets and
polls; delete the legacy bounded adapter, its flag, and the camera-clause machinery; delete the live-state SqlApi
methods from the S1 manifest; delete targeted repair fetches; collapse the army-stamina 4-source comparator to
valid-pending > RECS. Recovery proof (tests below) gates every deletion in this phase.

## Acceptance tests

Headline four — the plan is done when all pass:

1. **Offscreen mutation:** update an army/chest/structure while offscreen; pan there later; correct state renders with
   zero network requests, hydration waits, reselects, or scene re-entry.
2. **Network kill:** sever the connection for 30s mid-game, restore; the map converges without a reload.
3. **Mid-game reload:** hard-reload during an active game; everything (units included) is fresh with no manual resync
   affordance needed.
4. **Headless smoke:** a node script instantiates runtime + RECS, joins a live game, and prints the correct hex
   occupancy for a coordinate — no DOM, no Three.

Recovery and regression proofs (gate S4's deletions):

- offscreen **deletion** (not just mutation) reconciles on pan;
- an army moving between coordinates while offscreen renders at the destination only;
- connection loss **during snapshot pagination** converges;
- switching active games while buffered updates remain applies nothing from the old game;
- stale callbacks from a destroyed runtime generation are rejected (fencing test);
- event effects do not fire twice across a recovery;
- snapshots larger than one page hydrate completely;
- pending overlay state expires without transaction confirmation (TTL path);
- **automated assertion that camera movement performs zero torii calls.**

## Branch strategy

One short-lived branch per phase, based off `feat/single-world-blitz` (the overhaul depends on the s2 `game_id` work
that lives only there): `feat/sync-s1-runtime`, `feat/sync-s2-gamewide`, `feat/sync-s3-projection`,
`feat/sync-s4-deletions`. Each phase PRs back into `feat/single-world-blitz` when its acceptance criteria pass. Do NOT
work directly on `feat/single-world-blitz` (it is the live playtest deploy source and must stay deployable at all times)
and do NOT keep one long-running overhaul branch (it rots against daily commits — merge each phase promptly, then branch
the next phase from the updated base).

## Explicitly NOT yours

- Deploys and torii/infra tuning (Claude).
- The eternum-long-world contingency (semantic partitioning / server delta feed): out of scope unless S2 measurement
  forces it — do not build it. The runtime's scope-as-input invariant above is the only accommodation: don't preclude a
  coarser clause, don't implement one.
- Deleting repair-on-action paths before S4's recovery proof.
- Three.js-specific performance work (later branch).

## Constraints

- AGENTS.md guardrails are binding; cite the fact-ownership rule in every PR description.
- Never share stateful core code into the client via relative src imports — package subpath exports only (dist/src
  dual-instance lesson; see `@bibliothecadao/eternum/game-entity-keys` for the pattern).
- Source-pin tests: update the pins to assert the new architecture; never delete them to make room.
- Net-negative LOC per phase, or the PR explains why not.
- No `git add -A`. Run the game-app suite via `scripts/run-vitest.mjs` (no extra `run` arg).
