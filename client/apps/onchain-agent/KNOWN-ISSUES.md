# Known Issues

## H3 Pathfinding — "Non-adjacent hex pair in path"

**Status**: Fixed — MCP server now uses native offset hex A* (`findPathNative`)
**Severity**: Medium — workaround exists (short hops)
**Files**: `src/world/pathfinding_v2.ts`, `dev/scripts/mcp-server.ts` (explore injection)

### Symptom
`move_army` fails with "Non-adjacent hex pair in path" error when routing longer distances, especially through tiles that were injected (unexplored tiles added to the H3 index for exploration).

### Root Cause
The H3 hexagonal grid library (`h3-js`) uses its own hex topology at resolution 7 that doesn't perfectly align with Eternum's even-r offset hex grid. When `gridPathCells()` computes a path in H3 space, consecutive H3 cells can map back to game coordinates that aren't actually adjacent in the offset grid.

The issue is exacerbated by:
1. **Coordinate normalization** — the H3 index normalizes `(x - minX, y - minY)` which works for the original tile set but injected tiles at the frontier can fall in H3 regions where the mapping breaks
2. **Synthetic tile injection** — `markExplored()` adds tiles to the H3 index that weren't in the original snapshot, expanding the coordinate space in ways H3 doesn't handle cleanly
3. **Path length** — short 1-2 step paths align locally, but 3+ steps cross more H3 cell boundaries where topology diverges

### Workaround
Move armies in short hops (1-2 tiles at a time) instead of long-distance pathfinding. The `move_army` tool's stamina truncation naturally limits steps, but the H3 error can occur even within the stamina budget.

### Root Cause (detailed)
We use `gridPathCells(startH3, endH3)` which computes a **straight line** in H3 space. This is NOT proper pathfinding — it's a line-drawing function that can produce non-adjacent cell pairs and doesn't respect obstacles.

The correct H3 approach (from https://observablehq.com/@nrabinowitz/h3-pathfinding) is:
- **A\* search** where neighbors come from `h3.kRing(current, 1)` — guaranteed H3-adjacent
- This respects obstacles (occupied tiles, unexplored tiles)
- Adjacency is always valid because kRing returns actual H3 neighbors

Our `gridPathCells` was a shortcut that skips the proper A\* and breaks on non-trivial paths.

### Fix
Replace `gridPathCells` fast-path in `findPath()` with A\* using `gridDisk(cell, 1)` (the v4 equivalent of `kRing`) for neighbor enumeration. This keeps H3's speed benefits (O(1) neighbor lookup, compact cell IDs) while guaranteeing valid adjacency.

The A\* heuristic can use `gridDistance(current, target)` for the H3 hex distance estimate.

### Workaround (current)
Move armies in short hops (1-2 tiles at a time). Short paths usually work because `gridPathCells` aligns locally.
