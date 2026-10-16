# Eternum packages / SDK

These packages support client + tooling integration with the Eternum world.

## Packages

- `@bibliothecadao/eternum` → [`packages/core`](./core)
- `@bibliothecadao/provider` → [`packages/provider`](./provider)
- `@bibliothecadao/types` → [`packages/types`](./types)

React hooks live with the [game client](../apps/game/src/hooks).

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
