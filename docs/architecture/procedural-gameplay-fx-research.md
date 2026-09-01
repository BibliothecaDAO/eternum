# Procedural gameplay FX for Three.js

Status: research and library-scope recommendation

Research date: 2026-09-02

Scope: real-time gameplay flames, smoke, sparks, explosions, impacts, trails, beams, auras, dissolves, shockwaves,
decals, weather, and GPU particles. This document changes no production code.

Evidence policy: platform claims use first-party Three.js documentation, source, examples, and releases; W3C WebGPU
specifications; browser-vendor release notes; and the first-party three.quarks repository. Recommendations and budgets
are clearly labelled as engineering decisions rather than upstream guarantees.

## Executive decision

Build one **effect-description and lifecycle library** with two renderer implementations, not two unrelated FX stacks:

1. The production baseline is bounded CPU simulation feeding pooled `InstancedMesh`, instanced billboard quads, fixed
   ribbon buffers, simple meshes, and TSL node materials. It must render through both native WebGPU and the
   `WebGPURenderer` WebGL2 fallback.
2. Native-WebGPU compute is an optional accelerator for effects that have measured need for it: dense weather, large
   ambient particle fields, or unusually large hero effects. It is not the source of truth for an effect and must have a
   visually equivalent, lower-density fallback.
3. Full volumetric fluid fire is a research/hero tier, not the default flame primitive. Three r185 demonstrates that it
   is now possible, but its 3D simulation and ray-march cost are categorically different from a gameplay particle
   effect.

This split follows Three's own platform state. The repository uses `three@^0.185.1`
([package.json](../../client/apps/game/package.json)), matching the current
[Three r185 release](https://github.com/mrdoob/three.js/releases/tag/r185) from 1 July 2026. `WebGPURenderer`
automatically selects WebGPU or a WebGL2 backend and exposes `forceWebGL` for testing, but Three's current manual still
calls the renderer experimental and warns about missing features and differing performance
([WebGPURenderer API](https://threejs.org/docs/pages/WebGPURenderer.html),
[WebGPURenderer manual](https://threejs.org/manual/en/webgpurenderer)). Eternum already owns startup fallback,
device-loss diagnostics, and backend selection in
[webgpu-renderer-backend.ts](../../client/apps/game/src/three/webgpu-renderer-backend.ts), so the FX library should
consume that decision rather than probe or create another renderer.

The shortest useful first library is therefore not a general VFX graph. It is a small set of composable, deterministic
primitives:

- billboard particle batch;
- stretched billboard or mesh-particle batch;
- fixed-capacity ribbon;
- analytic disc/ring/shell material;
- projected decal owner;
- optional local light pulse;
- optional shared post-process contribution; and
- an orchestrator that combines those primitives into named gameplay effects.

Flame, smoke, sparks, impacts, explosions, beams, auras, shockwaves, dissolves, and weather all reduce to combinations
of these primitives. A separate bespoke runtime for every named effect would repeat pooling, visibility, disposal,
backend, and timing bugs.

## Platform state in September 2026

### What is stable enough to make the baseline

The underlying Three primitives are mature and backend-portable:

- `InstancedMesh` exists specifically to render many objects sharing geometry/material with fewer draw calls
  ([InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html)).
- `BufferGeometry` plus instanced/dynamic attributes is the correct shape for one allocation updated over time. Upstream
  supports update ranges; r185 also merged adjacent ranges in the renderer
  ([r185 renderer changes](https://github.com/mrdoob/three.js/releases/tag/r185)).
- Node materials expose `colorNode`, `opacityNode`, `positionNode`, `alphaTestNode`, `maskNode`, and custom output
  hooks; these are the right seams for procedural masks and model dissolves
  ([NodeMaterial](https://threejs.org/docs/pages/NodeMaterial.html)).
- TSL contains seeded hash/range functions, time and delta-time nodes, UV transforms, analytic circles, derivatives,
  noise functions, discard/masking, blend functions, render passes, MRT, and compute constructs
  ([TSL specification](https://threejs.org/docs/TSL.html), [TSL API](https://threejs.org/docs/pages/TSL.html)).
- Decals have an official projection geometry and example, with an explicit warning that projections can distort around
  corners ([DecalGeometry](https://threejs.org/docs/pages/DecalGeometry.html),
  [decal example source](https://github.com/mrdoob/three.js/blob/r185/examples/webgl_decals.html)).

The important Eternum-specific nuance is that “WebGL fallback” does **not** mean the legacy `WebGLRenderer`. The client
aliases ordinary Three imports to the WebGPU build
([three-webgpu-compat.ts](../../client/apps/game/src/three/three-webgpu-compat.ts)) and runs `WebGPURenderer` with
either its WebGPU or WebGL2 backend. Three explicitly says `ShaderMaterial`, `RawShaderMaterial`, `onBeforeCompile`, and
legacy `EffectComposer` are not supported by this renderer. Portable FX must therefore use node materials/TSL or
unmodified built-in materials, even when the active backend is WebGL2
([WebGPURenderer manual](https://threejs.org/manual/en/webgpurenderer)).

### What belongs behind capability gates

Native compute and storage buffers are valuable but cannot be assumed everywhere. Three documents storage buffer
attributes as compute inputs and shows GPU-written attributes feeding rendered sprites
([StorageBufferAttribute](https://threejs.org/docs/pages/StorageBufferAttribute.html),
[StorageBufferNode](https://threejs.org/docs/pages/StorageBufferNode.html)). Its official compute examples explicitly
check WebGPU availability before running. Treat storage-buffer simulation, indirect draws, atomics, storage textures,
and 3D storage textures as native-WebGPU features until an effect has separately passed the forced-WebGL lane.

Post-processing is another independent capability. Three's modern stack composes `pass()`, MRT outputs, and TSL display
nodes; selective emissive bloom is demonstrated by extracting an emissive MRT attachment and adding a bloom node
([selective bloom source](https://github.com/mrdoob/three.js/blob/r185/examples/webgpu_postprocessing_bloom_emissive.html)).
Eternum's native post-process runtime is currently disabled and reports bloom/chromatic aberration/vignette as
unsupported ([webgpu-renderer-backend.ts](../../client/apps/game/src/three/webgpu-renderer-backend.ts),
[webgpu-postprocess-runtime.ts](../../client/apps/game/src/three/webgpu-postprocess-runtime.ts)). Every effect must read
clearly without bloom; bloom, afterimage, refraction, and full-screen distortion are enhancements, not required layers.

### Browser and specification constraints

WebGPU is a W3C Candidate Recommendation Draft rather than a completed Recommendation as of this research date
([WebGPU publication history](https://www.w3.org/standards/history/webgpu/)). The specification exposes `navigator.gpu`
only in a secure context and permits adapter selection to return `null`
([WebGPU initialization](https://www.w3.org/TR/2026/CRD-webgpu-20260109/#initialization)). Runtime capability detection
and a tested fallback remain mandatory.

Shipping support is broad but still platform-specific:

- Chrome introduced WebGPU on selected ChromeOS, Windows, and macOS configurations in Chrome 113 and expanded to
  qualified Android 12+ devices in Chrome 121. Chrome's own overview points users to runtime implementation status
  rather than promising every GPU/OS combination
  ([Chrome WebGPU overview](https://developer.chrome.com/docs/web-platform/webgpu/overview)).
- Safari 26 shipped WebGPU on macOS, iOS, iPadOS, and visionOS; Safari 27 continues adding WGSL features and WebGPU
  fixes
  ([Safari 26 announcement](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/),
  [Safari 27 beta](https://webkit.org/blog/17967/news-from-wwdc26-webkit-in-safari-27-beta/)).
- Firefox first shipped on Windows in 141 and enabled Apple-Silicon macOS more broadly in Firefox 147; Mozilla's launch
  note was explicit that performance/compliance work remained and that platform rollout was staged
  ([Mozilla Graphics launch note](https://mozillagfx.wordpress.com/2025/07/15/shipping-webgpu-on-windows-in-firefox-141/),
  [Mozilla bug 1992212](https://bugzilla.mozilla.org/show_bug.cgi?id=1992212)).

This is why a native-WebGPU screenshot on one desktop is not a qualification result. The required platform contract is
feature detection plus parity on Eternum's `webgpu-auto` and `webgpu-force-webgl` modes.

## The reusable primitive toolbox

| Primitive               | Best use                                         | Portable implementation                                                                                | Native-WebGPU enhancement                                         | Main risks                             |
| ----------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | -------------------------------------- |
| Billboard batch         | flame tongues, smoke puffs, dust, motes, snow    | One plane geometry, one node material, fixed instanced attributes for position/age/size/rotation/color | Storage arrays updated by a compute kernel; indirect active count | alpha sorting and overdraw             |
| Stretched billboard     | sparks, rain streaks, projectile streaks         | Quad aligned to velocity in CPU-written instance attributes/TSL                                        | Velocity and alignment read directly from storage arrays          | camera-facing basis near zero velocity |
| Mesh-particle batch     | debris, rocks, embers at close range             | `InstancedMesh` with shared low-poly geometry/material                                                 | Compute-updated transforms                                        | triangle cost and shadows              |
| Ribbon ring buffer      | projectile trails, lightning, persistent slashes | Fixed topology; overwrite head/tail samples and update only dirty ranges                               | GPU-written sample/vertex buffers                                 | joins, camera-facing flips, capacity   |
| Analytic disc/ring      | aura, selection pulse, shockwave, ripple         | Plane/ring with radial signed-distance mask and derivative antialiasing                                | Depth-aware refraction or distortion pass                         | z-fighting and terrain conformance     |
| Shell                   | magical aura, shield, dissolve envelope          | Low-poly sphere/capsule with fresnel and noise mask                                                    | Scene-depth intersections and refraction                          | transparency ordering                  |
| Segment mesh            | beam, tracer, lightning branch                   | Camera-facing quad or low-sided tube built between endpoints                                           | Compute-generated branch/ribbon vertices                          | do not rely on native line width       |
| Decal                   | scorch, blood, spell mark, impact stain          | `DecalGeometry` at hit point/normal, capped owner and TTL                                              | Batched/projected atlas or deferred decal pass                    | per-hit geometry, corner distortion    |
| Model material modifier | dissolve, freeze/burn highlight                  | Node-material mask/edge contribution on the affected mesh                                              | Storage-driven per-instance dissolve values                       | shared-material mutation and shadows   |
| Local light pulse       | explosion flash, magic impact, flame response    | A very small pooled set of lights with bounded lifetime                                                | Clustered lights when independently qualified                     | shadows and many-light cost            |

Do not build trails or beams with `LineBasicMaterial.linewidth`. Three states that WebGL and WebGPU ignore it and render
one-pixel native lines ([LineBasicMaterial](https://threejs.org/docs/pages/LineBasicMaterial.html)). Wide effects need
mesh ribbons, tubes, or Three's fat-line node-material path. Mesh ribbons give the library direct control over joins,
UV/age, world-space width, and batching and are the safer gameplay default.

## Effect recipes

These are compositional recipes, not separate engine subsystems.

| Effect family    | Minimum readable recipe                                                                             | Optional layers                                               | Asset-free procedural construction                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Flame            | rising billboard batch with lifetime color/scale; additive bright core plus normal-alpha dark smoke | low-rate embers, unshadowed light flicker, emissive bloom     | teardrop/circle mask, upward UV warp, two-frequency hash/noise, height/life color ramp |
| Smoke            | buoyant normal-alpha billboards, increasing size, decreasing opacity, `depthWrite=false`            | curl-noise drift, ground interaction, alpha-hash variant      | soft radial mask multiplied by warped noise; seeded rotation/offset                    |
| Sparks/embers    | short ballistic stretched billboards or points with gravity, drag, and life fade                    | bounce, heat color ramp, afterimage                           | analytic thin capsule/circle mask and per-instance hash                                |
| Explosion        | one atomic timeline: flash, radial sparks, expanding smoke, ground ring                             | debris mesh batch, decal, light/camera impulse, bloom         | sphere/disc/ring geometry plus analytic particle masks; no texture required            |
| Impact           | hit-normal cone burst plus short flash and dust puff                                                | capped surface decal, debris, target material pulse           | analytic lines/circles; all direction comes from hit point and normal                  |
| Projectile trail | fixed ribbon samples aged from head to tail                                                         | particles shed from the ribbon, terminal impact               | generated strip, age-based width/color/opacity                                         |
| Beam             | camera-facing strip with bright core and soft halo                                                  | animated noise, endpoint flares, branching lightning          | signed-distance line/capsule in strip UVs; seeded subdivision for branches             |
| Aura/shield      | ground ring or low-poly shell with fresnel/noise opacity                                            | orbiting motes, intersection rim, local color grade           | radial/fresnel masks, time oscillators, hash/noise                                     |
| Dissolve         | noise threshold applied to target material plus a narrow emissive edge                              | boundary motes and terminal puff                              | TSL `maskNode`/discard or `alphaTestNode`; `smoothstep` edge band around threshold     |
| Shockwave/ripple | expanding analytic ring at the event surface                                                        | dust lift, depth-aware screen refraction for rare hero events | radial distance field with time-driven radius, width, and fade                         |
| Decal            | projected, depth-tested mark with `depthWrite=false`, TTL, and hard cap                             | normal response, animated fade                                | analytic scorch/splat mask or small generated texture; ground-only marks can be planes |
| Rain             | camera/region-centred streak batch with bounded volume and recycling                                | surface ripples/splashes, roof/terrain collision              | stretched analytic quads; hash-seeded spawn and wind                                   |
| Snow/ash         | slower billboard/point batch with drift and recycling                                               | accumulation proxy, collision, depth fade                     | analytic circles/flakes and multi-frequency lateral oscillation                        |

### Flames and smoke: use the r185 sprite pattern before fluid simulation

Three's official r185 fire/smoke example expresses stable per-instance lifetime, offset, scale, rotation, opacity, and
color with TSL `range()` and time nodes, then draws 2,000 smoke and 1,000 fire instances with node materials. Fire uses
additive blending; both layers disable depth writes
([fire/smoke example source](https://github.com/mrdoob/three.js/blob/r185/examples/webgpu_particles.html)). That is the
correct structural blueprint even if Eternum replaces the example's smoke texture with an analytic mask.

A convincing flame is a layered timing/color problem before it is a fluid problem:

1. spawn inside a narrow base volume with a deterministic seed;
2. accelerate upward while narrowing or breaking the hot core;
3. move from pale/yellow core through orange/red, then into dark smoke;
4. grow smoke while fading and drifting laterally;
5. add sparse embers that outlive the flame tongue; and
6. optionally pulse one shared local light at a much lower rate than the particles.

Normal-alpha smoke needs depth testing but usually not depth writing. Interpenetrating puffs will never sort perfectly;
Three's transparency guide says there is no universal solution. `alphaTest`, `alphaHash`, or alpha-to-coverage can trade
smooth transparency for more stable ordering, and `alphaHash` benefits from temporal antialiasing
([transparency guide](https://threejs.org/manual/en/transparency.html),
[Material transparency controls](https://threejs.org/docs/pages/Material.html)). The library should expose one tested
blend policy per batch instead of letting every effect invent depth/blend flags.

### Explosions and impacts: compose an event, do not simulate one giant particle type

An explosion reads because differently timed layers communicate different physical ideas. The initial flash should be
near-instant; sparks and debris carry the impulse; smoke expands afterward; a shock ring anchors scale on the ground.
Treat the whole composition as one logical effect handle so it starts atomically, stops deterministically, and returns
all slots to their pools together.

Impacts use the same layers with a directional basis from the surface normal. A raycast can provide the hit point and
normal for directional particles and `DecalGeometry`; the official decal example builds orientation/size from that hit,
uses `depthWrite=false`, orders decals, and explicitly removes them
([decal example](https://github.com/mrdoob/three.js/blob/r185/examples/webgl_decals.html)). Since every projected decal
creates geometry, decals require a global cap and explicit geometry/material disposal. Terrain-only scorch marks can be
much cheaper analytic ground planes if terrain slope/conformance permits.

### Trails and beams: fixed topology, moving data

Allocate a ribbon's indices and maximum vertices once. Maintain a circular sample buffer containing position, width,
age, and optionally color. Each update overwrites only the changed sample range and derives the two side vertices from
the tangent and camera/view basis. A projectile trail then costs one shared batch rather than one object per sample.

A beam is usually simpler: a single start/end segment rendered as a quad or low-sided tube, with a signed-distance core
and halo in UV space. Lightning can seed a bounded number of midpoint displacements and render the resulting segments
through the same ribbon/segment batch. Native one-pixel lines are acceptable only for tiny distant sparks, never for a
gameplay-readable beam.

### Auras, dissolves, and shockwaves: analytic materials first

Aura rings and shockwaves are ideal asset-free effects. A plane or ring can compute radial distance from UV, define an
antialiased band with derivatives, expand its radius, and fade. A shell aura adds a fresnel/view-normal rim and noise
mask. Both remain meaningful without post-processing.

Dissolve is different because it changes the target object's coverage. The clean seam is a node-material contribution on
the affected mesh: compare deterministic object/world-space noise against a progress threshold, discard below the
threshold, and color a narrow band around the boundary. `NodeMaterial` explicitly exposes `maskNode`, `alphaTestNode`,
`opacityNode`, shadow masking, and output hooks for this class of change
([NodeMaterial](https://threejs.org/docs/pages/NodeMaterial.html)). A nearby particle cloud alone is not a dissolve; it
does not remove the underlying surface. The effect must also define shadow behavior and must never mutate a material
shared by unrelated objects.

Screen-space shockwave refraction is an optional hero layer. It requires the current scene color and ideally depth, adds
a full-screen/pass cost, and must be capped. The ordinary ground ring should remain the baseline.

### Weather: bounded regional simulation, not world-sized particles

Weather should follow the camera or active region and recycle particles inside a fixed volume. The baseline updates
bounded typed arrays and uploads only dirty ranges. Terrain/roof collision can begin as height or region queries rather
than per-drop physics.

Three r185 shows the high tier clearly:

- compute rain holds 50,000 positions/velocities plus ripple state in storage arrays, renders a top-down world-position
  target for collision, and generates surface ripples
  ([compute rain source](https://github.com/mrdoob/three.js/blob/r185/examples/webgpu_compute_particles_rain.html));
- compute snow advertises 100,000 particles and similarly separates moving/static storage and collision state
  ([compute snow source](https://github.com/mrdoob/three.js/blob/r185/examples/webgpu_compute_particles_snow.html)).

Those example counts demonstrate capability, not a recommended Eternum budget. Visible coverage, fill rate, collision
pass cost, mobile thermals, and the rest of the world scene determine the real limit. Promote weather to compute only
after the portable batch has a measured CPU/upload bottleneck.

## Native-WebGPU particle and volume tier

### The official compute pattern

The r185 compute-particles example contains the reusable architecture:

1. allocate position, velocity, and color through TSL `instancedArray`;
2. run one initialization compute node;
3. run bounded update and event kernels;
4. expose storage arrays as render attributes with `toAttribute()`; and
5. draw the result with one `SpriteNodeMaterial` and one sprite/mesh count.

The official scene simulates 200,000 particles and uses the analytic `shapeCircle()` mask, so it also proves that a
GPU-particle tier need not depend on sprite textures
([compute-particles source](https://github.com/mrdoob/three.js/blob/r185/examples/webgpu_compute_particles.html)). TSL
provides barriers, atomics, storage textures, workgroup/global IDs, and indirect dispatch constructs when effects
outgrow embarrassingly parallel integration ([TSL compute specification](https://threejs.org/docs/TSL.html#Compute)).

The production rules should still be conservative:

- allocate fixed capacity once;
- use ring/free-list slot assignment, never resize a storage buffer during combat;
- keep event input small and one-way from CPU to GPU;
- avoid GPU-to-CPU readback in the gameplay loop;
- bound work by active ranges or indirect counts;
- use separate kernels only when profiling shows the split helps; and
- preserve a deterministic, lower-density CPU fallback with the same effect timing.

The official linked-particles demo is useful for GPU-written ribbons and storage-buffer links, but it searches all
particles from every particle to find neighbours. That all-pairs technique is a visual experiment, not a scalable
gameplay default
([linked-particles source](https://github.com/mrdoob/three.js/blob/r185/examples/webgpu_tsl_vfx_linkedparticles.html)).

### Volumetric fire is now real, but it is not a baseline primitive

r185 added a first-party volumetric fire example. It runs a 100 × 100 × 200 grid (two million cells), stores velocity,
dye/temperature, divergence, pressure, and curl noise in 3D textures, dispatches advection/divergence/Jacobi
projection/emission compute passes, then ray marches a `VolumeNodeMaterial`. The example uses additive volume blending,
depth-write suppression, optional blur/bloom, projected fire light, and volumetric shadows
([r185 release](https://github.com/mrdoob/three.js/releases/tag/r185),
[volumetric fire source](https://github.com/mrdoob/three.js/blob/r185/examples/webgpu_volume_fire.html)).

This is a valuable R&D reference for a single cinematic brazier, burning wonder, or menu scene. It is a poor first
choice for dozens of simultaneous gameplay fires because its cost scales with volume cells, compute passes, ray-march
steps, screen coverage, shadows, and post-processing. The library should first ship billboard flame/smoke. A volume
implementation earns production status only with a named use case and captured GPU timings on the browser/device matrix.

## Asset-free procedural material kit

One small TSL material kit can remove most texture dependencies:

- **shape masks:** circle, ring, capsule/line, rounded box, teardrop, cone, and star/spark;
- **antialiasing:** use `fwidth`/derivatives around analytic boundaries rather than hard pixel steps;
- **randomness:** hash a stable effect seed plus particle index; never call `Math.random()` during the frame loop;
- **motion:** time, normalized life, velocity, gravity, drag, oscillators, and UV rotation;
- **noise:** low-octave hash/value/simplex/MaterialX noise, with domain warping only where it materially improves shape;
- **ramps:** life/height/speed-driven color and opacity gradients; and
- **coverage:** alpha test/mask for hard particles, normal alpha for smoke, additive for energy/fire cores.

TSL already exposes `circle`, `hash`, `range`, oscillators, UV transforms, derivatives, MaterialX noise functions,
discard, and blend operations ([TSL API](https://threejs.org/docs/pages/TSL.html)). Sharing these functions also keeps
WGSL and GLSL output on the same source graph, which is safer than maintaining parallel shader strings.

Procedural does not mean “maximum noise.” Large multi-octave noise graphs increase shader compilation and fragment cost.
Use the minimum frequencies needed to break repetition, push invariant random parameters into instance attributes, and
test shader warm-up. A tiny authored texture atlas can still be the right trade for a specific art shape; the library
boundary should support it without requiring it.

## three.quarks assessment

Three's own libraries page lists `three.quarks` under particle systems
([Three libraries and plugins](https://threejs.org/manual/en/libraries-and-plugins.html)). Its current `three.quarks`
package is 0.17.1 and accepts Three 0.182+, so the peer range covers Eternum's r185
([package manifest](https://github.com/Alchemist0823/three.quarks/blob/master/packages/three.quarks/package.json)). The
project offers batched billboards, stretched billboards, mesh particles, trails, emitter shapes, curves, forces,
subemitters, texture animation, JSON loading/cloning, and an editor workflow
([three.quarks README](https://github.com/Alchemist0823/three.quarks)).

It is worth a bounded prototype, not adoption as Eternum's public abstraction:

- positive: its behavior vocabulary, batching, trails, serialization, cloning, and editor address real authoring work;
- caution: the same first-party README still lists WebGPU rendering as roadmap work and calls `quarks.nodes`
  experimental;
- consequence: it cannot be assumed to match Eternum's native WebGPU and forced-WebGL modes until representative flame,
  trail, burst, disposal, and stress scenes pass on both.

If a spike passes, implement it behind the same effect descriptors and lifecycle contract as a backend. Do not let
Quarks JSON types become gameplay APIs. If it fails parity or bundle/performance gates, retain the learned behavior
curves and use the in-house pooled batches. This preserves a reversible dependency decision.

## Eternum library scope

### Deepen the existing `three/fx` seam

Do not add another family of scene managers. FX ownership is currently spread across:

- icon, ground, and text effects in [world-fx-backends.ts](../../client/apps/game/src/three/fx/world-fx-backends.ts),
  [fx-manager.ts](../../client/apps/game/src/three/managers/fx-manager.ts), and
  [resource-fx-manager.ts](../../client/apps/game/src/three/managers/resource-fx-manager.ts);
- selected-hex particles and auras in [particles.ts](../../client/apps/game/src/three/managers/particles.ts) and
  [aura.ts](../../client/apps/game/src/three/managers/aura.ts);
- combat projectiles and impacts in
  [arrow-projectile-system.ts](../../client/apps/game/src/three/projectiles/arrow-projectile-system.ts),
  [melee-impact-system.ts](../../client/apps/game/src/three/combat/melee-impact-system.ts), and
  [combat-presentation-coordinator.ts](../../client/apps/game/src/three/combat/combat-presentation-coordinator.ts); and
- weather and movement flourishes in [rain-effect.ts](../../client/apps/game/src/three/effects/rain-effect.ts),
  [lightning-effect-system.ts](../../client/apps/game/src/three/scenes/lightning-effect-system.ts),
  [terrain-dust-interactions.ts](../../client/apps/game/src/three/terrain/terrain-dust-interactions.ts), and
  [terrain-water-interactions.ts](../../client/apps/game/src/three/terrain/terrain-water-interactions.ts).

The last two terrain pools are the strongest implementation precedent: bounded typed state, `InstancedMesh`, one draw
per family, per-instance attributes, TSL node materials, explicit statistics, deterministic ordering, and idempotent
disposal. The new library should generalize that pattern behind `client/apps/game/src/three/fx`, then migrate and delete
the bespoke managers as each replacement becomes trustworthy.

The target is one deep **module** named `WorldFxRuntime`. Its **interface** is semantic; callers describe the gameplay
cue, not particles, shaders, blend modes, or pool slots:

```ts
export interface WorldFxRuntime {
  emit(cue: TransientWorldFxCue): WorldFxHandle;
  sync(emitters: readonly PersistentWorldFxEmitter[]): void;
  update(deltaSeconds: number): void;
  getStats(): WorldFxStats;
  dispose(): void;
}
```

Construction accepts dependencies rather than discovering them: scene, camera resolver, renderer FX capabilities, and
render profile. `emit()` makes one logical player/event effect visible atomically. `sync()` is the authoritative path
for persistent presentation such as structure fire or status aura: records are keyed by a stable emitter ID, and absence
from the next snapshot ends the emitter. `update()` is called once by the owning scene. `dispose()` removes the root
group and every owned GPU resource.

```text
provisional/indexed gameplay event ──► emit(cue) ───────┐
RECS/actor presentation snapshot ───► sync(emitters) ──┤
scene frame ─────────────────────────► update(dt) ──────┤
                                                       ▼
                                                WorldFxRuntime
                                                       │
                       recipes + scheduler + LOD + capacity policy
                                                       │
             ┌──────────────┬────────────┬─────────────┼────────────┐
             ▼              ▼            ▼             ▼            ▼
        billboard       stretched      ribbon      ring/decal    shard/light
          batches        batches        batch         batches       pools
```

The interface invariants are:

- FX never read or write gameplay authority. Cairo/RECS still decide damage, ownership, death, and persistent state.
- The same cue kind, seed, and logical time produce the same effect timeline.
- Every transient cue has an internal lifetime; every persistent emitter is ended when it expires from `sync()`.
- Pool exhaustion drops or degrades effects by an internal semantic priority and increments a visible diagnostic. It
  never allocates an emergency mesh/material or grows a buffer during gameplay.
- Non-finite positions, directions, durations, or scales fail loudly in development.
- Renderer mode changes implementation detail, not cue timing or meaning.
- `end()`, `dispose()`, scene teardown, fallback, and device loss all settle handles and return slots exactly once.

### Keep recipes internal

Named effects are internal recipes that fan one semantic cue into shared batch writes. Do not expose a generic node
graph, shader strings, emitter behavior arrays, or arbitrary material flags in the first interface. Those would make
every caller learn the implementation and turn the module shallow.

The implementation starts with these pooled families:

1. additive analytic billboards for flame cores, flashes, sparks, and energy;
2. normal-alpha or alpha-hash billboards for smoke, dust, and mist;
3. velocity-stretched billboards for embers, rain, and fast projectile streaks;
4. one fixed ribbon/segment batch for trails, beams, lightning, and slash arcs;
5. analytic ground rings/decals for impacts, telegraphs, auras, ripples, and shockwaves;
6. low-poly instanced shards for debris and splinters; and
7. a very small unshadowed light-pulse pool.

One shared TSL shape/noise kit supplies circle, ring, capsule, teardrop, soft radial mask, stable hash, life ramps, and
minimal turbulence. Recipes combine those functions; they do not copy node graphs.

### Callers and truth flow

- `CombatPresentationCoordinator` emits muzzle, trail, material-specific hit, melee-contact, and explosion cues. Its
  existing provisional/indexed dedupe remains the authority for whether a presentation should replay.
- The procedural dragon action supplies its current mouth/target snapshot while the fire phase is active. The FX module
  renders breath but does not own attack timing or damage.
- Army and structure presentation layers sync authoritative status emitters such as burning, healing, shield, or capture
  aura. They resolve world anchors before crossing the seam; the FX module never queries RECS.
- Weather supplies bounded regional emitter snapshots. Existing rain and terrain interaction systems migrate only after
  the common pools match their current behavior and diagnostics.
- Existing icon/resource/text callers may temporarily keep their current facades, but those facades should delegate to
  `WorldFxRuntime` and then be deleted once call sites use semantic cues directly.

### First production slices

Build three slices after the gym and primitive pools:

1. **Flame loop and dragon breath.** A persistent flame proves looping lifecycle, smoke transparency, embers, optional
   light, moving anchors, and degradation without bloom. Dragon breath reuses the same flame/smoke/ember primitives plus
   the ribbon batch and the existing dragon fire phase/release signals.
2. **Projectile and melee impacts.** Ground, metal, wood, water, cannon, and melee recipes consume the existing
   swept-hit position/normal/material. This proves atomic bursts, directional basis, decals, shards, and impact cleanup.
3. **Aura, shockwave, and defeat.** Analytic ground/shell effects prove persistent `sync()` ownership. Dissolve follows
   only after there is a safe node-material contribution seam that cannot mutate shared actor materials.

After these slices, migrate lightning and bounded weather. Native compute weather and volumetric fire remain separate
promotions that require captured evidence.

### Quarks decision spike

Timebox one throwaway comparison between the native TSL pools and `three.quarks` 0.17.1 using the same flame, trail, and
burst fixtures. Compare native WebGPU, forced WebGL2, bundle cost, draw calls, warm-up, disposal, editor round-trip, and
50-effect stress behavior. Keep `WorldFxRuntime` independent of either implementation, select one implementation, and
delete the loser. Do not land two permanent implementations unless both serve a measured production need.

### Explicit non-goals for the first library

- no fluid-grid or ray-marched volumetric fire in ordinary gameplay;
- no WebGPU-only cue;
- no gameplay damage, collision authority, or event reconciliation inside FX;
- no public JSON/visual graph format before the semantic recipes stabilize;
- no per-effect mesh, material, texture, timer, or animation-loop ownership;
- no dependence on bloom, refraction, or other currently disabled post-processing; and
- no wholesale weather rewrite before flame and impact prove the common runtime.

## Library-wide performance and lifecycle rules

These should be invariants, not advice each effect author must remember:

1. **Batch by geometry, material graph, blend mode, and depth policy.** One active effect instance is data in a shared
   batch, not its own mesh/material.
2. **Pool fixed-capacity slots and handles.** Gameplay spawn/stop performs no geometry, material, texture, or render
   target allocation.
3. **Deterministic seed plus normalized life.** The same descriptor, seed, and simulation time produces the same frame.
4. **Clamp or fixed-step simulation.** A resumed hidden tab must not teleport every particle through unbounded delta.
5. **Cull at emitter/cell level.** Offscreen effects may advance logically without updating every particle. A gameplay
   event becomes visible atomically; ambient work may be spread.
6. **Update only dirty ranges.** Reuse typed arrays and mark the narrow range changed during a frame.
7. **No gameplay collision per particle.** Use analytic ground/height fields, coarse render targets, or a small logical
   proxy. Visual particles never decide gameplay outcomes.
8. **Bound transparency and light cost.** Normal-alpha smoke is usually fill-rate/sorting limited; shadowed lights are
   not a particle primitive.
9. **Warm representative variants.** Compile the batch material/depth/blend variants before the first live battle.
10. **Every owner disposes.** Removing an object from the scene does not free its GPU resources. Three requires explicit
    disposal of geometries, materials, textures, and render targets
    ([Three disposal guide](https://threejs.org/manual/en/how-to-dispose-of-objects.html)).

Do not establish device tiers by headline particle counts. First measure an effect composition inside the real world
scene; then choose capacity, simulation rate, collision resolution, and optional layers per existing render profile.
This follows the repository's evidence-before-optimization rule.

## Testing, profiling, and acceptance

### Deterministic tests

- seeded spawn count, position envelope, and parameter generation;
- burst timelines at exact phase boundaries;
- lifetime/TTL expiry and slot reuse;
- fixed-step equivalence across different frame-delta sequences;
- handle end/cancel/dispose idempotence;
- pool exhaustion behavior with a loud development diagnostic; and
- backend selection never changing effect semantics or gameplay state.

### Visual qualification

Create an isolated FX gym with a fixed camera, neutral and representative terrain, controllable seed, and scrubbed
simulation time. Capture canonical frames at spawn, peak, decay, and completion for both:

- `webgpu-auto` resolving to native WebGPU; and
- `webgpu-force-webgl` resolving to the WebGL2 backend.

Use tolerant image comparison for backend raster differences, plus human checks for transparency order, terrain
intersection, top-down readability, fast camera pan, zoom extremes, HDR/tone mapping, and post-processing disabled.
Every named effect must still communicate its event when optional particles or post layers are suppressed.

### Stress and lifecycle scenes

- 1, 10, and 50 simultaneous small effects, then representative mixed combat;
- repeated spawn/end cycles until every pool slot has been reused many times;
- low/high DPR, desktop/mobile viewport, resize, and background-tab resume;
- camera cut while ribbons, smoke, and decals are alive;
- backend initialization fallback and WebGPU device loss; and
- decal cap, light cap, particle cap, and post-effect cap saturation.

After warm-up, record CPU simulation/update time, GPU frame time, draw and compute calls, active particles/emitters,
bytes uploaded, pool saturation, and resource counts. Three's common renderer `Info` exposes render/compute calls,
primitives, programs, attributes, textures, render targets, storage attributes, and tracked byte sizes
([Info](https://threejs.org/docs/pages/Info.html)). Eternum already has renderer diagnostics and GPU telemetry seams;
FX-specific counters should feed them instead of creating a second profiler.

Pass conditions are comparative and evidence-backed:

- no steady-state JS allocation churn in the update loop;
- draw calls scale with batch classes, not live effect instances;
- memory/resource counters return to the warmed baseline after all effects end;
- forced-WebGL and native-WebGPU timelines have the same visible event phases;
- the first live effect does not trigger an un-warmed pipeline hitch; and
- any WebGPU compute implementation proves a material frame-time or upload improvement over the portable batch on its
  target device class.

## Recommended delivery order

1. **Gym and contract:** deterministic clock/seed, effect handle, capacity diagnostics, backend matrix, screenshots, and
   counters.
2. **Portable primitives:** billboard, stretched billboard, ribbon, analytic ring/shell, decal owner, and pooled light.
3. **First compositions:** flame/smoke, impact, explosion, projectile trail, beam, aura, and shockwave.
4. **Material integration:** dissolve plus target-highlight hooks, including shadow behavior.
5. **Weather:** portable bounded rain/snow/ash, then measure whether compute is justified.
6. **Enhancements:** shared selective bloom/afterimage/refraction only after the renderer post stack is enabled and
   qualified.
7. **R&D:** Quarks backend spike and one bounded volumetric-fire hero use case; neither blocks the core library.

The first production proof should be **one flame composition plus one impact/explosion composition** in the gym and in
live gameplay. Together they exercise looping and one-shot lifecycles, additive and normal-alpha blending, multiple
particle batches, analytic masks, light/post capability degradation, deterministic orchestration, pooling, and teardown.

## Primary source index

- Three.js, [r185 release notes](https://github.com/mrdoob/three.js/releases/tag/r185), 1 July 2026.
- Three.js, [WebGPURenderer manual](https://threejs.org/manual/en/webgpurenderer) and
  [API](https://threejs.org/docs/pages/WebGPURenderer.html).
- Three.js, [TSL specification](https://threejs.org/docs/TSL.html), [TSL API](https://threejs.org/docs/pages/TSL.html),
  and [NodeMaterial API](https://threejs.org/docs/pages/NodeMaterial.html).
- Three.js r185 examples:
  [fire/smoke particles](https://github.com/mrdoob/three.js/blob/r185/examples/webgpu_particles.html),
  [compute particles](https://github.com/mrdoob/three.js/blob/r185/examples/webgpu_compute_particles.html),
  [compute rain](https://github.com/mrdoob/three.js/blob/r185/examples/webgpu_compute_particles_rain.html),
  [compute snow](https://github.com/mrdoob/three.js/blob/r185/examples/webgpu_compute_particles_snow.html),
  [linked particles](https://github.com/mrdoob/three.js/blob/r185/examples/webgpu_tsl_vfx_linkedparticles.html),
  [volumetric fire](https://github.com/mrdoob/three.js/blob/r185/examples/webgpu_volume_fire.html),
  [selective bloom](https://github.com/mrdoob/three.js/blob/r185/examples/webgpu_postprocessing_bloom_emissive.html),
  and [decals](https://github.com/mrdoob/three.js/blob/r185/examples/webgl_decals.html).
- Three.js, [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html),
  [StorageBufferAttribute](https://threejs.org/docs/pages/StorageBufferAttribute.html),
  [StorageBufferNode](https://threejs.org/docs/pages/StorageBufferNode.html),
  [Material](https://threejs.org/docs/pages/Material.html),
  [LineBasicMaterial](https://threejs.org/docs/pages/LineBasicMaterial.html),
  [DecalGeometry](https://threejs.org/docs/pages/DecalGeometry.html), [Info](https://threejs.org/docs/pages/Info.html),
  and [resource disposal](https://threejs.org/manual/en/how-to-dispose-of-objects.html).
- W3C GPU for the Web Working Group, [WebGPU publication history](https://www.w3.org/standards/history/webgpu/) and
  [WebGPU initialization](https://www.w3.org/TR/2026/CRD-webgpu-20260109/#initialization).
- Chrome for Developers, [WebGPU overview](https://developer.chrome.com/docs/web-platform/webgpu/overview) and
  [troubleshooting/secure-context requirements](https://developer.chrome.com/docs/web-platform/webgpu/troubleshooting-tips).
- WebKit,
  [Safari 26 WebGPU announcement](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/)
  and [Safari 27 beta changes](https://webkit.org/blog/17967/news-from-wwdc26-webkit-in-safari-27-beta/).
- Mozilla Graphics,
  [Shipping WebGPU on Windows in Firefox 141](https://mozillagfx.wordpress.com/2025/07/15/shipping-webgpu-on-windows-in-firefox-141/)
  and [macOS rollout bug 1992212](https://bugzilla.mozilla.org/show_bug.cgi?id=1992212).
- three.quarks, [repository and README](https://github.com/Alchemist0823/three.quarks),
  [runtime package manifest](https://github.com/Alchemist0823/three.quarks/blob/master/packages/three.quarks/package.json),
  and [first-party documentation](https://docs.quarks.art/docs).
