# PRD: Worldmap Interactivity Readiness

## Problem

Fresh bootstrap can sometimes land the player on a visible world map that still does not respond to clicks.

The current setup path allows the world map to continue booting even when the first async chunk refresh fails or does
not actually commit an interactive chunk. Camera controls remain alive, but selection and raycast-driven interaction can
be missing.

## Goal

The client must only treat the world map as ready when the first worldmap refresh has actually succeeded.

If initial worldmap setup fails, the client must fail closed instead of dismissing the loading shell into a half-ready
scene.

## Non-Goals

- redesigning worldmap input behavior
- changing steady-state chunk recovery after the map is already interactive
- changing Hexception or fast-travel scene behavior

## Desired Behavior

1. Initial worldmap setup throws if the first `updateVisibleChunks(true)` call fails or returns `false`.
2. The shared warp-travel lifecycle treats initial refresh failure as fatal and skips the worldmap-ready completion
   hook.
3. Resume refreshes can still log and recover without crashing the scene.
4. The loading overlay no longer auto-dismisses after the safety timeout when worldmap readiness never arrives.
5. The timeout path keeps the player on the loading shell and explains that worldmap startup is still blocked.

## Acceptance Criteria

- `runWarpTravelSetupLifecycle()` rejects on initial refresh failure.
- `runWarpTravelSetupLifecycle()` still reports and continues on resume refresh failure.
- `WorldmapScene` converts a `false` result from `updateVisibleChunks(true)` into a thrown initial setup failure.
- `GameLoadingOverlay` timeout no longer calls `setShowBlankOverlay(false)` by itself.
- Regression tests cover all of the above.

## TDD Plan

1. Update the warp-travel lifecycle test so initial refresh failure is red instead of green.
2. Add a resume-path test proving resume refresh failure is still non-fatal.
3. Add a worldmap source test proving initial refresh fails closed when no chunk is committed.
4. Add a loading-overlay source test proving the timeout path no longer auto-dismisses the shell.
5. Implement the runtime changes and re-run the targeted tests.
