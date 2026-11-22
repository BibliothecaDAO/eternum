# CREATURES / 16

Every map animal is built here from its anatomy, on one rig, `biome-creature-v1`: named joints carrying the gait
metadata the animator reads. `manifest.json` records each file's triangles, bytes and hash.

## Built here

`pnpm --dir apps/game build:biome-creatures` (`scripts/biome-creatures/`, Khronos KTX-Software on PATH for the two
striped coats) builds all sixteen. Each species file under `species/` describes the animal as rounded solids on the
rig's joints; the builder melts them into one surface, thins it to its triangle budget, refuses one that falls into
separate pieces, skins it to the joints its solids belong to, paints it (vertex colours for the coat, a 480px flank
painting for stripes) and writes one skinned mesh, one draw. Builds are repeatable: the same sources give the same
bytes. `--only <id>` builds one species and `--study <dir>` draws a four-view sheet of each to judge a shape by before
the lab does.

Each species is sculpted on its body plan: `quadruped.mjs` for the mammals, the tortoise and the salamander (a leg may
`splay` its foot outward), `arthropod.mjs` for the crab, the scorpion and the beetle (legs splayed from the shell's rim,
claws with a hinged finger, an optional stinger), `swimmer.mjs` for the sea turtle and the anglerfish (flippers, a neck
or a lure, a tail chain), `bird.mjs` for the toucan and the penguin (spread wings the animator folds, feet set the perch
drop below the flying height), each emitting the joints and extras the animator's profile for it reads. A species may
set its own `triangles` budget (the small ones spend 4,000, the rest at most 6,000) and `roughness`. Its biome is the
catalog's (`biome-creature-catalog.ts`), and its coat is chosen to read on that biome's ground.

A quadruped leg's joints are the part that swings clear of the body (forearm and cannon, gaskin and cannon), bound
hanging straight and a little longer than the hip is high: the animator bends them to the ground.

## The animator

`src/three/terrain/creatures/biome-creature-animator.js` poses every animal, stepped by the ground it covers and posed
for what it is doing; it reads the joints, leg lengths and gait phases the models carry. The game owns loading,
navigation, terrain contact and disposal. Each species is drawn at the size the catalog gives it, not at the size it was
authored. Judge a change to either on `/lab/wildlife`; `/lab/life` shows all sixteen beside a knight.
