# Implementation Plan: Fix Agent Action Execution

## Problem Statement

The onchain agent fails to execute actions correctly due to two root causes:

1. **Untyped tool schema**: `execute_action` accepts `actionType: string, params: Record<string, unknown>`. The LLM has zero information about what parameters each action requires (names, types, required vs optional). It guesses param names and gets them wrong.

2. **Insufficient world state**: `buildWorldState()` only calls `player()`, `market()`, `leaderboard()`, and `mapArea()`. The agent never sees realm details (buildings, guards, resources per structure), explorer details (troop composition, carried resources), hyperstructure progress, bank pools/prices, or game events. Without this data, even if param names were correct, the agent lacks the entity IDs and context needed to construct valid params.

---

## Framework Findings (pi-agent-core / pi-mono)

Research into the `@mariozechner/pi-agent-core` framework via Context7 (`/badlogic/pi-mono`) revealed capabilities that significantly affect the design decision:

### 1. `StringEnum` for Constrained String Params

The framework provides `StringEnum(["a", "b", "c"])` from `@mariozechner/pi-ai` for constrained string parameters. This is the idiomatic way to define enum-like string params — **not** `Type.String()` with descriptions. `StringEnum` is required for Google API compatibility (regular `Type.Enum` generates `anyOf/const` patterns that break).

**Impact**: The `execute_action` tool's `actionType` should use `StringEnum` with all valid action names, not a free-text `Type.String()`. This constrains the LLM to only valid action names — free correctness. Same applies to any view type selector.

### 2. Gmail Tool Precedent — Typed Dispatch Pattern

The framework's own documentation demonstrates a single-tool dispatch pattern in the Gmail example:

```typescript
const tool: MomCustomTool = {
  name: "gmail",
  parameters: Type.Object({
    action: StringEnum(["search", "read", "send"]),
    query: Type.Optional(Type.String({ description: "Search query" })),
    messageId: Type.Optional(Type.String({ description: "Message ID to read" })),
    to: Type.Optional(Type.String({ description: "Recipient email" })),
    // ... typed optional fields per action
  }),
};
```

This keeps a **single tool** but uses **typed optional params per action** — not a generic `Record<string, unknown>`. The `switch` on `action` dispatches to different logic. This is exactly the pattern `execute_action` should follow.

### 3. AJV Auto-Validation

The framework automatically validates tool params against TypeBox schemas using AJV before the `execute` function runs. With the current `Record<string, unknown>`, this validation is useless — anything passes. With typed schemas, the framework would **reject malformed params before they reach the handler**. This is free correctness the current design throws away.

### 4. `agent.setTools()` for Dynamic Tool Sets

Tools can be swapped at runtime via `agent.setTools([...])`. This means:
- Tools could be adjusted per game phase (early game = economy tools, late game = combat tools)
- The tool set could start minimal and grow as the agent learns
- No need to commit to one static set forever

### 5. No Documented Tool Count Limit

The framework has no hard limit on tool count. The concern about "35+ tools degrading LLM accuracy" is an LLM-level consideration, not a framework constraint.

---

## Solution Design

### Approach: Option A -- Rich Tool Description (NEEDS REVISION)

The original analysis chose Option A (rich description, untyped params) over Options B and C. However, the framework findings above challenge this decision:

**Original Option A reasoning and its weaknesses:**

- "Rich description is simplest" — TRUE, but `StringEnum` + typed optional fields is only marginally more complex while providing **schema-level correctness** instead of hoping the LLM reads the description correctly.
- "Description text is cheaper than schema definitions" — PARTIALLY TRUE, but the token difference is small, and typed schemas eliminate failed-action retries which waste far more tokens.
- "The action-registry already validates and coerces params" — TRUE, but validation happens **after** the LLM sends wrong params, resulting in runtime errors. AJV validation with typed schemas catches errors **before** the handler runs.

**What should change:**

1. **`actionType` MUST use `StringEnum`** with all valid action names — this is non-negotiable. It's the framework-idiomatic pattern and prevents the LLM from inventing action names.
2. **The description-only approach for params should be reconsidered.** The Gmail pattern shows how to have typed optional fields per action in a single tool. This could work for `execute_action` — a flat `Type.Object` with all possible param names as `Type.Optional`, plus a rich description explaining which params each action needs.
3. **Alternatively, Option C (category-grouped tools, ~8 tools)** becomes more viable with `StringEnum` for action dispatch within each category. 8 tools is well within LLM comfort.

### OPEN QUESTION: Which approach to finalize?

This plan needs a decision between:

- **Option A+** (revised): Single `execute_action` tool with `StringEnum` actionType + typed optional params + rich description. Closest to Gmail pattern.
- **Option C+** (revised): ~8 category tools (troop_action, combat_action, resource_action, etc.), each with `StringEnum` for its action names + typed params for that category. Cleanest schemas but more tools.
- **Option A (original)**: Keep `Record<string, unknown>` params but add rich description. Simplest change but leaves free correctness on the table.

**The decision on this approach should be made before implementation begins.**

### Observation Tool: `observe_detail` vs Enriched `observe_game`

The original plan proposes a new `observe_detail` tool. This should also be challenged:

**Arguments for enriching `observe_game` instead:**
- Fewer tools = fewer LLM decisions = fewer failure points
- The agent may not know it needs detail before it has the detail (chicken-and-egg)
- Reduces observe → observe_detail → execute to observe → execute (fewer round trips)
- If the combined data fits in reasonable token budget, the extra tool is unnecessary complexity

**Arguments for keeping `observe_detail` separate:**
- Full realm/explorer/bank data for all entities could be very large
- Not all data is needed every tick — targeted queries save tokens on average
- Follows the framework's dispatch pattern (see Gmail tool)

**This decision should be informed by measuring actual response sizes** from the ViewClient methods for a typical game state.

---

## Part 1: Tool Schema Solution

### 1.0 CRITICAL: Use `StringEnum` for `actionType` (Framework Finding)

**File: `packages/game-agent/src/tools.ts`**

Regardless of which approach is chosen for params, the `actionType` field MUST be changed from `Type.String()` to `StringEnum()`. This is the framework-idiomatic pattern and provides free validation:

```typescript
import { StringEnum } from "@mariozechner/pi-ai";

const actionSchema = Type.Object({
  actionType: StringEnum([
    "send_resources", "pickup_resources", "claim_arrivals",
    "create_explorer", "add_to_explorer", "delete_explorer",
    "move_explorer", "travel_explorer", "explore",
    "add_guard", "delete_guard",
    "swap_explorer_to_explorer", "swap_explorer_to_guard", "swap_guard_to_explorer",
    "attack_explorer", "attack_guard", "guard_attack_explorer", "raid",
    "create_order", "accept_order", "cancel_order",
    "create_building", "destroy_building", "pause_production", "resume_production",
    "buy_resources", "sell_resources", "add_liquidity", "remove_liquidity",
    "create_guild", "join_guild", "leave_guild", "update_whitelist",
    "upgrade_realm", "contribute_hyperstructure",
  ] as const),
  params: Type.Optional(Type.Record(Type.String(), Type.Unknown(), { description: "Parameters for the action" })),
});
```

This change alone eliminates the LLM inventing non-existent action names. AJV will reject any actionType not in the list before the handler runs.

### 1.1 Enhance `execute_action` Tool Description

**File: `packages/game-agent/src/tools.ts`**

Replace the current bare description with a comprehensive action reference embedded in the tool description string. The description will contain a compact reference table of every action and its required params.

```typescript
const EXECUTE_ACTION_DESCRIPTION = `Execute a game action on chain. Returns success status and transaction hash.

## Action Reference

### Resources
- send_resources: { senderEntityId: number, recipientEntityId: number, resources: [{resourceType: number, amount: number}] }
- pickup_resources: { recipientEntityId: number, ownerEntityId: number, resources: [{resourceType: number, amount: number}] }
- claim_arrivals: { structureId: number, day: number, slot: number, resourceCount: number }

### Troops
- create_explorer: { forStructureId: number, category: number, tier: number, amount: number, spawnDirection: number }
  - category: 0=Paladin, 1=Knight, 2=Crossbowman | tier: 1-3 | spawnDirection: 0-5 (hex dir)
- add_to_explorer: { toExplorerId: number, amount: number, homeDirection: number }
- delete_explorer: { explorerId: number }
- move_explorer: { explorerId: number, directions: number[], explore: boolean }
  - directions: array of hex directions (0=East, 1=NE, 2=NW, 3=West, 4=SW, 5=SE)
- travel_explorer: { explorerId: number, directions: number[] }
- explore: { explorerId: number, directions: number[] }
- add_guard: { forStructureId: number, slot: number, category: number, tier: number, amount: number }
- delete_guard: { forStructureId: number, slot: number }
- swap_explorer_to_explorer: { fromExplorerId: number, toExplorerId: number, toExplorerDirection: number, count: number }
- swap_explorer_to_guard: { fromExplorerId: number, toStructureId: number, toStructureDirection: number, toGuardSlot: number, count: number }
- swap_guard_to_explorer: { fromStructureId: number, fromGuardSlot: number, toExplorerId: number, toExplorerDirection: number, count: number }

### Combat
- attack_explorer: { aggressorId: number, defenderId: number, defenderDirection: number, stealResources: [{resourceId: number, amount: number}] }
- attack_guard: { explorerId: number, structureId: number, structureDirection: number }
- guard_attack_explorer: { structureId: number, structureGuardSlot: number, explorerId: number, explorerDirection: number }
- raid: { explorerId: number, structureId: number, structureDirection: number, stealResources: [{resourceId: number, amount: number}] }

### Trade
- create_order: { makerId: number, takerId: number, makerGivesResourceType: number, takerPaysResourceType: number, makerGivesMinResourceAmount: number, makerGivesMaxCount: number, takerPaysMinResourceAmount: number, expiresAt: number }
- accept_order: { takerId: number, tradeId: number, takerBuysCount: number }
- cancel_order: { tradeId: number }

### Buildings
- create_building: { entityId: number, directions: number[], buildingCategory: number, useSimple: boolean }
  - buildingCategory: 0=None, 1=Castle, 2=Resource, 3=Farm, 4=FishingVillage, 5=Barracks, 6=Market, 7=ArcheryRange, 8=Stable, 9=TradingPost, 10=WorkersHut, 11=WatchTower, 12=Walls, 13=Storehouse
- destroy_building: { entityId: number, buildingCoord: {x: number, y: number} }
- pause_production: { entityId: number, buildingCoord: {x: number, y: number} }
- resume_production: { entityId: number, buildingCoord: {x: number, y: number} }

### Bank
- buy_resources: { bankEntityId: number, entityId: number, resourceType: number, amount: number }
- sell_resources: { bankEntityId: number, entityId: number, resourceType: number, amount: number }
- add_liquidity: { bankEntityId: number, entityId: number, calls: [{resourceType: number, resourceAmount: number, lordsAmount: number}] }
- remove_liquidity: { bankEntityId: number, entityId: number, resourceType: number, shares: number }

### Guild
- create_guild: { isPublic: boolean, guildName: string }
- join_guild: { guildEntityId: number }
- leave_guild: {} (no params)
- update_whitelist: { address: string, whitelist: boolean }

### Realm & Hyperstructure
- upgrade_realm: { realmEntityId: number }
- contribute_hyperstructure: { hyperstructureEntityId: number, contributorEntityId: number, contributions: number[] }
`;
```

### 1.2 Update `simulate_action` Description Similarly

Add the same reference (or a shorter version noting "same params as execute_action") to the simulate tool.

### 1.3 Update `soul.md` Action Reference

**File: `client/apps/onchain-agent/data/soul.md`**

Replace the flat action name list in the "Available Actions" section with a structured reference. This does NOT need to duplicate the full param specs (those are in the tool description), but should provide strategic context:

```markdown
## Available Actions

You act through `execute_action` with an `actionType` string and `params` object.
See the execute_action tool description for exact param signatures.

### Quick Reference
| Category | Actions | When to Use |
|----------|---------|-------------|
| Resources | send_resources, pickup_resources, claim_arrivals | Resource management between structures |
| Troops | create_explorer, add_to_explorer, delete_explorer, add_guard, delete_guard | Army creation and management |
| Movement | move_explorer, travel_explorer, explore | Map movement and exploration |
| Swaps | swap_explorer_to_explorer, swap_explorer_to_guard, swap_guard_to_explorer | Troop reassignment |
| Combat | attack_explorer, attack_guard, guard_attack_explorer, raid | Military engagements |
| Trade | create_order, accept_order, cancel_order | Player-to-player trading |
| Buildings | create_building, destroy_building, pause_production, resume_production | Structure development |
| Bank | buy_resources, sell_resources, add_liquidity, remove_liquidity | AMM market trades |
| Guild | create_guild, join_guild, leave_guild, update_whitelist | Social/alliance management |
| Realm | upgrade_realm | Level up realm |
| Hyperstructure | contribute_hyperstructure | End-game objective |

### Key Entity IDs
- Use `observe_game` to find your structure entityIds, explorer entityIds, and nearby entity IDs
- Use `observe_detail` with type "realm" or "explorer" to get specific entity details
- Structure IDs from observe_game → player.structures[].entityId
- Explorer IDs from observe_game → player.armies[].explorerId
```

---

## Part 2: View Layer Expansion

### Current View Coverage Gap Analysis

The ViewClient has 9 methods. `buildWorldState()` uses only 4 (player, market, leaderboard, mapArea).
The 5 unused methods (realm, explorer, hyperstructure, bank, events) block or degrade 23 of the 35 registered actions:

**Blocked actions by missing view (ranked by impact):**

1. **realm() -- HIGHEST IMPACT, unblocks 10 actions**
   - Fully blocks: `add_guard`, `delete_guard`, `swap_explorer_to_guard`, `swap_guard_to_explorer`, `guard_attack_explorer`, `destroy_building`, `pause_production`, `resume_production`, `claim_arrivals`
   - Partially blocks: `create_building` (no building layout info)
   - Provides: guard slot details (category/tier/count per slot), buildings list, per-realm resources, associated explorers, incoming arrivals

2. **explorer() -- HIGH IMPACT, improves 8 actions**
   - Partially blocks: `swap_explorer_to_explorer`, `swap_explorer_to_guard`, `swap_guard_to_explorer`
   - Improves quality: `attack_explorer`, `raid`, `move_explorer`, `travel_explorer`, `explore`
   - Provides: per-explorer troop composition, carried resources, stamina, battle status, owner

3. **events() -- HIGH IMPACT for decision quality**
   - Blocks 0 actions directly, but critical for situational awareness
   - Provides: game activity log (BattleStory, ExplorerMoveStory, ResourceTransferStory, ProductionStory, BuildingPlacementStory, GuardAddStory, etc.)

4. **bank() -- MEDIUM IMPACT, unblocks 4 actions**
   - Fully blocks: `buy_resources`, `sell_resources`, `add_liquidity`, `remove_liquidity` (agent cannot discover bankEntityId without this)
   - Provides: bank entity ID, position, recent swaps (note: pools[] currently empty in implementation)

5. **hyperstructure() -- LOW-MEDIUM IMPACT, unblocks 1 action**
   - Fully blocks: `contribute_hyperstructure` (agent cannot discover hyperstructure entity IDs)
   - Provides: progress %, completion status, guard state

**Additional data gaps in currently-used views:**
- `market()`: pools[], openOrders[], playerLpPositions[] always return empty -- trade order management (accept_order, cancel_order) impossible even with the view
- `player()`: armies have entityId/explorerId but no troop category/tier/count detail
- `mapArea()`: armies have no troop composition, structures have no guard detail

### 2.1 New `observe_detail` Tool

**File: `packages/game-agent/src/tools.ts`**

Add a new tool that exposes targeted ViewClient queries the agent can call on demand.

```typescript
import { StringEnum } from "@mariozechner/pi-ai";

const observeDetailSchema = Type.Object({
  type: StringEnum(["realm", "explorer", "hyperstructure", "bank", "events"] as const, {
    description: `View type to query:
- 'realm': Guard slots, buildings, resources, productions, explorers, arrivals for a structure
- 'explorer': Troop composition, position, stamina, carried resources, battle status
- 'hyperstructure': Progress, contributions, guard state, completion status
- 'bank': Bank position, pool state, recent swaps
- 'events': Recent game activity log (battles, moves, trades, building placements)`
  }),
  entityId: Type.Optional(Type.Number({
    description: "Entity ID to query (required for realm, explorer, hyperstructure, bank)"
  })),
  limit: Type.Optional(Type.Number({
    description: "Max results for events view (default 20)"
  })),
});
```

**NOTE**: Uses `StringEnum` (not `Type.String()`) per framework best practices. AJV will reject invalid view types before the handler runs.

The tool calls a new adapter method `getDetailView(type, opts)` that dispatches to the appropriate ViewClient method:

| type | ViewClient method | Returns | Key Data for Actions |
|------|-------------------|---------|---------------------|
| `realm` | `client.view.realm(entityId)` | RealmView | guard.slots[] (slot/category/tier/count), buildings[], resources[], explorers[], incomingArrivals[] |
| `explorer` | `client.view.explorer(entityId)` | ExplorerView | troops (GuardState), carriedResources[], position, stamina, isInBattle |
| `hyperstructure` | `client.view.hyperstructure(entityId)` | HyperstructureView | progress, isComplete, guard, contributions[] |
| `bank` | `client.view.bank(entityId)` | BankView | entityId (needed for all bank actions), position, recentSwaps[] |
| `events` | `client.view.events({limit})` | EventsView | events[] (eventType, timestamp, data, involvedEntities), totalCount |

**Expected agent workflow with observe_detail:**
1. `observe_game` -> get structure IDs, explorer IDs, overall state
2. `observe_detail(type="realm", entityId=X)` -> see guard slots, buildings before managing defenses
3. `observe_detail(type="explorer", entityId=Y)` -> check troop strength before combat
4. `execute_action(actionType="add_guard", params={forStructureId: X, slot: 0, ...})` -> now has correct slot number

### 2.2 Enhance `buildWorldState()` Output

**File: `client/apps/onchain-agent/src/adapter/world-state.ts`**

The current world state flattens armies into a minimal shape that loses `explorerId`. Enhance to include:

1. **Explorer IDs in army entities**: Ensure `explorerId` is always present on army entities (currently the `armyEntities` map reads `a.explorer_id` but stores it nowhere on EternumEntity -- it only sets `entityId`)
2. **Per-structure guard strength**: Add `guardStrength` field to structure entities using the existing `guardStrength` field from `PlayerStructureSummary` (already returned by `player()` view)
3. **Per-structure resource count**: Add `resourceCount` from `PlayerStructureSummary`

Update `EternumEntity` interface to include:
```typescript
export interface EternumEntity {
  // ... existing fields ...
  explorerId?: number;      // NEW: explorer ID (for army type entities)
  guardStrength?: number;   // NEW: total guard strength (for structure type entities)
  resourceCount?: number;   // NEW: number of resource types held (for structure type entities)
}
```

These are small additions to the existing `buildWorldState()` -- not full realm views. The full detail comes from `observe_detail`.

### 2.3 GameAdapter Interface Extension

**File: `packages/game-agent/src/types.ts`**

Add an optional `getDetailView` method to `GameAdapter`:

```typescript
export interface GameAdapter<TState extends WorldState = WorldState> {
  getWorldState(): Promise<TState>;
  executeAction(action: GameAction): Promise<ActionResult>;
  simulateAction(action: GameAction): Promise<SimulationResult>;
  getDetailView?(type: string, opts?: Record<string, unknown>): Promise<unknown>;
  subscribe?(callback: (state: TState) => void): () => void;
}
```

### 2.4 EternumGameAdapter Implementation

**File: `client/apps/onchain-agent/src/adapter/eternum-adapter.ts`**

Implement `getDetailView` to dispatch to the appropriate ViewClient method:

```typescript
async getDetailView(type: string, opts?: Record<string, unknown>): Promise<unknown> {
  const entityId = Number(opts?.entityId ?? 0);
  switch (type) {
    case "realm": return this.client.view.realm(entityId);
    case "explorer": return this.client.view.explorer(entityId);
    case "hyperstructure": return this.client.view.hyperstructure(entityId);
    case "bank": return this.client.view.bank(entityId);
    case "events": return this.client.view.events({ limit: Number(opts?.limit ?? 20) });
    default: return { error: `Unknown view type: ${type}` };
  }
}
```

---

## Part 3: Implementation Steps (Ordered)

### Step 0: Switch `actionType` to `StringEnum` (CRITICAL)
- **File**: `packages/game-agent/src/tools.ts`
- **Change**: Replace `Type.String()` with `StringEnum([...all action names...])` for `actionType` in both `actionSchema` and `simulateSchema`
- **Risk**: Low -- only constrains valid values, existing valid calls unaffected
- **Test**: Verify AJV rejects invalid action names; verify all registered actions are in the enum
- **Dependency**: Must import `StringEnum` from `@mariozechner/pi-ai`

### Step 1: Enhance execute_action tool description
- **File**: `packages/game-agent/src/tools.ts`
- **Change**: Replace `description` string in `createExecuteActionTool` with the comprehensive action reference
- **Risk**: Low -- only changes a string
- **Test**: Verify tool description appears in agent system prompt

### Step 2: Enhance simulate_action tool description
- **File**: `packages/game-agent/src/tools.ts`
- **Change**: Add note to simulate_action description referencing execute_action params
- **Risk**: Low

### Step 3: Add `getDetailView` to GameAdapter interface
- **File**: `packages/game-agent/src/types.ts`
- **Change**: Add optional method to interface
- **Risk**: Low -- optional method, no breaking change

### Step 4: Implement `getDetailView` in EternumGameAdapter
- **File**: `client/apps/onchain-agent/src/adapter/eternum-adapter.ts`
- **Change**: Add method that dispatches to ViewClient
- **Risk**: Low -- additive only

### Step 5: Create `observe_detail` tool
- **File**: `packages/game-agent/src/tools.ts`
- **Change**: Add `createObserveDetailTool()` function, include in `createGameTools()` return
- **Risk**: Low -- new tool, existing tools unchanged

### Step 6: Enhance `buildWorldState()` entity output
- **File**: `client/apps/onchain-agent/src/adapter/world-state.ts`
- **Change**: Add `explorerId` to army entities, add `hasGuard`/`guardStrength` to structure entities
- **Risk**: Low -- additive fields

### Step 7: Update `soul.md` action reference
- **File**: `client/apps/onchain-agent/data/soul.md`
- **Change**: Replace flat action list with structured reference table
- **Risk**: Low -- documentation only

### Step 8: Add tests
- **Files**: `client/apps/onchain-agent/test/adapter/` and `client/apps/onchain-agent/test/e2e/`
- **Changes**:
  - Test that `getDetailView` dispatches correctly
  - Test that `observe_detail` tool returns expected shapes
  - Test that enriched world state includes explorer IDs and guard info
- **Risk**: Low

### Step 9: Update CLAUDE.md
- **File**: `client/apps/onchain-agent/CLAUDE.md`
- **Change**: Document new `observe_detail` tool and updated action reference pattern
- **Risk**: Low

---

## Files Modified (Summary)

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/game-agent/src/tools.ts` | MODIFY | Enhanced descriptions + new observe_detail tool |
| `packages/game-agent/src/types.ts` | MODIFY | Add optional getDetailView to GameAdapter |
| `client/apps/onchain-agent/src/adapter/eternum-adapter.ts` | MODIFY | Implement getDetailView |
| `client/apps/onchain-agent/src/adapter/world-state.ts` | MODIFY | Richer entity output |
| `client/apps/onchain-agent/data/soul.md` | MODIFY | Structured action reference |
| `client/apps/onchain-agent/CLAUDE.md` | MODIFY | Document new tool |

No new files needed. No dependency changes. No breaking changes to existing interfaces.

---

## Token Budget Analysis

- Current `execute_action` description: ~20 tokens
- Proposed description with full reference: ~800 tokens
- New `observe_detail` tool schema + description: ~100 tokens
- Updated `soul.md` reference table: ~300 tokens (replaces ~100 tokens of flat list)
- **Net increase**: ~1,100 tokens per request

This is well within budget. A typical LLM context window is 128K+ tokens. The action reference pays for itself by eliminating failed action attempts (each retry wastes ~500-2000 tokens of error handling and re-prompting).

---

## What This Does NOT Do (Intentional Scope Limits)

1. **No param name fallback removal (FLAGGED FOR REVIEW)**: The coercion helpers in action-registry.ts (`structureId()`, `troopFields()`) still accept multiple param name variants. **User directive states: "dont use fallbacks. ever. seriously."** If `StringEnum` + typed schemas give the LLM correct param names, fallbacks become dead code that masks bugs. Consider removing fallbacks as a follow-up step once the new schema is proven to work.

2. **No session policy expansion**: The hardcoded session policies in `controller-session.ts` are a separate issue. They gate which on-chain entrypoints the agent can call, but the current 25 entrypoints already cover all 35 registered actions (actions map to a smaller set of contract entrypoints).

3. **No new actions**: The plan focuses on making existing actions work correctly, not adding new action types.

4. **No real-time subscriptions**: The `subscribe()` method on GameAdapter remains unimplemented. The tick-based polling model is sufficient for the current agent loop.

5. **No fix for empty market data**: The `market()` view returns empty arrays for `pools`, `openOrders`, and `playerLpPositions` due to incomplete SQL queries in the ViewClient. This means `accept_order` and `cancel_order` actions remain effectively unusable even after this plan. This is a ViewClient/SQL bug that should be tracked separately.

6. **No guild discovery**: There is no ViewClient method to list guilds. `join_guild` requires a `guildEntityId` the agent cannot currently discover. This would require a new SQL query and ViewClient method.

---

## Open Questions (Must Resolve Before Implementation)

1. **Params typing approach**: Should `execute_action` params remain `Record<string, unknown>` (Option A, description-only) or switch to typed optional fields per action (Gmail pattern)? The Gmail pattern gives AJV validation but creates a large flat schema. See "Solution Design" section above.

2. **`observe_detail` vs enriched `observe_game`**: Should we add a new tool, or just make `buildWorldState()` call the missing ViewClient methods? Measure actual response sizes from `realm()`, `explorer()`, etc. for a typical game state to decide.

3. **Fallback removal timeline**: When should the param name fallbacks in action-registry.ts be removed? After the new schema is deployed and proven, or as part of this implementation?

---

## Known Remaining Gaps After Implementation

| Action | Remaining Issue | Root Cause |
|--------|----------------|------------|
| `accept_order` | Cannot discover tradeIds | market().openOrders always empty |
| `cancel_order` | Cannot discover tradeIds | market().openOrders always empty |
| `join_guild` | Cannot discover guildEntityIds | No guild list view exists |
| `update_whitelist` | Cannot discover member addresses | No guild detail view exists |
| `buy/sell_resources` | Pool prices unknown | bank().pools always empty |
