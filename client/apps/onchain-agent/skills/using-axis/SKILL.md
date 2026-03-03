---
name: using-axis
description: Use when authenticating, running, or managing Eternum game agents via the axis CLI, especially on headless servers or VPS.
---

# Using Axis

CLI for autonomous Eternum game agents. Discovers worlds, authenticates via Cartridge Controller, runs an LLM-driven tick loop.

## Auth

Password auth (headless, with paymaster):

```bash
axis auth <world> --method=password --username=<user> --password=<pass>
```

Other methods:

| Method | Command | Notes |
|--------|---------|-------|
| QR code | `axis auth <world>` | Generates QR + auth URL |
| Redirect URL | `--redirect-url="..."` | Complete browser auth |
| Session data | `--session-data="<b64>"` | Import raw session |
| Private key | `--auth=privatekey` + env | No paymaster |

Check status: `axis auth <world> --status`

Sessions last 7 days. Re-run to refresh.

## Run

```bash
axis                                          # Interactive TUI
axis run --headless --world=<name>            # Headless (requires pre-auth)
```

Headless flags: `--api-port`, `--api-host`, `--stdin`, `--verbosity`, `--json`.

## Fleet

```bash
axis auth --all --method=password --username=me --password=secret --json > /tmp/auth.json
for world in $(jq -r '.[].world' /tmp/auth.json); do
  axis run --headless --world="$world" --api-port=$((3000+RANDOM%1000)) &
done
```

## HTTP API

Enable with `--api-port`:

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/prompt` | Send prompt (`{"content": "..."}`) |
| `GET` | `/status` | Agent status |
| `GET` | `/state` | World state snapshot |
| `GET` | `/events` | SSE stream |
| `POST` | `/config` | Update runtime config |
| `POST` | `/shutdown` | Graceful shutdown |

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `ANTHROPIC_API_KEY` | _(required)_ | LLM API key |
| `MODEL_PROVIDER` | `anthropic` | `anthropic`, `openai`, `openrouter`, `google` |
| `CHAIN` | `slot` | `slot`, `sepolia`, `mainnet` |
| `SLOT_NAME` | _(none)_ | Auto-select world |
| `TICK_INTERVAL_MS` | `60000` | Tick interval (ms) |

Skip discovery: set `RPC_URL`, `TORII_URL`, `WORLD_ADDRESS`.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Session expired | Re-run `axis auth <world> --method=password ...` |
| No worlds found | Check `CHAIN` and network connectivity |
| Password auth fails | Verify account has password credential on Cartridge |
| WASM/binary crash | Build with `bun run build.ts --compile` |
