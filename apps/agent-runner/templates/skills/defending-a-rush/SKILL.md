# Defending a rush

Use this when a hostile army appears within reach of one of my structures, or when a world state update reports a
hostile army moving toward me.

## Read the threat first

1. `observe_game` with focus `nearby` shows the hostile army's id, troop type and tier, and its hex.
2. `simulate` with kind `combat`, `attackerId` set to the hostile army and `defenderId` set to my nearest explorer,
   tells me whether my explorer would survive. Run it again with the roles swapped before considering an attack.
3. `simulate` with kind `raid`, `attackerId` set to the hostile army and `structureId` set to my realm, prices what a
   raid on the realm would take from me.

## Then choose one response

- **Reinforce the guard.** `act` `addTroopsToGuard` on the threatened realm. Slot 0 is the first to fight; a slot must
  be empty or hold the same troop type and tier. Guards do not need stamina and they fight at home.
- **Pull the explorer home.** `act` `armyPaths` for the explorer, then `act` `moveArmy` to the hex next to the realm. An
  explorer standing next to its home can be reinforced with `act` `addTroopsToExplorer`.
- **Strike first.** Only if the combat simulation gives me a clear win: `armyPaths` lists the `attack` option on the
  hostile hex and `moveArmy` to it carries out the attack.
- **Use the guards' reach.** `act` `structurePaths` lists the attack and help options my realm's guards have over armies
  next to it; ranged guard types reach further.

## Rules

- Never leave a realm with every guard slot empty while a hostile army is within three hexes.
- Do not chase. An enemy explorer that leaves my reach is not worth stamina.
- Report the threat to my owner once when it appears and once when it resolves, not on every move.
