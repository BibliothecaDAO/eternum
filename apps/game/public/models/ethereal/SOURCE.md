# Ethereal landmarks

The spire sits on the procedural Three.js ethereal biome. Its former full-hex basalt base and ground veins are removed;
terrain owns the level support surface. Flowing neon gameplay-hex borders appear only on the ethereal layer; surface
spire patches blend whole basalt slabs into revealed neighboring terrain. The spire retains only a small rooted rock
outcropping beneath its portal. Align model-local Y=0 with the terrain top, currently 0.12, without an additional
landmark lift. It uses a radius-one pointy gameplay hex.

## Spire

The dimensional spire is built procedurally at runtime in `apps/game/src/three/structures/spire-kit.ts`
(`SPIRE_MODEL_PATH = "procedural:spire"`):

- `OUTCROP / dark rooted basalt` (`spirePart: "outcrop"`): stationary 19-column hexagonal basalt outcropping with a
  `-0.006` contact skirt and shared procedural masonry shading (1 draw, 0 textures).
- `SPIRE / Basalt` (`spirePart: "spire"`): hovering 19-column basalt shard with inward-sloping shoulders, single apex at
  `3.959`, seven floating satellite fragments, and 24 recessed vertical glowing mineral veins driven by per-vertex
  `aSpireVein` emissive channels (1 draw, 0 textures).
- `PORTAL / core` (`spirePart: "portal"`, `trueSphereRadius: 0.3` at `Y = 0.53`): spherical dimensional rift shaded with
  a live TSL void core, magenta-violet Fresnel corona, and animated plasma currents driven by `mapAnimationTime` (1
  draw, 0 textures).
- `Spire_Loop`: seamless 8-second sinusoidal vertical hover (`±0.026`) evaluated by `SpireModel`; dormant spires omit
  the portal and hold pose 0.

`apps/game/scripts/spires/build-spire.py` is the earlier procedural obelisk variant kept for a later cosmetic. It writes
`spire-obelisk.glb`, which is not committed or loaded.
