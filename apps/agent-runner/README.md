# Agent runner

One hired agent's process: a Pi agent whose tools are `GameClient` methods. It boots a game through `createGameClient`,
connects a signer, waits for its assigned realms and fields an explorer if it plays, and then runs a wake-driven
decision loop (world deltas, owner directions, a heartbeat, phase changes) until the game ends. Every run writes a
manifest with the loop, model, and action ledger. Design: `docs/plans/hired-agents-architecture-brief.md` §4; plan:
`docs/plans/hired-agents-milestones.md` M2.

## Run locally

Prerequisites: `pnpm install`, `pnpm build:packages`, and the lab chain values from `apps/game/.env`:

```sh
set -a; source apps/game/.env; set +a
```

Three signer modes, from the repository root:

```sh
# Spectate: no key, act refuses to submit.
pnpm --filter @bibliothecadao/agent-runner start -- --game-id 5 --signer none

# Guest: a Realms account that guards itself, minted on first run and kept in <data dir>/guest-key.json.
pnpm --filter @bibliothecadao/agent-runner start -- --game-name blitz-daily-0003 --signer guest

# Key: an existing gameplay account.
GAMEPLAY_PRIVATE_KEY=... GAMEPLAY_ACCOUNT_ADDRESS=... pnpm --filter @bibliothecadao/agent-runner start -- --game-id 5 --signer key
```

A playing account must be included in the game's frozen roster before settlement. The runner waits for the whole roster
to be ready; it does not register or settle a player itself.

A live run streams from OpenRouter and needs `OPENROUTER_API_KEY`; `--model-profile cheap|balanced|strong` picks the
model (`src/model-profiles.ts`). Flags win over environment variables; every flag is listed in `src/config.ts`.

| Environment variable                               | Flag                                                   | Meaning                                         |
| -------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------- |
| `SHARD_URL`                                        | `--shard-url`                                          | The shard's Herald; its manifest names the rest |
| `GAMEPLAY_PRIVATE_KEY`, `GAMEPLAY_ACCOUNT_ADDRESS` | `--gameplay-private-key`, `--gameplay-account-address` | Key mode                                        |
| `OPENROUTER_API_KEY`                               |                                                        | Live model calls (read by pi-ai)                |
| `MODEL_PROFILE`                                    | `--model-profile`                                      | `cheap`, `balanced` (default), or `strong`      |
| `AGENT_DATA_DIR`                                   | `--data-dir`                                           | Agent files; default `./.agent-data/<game id>`  |

The data dir holds `soul.md` and `skills/` (seeded from `templates/`), `memory/notes.md`, `reports.jsonl`, `directions/`
(drop a `*.md` to direct the agent), `debug/tool-responses.log`, and `runs/<run id>.json`, the manifest.

## Offline smoke

`--offline` swaps the model for a scripted one (`src/fake-stream.ts`) and needs no key: it observes, reads
`list_actions`, plans `armyPaths` for one explorer (mine, or while spectating the lowest-numbered one on the map), and
tries one `moveArmy` to the first reachable hex. With `--signer none` that move is refused and the manifest counts it as
`refused`; with a signer it is submitted. Pick a game that is live by its registry clock, or the loop stops at its first
tick:

```sh
pnpm --filter @bibliothecadao/agent-runner start -- --game-id 2 --signer none --offline --max-ticks 2 --heartbeat-ms 15000
```

The last line is the manifest; its `actions` block should show `planned: 1` and `refused: 1`.

## Image

`Dockerfile` builds the image the M3 supervisor runs in a sandbox. It is multi-stage: pnpm installs the runner's
workspace slice and builds the five packages it imports, and the runtime stage carries Bun, the production
`node_modules`, the built `packages/*/dist`, `src/` and `templates/`, and the two generated balance documents. Nothing
is installed at runtime. Build from the repository root and run the offline smoke against it:

```sh
docker build -f apps/agent-runner/Dockerfile -t agent-runner:dev .
docker run --rm -v "$PWD/.agent-data/image-smoke:/data" \
  -e SHARD_URL agent-runner:dev --game-id 2 --signer none --offline --max-ticks 2 --heartbeat-ms 15000
```

## M2 gate: one full Blitz

`scripts/play-blitz.sh` is the gate run: it plays the newest open Blitz game (or `--game-name`) in guest mode with a
chosen `--model-profile` until the game ends, then prints the manifest path and its cost line. The gate is "one full
Blitz under a measured cost envelope"; the envelope is whatever that manifest records, and no figure is written down
until a run has produced one.

```sh
OPENROUTER_API_KEY=... SHARD_URL=... apps/agent-runner/scripts/play-blitz.sh --model-profile balanced
```

It has not been run yet: the OpenRouter key and the binding authority key live on the lab box.

## Tests

```sh
pnpm --filter @bibliothecadao/agent-runner test
pnpm --filter @bibliothecadao/agent-runner typecheck
```
