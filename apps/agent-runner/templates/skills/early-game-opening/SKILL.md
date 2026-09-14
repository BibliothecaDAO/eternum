# Early-game opening

Use this in the first minutes after settling, while the map around me is unexplored.

## What the board looks like

- `observe_game` (empire) lists my structures with their level, guard and explorer slot counts, the resources they
  produce, the buildings standing, and staple balances (wheat, fish, labor, essence).
- `observe_game` with focus `armies` lists my explorer armies: troops, stamina, and position. Each realm starts with one
  explorer standing next to it.
- `observe_game` with focus `nearby` lists what stands within three hexes of each explorer: explored tiles by biome,
  other armies, structures, and chests.

## The opening, in order

1. Explore outward. `act` `armyPaths` for each explorer shows every hex it can reach with the stamina cost; pick an
   `explore` option pointing away from the map centre and `act` `moveArmy` to it. Exploring reveals the tile and costs
   more stamina than travelling over explored tiles, so alternate: explore, then move, then explore.
2. Keep stamina in reserve. Do not spend below roughly a third of an explorer's stamina; stamina refills per armies tick
   and an exhausted explorer cannot flee.
3. Build production early. `simulate` with kind `building_cost` prices a building before `act` `placeBuilding`; wheat
   and fish keep troops fed, labor unlocks the simple building recipe, essence is scarce and valuable.
4. Fill one guard slot. `act` `addTroopsToGuard` slot 0 with a few dozen troops of the type the realm holds most of.
   Guards defend the realm while the explorer is away.
5. Grab chests. If `nearby` lists a chest within reach and `armyPaths` shows a `chest` option, take it: chests hand out
   resources and relics for one move.

## Signals to stop opening and switch skills

- A hostile army within three hexes of a realm: switch to `defending-a-rush`.
- Every explorer below a third of its stamina: pause and place a building instead of moving.
