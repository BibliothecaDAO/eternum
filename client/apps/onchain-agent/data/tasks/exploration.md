---
domain: exploration
urgency: high
autoload: false
---

# Exploration & Movement Handbook

## Exploration & Victory Points

Each newly explored tile awards Victory Points (VP). Exploration is a direct VP source — see `tasks/priorities.md` for the full scoring breakdown.

## Hex Grid

- 6 directions: 0=East, 1=NE, 2=NW, 3=West, 4=SW, 5=SE
- All movement uses direction arrays, e.g. `[4, 4, 4]` = 3 hexes southwest

## Movement Types

### `travel_explorer` — Fast Movement (Explored Tiles Only)
- **Multi-hex**: Can move 5+ hexes in one action — e.g. `directions: [4,4,4,4,4]`
- **Stamina**: ~10 per hex
- **Requirement**: All tiles in path must be explored AND unoccupied
- **Errors**:
  - `"one of the tiles in path is not explored"` — use `move_explorer` with `explore:true` first
  - `"one of the tiles in path is occupied"` — another army is blocking, reroute

### `move_explorer` — Combined Wrapper
- With `explore: false`: same as `travel_explorer` (multi-hex through explored tiles)
- With `explore: true`: same as `explore` (single hex, reveals new tile)
- Prefer using `travel_explorer` or `explore` directly

### `explore` — Dedicated Scouting
- Pure exploration action
- **Stamina**: 30 per hex
- **Minimum**: 10 troops required in the army
- Reveals fog of war
- **Error**: `"tile is already explored"` — use `travel_explorer` instead

## Multi-Hex Travel

Moving 5+ hexes in a single action is possible:
- All tiles in the path must already be explored
- All tiles must be unoccupied (no other armies blocking)
- Stamina cost scales linearly (~10/hex for travel)
- Exploring tiles first (1 hex at a time, 30 stamina each) reveals them permanently, enabling fast multi-hex travel through those tiles afterward

## Nearby Entities

The `observe_game` tick prompt and `inspect_explorer` tool show neighbor tiles around each army:
- Direction, explored status, occupied status, biome, occupant info
- Use this to decide which direction to explore or travel

## Common Errors

- `"one of the tiles in path is not explored"` — can't travel through unexplored tiles
- `"one of the tiles in path is occupied"` — another army blocking the path
- `"explorer can only move one direction when exploring"` — exploring is 1 hex at a time
- `"tile is already explored"` — use `travel_explorer` instead of explore action

## Active Exploration Tasks

(None yet — will be populated after first observation.)
