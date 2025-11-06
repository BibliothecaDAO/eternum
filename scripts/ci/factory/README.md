# Factory CI Toolkit

This folder contains the Bun/TypeScript CLI and helpers that automate deploying, configuring, indexing, and cleaning up Blitz worlds via GitHub Actions or local runs.

## Components

- maintain.ts
  - Orchestrates upcoming games: deploy all → configure all → create Torii for all, in phases.
  - Keeps a rolling set of future worlds based on fixed UTC slots (00:30, 09:30, 15:30, 19:30).
- cleanup.ts
  - Deletes Torii for stale worlds and prunes local state. Also removes generated calldata for deleted worlds.
- factory-calldata.ts
  - Generates calldata to call the world factory `deploy` and the factory `set_config` (audit) payload.
- config-calldata.ts
  - Generates per-world configuration calls in the same order as the UI and emits a single sozo multicall.
- ../ops.ts
  - Single entrypoint CLI that wires all of the above under easy subcommands.

## Data Layout (contracts/game)

- factory/<chain>/deployment.json
  - Single source of truth for planned + executed worlds. Example entry:
    ```json
    {
      "name": "bltz-fire-gate-42",
      "slotTimestamp": 1730605200,
      "deployed": true,
      "configured": true,
      "indexed": true
    }
    ```
- factory/<chain>/calldata/<world>/
  - deploy_calldata.txt|json: arguments for `sozo execute <factory> deploy ...`
  - set_config_calldata.txt|json: factory `set_config` payload (audit/trace)
  - world_config_calls.json: collected config calls via provider shim
  - world_config_multicall.txt: single line payload for `sozo execute ... / ...`
  - world_config_calls.sh: one-call-per-line helper
  - world_config_execute_multiline.sh: pretty wrapped execute script
  - world_address.txt: world address (if found via factory Torii)
  
- factory/<chain>/old-deployments.json
  - Archive of removed worlds. Entries are moved here during cleanup (with `archivedAt` epoch seconds).
  - The cleanup process uses this file as the source of truth for deletion retries and post-delete artifact pruning.

## Prereqs

- Bun and pnpm
- Build packages before using the CLI (imports from packages/*/dist):
  - `pnpm install && pnpm build:packages`
- sozo (for deploy/config phases); installed in CI and expected on PATH locally
- Slot CLI (only for cleanup): installed in CI and expected on PATH locally

## CLI Usage (via ops.ts)

- Maintain orchestrator (top up future worlds and run phases)
  - `bun scripts/ci/ops.ts orchestrator maintain --chain slot --target-upcoming 4 --rpc-url <url> --factory 0x.. --account-address 0x.. --private-key 0x.. [--admin-address 0x..]`
  - Signs transactions with the provided Dojo account.
  - Reads env: `RPC_URL`, `FACTORY_ADDRESS`, `DOJO_ACCOUNT_ADDRESS`, `DOJO_PRIVATE_KEY` (flags override)
  - Optional env/flags: `ADMIN_ADDRESS` (if omitted, uses `DOJO_ACCOUNT_ADDRESS`), `VRF_PROVIDER_ADDRESS`, `TORII_CREATOR_URL`, `TORII_NAMESPACES`
- Cleanup stale worlds (delete Torii + prune state + wipe calldata)
  - `bun scripts/ci/ops.ts orchestrator cleanup --chain slot --retention-hours 10`
  - Uses Slot CLI: `slot d delete <world> torii -f` (treats "not found" as success)
- Generate factory deploy args
  - `bun scripts/ci/ops.ts world factory-calldata --chain slot --world bltz-fire-gate-42`
- Generate world config multicall
  - `bun scripts/ci/ops.ts world config-calldata --chain slot --world bltz-fire-gate-42 --admin 0xYourAdmin [--start-main-at <epoch> --vrf 0x... ]`
- Execute (optional, if you want to drive sozo manually)
  - Deploy: `bun scripts/ci/ops.ts world deploy --chain slot --factory 0xFactory --args-file contracts/game/factory/slot/calldata/<world>/deploy_calldata.txt`
  - Configure: `bun scripts/ci/ops.ts world configure --chain slot --payload-file contracts/game/factory/slot/calldata/<world>/world_config_multicall.txt`
  - Note: deploy/config helpers and orchestrator both use the provided Dojo account for signing.

## How the Orchestrator Works

- Slot selection: computes upcoming fixed UTC slots for several days ahead.
- Top-up: ensures `deployment.json` contains up to `TARGET_UPCOMING` future entries; names are generated like `bltz-<word>-<word>-NN`.
- Phase 1 – Deploy
  - Generates factory deploy args and calls `sozo execute <factory> deploy ...`.
- Phase 2 – Configure
  - Generates config multicall via provider shim; executes a single `sozo execute` multicall.
  - Injects explicit admin into `set_world_config` calldata, matching UI behavior.
- Phase 3 – Torii
  - Creates Torii using `TORII_CREATOR_URL` (HTTP). If you prefer, this can be swapped to Slot CLI `slot d create` later.

## Cleanup Behavior

- Maintain archives past deployments by moving them from `deployment.json` to `old-deployments.json` (with `archivedAt`).
- Cleanup uses `old-deployments.json` as the source of truth to perform deletions:
  - Iterate every archived entry and run `slot d delete <world> torii -f` (idempotent; “not found” tolerated).
  - On success, remove the entry from `old-deployments.json` and delete its `factory/<chain>/calldata/<world>` directory.
  - Retries happen from the archive; `deployment.json` is not modified by the cleanup step.

## Workflows

- .github/workflows/factory-orchestrator.yml
  - Schedules the top-up + phases; commits changes under `contracts/game/factory`.
- .github/workflows/factory-cleanup.yml
  - Runs every 6 hours; deletes Torii older than 10h; prunes state and calldata; commits changes.

## Troubleshooting

- sozo errors (status 1/2): ensure you’re in a shell with sozo on PATH; the CLI sets cwd to `contracts/game` for execution.
- Missing payload files: rerun the generator commands; orchestrator expects files under `factory/<chain>/calldata/<world>`.
- Slot CLI not found: install via `curl -L https://slot.cartridge.sh | bash && ~/.config/.slot/bin/slotup` and add to PATH.
- Torii not created yet: config-calldata waits for `config_systems` address via Torii SQL with retries; you can increase retries if your indexer is slower.

## Notes & Conventions

- No fallbacks to legacy paths: `factory-calldata/*` and `factory-deployments/*` are deprecated.
- All state and artifacts live under `factory/<chain>`.
- Keep deployments.json named `deployment.json` (singular) to avoid ambiguity.
- Namespaces default to `s1_eternum`; tune via env if needed.
