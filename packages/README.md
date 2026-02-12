# Eternum packages / SDK

These packages support client + tooling integration with the Eternum world.

## Packages

- `@bibliothecadao/eternum` → [`packages/core`](./core)
- `@bibliothecadao/provider` → [`packages/provider`](./provider)
- `@bibliothecadao/react` → [`packages/react`](./react)
- `@bibliothecadao/torii` → [`packages/torii`](./torii)
- `@bibliothecadao/types` → [`packages/types`](./types)

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
