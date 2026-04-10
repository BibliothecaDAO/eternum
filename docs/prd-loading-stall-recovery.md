# PRD: Loading Stall Recovery

## Problem

Players can get stranded behind a loading UI when entering the game or when the world map is switching chunks.

The current client has multiple places where async work can hang or fail without producing a terminal UI state:

- bootstrap waits on the initial Torii subscription setup without a timeout
- world availability metadata failures degrade into `unknown` and keep the entry modal in loading
- the modal retry flow resets local state without actually re-running bootstrap
- worldmap chunk presentation timeouts can recover the chunk flow while leaving the map loading flag stuck on

## Goal

Loading must terminate into one of two states:

1. ready, when the required async work completes
2. error, when the required async work times out or fails

No entry or scene-switch loading path should be able to spin forever without a timeout or an explicit error.

## Non-Goals

- rewriting the full entry flow
- changing settlement or spectate product behavior
- redesigning the loading UI
- changing the post-entry overlay safety timeout

## Desired Behavior

1. Initial bootstrap fails fast when the global Torii stream subscription cannot be established within the configured
   timeout.
2. Entry modal world availability failures surface an error state instead of staying in loading.
3. Clicking retry in the entry modal actually starts a fresh bootstrap attempt.
4. A timed-out worldmap chunk presentation clears the stuck map-loading flag before recovery work starts.

## Acceptance Criteria

- `initialSync()` no longer starts the global entity stream without a timeout budget.
- A world availability error, unavailable world, or unresolved world metadata after loading settles pushes the entry
  modal into `error`.
- Entry modal retry increments a fresh bootstrap attempt and re-runs the bootstrap effect.
- A `tile_fetch` or `bounds_ready` chunk presentation timeout clears `LoadingStateKey.Map`.
- Regression tests cover each of the above behaviors.

## TDD Plan

1. Add a bootstrap wiring test that proves initial sync passes the Torii subscription timeout through to the global
   bootstrap stream.
2. Add a modal phase test that fails while unresolved world metadata still maps to `loading`.
3. Add a modal retry wiring test that fails while retry does not trigger a new bootstrap attempt.
4. Add a worldmap timeout recovery test that fails while timed-out chunk phases leave map loading stuck on.
5. Implement the smallest production changes needed to make those tests pass.
6. Re-run the targeted tests, then run repo-required formatting and dead-code checks.
