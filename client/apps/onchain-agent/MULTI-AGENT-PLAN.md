# Multi-Agent Architecture Plan

## Overview

Replace the current single-agent + deterministic automation loop with a 2-agent system:

- **Military Agent** (main) — strategy, tactics, map control, combat, exploration
- **Production Agent** (subordinate) — economy, buildings, resources, troop production on demand

The military agent is the decision-maker. It tells production what it needs ("500 T2 Paladins at realm #42", "level up
city", "focus paladin production"). Production figures out how to make it happen.

## Architecture

```
MILITARY AGENT (sonnet, medium thinking, game-tick cadence)
  Tools: inspect, view_map, move_army, attack_target, create_army,
         reinforce_army, defend_structure, open_chest,
         request_troops, request_resources, set_production_priority
  Sees: full map, all armies, threats, game state, production status
  │
  └── PRODUCTION AGENT (haiku/sonnet, low thinking, game-tick cadence)
        Tools: inspect, build, destroy_building, upgrade_realm,
               produce_resources, offload_arrivals, transfer_resources
        Sees: all structures, resources, buildings, production queues,
              pending military requests
        Autonomous: manages build order, labor conversion, inter-realm logistics
        Responds to: military demands via directive queue
```

## File Structure

```
src/multi-agent/
  ├── tx-queue.ts          — Serialized transaction queue (shared by both agents)
  ├── coordinator.ts       — Creates & wires both agents, tick loops, shared state
  ├── action-sets.ts       — Defines tool sets for each agent
  ├── directives.ts        — Inter-agent communication (directive queue + status)
  ├── production-tools.ts  — New tools for production agent (build, produce, upgrade, offload)
  └── military-tools.ts    — Military-specific delegation tools (request_troops, etc.)
```

## Component Details

### 1. TxQueue (`tx-queue.ts`)

Both agents share one Cartridge session. Concurrent writes = nonce collisions. The queue serializes all `provider.*()`
calls.

```typescript
class TxQueue {
  private queue: QueueItem[] = [];
  private processing = false;
  private txContext: TxContext;

  async enqueue(agent: string, fn: () => Promise<any>): Promise<any> {
    // Returns a promise that resolves when the tx completes
  }
}
```

All tool execute functions call `txQueue.enqueue("military", () => provider.attack_explorer_vs_explorer(...))` instead
of calling provider directly.

### 2. Directive System (`directives.ts`)

Military → Production communication via a shared directive queue.

```typescript
interface TroopRequest {
  type: "troops";
  troopType: "Knight" | "Crossbowman" | "Paladin";
  tier: number;
  amount: number;
  structureId: number;
  priority: "urgent" | "normal";
}

interface ResourceRequest {
  type: "resources";
  resourceType: number;
  amount: number;
  structureId: number;
  priority: "urgent" | "normal";
}

interface PriorityDirective {
  type: "priority";
  instruction: string; // "focus paladins", "level up realm #42", etc.
}

type Directive = TroopRequest | ResourceRequest | PriorityDirective;
```

Production agent's tick prompt includes pending directives. After fulfilling a request, it marks it done and reports
status.

### 3. Production Tools (`production-tools.ts`)

These replace the deterministic automation loop with LLM-driven tools:

| Tool                | Provider Method                            | Purpose                             |
| ------------------- | ------------------------------------------ | ----------------------------------- |
| `build`             | `provider.create_building()`               | Construct a building at a structure |
| `destroy_building`  | `provider.destroy_building()`              | Tear down a building                |
| `upgrade_realm`     | `provider.upgrade_realm()`                 | Level up a realm                    |
| `produce_resources` | `provider.execute_realm_production_plan()` | Execute production cycles           |
| `offload_arrivals`  | `provider.arrivals_offload()`              | Claim incoming resource shipments   |

The production agent also keeps `transfer_resources` (already exists) and `inspect` (read-only, shared).

### 4. Military Delegation Tools (`military-tools.ts`)

Custom tools that push directives to the production agent:

| Tool                      | Purpose                                                                  |
| ------------------------- | ------------------------------------------------------------------------ |
| `request_troops`          | "I need 500 T2 Paladins at realm #42" → pushes TroopRequest              |
| `request_resources`       | "I need 5000 wheat at realm #42" → pushes ResourceRequest                |
| `set_production_priority` | "Focus on paladins, prepare for city upgrade" → pushes PriorityDirective |

These tools return immediately with confirmation. Production agent picks up directives on its next tick.

### 5. Coordinator (`coordinator.ts`)

Creates both Pi Agent instances, wires tools, tick loops, and shared state.

```typescript
function createMultiAgentSystem(config, client, provider, account, mapCtx, gameConfig) {
  const txQueue = new TxQueue(txCtx);
  const directives = new DirectiveQueue();

  // Military agent — all existing combat/map tools + delegation tools
  const militaryAgent = new Agent({...});

  // Production agent — new economy tools + receives directives
  const productionAgent = new Agent({...});

  // Tick loop — both agents tick on game cadence
  // Military ticks first, production second (so production can react to new requests)
}
```

### 6. Action Sets (`action-sets.ts`)

Defines which existing tool factories go to which agent:

**Military Agent:**

- `createInspectTool()` — inspect_tile
- `createMoveTool()` — move_army
- `createAttackTool()` — attack_target
- `createCreateArmyTool()` — create_army
- `createReinforceArmyTool()` — reinforce_army
- `createDefendStructureTool()` — defend_structure
- `createOpenChestTool()` — open_chest
- `createViewMapTool()` — view_map
- NEW: `createRequestTroopsTool()` — request_troops
- NEW: `createRequestResourcesTool()` — request_resources
- NEW: `createSetProductionPriorityTool()` — set_production_priority

**Production Agent:**

- `createInspectTool()` — inspect_tile (read-only, shared)
- `createTransferResourcesTool()` — transfer_resources
- NEW: `createBuildTool()` — build
- NEW: `createDestroyBuildingTool()` — destroy_building
- NEW: `createUpgradeRealmTool()` — upgrade_realm
- NEW: `createProduceResourcesTool()` — produce_resources
- NEW: `createOffloadArrivalsTool()` — offload_arrivals

## Tick Flow

```
Every game tick:
  1. Map loop refreshes (background, shared)
  2. Military agent ticks:
     - Receives world state (map, armies, threats)
     - Makes strategic/tactical decisions
     - Executes combat, movement, exploration
     - Requests troops/resources from production if needed
  3. Production agent ticks:
     - Receives world state (structures, resources, buildings)
     - Checks directive queue for military requests
     - Manages build orders, production, transfers
     - Reports status back
```

## System Prompts

**Military Agent soul:**

- You are the commander. Your job is map control, combat, and exploration.
- You DO NOT build, produce, or manage economy — that's production's job.
- Use request_troops when you need armies. Use request_resources when you need supplies.
- Use set_production_priority for strategic direction (troop type focus, city upgrades).
- Focus on: scouting, threat assessment, army positioning, capturing structures, relic chests.

**Production Agent soul:**

- You are the quartermaster. Your job is economy, buildings, and troop production.
- You DO NOT move armies, fight, or explore — that's military's job.
- Check pending military requests each tick and prioritize them.
- Autonomously manage: build orders, labor conversion, resource production, inter-realm transfers.
- Priority order: military requests > realm upgrades > production optimization.

## Implementation Order

1. `tx-queue.ts` — foundation, no dependencies
2. `directives.ts` — inter-agent communication, no dependencies
3. `production-tools.ts` — new tools, depends on tx-queue
4. `military-tools.ts` — delegation tools, depends on directives
5. `coordinator.ts` — wires everything, depends on all above
6. Update `entry/main.ts` — integrate coordinator, remove automation loop
7. Test build

## Blitz-Specific Tools (Phase 2)

New tools added for complete Blitz mode coverage. All verified against on-chain contracts.

### Military Agent — New Tools

| Tool                                | File                   | Provider Method                                | Purpose                                               |
| ----------------------------------- | ---------------------- | ---------------------------------------------- | ----------------------------------------------------- |
| `guard_delete`                      | `guard-management.ts`  | `provider.guard_delete()`                      | Remove troops from a guard slot (returns to reserves) |
| `guard_explorer_swap`               | `guard-management.ts`  | `provider.guard_explorer_swap()`               | Move troops from guard slot to adjacent explorer      |
| `attack_guard_vs_explorer`          | `guard-management.ts`  | `provider.attack_guard_vs_explorer()`          | Guard attacks adjacent enemy explorer (defensive)     |
| `apply_relic`                       | `relic.ts`             | `provider.apply_relic()`                       | Activate relic bonus on structure or explorer         |
| `troop_troop_adjacent_transfer`     | `adjacent-transfer.ts` | `provider.troop_troop_adjacent_transfer()`     | Transfer resources between adjacent armies            |
| `troop_structure_adjacent_transfer` | `adjacent-transfer.ts` | `provider.troop_structure_adjacent_transfer()` | Transfer resources from army to adjacent structure    |
| `structure_troop_adjacent_transfer` | `adjacent-transfer.ts` | `provider.structure_troop_adjacent_transfer()` | Transfer resources from structure to adjacent army    |
| `allocate_shares`                   | `hyperstructure.ts`    | `provider.allocate_shares()`                   | Allocate HS ownership (auto 100% after capture)       |

### Production Agent — New Tools

| Tool                | File                  | Provider Method                | Purpose                        |
| ------------------- | --------------------- | ------------------------------ | ------------------------------ |
| `pause_production`  | `production-tools.ts` | `provider.pause_production()`  | Pause building resource output |
| `resume_production` | `production-tools.ts` | `provider.resume_production()` | Resume paused building         |

### Confirmed NOT Blitz (excluded)

| Action                          | Reason                                                      |
| ------------------------------- | ----------------------------------------------------------- |
| `raid_explorer_vs_guard`        | `assert!(!blitz_mode_on)` in troop_raid.cairo:89-90         |
| `season_close` / `end_game`     | `assert!(blitz_mode_on == false)` in season/contracts.cairo |
| `contribute_to_construction`    | Not applicable in Blitz                                     |
| `claim_wonder_production_bonus` | Not applicable in Blitz                                     |
| `claim_share_points`            | Blitz uses `blitz_prize_claim` post-game instead            |
| `claim_construction_points`     | Blitz uses `blitz_prize_claim` post-game instead            |

## Migration Notes

- The deterministic automation loop (`automation/`) is NOT deleted — it stays as fallback. The coordinator can be
  toggled via config: `MULTI_AGENT=true` uses the new system, `MULTI_AGENT=false` (default) keeps the existing
  single-agent + automation loop.
- All existing tool files are unchanged — they just get routed to different agents.
- The TxQueue wraps calls inside existing tool execute functions, requiring minimal changes to existing tool code (pass
  txQueue instead of raw TxContext).
