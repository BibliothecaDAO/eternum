# Eternum SDK

`@bibliothecadao/eternum` owns the shared game client, native fact store, synchronization runtime and gameplay managers.
Browser and bot callers use the same client and command path.

`createGameClient` verifies the deployment's schema identity, creates the provider and store, attaches Herald, and loads
the immutable game configuration. Recorded intents go through admission; transaction outcomes are matched to the
individual ticket even when several tickets share a transaction.

Herald snapshots and ordered diffs are the only writers of current facts. `NativeFactStore` applies each transaction
atomically; its typed rows, game/owner indexes and change feed serve React and the spatial projection. Events drive
transient effects and immutable history, never a second current-state store.

The `game-client` export contains world discovery and store helpers. `game-sync` contains the transport, runtime and
spatial projection. Generated facts and bindings come from `contracts/l3/world-native/schema`.

From the repository root:

```sh
pnpm run build:packages
pnpm --dir packages/core exec vitest run
```
