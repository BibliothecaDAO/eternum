# Game launch

The launcher registers games in a persistent Dojo world. A game is a `GameRegistry` row keyed by `game_id`; launching
one does not deploy or configure another world.

The one launchable environment is `madara.blitz`: the self-hosted Madara appchain, its committed world manifest and the
generated Blitz balance sheet. The registrar consumes an immutable preset when it creates a game.

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

## Series, rotations and the launch service

Series and rotation launches run through the box launch service (`apps/launch-service`). It claims one job at a time and
drives the registrar steps in order: `create-series`, then `create-worlds` for every game, then
`wait-for-factory-indexes` until Herald exposes each `GameRegistry` row. Single-game launches use `create-world` and
`wait-for-factory-index`. The word `world` remains in the step ids; every step creates registry rows in the existing
world.

Rotation configs live in `launch-configs/`. `madara-blitz-daily.yaml` is the standing lab rotation; the box timer
re-enqueues it every 30 minutes, and each evaluation creates only the games missing from its advance window. Launch
state lives in the service's Postgres store, which the factory page reads through `/api/factory/runs`.
