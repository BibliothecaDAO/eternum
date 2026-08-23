# Procedural character performance evaluation

## Goal

The crowd benchmark answers one narrow production question: can the client present 100 visible procedural foot units,
all moving at once, within a 60 FPS frame budget? Combat, projectiles, horses, and ragdolls remain covered by the
separate mixed-crowd smoke test so their nondeterministic timing cannot move the walking baseline.

## Standard walking workload

The **60 FPS walking profile** fixes the variables that materially affect comparisons:

- 1440 × 900 CSS-pixel viewport;
- WebGL2 production fallback unless another renderer is explicitly requested;
- 100 visible foot units across all three upgrade tiers;
- every unit moving with the same deterministic seed, gait, and route simulation;
- deterministic presentation collisions enabled for all 100 units, using the production spatial hash and bounded
  separation profiles;
- three staggered animation lanes, producing 20 Hz bone poses at a 60 Hz render rate while root movement remains
  render-rate;
- device pixel ratio capped at 1;
- no arrows, melee impacts, deaths, active Jolt bodies, real shadows, or camera orbit;
- all 100 map hexes visible.

The benchmark calibrates the browser window's refresh rate, discards 60 warm-up frames, and records the next 240 frames.
WebGL2 GPU time comes from asynchronous `EXT_disjoint_timer_query_webgl2` queries, so measurement does not stall
rendering.

## Gate

| Signal            | Gate                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------- |
| On-screen cadence | At least 59 FPS with p95 at or below 17.17 ms when the calibrated display supports 60 Hz |
| CPU frame work    | p95 at or below 16.67 ms                                                                 |
| GPU frame work    | p95 at or below 16.67 ms when timer queries are supported                                |
| Draw calls        | At most 800                                                                              |
| Triangles         | At most 2,000,000                                                                        |
| Population        | 100 actors, 100 running, 0 ragdolls                                                      |
| Collision load    | 100 presentation bodies, no dropped pairs; collision CPU remains inside total CPU p95    |
| Framing           | 100 of 100 hexes visible at 1440 × 900                                                   |
| Runtime health    | No browser errors or horizontal overflow                                                 |

A calibrated display below 59 Hz produces `display-limited`, not a false workload failure. That result passes only when
both CPU and GPU p95 still fit the 16.67 ms budget. An uncapped browser run is used to verify throughput above 60 FPS on
such a machine.

## Run the loop

Start the game client, then run:

```bash
pnpm --dir client/apps/game benchmark:procedural-characters -- \
  --base-url https://127.0.0.1:4174 \
  --renderer-mode webgpu-force-webgl \
  --headed \
  --output output/procedural-character-performance.json
```

On a display-limited automation window, confirm uncapped throughput with:

```bash
AGENT_BROWSER_ARGS='--disable-frame-rate-limit,--disable-gpu-vsync,--disable-background-timer-throttling,--disable-renderer-backgrounding' \
pnpm --dir client/apps/game benchmark:procedural-characters -- \
  --base-url https://127.0.0.1:4174 \
  --renderer-mode webgpu-force-webgl \
  --headed \
  --output output/procedural-character-performance-uncapped.json
```

`output/` is ignored. Reports remain local and can be compared without adding captures to a pull request.

For real-time tuning, open `/debug/procedural-character-benchmark`, choose **60 FPS walking profile**, adjust animation
lanes, pixel ratio, gait, and population controls, then select **Measure**. The HUD reports the calibrated state, sample
progress, presentation FPS, one-percent-low FPS, total/animation/collision CPU p95, GPU p95, draw calls, triangles,
collision pairs, dropped pairs, and active LOD settings.

Run the mixed lifecycle proof separately:

```bash
pnpm --dir client/apps/game smoke:character-benchmark -- \
  --base-url https://127.0.0.1:4174 \
  --renderer-mode webgpu-force-webgl \
  --headed
```

The mixed smoke also enforces the mount-skeleton envelope. It compares every horse bone's parent-relative offset with
its bind offset during animation, active Jolt ragdoll, respawn, and five resets. Animated mounts must remain at or below
`1.10×`; ragdolls must remain at or below `1.50×`. This catches finite but visually catastrophic skin stretching that
ordinary physics-body, constraint, and resource counts cannot detect. It separately samples saddle-to-hoof reach during
incremental population loading and rejects more than `3×` character scale, catching stale staging-origin contacts even
when every bone retains its authored length.

## Current reference result

The pre-optimization walking baseline was 33.7 ms average, 40.7 ms p95, 1,068 draw calls, and 2.19 million triangles
(about 30 FPS). After adding production collision separation, the final fixed WebGL2 reference run is 12.01 ms average,
17.10 ms presentation p95, 83.26 observed FPS, 55.25 FPS one-percent low, 13.10 ms total CPU p95, 4.06 ms GPU p95, 404
draw calls, and 1.79 million triangles. The spatial hash carried 100 bodies, considered 411 nearby pairs, resolved 21
contacts, dropped zero pairs, peaked at 0.083 m visual offset, and cost 0.20 ms CPU p95.

The gains come from five reusable production policies:

1. inactive tier skeletons stay detached from the live scene graph;
2. bone and socket matrices update once per pose instead of recursively per limb;
3. large crowds stagger bone poses across three deterministic lanes while preserving render-rate root movement and
   every-frame ragdoll synchronization;
4. crowd-only micro detail is culled and compatible outfit/equipment meshes are consolidated without changing the hero
   gym assets, textures, sockets, cosmetics, or ragdoll rig;
5. walking collisions use bounded presentation proxies and a spatial hash, while Jolt bodies are created only for the
   small authoritative ragdoll budget.
