# PRD: Coarse Default Tick Must Not Gate Resource Actions

## Problem

The recent coarse default-tick hook buckets `currentDefaultTick` into 10-second windows before passing it into several
economy and upgrade flows.

That reduces re-renders, but it also changes the effective tick used for production-aware balance math. Resource
availability, donkey capacity, bridge-out validation, and realm-upgrade requirements can all lag behind the real
per-second default tick by up to 9 seconds.

## Goal

Keep the coarse tick available for display-oriented rendering, but restore live default-tick behavior anywhere the UI
uses tick-derived balances to decide whether a player can act.

## Non-Goals

- Reworking the block timestamp store
- Re-optimizing every resource display panel
- Changing action semantics on-chain

## Desired Behavior

1. The client still exposes a coarse default-tick hook for render-throttled views.
2. The client also exposes a live default-tick hook that returns the unbucketed store value.
3. Action-oriented flows use the live default tick for production-aware balance math.
4. Display-only panels may continue using the coarse tick when stale values are acceptable.

## Acceptance Criteria

- Resource action flows no longer bucket `currentDefaultTick` into 10-second windows before validation.
- Realm transfer, market order execution/creation, unified trade execution, transfer automation, bridge-out validation,
  realm upgrade requirements, and interactive resource-table balances use the live default tick.
- The game client latest-features feed includes an entry describing the fix.

## TDD Plan

1. Add a selector-level test that expects the hook module to expose both a live default-tick selector and a coarse
   default-tick selector.
2. Add a source-level regression test that asserts the action-oriented client files import `useCurrentDefaultTick`
   instead of `useCoarseCurrentDefaultTick`.
3. Verify the new tests fail against the current code because the live hook is missing and the action files still use
   the coarse hook.
4. Implement the live hook and switch only the action-oriented consumers back to it.
5. Re-run the targeted tests and update the latest-features feed.
