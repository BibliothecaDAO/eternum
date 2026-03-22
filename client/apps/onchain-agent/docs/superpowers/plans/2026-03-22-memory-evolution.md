# Agent Memory + Evolution Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add agent working memory (`memory.md`) with an `update_memory` tool, fix the tick loop so file I/O happens once per tick, and redesign the evolution engine to read memory.md instead of raw message dumps.

**Architecture:** New `update_memory` tool appends timestamped entries to `memory.md`. Tick prompt includes memory contents. `transformContext` stripped down to snapshot sync + message pruning only. Evolution reads memory.md + tasks/ + briefing — no more `recentMessages`.

**Tech Stack:** TypeScript, pi-agent-core, existing tool patterns

**Spec:** `docs/superpowers/specs/2026-03-22-memory-evolution-design.md`

---

## File Structure

```
New files:
  src/tools/core/memory.ts         — update_memory core function (append timestamped entry)

Modified files:
  src/entry/bootstrap.ts           — create empty memory.md on first run
  src/entry/main.ts                — tick loop: build system prompt once, include memory in tick prompt, simplified transformContext
  src/tools/pi-tools.ts            — register update_memory tool for PI agent
  src/mcp/server.ts                — register update_memory tool for MCP server
  src/entry/evolution.ts           — read memory.md, drop recentMessages, drop soul.md writes, new prompt
```

---

### Task 1: Create the update_memory core function

**Files:**
- Create: `src/tools/core/memory.ts`

- [ ] **Step 1: Create the core function**

Create `src/tools/core/memory.ts`:

```ts
/**
 * Core logic for the update_memory tool.
 *
 * Appends a timestamped entry to the agent's memory file.
 * The agent calls this each tick to record intent and learnings.
 */

import { appendFileSync } from "node:fs";
import { join } from "node:path";

/** Input for the update_memory tool. */
export interface UpdateMemoryInput {
  /** Free-form text to append. The tool prepends a timestamp automatically. */
  content: string;
}

/** Result of an update_memory call. */
export interface UpdateMemoryResult {
  success: boolean;
  message: string;
}

/**
 * Append a timestamped entry to memory.md.
 *
 * @param input - The content to append.
 * @param dataDir - Path to the world data directory containing memory.md.
 * @returns Success result.
 */
export function updateMemory(input: UpdateMemoryInput, dataDir: string): UpdateMemoryResult {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${input.content}\n`;
  const memoryPath = join(dataDir, "memory.md");

  try {
    appendFileSync(memoryPath, entry);
    return { success: true, message: "Memory updated." };
  } catch (err: any) {
    return { success: false, message: `Failed to write memory: ${err.message}` };
  }
}
```

- [ ] **Step 2: Export from core index**

Add to `src/tools/core/index.ts`:

```ts
export * from "./memory.js";
```

- [ ] **Step 3: Verify**

Run: `pnpm build`
Expected: Compiles cleanly

- [ ] **Step 4: Commit**

```bash
git add src/tools/core/memory.ts src/tools/core/index.ts
git commit -m "feat: add update_memory core function"
```

---

### Task 2: Bootstrap empty memory.md

**Files:**
- Modify: `src/entry/bootstrap.ts`

- [ ] **Step 1: Add memory.md creation**

In `src/entry/bootstrap.ts`, add after the `writeIfMissing(join(dataDir, "soul.md"), DEFAULT_SOUL)` line:

```ts
writeIfMissing(join(dataDir, "memory.md"), "");
```

- [ ] **Step 2: Verify**

Run: `pnpm build`
Expected: Compiles cleanly

- [ ] **Step 3: Commit**

```bash
git add src/entry/bootstrap.ts
git commit -m "feat: bootstrap empty memory.md on first run"
```

---

### Task 3: Register update_memory in PI agent tools

**Files:**
- Modify: `src/tools/pi-tools.ts`

- [ ] **Step 1: Add the tool**

The `createCoreTools` function takes `ctx: ToolContext` and `mapCtx: MapContext`. The `update_memory` tool needs `dataDir` which is on `config`, not on `ctx`. We need to pass `dataDir` to `createCoreTools`.

Update the function signature in `src/tools/pi-tools.ts`:

```ts
export function createCoreTools(ctx: ToolContext, mapCtx: MapContext, dataDir: string): AgentTool<any>[] {
```

Then add the `update_memory` tool to the returned array:

```ts
{
  name: "update_memory",
  label: "Update Memory",
  description:
    "Append a note to your memory. Use this to record your intent, plans, and learnings. Keep entries concise (2-3 sentences). A timestamp is added automatically.",
  parameters: Type.Object({
    content: Type.String({ description: "What to remember" }),
  }),
  async execute(_toolCallId: string, { content }: { content: string }) {
    const { updateMemory } = await import("./core/memory.js");
    const result = updateMemory({ content }, dataDir);
    return {
      content: [{ type: "text" as const, text: result.message }],
      details: result,
    };
  },
},
```

- [ ] **Step 2: Update caller in main.ts**

In `src/entry/main.ts`, update the `createCoreTools` call (line 256) to pass `config.dataDir`:

```ts
const tools: AgentTool[] = [...createReadOnlyTools(config.dataDir), ...createCoreTools(toolCtx, mapCtx, config.dataDir)];
```

- [ ] **Step 3: Verify**

Run: `pnpm build`
Expected: Compiles cleanly

- [ ] **Step 4: Commit**

```bash
git add src/tools/pi-tools.ts src/entry/main.ts
git commit -m "feat: register update_memory tool in PI agent"
```

---

### Task 4: Register update_memory in MCP server

**Files:**
- Modify: `src/mcp/server.ts`

- [ ] **Step 1: Add the MCP tool**

In `src/mcp/server.ts`:

First, add a `let dataDir = ""` mutable variable alongside the other mutable state variables at the top of `startMcpServer()` (near `let client`, `let provider`, etc.).

Then, after bootstrap completes (where `bootstrapDone = true` is set), add: `dataDir = result.config.dataDir;`

Finally, after the existing tool registrations (near the `apply_relic` tool), add:

```ts
server.tool(
  "update_memory",
  "Append a note to agent memory. Records intent, plans, and learnings with automatic timestamp.",
  { content: z.string().describe("What to remember") },
  async ({ content }) => {
    const err = notReady();
    if (err) return { content: [{ type: "text", text: err }], isError: true };
    const { updateMemory } = await import("../tools/core/memory.js");
    const result = updateMemory({ content }, dataDir);
    return { content: [{ type: "text", text: result.message }], isError: !result.success };
  },
);
```

- [ ] **Step 2: Verify**

Run: `pnpm build`
Expected: Compiles cleanly

- [ ] **Step 3: Commit**

```bash
git add src/mcp/server.ts
git commit -m "feat: register update_memory tool in MCP server"
```

---

### Task 5: Refactor tick loop — system prompt once per tick, memory in tick prompt

This is the core refactor. Three changes:
1. Build system prompt once before `agent.prompt()`, not in `transformContext`
2. Read memory.md and include in tick prompt
3. Strip `transformContext` down to snapshot sync + prune only

**Files:**
- Modify: `src/entry/main.ts`

- [ ] **Step 1: Add memory reading helper**

At the top of main.ts (after imports), add:

```ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Read memory.md contents, or empty string if missing. */
function readMemory(dataDir: string): string {
  const memoryPath = join(dataDir, "memory.md");
  if (!existsSync(memoryPath)) return "";
  return readFileSync(memoryPath, "utf-8").trim();
}
```

- [ ] **Step 2: Update buildTickPrompt to include memory**

Replace the existing `buildTickPrompt` function:

```ts
function buildTickPrompt(mapCtx: MapContext, toolErrors: ToolError[], memory: string): string {
  const briefing = mapCtx.protocol?.briefing();
  if (!briefing) return "Map not yet loaded. Wait for next tick.";

  const parts = [
    "## Tick",
    "",
    JSON.stringify(briefing, null, 2),
  ];

  if (memory) {
    parts.push("", "## Memory", memory);
  }

  if (toolErrors.length > 0) {
    parts.push(
      "",
      "## Recent Errors",
      ...toolErrors.map((e) => `- ${e.tool}: ${e.error}`),
    );
  }

  parts.push(
    "",
    "## Constraints",
    "- Stamina regenerates over time (20/tick). Travel costs ~10-30/hex depending on biome. Use it wisely.",
    "- Attacking requires stamina (configured per world). If stamina is too low, the attack does zero damage.",
    "- Most actions require adjacency: attack, raid, open_chest, guard_from_army, reinforce_army, transfer, unguard.",
    "- Move army to an adjacent hex first before interacting with a target.",
    "- Use simulate_attack before committing to check predicted outcome.",
    "- Use map_find and map_entity_info to scout before acting.",
    "",
    "Act on threats first, then opportunities. Before ending your turn, use update_memory to note your intent and any learnings. Keep it to 2-3 sentences.",
  );

  return parts.join("\n");
}
```

- [ ] **Step 3: Move system prompt rebuild into runAgentTick**

Replace the `runAgentTick` function and simplify `transformContext`:

```ts
function runAgentTick() {
  if (agentBusy) return;

  // Rebuild system prompt once per tick (picks up evolution/operator edits)
  agent.setSystemPrompt(buildSystemPrompt(config.dataDir));

  // Read memory for inclusion in tick prompt
  const memory = readMemory(config.dataDir);
  const prompt = buildTickPrompt(mapCtx, toolErrors, memory);

  agentBusy = true;
  agent.prompt(prompt).then(
    () => { agentBusy = false; },
    (err) => {
      agentBusy = false;
      console.error("Agent error:", err instanceof Error ? err.message : err);
    },
  );
}
```

And simplify `transformContext` in the Agent constructor:

```ts
transformContext: async (messages) => {
  if (mapCtx.snapshot) toolCtx.snapshot = mapCtx.snapshot;
  const maxChars = (model.contextWindow ?? 200_000) * 3;
  const pruneTarget = Math.floor(maxChars * 0.5);
  return pruneMessages(messages, model, maxChars, pruneTarget);
},
```

- [ ] **Step 4: Verify no stale system prompt rebuilds remain in transformContext**

Confirm that `transformContext` no longer calls `agent.setSystemPrompt()` or `buildSystemPrompt()`. The system prompt rebuild is now in `runAgentTick()`. The initial `const systemPrompt = buildSystemPrompt(config.dataDir)` on line 259 stays — it's needed for the agent's `initialState`.

- [ ] **Step 5: Verify**

Run: `pnpm build`
Expected: Compiles cleanly

Run: `pnpm vitest run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/entry/main.ts
git commit -m "refactor: system prompt once per tick, memory in tick prompt, lean transformContext"
```

---

### Task 6: Redesign evolution engine

**Files:**
- Modify: `src/entry/evolution.ts`

- [ ] **Step 1: Simplify EvolutionSnapshot**

Replace the `EvolutionSnapshot` interface:

```ts
export interface EvolutionSnapshot {
  /** Structured briefing from map protocol. */
  briefing: object;
  /** Unix timestamp in milliseconds. */
  timestamp: number;
}
```

- [ ] **Step 2: Rewrite buildEvolutionPrompt**

First, update the imports at the top of `evolution.ts`:

Change line 7 from:
```ts
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
```
to:
```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
```

And change line 11 from:
```ts
import { loadSoul, loadTaskLists } from "./soul.js";
```
to:
```ts
import { loadTaskLists } from "./soul.js";
```

Then replace `buildEvolutionPrompt` to read memory.md and drop soul.md / recentMessages:

```ts
function buildEvolutionPrompt(dataDir: string, briefing: object): string {
  const memoryPath = join(dataDir, "memory.md");
  const memory = existsSync(memoryPath) ? readFileSync(memoryPath, "utf-8").trim() : "(no memory yet)";
  const taskLists = loadTaskLists(join(dataDir, "tasks"));

  let prompt = `You are the evolution engine for an autonomous Eternum agent.

## Agent's Memory (what the agent experienced and learned)
${memory}

## Current Strategy
`;

  for (const [domain, content] of taskLists) {
    prompt += `### ${domain}\n${content}\n\n`;
  }

  prompt += `## Current Game State
${JSON.stringify(briefing, null, 2)}

## Instructions

Given what the agent experienced and learned, update the strategy files if you see improvements.

Focus on:
- Concrete tactical adjustments (e.g. "don't attack below 2x strength ratio")
- Resource priorities (e.g. "save essence for realm upgrades before expanding")
- Positioning advice (e.g. "keep armies within 3 hexes of owned structures")

Keep suggestions SHORT and CONCRETE. Each file should be under 50 lines.
Only change what needs changing. Do NOT modify soul.md.

Each suggestion must have:
- target: "task_list" (only — soul is not modifiable)
- domain: one of: combat, economy, exploration, priorities, reflection
- action: "update"
- content: the FULL new content (replaces the file entirely)
- reasoning: one sentence explaining what changed and why

\`\`\`json
[
  {
    "target": "task_list",
    "domain": "combat",
    "action": "update",
    "content": "- Only attack when strength ratio > 2x\\n- Retreat if ratio < 0.5x",
    "reasoning": "Lost 3 armies attacking at bad ratios."
  }
]
\`\`\``;

  return prompt;
}
```

Add `readFileSync` and `existsSync` imports at the top of the file if not already present.

- [ ] **Step 3: Block soul.md writes in applyEvolution**

In the `applyEvolution` function, skip `target: "soul"` suggestions:

```ts
switch (suggestion.target) {
  case "soul":
    continue; // soul.md is operator-owned, never auto-modified
  case "task_list":
```

- [ ] **Step 4: Simplify the evolve() function signature**

Update `evolve()` to take `briefing: object` instead of the old `EvolutionSnapshot`:

```ts
export async function evolve(
  model: Model<any>,
  dataDir: string,
  briefing: object,
): Promise<EvolutionResult> {
  const prompt = buildEvolutionPrompt(dataDir, briefing);

  const response = await completeSimple(model, {
    systemPrompt:
      "You are analyzing a game-playing AI agent's strategy. " +
      "Suggest concrete, specific improvements to task files only. Do not modify soul.md.",
    messages: [{ role: "user" as const, content: prompt, timestamp: Date.now() }],
  });

  const text = response.content.find((b): b is { type: "text"; text: string } => b.type === "text");
  if (!text) return { suggestions: [], analysis: "No response from model." };

  const result = parseEvolutionResult(text.text);

  if (result.suggestions.length > 0) {
    const applied = applyEvolution(result.suggestions, dataDir);
    console.error(`Evolution: applied ${applied.length} changes`);
    for (const f of applied) console.error(`  → ${f}`);
  } else {
    console.error("Evolution: no changes suggested");
  }

  return result;
}
```

Remove the `previousSnapshot` module-level variable — no more before/after comparison.

- [ ] **Step 5: Update the evolution call in main.ts**

In `src/entry/main.ts`, replace the evolution call (lines 370-396) with:

```ts
if (tickCount % EVOLUTION_INTERVAL === 0 && !evolving) {
  evolving = true;
  const briefing = mapCtx.protocol?.briefing() ?? {};
  evolve(model, config.dataDir, briefing)
    .catch((err) => console.error("Evolution error:", err instanceof Error ? err.message : err))
    .finally(() => { evolving = false; });
}
```

- [ ] **Step 6: Verify**

Run: `pnpm build`
Expected: Compiles cleanly

Run: `pnpm vitest run`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add src/entry/evolution.ts src/entry/main.ts
git commit -m "refactor: evolution reads memory.md, drops raw messages, blocks soul.md writes"
```

---

### Task 7: Build binary and smoke test

**Files:**
- Verify: `dev/scripts/build.ts`

- [ ] **Step 1: Run all tests**

Run: `pnpm vitest run`
Expected: All tests pass

- [ ] **Step 2: Build binary**

Run: `bun run dev/scripts/build.ts`
Expected: Build succeeds

- [ ] **Step 3: Smoke test**

Run: `./dist/axis --help`
Expected: `update-memory` not listed (it's an agent-internal tool, not a CLI command)

Run: `./dist/axis map briefing --json 2>/dev/null`
Expected: Structured briefing works

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: verify build after memory + evolution redesign"
```
