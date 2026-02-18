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

# Two-step build: bundle with plugins, then compile
bun run build.ts --compile

# Run it
./axis run
./axis doctor
./axis init
```

The binary is fully standalone -- it can be copied anywhere (e.g. `cp axis ~/.local/bin/`) and works without the repo or
any adjacent files. Manifests, WASM modules, and package.json config are embedded at build time via build plugins.

## CLI Reference

```
axis [command] [options]
```

When invoked without arguments, `axis` defaults to `run`.

### `axis run`

Start the agent. This is the main command and the default when no subcommand is given.

```bash
axis run
axis          # equivalent
```

**Startup sequence:**

1. Prints ASCII banner
2. Loads configuration from env vars / `.env`
3. Runs world discovery (queries Cartridge Factory SQL on slot/sepolia/mainnet)
4. Presents TUI world picker (or auto-selects if `SLOT_NAME` matches)
5. Opens browser for Cartridge Controller session auth (skipped if session exists on disk)
6. Launches the TUI with tick loop and heartbeat scheduler

**From source (dev mode):**

```bash
pnpm --dir client/apps/onchain-agent dev     # runs: bun src/cli.ts run
```

### `axis init`

Scaffold the local runtime directories and seed default files.

```bash
axis init
```

**Creates:**

| Path                                 | Contents                                                |
| ------------------------------------ | ------------------------------------------------------- |
| `~/.eternum-agent/data/soul.md`      | Default agent personality (copied from bundled `data/`) |
| `~/.eternum-agent/data/HEARTBEAT.md` | Empty heartbeat jobs file                               |
| `~/.eternum-agent/data/tasks/`       | Task tracking directory with `priorities.md`            |
| `~/.eternum-agent/.cartridge/`       | Session storage directory (empty)                       |
| `./.env`                             | Env file from `.env.example` (only if missing)          |

If the bundled `data/` directory exists (in repo or release archive), files are copied from there. Otherwise fallback
templates are generated. Existing files are never overwritten.

**From source:**

```bash
pnpm --dir client/apps/onchain-agent init
```

### `axis doctor`

Validate the current configuration and report issues.

```bash
axis doctor
```

**Checks performed:**

| Check             | Severity | Condition                                                     |
| ----------------- | -------- | ------------------------------------------------------------- |
| World address     | Error    | `WORLD_ADDRESS` is `0x0` or unset                             |
| Manifest path     | Error    | `MANIFEST_PATH` file does not exist on disk                   |
| Data directory    | Error    | `DATA_DIR` cannot be created or is not writable               |
| Session directory | Error    | `SESSION_BASE_PATH` cannot be created or is not writable      |
| Anthropic API key | Warning  | `MODEL_PROVIDER=anthropic` but `ANTHROPIC_API_KEY` is not set |
| OpenAI API key    | Warning  | `MODEL_PROVIDER=openai` but `OPENAI_API_KEY` is not set       |

Exits `0` if no errors (warnings are OK), exits `1` if any errors found.

**From source:**

```bash
pnpm --dir client/apps/onchain-agent doctor
```

### `axis --version` / `axis -v`

Print the version from `package.json` and exit.

```bash
axis --version
# 0.1.0
```

In the standalone binary, the version is embedded at build time via the `piConfigPlugin`.

### `axis help` / `axis --help` / `axis -h`

Print the usage line and exit.

```bash
axis help
# Usage: axis [--version|doctor|init|run]
```

## Configuration

### Quick start (zero config)

With only an API key set, the agent discovers everything automatically:

```bash
echo "ANTHROPIC_API_KEY=sk-ant-..." > ~/.eternum-agent/.env
axis run
```

### Environment variables

| Variable             | Default                          | Description                                                                                |
| -------------------- | -------------------------------- | ------------------------------------------------------------------------------------------ |
| `CHAIN`              | `slot`                           | Chain name: `slot`, `slottest`, `local`, `sepolia`, `mainnet`                              |
| `RPC_URL`            | _(auto-discovered)_              | StarkNet RPC endpoint. If set with `TORII_URL` and `WORLD_ADDRESS`, skips world discovery. |
| `TORII_URL`          | _(auto-discovered)_              | Torii SQL endpoint                                                                         |
| `WORLD_ADDRESS`      | _(auto-discovered)_              | World contract address                                                                     |
| `MANIFEST_PATH`      | `~/.eternum-agent/manifest.json` | Dojo manifest JSON path (embedded in binary, not needed for discovery)                     |
| `GAME_NAME`          | `eternum`                        | Game namespace used to filter manifest tags for session policies                           |
| `CHAIN_ID`           | _(derived from RPC_URL)_         | StarkNet chain ID. Auto-derived from RPC URL slug (e.g. `WP_ETERNUM_BLITZ_SLOT_3`)         |
| `ETERNUM_AGENT_HOME` | `~/.eternum-agent`               | Base directory for all runtime files                                                       |
| `DATA_DIR`           | `$ETERNUM_AGENT_HOME/data`       | Data directory for soul, tasks, heartbeat, debug logs                                      |
| `SESSION_BASE_PATH`  | `$ETERNUM_AGENT_HOME/.cartridge` | Cartridge Controller session storage directory                                             |
| `TICK_INTERVAL_MS`   | `60000`                          | Tick loop interval in milliseconds                                                         |
| `LOOP_ENABLED`       | `true`                           | Auto-start tick loop on launch (`true`/`false`/`1`/`0`/`yes`/`no`)                         |
| `MODEL_PROVIDER`     | `anthropic`                      | LLM provider (`anthropic`, `openai`, `openrouter`, `google`)                               |
| `MODEL_ID`           | `claude-sonnet-4-5-20250929`     | LLM model ID                                                                               |
| `ANTHROPIC_API_KEY`  | _(required for anthropic)_       | Anthropic API key                                                                          |
| `OPENAI_API_KEY`     | _(required for openai)_          | OpenAI API key                                                                             |
| `SLOT_NAME`          | _(optional)_                     | Auto-select a discovered world by name (skips TUI picker)                                  |

### Manual endpoint overrides (skip discovery)

Set all three of `RPC_URL`, `TORII_URL`, and `WORLD_ADDRESS` to bypass world discovery entirely:

```bash
RPC_URL=http://localhost:5050
TORII_URL=http://localhost:8080/sql
WORLD_ADDRESS=0x123...
ANTHROPIC_API_KEY=sk-ant-...
```

### Runtime directory layout

```
~/.eternum-agent/
├── data/
│   ├── soul.md              # agent personality/instructions
│   ├── HEARTBEAT.md          # cron-style recurring jobs
│   ├── tasks/
│   │   └── priorities.md     # task tracking
│   ├── debug-world-state.log
│   ├── debug-tick-prompt.log
│   ├── debug-actions.log
│   ├── debug-actions-raw-errors.log
│   └── debug-tool-responses.log
└── .cartridge/
    └── session.json          # Cartridge Controller session (auto-created)
```

## Build Release Archives

Generate release archives for all supported targets:

```bash
pnpm --dir client/apps/onchain-agent package:release
```

Flags:

- `--targets darwin-arm64,linux-x64` — limit to specific targets
- `--outDir /tmp/onchain-release` — change output directory
- `--version 0.1.0` — override version string
- `--skipBuild --binaryPath /path/to/axis` — packaging-only (skip compilation)

The packager uses the same two-step build internally (bundle with WASM/config plugins via `build.ts`, then cross-compile
for each target).

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

The `docs/` directory contains reference documents for understanding the agent's architecture, dependencies, and
internals:

| Document                                                                                 | Purpose                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)                                           | Comprehensive architecture guide covering entry points, world discovery, session management, adapter layer (60+ actions), TUI, release packaging, configuration reference, and key design decisions. Start here for onboarding.            |
| [`docs/DEPENDENCIES.md`](docs/DEPENDENCIES.md)                                           | How the agent uses `@bibliothecadao/torii`, `@bibliothecadao/client`, and `@bibliothecadao/eternum` (core). Covers data flow, usage patterns, caching, and error handling across the three packages.                                       |
| [`docs/WORLD_PROFILE_AND_POLICY_PIPELINE.md`](docs/WORLD_PROFILE_AND_POLICY_PIPELINE.md) | Canonical 8-phase pipeline specification covering factory SQL resolution, manifest patching, policy construction, and Controller initialization. Use as the source of truth when reviewing or evolving the agent's world-connection logic. |
| [`docs/ONCHAIN_AGENT_PIPELINE_REVIEW.md`](docs/ONCHAIN_AGENT_PIPELINE_REVIEW.md)         | Gap analysis comparing the agent's implementation against the canonical pipeline. Lists identified issues by severity with recommendations. Useful context for code reviewers and for tracking future alignment work.                      |

See also [`packages/game-agent/docs/ARCHITECTURE.md`](../../../packages/game-agent/docs/ARCHITECTURE.md) for the core AI
agent framework documentation (tick loop, heartbeat, decision logging, soul/personality system, evolution, tools).

These documents are intended to support code review, onboarding, and ongoing agent design evolution.

## Troubleshooting / FAQ

### Binary crashes with ENOENT manifest_slot.json

Manifests are embedded at build time via JSON imports. If you see this error, you're running an old binary that still
tries to read manifests from disk. Rebuild with `bun run build.ts --compile`.

### Binary crashes with `wasm2.__wbindgen_add_to_stack_pointer is not a function`

The WASM modules from `@cartridge/controller-wasm` must be embedded at build time. Direct `bun build --compile` without
the build plugins will fail. Always use `bun run build.ts --compile` which runs the `wasmPlugin` to embed WASM as
base64.

### Binary crashes with ENOENT package.json

The `@mariozechner/pi-coding-agent` config reads `package.json` from disk. In the standalone binary this file doesn't
exist. Rebuild with `bun run build.ts --compile` which runs the `piConfigPlugin` to embed package.json at build time.

### TUI shows double/garbled output

Never use `console.log` or `console.error` after the TUI is created -- it corrupts the differential renderer. Use the
`addSystemMessage()` function returned by `createApp()` instead. All post-TUI messages in `index.ts` route through this
function.

### Session expired / re-authentication

Delete `~/.eternum-agent/.cartridge/session.json` and restart. The agent will open a new browser auth flow.

### World discovery finds no worlds

Check that the Cartridge Factory API is reachable. Set `CHAIN=slot` (default) or try `CHAIN=sepolia`. If all chains
return empty, the factory SQL endpoints may be down.

### `axis --version` shows wrong version

The version comes from `package.json` which is embedded at build time. Rebuild to pick up version changes.
