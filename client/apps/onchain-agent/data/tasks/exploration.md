---
domain: exploration
---

# Exploration Tasks

## Explorer Creation

- Use `create_explorer` from your most resource-rich structure. Choose `spawnDirection` to point toward unexplored territory.
- Prefer mid-tier troops for exploration. High-tier troops are better used as guards. Low-tier troops die too easily in hostile territory.
- Maintain at least one explorer dedicated to pure exploration (mapping new tiles) and one for tactical scouting (monitoring enemy positions).

## Map Movement

- Use `move_explorer` with `explore: true` to move into unexplored tiles. This reveals the tile and its contents.
- Use `travel_explorer` for long-distance movement through already-explored territory. Travel is faster than explore-move.
- Use `explore` to explore tiles adjacent to the explorer's current position without moving.

## Exploration Strategy

- Expand outward from your structures in a spiral pattern to maximize coverage with minimal backtracking.
- Prioritize exploring tiles between your structures and the nearest enemy positions. Map awareness of the border zone is critical for defense.
- When an explorer discovers a new resource node or strategic position, record it in your reflection for future exploitation.

## Scouting Enemy Positions

- Periodically move an explorer near known enemy structures to update their guard strength, army positions, and resource levels.
- Do not move your explorer adjacent to a strongly guarded enemy structure. Keep a 2-tile buffer to avoid being attacked.
- Track enemy army movements across ticks. If an enemy army is moving toward your territory, this is an early warning to shift to defense.

## Stamina Management

- Check explorer stamina before issuing move commands. Explorers with low stamina move slower and are vulnerable.
- Route explorers back toward friendly structures when stamina drops below 30% of max. They can rest or be swapped to guard duty.
- Do not chain more than 3 move commands in a single tick for the same explorer. Spread movement across ticks.

## Discovery Handling

- When a new resource tile is discovered, evaluate whether it is worth building a structure to harvest it.
- When an enemy structure is discovered, note its position and guard strength for future military planning.
- When a bank is discovered, note its position for future trading operations.

## Decision Criteria

- Exploration priority increases when your known map is small relative to the number of ticks played.
- Exploration priority decreases when all tiles within 10 hexes of your structures are explored.
- Never explore with your last remaining explorer. Keep one in reserve for emergency scouting or defense.
