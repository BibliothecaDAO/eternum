# Pathfinding Improvements — Design

## Goal

Fix explore cost distinction, add pre-computed reachability summaries, and stub food cost warning.

## Changes

### 1. Explore Cost Fix (`move.ts`)

When the final step of a path is into an unexplored tile, use `gameConfig.stamina.exploreCost` instead of `tileTravelCost` for that step. Affects:
- Path truncation budget calculation (the last step may cost more than travel)
- `staminaAfter` / `movesAfter` display

The A* pathfinder doesn't change — it routes over explored tiles. The explore step is always the final step, handled separately.

### 2. Pre-computed Reachability (`world/pathfinding.ts`)

New `computeReachability()` function: BFS from a position bounded by stamina, returns what's reachable grouped by type.

```typescript
interface ReachabilityResult {
  exploreTiles: number;   // unexplored tiles reachable for explore
  moveTiles: number;      // explored empty tiles
  structures: number;     // structures within range
  chests: number;         // chests within range
  armies: number;         // other armies within range
}
```

Consumed by:
- Move tool — includes summary in response after successful move
- Map renderer — shows per-army reachability in YOUR ENTITIES section

### 3. Food Warning (console only)

`console.warn` in `move.ts` before executing travel/explore: "Food cost check not implemented — ensure realm has wheat/fish." Not sent to the agent.
