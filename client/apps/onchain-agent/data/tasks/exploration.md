---
domain: exploration
urgency: high
autoload: false
---

# Exploration & Movement Handbook

## Exploration & Victory Points

Each newly explored tile awards Victory Points (VP). Exploration is a direct VP source — see `tasks/priorities.md` for
the full scoring breakdown.

## Hex Grid

- 6 directions: 0=East, 1=NE, 2=NW, 3=West, 4=SW, 5=SE
- Coordinates are display-space — use them directly in actions

## Movement — `move_to`

Use `move_to` for all movement. It takes a target coordinate and handles everything automatically:

- **A\* pathfinding** computes the optimal route from the explorer's current position to the target
- **Travel** through explored tiles: ~10 stamina/hex, batched into multi-hex steps
- **Exploration** of unexplored tiles: 30 stamina/hex, 1 hex at a time, minimum 10 troops required
- Mixed paths (travel + explore) are handled seamlessly — the pathfinder batches travel segments and explore segments
  separately
- Stops on first failure (insufficient stamina, blocked tile, etc.)

Parameters:

- `explorerId` — Explorer entity ID to move
- `targetCol` — Target x coordinate (from world state display coordinates)
- `targetRow` — Target y coordinate (from world state display coordinates)

### Stamina Costs

| Action                 | Cost    | Notes                                     |
| ---------------------- | ------- | ----------------------------------------- |
| Travel (explored tile) | ~10/hex | Can batch many hexes                      |
| Explore (new tile)     | 30/hex  | 1 hex at a time, min 10 troops, awards VP |

### What Exploration Yields

- Reveals the tile permanently for all players
- Awards Victory Points (10 VP per tile)
- May discover Relic Crates, Essence Rifts, Camps, or Hyperstructures

## Nearby Entities

The tick prompt and `inspect_explorer` tool show neighbor tiles around each army:

- Direction, explored status, occupied status, biome, occupant info
- Use this to decide where to send your explorers

## Common Errors

- `"one of the tiles in path is not explored"` — the pathfinder handles this automatically with `move_to`
- `"one of the tiles in path is occupied"` — another army blocking the path, reroute
- `"explorer can only move one direction when exploring"` — `move_to` handles this (1 explore hex at a time)
- Insufficient stamina — wait for regeneration (+20 per phase) or use a different explorer

## Active Exploration Tasks

(None yet — will be populated after first observation.)
