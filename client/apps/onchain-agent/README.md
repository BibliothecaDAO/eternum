# Axis

Autonomous AI agent that plays Eternum -- a hex-grid strategy game on StarkNet. Discovers active game worlds, authenticates via Cartridge Controller, and runs an LLM-driven tick loop that observes game state and executes on-chain actions.

## Features

- Zero-config world discovery via Cartridge Factory SQL across slot, sepolia, and mainnet chains
- Browser-based Cartridge Controller authentication (Passkeys/WebAuthn) -- no private keys required
- Headless mode with NDJSON output, HTTP API, and stdin steering for AI orchestration and server fleets
- LLM-driven tick loop with configurable interval, verbosity, and provider (Anthropic, OpenAI, OpenRouter, Google)
- Cron-style heartbeat jobs for automated periodic observation and analysis
- 60+ game actions dynamically generated from contract ABIs at startup
- Editable personality, strategy, and task files that persist across restarts
- Standalone binary builds via Bun -- single file, no runtime dependencies
- Cross-platform release packaging (darwin-arm64, darwin-x64, linux-x64, linux-arm64)

## Installation

**Public release:**

```bash
curl -fsSL https://github.com/bibliothecadao/eternum/releases/latest/download/install-axis.sh | bash
```

Pin a specific version with `VERSION=v0.1.0 bash`. See [INSTALL.md](INSTALL.md) for rollback/uninstall.

**From source** (Node.js 22+, pnpm 9+):

```bash
git clone https://github.com/bibliothecadao/eternum.git && cd eternum
pnpm install

# Build dependencies in order
pnpm --dir packages/types build
pnpm --dir packages/torii build
pnpm --dir packages/provider build
pnpm --dir packages/client build
pnpm --dir packages/game-agent build

# Configure and run
cd client/apps/onchain-agent
cp .env.example .env     # set ANTHROPIC_API_KEY at minimum
pnpm dev
```

**Standalone binary** (requires [Bun](https://bun.sh)):

```bash
cd client/apps/onchain-agent
bun run build.ts --compile    # produces ./axis
cp axis ~/.local/bin/          # fully self-contained, no adjacent files needed
```

## Quick Start

The only required config is an LLM API key. Everything else is auto-discovered:

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

On first run, the agent discovers active worlds via Cartridge Factory SQL, presents a TUI picker, and opens your browser to approve a Cartridge Controller session. After that, the tick loop starts automatically.

Set `SLOT_NAME=<world>` to skip the picker and auto-select a world.

## CLI Commands

| Command | Description |
| --- | --- |
| `axis` / `axis run` | Start the agent in TUI mode (default) |
| `axis run --headless` | Start the agent headlessly with NDJSON output |
| `axis worlds` | List discovered worlds across all chains |
| `axis auth <world>` | Generate auth URL, persist artifacts, and wait for approval |
| `axis auth-complete <world>` | Complete auth with a redirect URL or raw session data |
| `axis auth-status <world>` | Check whether a session is active, expired, or pending |
| `axis auth-url <world>` | Print the stored auth URL for a world |
| `axis doctor` | Validate configuration and report issues |
| `axis init` | Scaffold `~/.eternum-agent/` with default data files and `.env` |
| `axis --version` / `axis -v` | Print version |
| `axis --help` / `axis -h` | Print usage help |

## Run Options

All flags apply to `axis run`:

| Flag | Default | Description |
| --- | --- | --- |
| `--headless` | off | Headless mode -- no TUI, emits NDJSON to stdout |
| `--world=<name>` | _(none)_ | Target world (required for headless mode) |
| `--auth=session\|privatekey` | `session` | Auth strategy: Cartridge session or raw private key |
| `--api-port=<port>` | _(disabled)_ | Enable HTTP API on this port |
| `--api-host=<host>` | `127.0.0.1` | Bind address for the HTTP API |
| `--stdin` | off | Enable stdin JSON command reader |
| `--verbosity=<level>` | `decisions` | Output filter: `quiet`, `actions`, `decisions`, `all` |
| `--json` | off | JSON output for non-run commands |

## Headless Mode

Headless mode runs the agent without a TUI, designed for AI orchestrators, remote servers, and multi-agent fleets. It requires `--world` and a pre-authenticated session (via `axis auth`).

```bash
axis run --headless --world=my-world --api-port=3000 --stdin
```

### NDJSON Output

All agent events stream to stdout as newline-delimited JSON. Each line contains a `type` field and an ISO 8601 `ts` timestamp.

Event types and their verbosity levels:

| Verbosity | Event Types Included |
| --- | --- |
| `quiet` | `error`, `session`, `shutdown` |
| `actions` | + `action` |
| `decisions` | + `decision`, `heartbeat`, `prompt`, `startup` |
| `all` | + `tick` |

Example output:

```jsonl
{"type":"startup","world":"my-world","chain":"slot","address":"0x123...","ts":"2026-02-23T10:00:00.000Z"}
{"type":"action","tick":1,"action":"create_building","params":{"building_type":"Farm"},"status":"started","ts":"..."}
{"type":"action","tick":1,"action":"create_building","status":"ok","ts":"..."}
{"type":"decision","tick":1,"reasoning":"Building a farm to increase food production...","actions":[],"ts":"..."}
```

### HTTP API

Enable with `--api-port=<port>`. All endpoints accept and return JSON.

| Method | Path | Body | Description |
| --- | --- | --- | --- |
| `POST` | `/prompt` | `{"content": "..."}` | Send a prompt to the agent's LLM queue |
| `GET` | `/status` | -- | Agent status (tick count, session, loop state, world) |
| `GET` | `/state` | -- | World state snapshot |
| `GET` | `/events` | -- | SSE stream of all agent events (`text/event-stream`) |
| `POST` | `/config` | `{"changes": [{"path": "...", "value": ...}]}` | Update runtime configuration |
| `POST` | `/shutdown` | -- | Graceful shutdown |
| `GET/POST` | `/auth/callback` | -- | Cartridge auth callback receiver |

Example -- steer the agent via HTTP:

```bash
curl -X POST http://127.0.0.1:3000/prompt \
  -H 'Content-Type: application/json' \
  -d '{"content": "Build a farm at your main realm"}'
```

### Stdin Commands

Enable with `--stdin` (also activates automatically when stdin is not a TTY). Send one JSON object per line:

```jsonl
{"type": "prompt", "content": "Explore the tile north of your realm"}
{"type": "config", "changes": [{"path": "tickIntervalMs", "value": 30000}]}
{"type": "shutdown"}
```

### Fleet Setup

Authenticate all worlds at once, then launch agents in parallel:

```bash
# Authenticate all discovered worlds
axis auth --all --approve --method=password --json > /tmp/auth.json

# Launch one headless agent per world
for world in $(jq -r '.[].world' /tmp/auth.json); do
  axis run --headless --world="$world" --api-port=$((3000+RANDOM%1000)) &
done
```

## Configuration

### Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | _(required for anthropic)_ | Anthropic API key |
| `OPENAI_API_KEY` | _(required for openai)_ | OpenAI API key |
| `MODEL_PROVIDER` | `anthropic` | LLM provider (`anthropic`, `openai`, `openrouter`, `google`) |
| `MODEL_ID` | `claude-sonnet-4-5-20250929` | LLM model ID |
| `CHAIN` | `slot` | Chain: `slot`, `slottest`, `local`, `sepolia`, `mainnet` |
| `SLOT_NAME` | _(optional)_ | Auto-select a discovered world by name (skips TUI picker) |
| `GAME_NAME` | `eternum` | Game identifier used for session scoping |
| `CHAIN_ID` | _(auto-derived)_ | StarkNet chain ID hex; derived from RPC URL or chain default |
| `TICK_INTERVAL_MS` | `60000` | Tick loop interval in milliseconds |
| `LOOP_ENABLED` | `true` | Auto-start tick loop on launch |
| `ETERNUM_AGENT_HOME` | `~/.eternum-agent` | Base directory for all runtime files |
| `DATA_DIR` | `$ETERNUM_AGENT_HOME/data` | Data directory (soul, tasks, heartbeat, debug logs) |
| `SESSION_BASE_PATH` | `$ETERNUM_AGENT_HOME/.cartridge` | Cartridge Controller session storage |
| `PRIVATE_KEY` | _(optional)_ | StarkNet private key (headless `--auth=privatekey` mode) |
| `ACCOUNT_ADDRESS` | _(optional)_ | StarkNet account address (headless `--auth=privatekey` mode) |
| `MASTER_ADDRESS` | _(optional)_ | Master account address for auto fee-token top-up (non-mainnet) |
| `MASTER_PRIVATE_KEY` | _(optional)_ | Master account private key for auto fee-token top-up |
| `CARTRIDGE_API_BASE` | `https://api.cartridge.gg` | Cartridge API base URL for world discovery |

### Manual Overrides (Skip Discovery)

Set all three to bypass world discovery and connect directly:

```bash
RPC_URL=http://localhost:5050
TORII_URL=http://localhost:8080/sql
WORLD_ADDRESS=0x123...
# MANIFEST_PATH=/path/to/manifest.json   # optional
```

### Runtime Directory

```
~/.eternum-agent/
├── data/
│   └── <world-name>/           # per-world agent data
│       ├── soul.md             # agent personality and strategy
│       ├── HEARTBEAT.md        # cron-style recurring jobs
│       └── tasks/              # reference handbooks and learnings
│           ├── game.md         # game rules reference
│           ├── economy.md      # resource and building guide
│           ├── exploration.md  # movement and stamina mechanics
│           ├── combat.md       # troop types and combat actions
│           ├── priorities.md   # VP scoring goals
│           └── learnings.md    # accumulated agent knowledge
└── .cartridge/
    └── <world-name>/           # per-world session artifacts
        ├── profile.json        # world profile (chain, rpc, torii, worldAddress)
        ├── manifest.json       # resolved manifest with live contract addresses
        ├── policy.json         # generated session policies
        ├── session.json        # Cartridge Controller session keypair
        └── auth.json           # auth URL, status, metadata
```

## Authentication

### TUI Mode (default)

The agent uses [Cartridge Controller](https://github.com/cartridge-gg/controller) sessions -- no private keys in config. On first run, it opens a browser URL for you to approve the session with your Cartridge account (Passkeys/WebAuthn). The session persists to disk and reconnects automatically on restart. Delete `~/.eternum-agent/.cartridge/session.json` to force re-auth.

### Headless Mode

For headless operation, pre-authenticate with `axis auth` before running:

```bash
# Interactive: opens browser for approval
axis auth my-world

# Automated: uses agent-browser for headless approval
axis auth my-world --approve --method=password --username=me --password=secret

# Remote VPS: starts a callback server for the redirect
axis auth my-world --callback-url=http://my-vps:3000

# Offline: complete auth by pasting the redirect URL or raw session data
axis auth-complete my-world --redirect-url="https://...?startapp=<data>"
axis auth-complete my-world --session-data="<base64>"
```

### Private Key Fallback

Skip Cartridge Controller entirely with a raw StarkNet keypair:

```bash
PRIVATE_KEY=0x... ACCOUNT_ADDRESS=0x... axis run --headless --world=my-world --auth=privatekey
```

## Auth Commands

| Flag | Applies To | Description |
| --- | --- | --- |
| `--all` | `auth`, `auth-status` | Apply to all discovered worlds |
| `--approve` | `auth` | Auto-approve via agent-browser (no manual browser step) |
| `--method=<type>` | `auth` | Auth method for `--approve` (e.g., `password`) |
| `--username=<user>` | `auth` | Username for `--approve` |
| `--password=<pass>` | `auth` | Password for `--approve` |
| `--callback-url=<url>` | `auth` | Public URL for auth callback (remote VPS) |
| `--timeout=<ms>` | `auth` | Approval wait timeout in milliseconds |
| `--redirect-url=<url>` | `auth-complete` | Paste redirect URL to complete auth offline |
| `--session-data=<base64>` | `auth-complete` | Raw session data to complete auth offline |
| `--json` | `auth`, `auth-complete`, `auth-status`, `worlds` | JSON output |

## Testing

```bash
pnpm --dir client/apps/onchain-agent test          # run tests
pnpm --dir client/apps/onchain-agent test:watch     # watch mode
```

## Build Release Archives

```bash
pnpm --dir client/apps/onchain-agent package:release \
  --targets darwin-arm64,linux-x64 \
  --version v0.1.0 \
  --outDir release-dist
```

## Further Reading

| Document | Description |
| --- | --- |
| [docs/deprecated/ARCHITECTURE.md](docs/deprecated/ARCHITECTURE.md) | Full architecture reference (entry points, world discovery, adapter layer, TUI, config) |
| [docs/deprecated/DEPENDENCIES.md](docs/deprecated/DEPENDENCIES.md) | How the agent uses `@bibliothecadao/torii`, `client`, and `core` packages |
| [docs/deprecated/WORLD_PROFILE_AND_POLICY_PIPELINE.md](docs/deprecated/WORLD_PROFILE_AND_POLICY_PIPELINE.md) | World discovery pipeline specification |

## Troubleshooting

**Binary crashes (ENOENT, WASM errors):** Always build with `bun run build.ts --compile` -- direct `bun build` skips the plugins that embed manifests, WASM, and package.json.

**TUI shows garbled output:** Never use `console.log` after the TUI starts. Use the `addSystemMessage()` callback from `createApp()`.

**Session expired:** Delete `~/.eternum-agent/.cartridge/session.json` and restart. For headless mode, re-run `axis auth <world>`.

**No worlds found:** Check that the Cartridge Factory API is reachable. Try `CHAIN=sepolia` or `CHAIN=mainnet`.

**Headless mode requires `--world`:** The agent needs a pre-authenticated world to skip the TUI picker. Run `axis auth <world>` first, then `axis run --headless --world=<world>`.

**Private key auth fails:** Verify both `PRIVATE_KEY` and `ACCOUNT_ADDRESS` are set. The account must be deployed on the target chain.

**Auto top-up not working:** `MASTER_ADDRESS` and `MASTER_PRIVATE_KEY` must both be set. Top-up only runs on non-mainnet chains and only when the agent's fee token balance is below the world's registration fee.
