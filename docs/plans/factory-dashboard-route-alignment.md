# Factory Dashboard Route Alignment PRD

## Summary

The game client currently exposes standalone factory routes that bypass the landing dashboard shell. That makes the
factory experience look and behave differently from the rest of the dashboard, even though the home dashboard already
has an inline factory tab that matches the intended style.

This change makes the inline dashboard factory view the single destination for factory navigation. Direct factory URLs
should still work, but they should resolve into the existing dashboard tab instead of mounting a separate full-screen
shell.

## Problem

- `/factory` and `/factory/v2` mount standalone pages outside the landing dashboard layout.
- The standalone shell does not match the spacing, navigation, and route behavior used by the rest of the dashboard.
- Factory version selection lives in component-local state, so direct links cannot select the intended factory view.

## Goals

- Keep factory navigation visually consistent with the rest of the landing dashboard.
- Preserve direct factory URLs by redirecting them into the inline dashboard experience.
- Make the selected factory version addressable in the URL so redirects and shared links resolve the correct view.

## Non-Goals

- Redesign the factory v1 or v2 interfaces themselves.
- Change the home navigation model beyond making factory route handling consistent.
- Add a new dedicated sidebar section for factory.

## User Stories

- As an operator opening `/factory`, I land in the dashboard factory tab with the legacy factory selected.
- As an operator opening `/factory/v2`, I land in the dashboard factory tab with Factory V2 selected.
- As an operator switching between factory versions inside the dashboard, the URL keeps the current version selected.

## Requirements

1. `/factory` redirects to the home dashboard factory tab with the legacy factory selected.
2. `/factory/v2` redirects to the home dashboard factory tab with Factory V2 selected.
3. The dashboard factory tab resolves its selected version from URL search params.
4. Factory version switching updates the URL instead of only mutating local component state.
5. The UX change is documented in the latest-features feed.

## Implementation Shape

1. Introduce a small shared factory dashboard route helper for redirect targets and search-param resolution.
2. Update app routing to redirect standalone factory URLs into the home dashboard factory tab.
3. Update the dashboard factory tab to derive and write its selected version via search params.
4. Cover the redirect contract and search-param behavior with tests.

## Verification

- Source tests cover redirect wiring in `src/app.tsx`.
- Unit tests cover factory dashboard route helper behavior.
- Existing factory tab source test confirms the tab remains available in the home dashboard.
