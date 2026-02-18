# Game Agent Architecture

**Package**: `@bibliothecadao/game-agent` **Version**: 0.1.0 **Description**: Autonomous agent framework for playing
onchain games with self-evolving strategies

## Table of Contents

- [Purpose](#purpose)
- [Core Concepts](#core-concepts)
- [Architecture Overview](#architecture-overview)
- [Module Reference](#module-reference)
- [Agent Lifecycle](#agent-lifecycle)
- [Decision-Making System](#decision-making-system)
- [Tools System](#tools-system)
- [Template System](#template-system)
- [Integration Guide](#integration-guide)
- [Dependencies](#dependencies)

---

## Purpose

The `game-agent` package provides a game-agnostic framework for building autonomous AI agents that can play onchain
games. It separates the core agent infrastructure (tick loops, decision logging, personality system, tool definitions)
from game-specific logic through the **Adapter Pattern**.

### Key Features

- **Game-Agnostic Core**: Works with any onchain game (Dojo, EVM, etc.) via adapters
- **Self-Evolving Strategies**: Agents learn and improve through the evolution system
- **Personality System**: Configurable agent behavior via "soul" files
- **Structured Task Management**: Task lists organized by domain (combat, economy, exploration, etc.)
- **Decision Logging**: Full audit trail of agent reasoning and actions
- **Runtime Configuration**: Live updates to tick rate, model, and world connectivity
- **Heartbeat Scheduling**: Cron-style recurring jobs for periodic agent activities
- **Tool System**: Extensible tools for game observation, action execution, and file manipulation

---

## Core Concepts

### 1. World State

Generic representation of any game state at a given tick:

```typescript
interface WorldState<TEntity = unknown> {
  tick: number; // Game tick number
  timestamp: number; // Unix timestamp
  entities: TEntity[]; // Game-specific entities (units, buildings, cards, etc.)
  resources?: Map<string, number>; // Optional resource tracking
  raw?: unknown; // Raw state data for game-specific needs
}
```

### 2. Game Adapter

Connection between the agent framework and a specific game:

```typescript
interface GameAdapter<TState extends WorldState = WorldState> {
  getWorldState(): Promise<TState>;
  executeAction(action: GameAction): Promise<ActionResult>;
  simulateAction(action: GameAction): Promise<SimulationResult>;
  subscribe?(callback: (state: TState) => void): () => void;
}
```

### 3. Action System

Actions are the agent's interface to the game:

```typescript
interface GameAction {
  type: string; // e.g., "move", "build", "attack"
  params: Record<string, unknown>; // Action parameters
}

interface ActionDefinition {
  type: string;
  description: string;
  params: ActionParamSchema[]; // Parameter schemas for LLM validation
}
```

### 4. Agent Data Directory

The agent's persistent state lives in a structured data directory:

```
data/
├── soul.md                  # Agent personality and strategic philosophy
├── tasks/                   # Domain-specific task lists
│   ├── combat.md
│   ├── economy.md
│   ├── exploration.md
│   └── priorities.md
├── skills/                  # Reusable strategic patterns
│   ├── early-game-opening/
│   │   └── SKILL.md
│   └── defending-a-rush/
│       └── SKILL.md
├── decisions/               # Decision log (auto-generated)
│   ├── 1-1234567890.md
│   └── 2-1234567891.md
└── HEARTBEAT.md            # Cron-style scheduled jobs
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Game Agent System                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐      ┌──────────────┐      ┌───────────┐ │
│  │  Tick Loop   │─────▶│  Game Agent  │◀────▶│   Tools   │ │
│  │  (60s cycle) │      │   (LLM Core) │      │  System   │ │
│  └──────────────┘      └──────┬───────┘      └─────┬─────┘ │
│                               │                      │       │
│  ┌──────────────┐      ┌──────▼───────┐      ┌─────▼─────┐ │
│  │  Heartbeat   │      │   Decision   │      │   Game    │ │
│  │  Scheduler   │      │   Recorder   │      │  Adapter  │ │
│  └──────────────┘      └──────────────┘      └─────┬─────┘ │
│                                                      │       │
│  ┌──────────────────────────────────────────────────▼─────┐ │
│  │              Soul + Task Lists + Skills                 │ │
│  │            (Personality & Strategic Memory)             │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                               │
└───────────────────────────────────────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Onchain Game      │
                    │  (Dojo, EVM, etc.)  │
                    └─────────────────────┘
```

---

## Module Reference

### `game-agent.ts`

**Main entry point** for creating game agents.

#### `createGameAgent<TState>(options: CreateGameAgentOptions<TState>): GameAgentResult`

Creates a fully-configured game agent instance.

**Options:**

- `adapter` — GameAdapter implementation for your game
- `dataDir` — Path to agent's data directory (soul, tasks, skills)
- `model?` — LLM model (defaults to provider config)
- `tickIntervalMs?` — Tick loop interval (default: 60000)
- `formatTickPrompt?` — Custom tick prompt formatter
- `streamFn?` — Custom stream function (for testing)
- `includeDataTools?` — Expose read/write tools (default: true)
- `extraTools?` — Additional custom tools
- `runtimeConfigManager?` — Live config updates (tick rate, model, world)
- `actionDefs?` — Action definitions for validation and list_actions tool

**Returns:**

```typescript
interface GameAgentResult {
  agent: Agent; // Core LLM agent
  tools: AgentTool[]; // All registered tools
  ticker: TickLoop; // Tick loop controller
  recorder: DecisionRecorder; // Decision logger
  enqueuePrompt(prompt: string): Promise<void>; // Queue agent prompts
  reloadPrompt(): void; // Reload soul/tasks from disk
  setDataDir(dataDir: string): void; // Hot-swap data directory
  getDataDir(): string; // Current data directory
  dispose(): Promise<void>; // Cleanup and shutdown
}
```

**Lifecycle:**

1. **Initialization**:
   - Loads soul.md and task lists from `dataDir`
   - Builds system prompt from soul + task lists
   - Creates tools (game tools, file tools, config tools, extra tools)
   - Initializes decision recorder
   - Creates Agent with system prompt + tools

2. **Runtime**:
   - Tick loop calls `onTick` every `tickIntervalMs`
   - On each tick: reloads prompt if changed, fetches world state, enqueues tick prompt
   - Agent processes prompt using tools
   - Decision recorder logs actions taken

3. **Disposal**:
   - Stops tick loop
   - Aborts agent processing
   - Cleans up resources

---

### `tick-loop.ts`

Manages the periodic game tick cycle.

#### `createTickLoop(options): TickLoop`

Creates a non-overlapping tick loop that calls `onTick` at regular intervals.

**Options:**

- `intervalMs` — Tick interval in milliseconds
- `onTick` — Async callback executed each tick
- `onError?` — Error handler

**Interface:**

```typescript
interface TickLoop {
  start(): void; // Begin ticking
  stop(): void; // Stop ticking
  setIntervalMs(intervalMs: number): void; // Update interval (live)
  readonly intervalMs: number; // Current interval
  readonly isRunning: boolean; // Tick loop state
  readonly tickCount: number; // Total ticks executed
}
```

**Guarantees:**

- **Non-overlapping**: Next tick waits for previous `onTick` to complete
- **Error resilient**: Errors call `onError` but don't stop the loop
- **Dynamic interval**: Interval can be updated while running

#### `formatTickPrompt(state: WorldState): string`

Default tick prompt formatter. Instructs agent to:

1. Use `observe_game` for detailed state inspection
2. Use `list_actions` to look up available actions
3. Load relevant skills from SKILL.md files
4. Decide on action(s) for the tick
5. Use `execute_action` to submit actions
6. Use `write` to update tasks/priorities/soul
7. Use `set_agent_config` to tune runtime config
8. Maintain `HEARTBEAT.md` for recurring jobs

---

### `heartbeat.ts`

Cron-style scheduler for recurring agent jobs.

#### `createHeartbeatLoop(options): HeartbeatLoop`

Creates a heartbeat scheduler that reads `HEARTBEAT.md` and executes jobs on cron schedules.

**Options:**

- `getHeartbeatPath` — Function returning path to HEARTBEAT.md
- `onRun` — Callback for job execution
- `pollIntervalMs?` — How often to check schedules (default: 15000)
- `onError?` — Error handler
- `now?` — Date provider (for testing)

**HEARTBEAT.md Format:**

```yaml
version: 1
jobs:
  - id: scout-routine
    enabled: true
    schedule: "*/15 * * * *" # Every 15 minutes
    prompt: "Scout all unexplored areas"
    mode: observe # or "act"
    timeoutSec: 60
```

**Cron Format:** `minute hour dayOfMonth month dayOfWeek` (standard 5-field cron)

**Job Modes:**

- `observe` — Agent can only read state and files (no on-chain actions)
- `act` — Agent can execute on-chain actions

**Execution Guarantees:**

- Jobs run once per minute (deduplicated by `minuteKey`)
- Disabled jobs are skipped
- Invalid cron schedules are logged via `onError`
- Jobs are non-blocking (runs in parallel with tick loop)

---

### `decision-log.ts`

Records agent decisions for analysis and debugging.

#### `createDecisionRecorder(logDir: string): DecisionRecorder`

Creates a decision recorder that persists decisions as markdown files with YAML frontmatter.

**Decision Format:**

```markdown
---
tick: 123
timestamp: 1234567890
actionType: move
success: true
soulUpdated: false
---

# Decision at Tick 123

## Reasoning

I observed enemy units approaching from the north. Moving south to avoid engagement while I build up forces.

## Action

- Type: move
- Params: {"entityId": "0x123", "x": 10, "y": 15}

## Result

- Success: true
- TxHash: 0xabc...
```

**Interface:**

```typescript
interface DecisionRecorder {
  record(decision: Decision): Promise<void>;
  getDecisions(options?: {
    since?: number; // Filter by tick
    limit?: number; // Max decisions to return
  }): Promise<Decision[]>;
}
```

**Usage:**

- Automatically created by `createGameAgent` in `{dataDir}/decisions/`
- Filename: `{tick}-{timestamp}.md`
- Sorted chronologically for analysis

---

### `soul.ts`

Agent personality and strategic memory system.

#### `loadSoul(soulPath: string): string`

Loads soul.md file, stripping YAML frontmatter.

#### `loadTaskLists(taskListDir: string): Map<string, string>`

Loads all .md files from `tasks/` directory, indexed by domain name.

#### `buildGamePrompt(options): { systemPrompt: string; appendSections: string[] }`

Constructs the agent's system prompt from soul + task lists + world state.

**Soul File Structure** (`soul.md`):

```markdown
---
version: 1
last_modified: tick-42
---

# Soul

## Identity

I am a strategic game agent...

## Personality Traits

- Aggression: 5/10
- Greed: 5/10
- Paranoia: 5/10
- Patience: 5/10
- Adaptability: 7/10

## Strategic Philosophy

- Information first. I can't exploit what I can't see.
- Economy enables everything. Outproduce, then overwhelm.
- Never fight fair. Only engage with advantage.

## Principles (hard rules)

- NEVER all-in. Always keep a reserve.
- NEVER ignore scouting for more than 30 ticks.

## What I've Learned About This Game

(Agent updates this section through self-reflection)

## What I've Learned About My Opponent

(Agent updates this section based on observations)
```

**Task Lists** (`tasks/*.md`):

Organized by domain (combat.md, economy.md, exploration.md, priorities.md, etc.). The agent reads and updates these
files via the `write` tool.

---

### `evolution.ts`

Agent self-improvement system.

#### `buildEvolutionPrompt(options): string`

Builds a prompt for LLM-based performance analysis. The prompt instructs an LLM to:

1. Analyze the agent's decision history
2. Identify patterns (successful strategies, recurring mistakes)
3. Suggest improvements to soul, task lists, or skills

**Options:**

- `dataDir` — Path to agent data
- `maxDecisions?` — Number of recent decisions to analyze

#### `parseEvolutionResult(response: string): EvolutionResult`

Parses LLM response into structured suggestions:

```typescript
interface EvolutionSuggestion {
  target: "soul" | "task_list" | "skill";
  domain?: string; // For task_list/skill targets
  action: "update" | "create";
  content: string; // New/updated content
  reasoning: string; // Why this change helps
}
```

#### `applyEvolution(suggestions, dataDir): Promise<string[]>`

Applies suggestions by writing updated soul/task/skill files.

**Evolution Workflow:**

1. Periodically (e.g., every 100 ticks), trigger evolution analysis
2. Send `buildEvolutionPrompt()` to LLM
3. Parse response with `parseEvolutionResult()`
4. Review suggestions (optional human approval)
5. Apply with `applyEvolution()`
6. Agent automatically reloads updated soul/tasks on next tick

**Note:** Evolution is not automatic — integrators decide when/how to trigger it.

---

### `tools.ts`

Tool definitions for agent interaction with the game.

#### Core Game Tools

**`observe_game`**

- Calls `adapter.getWorldState()`
- Returns serialized world state (entities, resources, tick)
- Optional `filter` parameter for entity filtering

**`list_actions`**

- Returns catalog of available actions and their parameter schemas
- Created when `actionDefs` are provided to `createGameAgent`
- Optional `filter` parameter to search by keyword
- Enables the agent to look up valid action types before calling execute/simulate

**`execute_action(actionType, params)`**

- Calls `adapter.executeAction()`
- Returns success status, transaction hash, and result data
- When `actionDefs` are provided, `actionType` is constrained to valid enum
- Logs response to `debug-tool-responses.log` for debugging

**`simulate_action(actionType, params)`**

- Calls `adapter.simulateAction()`
- Returns predicted outcome, cost estimates, and success status
- Used for planning and decision validation
- When `actionDefs` are provided, `actionType` is constrained to valid enum

#### Data Tools (when `includeDataTools: true`)

**`read(path)`**

- Reads files from `dataDir` (scoped access)
- Provided by `@mariozechner/pi-coding-agent`

**`write(path, content)`**

- Writes files to `dataDir` (scoped access)
- Used for updating soul, tasks, skills
- Provided by `@mariozechner/pi-coding-agent`

#### Config Tools (when `runtimeConfigManager` provided)

**`get_agent_config()`**

- Returns current runtime configuration
- Includes tick rate, model, world connectivity, etc.

**`set_agent_config(changes, reason?)`**

- Applies live configuration changes
- Changes: `[{ path: "tickIntervalMs", value: 30000 }]`
- Supports: tick rate, model, RPC URL, Torii URL, world address, data directory
- Returns `RuntimeConfigApplyResult` with success status for each change

---

### `types.ts`

Core type definitions for the package.

**Key Types:**

- `WorldState<TEntity>` — Generic game state
- `GameAdapter<TState>` — Adapter interface
- `GameAction` — Action representation
- `ActionDefinition` — Declarative action schema for LLM
- `ActionParamSchema` — Parameter definition
- `ActionResult` — Execution result
- `SimulationResult` — Dry-run result
- `GameAgentConfig<TState>` — Agent configuration
- `RuntimeConfigManager` — Live config update interface
- `RuntimeConfigChange` — Config change request
- `RuntimeConfigApplyResult` — Config change result

---

## Agent Lifecycle

### 1. Initialization

```typescript
const game = createGameAgent({
  adapter: myGameAdapter,
  dataDir: "/path/to/agent-data",
  model: getModel("anthropic", "claude-sonnet-4-5-20250929"),
  tickIntervalMs: 60_000,
  actionDefs: getActionDefinitions(),
});
```

- Loads soul.md and task lists from dataDir
- Builds initial system prompt
- Creates all tools (game, file, config, extra)
- Initializes decision recorder
- Creates tick loop (not started yet)

### 2. Tick Loop Start

```typescript
game.ticker.start();
```

**Each tick:**

1. **Reload Check**: Compare current soul/tasks with agent's system prompt
   - If changed → `agent.setSystemPrompt(newPrompt)`
2. **Fetch State**: `const state = await adapter.getWorldState()`
3. **Format Prompt**: `const prompt = formatTickPrompt(state)`
4. **Enqueue**: `await game.enqueuePrompt(prompt)`
   - Queued serially to prevent overlapping prompts
5. **Agent Processing**:
   - Agent receives prompt
   - Agent calls tools (observe_game, list_actions, execute_action, write, etc.)
   - Agent responds with reasoning
6. **Decision Recording**: Record action taken (optional, manual integration)

### 3. Heartbeat Scheduling

```typescript
const heartbeat = createHeartbeatLoop({
  getHeartbeatPath: () => path.join(dataDir, "HEARTBEAT.md"),
  onRun: async (job) => {
    const prompt = `## Heartbeat Job: ${job.id}\n\n${job.prompt}`;
    await game.enqueuePrompt(prompt);
  },
});
heartbeat.start();
```

- Polls HEARTBEAT.md every 15 seconds (configurable)
- Executes jobs matching cron schedule
- Jobs are deduplicated per minute
- Mode enforcement (observe vs. act) is app-level responsibility

### 4. Runtime Config Updates

```typescript
// Agent can call set_agent_config tool, or app can call directly:
await runtimeConfigManager.applyChanges(
  [
    { path: "tickIntervalMs", value: 30000 },
    { path: "modelId", value: "claude-opus-4-6" },
  ],
  "Tuning for faster iteration",
);
```

- Changes are queued and applied sequentially
- Tick rate updates: `ticker.setIntervalMs()`
- Model updates: `agent.setModel()`
- World updates: hot-swaps adapter
- Data directory updates: reloads soul/tasks

### 5. Evolution (Manual Trigger)

```typescript
// Application-level evolution trigger (example):
if (game.ticker.tickCount % 100 === 0) {
  const prompt = buildEvolutionPrompt({ dataDir, maxDecisions: 50 });
  const response = await llm.prompt(prompt);
  const result = parseEvolutionResult(response);
  await applyEvolution(result.suggestions, dataDir);
  // Soul/tasks auto-reload on next tick
}
```

### 6. Shutdown

```typescript
await game.dispose();
heartbeat.stop();
```

- Stops tick loop
- Aborts any in-flight agent processing
- Cleans up resources

---

## Decision-Making System

### Prompt Flow

1. **System Prompt** (loaded once, reloaded on soul/task changes):
   - Soul (identity, personality, strategic philosophy)
   - Task lists (combat, economy, exploration, priorities)

2. **Tick Prompt** (every tick):
   - Current world state snapshot (tick, entities, resources)
   - Instructions to observe, plan, and act

3. **Heartbeat Prompt** (scheduled jobs):
   - Job-specific instructions
   - Mode enforcement (observe vs. act)

### Tool Execution Flow

```
┌──────────────┐
│ Agent Prompt │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ observe_game     │──▶ Fetch world state
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ list_actions     │──▶ Look up action catalog
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ simulate_action  │──▶ Dry-run validation
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ execute_action   │──▶ On-chain transaction
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ write(tasks/...) │──▶ Update task priorities
└──────────────────┘
```

### Action Validation

When `actionDefs` are provided:

1. **Type Validation**: `execute_action` and `simulate_action` have enum constraints
2. **Parameter Discovery**: Agent calls `list_actions` to look up required params
3. **Simulation First**: Agent can dry-run before executing
4. **Error Handling**: Action failures are returned in tool response, not thrown

---

## Tools System

### Tool Categories

1. **Game Tools** (always included):
   - `observe_game`, `execute_action`, `simulate_action`
   - `list_actions` (when `actionDefs` provided)

2. **File Tools** (when `includeDataTools: true`):
   - `read`, `write` (scoped to dataDir)

3. **Config Tools** (when `runtimeConfigManager` provided):
   - `get_agent_config`, `set_agent_config`

4. **Extra Tools** (custom):
   - Provided via `extraTools` option

### Adding Custom Tools

```typescript
const customTool: AgentTool = {
  name: "my_tool",
  label: "My Tool",
  description: "Does something custom",
  parameters: Type.Object({
    param1: Type.String({ description: "A parameter" }),
  }),
  async execute(_toolCallId, params) {
    // Implementation
    return {
      content: [{ type: "text", text: "Result" }],
      details: {
        /* metadata */
      },
    };
  },
};

const game = createGameAgent({
  // ...
  extraTools: [customTool],
});
```

### Tool Response Logging

All game tool responses are logged to `{dataDir}/debug-tool-responses.log` for debugging:

```
[2025-01-15T10:30:00.000Z] observe_game()
{ "tick": 123, "entities": [...], ... }

[2025-01-15T10:30:05.000Z] execute_action({"actionType":"move","params":{...}})
{ "success": true, "txHash": "0x..." }
```

---

## Template System

The package includes starter templates in `templates/`:

### `templates/soul.md`

Default agent personality with balanced traits. Emphasizes:

- Information gathering before committing
- Economic advantage as foundation
- Avoiding fair fights
- Adaptability based on observations

### `templates/tasks/`

Pre-built task list templates:

- **`priorities.md`** — High-level priority rankings
- **`combat.md`** — Military planning, unit composition, engagements
- **`economy.md`** — Resource gathering, worker management, expansions
- **`exploration.md`** — Scouting, map awareness, fog of war
- **`social.md`** — Diplomacy, alliances, negotiations
- **`reflection.md`** — Agent self-reflection and learning

### `templates/skills/`

Reusable strategic patterns:

- **`early-game-opening/SKILL.md`** — Standard opening (workers → scout → expand)
- **`defending-a-rush/SKILL.md`** — Early aggression defense

**Skill Format:**

```markdown
---
name: skill-name
description: When and why to use this skill
---

# Skill Name

## When To Use

- Condition 1
- Condition 2

## Build Order / Strategy

### Phase 1: ...

...

## Transition Points

- When to switch to another skill

## Common Mistakes

- Anti-patterns to avoid
```

### Using Templates

```bash
# Copy templates to agent data directory
cp -r packages/game-agent/templates/* /path/to/agent-data/
```

Agent can then read skills with:

```typescript
// Agent calls: read("skills/early-game-opening/SKILL.md")
```

---

## Integration Guide

### Minimal Example

```typescript
import { createGameAgent } from "@bibliothecadao/game-agent";
import type { GameAdapter, WorldState, GameAction } from "@bibliothecadao/game-agent";
import { getModel } from "@mariozechner/pi-ai";

// 1. Implement GameAdapter for your game
class MyGameAdapter implements GameAdapter {
  async getWorldState(): Promise<WorldState> {
    // Fetch game state from your game
    return {
      tick: this.currentTick,
      timestamp: Date.now(),
      entities: await this.fetchEntities(),
      resources: new Map([
        ["gold", 1000],
        ["wood", 500],
      ]),
    };
  }

  async executeAction(action: GameAction) {
    // Execute action on chain
    const tx = await this.gameContract.execute(action.type, action.params);
    return { success: true, txHash: tx.hash };
  }

  async simulateAction(action: GameAction) {
    // Dry-run simulation
    return {
      success: true,
      outcome: {
        /* predicted result */
      },
    };
  }
}

// 2. Create agent
const adapter = new MyGameAdapter();
const model = getModel("anthropic", "claude-sonnet-4-5-20250929");

const game = createGameAgent({
  adapter,
  dataDir: "./agent-data",
  model,
  tickIntervalMs: 60_000,
});

// 3. Start tick loop
game.ticker.start();

// 4. Cleanup on exit
process.on("SIGINT", async () => {
  await game.dispose();
  process.exit(0);
});
```

### Full Example (with Action Definitions, Runtime Config, Heartbeat)

See `client/apps/onchain-agent/src/index.ts` for complete production integration:

1. **Action Registry**: Define all game actions with parameter schemas
2. **Runtime Config Manager**: Enable live config updates
3. **Custom Tick Prompt**: Format game-specific state summaries
4. **Heartbeat Scheduling**: Load and execute HEARTBEAT.md jobs
5. **TUI Integration**: Display agent state and logs in terminal UI

---

## Dependencies

### Core Dependencies

- **`@mariozechner/pi-agent-core`** (^0.52.7) Base Agent class, tool system, streaming

- **`@mariozechner/pi-ai`** (^0.52.7) LLM model abstraction, message types

- **`@mariozechner/pi-coding-agent`** (^0.52.7) File tools (read/write), coding utilities

- **`@sinclair/typebox`** (^0.34.41) Runtime type validation for tool parameters

- **`yaml`** (^2.3.0) YAML parsing for HEARTBEAT.md and frontmatter

### Integration Example: Eternum

The `onchain-agent` app (`client/apps/onchain-agent`) integrates game-agent with Eternum:

**Key Files:**

- **`src/adapter/eternum-adapter.ts`** — Implements `GameAdapter<EternumWorldState>`
- **`src/adapter/world-state.ts`** — Builds EternumWorldState from client queries
- **`src/adapter/action-registry.ts`** — Defines all Eternum actions (pillage, attack, transfer, explore, etc.)
- **`src/adapter/simulation.ts`** — Dry-run simulation for actions
- **`src/index.ts`** — Main entry point, creates agent with runtime config manager

**EternumGameAdapter:**

```typescript
class EternumGameAdapter implements GameAdapter<EternumWorldState> {
  constructor(
    private client: EternumClient,
    private signer: Account,
    private accountAddress: string,
  ) {}

  async getWorldState(): Promise<EternumWorldState> {
    return buildWorldState(this.client, this.accountAddress);
  }

  async executeAction(action: GameAction): Promise<ActionResult> {
    return executeAction(this.client, this.signer, action);
  }

  async simulateAction(action: GameAction): Promise<SimulationResult> {
    return simulateAction(action);
  }
}
```

**Action Definitions Example:**

```typescript
const actionDefs: ActionDefinition[] = [
  {
    type: "pillage",
    description: "Pillage a structure to steal resources",
    params: [
      { name: "armyEntityId", type: "bigint", description: "Army entity ID" },
      { name: "structureEntityId", type: "bigint", description: "Target structure ID" },
    ],
  },
  // ... more actions
];
```

---

## Summary

The `game-agent` package provides a complete framework for autonomous game-playing agents:

- **Game-agnostic**: Adapter pattern supports any onchain game
- **LLM-powered**: Uses tool-calling for game interaction
- **Self-evolving**: Evolution system enables strategic learning
- **Personality-driven**: Soul files define agent behavior
- **Production-ready**: Runtime config, heartbeat scheduling, decision logging
- **Extensible**: Custom tools, action definitions, formatters

For implementation examples, see:

- **Package tests**: `packages/game-agent/test/game-agent.test.ts`
- **Eternum integration**: `client/apps/onchain-agent/src/`
