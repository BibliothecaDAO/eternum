# TODO

## Tool Unification — DONE

Core tool functions extracted to `src/tools/core/`. Both MCP server (`src/mcp/server.ts`) and PI agent (`src/tools/pi-tools.ts`) are thin wrappers over the same shared logic. CLI commands (`src/cli/commands/tools.ts`) also use the same core functions.

## Memory + Evolution Redesign — DONE

- Agent writes to `memory.md` via `update_memory` tool each tick
- Evolution reads `memory.md` instead of raw message dumps
- Evolution only writes `tasks/*.md`, never `soul.md`
- System prompt rebuilt once per tick, not every LLM call
