# Game Factory SDK

Toolkit for turning the already declared Eternum contracts into fully fledged game instances on Starknet. The package
wraps class hashes, calldata compilation, and deployment sequencing in a single developer-friendly API.

## Product Goals

- Provide a simple `GameFactory` facade that can spin up or tear down a game with one call.
- Guarantee constructor calldata correctness by compiling against the canonical ABIs.
- Support fee estimation, dry runs, and helpful error types so consumers can integrate safely.
- Stay network aware (devnet, testnet, mainnet) and avoid redeclaration of classes that already exist.

## Planned Architecture

```
src/
  index.ts                 // Public exports
  config/
    class-registry.ts      // Class hashes & ABI metadata per network
    presets.ts             // Named deployment configurations (map sizes, rule sets, etc.)
  factory/
    game-factory.ts        // High-level facade: deployGame, deployModule, estimateFees, dryRun
    deployment-plan.ts     // Builds ordered deployment graph from presets
  deployment/
    executor.ts            // Orchestrates declare/deploy steps with retries and receipts
    call-data.ts           // Typed helpers built on starknet.js CallData
  state/
    game-registry.ts       // Optional read helpers for already deployed instances
  errors/
    index.ts               // Domain specific error classes & guards
  types/
    index.ts               // Shared interfaces: GamePreset, DeploymentResult, FactoryOptions, etc.
  utils/
    logger.ts              // Scoped logging
    time.ts                // Wait helpers, polling wrappers
```

### Flow Overview

1. **Select preset** – Consumer picks a configuration (or crafts one) describing which modules to deploy.
2. **Build deployment plan** – `deployment-plan.ts` resolves dependencies and constructor params for every contract.
3. **Compile calldata** – `call-data.ts` uses ABIs from `class-registry.ts` to validate constructor arguments.
4. **Execute deployment** – `executor.ts` calls `account.deployContract` (or `declareAndDeploy` when needed), waits for
   confirmations, and returns typed results.
5. **Register instance** – `game-registry.ts` stores resulting addresses for follow-up interactions.

### Network Awareness

- `class-registry.ts` stores hashes for each supported Starknet environment.
- Optional `declareIfNot` path for local devnets when a class hash is missing.
- Fee helpers expose `estimateDeployFee` so clients can pre-fund deployment accounts.

### Error Strategy

- Custom error classes (`InsufficientFundsError`, `MissingClassHashError`, `AbiMismatchError`) bubble up actionable
  messages.
- Execution results include partial progress for recovery if multi-step deployment fails midway.

### Config Package Integration

- Every `deployGame` call emits a `GameDeploymentArtifact` capturing contract addresses, class hash versions, and
  constructor payloads.
- Artifacts are written to `artifacts/<network>/<timestamp>.json` and mirror the data shape the config workspace expects.
- The `config` package can consume these artifacts (`bun run index.ts --artifact path/to/artifact`) to materialize
  environment JSON without relying on pre-existing deployments.
- `class-registry.ts` stays the single source of truth shared by both the factory and config generation.
- Legacy on-chain manifest lookups remain as a fallback for historical/mainnet seasons.

### Testing & Tooling

- Contract integration tests will run against `pnpm run contract:start:local`.
- Unit tests cover calldata builders and plan generation.
- Typedoc will surface the factory API; `pnpm --dir packages/game-factory build` emits ESM + CJS artifacts via `tsup`.

## Next Steps

- Finalize which contract classes and presets ship in v0.
- Implement the config modules and factory facade skeleton.
- Add integration tests that verify a full deployment round-trip on devnet.
