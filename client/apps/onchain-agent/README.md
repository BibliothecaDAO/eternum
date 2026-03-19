# Eternum Onchain Agent

An autonomous agent + MCP server for playing [Eternum](https://eternum.realms.world/) Blitz.

## Quick Start

```bash
# From repo root
pnpm i
pnpm build:packages
pnpm --dir packages/client build
pnpm --dir packages/game-agent build

# Setup
cd client/apps/onchain-agent
cp .env.example .env  # set CHAIN, WORLD_NAME, ANTHROPIC_API_KEY
```

Register and settle your realms in the game client first, then:

```bash
pnpm dev
```

## MCP Server (Claude Code)

```bash
claude mcp add eternum -- npx tsx client/apps/onchain-agent/dev/scripts/mcp-server.ts
```

22 tools for gameplay — see [PROVIDER-METHODS.md](PROVIDER-METHODS.md) for full list.

## .env

```
CHAIN=slot
WORLD_NAME=<your-world>
ANTHROPIC_API_KEY=<key>
```

## Data

Runtime data: `~/.axis/worlds/<worldAddress>/`

## Docs

- [PROVIDER-METHODS.md](PROVIDER-METHODS.md) — all provider methods with implementation status
- [KNOWN-ISSUES.md](KNOWN-ISSUES.md) — tracked bugs and fixes
