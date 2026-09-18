# Ethereal spire

`spire.glb` is the hand-authored S2 dimensional spire: a low basalt hex base, a hovering shard with fragments, and a
translucent purple sphere wrapped in neon currents, with one eight-second `Spire_Loop` animation. The editable source is
`apps/game/asset-sources/ethereal/spire/spire.blend` (Blender 5.2.1, textures packed, production collection
`SPIRE_V2_PRODUCTION`). A source binary is committed only in the same change as its shipped GLB.

Rebuild from the repository root with Blender 5.2.1 and Khronos KTX-Software 4.4.2 on PATH:

```sh
blender --background apps/game/asset-sources/ethereal/spire/spire.blend --python apps/game/scripts/spires/export-spire.py
pnpm --dir apps/game optimize:spire
pnpm --dir apps/game verify:structures
pnpm --dir apps/game verify:assets
```

The optimizer resamples the clip, limits textures to 480 px, encodes them as KTX2 and applies Draco, without flattening
the animated hierarchy: six current parents intentionally reach zero scale to hide their inward-motion resets. Repeated
exports and builds match byte for byte. `scripts/spire-assets.test.mjs` pins the budget: under 768 KB, 16,140 triangles,
eight materials, six textures, one eight-second loop with both current resets hidden.

Runtime: `src/three/structures/spire-model.ts` evaluates the authored hierarchy with a stable phase per placement and
shares instanced stone draws across spires. `spire-portal.ts` composes each portal as rear light, translucent core, then
front light, splitting the currents with a per-fragment ray/sphere test so a wrapping swirl never pops across the
sphere; separate portals sort back to front on camera moves, including while animation is paused. `spire-veins.ts` keeps
the saturated vein cores and adds narrow additive shells on the shared instance buffers, because the renderer runs
without screen-space bloom. Upper bound per visible spire: 27 shared instanced draws plus 21 portal draws.

`apps/game/scripts/spires/build-spire.py` is the earlier procedural obelisk spire, kept as a variant for a later
cosmetic. It writes `spire-obelisk.glb`, which is not committed and not loaded; wiring it needs its own model path,
since the runtime spire model requires the hand-authored asset's portal metadata and clip.
