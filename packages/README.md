# Eternum Packages

This directory contains the shared SDKs, client libraries, and agent tooling used across the repository.

## Package Index

- `@bibliothecadao/ammv2-sdk` → [`packages/ammv2-sdk`](./ammv2-sdk)
  - SDK for interacting with the Eternum AMMv2 indexer and pair math
- `@bibliothecadao/client` → [`packages/client`](./client)
  - Headless Eternum client for bots, agents, and custom UIs
- `@bibliothecadao/eternum` → [`packages/core`](./core)
  - Core Eternum SDK for Starknet and Dojo integrations
- `@bibliothecadao/dojo` → [`packages/dojo`](./dojo)
  - Dojo-facing provider utilities and integration helpers
- `@bibliothecadao/game-agent` → [`packages/game-agent`](./game-agent)
  - Autonomous agent framework and templates for onchain game play
- `@bibliothecadao/provider` → [`packages/provider`](./provider)
  - Provider layer for contract interaction and game actions
- `@bibliothecadao/react` → [`packages/react`](./react)
  - React bindings and hooks for consuming Eternum packages in apps
- `@bibliothecadao/torii` → [`packages/torii`](./torii)
  - Torii client helpers and query utilities
- `@bibliothecadao/types` → [`packages/types`](./types)
  - Shared Eternum types and constants

## Workspace Development

Install dependencies from the repo root:

```bash
pnpm install
```

Build the shared packages from the repo root:

```bash
pnpm run build:packages
```

To work on a single package, run its local build script from that package directory:

```bash
pnpm run build
```
