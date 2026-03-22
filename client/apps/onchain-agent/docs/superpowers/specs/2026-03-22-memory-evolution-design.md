# Agent Memory + Evolution Redesign

## Overview

Add agent working memory (`memory.md`) and redesign the evolution engine to use the agent's own account of events instead of raw message dumps.

Three-layer memory architecture:
1. **`soul.md`** — personality (operator-owned, never auto-modified)
2. **`memory.md`** — working memory (agent appends via tool each tick)
3. **`tasks/*.md`** — strategic lessons (evolution writes every N ticks)

## Design Principles

- Agent owns its own memory — free-form, append-only, concise
- Evolution reads what the agent wrote, not raw tool results
- System prompt rebuilt once per tick, not every LLM call
- soul.md is sacred — evolution never touches it

## memory.md — Agent Working Memory

### File

`~/.axis/worlds/<addr>/memory.md` — alongside soul.md and tasks/.

Created empty on first run (no placeholder text). Append-only, no pruning, no size limit. Operator can manually trim if needed.

### Tool

`update_memory` — a new agent tool. Takes a string, prepends an ISO timestamp, appends to memory.md:

```
[2026-03-22T15:30:00Z] Moving army 229 toward hyperstructure at (0,0). 5 hexes away.
[2026-03-22T15:31:00Z] Won battle against enemy at (3,-5). Lost 200 troops but gained position.
[2026-03-22T15:32:00Z] Economy automation building wheat farms. Need essence to level up realms.
```

The agent doesn't manage timestamps — the tool injects them automatically.

### Tick Prompt Inclusion

The full contents of memory.md are included in the tick prompt so the agent sees its own history. The tick prompt instructs: "Before ending your turn, use update_memory to note your intent and any learnings. Keep it to 2-3 sentences."

## Tick Loop Changes

### Once Per Tick (before `agent.prompt()`)

1. Rebuild system prompt from `soul.md` + `tasks/*.md`
2. Call `agent.setSystemPrompt()`
3. Read `memory.md`
4. Build tick prompt with: briefing JSON + memory contents + tool errors + constraints
5. Send via `agent.prompt()`

### `transformContext` (every LLM call within a tick)

1. Sync `toolCtx.snapshot` with latest map data
2. Prune messages if context exceeds threshold
3. Nothing else — no file I/O, no system prompt rebuild

### Tick Prompt Structure

```
## Tick

<briefing JSON>

## Memory
<memory.md contents>

## Recent Errors
<tool errors if any>

## Constraints
- Stamina regenerates over time (20/tick). Travel costs ~10-30/hex depending on biome.
- Attacking requires stamina. If too low, attack does zero damage.
- Most actions require adjacency: attack, raid, open_chest, guard_from_army, reinforce_army, transfer, unguard.
- Move army to adjacent hex first before interacting with a target.
- Use simulate_attack before committing to check predicted outcome.
- Use map_find and map_entity_info to scout before acting.

Act on threats first, then opportunities. Before ending your turn, use update_memory to note your intent and any learnings. Keep it to 2-3 sentences.
```

## Evolution Engine Redesign

### Input (what evolution sees)

- **`memory.md`** — the agent's own account of what happened and what it learned
- **`tasks/*.md`** — current strategic guidance
- **Structured briefing** — current game state as JSON (army count, structures, threats, opportunities)

### Output (what evolution writes)

- **`tasks/*.md` only** — strategic lesson updates
- **Never touches `soul.md`**

### What Gets Removed

- `recentMessages` (30 raw agent messages) — replaced by memory.md
- Before/after map snapshots — replaced by structured briefing
- Wrong tool names in evolution prompt
- `target: "soul"` in evolution suggestions — blocked

### Evolution Prompt

```
You are the evolution engine for an autonomous Eternum agent.

## Agent's Memory
<memory.md contents>

## Current Strategy
<tasks/*.md contents>

## Current Game State
<structured briefing JSON>

Given what the agent experienced and learned, update the strategy files
if you see improvements. Focus on concrete tactical and strategic lessons.
Only change what needs changing. Do not modify soul.md.

Output suggestions as JSON:
[
  {
    "target": "task_list",
    "domain": "combat",
    "action": "update",
    "content": "full replacement content",
    "reasoning": "one sentence why"
  }
]
```

### Delta Tracking

No separate delta tracking system. The agent's memory.md entries serve as the delta — the agent writes what it did, what happened, and what it learned. Evolution reads this directly instead of computing diffs from raw data.

## File Structure

```
~/.axis/worlds/<addr>/
  soul.md          — personality (operator writes, read-only to automation)
  memory.md        — agent working memory (agent appends via tool)
  tasks/
    priorities.md  — strategic priorities (evolution writes)
    combat.md      — combat lessons (evolution writes)
    economy.md     — economic strategy (evolution writes)
    exploration.md — exploration strategy (evolution writes)
    reflection.md  — self-reflection (evolution writes)
```

## Bootstrap Changes

- `bootstrapDataDir()` creates an empty `memory.md` (no placeholder text)
- Default task files remain as-is (empty placeholders that evolution fills)

## Scope Boundaries

### In scope
- `update_memory` tool (agent appends timestamped entries)
- memory.md read in tick prompt
- System prompt built once per tick (not every LLM call)
- Evolution reads memory.md instead of recentMessages
- Evolution blocked from writing soul.md

### Out of scope
- Memory pruning or summarization
- Structured/JSON memory format
- Changes to evolution frequency (stays at every N ticks)
- Changes to task file domains (keep existing 5 files)
