# Sync S2 recovery contract

S2 changes spatial synchronization from camera-bounded writers to one session-owned runtime using a static game scope.
RECS remains the only current-state store; the camera only chooses which RECS entities Three.js displays.

## Recovery sequence

Every boot and reconnect runs the same sequence:

1. Create both entity and event subscriptions for the fixed session clauses.
2. Count the subscription as active only after both Torii subscription promises resolve.
3. Buffer entity callbacks with a monotonically increasing client receive sequence.
4. Fetch the entity snapshot in 500-row cursor pages, applying each page through the scheduler-backed ingest queue.
5. Diff snapshot absence per model and remove only that component. Sibling components on the same RECS entity survive.
6. Replay buffered entity callbacks in receive-sequence order, then enter `running`.

Torii does not expose a universal server revision or transactional multi-page snapshot. The installed wasm entity
callback carries only `{ hashed_keys, models }`: no block number, event ID, update timestamp, or cursor. Client-side
per-entity monotonicity therefore cannot be implemented honestly. The upstream feature request is a monotonic per-entity
version on subscription payloads; until Torii provides it, model-specific reconciliation must remain where an older
callback can race a provisional write. The guarantee is convergence, not gap-free history. Subscribing first means a
mutation crossing a page boundary is replayed after the older snapshot value. The inverse race is also possible: a
buffered callback older than the page it crossed can regress that entity by at most one observed update; its next live
update or recovery heals it. A fetch or detected stream failure aborts the generation; reconnect starts the full
sequence again. The connection health monitor owns recovery for both streams. It uses indexer heartbeat staleness where
available, observable stream-close signals when a future SDK exposes them, and a logged quiet-stream refresh only on
Torii deployments that do not provide indexer heartbeats.

## Deletion and event rules

- `models: {}` is a full entity deletion.
- `{ Model: {} }` is a component tombstone and never deletes sibling components.
- Snapshot absence is reconciled independently for every manifest model.
- `OpenRelicChestEvent`, `ExplorerRewardEvent`, and `BattleEvent` are event-only. They trigger RECS systems and their
  component is removed immediately; event rows are never retained as current truth.
- Event identities use a fixed FIFO of 512 `model:hashed_keys:timestamp` values. The FIFO survives reconnect recovery,
  so replayed callbacks cannot fire an effect twice while later events for the same on-chain keys still fire. It resets
  for a genuinely new session.
- Event callbacks expose no server cursor. After the initial subscriptions are active, the session establishes its
  timestamp watermark asynchronously without replaying historical effects. That watermark survives runtime recovery; a
  replacement subscription queries backward inclusively from the frozen watermark after it is listening. Results pass
  through the normal event handler and identity dedupe path. This is gap-fill replay, not a claim of gap-free server
  ordering. Healthy event streams have no periodic lease or replay.

## Ordering and fencing

Live callbacks carry `(runtime generation, client receive sequence)`. A new recovery or game switch increments the
generation, cancels the old writer, and rejects late writers/callbacks. Deletions and events are ingest barriers;
upserts between barriers coalesce per entity and model for one scheduler tick. A failed RECS write rejects recovery
rather than silently advancing the queue.

## Camera behavior

There is one session-owned game-wide runtime and no bounded rollback mode. Camera movement selects already-synced rows
from `WorldSpatialProjection`; it cannot create, replace, or update a Torii subscription. The camera zero-calls source
test pins that boundary.

## S3 spatial projection ownership

Chest and structure membership, identity, and contract-space location are derived from `TileOpt` by the session-owned
`WorldSpatialProjection`. The projection rebuilds from RECS at session start and recovery, then updates only the
affected TileOpt source during live play. Three.js bounds queries select presentation work from that projection; they do
not fetch entity state when the camera moves.

Structure owner, guards, buildings, names, and Hyperstructure state are not copied into the projection. Labels,
interaction, ownership checks, and panels resolve those facts from their RECS components when used. Reserved
Hyperstructure sites are coordinate-keyed renderables because they deliberately have no Structure entity until the site
becomes a real structure. Both surface resolvers reject nonzero `alt`, so ethereal occupancy cannot appear on the world
map.

## Headless and measurement

`pnpm --dir apps/game smoke:game-sync-headless -- --help` documents the repeatable live smoke. It instantiates the same
`GameSyncRuntime`, a RECS world, the session-owned `WorldSpatialProjection`, and a Torii provider in Node. It hydrates
every page and prints decoded occupancy, projected chest occupancy, and runtime metrics without DOM, React, or Three.js.

On 2026-08-13, game 13 against `https://torii.jcndata.com` hydrated 2,472 entities across five pages in 2,598 ms. The
largest scheduled RECS batch took 23 ms, and the requested coordinate decoded correctly. The one-second observation
window saw zero live updates because the indexed game had already ended. `peakLiveUpdatesPerSecond` is emitted by the
runtime and printed by the smoke's `--watch-ms` mode; a non-zero active-battle capture still requires a live playtest
window and is an explicit merge-gate measurement, not a fabricated result.

The machine-readable capture is `docs/architecture/sync-s2-headless-measurement.json`.

The S3 chest conversion was also checked against a live chest. Game 13 decoded chest 10,775 at
`(1076167049, 1076167075)`, and the projection returned that same entity at that coordinate. The machine-readable
capture is `docs/architecture/sync-s3-chest-projection-measurement.json`.
