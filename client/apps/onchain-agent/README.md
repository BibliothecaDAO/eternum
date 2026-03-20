# Axis

For [Eternum | Blitz](https://blitz.realms.world/).

| Mode       |             |
| ---------- | ----------- |
| `pnpm dev` | Pi agent    |
| MCP server | Claude Code |

## Quick Start

```
# Repo root
pnpm i && pnpm build:packages && pnpm --dir packages/client build
cd client/apps/onchain-agent
```

Create `.env`:

```
CHAIN=slot
WORLD_NAME=
ANTHROPIC_API_KEY=
```

Manually settle realms first in game client

```
pnpm dev
```

Open URL

> IF SESSION BUGS, DO AUTH IN INCOGNITO TAB

## MCP Server

```bash
claude mcp add eternum -- npx tsx ./client/apps/onchain-agent/dev/scripts/mcp-server.ts
```

Reads `.env` from `client/apps/onchain-agent/` regardless of working directory. Call `status` first.

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

- [dev/scratch/README-PART2.md](dev/scratch/README-PART2.md) — Advanced configuration
- [dev/scratch/PROVIDER-METHODS.md](dev/scratch/PROVIDER-METHODS.md) — Table view of which methods have been added as
  tools to which implementation
- [dev/scratch/SCRATCH.md](dev/scratch/SCRATCH.md) — allocate all temporary work here. overwriteable. do not create new
  directories.
