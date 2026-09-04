# Procedural Biome Terrain — self-verification layer

Status: proposed

Date: 2026-08-22

Companion to [Procedural Biome Terrain — architecture and delivery brief](./procedural-biome-terrain-codex-brief.md).

## Outcome

An agent changing procedural terrain must be able to answer five questions with saved evidence:

1. Did the exact deterministic terrain requested by the fixture render?
2. Does it look intentional at the camera distances players actually use?
3. Did it preserve biome, fog, structure-pad, and gameplay readability?
4. Did preparation, upload, frame, draw-call, triangle, and memory costs remain inside policy?
5. Did the same production material path work through native WebGPU and the maintained WebGL2 fallback?

The answer is one machine-readable verdict, not a collection of console screenshots an agent interprets differently on
every run.

```text
pnpm --dir apps/game verify:terrain --suite quick
  -> deterministic captures
  -> structural invariants
  -> renderer and page metrics
  -> baseline comparison
  -> contact sheets for visual review
  -> aesthetic rubric review
  -> terrain-verification-verdict.json
```

The layer is both automated and honest about what automation can prove. Pixel statistics can detect a blank frame,
clipping, seams, exposure drift, or an unintended change. They cannot decide whether a forest feels beautiful. Semantic
aesthetic judgment therefore comes from an agent reviewing fixed screenshots against a fixed rubric, and the first
approved visual baseline remains a user decision.

## Existing pieces to reuse

The repository already has most of the operational vocabulary:

- `/debug/three-chunks` proves that an unauthenticated, lazy debug route can boot independently of wallet, chain, RECS,
  and the normal play shell.
- `run-renderer-debug-smoke.mjs` demonstrates browser orchestration, route readiness, nonblank canvas checks, runtime
  error collection, and JSON output.
- `run-renderer-scene-smoke.mjs` demonstrates production-scene checks, renderer parity diagnostics, retries, and failure
  artifacts.
- `run-renderer-load-benchmark.mjs` establishes iteration summaries, p50/p95 reporting, baseline comparison, and a
  failing process exit code.
- `worldmap-render-diagnostics.ts`, chunk diagnostics, renderer GPU telemetry, startup telemetry, and memory monitoring
  already expose the expensive phases and resource owners.
- the root already depends on `sharp`, so contact sheets, image signatures, and image comparisons do not require a new
  image dependency.

Do not extend the current chunk debug renderer into the terrain gate. It creates a separate classic
`THREE.WebGLRenderer`, while the game uses `WebGPURenderer` with native WebGPU or its WebGL2 backend. The terrain
fixture must mount the production renderer backend and production `ProceduralTerrain` module or it will certify the
wrong path.

## Verification architecture

### Modules and seams

```text
production code
  ProceduralTerrain + TerrainSurface + production renderer backend
             |
             v
debug route
  /debug/procedural-terrain?scenario=coast&view=medium&capture=1
             |
             v
browser runner
  run-terrain-verification.mjs
             |
       +-----+---------------------+
       |                           |
       v                           v
structural/performance         screenshots
snapshot JSON                  beauty + diagnostic passes
       |                           |
       +-------------+-------------+
                     v
             verification evaluator
                     |
                     v
          verdict.json + contact sheets
                     |
                     v
              agent visual review
                     |
                     v
          aesthetic-review.json + final verdict
```

The browser route owns deterministic scene setup. The runner owns orchestration and artifact collection. The evaluator
owns policy and pass/fail. The agent owns semantic visual judgment. No layer silently performs another layer's job.

### Proposed files

```text
apps/game/src/three/terrain/verification/
  terrain-verification-fixtures.ts       fixture inputs and required capture matrix
  terrain-verification-runtime.ts        readiness, clock freeze, snapshots, traces
  terrain-verification-contract.ts       browser snapshot and invariant types
  terrain-verification-diagnostics.ts    production terrain counters/timings

apps/game/src/ui/features/debug/
  procedural-terrain-debug-view.tsx      auth-free production terrain host

apps/game/scripts/terrain-verification/
  run-terrain-verification.mjs           browser orchestration
  evaluate-terrain-verification.mjs      policy and baseline comparison
  create-terrain-contact-sheets.mjs      sharp-based evidence boards
  terrain-aesthetic-rubric.mjs           review schema and completeness checks

apps/game/scripts/
  run-terrain-verification.test.mjs
  evaluate-terrain-verification.test.mjs

.github/workflows/
  verify-terrain.yml                     hermetic path-scoped PR gate
```

Keep policy in the evaluator, not scattered between the debug view, shell script, workflow YAML, and agent prompt.

## Hermetic debug route

### Route contract

Add `/debug/procedural-terrain` beside `/debug/three-chunks`. It must not initialize a wallet, connect to Torii, inspect
local storage, or depend on a live game. It accepts only validated query parameters:

| Parameter      | Values                                               | Purpose                                                             |
| -------------- | ---------------------------------------------------- | ------------------------------------------------------------------- |
| `scenario`     | fixture ID                                           | Selects deterministic climate, cells, occupancy, and focus          |
| `view`         | `close`, `medium`, `far`                             | Selects a fixed production camera pose                              |
| `rendererMode` | `webgpu-auto`, `webgpu-force-webgl`                  | Exercises the maintained backend paths                              |
| `pass`         | `beauty`, `normal`, `height`, `biome`, `exploration` | Selects evidence output                                             |
| `capture`      | `0`, `1`                                             | Freezes motion, hides controls, and uses fixed viewport assumptions |

Unknown parameters fail loudly on the page and in the browser snapshot. Capture mode uses:

- 1440×900 CSS pixels;
- device pixel ratio 1;
- fixed camera position, target, FOV, exposure, color space, lights, shadow state, and fog;
- a fixed procedural clock and weather state;
- no damping, camera interpolation, water drift, wind progression, or random animation phase;
- a transparent-free capture surface unless the production material explicitly requires transparency;
- one warm-up render followed by an explicit `rendererReady` barrier before screenshots.

The normal interactive debug view may expose controls. Capture mode must not. A screenshot that depends on when the
runner happened to click is not a baseline.

### Production-path rule

The route imports `ProceduralTerrain`, `TerrainSurface`, palette, materials, prop geometry, and the normal renderer
backend from their production modules. Verification-specific code supplies only data, camera, clock, and diagnostics. It
may not fork shaders, replace materials, reduce prop density, use a special geometry builder, or instantiate a classic
`WebGLRenderer`.

### Browser interface

Expose one development-only object:

```ts
interface TerrainVerificationWindow {
  __terrainVerification?: {
    version: 1;
    status: "booting" | "ready" | "error";
    error?: string;
    getSnapshot(): TerrainVerificationSnapshot;
    runTrace(trace: TerrainVerificationTraceId): Promise<TerrainVerificationTraceResult>;
  };
}
```

`getSnapshot()` returns cloned data. It does not expose the terrain instance or mutable renderer objects. The runner
waits for `status === "ready"`; timeout, `error`, missing fields, `NaN`, or an unsupported metric becomes `inconclusive`
or `fail`, never an implicit pass.

## Fixture catalog

Fixtures are code-owned domain inputs, not screenshots or mesh files. Each fixture contains a climate config, map
center, normalized bounds, authoritative explored-cell biome IDs, occupied cells, expected semantic properties, camera
focus, and style version.

### Required scenarios

| ID                   | What it convicts                                                                       | Required views     |
| -------------------- | -------------------------------------------------------------------------------------- | ------------------ |
| `continental-flow`   | Broad elevation and moisture continuity across several biome families                  | close, medium, far |
| `coastline`          | Deep ocean, ocean, beach, land transition, shore continuity, and water material        | close, medium, far |
| `forest-gradient`    | Density gradient, broadleaf/conifer distinction, repetition, and ground readability    | close, medium, far |
| `arid-relief`        | Desert, scorched, bare, shrub, rock exposure, and palette separation                   | close, medium, far |
| `alpine-snow`        | Slope response, snow/stone blend, silhouette, and clipping                             | close, medium, far |
| `fog-frontier`       | Exact explored union, neutral unknown region, skirts, and zero visual information leak | close, medium      |
| `occupied-pads`      | Structure pads, clearance radii, labels/overlays, and no terrain holes                 | close, medium      |
| `page-seam-negative` | Adjacent page edges and signed normalized coordinates                                  | close, far         |
| `prop-stress`        | Maximum intended prop density, draw calls, triangles, and frame cost                   | close, far         |

The quick suite runs `coastline`, `forest-gradient`, `fog-frontier`, `occupied-pads`, and `page-seam-negative` at one
representative view, plus `prop-stress` at far view. The full suite runs the complete matrix.

### Fixture invariants

- fixture IDs and expected semantics are immutable once approved; change by adding a versioned fixture;
- generated cell order is canonical row-major order;
- the fixture fingerprint includes every cell biome, occupancy, climate field, map center, and procedural style version;
- at least one fixture crosses a page edge at negative normalized coordinates;
- no fixture reads the implementation's output to decide its expected input;
- fixture generation uses `Biome.sampleEnvironment()` only to create deterministic input; the projected biome values
  stored in the request remain the semantic assertions.

## Evidence passes

Every required capture has one beauty image. Diagnostic passes are generated only where they answer a specific question:

- `normal`: verifies continuous lighting normals across hex and page edges;
- `height`: renders quantized height bands to expose discontinuities, pad transitions, and unexpected cliffs;
- `biome`: displays the blended visual descriptor while marking authoritative cell centers;
- `exploration`: displays explored ownership, halo-only cells, unknown cells, and frontier triangles.

Diagnostic passes use the same prepared buffers. They may swap only the final presentation material. A diagnostic pass
must not rebuild the page with different inputs.

## Snapshot contract

Each route emits this shape, serialized into the run manifest:

```ts
interface TerrainVerificationSnapshot {
  contractVersion: 1;
  status: "ready" | "error";
  fixture: {
    id: TerrainVerificationScenarioId;
    fingerprint: string;
    styleVersion: number;
    cellCount: number;
    exploredCellCount: number;
    occupiedCellCount: number;
  };
  propCatalog: {
    id: "quaternius-ultimate-nature";
    version: number;
    manifestHash: string;
    glbHash: string;
    loadedArchetypes: string[];
  };
  renderer: {
    requestedMode: RendererBuildMode;
    activeMode: RendererActiveMode;
    fallbackReason: RendererFallbackReason;
    validationErrors: string[];
  };
  geometry: {
    pages: number;
    vertices: number;
    triangles: number;
    propInstancesByArchetype: Record<string, number>;
    edgeMismatchCount: number;
    hiddenPropCount: number;
    occupiedPropCount: number;
  };
  render: {
    drawCalls: number;
    geometries: number;
    textures: number;
    programs: number | null;
  };
  timings: {
    prepareMs: number;
    commitMs: number;
    firstStableFrameMs: number;
    frameSamplesMs: number[];
    terrainLongTasksMs: number[];
  };
  uploads: {
    geometryBytes: number;
    instanceBytes: number;
    textureBytes: number;
  };
  resources: {
    totalRequests: number;
    totalTransferBytes: number;
    legacyBiomeAssetRequests: string[];
    terrainPropAssetRequests: string[];
  };
}
```

The page builder records prepare time around pure buffer construction. The presenter records commit and upload bytes.
Frame sampling begins only after the stable-frame barrier. Renderer statistics are reset before each measured interval
where the backend permits it.

## Structural verification

These checks are deterministic and block every relevant PR:

- fixture fingerprint equals the requested fixture/version;
- a fresh rebuild produces identical buffer fingerprints and prop transforms;
- adjacent owned pages have zero height and normal mismatches along shared global coordinates;
- `hiddenPropCount === 0` and `occupiedPropCount === 0`;
- every explored cell has surface coverage and every unknown cell lacks biome-dependent props;
- occupied cells contain a pad and have no terrain hole;
- beauty and required diagnostic captures are nonblank and have expected dimensions;
- native/fallback snapshots agree on cell count, geometry count, triangle count, prop counts, and fingerprints;
- the loaded prop catalog ID/version/archetype allowlist and manifest/GLB hashes match the committed provenance
  manifest;
- browser errors, GPU validation errors, missing readiness, and legacy whole-tile biome asset requests are empty;
- the optimized Ultimate Nature catalog loads at most once per renderer process, and no raw FBX/OBJ/Blend source or
  unapproved pack model is requested;
- build/dispose and page-churn traces return page/material/geometry/texture/instance ownership to the allowed plateau.

The seam test belongs at the geometry interface, not only in screenshots. A pixel seam can disappear under one light and
return under another.

## Performance verification

### Measurement traces

#### 1. Cold fixture

Create the route from a fresh page load, prepare all required pages, perform the first commit, and wait for the first
stable frame. Run seven iterations per backend after one discarded environment warm-up. Report p50, p95, and max.

#### 2. Stable frame

After 60 warm-up frames, collect 240 request-animation-frame intervals while the camera is fixed. Report p50, p95, p99,
max, frames above 16.7 ms, frames above 33.3 ms, and long tasks. Record renderer draw calls and triangles from the same
interval.

This measures CPU-observed frame cadence. Label it honestly. GPU telemetry remains a separate field and must not be
invented on backends where it is unavailable.

#### 3. Camera trace

Run a fixed camera script across 12 page boundaries, then close → medium → far → close. Record:

- page requests, builds, commits, replacements, stale drops, and evictions;
- prepare, commit, first-visible, and switch p95/max;
- upload bytes by owner;
- maximum terrain-owned task duration;
- missing-coverage frames;
- draw calls and triangles at each stable camera stop.

#### 4. Lifecycle trace

Cycle the fixture or scene 25 times and perform a 100-page traversal before returning to origin. Record live page count,
Three renderer resource counts, procedural catalog counts, instance capacity, and Chromium heap when available.
Unavailable heap data is reported as unavailable; resource-count plateaus still gate the run.

### Absolute budgets

| Metric                                  | Gate                                                                         |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| Single terrain-owned main-thread task   | ≤ 8 ms                                                                       |
| Terrain-attributed long task            | none ≥ 50 ms                                                                 |
| Critical page commit                    | fits existing 16 ms join opportunity or preserves prior/provisional coverage |
| Terrain draw calls                      | ≤ 40; target 12 page passes + no more than 11 prop pools                     |
| Far-view terrain + props                | < 1.5 M triangles before buildings/armies                                    |
| Close-view terrain + props              | < 3 M triangles before buildings/armies                                      |
| Missing-coverage frames during trace    | 0                                                                            |
| Legacy whole-tile biome asset requests  | 0 after final migration                                                      |
| Ultimate Nature prop catalog requests   | ≤ 1 per renderer process                                                     |
| Optimized prop catalog size             | ≤ 750 KB, no bitmap textures                                                 |
| GPU validation errors                   | 0                                                                            |
| Resource growth after lifecycle plateau | 0 unowned pages/materials/geometries/textures/instance pools                 |

### Regression policy

Compare head against a base-branch artifact captured on the same runner and backend. Fail only when both the relative
and absolute limits are exceeded, so tiny metrics do not fail on noise:

| Metric                 | Warning                  | Failure                         |
| ---------------------- | ------------------------ | ------------------------------- |
| `prepareMs` p95        | +10% and +0.5 ms         | +20% and +1 ms                  |
| `commitMs` p95         | +10% and +0.5 ms         | +20% and +1 ms                  |
| first stable frame p95 | +10% and +50 ms          | +20% and +100 ms                |
| stable frame p95       | +8% and +0.5 ms          | +15% and +1 ms                  |
| camera switch p95      | +10% and +25 ms          | +20% and +50 ms                 |
| upload bytes           | +10% and +256 KB         | +20% and +512 KB                |
| triangles/draw calls   | any unexplained increase | >10% or absolute budget failure |

Run baseline and head on the same CI job when possible. Never compare a developer laptop result directly to a Linux CI
result or native WebGPU to forced WebGL2.

## Image verification

### What image automation may assert

Use `sharp` to derive a deterministic image signature:

- dimensions and alpha coverage;
- mean and percentile luminance;
- clipped-black and clipped-white fractions;
- color entropy and dominant-color distribution;
- edge-energy distribution by predefined region;
- a small perceptual thumbnail hash;
- changed-pixel fraction and normalized mean error against the matching baseline.

Hard-fail blank/near-blank images, wrong dimensions, missing terrain coverage, extreme exposure clipping, or a required
region with no edge/color response. Treat perceptual change as routing:

- below the noise allowance: unchanged;
- above the allowance with no intentional visual change: regression;
- above the allowance with an intentional visual change: `review_required`, not automatic failure or approval.

Keep baselines separate by backend and runner class. Do not demand byte-identical pixels across GPUs.

### Baseline authority

The agent may capture and recommend a new baseline. It may not approve or overwrite the first aesthetic baseline by
itself. The user approves the initial contact sheet. After that, the merged base branch is the accepted comparison for
normal regression work.

`--accept-baseline` is a separate explicit command and never runs inside `verify:terrain`. A PR that changes thresholds,
fixture expectations, or baseline policy reports `verification_policy_changed: true` even if every other check passes.

## Aesthetic verification

### Fixed review rubric

The agent views contact sheets with the image viewer and scores every category from 1 to 5. Every score needs a concrete
observation tied to a scenario/view; unsupported scores make the review incomplete.

| Category              | The question                                                                                        |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| Continuity            | Do explored regions read as one surface without internal hex/page seams or faceting?                |
| Biome legibility      | Are biome families distinct at a glance without labels while transitions remain gentle?             |
| Macro composition     | Do relief, open ground, silhouettes, and focal areas form a coherent scene at all views?            |
| Prop distribution     | Do density and variation feel organic, without rows, clumps-by-hex, collisions, or obvious repeats? |
| Coast and water       | Does the coast form a continuous shore and does water feel integrated rather than pasted on?        |
| Gameplay readability  | Can units, buildings, paths, hover, selection, and exact frontier hexes be read immediately?        |
| Material and lighting | Are roughness, normals, slope response, palette, shadows, and atmosphere coherent?                  |
| Fog integrity         | Does unknown terrain stay neutral with no biome, elevation-character, prop, snow, or coast leak?    |

Score meanings:

- 5: intentional and production-ready; no meaningful correction visible;
- 4: strong; one or two polish issues that do not weaken the scene;
- 3: acceptable but generic, repetitive, muddy, or visibly synthetic;
- 2: clear visual defect or hierarchy/readability problem;
- 1: broken or misleading.

The aesthetic gate passes only when:

- every required capture was actually viewed;
- every category has evidence;
- no category is below 3;
- mean score is at least 4.0;
- there are no blocking findings;
- continuity, gameplay readability, and fog integrity are each at least 4;
- before/after sheets show that every previously blocking finding is resolved.

### Review shape

The agent writes `aesthetic-review.json`:

```json
{
  "contractVersion": 1,
  "reviewer": "codex",
  "reviewedCaptureIds": ["coastline:close:webgpu-auto:beauty"],
  "categories": {
    "continuity": {
      "score": 4,
      "evidence": ["coastline/close: shore crosses the center page edge without a lighting break"]
    }
  },
  "findings": [
    {
      "id": "AESTHETIC-001",
      "severity": "polish",
      "captureId": "forest-gradient:medium:webgpu-auto:beauty",
      "observation": "Conifers repeat at nearly identical scale in the upper-right cluster",
      "requiredChange": "Widen deterministic scale variation without changing density"
    }
  ],
  "verdict": "pass"
}
```

Allowed severities are `blocking`, `medium`, and `polish`. A finding describes what is visible, where it is visible, why
it hurts the intended result, and the smallest layer that should change. “Looks bad” is invalid evidence.

### Agent review loop

1. Run the quick suite after a local visual change.
2. Open every quick-suite contact sheet with the image viewer.
3. Write the rubric before editing again, so the next change has a convicted target.
4. Change only the named palette, field, geometry, prop, water, lighting, or placement layer.
5. Rerun the affected scenario and create a before/after sheet.
6. Confirm the finding is resolved and no adjacent rubric category fell.
7. Run the full suite and both backends before handoff.
8. Attach the final verdict, contact sheets, and performance delta table.

The agent never “passes” aesthetics based only on nonblank pixels, histogram statistics, or unit tests.

## Unified verdict

The evaluator produces exactly one status:

- `pass`: structural, performance, backend, image, and aesthetic gates all pass;
- `fail`: at least one deterministic blocking assertion fails;
- `review_required`: images intentionally changed and semantic review/approval is missing;
- `inconclusive`: the environment could not measure a required signal.

Example:

```json
{
  "contractVersion": 1,
  "status": "pass",
  "suite": "full",
  "fixtureVersion": 1,
  "styleVersion": 3,
  "verificationPolicyChanged": false,
  "checks": {
    "structural": { "status": "pass", "failures": [] },
    "performance": { "status": "pass", "warnings": [] },
    "backendParity": { "status": "pass", "failures": [] },
    "images": { "status": "pass", "changedCaptures": [] },
    "aesthetics": { "status": "pass", "meanScore": 4.25, "minimumScore": 4 }
  },
  "artifacts": {
    "manifest": "manifest.json",
    "metrics": "metrics.json",
    "aestheticReview": "aesthetic-review.json",
    "contactSheets": ["contact-sheets/coastline.png"]
  }
}
```

Exit code is zero only for `pass`. Local iterative commands may use `--allow-review-required` while producing the
contact sheet, but the final command and CI never do.

## Artifact layout

```text
.context/terrain-verification/<run-id>/        local, gitignored
  manifest.json
  metrics.json
  structural-results.json
  image-results.json
  aesthetic-review.json
  terrain-verification-verdict.json
  captures/
    webgpu-auto/<scenario>/<view>-<pass>.png
    webgpu-force-webgl/<scenario>/<view>-<pass>.png
  contact-sheets/
    <scenario>.png
    backend-parity.png
    before-after.png
  logs/
    browser-errors.log
    console.log
    gpu-validation.log
```

CI writes the same shape under its temporary artifact directory and uploads it on success and failure. Generated
screenshots and local approvals do not enter git.

## Commands

Add these client scripts when the route exists:

```json
{
  "verify:terrain": "node ./scripts/terrain-verification/run-terrain-verification.mjs",
  "verify:terrain:quick": "pnpm verify:terrain --suite quick",
  "verify:terrain:full": "pnpm verify:terrain --suite full",
  "verify:terrain:compare": "pnpm verify:terrain --suite full --compare-base origin/next"
}
```

Representative usage:

```bash
# Fast local loop, one maintained fallback backend
pnpm --dir apps/game verify:terrain --suite quick --renderer-modes webgpu-force-webgl

# Final local review, both modes, saved artifacts
pnpm --dir apps/game verify:terrain \
  --suite full \
  --renderer-modes webgpu-auto,webgpu-force-webgl \
  --artifact-dir .context/terrain-verification/final

# Compare against a base artifact captured on the same machine
pnpm --dir apps/game verify:terrain \
  --suite full \
  --compare .context/terrain-verification/base/manifest.json
```

The runner may start from an already-running `--base-url` or manage a built preview process. Process ownership and
cleanup must be explicit; it never kills an unrelated development server.

## CI and review workflow

### Pull requests

Create one path-scoped `verify-terrain.yml` workflow. It runs when terrain, biome sampling, renderer backend, worldmap
page presentation, Hexception terrain integration, or verification policy changes.

Jobs have one responsibility each:

1. `terrain-contract`: focused unit and seam tests, fixture fingerprints, evaluator tests;
2. `terrain-capture`: build once, run the hermetic route through forced WebGL2, capture JSON/images;
3. `terrain-regression`: compare head against a base-branch capture produced on the same runner;
4. `terrain-artifacts`: publish the unified evidence bundle even when a gate fails.

Native WebGPU on shared Linux CI is not assumed. The deterministic fallback gate runs on every relevant PR. Native
WebGPU runs on the reference Mac during final agent verification and in the deploy/canary renderer workflow. Backend
parity includes semantic/geometry equality everywhere and screenshot comparison only within the same backend/runner
class.

### Pull-request handoff

Every terrain PR reports:

- unified status;
- before/head commit and fixture/style/policy versions;
- structural failures or confirmation;
- p50/p95/max performance delta table;
- draw-call, triangle, upload, and resource plateau delta;
- aesthetic rubric scores and findings;
- links to coastline, forest, frontier, occupied-pad, seam, stress, backend-parity, and before/after contact sheets;
- explicit statement when native WebGPU was unavailable rather than implying it passed.

## Delivery order

### V0 — contract and evaluator

- define fixtures, snapshot schema, aesthetic-review schema, verdict states, thresholds, and evaluator tests;
- extend the main terrain brief so each delivery slice names the verification suite it must pass;
- reuse the existing percentile/regression conventions rather than creating a third comparison shape.

Gate: sample pass/fail/review-required/inconclusive artifacts produce the expected exit code and list every failure.

### V1 — production-path debug route

- add the auth-free route and fixed capture mode when the first `ProceduralTerrain` debug implementation exists;
- publish readiness and snapshots;
- add beauty plus height/normal/biome/exploration passes;
- add route/source/runtime tests.

Gate: identical fixture request produces identical fingerprints and capture dimensions across fresh runs; the route uses
the production renderer and terrain imports.

### V2 — capture runner and contact sheets

- orchestrate the quick/full matrix with agent-browser;
- collect errors, snapshots, traces, images, logs, and resource entries;
- create contact sheets and image signatures with `sharp`;
- write artifacts on both success and failure.

Gate: deliberately blanking the canvas, adding a browser error, changing a fixture or prop-catalog fingerprint, hiding a
capture, requesting a legacy biome asset, loading an unapproved pack model, or fetching the prop GLB twice each fails
with a precise reason.

### V3 — performance and lifecycle traces

- wire terrain diagnostics to page preparation, presentation, uploads, renderer stats, frame samples, and ownership;
- implement cold, stable-frame, camera, and lifecycle traces;
- compare baseline/head on the same runner.

Gate: injected delay, upload increase, missing coverage, or resource leak trips only the owning metric and preserves all
evidence.

### V4 — agent aesthetic loop

- generate review-ready contact sheets and a rubric template listing every required capture ID;
- validate that the agent reviewed the entire required matrix and supplied evidence;
- combine the review with deterministic results into the final verdict;
- require user approval for the first aesthetic baseline.

Gate: missing capture review, unsupported score, mean below 4, continuity/readability/fog below 4, or a blocking finding
prevents `pass`.

### V5 — CI and deletion hardening

- add the path-scoped workflow and artifact upload;
- add native WebGPU final-run instructions to the renderer documentation;
- make threshold/baseline-policy changes visible in the verdict;
- delete temporary verification adapters when both terrain scenes use the production module.

Gate: a relevant PR cannot merge on missing or stale verification; an unrelated client PR does not pay the GPU capture
cost.

## Definition of done

The verification layer is done when an agent can make a terrain change, run one command, receive deterministic visual
and performance evidence, inspect fixed contact sheets, record specific aesthetic findings, iterate on the convicted
layer, and produce a final pass/fail/review-required/inconclusive verdict. The verdict must exercise the production
terrain and renderer paths, preserve every artifact on failure, compare performance on like hardware, distinguish pixel
regression from aesthetic judgment, require user authority for the first approved look, and fail loudly when evidence is
absent.
