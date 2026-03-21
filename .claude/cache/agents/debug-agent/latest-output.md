# Debug Report: Chain Time Desync -- Client Clock Drifts Ahead of Chain

Generated: 2026-03-22

## Symptom

The client clock drifts ahead of the chain's block timestamp, causing resource balance inflation. Players see more
resources than the chain actually recognizes, leading to transaction failures when they try to spend those phantom
resources.

## Investigation Steps

1. Read `use-chain-time-store.ts` -- the core clock interpolation store
2. Read `chain-time-poller.tsx` -- the RPC polling component
3. Read `timestamp.ts` -- the tick computation utilities
4. Read `use-block-timestamp-store.ts` and `block-timestamp-poller.tsx` -- the derived tick store
5. Read `resource-manager.ts` -- how ticks drive balance projection
6. Read `config-manager.ts` -- what the Default tick duration actually is
7. Searched all callers of `getNowSeconds`, `getBlockTimestamp`, `currentDefaultTick`, `useBlockTimestamp`

## Evidence

### Finding 1: The Anti-Rewind Math.max Is a One-Way Ratchet That Accumulates Drift

- **Location:** `client/apps/game/src/hooks/store/use-chain-time-store.ts:56`
- **Code:**
  ```ts
  const currentNowMs = computeNowMs(state.anchorTimestampMs, state.anchorPerfMs);
  const anchorTimestampMs = Math.max(heartbeat.timestamp, currentNowMs);
  ```
- **Observation:** When a new heartbeat arrives from the chain, the store takes the **maximum** of the chain's reported
  timestamp and the client's current interpolated time. If the client has drifted ahead (which it will -- see Finding
  2), the chain's heartbeat is **ignored** and the client's inflated time becomes the new anchor.
- **Relevance:** This is the core bug. The anti-rewind logic prevents the clock from ever correcting downward. Every
  poll that finds the chain behind the client's interpolated time is a missed correction opportunity. Drift is
  monotonically non-decreasing.

### Finding 2: Client Interpolation Uses performance.now() Which Drifts From Chain Time

- **Location:** `client/apps/game/src/hooks/store/use-chain-time-store.ts:29-36`
- **Code:**
  ```ts
  const computeNowMs = (anchorTimestampMs, anchorPerfMs) => {
    const deltaMs = getPerfNowMs() - anchorPerfMs;
    return anchorTimestampMs + Math.max(0, deltaMs);
  };
  ```
- **Observation:** Between polls, time is interpolated by adding `performance.now()` delta to the anchor.
  `performance.now()` tracks wall-clock time at ~1ms resolution. But the chain's block timestamps advance only when
  blocks are produced. If block production is slower than wall-clock (even by milliseconds per block), the interpolated
  time will systematically overshoot the next block timestamp.
- **Relevance:** With a 60-second poll interval, even a small systematic bias (e.g., chain blocks produced every 3.01
  seconds instead of 3.00) accumulates to hundreds of milliseconds per poll cycle. Over an hour, this can reach seconds.

### Finding 3: Poll Interval Is 60 Seconds -- Too Slow to Limit Drift

- **Location:** `client/apps/game/src/ui/shared/components/chain-time-poller.tsx:8`
- **Code:** `const POLL_INTERVAL_MS = 60_000;`
- **Observation:** The chain is polled once per minute. Between polls, the client free-runs on `performance.now()`.
  There is no drift correction, no clamping, no maximum-drift guard.
- **Relevance:** 60 seconds of uncorrected interpolation is a long time. If the chain's block rate is even slightly
  slower than real-time, the client accumulates drift for the full 60 seconds before the next heartbeat arrives -- and
  then Finding 1 ensures that drift is never corrected.

### Finding 4: Default Tick Duration Is 1 Second -- Drift Directly Maps to Tick Inflation

- **Location:** `packages/core/src/managers/config-manager.ts:743-744`
- **Code:**
  ```ts
  } else if (tickId === TickIds.Default) {
    return 1;
  }
  ```
- **Location:** `packages/core/src/utils/timestamp.ts:23`
- **Code:**
  ```ts
  const currentDefaultTick = Math.floor(timestamp / Number(tickConfigDefault));
  ```
- **Observation:** The Default tick is 1 second. `currentDefaultTick = Math.floor(timestamp / 1) = timestamp`. Every
  second of clock drift equals one extra tick. One extra tick means one extra second of production applied to every
  producing resource.
- **Relevance:** This is the amplification mechanism. A 5-second clock drift means 5 extra ticks of production projected
  onto every resource balance across the entire game.

### Finding 5: Resource Balance Projection Uses Tick Delta Linearly

- **Location:** `packages/core/src/managers/resource-manager.ts:630-644`
- **Code:**
  ```ts
  private _amountProduced(production, currentTick, resourceId) {
    const ticksSinceLastUpdate = currentTick - production.last_updated_at;
    let totalAmountProduced = BigInt(ticksSinceLastUpdate) * production.production_rate;
    ...
  }
  ```
- **Observation:** `balanceWithProduction()` takes `currentTick` (which equals `currentDefaultTick` = the timestamp in
  seconds) and subtracts `last_updated_at` (the on-chain timestamp when production was last synced). The difference is
  multiplied by `production_rate`. Every extra second of drift adds `production_rate` units to the displayed balance.
- **Relevance:** This is where the inflation manifests. The client shows `balance + (drifted_ticks * rate)` while the
  chain knows `balance + (actual_ticks * rate)`. The difference is `drift_seconds * rate` per resource.

### Finding 6: CONSERVATIVE_TICK_BUFFER Only Helps for Transactions, Not Display

- **Location:** `packages/core/src/utils/timestamp.ts:12,39-47`
- **Code:**
  ```ts
  const CONSERVATIVE_TICK_BUFFER = 1;
  // ...
  currentDefaultTick: Math.max(0, currentDefaultTick - CONSERVATIVE_TICK_BUFFER),
  ```
- **Observation:** `getConservativeBlockTimestamp()` subtracts 1 tick from the current tick. This is used only in
  transaction validation paths (e.g., `use-transfer-automation-runner.ts:144`). The display paths (resource panels,
  upgrade checks, etc.) all use `getBlockTimestamp()` directly, which has no buffer.
- **Relevance:** The 1-tick buffer was designed to prevent tx failures, but (a) if drift exceeds 1 second it is
  insufficient, and (b) it does not address the displayed balance inflation at all. Users see inflated balances and try
  to spend them.

### Finding 7: Two Separate Time Systems with No Synchronization Between Them

- **Location:** `client/apps/game/src/ui/layouts/world.tsx:70-71`
- **Code:**
  ```tsx
  <BlockTimestampPoller />
  <ChainTimePoller />
  ```
- **Observation:** There are TWO independent time systems:
  1. **ChainTimeStore** (`use-chain-time-store.ts`) -- polls RPC every 60s, interpolates with `performance.now()`, has
     anti-rewind. This feeds `getBlockTimestamp()` via `setBlockTimestampSource()`.
  2. **BlockTimestampStore** (`use-block-timestamp-store.ts`) -- polls every 10s by calling `getBlockTimestamp()` (which
     reads from ChainTimeStore) and caches the tick values.
- **Relevance:** The BlockTimestampStore re-derives ticks every 10s from the ChainTimeStore. It cannot correct drift --
  it just consumes the already-drifted timestamp. The 10s polling of BlockTimestampStore means UI components may also
  show stale ticks (up to 10s old), but that is minor compared to the accumulating drift in ChainTimeStore.

### Finding 8: Heartbeat Stale-Check Only Guards Against Out-of-Order, Not Drift

- **Location:** `client/apps/game/src/hooks/store/use-chain-time-store.ts:45-53`
- **Code:**
  ```ts
  if (state.lastHeartbeat && state.lastHeartbeat.timestamp > heartbeat.timestamp) {
    // discard stale heartbeat
    return state;
  }
  ```
- **Observation:** This only rejects heartbeats with a timestamp older than the previous heartbeat. It does NOT reject
  heartbeats that are older than the current interpolated time (which is the drift scenario). The `Math.max` on line 56
  handles that case by... keeping the drifted time.

## Caller Census: How Widespread Is Clock Usage

The drifted clock reaches the entire game through these paths:

**Direct `getBlockTimestamp()` callers (imperative, outside React):** ~15 call sites

- `army-manager.ts` (6 calls) -- army movement timing
- `worldmap.tsx` (2 calls) -- map interactions
- `hexception.tsx` (1 call) -- building construction
- `select-preview-building.tsx` (3 calls) -- construction UI
- `market-modal.tsx`, `market-header.tsx` -- trading
- `castle.tsx` -- realm upgrades
- `resource-arrivals.tsx` -- arrival timing
- `world-update-listener.ts` -- event processing
- `use-automation.tsx`, `use-transfer-automation-runner.ts`, `use-exploration-automation-runner.ts` -- automation

**React hook `useBlockTimestamp()` callers (reactive, re-render on tick):** ~12 components

- `use-structure-upgrade.ts` -- upgrade eligibility
- `bridge.tsx` -- bridging
- `realm-info-panel.tsx`, `realm-details.tsx` -- realm display
- `buildings-list.tsx` -- production display
- `market-order-panel.tsx` (5 useMemo calls) -- order validation
- `realm-transfer.tsx` -- transfer UI
- `transfer-automation-panel.tsx` -- automation panel
- `tick-progress.tsx` -- tick display
- `army-list.tsx` -- army display
- `left-command-sidebar.tsx` -- sidebar

**`getNowSeconds` callers:** `store-managers.tsx` for auto-claim timing, season-end checks

**Total impact:** Every resource balance displayed anywhere in the game, every transaction validation, every automation
decision, every army movement calculation uses the potentially-drifted clock.

## Root Cause Analysis

The root cause is the combination of three design choices:

1. **One-way ratchet (Math.max):** The anti-rewind logic on line 56 of `use-chain-time-store.ts` prevents the clock from
   ever correcting backward. This was likely intended to prevent visual "time going backward" glitches but creates an
   accumulating positive bias.

2. **Wall-clock interpolation without drift correction:** Between 60-second polls, the client runs on
   `performance.now()` which tracks real wall-clock time. The chain's block timestamps do not necessarily advance at
   wall-clock rate (blocks may be produced at irregular intervals, or the chain may have its own clock that differs from
   the client's).

3. **1-second tick granularity:** Because `TickIds.Default = 1 second`, every millisecond of accumulated drift
   eventually rounds up to a whole extra tick, directly inflating production calculations.

**Maximum possible drift:** Unbounded. The drift is monotonically non-decreasing. After N poll cycles:

- If the chain is consistently D ms behind wall-clock per 60s interval, drift after N polls = N \* D ms.
- With the tab open for 1 hour (60 polls), if chain lags by even 100ms per cycle, drift = 6 seconds = 6 extra ticks of
  production on every resource.
- Tab open overnight (8 hours, 480 polls): drift could reach 48+ seconds.
- If the user's machine sleeps and resumes, `performance.now()` may jump, creating a massive one-time drift that can
  never be corrected.

**Confidence:** High

**Alternative hypotheses:**

- Network latency in RPC responses could add a systematic positive bias to the heartbeat timestamp (poll latency is
  measured but not compensated for).
- Browser tab throttling could cause `performance.now()` deltas to lag, but this would cause under-counting, not
  over-counting, so it is not the primary issue.

## Recommended Fix

**Files to modify:**

1. **`client/apps/game/src/hooks/store/use-chain-time-store.ts` (line 56)** -- Replace `Math.max` with drift-correcting
   logic. Options:
   - **Option A (simple clamp):** Allow the anchor to move backward up to some threshold (e.g., 5 seconds) per
     heartbeat: `anchorTimestampMs = heartbeat.timestamp` (always trust the chain). Add a separate "display smoothing"
     layer if visual jitter is a concern.
   - **Option B (exponential correction):** If client is ahead, blend toward the chain value:
     `anchorTimestampMs = currentNowMs + alpha * (heartbeat.timestamp - currentNowMs)` where alpha controls correction
     speed.
   - **Option C (hard reset with threshold):** If drift exceeds a threshold (e.g., 3 seconds), hard-reset to chain time.
     Otherwise, keep interpolating.

2. **`client/apps/game/src/ui/shared/components/chain-time-poller.tsx` (line 8)** -- Consider reducing
   `POLL_INTERVAL_MS` from 60000 to 10000-15000 to limit maximum drift between corrections.

3. **`packages/core/src/utils/timestamp.ts` (line 12)** -- Consider increasing `CONSERVATIVE_TICK_BUFFER` to 2-3 ticks
   if drift correction is gradual rather than immediate, to provide a larger safety margin for transactions.

**Steps:**

1. In `setHeartbeat`, replace line 56 (`Math.max(heartbeat.timestamp, currentNowMs)`) with logic that always trusts the
   chain timestamp, or at minimum allows downward correction.
2. Reduce poll interval to 10-15 seconds.
3. Add a maximum drift guard: if interpolated time exceeds chain time by more than N seconds, hard-reset.
4. Consider adding a `performance.now()` sanity check for tab sleep/resume scenarios (compare `performance.now()` delta
   with `Date.now()` delta; if they diverge significantly, hard-reset).

## Prevention

1. **Invariant:** The client clock should never be allowed to exceed the chain's latest known block timestamp by more
   than `(poll_interval + max_block_time)` seconds. Assert this in debug builds.
2. **Monitoring:** The `logChainTimeDebug` infrastructure already logs `rewindPreventedMs`. Surface this as a metric; if
   it is consistently > 0, drift is accumulating.
3. **Testing:** Add a unit test that simulates a chain returning timestamps that lag wall-clock by a fixed amount per
   poll, and verify that after 100 polls the client clock has not drifted more than a bounded amount.
