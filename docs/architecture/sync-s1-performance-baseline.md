# Sync S1 performance baseline

The machine-readable baseline is [`sync-s1-performance-baseline.json`](./sync-s1-performance-baseline.json). It records
the repeatable scenario, heap measurement, live row counts, duplicate-copy inventory, and event-retention findings
required by S1.

## Capture protocol

1. Start the game client in `appchain.blitz` mode from `feat/sync-s1-runtime`.
2. Spectate `bltz-chirp-294` (game 14) and wait until initial sync, map hydration, and the first bounded stream switch
   complete.
3. Record `performance.memory` after the world map settles.
4. Capture a Chrome DevTools `HeapProfiler.takeHeapSnapshot` artifact outside the repository.
5. Count every populated RECS component through a temporary browser diagnostic, then remove the diagnostic.
6. Query the live Torii SQL endpoint for per-model `game_id = 14` row counts so RECS coverage can be compared with
   indexed live state.

No appchain game was active during the capture window, so the newest fully played game was used as a conservative
full-state proxy rather than inventing a synthetic workload. S2 still must capture peak update rate during an active
battle; the same heap protocol should be repeated then for a phase-matched comparison.

The captured heap snapshot is 173,516,135 bytes at `/tmp/sync-s1-bltz-chirp-294.heapsnapshot`. Heap snapshots are large,
environment-specific evidence and are intentionally not committed. The versioned baseline contains its size and the
565.89 MiB used-heap measurement.

The settled client held 2,346 RECS component rows across 20 populated models; another 98 registered components had no
rows. This is deliberately recorded separately from Torii's game-14 counts. For example, Torii held 22 `Structure` rows
and 40 `Resource` rows, while this spectator session held 1 and 4 respectively in RECS. That difference is the S1
ownership gap, not measurement noise: the bounded and player writers still determine which of those facts the client
knows until S2 makes the spatial scope game-wide.

## Event-retention decision

S2 will deliver event effects once and will not retain event history as RECS truth. Recovery must not replay effects.
The runtime may keep a fixed FIFO of at most 512 event identities per model for deduplication and diagnostics; immutable
event history remains in SQL. This replaces today's unbounded `OpenRelicChestEvent` rows and the dual entity/event
delivery of `ExplorerRewardEvent` and `BattleEvent` once S2 adjudicates their channels.

## Interpretation

This is a whole-client baseline, not a claim that sync owns 565.89 MiB. Its purpose is controlled before/after
comparison. The duplicate inventory identifies which reductions should be attributable to S3 and S4. Render-only GPU
objects and bounded presentation indexes are not classified as competing truth merely because they consume memory.

S1 is allowed to add runtime and manifest scaffolding while deleting the former module-global and React-owned writer
machinery. If the phase is not net-negative after generated files and tests are excluded, the PR should cite the new
executable ownership manifest, runtime fencing, and baseline evidence as the temporary addition; S2–S4 perform the
larger deletion harvest.

## Recorded follow-ups

- S2 must turn the ad hoc Node import/lifecycle smoke into a repeatable headless acceptance script as the runtime grows
  into the full-state acceptance test.
- `fetchSurroundingWonderBonus` and `fetchHyperstructuresWithRealmCount` remain explicit S3 decisions, when the spatial
  projection exists to replace them.
- The registered-points and leaderboard SQL endpoints remain an S2/S3 decision family. The unresolved constraint is
  landing-page use outside a game session, where no populated RECS world exists.
