# CREATURES / 16

Two families share this folder and one rig, `biome-creature-v1`: named joints carrying the gait metadata the animator
reads. `manifest.json` records each file's hash; a row with a `builder` is one of ours.

## The mammals: built here

Goat, fox, jackrabbit, moose, zebra, red deer and tiger are built from their anatomy by
`pnpm --dir apps/game build:biome-creatures` (`scripts/biome-creatures/`, Khronos KTX-Software on PATH for the two
striped coats). Each species file under `species/` describes the animal as rounded solids on the rig's joints; the
builder melts them into one surface, thins it to 6,000 triangles, skins it to the joints its solids belong to, paints it
(vertex colours for the coat, a 480px flank painting for stripes) and writes one skinned mesh. Builds are repeatable:
the same sources give the same bytes. `--only <id>` builds one species and `--study <dir>` draws a four-view sheet of
each to judge a shape by before the lab does.

A leg's joints are the part that swings clear of the body (forearm and cannon, gaskin and cannon), bound hanging
straight and a little longer than the hip is high: the animator bends them to the ground.

## The others: supplied

The remaining nine are user-supplied original artwork from `huose/biome-kit/creatures`, version 4.0.0: LOD2 GLBs of
rigid parts that retain their textures, vertex colors, joint hierarchy and procedural animation metadata. The manifest
keeps that source's manifest hash. No license from the previous terrain prop kit applies to these assets.

The supplied `animate-creature.js` became `src/three/terrain/creatures/biome-creature-animator.js`: its standalone
loader is removed and its motion is now the game's own, stepped by the ground an animal covers and posed for what it is
doing. It still reads the joints, leg lengths and gait phases the models carry. The game owns loading, navigation,
terrain contact and disposal. Animation is rigid-part procedural motion; no skeletal clips are required.

Each species is drawn at the size `biome-creature-catalog.ts` gives it, not at the size it was authored. Judge a change
to either on `/lab/wildlife`.

The supplied models' textures are converted with `node scripts/compress-models.mjs --only biome-creatures/<file>.glb`
from `apps/game` (Khronos KTX-Software required): ETC1S color, UASTC normal/technical maps, mipmaps, and a 480px texture
limit. Geometry and procedural animation metadata are retained. After recompression, update each manifest entry’s
`bytes` and SHA-256 to match the shipped GLB.
