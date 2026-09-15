# S2 dimensional spire

`spire.blend` is the editable source for `public/models/ethereal/spire.glb`. The production collection is
`SPIRE_V2_PRODUCTION`: a floating shard and seven independently hovering fragments with retained neon emission, plus a
translucent purple sphere with accretion, corona and inward currents. All six textures are packed. Review cameras,
lights and compositor bloom remain in the source for art review and are excluded from export.

## Procedural terrain refit — 15 September 2026

The full basalt hex and its ground veins have been removed from source and export. Three.js owns the support surface and
gameplay-hex neon borders. Align model-local Y=0 to the occupied terrain support plane without an extra lift. The upper
shard, fragment emission, portal and all 43 animation channels retain the existing placement and motion. A comparison of
all 241 authored poses reports exactly zero upper-hierarchy matrix change. The lowest animated fragment stays at least
0.0473 above model-local ground; intended levitation is retained.

Current export: 44 authored objects, 25 mesh primitives, 11,712 triangles, eight materials, six KTX2 textures, 564,268
bytes. The former export had 29 primitives, 16,140 triangles and 603,840 bytes. Five production asset tests cover both
landmarks, base removal, compression, mine origin/contact bounds, and spire loop/reset semantics.

All review images, performance counts and live-game acceptance farther below describe the **previous base-bearing
revision**. They are retained as historical evidence, not acceptance of this terrain refit. Current source/refit checks
are recorded in `production-manifest.json`; integrated runtime acceptance belongs to the terrain branch.

## Rebuild

From the repository root, with Blender 5.2.1, the locked workspace dependencies and Khronos KTX-Software 4.4.2 on PATH:

```sh
blender --background apps/game/asset-sources/ethereal/spire/spire.blend --python apps/game/scripts/spire/export-spire.py
pnpm --dir apps/game optimize:spire
pnpm --dir apps/game verify:structures
pnpm --dir apps/game exec vitest run --config vitest.assets.config.ts scripts/spire-assets.test.mjs
```

The export script also runs inside Blender after opening this source. An optional path after `--` writes an intermediate
GLB elsewhere. It does not save over the source. Export settings: selected production objects, Y up, materials and
semantic extras, one sampled `Spire_Loop`, frames 1–241 at 30 Hz, no cameras/lights/morphs, no geometry compression in
Blender. Scene-only review metadata is omitted. The source's transforms and object metadata are retained.

The optimizer resamples with tolerance `1e-6`, limits textures to 480 pixels, encodes the normal map as UASTC and color
maps as ETC1S quality 180, stamps texture hashes, then applies Draco Edgebreaker geometry compression. It does not
flatten the hierarchy: six current parent scales intentionally reach zero to hide their inward-motion resets. Other
structure models still require unit node scales. Repeated raw exports are identical. Repeated compression was validated
for the prior revision; this refit uses the same production optimizer and its structural checks.

## Runtime boundary

The registry continues to load `/models/ethereal/spire.glb` through the shared Draco/KTX2 production loader.
`src/three/structures/spire-model.ts` evaluates the authored hierarchy with a stable phase per placement. Stone and
veins share instanced draws; the floating motion and portal retain the eight-second authored speed.

`spire-portal.ts` implements `split-depth-additive-v1` using TSL on both supported renderer backends. Each portal draws
rear light, the translucent core, then front light. The split uses a per-fragment ray/sphere intersection, so a wrapping
swirl cannot abruptly jump across the sphere when object centers cross in camera depth. Separate portal volumes sort
back to front when the camera moves, including while animation is paused. Core radius metadata is required. The earlier
standalone `portal-transparency.js` companion is a neutral-review implementation; the game uses TSL directly.

The current production renderer deliberately disables screen-space bloom. `spire-veins.ts` preserves saturated vein
cores with isolated display materials and adds narrow additive shells using the same instance buffers. This local
diffusion keeps blue, orange and pink readable without changing the authored material data or enabling global effects.
The upper-bound submission cost is 27 shared instanced draws plus 21 portal draws per visible spire, or 48 draws and
24,080 triangles for one complete model including light passes. Portal meshes are frustum culled individually; opaque
parts and vein shells share placement buffers and geometry across all spires.

## Structural acceptance

- 47 authored objects, 27 meshes / 29 glTF primitives, 16,140 triangles, eight materials and six textures.
- Production download: 603,840 bytes, versus 2,251,036 bytes before compression (73.2% smaller).
- One `Spire_Loop`, eight seconds. Scale-reset regression checks cover both resets of all six inward currents.
- Y-up bounds after compression: X `[-0.856789, 0.859484]`, Y `[0, 3.984790]` across the loop, Z
  `[-0.963426, 0.990464]`; grounded at Y=0, within a pointy hex of radius 1.
- Source solid geometry is manifold with finite coordinates, no degenerate faces or unapplied mesh scales. Thin portal
  energy surfaces intentionally have open boundaries. Source portal/shard clearance stays above 0.0696.
- 481 decoded poses retain the source motion within `1.93e-6` matrix-component error. Draco changes the maximum X bound
  by approximately `0.000041`; the footprint and grounding remain valid.

## Actual game acceptance

Validated in the live `WorldmapScene` for Eternum game 2, `eternum-fresh-01`, through
`/play/madara/eternum-fresh-01/map?spectate=true`. The authoritative world contains seven spires on each layer and 13
settled realms; no synthetic tile data or extra placements were used. Captures cover default distance 20, closest
supported distance 10 with ordinary ground-plane panning, and neighboring settlements at distance 35.

Hardware WebGPU (Intel gen-12lp) and the explicit WebGL2 fallback both load the production Draco/KTX2 asset and compile
the portal and halo shaders without device, texture or shader errors. The native canvas recording contains 9.10 seconds
at variable cadence, covering the full eight-second authored cycle. Quarter-cycle captures and the 961-pose runtime
audit cover all seven placement phases, finite transforms, exact loop closure and zero-scale current reset windows.

With other checks idle, two visible four-second samples measured spire CPU updates at 0.532/0.582 ms mean and 0.8/1.1 ms
p95. The render list contains 18 opaque and nine halo batches, each with all seven placements, plus the central portal's
21 passes; the other six portals are culled. That is 48 spire draws and 109,712 submitted triangles in this real view.
Whole-scene frame medians vary from 16.8–22.6 ms visible and 16.7–18.4 ms hidden, so these live samples do not establish
a precise isolated GPU cost. See the [recorded samples](review/worldmap-performance.json).

Cold scene loads and camera refreshes can log the existing 12-second army/structure catch-up timeout before neighboring
assets appear. These are recorded as a scene limitation; this change does not alter world synchronization.

Repository checks: full formatting, Knip, 11 focused runtime tests, three production-asset tests, compressed structure
verification and the client TypeScript/Vite/PWA build pass. The built GLB has the same SHA256 as the verified public
asset.

## Review artifacts

| Artifact                                                        | Role                                                    |
| --------------------------------------------------------------- | ------------------------------------------------------- |
| [Concept 04](review/concept-04.png)                             | Approved art direction; not a model render              |
| [Editable source](spire.blend)                                  | Packed Blender source, including separate review stage  |
| [Production export](../../../public/models/ethereal/spire.glb)  | Animated compressed game asset                          |
| [Blender render](review/blender-render.png)                     | Art review with Blender lighting and compositor glow    |
| [World map: default](review/worldmap-default.png)               | Actual game, normal gameplay camera                     |
| [World map: closest](review/worldmap-close.png)                 | Actual game, closest supported camera and adjacent army |
| [World map: neighbors](review/worldmap-neighbors.png)           | Actual game, surrounding shipped settlements            |
| [World map: WebGL2](review/worldmap-webgl-close.png)            | Supported fallback renderer, closest camera             |
| [World map: full cycle](review/worldmap-spire-loop.webm)        | Native game-canvas video; variable frame cadence        |
| [Runtime animation audit](review/worldmap-animation-audit.json) | 961 poses across seven actual placements                |

The earlier [neutral runtime preview](review/neutral-full-spire.png) is an isolated Three.js art review, not game-scene
acceptance. Exact quarter-cycle game captures: [0 s](review/worldmap-pose-0.png), [2 s](review/worldmap-pose-2.png),
[4 s](review/worldmap-pose-4.png), [6 s](review/worldmap-pose-6.png).

Earlier disk/cone portal experiments, static GLB and neutral-viewer renders are not integrated variants. This asset has
one landmark class; no extra tier family is introduced.
