# Procedural terrain window sync — Codex brief

Motto: **KISS, always. Systemic fixes over point patches. Success of systemic work is deletion.**

Context: with the procedural biomes wired into the worldmap, two symptoms show up in live play — exploration fog lands
near the right hexes instead of on them, and biomes take seconds to pop in after a pan. A `[TerrainDebug] present` trace
from one session convicts three separate causes. None of them is "the camera window is too wide": the window is already
bounded to 4×4 visual pages around the camera focus. What is unbounded is the work each camera sample and each
streamed-in page triggers, and the fog mask never scaled with the window.

Evidence line (one of many identical ones, ~10 per second while panning):

```
[TerrainDebug] present {"pages":["-24,-24","-24,-48","-24,0","-24,24","-48,-24","-48,-48","-48,0","-48,24",
  "0,-24","0,-48","0,0","0,24","0,48","24,-24","24,-48","24,0","24,24","24,48","48,-24","48,-48","48,0","48,24","48,48"],
  "root":{"bboxMin":[-64.9,-0.4,-55.7],"bboxMax":[103.9,1.8,90.2],"meshCount":52,
  "meshes":["terrain-exploration-fog-field:terrain-exploration-mist:4v:vis",...]}}
```

23 procedural pages for a 16-page visual window; one 4-vertex fog sheet stretched over 169 × 146 world units.

---

## 1. Align the procedural page grid to the visual page grid

The visual window pages hexes from `getVisualTerrainPageOrigin()` = `getRenderBounds(0, 0, 48, 24).min` = `(-12, -12)`
(`worldmap.tsx:4825`, `chunk-geometry.ts:35-39`). The procedural terrain pages the _same_ cells from origin `(0, 0)` via
`floor(col / 24) * 24` (`worldmap-procedural-terrain.ts:257-260`). The two grids are offset by half a page, so every
visual page straddles four procedural pages — 16 visual pages become up to 25 procedural pages, which is the 22–23 in
the trace.

The cost is not just page count. Each visual page that streams in changes the cell set (and the one-ring halo) of four
procedural pages, so the signature cache in `WorldmapProceduralTerrain.presentAsync` misses on all four and the worker
rebuilds four pages per landing.

**Fix:** one procedural page per visual page, keyed identically. `WorldmapProceduralPresentationInput` gains a
`pageOrigin: { col, row }`; `resolvePageKey` pages relative to it; `applyTerrainPresentationComposite` passes
`this.getVisualTerrainPageOrigin()`. Page keys are already `"${startRow},${startCol}"` on both sides, so once the origin
matches the keys match — assert that in a test rather than trusting it. Update `terrain-benchmark-fixture.ts`
(`terrainBenchmarkPageKey`) and the `worldmap-procedural-terrain.test.ts` partition test to the origin-aware keying.

**Gate:** once every target page of a window has landed and the `retainedPageMs` (350 ms) retention of the previous
window has expired, the `terrain_composite_rebuilt` trace lists exactly the 16 keys in `visualTerrainWindowPageKeys`.
During a transition the previous window's pages are intentionally retained (`retainVisualTerrainPagesOutsideWindow`,
`worldmap.tsx:4833`) so the composite may legitimately list up to two windows' worth of keys — do not assert on the
transient set.

## 2. Make `presentAsync` incremental — never discard prepared work

`applyVisualTerrainPagePresentation` calls `applyTerrainPresentationComposite` on every page commit
(`worldmap.tsx:5362`), and `refreshVisualTerrainWindowForFocus` calls it on every window change (`:4790`). Each call
runs `presentAsync` over the whole window (`worldmap-procedural-terrain.ts:79-105`), which:

- puts the orchestration `generation` into the page request signature (`worldmap-procedural-terrain.ts:271`) **and**
  into the prepared-page fingerprint (`terrain-page-builder.ts:344`). Every camera-window change increments
  `visualTerrainGeneration` (`worldmap.tsx:4771`), so after any window change every page misses the signature cache,
  gets rebuilt in the worker, and then — because the fingerprint changed too — gets its GPU geometry recreated in
  `present()` (`procedural-terrain.ts:239`) even though not one cell changed. This alone defeats the cache on every pan.
- awaits _every_ page build before checking the revision, then drops the entire result if a newer call arrived (`:100`,
  `:104`);
- writes the prepared-page cache only on commit (`:174-175`), so a superseded run's pages are thrown away and the next
  run rebuilds them from scratch.

While the camera pans (66 ms sample) and pages stream in, runs keep superseding each other; the worker rebuilds the same
pages repeatedly and nothing commits until everything goes quiet. That is the slow biome pop-in.

**Fix (three parts, all in the terrain package):**

- Remove `generation` from terrain build identity: drop it from `createRequestSignature` and from
  `fingerprintPreparedPage`. A page's identity is its cells, halo, climate, map centre, density, subdivisions, and style
  version — nothing about which orchestration pass asked for it. If `generation` is then unread on `TerrainPageRequest`,
  delete the field (wired or deleted); if the worldmap still needs it for stale-drop bookkeeping, keep it on the
  worldmap side only.
- Cache prepared pages as they arrive, keyed by `pageKey` + signature, independent of whether the run that requested
  them commits. A superseded run's work becomes the next run's cache hits. Keep the cache bounded to the current request
  set plus the previous one — no TTLs, no timers.
- Do not re-request a page that is already in flight for the same signature; share the pending promise. The revision
  check stays as the single commit gate.

Add `proceduralReusedPages` next to `proceduralBuiltPages` in the `terrain_composite_rebuilt` trace
(`worldmap.tsx:5887`) — the diagnostics already carry `reusedPages`; the trace just doesn't print it.

Keep the halo in the signature (it changes surface blending at page edges), but note in a comment that a landing
neighbour legitimately rebuilds the pages it borders — that is one ring, not the whole window.

Do **not** add a second optimistic/coalescing channel in `worldmap.tsx`. If the per-landing composite rebuild is still
too chatty after this, the fix is in the same place: coalesce consecutive `presentAsync` calls into the in-flight one,
not a new scheduler.

**Gate:** a window change with no cell changes reports `proceduralBuiltPages: 0` and reuses every page in `present()`
(no `createPresentedPage` calls — assert via a unit test on `ProceduralTerrain.present` with two requests differing only
in generation). While panning across fresh territory, `proceduralBuiltPages` ≤ the number of newly landed visual pages
plus their halo ring, and `proceduralReusedPages` ≥ `proceduralBuiltPages` after the first window. Biomes appear within
one worker page build of their visual page landing, not after the pan ends.

## 3. Size the fog mask from its bounds — fog lands on unexplored hexes only

`TERRAIN_FOG_MASK_RESOLUTION = 64` (`terrain-fog-mask.ts:3`) is fixed, and the mask bounds are the union of all shroud
instances in the window (`:54-66`). At the traced window that is 2.7 × 2.3 world units per texel — larger than a hex (√3
≈ 1.73 wide, 2.0 tall at `HEX_SIZE = 1`). `rasterizeFogCell` only marks texel centres inside the hex (`:68-88`), so an
unexplored hex gets zero or one texel depending on where it falls, and `LinearFilter` on the `DataTexture` smears
whatever it got roughly 1.5 hexes across the frontier. Fog appears near the right tiles, and bleeds onto explored ones.
The 64 was sized for the gallery fixture in `454584cb05`, not for a 96-hex window.

Resolution is not the only leak. The fog material samples the mask at a **warped UV**:
`texture(maskTexture, uv().add(maskWarp))` with `maskWarp` up to ±0.012 in UV space (`terrain-fog-field.ts:231-233`). UV
space is the whole mask sheet, so at a 170-unit window that is ±2 world units — more than a hex — of animated sampling
offset, independent of texture resolution. Only `deepFog` reads the unwarped `baseMask` (`:240`); the opacity that
decides whether an explored hex shows mist reads the warped one. No resolution fixes this.

Fog exists **only** for unexplored hexes: `prepareTerrainShroudInstances` filters `!cell.explored`
(`terrain-shroud.ts:14-20`), and `explored` is `biome !== null` (`worldmap-procedural-terrain.ts:239-255`). That
contract is correct and must stay; the mask has to honour it at any window size.

**Fix:**

- Delete the mask-coordinate warp. Sample the mask once at `uv()` and use it for both frontier opacity and deep fog.
  Keep the motion in the channels that cannot move the boundary: `mistNoise` already drives `cloudVeil`, `edgeLight`,
  and `opacityMotion`. If the edge looks too static afterwards, modulate the opacity along the existing `edgeBand`,
  never the sample position.
- Derive the mask resolution from the bounds at a fixed texel density — 4 texels per hex width is enough to keep the hex
  edge crisp through linear filtering (≈ 400 × 300 for this window, ~120 KB, trivial for the worker). Keep the 32..1024
  clamp in `requireMaskResolution` as the bounded-texture contract, but let the bounds pick the value inside it rather
  than a constant. The `DataTexture` in `TerrainFogField` is currently allocated once at 64×64; it needs to be recreated
  when the mask resolution changes (dispose the old one — no growth). Non-square bounds should get non-square masks; do
  not pad to a square.

If per-hex texel density makes the worker's `buildTerrainFogMask` measurably slow at the 1024 clamp, page the fog
alongside the terrain (one mask per procedural page) instead of raising the clamp — the page keys from item 1 already
give you the partition.

**Frontier fade stays.** `encodeFogDistanceMask` deliberately encodes frontier cells at 0.18 rising to 1.0 toward deep
fog (`terrain-fog-mask.ts:143-151`), and `terrain-fog-mask.test.ts:17` pins that. Keep it — the mist thinning at the
edge of the known world is the visual contract; what must not happen is mist on the explored side of that edge.

**Gate:** a test at window scale (16 pages, 96 hexes across, with an explored region inside) asserts that the mask has ≥
4 texels per hex width; every explored hex centre samples 0; every non-frontier unexplored hex centre samples ≥ 0.9;
every frontier hex centre samples > 0 and ≤ its deep neighbours. `terrain-fog-production-wiring.source.test.ts` asserts
the material has no `uv().add(` sample. Live: fog covers exactly the unexplored hexes at every zoom, thinning only
inside the frontier hex; no mist over explored hexes at any point of the animation; reveal animation still clears the
right hex.

## 4. Cleanup

The uncommitted `terrainDebugLog` / `describeTerrainRoot` instrumentation in `procedural-terrain.ts` and the `clear` log
in `worldmap-procedural-terrain.ts` served to convict the above. Delete them once the gates pass; the
`terrain_composite_rebuilt` trace and `recordWorldmapRenderDuration("terrainPreparedMs")` already carry the numbers the
gates need. Keep the `setQualityTier(this.qualityTier)` constructor call and the updated
`terrain-ground-production-wiring.source.test.ts` — that change is unrelated and correct.

## Validation

- Focused tests: `worldmap-procedural-terrain.test.ts`, `terrain-fog-mask.test.ts`, `terrain-fog-field.test.ts`,
  `terrain-benchmark-fixture.test.ts`, `terrain-shroud-production-wiring.source.test.ts`; then the full `apps/game`
  suite via `pnpm test` (known contention flakes: `instanced-model.material-semantics`, `game-entry-preload`,
  `play-asset-manifest`); typecheck, `pnpm run format`, `pnpm run knip`.
- Live gates: 16 procedural pages for a 4×4 window; biomes visible within one page build of landing while panning; fog
  on unexplored hexes only, crisp at the frontier at all three camera views; no growth in `getShroudStats().maskBytes`
  or prepared-page cache size across a 100-page traversal and return to origin.
