---
name: using-axis
description: Use when authenticating, running, or managing Eternum game agents via the axis CLI. Use when setting up headless agents on VPS, authenticating with Cartridge Controller, running agent fleets, or troubleshooting session issues.
---

# Using Axis

Axis is the CLI for autonomous Eternum game agents. It discovers game worlds, authenticates via Cartridge Controller (with paymaster — zero gas fees), and runs an LLM-driven tick loop.

## Authentication

### Password Auth (Recommended for Headless/VPS)

No browser, no QR code, no ports. Creates a Controller session with paymaster:

```bash
axis auth <world> --method=password --username=<user> --password=<pass>

# All worlds at once
axis auth --all --method=password --username=<user> --password=<pass> --json
```

Sessions last 7 days. Re-run to refresh.

### Other Auth Methods

| Method | Command | When |
|--------|---------|------|
| Password | `--method=password --username=X --password=Y` | Headless/VPS/CI (recommended) |
| QR code | `axis auth <world>` | VPS without password account |
| Redirect URL | `axis auth <world> --redirect-url="..."` | Complete browser-based auth |
| Session data | `axis auth <world> --session-data="<b64>"` | Import raw session |
| Private key | `--auth=privatekey` + `PRIVATE_KEY` env | No paymaster, pay own gas |

### Check Status

```bash
axis auth <world> --status          # One world
axis auth --all --status --json     # All worlds, JSON output
```

Statuses: `active`, `expired`, `pending`, `none`.

## Running the Agent

### Interactive (Laptop)

```bash
axis    # Discovers worlds, opens browser auth, starts TUI
```

### Headless (VPS/Server)

Requires pre-auth via `axis auth`:

```bash
axis run --headless --world=<name>
```

Key flags:

| Flag | Purpose |
|------|---------|
| `--api-port=<port>` | Enable HTTP API for remote control |
| `--api-host=<host>` | Bind address (default: 127.0.0.1) |
| `--stdin` | Accept JSON commands on stdin |
| `--verbosity=<level>` | `quiet`, `actions`, `decisions`, `all` |
| `--json` | JSON output for non-run commands |

### Fleet Setup

```bash
# Auth all worlds
axis auth --all --method=password --username=me --password=secret --json > /tmp/auth.json

# Launch one agent per world
for world in $(jq -r '.[].world' /tmp/auth.json); do
  axis run --headless --world="$world" --api-port=$((3000+RANDOM%1000)) &
done
```

## HTTP API (Headless)

Enable with `--api-port`. All endpoints accept/return JSON:

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/prompt` | Send prompt to agent (`{"content": "..."}`) |
| `GET` | `/status` | Agent status (tick count, session, world) |
| `GET` | `/state` | World state snapshot |
| `GET` | `/events` | SSE stream of agent events |
| `POST` | `/config` | Update runtime config |
| `POST` | `/shutdown` | Graceful shutdown |

## Key Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `ANTHROPIC_API_KEY` | _(required)_ | LLM API key |
| `MODEL_PROVIDER` | `anthropic` | `anthropic`, `openai`, `openrouter`, `google` |
| `MODEL_ID` | `claude-sonnet-4-5-20250929` | Model ID |
| `CHAIN` | `slot` | `slot`, `sepolia`, `mainnet` |
| `SLOT_NAME` | _(none)_ | Auto-select world, skip picker |
| `TICK_INTERVAL_MS` | `60000` | Tick loop interval (ms) |

Manual override (skip discovery): set `RPC_URL`, `TORII_URL`, and `WORLD_ADDRESS`.

## Runtime Directory

```
~/.eternum-agent/
├── .env                        # API keys, config (auto-created)
├── data/<world>/               # Agent personality, strategy, learnings
│   ├── soul.md                 # Personality and strategy
│   ├── HEARTBEAT.md            # Cron-style recurring jobs
│   └── tasks/                  # Game reference handbooks
└── .cartridge/<world>/         # Session artifacts
    ├── session.json            # Controller session keypair
    ├── profile.json            # World profile (chain, rpc, torii)
    ├── manifest.json           # Contract addresses
    ├── policy.json             # Session policies
    └── auth.json               # Auth status metadata
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Session expired | Re-run `axis auth <world> --method=password ...` |
| No worlds found | Check `CHAIN` setting and network connectivity |
| Password auth fails | Verify account has password credential on Cartridge |
| Binary crashes / WASM errors | Build with `bun run build.ts --compile` (not bare `bun build`) |
| `--world` required | Pre-auth with `axis auth`, then pass `--world` |

## Building from Source

```bash
cd client/apps/onchain-agent
bun run build.ts --compile    # Produces ./axis standalone binary
```

The build embeds WASM, manifests, and data files. Always use `build.ts`, never bare `bun build`.
