# Axis

For [Eternum | Blitz](https://blitz.realms.world/).

| Mode       |             |
| ---------- | ----------- |
| `pnpm dev` | Pi agent    |
| MCP server | Claude Code |

## Quick Start

```bash
# Repo root
pnpm i && pnpm build:packages && pnpm --dir packages/client build

# Configure
cd client/apps/onchain-agent
```

Create `.env`:

```
CHAIN=slot
WORLD_NAME=
ANTHROPIC_API_KEY=
```

Settle your realms in the game client first, then:

```bash
pnpm dev
```

First run prints a browser auth URL — open it to authorize.

## MCP Server

```bash
claude mcp add eternum -- npx tsx ./client/apps/onchain-agent/dev/scripts/mcp-server.ts
```

Reads `.env` from `client/apps/onchain-agent/` regardless of working directory. Call `status` first.

## Tools

| Category   | Tools                                                                    |
| ---------- | ------------------------------------------------------------------------ |
| Map        | `map_tile_info` `map_nearby` `map_entity_info` `map_find` `map_briefing` |
| Movement   | `move_army`                                                              |
| Combat     | `simulate_attack` `attack_target` `attack_from_guard` `raid_target`      |
| Armies     | `create_army` `reinforce_army` `transfer_troops` `open_chest`            |
| Guards     | `guard_from_storage` `guard_from_army` `unguard_to_army`                 |
| Resources  | `send_resources` `transfer_to_structure` `transfer_to_army`              |
| Automation | `automation`                                                             |
| Buffs      | `apply_relic`                                                            |
| Status     | `status`                                                                 |

## Configuration

### Required

| Variable            | Description                                       |
| ------------------- | ------------------------------------------------- |
| `CHAIN`             | `mainnet`, `sepolia`, `slot`, `slottest`, `local` |
| `WORLD_NAME`        | Cartridge world slug (e.g. `slotty-test-1`)       |
| `ANTHROPIC_API_KEY` | LLM API key                                       |

### Optional

| Variable               | Default                    | Description           |
| ---------------------- | -------------------------- | --------------------- |
| `MODEL_PROVIDER`       | `anthropic`                | `anthropic` or `x402` |
| `MODEL_ID`             | `claude-sonnet-4-20250514` | Model identifier      |
| `TICK_INTERVAL_MS`     | `60000`                    | Ms between ticks      |
| `TORII_URL`            | auto                       | Skip discovery        |
| `WORLD_ADDRESS`        | auto                       | Skip discovery        |
| `RPC_URL`              | per-chain                  | Override RPC          |
| `VRF_PROVIDER_ADDRESS` | hardcoded                  | Override VRF          |

### x402

| Variable                 | Default                | Description                |
| ------------------------ | ---------------------- | -------------------------- |
| `X402_PRIVATE_KEY`       | —                      | Hex key for permit signing |
| `X402_ROUTER_URL`        | `https://ai.xgate.run` | Router endpoint            |
| `X402_MODEL_ID`          | `kimi-k2.5`            | Model                      |
| `X402_NETWORK`           | `eip155:8453`          | CAIP-2 network             |
| `X402_PERMIT_CAP`        | `10000000`             | Max per permit             |
| `X402_PAYMENT_SIGNATURE` | —                      | Static auth                |

## Architecture

```
Agent Loop (tick → briefing → LLM → tool calls → repeat)
    ├── Map Loop (10s) — tiles, ASCII map, threat detection
    └── Automation Loop (60s) — build, upgrade, produce, offload
```

The agent handles combat and exploration. Automation handles the economy. The map feeds both.

Evolution rewrites `soul.md` and task files every 10 ticks based on results.

## Data

`~/.axis/worlds/<worldAddress>/`:

```
├── soul.md
├── map.txt
├── automation-status.txt
├── tasks/
└── .cartridge/
```

## Links

- [dev/scratch/PROVIDER-METHODS.md](dev/scratch/PROVIDER-METHODS.md) — Table view of which methods have been added as
  tools to which implementation
- [dev/scratch/SCRATCH.md](dev/scratch/SCRATCH.md) — allocate all temporary work here. overwriteable. do not create new
  directories.
