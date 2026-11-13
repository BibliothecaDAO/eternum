# Agent Instructions for Game Client

## Patch notes

Players read what changed in What's new's patch notes, one file per release under `content/patch-notes/`, written by the
patch notes' editor at each release (that folder's `AGENTS.md`). A change does not add an entry of its own: say what a
player meets in its pull request, and the editor takes it from there.

## Design rules

What a player sees follows these five rules. Each says where the code holds it today and, plainly, where it does not
yet. A change that moves a surface away from a rule is refused in review like a bug; a change that closes a gap deletes
it from here.

1. **A side keeps its colour on every surface.** To a playing viewer their own things are green, an ally's blue and
   everyone else's red, nobody's included. Allies exist where a game names them: in a Frontier season whose preset
   groups the Orders into Aspects, a member of the same Aspect is an ally; in Eternum a tribe member is; elsewhere every
   other player is an enemy, tribe or not (`arePlayersAllied`, `src/utils/entity-ownership.ts:41`). A watching viewer
   has no side: each player takes their seat's colour and nobody's things are grey (`watchedSide`,
