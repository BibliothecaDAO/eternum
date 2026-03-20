# TODO

## Tool Unification

The MCP server tools (`dev/scripts/mcp-server.ts`) are the source of truth for game logic. The PI agent tools
(`src/tools/`) are an older implementation with less coverage and missing improvements (combat simulation, coordinate
conversion, explore injection, partial move reporting, etc.).

### Goal

Extract the core logic from the MCP tools into framework-agnostic functions, then have both MCP and PI tools call them.

```
src/tools/core/          ← shared logic, pure functions
  move.ts                → moveArmy(armyId, target, context) → MoveResult
  attack.ts              → attackTarget(armyId, target, context) → AttackResult
  create-army.ts         → createArmy(structureId, opts, context) → CreateResult
  guard.ts               → guardFromStorage / guardFromArmy / unguardToArmy
  transfer.ts            → sendResources / transferToStructure / transferToArmy
  combat-sim.ts          → simulateAttack (already standalone in src/world/combat.ts)
  ...

dev/scripts/mcp-server.ts   ← thin wrapper: Zod schemas + JSON response
src/tools/*.ts               ← thin wrapper: AgentTool interface + pi-agent response
```

### What MCP tools have that PI tools don't

- Combat simulation before/instead of attacking
- Native offset hex A\* pathfinding (no H3 bugs)
- Explore injection for routing through unexplored tiles
- Partial move reporting (explore/travel breakdown, stamina-truncated paths)
- Display coordinate system (positive Y = north)
- Smart donkey routing (send vs pickup)
- Donkey cost calculation from resource weights
- Guard slot management (from_storage, from_army, unguard_to_army)
- Resource transfers (to_structure, to_army)
- Relic application

### Steps

1. For each MCP tool, extract the core logic into `src/tools/core/<name>.ts`
   - Input: plain typed params (army ID, target position, etc.)
   - Output: plain typed result (success/failure, details)
   - Dependencies: provider, client, gameConfig passed as context object
2. Update MCP server to import and call the core functions
3. Update PI tools to import and call the same core functions
4. Remove duplicated logic from both wrappers
5. Add missing PI tools that MCP already has

### Context Type

```typescript
interface ToolContext {
  client: EternumClient;
  provider: EternumProvider;
  signer: Account;
  playerAddress: string;
  gameConfig: GameConfig;
  mapSnapshot: MapSnapshot;
  mapCenter: number;
}
```
