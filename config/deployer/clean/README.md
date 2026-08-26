# Game launch

The launcher registers games in a persistent Dojo world. A game is a `GameRegistry` row keyed by `game_id`; launching
one does not deploy or configure another world.

Supported environments:

- `madara.blitz`
- `appchain.blitz`
- `appchain.eternum`

Each environment points to a committed world manifest, registrar address, balance config, and RPC endpoint. The
registrar consumes an immutable preset when it creates a game.

## Launch one game

```bash
bun config/deployer/clean/cli/create.ts \
  --environment madara.blitz \
  --game bltz-lab-96 \
  --start-time 1787666400
```

Required inputs are `--environment`, `--game`, and `--start-time`. Start time accepts Unix seconds, Unix milliseconds,
or ISO 8601.

Useful options:

- `RPC_URL` or `--rpc-url`
- `DOJO_ACCOUNT_ADDRESS` or `--account-address`
- `DOJO_PRIVATE_KEY` or `--private-key`
- `DEV_MODE_ON=true|false` or `--dev-mode-on true|false`
- `SINGLE_REALM_MODE=true|false` or `--single-realm-mode true|false`
- `TWO_PLAYER_MODE=true|false` or `--two-player-mode true|false`
- `DURATION_SECONDS=<integer>` or `--duration-seconds <integer>`
- `MAP_CONFIG_OVERRIDES_JSON=<json>` or `--map-config-overrides-json <json>`
- `BLITZ_REGISTRATION_OVERRIDES_JSON=<json>` or `--blitz-registration-overrides-json <json>`
- `--version <preset-id>`
- `--dry-run`

`single_realm_mode` and `two_player_mode` are mutually exclusive. A per-game fee token override is refused because the
fee token belongs to the chain-wide preset.

## Run one launch step

The step runner is the recovery boundary used by CI:

```bash
bun config/deployer/clean/cli/launch-step.ts \
  --step wait-for-factory-index \
  --environment madara.blitz \
  --game bltz-lab-96 \
  --start-time 1787666400
```

Single-game steps:

- `create-world`: submit `create_game` to the persistent registrar
- `wait-for-factory-index`: wait until Torii exposes the new `GameRegistry` row

Series and rotation launches add one registrar step and group the two game steps:

- `create-series`
- `create-worlds`
- `wait-for-factory-indexes`

The word `world` remains in the step ids for run-store compatibility. These steps create registry rows in the existing
world.

## GitHub workflow

`.github/workflows/game-launch.yml` exposes the same steps. `launch_step=full` runs the relevant sequence. Selecting a
step resumes from that point and runs the remaining registrar steps.

The workflow accepts a repo-relative YAML file through `config_path`. Series files contain an explicit `games` list.
Rotations can use `weeklyCadence` and keep an advance window populated until the rotation is cancelled.

GitHub Environments provide:

- `GAME_LAUNCH_DOJO_ACCOUNT_ADDRESS`
- `GAME_LAUNCH_DOJO_PRIVATE_KEY`

The workflow records structured state on the `factory-runs` branch:

- immutable input records under `inputs/<chain>/<game-type>/...`
- mutable run records under `runs/<chain>/<game-type>/...`
- maintenance indexes under `indexes/<chain>/<game-type>/...`

Run records include the current step, lease, transaction hash, game id, world address, and failure text. A lease blocks
two workflows from using the deployment account for the same logical step. Expired leases do not block recovery.

Local summaries are written to `.context/game-launch/` and uploaded even when a later workflow step fails.
