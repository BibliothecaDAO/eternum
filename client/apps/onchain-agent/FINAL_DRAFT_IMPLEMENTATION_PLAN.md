# Final Draft: Fix Agent Action Execution

## Problem Statement

The onchain agent fails to execute actions correctly due to two root causes:

1. **Untyped tool schema**: `execute_action` accepts `actionType: string, params: Record<string, unknown>`. The LLM has zero information about what parameters each action requires. It guesses param names and gets them wrong every time.

2. **Insufficient world state**: `buildWorldState()` only calls 4 of 9 ViewClient methods. The agent can't see realm details, explorer troop composition, guard slots, bank info, or game events — so it lacks the entity IDs and context needed to construct valid params.

---

## Solution: Gmail-Pattern Typed Tool + Enriched World State

### Design Principles

1. **Use the framework idiomatically** — `StringEnum` for constrained strings, TypeBox for typed params, let AJV validate before handlers run
2. **Follow the Gmail tool precedent** from pi-mono docs — single tool with `StringEnum` action dispatch + typed optional params per action
3. **No param name fallbacks** — fix the root cause (give LLM correct names via schema), don't bandaid with aliases
4. **Enrich existing observation** rather than adding new tools — fewer tools = fewer LLM decisions = fewer failure points

### Why Gmail Pattern (Not Other Options)

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Option A: Description-only** | Simplest change | LLM reads description unreliably; AJV can't validate `Record<string, unknown>` | Leaves correctness on the table |
| **Option B: Per-action tools (35+)** | Perfect typed schemas | Tool selection degrades with 35+ tools; massive schema bloat | Too many tools |
| **Option C: Category tools (~8)** | Clean per-category schemas | Still 8 tools to choose between; union schemas are complex | Better but unnecessary |
| **Gmail pattern (chosen)** | Single tool, typed params, AJV validates types, LLM sees exact field names in schema | Large flat schema (~50 optional fields) | Best balance of correctness and simplicity |

The Gmail pattern keeps **one tool** (simple selection) with **typed optional fields** (schema-level correctness). The LLM sees every valid param name in the structured schema — not buried in a description string. AJV validates that values match their declared types before the handler runs.

---

## Part 1: Tool Schema — Gmail Pattern

### 1.1 New `execute_action` Schema

**File: `packages/game-agent/src/tools.ts`**

Replace the current untyped schema with a fully typed Gmail-pattern schema. Every param from every action appears as a `Type.Optional` field with a description noting which actions use it.

```typescript
import { StringEnum } from "@mariozechner/pi-ai";

// -- All valid action type names (from action-registry.ts) --
const ACTION_TYPES = [
  // Resources
  "send_resources", "pickup_resources", "claim_arrivals",
  // Troops
  "create_explorer", "add_to_explorer", "delete_explorer",
  "add_guard", "delete_guard",
  // Movement
  "move_explorer", "travel_explorer", "explore",
  // Troop swaps
  "swap_explorer_to_explorer", "swap_explorer_to_guard", "swap_guard_to_explorer",
  // Combat
  "attack_explorer", "attack_guard", "guard_attack_explorer", "raid",
  // Trade
  "create_order", "accept_order", "cancel_order",
  // Buildings
  "create_building", "destroy_building", "pause_production", "resume_production",
  // Bank
  "buy_resources", "sell_resources", "add_liquidity", "remove_liquidity",
  // Guild
  "create_guild", "join_guild", "leave_guild", "update_whitelist",
  // Realm & Hyperstructure
  "upgrade_realm", "contribute_hyperstructure",
] as const;

const actionSchema = Type.Object({
  actionType: StringEnum(ACTION_TYPES, {
    description: "The action to execute. See param descriptions for which params each action requires.",
  }),

  // ---- Resource params ----
  senderEntityId: Type.Optional(Type.Number({
    description: "send_resources: entity ID of the sender structure",
  })),
  recipientEntityId: Type.Optional(Type.Number({
    description: "send_resources, pickup_resources: entity ID of the recipient structure",
  })),
  ownerEntityId: Type.Optional(Type.Number({
    description: "pickup_resources: entity ID of the owner to pick up from",
  })),
  resources: Type.Optional(Type.Array(
    Type.Object({
      resourceType: Type.Number({ description: "Resource type ID" }),
      amount: Type.Number({ description: "Amount of the resource" }),
    }),
    { description: "send_resources, pickup_resources: array of resources to transfer" },
  )),
  day: Type.Optional(Type.Number({
    description: "claim_arrivals: the day to claim",
  })),
  resourceCount: Type.Optional(Type.Number({
    description: "claim_arrivals: number of resource types arriving",
  })),

  // ---- Structure / entity IDs ----
  forStructureId: Type.Optional(Type.Number({
    description: "create_explorer, add_guard, delete_guard: structure entity ID to act on",
  })),
  entityId: Type.Optional(Type.Number({
    description: "create_building, destroy_building, pause_production, resume_production, buy_resources, sell_resources, add_liquidity, remove_liquidity: entity ID of the structure",
  })),
  structureId: Type.Optional(Type.Number({
    description: "claim_arrivals, attack_guard, guard_attack_explorer, raid: structure entity ID",
  })),

  // ---- Troop params ----
  category: Type.Optional(Type.Number({
    description: "create_explorer, add_guard: troop category (0=Paladin, 1=Knight, 2=Crossbowman)",
  })),
  tier: Type.Optional(Type.Number({
    description: "create_explorer, add_guard: troop tier (1, 2, or 3)",
  })),
  amount: Type.Optional(Type.Number({
    description: "create_explorer, add_guard, add_to_explorer, buy_resources, sell_resources: quantity/amount",
  })),
  slot: Type.Optional(Type.Number({
    description: "claim_arrivals, add_guard, delete_guard: guard slot number",
  })),
  spawnDirection: Type.Optional(Type.Number({
    description: "create_explorer: hex direction to spawn (0=East, 1=NE, 2=NW, 3=West, 4=SW, 5=SE)",
  })),

  // ---- Explorer params ----
  explorerId: Type.Optional(Type.Number({
    description: "delete_explorer, move_explorer, travel_explorer, explore, attack_guard, guard_attack_explorer, raid: explorer entity ID",
  })),
  toExplorerId: Type.Optional(Type.Number({
    description: "add_to_explorer, swap_explorer_to_explorer, swap_guard_to_explorer: target explorer entity ID",
  })),
  homeDirection: Type.Optional(Type.Number({
    description: "add_to_explorer: hex direction toward home structure (0-5)",
  })),
  directions: Type.Optional(Type.Array(Type.Number(), {
    description: "move_explorer, travel_explorer, explore, create_building: array of hex directions (0=East, 1=NE, 2=NW, 3=West, 4=SW, 5=SE)",
  })),
  explore: Type.Optional(Type.Boolean({
    description: "move_explorer: whether to explore tiles along the path (true/false)",
  })),

  // ---- Swap params ----
  fromExplorerId: Type.Optional(Type.Number({
    description: "swap_explorer_to_explorer, swap_explorer_to_guard: source explorer entity ID",
  })),
  toExplorerDirection: Type.Optional(Type.Number({
    description: "swap_explorer_to_explorer, swap_guard_to_explorer: hex direction to target explorer (0-5)",
  })),
  count: Type.Optional(Type.Number({
    description: "swap_explorer_to_explorer, swap_explorer_to_guard, swap_guard_to_explorer: number of troops to swap",
  })),
  toStructureId: Type.Optional(Type.Number({
    description: "swap_explorer_to_guard: target structure entity ID",
  })),
  toStructureDirection: Type.Optional(Type.Number({
    description: "swap_explorer_to_guard: hex direction to target structure (0-5)",
  })),
  toGuardSlot: Type.Optional(Type.Number({
    description: "swap_explorer_to_guard: target guard slot number",
  })),
  fromStructureId: Type.Optional(Type.Number({
    description: "swap_guard_to_explorer: source structure entity ID",
  })),
  fromGuardSlot: Type.Optional(Type.Number({
    description: "swap_guard_to_explorer: source guard slot number",
  })),

  // ---- Combat params ----
  aggressorId: Type.Optional(Type.Number({
    description: "attack_explorer: attacker explorer entity ID",
  })),
  defenderId: Type.Optional(Type.Number({
    description: "attack_explorer: defender explorer entity ID",
  })),
  defenderDirection: Type.Optional(Type.Number({
    description: "attack_explorer: hex direction to defender (0-5)",
  })),
  stealResources: Type.Optional(Type.Array(
    Type.Object({
      resourceId: Type.Number({ description: "Resource type ID to steal" }),
      amount: Type.Number({ description: "Amount to steal" }),
    }),
    { description: "attack_explorer, raid: resources to steal from the target" },
  )),
  structureDirection: Type.Optional(Type.Number({
    description: "attack_guard, raid: hex direction to target structure (0-5)",
  })),
  structureGuardSlot: Type.Optional(Type.Number({
    description: "guard_attack_explorer: guard slot number to use for attack",
  })),
  explorerDirection: Type.Optional(Type.Number({
    description: "guard_attack_explorer: hex direction to target explorer (0-5)",
  })),

  // ---- Trade params ----
  makerId: Type.Optional(Type.Number({
    description: "create_order: maker entity ID",
  })),
  takerId: Type.Optional(Type.Number({
    description: "create_order, accept_order: taker entity ID",
  })),
  makerGivesResourceType: Type.Optional(Type.Number({
    description: "create_order: resource type the maker gives",
  })),
  takerPaysResourceType: Type.Optional(Type.Number({
    description: "create_order: resource type the taker pays",
  })),
  makerGivesMinResourceAmount: Type.Optional(Type.Number({
    description: "create_order: minimum resource amount per unit the maker gives",
  })),
  makerGivesMaxCount: Type.Optional(Type.Number({
    description: "create_order: maximum number of units the maker will sell",
  })),
  takerPaysMinResourceAmount: Type.Optional(Type.Number({
    description: "create_order: minimum resource amount per unit the taker pays",
  })),
  expiresAt: Type.Optional(Type.Number({
    description: "create_order: expiration timestamp",
  })),
  tradeId: Type.Optional(Type.Number({
    description: "accept_order, cancel_order: trade order ID",
  })),
  takerBuysCount: Type.Optional(Type.Number({
    description: "accept_order: number of units to buy",
  })),

  // ---- Building params ----
  buildingCategory: Type.Optional(Type.Number({
    description: "create_building: 0=None, 1=Castle, 2=Resource, 3=Farm, 4=FishingVillage, 5=Barracks, 6=Market, 7=ArcheryRange, 8=Stable, 9=TradingPost, 10=WorkersHut, 11=WatchTower, 12=Walls, 13=Storehouse",
  })),
  useSimple: Type.Optional(Type.Boolean({
    description: "create_building: use simple building placement (true/false)",
  })),
  buildingCoord: Type.Optional(Type.Object({
    x: Type.Number({ description: "Building x coordinate" }),
    y: Type.Number({ description: "Building y coordinate" }),
  }, {
    description: "destroy_building, pause_production, resume_production: coordinates of the building",
  })),

  // ---- Bank params ----
  bankEntityId: Type.Optional(Type.Number({
    description: "buy_resources, sell_resources, add_liquidity, remove_liquidity: bank entity ID",
  })),
  resourceType: Type.Optional(Type.Number({
    description: "buy_resources, sell_resources, remove_liquidity: resource type ID",
  })),
  shares: Type.Optional(Type.Number({
    description: "remove_liquidity: number of LP shares to remove",
  })),
  calls: Type.Optional(Type.Array(
    Type.Object({
      resourceType: Type.Number({ description: "Resource type ID" }),
      resourceAmount: Type.Number({ description: "Resource amount" }),
      lordsAmount: Type.Number({ description: "Lords amount to pair" }),
    }),
    { description: "add_liquidity: array of liquidity provision calls" },
  )),

  // ---- Guild params ----
  isPublic: Type.Optional(Type.Boolean({
    description: "create_guild: whether the guild is public (true/false)",
  })),
  guildName: Type.Optional(Type.String({
    description: "create_guild: name for the new guild",
  })),
  guildEntityId: Type.Optional(Type.Number({
    description: "join_guild: entity ID of the guild to join",
  })),
  address: Type.Optional(Type.String({
    description: "update_whitelist: player address to whitelist/blacklist",
  })),
  whitelist: Type.Optional(Type.Boolean({
    description: "update_whitelist: true to whitelist, false to remove",
  })),

  // ---- Realm params ----
  realmEntityId: Type.Optional(Type.Number({
    description: "upgrade_realm: entity ID of the realm to upgrade",
  })),

  // ---- Hyperstructure params ----
  hyperstructureEntityId: Type.Optional(Type.Number({
    description: "contribute_hyperstructure: entity ID of the hyperstructure",
  })),
  contributorEntityId: Type.Optional(Type.Number({
    description: "contribute_hyperstructure: entity ID of the contributing structure",
  })),
  contributions: Type.Optional(Type.Array(Type.Number(), {
    description: "contribute_hyperstructure: array of contribution amounts",
  })),
});
```

### 1.2 Tool Description (Supplements the Schema)

The schema gives the LLM exact field names and types. The description gives strategic context — which params go together per action:

```typescript
const EXECUTE_ACTION_DESCRIPTION = `Execute a game action on chain. Returns success status and transaction hash.

## Required Params Per Action

### Resources
- send_resources: senderEntityId, recipientEntityId, resources[]
- pickup_resources: recipientEntityId, ownerEntityId, resources[]
- claim_arrivals: structureId, day, slot, resourceCount

### Troops
- create_explorer: forStructureId, category, tier, amount, spawnDirection
- add_to_explorer: toExplorerId, amount, homeDirection
- delete_explorer: explorerId
- add_guard: forStructureId, slot, category, tier, amount
- delete_guard: forStructureId, slot

### Movement
- move_explorer: explorerId, directions[], explore
- travel_explorer: explorerId, directions[]
- explore: explorerId, directions[]

### Troop Swaps
- swap_explorer_to_explorer: fromExplorerId, toExplorerId, toExplorerDirection, count
- swap_explorer_to_guard: fromExplorerId, toStructureId, toStructureDirection, toGuardSlot, count
- swap_guard_to_explorer: fromStructureId, fromGuardSlot, toExplorerId, toExplorerDirection, count

### Combat
- attack_explorer: aggressorId, defenderId, defenderDirection, stealResources[]
- attack_guard: explorerId, structureId, structureDirection
- guard_attack_explorer: structureId, structureGuardSlot, explorerId, explorerDirection
- raid: explorerId, structureId, structureDirection, stealResources[]

### Trade
- create_order: makerId, takerId, makerGivesResourceType, takerPaysResourceType, makerGivesMinResourceAmount, makerGivesMaxCount, takerPaysMinResourceAmount, expiresAt
- accept_order: takerId, tradeId, takerBuysCount
- cancel_order: tradeId

### Buildings
- create_building: entityId, directions[], buildingCategory, useSimple
- destroy_building: entityId, buildingCoord{x,y}
- pause_production: entityId, buildingCoord{x,y}
- resume_production: entityId, buildingCoord{x,y}

### Bank
- buy_resources: bankEntityId, entityId, resourceType, amount
- sell_resources: bankEntityId, entityId, resourceType, amount
- add_liquidity: bankEntityId, entityId, calls[]
- remove_liquidity: bankEntityId, entityId, resourceType, shares

### Guild
- create_guild: isPublic, guildName
- join_guild: guildEntityId
- leave_guild: (no params)
- update_whitelist: address, whitelist

### Realm & Hyperstructure
- upgrade_realm: realmEntityId
- contribute_hyperstructure: hyperstructureEntityId, contributorEntityId, contributions[]
`;
```

### 1.3 Update `simulate_action` Schema Similarly

Apply the same `StringEnum` + typed params pattern to `simulateSchema`. The description can be shorter: "Simulate a game action without executing it. Same params as execute_action."

### 1.4 Handler Adaptation in `execute` Function

The `execute` function in `createExecuteActionTool` needs a minor change. Currently it passes `params` as a single object to the adapter. With the Gmail pattern, all params are top-level siblings of `actionType`. Extract them:

```typescript
async execute(_toolCallId, toolParams) {
  const { actionType, ...params } = toolParams;
  const result = await adapter.executeAction({
    type: actionType,
    params,
  });
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    details: { actionType, success: result.success },
  };
},
```

This destructures `actionType` from the rest and passes everything else as `params` to the existing action-registry handlers — **no changes needed in action-registry.ts**.

### 1.5 Remove Param Name Fallbacks (Follow-Up)

Once the Gmail-pattern schema is deployed and proven, remove the fallback aliases in action-registry.ts:

**Before** (current):
```typescript
explorerId: num(p.explorerId ?? p.explorer_id ?? p.armyEntityId ?? p.army_entity_id ?? 0)
```

**After** (target):
```typescript
explorerId: num(p.explorerId)
```

Fallback removal should happen after verifying the schema works in production. The typed schema makes fallbacks unnecessary — the LLM can only use field names that exist in the schema.

---

## Part 2: View Layer — Enrich `observe_game`

### Decision: Enrich Existing Tool (Not New Tool)

Rather than adding a new `observe_detail` tool, we enrich the existing `observe_game` by calling more ViewClient methods in `buildWorldState()`.

**Rationale:**
- Fewer tools = fewer LLM decisions = fewer failure points
- The agent can't know it needs detail if it doesn't have the detail (chicken-and-egg problem)
- Reduces observe → observe_detail → execute to observe → execute (fewer round trips)
- The highest-impact views (realm, explorer) should always be available, not gated behind a second tool call

### 2.1 Enhance `buildWorldState()` with Realm and Explorer Data

**File: `client/apps/onchain-agent/src/adapter/world-state.ts`**

Add calls to `realm()` and `explorer()` for each of the player's structures and armies:

```typescript
// For each player structure, call realm() to get guard/building detail
for (const structure of playerData.structures) {
  const realmDetail = await view.realm(structure.entityId);
  // Merge guard slots, buildings, resources into the structure entity
}

// For each player army, call explorer() to get troop composition
for (const army of playerData.armies) {
  const explorerDetail = await view.explorer(army.explorerId);
  // Merge troop composition, carried resources, stamina into the army entity
}
```

**What this adds to the world state per structure:**
- `guardSlots`: array of `{ slot: number, category: number, tier: number, count: number }`
- `buildings`: array of `{ category: number, coord: {x, y} }`
- `resourceBalances`: array of `{ resourceType: number, amount: number }`
- `incomingArrivals`: count of pending arrivals

**What this adds to the world state per army/explorer:**
- `explorerId`: the explorer entity ID (currently missing!)
- `troops`: `{ category: number, tier: number, count: number }`
- `carriedResources`: array of `{ resourceType: number, amount: number }`
- `stamina`: current stamina value
- `isInBattle`: boolean

### 2.2 Add Bank and Events as Optional Sections

**Bank data** (needed for buy/sell actions):
```typescript
// Call bank() for known bank entity IDs (from map data)
const bankData = await view.bank(bankEntityId);
// Add to world state as: worldState.banks = [{ entityId, position, ... }]
```

**Events** (needed for situational awareness):
```typescript
// Call events() with a small limit
const recentEvents = await view.events({ limit: 10 });
// Add to world state as: worldState.recentEvents = [...]
```

**Hyperstructure** (needed for contribute action):
```typescript
// Call hyperstructure() for known hyperstructure IDs
const hsData = await view.hyperstructure(hsEntityId);
// Add to world state as: worldState.hyperstructures = [...]
```

### 2.3 Token Budget Consideration for Enriched World State

The enriched world state will be larger. Estimated sizes for a typical mid-game state:

| Data | Estimated JSON size | Notes |
|------|-------------------|-------|
| Current world state | ~2-4 KB | player summary, market, leaderboard, map |
| Per-realm detail (x3 realms) | ~1-2 KB each | guard slots, buildings, resources |
| Per-explorer detail (x5 explorers) | ~0.5-1 KB each | troops, carried resources, stamina |
| Bank data | ~0.5 KB | entity ID, position |
| Recent events (10) | ~1-2 KB | event log |
| **Total enriched** | **~10-15 KB** | ~3,000-5,000 tokens |

This is well within budget for a 128K+ context window. The enriched state pays for itself by:
- Eliminating failed actions from missing entity IDs (each retry wastes 500-2000 tokens)
- Removing the need for observe_detail round trips (each extra tool call adds ~500 tokens of overhead)

### 2.4 Future Optimization: Targeted Observation

If the enriched world state becomes too large (many realms, many explorers), we can add a `filter` param to `observe_game` later:

```typescript
const observeSchema = Type.Object({
  filter: Type.Optional(StringEnum(["summary", "full", "realm", "explorers", "market"] as const, {
    description: "What to include. 'summary' = overview only, 'full' = everything (default), or a specific section"
  })),
  entityId: Type.Optional(Type.Number({
    description: "When filter is 'realm' or 'explorers', focus on this specific entity ID"
  })),
});
```

This is a **future optimization**, not part of the initial implementation. Start with full enrichment and optimize only if token budget becomes a real problem.

---

## Part 3: soul.md Update

**File: `client/apps/onchain-agent/data/soul.md`**

Replace the flat action name list with a structured reference. The tool schema now has all param names, so soul.md provides **strategic context** (when to use each action, not what params it takes):

```markdown
## Available Actions

You act through `execute_action` with an `actionType` and the relevant params.
The tool schema shows all valid actionTypes and every param with descriptions.

### Strategy Guide

| Category | Actions | When to Use |
|----------|---------|-------------|
| Resources | send_resources, pickup_resources, claim_arrivals | Move resources between your structures, claim incoming deliveries |
| Troops | create_explorer, add_to_explorer, add_guard, delete_explorer, delete_guard | Build armies and defenses. Explorers move on the map, guards defend structures |
| Movement | move_explorer, travel_explorer, explore | Move explorers across the hex map. `explore` reveals new tiles |
| Swaps | swap_explorer_to_explorer, swap_explorer_to_guard, swap_guard_to_explorer | Reassign troops between explorers and guard slots |
| Combat | attack_explorer, attack_guard, guard_attack_explorer, raid | Attack enemies. Raids steal resources without full combat |
| Trade | create_order, accept_order, cancel_order | Player-to-player marketplace |
| Buildings | create_building, destroy_building, pause_production, resume_production | Develop your realm's infrastructure |
| Bank | buy_resources, sell_resources, add_liquidity, remove_liquidity | Trade resources at the bank AMM |
| Guild | create_guild, join_guild, leave_guild, update_whitelist | Form alliances |
| Realm | upgrade_realm | Level up your realm for more building slots |
| Hyperstructure | contribute_hyperstructure | End-game victory objective |

### Reading the World State

The `observe_game` tool returns your full game state including:
- Your structures with guard slots, buildings, and resource balances
- Your explorers with troop composition, carried resources, and stamina
- Market data, leaderboard, and nearby entities on the map
- Bank information and recent game events

Use entity IDs from the world state to fill action params. For example:
- Structure entity IDs → forStructureId, entityId, structureId
- Explorer entity IDs → explorerId, fromExplorerId, toExplorerId, aggressorId
```

---

## Part 4: Implementation Steps (Ordered)

### Step 1: Add `StringEnum` import and rewrite `actionSchema`
- **File**: `packages/game-agent/src/tools.ts`
- **Change**: Import `StringEnum` from `@mariozechner/pi-ai`. Replace entire `actionSchema` with Gmail-pattern typed schema. Update `simulateSchema` similarly.
- **Test**: Build passes, AJV rejects invalid action names

### Step 2: Update `execute` function to destructure params
- **File**: `packages/game-agent/src/tools.ts`
- **Change**: In `createExecuteActionTool`, destructure `{ actionType, ...params }` from tool params before passing to adapter
- **Test**: Existing action-registry tests still pass (params shape unchanged)

### Step 3: Add rich description to execute_action and simulate_action
- **File**: `packages/game-agent/src/tools.ts`
- **Change**: Replace bare description strings with the comprehensive "Required Params Per Action" reference
- **Test**: Verify description appears in tool definition

### Step 4: Enrich `buildWorldState()` with realm/explorer detail
- **File**: `client/apps/onchain-agent/src/adapter/world-state.ts`
- **Change**: Call `view.realm()` for each structure, `view.explorer()` for each army. Add guard slots, buildings, troop composition, carried resources to entities.
- **Test**: World state output includes new fields; verify with mock ViewClient

### Step 5: Add bank, events, hyperstructure data to world state
- **File**: `client/apps/onchain-agent/src/adapter/world-state.ts`
- **Change**: Call `view.bank()`, `view.events()`, `view.hyperstructure()` and include in world state output
- **Test**: World state includes bank/events/hyperstructure sections

### Step 6: Update `soul.md`
- **File**: `client/apps/onchain-agent/data/soul.md`
- **Change**: Replace flat action list with strategy guide table and world state reading guide
- **Risk**: Low — documentation only

### Step 7: Add/update tests
- **Files**: `client/apps/onchain-agent/test/adapter/`
- **Changes**:
  - Test that `StringEnum` rejects invalid action names
  - Test that destructured params pass through correctly to action-registry
  - Test that enriched world state includes realm/explorer detail
  - Test with mock ViewClient returning realistic data shapes

### Step 8: Remove param name fallbacks (after validation)
- **File**: `client/apps/onchain-agent/src/adapter/action-registry.ts`
- **Change**: Remove all `??` fallback chains in param access (e.g., `p.explorerId ?? p.explorer_id ?? p.armyEntityId` → `p.explorerId`)
- **Timing**: After Steps 1-7 are deployed and verified working
- **Test**: All action-registry tests still pass with canonical param names only

### Step 9: Update CLAUDE.md
- **File**: `client/apps/onchain-agent/CLAUDE.md`
- **Change**: Document Gmail-pattern schema, enriched world state, updated action reference pattern

---

## Files Modified (Summary)

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/game-agent/src/tools.ts` | MODIFY | Gmail-pattern typed schema + rich descriptions |
| `client/apps/onchain-agent/src/adapter/world-state.ts` | MODIFY | Call all ViewClient methods, enrich entity output |
| `client/apps/onchain-agent/src/adapter/action-registry.ts` | MODIFY (Step 8) | Remove param name fallbacks |
| `client/apps/onchain-agent/data/soul.md` | MODIFY | Strategy guide replacing flat action list |
| `client/apps/onchain-agent/CLAUDE.md` | MODIFY | Document new patterns |

No new files needed. No new tools needed. No dependency changes. No breaking changes to existing interfaces.

**Key difference from previous plan**: No `observe_detail` tool, no `getDetailView` adapter method, no `GameAdapter` interface change. Simpler.

---

## Token Budget Analysis

| Component | Current | Proposed | Delta |
|-----------|---------|----------|-------|
| `execute_action` schema | ~30 tokens (untyped) | ~600 tokens (typed params) | +570 |
| `execute_action` description | ~15 tokens | ~500 tokens (reference) | +485 |
| `simulate_action` | ~30 tokens | ~100 tokens (ref to execute) | +70 |
| `soul.md` action section | ~100 tokens | ~250 tokens (strategy guide) | +150 |
| World state per tick | ~800 tokens | ~2000-3000 tokens (enriched) | +1200-2200 |
| **Total per request** | ~975 tokens | ~3450-4450 tokens | **+2475-3475** |

Still well within budget for 128K+ context. The increase pays for itself:
- Each failed action + retry wastes ~1000-2000 tokens
- Current agent fails on nearly every action → wastes thousands of tokens per tick
- Correctly typed schema + enriched state → most actions succeed first try

---

## What This Does NOT Do (Intentional Scope Limits)

1. **No new tools**: No `observe_detail`, no category tools. One typed `execute_action` tool, one enriched `observe_game`.

2. **No session policy expansion**: The hardcoded session policies cover all currently registered actions. Tracked separately.

3. **No new actions**: Focus is making existing 35 actions work correctly.

4. **No real-time subscriptions**: Tick-based polling is sufficient.

5. **No fix for empty market/bank data**: `market().openOrders` and `bank().pools` return empty due to ViewClient SQL bugs. `accept_order`, `cancel_order`, and bank price discovery remain degraded. Tracked separately.

6. **No guild discovery**: No ViewClient method to list guilds. `join_guild` requires a `guildEntityId` the agent cannot discover.

---

## Known Remaining Gaps After Implementation

| Action | Remaining Issue | Root Cause |
|--------|----------------|------------|
| `accept_order` | Cannot discover tradeIds | market().openOrders always empty |
| `cancel_order` | Cannot discover tradeIds | market().openOrders always empty |
| `join_guild` | Cannot discover guildEntityIds | No guild list view exists |
| `update_whitelist` | Cannot discover member addresses | No guild detail view exists |
| `buy/sell_resources` | Pool prices unknown | bank().pools always empty |

---

## Verification Checklist

Before considering this implementation complete:

- [ ] `StringEnum` rejects made-up action names (e.g., "move_army" → AJV error)
- [ ] All 35 registered actions are in the `StringEnum` list
- [ ] Every param name in the schema exactly matches what action-registry.ts reads from `params`
- [ ] `{ actionType, ...params }` destructuring passes correct data to handlers
- [ ] Enriched world state includes explorerId on army entities
- [ ] Enriched world state includes guard slot details on structure entities
- [ ] World state includes troop composition per explorer
- [ ] Agent can successfully `create_explorer` with correct params from world state
- [ ] Agent can successfully `add_guard` using guard slot info from world state
- [ ] All existing tests pass
- [ ] Param name fallbacks removed (Step 8) without breaking tests
