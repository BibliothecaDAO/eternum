# Network Desync Flow

This document describes the client-side pieces that detect, surface, and recover from network desynchronisation in the
desktop Blitz client.

## Signal Pipeline

1. `EternumProvider` emits a `providerHeartbeat` whenever:
   - a transaction is submitted or confirmed,
   - the Torii entity stream produces an update, or
   - debugging tools call `simulateHeartbeat`.
2. `ProviderHeartbeatWatcher` subscribes to those events and writes each heartbeat into the Zustand store defined in
   `client/apps/game/src/hooks/store/use-network-status-store.ts`.
3. The store keeps a cached `status` object that tracks:
   - last heartbeat metadata,
   - whether a forced desync is active,
   - outstanding transaction timestamps, and
   - the elapsed time since the relevant event.
4. UI consumers read the cached snapshot via selectors, so render cycles never recompute status or mutate the store.

## Zustand Store Highlights

- `computeNetworkStatus` evaluates the current state and returns one of the supported reasons:
  - `forced` – manual toggle for QA and debugging.
  - `pending-tx` – a submitted transaction remains unconfirmed longer than the threshold.
  - `no-heartbeat` – the client has not yet heard from the network.
- The store exposes actions for heartbeats, thresholds, forcing/clearing desync, and ticking the clock. Each action
  recomputes the cached status to keep selectors pure.
- `tick()` is driven by a window interval to ensure elapsed timers advance even if no new heartbeat arrives.

## Stream Integration

- `client/apps/game/src/dojo/sync.ts` now:
  - Records a heartbeat whenever Torii pushes entity or event updates.
  - Stores the active subscription so it can be cancelled before resubscribing.
  - Exposes `resubscribeEntityStream`, which reruns the full `initialSync` (without resetting the loading overlay) to
    refresh world state after a desync.

## UI Behaviour

- `NetworkDesyncIndicator` displays the cached status.
  - During resync attempts a spinner replaces the status dot and the button label switches to “Re-syncing…”.
  - Failures surface both a toast and inline error text so the user understands why the recovery failed.
  - The headline/body copy changes per reason (`forced`, `pending-tx`, etc.) to provide context.
- Debug helpers (force desync, mock heartbeat) live under the same namespace and rely on the exposed store actions.

## Usage Tips

- Use `window.__eternumNetworkDebug.status()` to inspect the raw status object during development.
- Call `resubscribeEntityStream(setup, uiStore, setInitialSyncProgress, true)` when you need to fully refresh the client
  state without reloading the page.
- Mock heartbeats do not clear forced desyncs; use the “Clear” control or wait for the forced TTL to expire.

## Future Enhancements

- Add a lightweight keepalive heartbeat so long idle periods can still reassure the player.
- Extend the indicator with contextual actions (e.g., jump to pending transaction) once more telemetry is available.
