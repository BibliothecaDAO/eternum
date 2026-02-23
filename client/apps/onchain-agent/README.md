# Axis

Autonomous AI agent that plays Eternum on StarkNet. Discovers active game worlds, authenticates via Cartridge
Controller, and runs an LLM-driven tick loop that observes game state and executes on-chain actions.

## Install

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

On first run, the agent discovers active worlds via Cartridge Factory SQL, presents a TUI picker, and opens your browser
to approve a Cartridge Controller session. After that, the tick loop starts automatically.

Set `SLOT_NAME=<world>` to skip the picker and auto-select a world.

## CLI Commands

| Command             | Description                                     |
| ------------------- | ----------------------------------------------- |
| `axis` / `axis run` | Start the agent (default)                       |
| `axis init`         | Scaffold `~/.eternum-agent/` with default files |
| `axis doctor`       | Validate configuration and report issues        |
| `axis --version`    | Print version                                   |

## Configuration

### Environment Variables

| Variable             | Default                          | Description                                                  |
| -------------------- | -------------------------------- | ------------------------------------------------------------ |
| `ANTHROPIC_API_KEY`  | _(required for anthropic)_       | Anthropic API key                                            |
| `OPENAI_API_KEY`     | _(required for openai)_          | OpenAI API key                                               |
| `MODEL_PROVIDER`     | `anthropic`                      | LLM provider (`anthropic`, `openai`, `openrouter`, `google`) |
| `MODEL_ID`           | `claude-sonnet-4-5-20250929`     | LLM model ID                                                 |
| `CHAIN`              | `slot`                           | Chain: `slot`, `slottest`, `local`, `sepolia`, `mainnet`     |
| `SLOT_NAME`          | _(optional)_                     | Auto-select a discovered world by name (skips TUI picker)    |
| `TICK_INTERVAL_MS`   | `60000`                          | Tick loop interval in milliseconds                           |
| `LOOP_ENABLED`       | `true`                           | Auto-start tick loop on launch                               |
| `ETERNUM_AGENT_HOME` | `~/.eternum-agent`               | Base directory for all runtime files                         |
| `DATA_DIR`           | `$ETERNUM_AGENT_HOME/data`       | Data directory (soul, tasks, heartbeat, debug logs)          |
| `SESSION_BASE_PATH`  | `$ETERNUM_AGENT_HOME/.cartridge` | Cartridge Controller session storage                         |

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
│   ├── soul.md           # agent personality
│   ├── HEARTBEAT.md      # cron-style recurring jobs
│   ├── tasks/            # task tracking
│   └── debug-*.log       # debug logs
└── .cartridge/
    └── session.json      # Cartridge Controller session
```

## Authentication

The agent uses [Cartridge Controller](https://github.com/cartridge-gg/controller) sessions -- no private keys in config.
On first run, it opens a browser URL for you to approve the session with your Cartridge account (Passkeys/WebAuthn). The
session persists to disk and reconnects automatically on restart. Delete `~/.eternum-agent/.cartridge/session.json` to
force re-auth.

## Build Release Archives

```bash
pnpm --dir client/apps/onchain-agent package:release \
  --targets darwin-arm64,linux-x64 \
  --version v0.1.0 \
  --outDir release-dist
```

## Further Reading

| Document                                                                               | Description                                                                             |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)                                           | Full architecture reference (entry points, world discovery, adapter layer, TUI, config) |
| [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md)                                           | How the agent uses `@bibliothecadao/torii`, `client`, and `core` packages               |
| [docs/WORLD_PROFILE_AND_POLICY_PIPELINE.md](docs/WORLD_PROFILE_AND_POLICY_PIPELINE.md) | World discovery pipeline specification                                                  |

## Troubleshooting

**Binary crashes (ENOENT, WASM errors):** Always build with `bun run build.ts --compile` -- direct `bun build` skips the
plugins that embed manifests, WASM, and package.json.

**TUI shows garbled output:** Never use `console.log` after the TUI starts. Use the `addSystemMessage()` callback from
`createApp()`.

**Session expired:** Delete `~/.eternum-agent/.cartridge/session.json` and restart.

**No worlds found:** Check that the Cartridge Factory API is reachable. Try `CHAIN=sepolia` or `CHAIN=mainnet`.
