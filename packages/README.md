# Eternum packages / SDK

These packages support client + tooling integration with the Eternum world.

## Packages

- `@bibliothecadao/eternum` → [`packages/core`](./core)
- `@bibliothecadao/provider` → [`packages/provider`](./provider)
- `@bibliothecadao/types` → [`packages/types`](./types)

React hooks live with the [game client](../apps/game/src/hooks).

A game client starts from `createGameClient` (`packages/core/src/client/game-client.ts`): a Herald session, the native
fact store, views and actions for one game on one shard. The web app and the headless
[agent runner](../apps/agent-runner/README.md) both use it. The current workspace packages are not published: build them
from source as below. The `@bibliothecadao/eternum@0.1.0` release on npm (2023) is an old package, not this client.

### Development

From the root to install all the packages deps

```
pnpm install
```

### Building packages

Navigate to a package and run the following. This will launch bun and watch for local changes, automatically compiling
and updating.

```
pnpm run build --watch
```
