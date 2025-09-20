# Client ↔ Chain Sync Hardening Proposal

This document captures the current sync failure modes we've seen in the Blitz/Eternum stack and proposes a layered remediation plan. The goal is to make recs-based client state a faithful, self-healing reflection of onchain truth, even under network hiccups, UI tab suspends, or SQL drift.

## 1. Current State Overview

- **Realtime entity updates** arrive via a single `toriiClient.onEntityUpdated` / `onEventMessageUpdated` stream. They are batched and applied through `setEntities` without any ordering guarantees (`client/apps/game/src/dojo/sync.ts`).
- **Initial state** is populated with ad-hoc `getEntities` queries plus SQL-backed fetches for map/metadata; only the first map refresh happens during `initialSync`.
- **Rendering systems** (Three.js + React) already implement extra guard rails (e.g. `processSequentialUpdate`) on top of the ECS world, indicating issues start upstream in the shared sync layer.
- **Torii metadata** – every entity update ships with `block_number` and `event_index`, and contract components expose `last_updated_at` ticks. The current queue ignores these fields when deciding whether to apply an update.

## 2. Observed Failure Modes

1. **Late update overwrite** – an older payload that left Torii earlier but took longer to reach the browser can overwrite the newer state because the batch processor lacks version checks.
2. **Queue backlog / replay of stale state** – bursts of updates fill the in-memory queue; every item is applied sequentially even if superseded by newer data. There's little dedupe beyond a shallow merge.
3. **Silent websocket stalls** – if the WS connection drops or the tab sleeps, we stop receiving updates and never perform a resync. Users just stay desynced until a manual reload.
4. **Replay gaps** – when a resync does happen we risk applying an older snapshot if multiple sync updates were emitted; we must always converge on the most recent version before resuming realtime.
5. **SQL snapshot drift** – `MapDataStore` depends on SQL responses refreshed only once during `initialSync`. Any delay in the SQL pipeline or partial fetch failure leaves clients with outdated owner/army data.
6. **Limited telemetry** – current code logs to console only. Ops cannot see queue depth, last-applied block, or sync health, making regressions hard to diagnose.

## 3. Design Goals

- **Eventual correctness** – the ECS world should converge to onchain truth without requiring a full reload.
- **Backpressure-aware** – handle bursts gracefully, avoid unbounded in-memory queues.
- **Self-healing** – detect when streams stall and trigger replay using Torii pagination, always ending on the latest update in the sequence.
- **Single source of truth** – derived presentation layers (Three.js, UI stores, map cache) should lean on the same authoritative data rather than parallel pipelines.
- **Actionable metrics** – expose enough info for monitoring and QA.

## 4. Proposed Architecture Changes

### 4.1 Version-Aware Sync Pipeline

**Objectives**
- Prevent stale overwrites by requiring monotonic versions per entity/component.
- Deduplicate queued updates before hitting `setEntities`.

**Key ideas**
1. **Normalize metadata:** extend the queued payload with `block_number`, `event_index`, and component-level `last_updated_at` values. Torii already provides them; we just need to persist them in the queue.
2. **Entity ledger:** maintain a per-entity map `{ lastBlock, lastEvent, lastUpdatedByComponent }`. Before applying a queued update, compare metadata. Drop the update if it is older than the ledger. On success, update the ledger.
3. **Component-level guards:** For components with `last_updated_at`, compare per component—only replace values if the incoming timestamp is ≥ the stored one. Deletions (empty `models`) still win and advance the ledger so tombstones are respected.
4. **Queue compaction:** when enqueuing, replace any existing queued item for the same entity if the new payload is newer. That keeps queue length bounded even during bursts.
5. **Apply path:** once ordered, call `setEntities` with only the surviving updates. The ledger ensures we never regress even if multiple sync batches arrive quickly.

### 4.2 Sync Guard & Replay Mechanism

**Objectives**
- Detect stalled streams and provide an automatic recovery path that always lands on the freshest state.
- Emit health metrics.

**Key ideas**
1. **Heartbeat:** track the wall-clock time and ledger version of the last applied update. If no progress occurs within a threshold (e.g. 30 s) while the connection is open, assume a stall.
2. **Fallback cursor:** store the `next_cursor` returned by the last successful `getEntities`/`getEventMessages` paginated fetch. On stall, use `getSyncEntities` (or `getEntitiesQuery`) from that cursor to replay.
3. **Replay reconciliation:** as replay pages arrive, feed them through the same version-aware queue so only the final / highest block wins even if Torii emits multiple snapshots for the same entity.
4. **Reconnect & resubscribe:** cancel existing subscriptions, establish a fresh websocket, and resume streaming once replay catches us up. Gate resubscribe on ledger advancement so we know we’re back on the latest block.
5. **Failure budget:** declare the max replay attempts (default 3) via config. After exceeding the threshold we surface an error + optional “hard reload” CTA. This keeps behaviour tweakable per environment.
6. **State machine:** encode sync state (e.g. `idle → streaming → lagging → replaying → streaming`) for clarity and debugging.
7. **Observer hooks:** surface state via a dedicated store/context so UI can show “Resyncing…” banners if desired.

### 4.3 Map Data Pipeline Rework

**Objectives**
- Eliminate dependency on stale SQL snapshots for live-critical data, or at least guarantee timely refreshes.

**Options**
1. **Preferred:** derive map data purely from the ECS world and event logs. Use `runQuery`/`HasValue` against RECS to compute active productions, guard armies, etc., and keep SQL for heavy analytics.
2. **If SQL must remain:**
   - Use `MapDataStore.startAutoRefresh()` with a sensible cadence (e.g. 15–30 s) triggered after initial sync.
   - Add per-entity versioning: store `lastFetchedAt` and compare to ledger data from the Torii stream. If the stream indicates a newer version, either refresh the specific entity or mark the SQL data as stale.
   - Provide retry-with-backoff and error propagation so stale caches surface to the UI.

### 4.4 Observability & Tooling

- **Metrics:** capture queue length, dropped update count, last applied block, replay duration, websocket connection state. Route to PostHog or another analytics sink.
- **Debug dashboard:** behind a dev flag, show the ledger per entity and recent sync events.
- **Logging discipline:** replace bare `console.log` with a structured logger (include tags like `sync`, `entityId`, `block`).

### 4.5 Testing & Verification

- **Unit tests:** for the queue/ledger logic (ensure stale updates are rejected, deletions win, compaction works).
- **Integration harness:** spawn a mock Torii server emitting out-of-order events to verify convergence and replay correctness.
- **Load/latency tests:** simulate high-frequency updates to validate backpressure behaviour and confirm the replay cap engages as expected.

## 5. Implementation Roadmap

| Phase | Scope | Notes |
| --- | --- | --- |
| 1 | Build version-aware queue + ledger; integrate into `syncEntitiesDebounced`; seed ledger during initial sync | Minimum viable protection against stale overwrites. |
| 2 | Introduce Sync Guard state machine with heartbeat + replay (configurable retry cap); add telemetry hooks | Ensures recovery from stalls and prevents stale replays. |
| 3 | Map data revamp (choose ECS-driven or refreshed SQL); integrate with Sync Guard | Removes major source of desync. |
| 4 | Observability polish, testing harnesses, documentation updates | Solidifies long-term maintenance. |
| 5 | Explore IndexedDB-backed cache for ledger/queue persistence (post-refactor) | Optional follow-up once refactor lands. |

### 5.1 Current Implementation Snapshot

- Phase 1 + 2 are implemented in `client/apps/game/src/dojo/sync.ts` and mirrored for mobile. The sync entry point now exposes `getState()` and `forceReplay()` helpers and accepts an optional `SyncGuardOptions` bag (`{ logging?: boolean; guard?: Partial<SyncGuardConfig>; onStateChange?: (state) => void }`).
- Default guard config: `heartbeatTimeoutMs = 30_000`, `heartbeatCheckIntervalMs = 5_000`, `maxReplayAttempts = 3`, `replayPageLimit = EVENT_QUERY_LIMIT (40_000)`. Override via the `guard` key when calling `syncEntitiesDebounced`.
- Guard state transitions surface through the optional `onStateChange` callback and console logs (tagged `[sync-guard]`). States: `streaming`, `lagging`, `replaying`, `error`.
- Manual recovery is available through the returned `forceReplay()` promise. `cancel()` now tears down both subscriptions and the heartbeat loop.
- In dev builds an inspector is attached at `window.__SYNC_DEBUG__`, exposing queue stats, guard snapshots, `forceReplay()`, and `cancel()` hooks per client (`torii-sync:game`, `torii-sync:mobile`).

## 6. Required Schema/Contract Considerations

- Torii already emits `block_number` / `event_index`; we just need to plumb them through the queue.
- All relevant components expose `last_updated_at` (per `packages/types/src/dojo/contract-components.ts`); confirm onchain values match expectations (i.e. they advance every meaningful write).
- If we derive map data from ECS, ensure the necessary components are synchronized client-side (structures, armies, arrivals, etc.).

## 7. Open Questions

1. Should replay re-run **all** components or only a targeted subset (based on ledger gaps)?
2. What UI treatment do we want when the configurable replay cap trips (after three defaults)?
3. How aggressively should we compact the queue—per entity only, or per component as well?
4. IndexedDB persistence: once Phase 1–2 stabilize, decide whether ledger state should persist across reloads (separate follow-up task).

## 8. Next Steps

1. Confirm the preferred map data strategy (ECS vs. SQL refresh) and record the decision.
2. Approve the Version-Aware Sync Pipeline + Sync Guard design (with configurable replay cap and latest-state reconciliation).
3. Execute Phase 1 and Phase 2 refactors; once merged, revisit IndexedDB caching as a separate iteration.

---

Prepared for review; feedback welcome before we commit to implementation.
