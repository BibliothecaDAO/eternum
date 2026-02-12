# Chain Time Monotonicity PRD + TDD

Prepared: 2026-02-09 Owners: Game Client / Core SDK Status: Implemented in this branch (pending review + rollout)

## 1. Problem Statement

Players observe non-monotonic displayed game time/tick values in `client/apps/game` (example reported:
`29511210 -> 29511211 -> 29511210` within a few seconds).

This causes:

- visual jitter in time-driven UI
- trust issues around countdowns and tick-based state
- potential confusion about whether chain/indexer is unstable

## 2. Scope

In scope:

- client-side chain time source in game app
- monotonicity guard in chain heartbeat ingestion
- structured debug logs to diagnose upstream/provider drift
- unit tests for regression protection

Out of scope:

- Torii indexer internals
- protocol/block production changes
- large refactors of unrelated timer consumers

## 3. Current Architecture Summary

### Time path used by game tick consumers

1. `ChainTimePoller` fetches latest block timestamp from RPC (`getBlock("latest")`):
   `client/apps/game/src/ui/shared/components/chain-time-poller.tsx`
2. Poller writes heartbeat to `useChainTimeStore`: `client/apps/game/src/hooks/store/use-chain-time-store.ts`
3. Global timestamp source is overridden by `setBlockTimestampSource(() => getNowSeconds())`:
   `packages/core/src/utils/timestamp.ts`
4. Consumers call `getBlockTimestamp()` directly or through store wrappers.

### Why the rewind happened

When a new heartbeat was:

- newer than the last heartbeat, but
- slightly behind extrapolated `now` based on local perf clock,

the old logic reset anchor to raw heartbeat instead of clamping to extrapolated now. This can move logical time backward
and cross a tick boundary backward.

## 4. Root Cause

In `useChainTimeStore.setHeartbeat`, anchor assignment used:

- `anchorTimestampMs = heartbeat.timestamp`

instead of:

- `anchorTimestampMs = max(heartbeat.timestamp, extrapolatedNowMs)`

Result: allowed micro-rewinds despite heartbeat monotonicity check against only `lastHeartbeat`.

## 5. Product Goals

1. Monotonic logical time in-client.
2. Preserve chain alignment when heartbeat is ahead of extrapolated local time.
3. Add enough diagnostics to separate:
   - provider/RPC lag
   - client extrapolation drift
   - stale/invalid heartbeat payloads
4. Keep change low-risk and backwards compatible.

## 6. Functional Requirements

FR-1: `setHeartbeat` must never move logical time backward.

FR-2: Heartbeats older than the last accepted heartbeat must be discarded.

FR-3: Heartbeats behind extrapolated now but ahead of last heartbeat must be clamped forward to extrapolated now.

FR-4: Poller must emit structured debug logs for success/error/invalid heartbeat cases when debug mode is enabled.

FR-5: Debug mode must be opt-in and disabled by default.

## 7. Non-Functional Requirements

NFR-1: No behavior change for users unless problematic rewind condition occurs.

NFR-2: Debug logs must be non-invasive (no overhead when disabled beyond cheap branching).

NFR-3: Unit tests must validate monotonicity behavior and stale heartbeat rejection.

## 8. Delivered Changes

### Logic fix

- `client/apps/game/src/hooks/store/use-chain-time-store.ts`
  - heartbeat anchor now clamps via:
    - `anchorTimestampMs = Math.max(heartbeat.timestamp, currentNowMs)`

### Debug log utility

- `client/apps/game/src/utils/chain-time-debug.ts`
  - `CHAIN_TIME_DEBUG_STORAGE_KEY = "ETERNUM_CHAIN_TIME_DEBUG"`
  - enable via:
    - `localStorage.setItem("ETERNUM_CHAIN_TIME_DEBUG", "1")`
    - or `?chainTimeDebug=1`

### Poller instrumentation

- `client/apps/game/src/ui/shared/components/chain-time-poller.tsx`
  - added structured debug events around poll lifecycle and heartbeat ingestion.

### Tests (TDD coverage)

- `client/apps/game/src/hooks/store/use-chain-time-store.test.ts`
  - monotonic clamp behavior
  - stale heartbeat discard behavior

## 9. Debug Logging Specification

All logs are prefixed with:

- `[chain-time][<event>]`

Events:

1. `source_bound`

- fired when global timestamp source is bound to chain store
- payload includes debug key and poll interval

2. `poll_success`

- payload fields:
  - `blockNumber`
  - `chainTimestampSeconds`
  - `heartbeatTimestampMs`
  - `localNowMs`
  - `chainToLocalDeltaMs`
  - `pollLatencyMs`

3. `poll_invalid_timestamp`

- fired when RPC returns non-finite timestamp

4. `poll_error`

- fired on polling exception

5. `heartbeat_applied`

- payload fields:
  - `heartbeatTimestampMs`
  - `heartbeatBlockNumber`
  - `heartbeatSource`
  - `previousAnchorTimestampMs`
  - `previousNowMs`
  - `nextAnchorTimestampMs`
  - `rewindPreventedMs`

6. `heartbeat_discarded_stale`

- payload fields:
  - `heartbeatTimestampMs`
  - `lastHeartbeatTimestampMs`
  - `heartbeatBlockNumber`
  - `heartbeatSource`

## 10. TDD Plan and Evidence

### RED

Added failing test:

- `keeps logical time monotonic when a heartbeat is newer than last heartbeat but behind extrapolated now`

Failure observed before fix:

- expected clamped anchor (`...1500`) but got rewound anchor (`...1000`)

### GREEN

Implemented minimal production fix:

- clamp to `Math.max(heartbeat.timestamp, currentNowMs)`

### VERIFY

Executed:

- `pnpm --filter eternum-game-client exec vitest run src/hooks/store/use-chain-time-store.test.ts`

Result:

- pass (2/2 tests)

## 11. Acceptance Criteria

AC-1: No `N -> N+1 -> N` tick rewind due to heartbeat ingestion.

AC-2: Rewind scenarios produce `heartbeat_applied` logs with `rewindPreventedMs > 0` when debug mode enabled.

AC-3: Stale heartbeats are ignored and logged as `heartbeat_discarded_stale` in debug mode.

AC-4: Unit tests in `use-chain-time-store.test.ts` stay green in CI.

## 12. Rollout Plan

1. Merge behind normal release flow (no feature flag required).
2. Enable debug logs in staging sessions only:
   - `localStorage.setItem("ETERNUM_CHAIN_TIME_DEBUG", "1")`
3. Verify:
   - no visible tick rewinds in observed UI
   - expected debug events appear
4. Disable debug logs after diagnosis.

## 13. Risks and Mitigations

Risk: clamping could mask short-lived provider lag spikes. Mitigation: `rewindPreventedMs` metric remains visible via
debug logs for diagnosis.

Risk: log volume when enabled. Mitigation: opt-in only and easy disable.

## 14. Open Questions

1. Should poll interval (currently 60s) be reduced or made adaptive by world/chain mode?
2. Should we expose a lightweight in-app diagnostics panel for chain time skew in dev builds?
3. Should `getBlockTimestamp` direct-call consumers migrate to a single subscribed source for consistent rerender
   cadence?
