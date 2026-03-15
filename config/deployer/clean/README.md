# Game Launch CI

Creates and configures a single world using the clean deployer module in `config/deployer/clean`.

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

The workflow does not need CI-provided defaults for Torii namespaces, Cartridge API base, or VRF provider address. Those are defaulted inside the clean deployer module, and the VRF provider default matches the shared slot value from the game env files.

The clean deployer creates indexers only by dispatching `.github/workflows/factory-torii-deployer.yml` directly with GitHub's workflow API. It waits for that workflow run to finish, and only marks the indexer as created when the workflow concludes with `success`.

When running locally, the clean deployer can fill in missing GitHub dispatch inputs from local tooling:

- if `GITHUB_TOKEN` is unset, it tries `gh auth token`
- if `GITHUB_REPOSITORY` is unset, it tries `gh repo view --json nameWithOwner --jq .nameWithOwner`
- if no ref is provided, it tries `git branch --show-current`

Whenever one of those fallbacks is used, it logs the reason to stderr.

Artifacts are written to `.context/game-launch/`.

Progress output is written to stderr during execution so CI logs show the current stage and elapsed time without breaking the final JSON written to stdout.

`single_realm_mode` and `two_player_mode` are validated as mutually exclusive.

`durationSeconds` remains a config override. The clean deployer uses it for blitz `season.end_at`, while eternum seasons still send `end_at = 0` because they end on in-game completion conditions.
