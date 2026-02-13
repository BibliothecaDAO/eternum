# Axis (CLI)

Axis runs the Eternum autonomous agent in a terminal (TUI + CLI loop).

## Public Install

Install latest public release:

```bash
curl -fsSL https://github.com/bibliothecadao/eternum/releases/latest/download/install-axis.sh | bash
```

Install a pinned release:

```bash
curl -fsSL https://github.com/bibliothecadao/eternum/releases/latest/download/install-axis.sh | VERSION=v0.1.0 bash
```

More install/rollback/uninstall details: `client/apps/onchain-agent/INSTALL.md`.

## Building from Source (Local Dev)

Prerequisites: Node.js 22+, pnpm 9+.

```bash
# 1. Clone and install
git clone https://github.com/bibliothecadao/eternum.git
cd eternum
pnpm install

# 2. Build workspace dependencies (in order)
pnpm --dir packages/types build
pnpm --dir packages/torii build
pnpm --dir packages/provider build
pnpm --dir packages/client build
pnpm --dir packages/game-agent build

# 3. Type-check the agent
pnpm --dir client/apps/onchain-agent build

# 4. Configure
cd client/apps/onchain-agent
cp .env.example .env
# Edit .env — at minimum set ANTHROPIC_API_KEY (or OPENAI_API_KEY + MODEL_PROVIDER)
# World discovery auto-resolves RPC/Torii/WorldAddress from the Cartridge factory,
# so you only need CHAIN=slot and optionally SLOT_NAME to auto-select a world.

# 5. Run (from repo root)
pnpm --dir client/apps/onchain-agent dev
```

On first run the agent will prompt you to approve a Cartridge Controller session in your browser (see
[Authentication](#cartridge-controller-authentication) below).

### Default paths with zero config

With only `ANTHROPIC_API_KEY` set (no other env vars), the agent resolves everything automatically:

| What                              | Default path                               | Override env var              |
| --------------------------------- | ------------------------------------------ | ----------------------------- |
| Agent home                        | `~/.eternum-agent/`                        | `ETERNUM_AGENT_HOME`          |
| Data dir (soul, tasks, heartbeat) | `~/.eternum-agent/data/`                   | `DATA_DIR`                    |
| Session storage                   | `~/.eternum-agent/.cartridge/`             | `SESSION_BASE_PATH`           |
| Chain                             | `slot`                                     | `CHAIN`                       |
| Game name                         | `eternum`                                  | `GAME_NAME`                   |
| Model                             | `anthropic` / `claude-sonnet-4-5-20250929` | `MODEL_PROVIDER` / `MODEL_ID` |
| Tick interval                     | 60000ms (1 min)                            | `TICK_INTERVAL_MS`            |
| Tick loop                         | enabled                                    | `LOOP_ENABLED`                |

**World discovery is automatic.** When `RPC_URL`, `TORII_URL`, and `WORLD_ADDRESS` are not set, the agent queries the
Cartridge Factory SQL API to discover active worlds, then either presents a TUI picker or auto-selects if `SLOT_NAME`
matches a discovered world. The manifest is loaded from `contracts/game/manifest_<chain>.json` in the repo and patched
with live contract addresses from the factory. The agent also fetches entry/fee token addresses from the world's
`WorldConfig` and derives a per-world chain ID from the RPC URL slug (e.g. `WP_ETERNUM_BLITZ_SLOT_3`).

So a minimal `.env` is just:

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

The working directory tree after first run:

```
~/.eternum-agent/
├── data/
│   ├── soul.md              # agent personality/instructions
│   ├── HEARTBEAT.md          # cron-style recurring jobs
│   └── tasks/
│       └── priorities.md     # task tracking
└── .cartridge/
    └── session.json          # Cartridge Controller session (auto-created on auth)
```

### Building a standalone binary

Requires [Bun](https://bun.sh) installed locally:

```bash
cd client/apps/onchain-agent

# Single target (current platform)
bun build src/cli.ts --compile --outfile axis

# Run it
./axis run
./axis doctor
./axis init
```

## Commands

```bash
pnpm --dir client/apps/onchain-agent dev     # run
pnpm --dir client/apps/onchain-agent doctor  # validate local config
pnpm --dir client/apps/onchain-agent init    # scaffold local files
pnpm --dir client/apps/onchain-agent package:release  # build release archives + checksums
```

## Build Release Archives

Generate release archives for all supported V1 targets:

```bash
pnpm --dir client/apps/onchain-agent package:release
```

Useful flags:

- `--targets darwin-arm64,linux-x64` to limit targets
- `--outDir /tmp/onchain-release` to change output directory
- `--version 0.1.0` to override package version
- `--skipBuild --binaryPath /path/to/axis` for packaging-only flows

## Run in CLI

With world discovery (recommended — zero manual endpoint config):

```bash
cd client/apps/onchain-agent
cp .env.example .env
# Set ANTHROPIC_API_KEY (or OPENAI_API_KEY + MODEL_PROVIDER)
# Optionally set SLOT_NAME to auto-select a world, or leave blank for the TUI picker
pnpm --dir client/apps/onchain-agent dev
```

With manual endpoint overrides (skips discovery):

```bash
cd client/apps/onchain-agent
cp .env.example .env
```

Update `.env` with:

- `RPC_URL`, `TORII_URL`, `WORLD_ADDRESS` — all three required to skip discovery
- `MANIFEST_PATH` — path to a manifest JSON (optional, defaults to `contracts/game/manifest_<chain>.json`)
- `CHAIN_ID` — override chain ID (optional, derived from `RPC_URL` automatically)
- `ETERNUM_AGENT_HOME` (optional, defaults to `~/.eternum-agent`)
- `GAME_NAME` (default: `eternum`)
- `LOOP_ENABLED` (`true` or `false`)
- `MODEL_PROVIDER` and `MODEL_ID`
- matching API key (for example `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`)

Start the agent:

```bash
pnpm --dir client/apps/onchain-agent dev
```

## Cartridge Controller Authentication

The agent authenticates via the [Cartridge Controller](https://github.com/cartridge-gg/controller) session flow. No
private keys are stored in config — instead, the agent requests a session that the human approves in their browser.

### How it works

1. **Agent starts** — calls `ControllerSession.connect()`
2. **Existing session?** — checks `SESSION_BASE_PATH/session.json` on disk. If a valid (non-expired) session exists, the
   agent reconnects immediately with no browser step.
3. **No session?** — the agent prints an auth URL to stdout:
   ```
   Connecting to Cartridge Controller...
   https://x.cartridge.gg/session?public_key=0x...&redirect_uri=http://localhost:54321/callback&policies=...
   ```
4. **Human opens the URL** — reviews the session policies and approves with their Cartridge account (Passkeys/WebAuthn).
5. **Callback received** — the browser redirects to the agent's local HTTP server. The session is saved to
   `.cartridge/session.json`.
6. **Agent is live** — the `SessionAccount` can now execute transactions. `executeFromOutside` is tried first
   (paymaster-sponsored, no gas needed), falling back to direct execution.

### Session policies

The session requests approval for all Eternum system contracts discovered in the manifest, including:

- All game system entrypoints (resource, troop, trade, production, guild, hyperstructure, etc.)
- `dojo_name` and `world_dispatcher` introspection on every system contract
- VRF provider (`request_random`) for verifiable randomness
- Entry token (`token_lock`) and fee token (`approve`) when provided by the world's `WorldConfig`
- `s1_eternum-Message` typed data signing for in-game messaging

### Session persistence

The session persists to `SESSION_BASE_PATH` (default: `~/.eternum-agent/.cartridge/`). Restarting the agent reconnects
from the stored session without re-auth. Sessions have an expiration — when expired, the auth flow triggers again
automatically.

### Configuration

| Env var              | Default                          | Description                                                                                                                                                  |
| -------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CHAIN_ID`           | derived from `RPC_URL`           | StarkNet chain ID. Auto-derived from RPC URL slug (e.g. `WP_ETERNUM_BLITZ_SLOT_3`), falls back to `KATANA` for slot or `SN_MAIN`/`SN_SEPOLIA` for L1 chains. |
| `ETERNUM_AGENT_HOME` | `~/.eternum-agent`               | Base directory for runtime files                                                                                                                             |
| `DATA_DIR`           | `$ETERNUM_AGENT_HOME/data`       | Data directory for soul/tasks/heartbeat                                                                                                                      |
| `SESSION_BASE_PATH`  | `$ETERNUM_AGENT_HOME/.cartridge` | Directory for session storage                                                                                                                                |
| `GAME_NAME`          | `eternum`                        | Game namespace used to select policy contracts from manifest tags (for example `s1_eternum-*`)                                                               |

### Runtime requirements

Node.js 20+ with `--experimental-wasm-modules` (already set in the `dev` script). The `@cartridge/controller-wasm`
package provides WASM bindings for session signing.

---

The agent starts in the terminal UI and begins ticking automatically. Press `Ctrl+C` to shut it down gracefully.

## HEARTBEAT.md Jobs (Cron-Style)

Recurring jobs are defined in `client/apps/onchain-agent/data/HEARTBEAT.md`. The scheduler hot-reloads this file during
runtime, so edits apply without restart.

Job format:

```yaml
version: 1
jobs:
  - id: market-check
    enabled: true
    schedule: "*/10 * * * *"
    mode: observe
    timeoutSec: 90
    prompt: |
      Check market conditions and summarize opportunities.
```

- `schedule` uses 5-field cron: `minute hour day month dayOfWeek`.
- `mode: observe` adds guidance not to execute on-chain actions.
- `mode: act` allows action-taking if the prompt decides it.
- The agent can manage this file itself via existing `read`/`write` tools.

## Live Self-Reconfiguration (No Restart)

The running agent can reconfigure itself through tools:

- `get_agent_config`: read live config
- `set_agent_config`: apply one or more live config changes

Supported paths (including aliases like `world.rpcUrl`, `model.id`, `loop.enabled`):

- `rpcUrl`
- `toriiUrl`
- `worldAddress`
- `manifestPath`
- `gameName`
- `chainId`
- `sessionBasePath`
- `tickIntervalMs`
- `loopEnabled`
- `modelProvider`
- `modelId`
- `dataDir`

Example tool call payload for faster ticks:

```json
{
  "changes": [{ "path": "tickIntervalMs", "value": 15000 }],
  "reason": "need faster reaction loop"
}
```

Example payload for hot-swapping world connectivity:

```json
{
  "changes": [
    { "path": "rpcUrl", "value": "http://127.0.0.1:5050" },
    { "path": "toriiUrl", "value": "http://127.0.0.1:8080" },
    { "path": "worldAddress", "value": "0x123" },
    { "path": "manifestPath", "value": "/abs/path/to/manifest.json" }
  ],
  "reason": "switching to new world"
}
```

## Architecture Reference

The `docs/` directory contains reference documents for understanding and reviewing the agent's world-building and
session policy pipeline:

| Document                                                                                 | Purpose                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`docs/WORLD_PROFILE_AND_POLICY_PIPELINE.md`](docs/WORLD_PROFILE_AND_POLICY_PIPELINE.md) | Canonical 8-phase pipeline specification covering factory SQL resolution, manifest patching, policy construction, and Controller initialization. Use as the source of truth when reviewing or evolving the agent's world-connection logic. |
| [`docs/ONCHAIN_AGENT_PIPELINE_REVIEW.md`](docs/ONCHAIN_AGENT_PIPELINE_REVIEW.md)         | Gap analysis comparing the agent's implementation against the canonical pipeline. Lists identified issues by severity with recommendations. Useful context for code reviewers and for tracking future alignment work.                      |

These documents are intended to support code review, onboarding, and ongoing agent design evolution.
