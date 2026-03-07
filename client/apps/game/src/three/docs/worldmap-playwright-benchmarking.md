# Worldmap Playwright Benchmark Loop

## Goal

Create a repeatable browser benchmark for the `src/three` worldmap path that can compare:

1. terrain-heavy rendering (`simulateAllExplored=true`)
2. terrain + dense visible units (`spawnWorldmapDebugArmies`)

The loop captures:

1. frame-time p95 from `PerformanceMonitor`
2. chunk-switch p95 from worldmap chunk diagnostics
3. browser artifacts (JSON + screenshot)

## Entry Point

Run from `client/apps/game`:

```bash
pnpm bench:worldmap
```

Headed mode:

```bash
pnpm bench:worldmap:headed
```

If you already have the dev server running:

```bash
PLAYWRIGHT_SKIP_WEB_SERVER=1 pnpm bench:worldmap
```

## Useful Budgets

The Playwright spec supports optional env budgets:

```bash
WORLDMAP_DEBUG_ARMY_COUNT=96 \
WORLDMAP_SWEEP_ITERATIONS=10 \
WORLDMAP_FRAME_P95_BUDGET_MS=20 \
WORLDMAP_SWITCH_P95_BUDGET_MS=250 \
WORLDMAP_FRAME_P95_REGRESSION_FRACTION=0.2 \
WORLDMAP_SWITCH_P95_REGRESSION_FRACTION=0.15 \
pnpm bench:worldmap
```

## Hook Surface

DEV-only browser hooks exposed by worldmap:

1. `window.getWorldmapBenchmarkSnapshot()`
2. `window.getWorldmapPerfState()`
3. `window.setWorldmapPerfState(...)`
4. `window.spawnWorldmapDebugArmies(...)`
5. `window.clearWorldmapDebugArmies()`
6. `window.forceWorldmapChunkRefresh()`
7. `window.moveWorldmapToChunkOffset(...)`
8. `window.getThreePerformanceReport()`
9. `window.resetThreePerformanceReport()`

## Scenario Shape

Each benchmark run does:

1. enter spectator worldmap
2. enable `simulateAllExplored`
3. run a terrain-only chunk sweep
4. spawn debug armies and rerun the same sweep
5. compare terrain-only vs terrain-plus-units p95 values

`moveWorldmapToChunkOffset(...)` supports two benchmark modes:

1. `refreshMode: "natural"`: measure normal chunk switching without an extra forced refresh
2. `refreshMode: "force"`: measure chunk movement followed by an explicit forced refresh

The Playwright loop uses `refreshMode: "natural"` so chunk-switch numbers are not inflated by the debug refresh path.

## Current Limits

1. The loop depends on DEV debug hooks and a working local WebGL browser.
2. If the browser cannot create a WebGL context, the run is infra-blocked rather than app-failed.
3. The unit load uses the debug army spawner, so it is deterministic enough for iteration but not a perfect replay of live Torii traffic.
