# Game Launch CI

Creates and configures a single world using the clean deployer module in `config/deployer/clean`.

The full launcher still exists for one-shot local runs, but the GitHub workflow now executes the launch through
individual clean deployer steps so GitHub Actions can expose launch progress directly.

## Usage

```bash
bun config/deployer/clean/cli/create.ts \
  --environment slot.blitz \
  --game bltz-fire-gate-42 \
  --start-time 1763112600
```

Required inputs:

- `--environment`: `slot.blitz` or `slot.eternum`
- `--game`
- `--start-time`: unix seconds, unix milliseconds, or ISO-8601

Optional env or flags:

- `RPC_URL` or `--rpc-url` to override the environment default
- `FACTORY_ADDRESS` or `--factory-address` to override the environment default
- `DOJO_ACCOUNT_ADDRESS` or `--account-address` to override the environment default
- `DOJO_PRIVATE_KEY` or `--private-key` to override the environment default
- `VITE_PUBLIC_VRF_PROVIDER_ADDRESS` or `--vrf-provider-address`
- `TORII_NAMESPACES` or `--torii-namespaces`
- `CARTRIDGE_API_BASE` or `--cartridge-api-base`
- `GITHUB_TOKEN` for direct Torii workflow dispatch
- `GITHUB_REPOSITORY` when running outside GitHub Actions
- `--workflow-file` and `--ref` to override the target Torii workflow dispatch
- `VERBOSE_CONFIG_LOGS=true` or `--verbose-config-logs` to expose the legacy `config.ts` logs
- `DEV_MODE_ON=true|false` or `--dev-mode-on true|false`
- `SINGLE_REALM_MODE=true|false` or `--single-realm-mode true|false`
- `TWO_PLAYER_MODE=true|false` or `--two-player-mode true|false`
- `DURATION_SECONDS=<integer>` or `--duration-seconds <integer>`
- `--mode batched|sequential`
- `--skip-indexer`
- `--skip-lootchest-role-grant`
- `--skip-banks`
- `--dry-run`

Environment defaults are currently defined for both slot environments for:

- factory address
- RPC URL
- dojo account address
- dojo private key

GitHub Actions credentials are selected through GitHub Environments:

- environment `slot.blitz`
  - var: `GAME_LAUNCH_DOJO_ACCOUNT_ADDRESS`
  - secret: `GAME_LAUNCH_DOJO_PRIVATE_KEY`
- environment `slot.eternum`
  - var: `GAME_LAUNCH_DOJO_ACCOUNT_ADDRESS`
  - secret: `GAME_LAUNCH_DOJO_PRIVATE_KEY`

The workflow does not need CI-provided defaults for Torii namespaces, Cartridge API base, or VRF provider address. Those
are defaulted inside the clean deployer module, and the VRF provider default matches the shared slot value from the game
env files.

The clean deployer creates indexers only by dispatching `.github/workflows/factory-torii-deployer.yml` directly with
GitHub's workflow API. It waits for that workflow run to finish, and only marks the indexer as created when the workflow
concludes with `success`.

When running locally, the clean deployer can fill in missing GitHub dispatch inputs from local tooling:

- if `GITHUB_TOKEN` is unset, it tries `gh auth token`
- if `GITHUB_REPOSITORY` is unset, it tries `gh repo view --json nameWithOwner --jq .nameWithOwner`
- if no ref is provided, it tries `git branch --show-current`

Whenever one of those fallbacks is used, it logs the reason to stderr.

Artifacts are written to `.context/game-launch/`.

## Step Runner

Each launch step can also be executed directly:

```bash
bun config/deployer/clean/cli/launch-step.ts \
  --step configure-world \
  --environment slot.blitz \
  --game bltz-fire-gate-42 \
  --start-time 1763112600
```

Supported step ids:

- `create-world`
- `wait-for-factory-index`
- `configure-world`
- `grant-lootchest-role`
- `grant-village-pass-role`
- `create-banks`
- `create-indexer`

The step runner uses the same request shape and env defaults as the full launcher. This is the script boundary the
workflow uses now, and it is also the intended recovery boundary for browser-driven reruns.

## GitHub Workflow

`.github/workflows/game-launch.yml` now exposes `launch_step`:

- `full` for the normal first trial
- one explicit step id for targeted recovery

When `launch_step=full`, the workflow still behaves like one click from the operator's point of view, but GitHub now
shows each launch step separately:

- Create world
- Wait for factory index
- Configure world
- Grant loot chest role
- Grant village pass role
- Create banks
- Create indexer

The launch summary artifact upload now runs with `always()` so partial summaries still upload when a later step fails.

The workflow also writes launch state to the dedicated `factory-runs` branch:

- immutable launch input records under `inputs/<chain>/<game-type>/<game-name>/<run-id>.json`
- mutable run state under `runs/<chain>/<game-type>/<game-name>.json`

The input record captures what the operator asked for. The run record captures what the launch is doing now, which
steps are done, and the latest artifacts written by the clean deployer. This means another browser or a recovery flow
can look up the same game and see the current state without rerunning CI just to discover that the launch already
completed.

The branch writes are driven by `config/deployer/clean/cli/launch-run-store.ts`. The workflow records:

- launch started
- step started
- step succeeded
- step failed

Each single-step launch still writes the same local `.context/game-launch/<environment>-<game>.json` summary, and that
summary now accumulates across steps so the branch-backed run record can publish one coherent view of the launch.

The run record also carries a lease while a step is actively running. `launch-started` checks for a fresh conflicting
lease before a new workflow takes ownership, `step-started` acquires the lease for the current logical step, and
`step-succeeded` / `step-failed` release it again. That keeps the locking rules local to the run-store layer instead of
burying conflict logic inside the workflow YAML. Stale leases are ignored after their expiry window so canceled runs do
not block recovery forever.

For `slot.eternum`, the launch flow also runs the village pass role grant automatically after world configuration. It
grants `MINTER_ROLE` on the chain's `villagePass` contract to the deployed `realm_internal_systems` contract for the new
game, using the same admin account as the rest of the launch.

## Village Pass Role Grant

For `{network}.eternum` worlds, the clean deployer also exposes a dedicated command to grant `MINTER_ROLE` on the
chain's `villagePass` contract to the deployed `realm_internal_systems` contract for one game:

```bash
bun config/deployer/clean/cli/grant-village-pass-minter-role.ts \
  --chain slot.eternum \
  --game etrn-iron-mist-11
```

It resolves the live world addresses from factory SQL, patches the game manifest in memory, finds
`s1_eternum-realm_internal_systems`, loads `villagePass` from `contracts/common/addresses/{chain}.json`, and submits a
single `grant_role(MINTER_ROLE, realm_internal_systems)` transaction. Artifacts are written to
`.context/village-pass-minter-role/`.

Progress output is written to stderr during execution so CI logs show the current stage and elapsed time without
breaking the final JSON written to stdout.

`single_realm_mode` and `two_player_mode` are validated as mutually exclusive.

`durationSeconds` remains a config override. The clean deployer uses it for blitz `season.end_at`, while eternum seasons
still send `end_at = 0` because they end on in-game completion conditions.
