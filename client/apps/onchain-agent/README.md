# Axis

Autonomous onchain agent for [Eternum | Blitz](https://blitz.realms.world/).

## Modes

| Command      | Description                                   |
| ------------ | --------------------------------------------- |
| `axis run`   | Autonomous agent loop (tick → act → repeat)   |
| `axis mcp`   | MCP server for Claude Code                    |
| `axis <cmd>` | One-shot tool commands (map queries, actions) |

## Quick Start

```bash
# From repo root
pnpm i && pnpm build:packages && pnpm --dir packages/client build

# Build the binary
cd client/apps/onchain-agent
bun run dev/scripts/build.ts
```

### Configure

Create `.env` in the directory where you'll run axis (or pass env vars directly):

```bash
CHAIN=slot
WORLD_NAME=<world-slug>
ANTHROPIC_API_KEY=sk-ant-...   # only needed for axis run
```

### Run the agent

```bash
CHAIN=slot WORLD_NAME=myworld ./dist/axis run
```

> if running from build output artifact location

### Use as MCP server (Claude Code)

```bash
claude mcp add-json --scope user eternum \
  '{"type":"stdio","command":"/path/to/axis","args":["mcp"],"env":{"CHAIN":"slot","WORLD_NAME":"myworld"}}'
```

### One-shot commands

```bash
axis status --json
axis map briefing
axis map find own_army
axis create-army 169
axis move-army 229 5 -3
```

Run `axis --help` for all commands.

## Architecture

```
Agent Loop (tick → briefing → LLM → tool calls → repeat)
    ├── Map Loop (10s) — tiles, threat detection, protocol queries
    ├── Automation Loop (60s) — build, upgrade, produce, offload
    └── Evolution (every 10 ticks) — rewrites strategy based on agent memory
```

The agent handles combat and exploration. Automation handles the economy. The map feeds both.

## Memory Architecture

Three layers of persistent state:

| File         | Owner     | Purpose                             |
| ------------ | --------- | ----------------------------------- |
| `soul.md`    | Operator  | Personality — never auto-modified   |
| `memory.md`  | Agent     | Working memory — appended each tick |
| `tasks/*.md` | Evolution | Strategic lessons learned over time |

The agent reads all three each tick. It writes to `memory.md` via the `update_memory` tool. Evolution rewrites `tasks/`
every 10 ticks based on what the agent wrote in memory.

## Data

`~/.axis/worlds/<worldAddress>/`:

```
├── soul.md              — personality (operator edits)
├── memory.md            — agent working memory
├── tasks/
│   ├── priorities.md
│   ├── combat.md
│   ├── economy.md
│   ├── exploration.md
│   └── reflection.md
└── .cartridge/          — session persistence
```

## Configuration

See [Configuration](dev/scratch/README-PART2.md) for all environment variables.

## Links

- [dev/scratch/README-PART2.md](dev/scratch/README-PART2.md) — Tools table, full env var reference
- [dev/scratch/PROVIDER-METHODS.md](dev/scratch/PROVIDER-METHODS.md) — Provider method coverage
