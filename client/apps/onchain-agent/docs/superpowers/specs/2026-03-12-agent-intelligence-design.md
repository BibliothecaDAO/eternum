# Agent Intelligence Improvements

## Summary

Four improvements to the onchain-agent's decision loop: inject fresh game state into every LLM call via `transformContext`, steer the agent mid-turn on defensive threats, track tool failures to improve model behavior, and use token-aware compaction.

## 1. Game State Injection via `transformContext`

### What

Every LLM call, append a structured game state block to the system prompt. The block is rebuilt from live data — no accumulation, just replaced each time.

### Data Sources

- **`mapCtx.snapshot`** — owned armies (position, troop type/tier/count, stamina), owned structures (position, level, category)
- **Shared `automationStatus`** — written by the automation loop each tick, read by `transformContext`. Contains per-realm: build order progress, last action, errors, key resource balances.

### Format

Appended to the system prompt as an XML block:

```xml
<game_state>
<structures>
  Realm 165 | lv3 | Empire | 59/60 slots | Wheat: 105K, Essence: 5.6K
  Realm 170 | lv3 | Empire | building KnightT3 | Wheat: 77K, Essence: 2.3K
  Village 756 | lv0 | pending upgrade
</structures>
<armies>
  K 21:12 | 1,735 Knight T1 | stamina 120/120 (6 moves)
  P 22:15 | 785 Paladin T1 | stamina 40/120 (2 moves)
  ...
</armies>
<automation>
  Realm 175: building 15 queued (WheatFarm, WoodMill, ...)
  Production: Knight T2 running (30% budget)
  Errors: none
</automation>
<tool_errors>
  Last 5 turns: move_army failed 3x (No army at position)
</tool_errors>
</game_state>
```

### Implementation

- New file: `src/entry/game-state.ts` — `buildGameStateBlock(mapCtx, automationStatus, toolErrors): string`
- Automation loop writes to a shared `AutomationStatus` object (Map of realm ID → status)
- `transformContext` in `main.ts` calls `buildGameStateBlock()` and appends to system prompt
- No new tools needed — model sees everything automatically

### What This Eliminates

- Agent no longer needs `inspect_tile` at the start of every turn to learn its own state
- Agent no longer needs `view_map` to refresh — map is in the tick prompt, state is in the system prompt
- Saves 2-4 tool calls (and thus 2-4 LLM round-trips) per turn

## 2. Defensive Steering

### What

When the map loop detects an enemy army within 1 hex of any owned structure, call `agent.steer()` to interrupt the current turn with a defensive alert.

### Detection

After each map refresh (every 10s):
1. Collect all owned structure positions from `mapCtx.snapshot`
2. For each owned structure, check all 6 neighbor hexes
3. If a neighbor is occupied by a non-owned army → trigger alert
4. Deduplicate: don't re-alert for the same enemy in the same position within 60s

### Steering Message

```
DEFENSIVE ALERT: Enemy army detected at {row}:{col} (adjacent to your {structureType} at {sRow}:{sCol}).
Assess the threat level and respond — defend, reinforce, or evacuate resources.
```

### Implementation

- Add `agent` reference (or a `steer` callback) to the map loop
- New function in `src/map/threat-detection.ts`: `detectThreats(snapshot, ownedStructurePositions): ThreatAlert[]`
- Track `lastAlertedThreats: Map<"x,y" → timestamp>` to avoid spam
- Wire into map loop's refresh callback

## 3. Tool Failure Tracking

### What

Track tool execution errors in a rolling window and surface them in the system prompt so the model can learn from mistakes.

### Implementation

- In `main.ts`, extend the `tool_execution_end` subscriber
- Maintain `toolErrors: Array<{ tool: string, error: string, tick: number }>` — keep last 20
- `buildGameStateBlock()` includes a summary of recent errors grouped by tool name
- Clears errors older than 10 turns

### What This Enables

The model sees patterns like "move_army keeps failing with 'No army at position'" and learns to refresh its position data before moving. Currently it just retries the same broken coordinates.

## 4. Token-Aware Compaction

### What

Replace the hardcoded 400K character threshold with a model-aware limit based on `model.contextWindow`.

### Implementation

- `MAX_CONTEXT_CHARS = model.contextWindow * 3` (rough 3 chars/token heuristic, conservative)
- `PRUNE_TARGET_CHARS = MAX_CONTEXT_CHARS * 0.5`
- Pass `model` to `pruneMessages` so it can compute thresholds
- No other changes to the compaction logic

## Architecture

```
transformContext (every LLM call)
├── Rebuild system prompt (soul + tasks)
├── Append game state block (structures, armies, automation, errors)
└── Prune messages if context exceeds model-aware threshold

Map loop (every 10s)
├── Refresh tiles, armies, structures
├── Detect threats (enemy near owned structures)
└── If threat found → agent.steer(alert)

Automation loop (every 60s)
├── Plan and execute builds/production/upgrades
└── Write AutomationStatus to shared object

Agent tick (every 60s)
├── buildTickPrompt (includes map text)
└── agent.prompt() → LLM sees fresh state via transformContext
```

## Files Changed

| File | Change |
|---|---|
| `src/entry/game-state.ts` | New — builds game state XML block |
| `src/entry/main.ts` | Wire game state into transformContext, pass model to pruneMessages, set up threat detection callback |
| `src/map/threat-detection.ts` | New — scans for enemies near structures |
| `src/map/loop.ts` | Add threat detection after refresh, accept steer callback |
| `src/automation/loop.ts` | Write to shared AutomationStatus object |
| `src/automation/status.ts` | Export AutomationStatus type + shared state |

## Non-Goals

- No new tools — the whole point is eliminating unnecessary tool calls
- No UI changes — all improvements are in the agent loop
- No changes to the automation logic itself — just surfacing its state
