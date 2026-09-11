# CREATURES / 16

User-supplied original creature artwork from `huose/biome-kit/creatures`, version 4.0.0. The 16 LOD2 GLBs retain their
textures, vertex colors, joint hierarchy and procedural animation metadata. `manifest.json` records the source manifest
hash and each imported file's hash. No license from the previous terrain prop kit applies to these assets.

The supplied `animate-creature.js` is retained as `src/three/terrain/creatures/biome-creature-animator.js`, with its
standalone loader removed. The game owns loading, navigation, terrain contact and disposal. Animation is rigid-part
procedural motion; no skeletal clips are required.

Textures are converted with `node scripts/compress-models.mjs --only biome-creatures/<file>.glb` from `apps/game`
(Khronos KTX-Software required): ETC1S color, UASTC normal/technical maps, mipmaps, and a 480px texture limit. Geometry
and procedural animation metadata are retained. After recompression, update each manifest entry’s `bytes` and SHA-256 to
match the shipped GLB.
