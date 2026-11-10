# CREATURES / 16

User-supplied original creature artwork from `huose/biome-kit/creatures`, version 4.0.0. The 16 LOD2 GLBs retain their
textures, vertex colors, joint hierarchy and procedural animation metadata. `manifest.json` records the source manifest
hash and each imported file's hash. No license from the previous terrain prop kit applies to these assets.

The supplied `animate-creature.js` became `src/three/terrain/creatures/biome-creature-animator.js`: its standalone
loader is removed and its motion is now the game's own, stepped by the ground an animal covers and posed for what it is
doing. It still reads the joints, leg lengths and gait phases the models carry. The game owns loading, navigation,
terrain contact and disposal. Animation is rigid-part procedural motion; no skeletal clips are required.

Each species is drawn at the size `biome-creature-catalog.ts` gives it, not at the size it was authored. Judge a change
to either on `/lab/wildlife`.

Textures are converted with `node scripts/compress-models.mjs --only biome-creatures/<file>.glb` from `apps/game`
(Khronos KTX-Software required): ETC1S color, UASTC normal/technical maps, mipmaps, and a 480px texture limit. Geometry
and procedural animation metadata are retained. After recompression, update each manifest entry’s `bytes` and SHA-256 to
match the shipped GLB.
