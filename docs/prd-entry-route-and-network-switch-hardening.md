# PRD: Entry Route And Network Switch Hardening

## Problem

The new route-owned entry flow is directionally correct, but the current diff leaves a set of behavioral regressions and
hardening gaps around routing, loading, and wallet-chain coordination:

- entering through `/enter/:chain/:world` still exits through legacy `/play/map` and `/play/hex` URLs
- browser Back can reopen the entry modal instead of returning to landing
- moving entry into a separate route remounts `PlayView` and drops local landing state
- landing chrome can disagree with the reconstructed background tab during `/enter/...`
- network-switch replay is not single-flight and is not cancel-safe
- the preferred-chain state used by landing UI can diverge from the connector configuration used during sign-in
- the new flow is under-tested in runtime terms and relies too heavily on source-string assertions
- `LandingEntryRoute` currently violates the Rules of Hooks on invalid route params

## Goal

Make the route-owned entry flow production-safe without backing away from the architectural direction.

The final system should:

1. treat `/enter/:chain/:world` as the single route-owned entry surface
2. transition into canonical `/play/:chain/:world/:scene` URLs without extra redirect hops
3. preserve the correct landing context behind the modal
4. make network-switch prompts idempotent and cancel-safe
5. keep connector chain selection aligned with the chosen world chain during sign-in
6. cover the new flow with executable tests rather than source-only assertions

## Non-Goals

- redesigning the visual entry modal
- changing settlement, forge, or spectate product rules
- rewriting the full landing navigation architecture
- broad refactors outside the landing, entry, and chain-switch surfaces

## Product Principles

- Canonical URLs win. Once the app knows the selected chain and world, it should emit canonical play routes directly.
- Route ownership should reduce state bugs, not create new remount bugs.
- Loading should avoid unnecessary remounts and duplicate route hops.
- Wallet-switch side effects must be idempotent.
- Cancel must mean cancel from the user's perspective.

## Desired Behavior

### 1. Canonical entry-to-play handoff

1. Landing actions navigate into `/enter/:chain/:world` with intent in query params.
2. Successful entry navigates directly into `/play/:chain/:world/:scene`.
3. No success path should emit legacy `/play/map`, `/play/hex`, or bare scene URLs.
4. Browser Back from the game returns the user to landing, not to a stale entry modal.

### 2. Stable landing background state

1. Opening the route-owned entry flow should preserve the meaningful landing context that existed before entry.
2. Season-vs-blitz selection, scroll position, and similar route-local landing state should not reset just because the
   modal is now route-owned.
3. Landing chrome and landing content should agree on the active section while `/enter/...` is open.

### 3. Safe network-switch replay

1. A guarded action blocked on wallet chain mismatch opens one prompt and one prompt only.
2. Clicking the switch CTA multiple times cannot replay the stored action multiple times.
3. Clicking Cancel while a wallet switch is in flight prevents later replay.
4. Successful switch persists the selected chain once, then replays the action once.

### 4. Connector chain alignment during sign-in

1. Choosing a world on a non-startup chain before sign-in should configure the login/connect flow for that chain.
2. Preferred-chain UI state and actual connector/runtime state should derive from the same source of truth.
3. The app should not require a full reload or a second manual switch to align the connector with the selected world.

### 5. Runtime-tested entry flow

1. Critical routing helpers should have executable tests.
2. The sign-in redirect path should be tested as a behavior, not only as a source string.
3. Entry close behavior should be tested for both landing-origin and market-origin launches.
4. Invalid `/enter/...` URLs should be safe and lint-clean.

## Acceptance Criteria

### Routing and history

- Entry success no longer routes through legacy `/play/map` or `/play/hex`.
- Successful entry lands directly on `/play/:chain/:world/:scene`.
- Back from canonical play returns to the originating landing route instead of reopening `/enter/...`.
- Market watch launches preserve a meaningful close target instead of falling back to `/`.

### Landing state and loading

- Opening `/enter/...` no longer resets the active landing mode filter from season to blitz.
- Landing chrome highlights the same section as the background content during entry.
- The route-owned loading flow does not introduce an avoidable extra route normalization hop.

### Network switching

- Duplicate switch-button clicks do not trigger duplicate guarded actions.
- Cancel prevents replay of an already-started async switch.
- Successful replay persists the target chain and fires the replayed action once.

### Chain correctness

- Sign-in on a chosen non-default chain uses a connector/runtime configuration compatible with that selected chain.
- Preferred chain, bootstrap selection, and connector chain are observably aligned after selection.

### Quality gates

- `LandingEntryRoute` is lint-clean with no hooks-order violation.
- New tests cover canonical entry success, back behavior, sign-in redirect preservation, network-switch replay safety,
  and market watch close behavior.

## Implementation Outline

### Workstream 1: Canonical entry handoff

- Update entry success helpers so they build canonical play URLs from known route context.
- Remove remaining legacy success-path URL construction from `game-entry-navigation.ts` and `game-entry-modal.tsx`.
- Ensure the success navigation uses history semantics that do not strand `/enter/...` behind the game route.

### Workstream 2: Preserve landing context

- Decide which landing state must survive entry:
  - mode filter
  - active landing section
  - relevant route-local background state
- Move only the required landing state to a route-stable owner or serialize it into route state deliberately.
- Make landing header/mobile navigation aware of route-owned entry context instead of relying only on pathname.

### Workstream 3: Harden switch replay

- Add explicit in-flight state to the network-switch prompt flow.
- Disable or debounce the switch CTA while a switch is pending.
- Track cancellation so stale async completions cannot replay actions after dismiss.
- Keep replay data as a clear state machine:
  - idle
  - pending_prompt
  - switching
  - cancelled
  - completed

### Workstream 4: Align connector chain selection

- Remove the module-init assumption that the connector chain is fixed for the whole session.
- Rebind or reconstruct the connector/runtime inputs from selected-chain state where needed.
- Verify sign-in from `/enter/:chain/:world` on a non-default chain works on first connect.

### Workstream 5: Replace weak tests

- Keep source tests only for static wiring that cannot regress behaviorally any other way.
- Add executable tests for:
  - canonical entry route parsing/building
  - entry success navigation target
  - back/close behavior
  - sign-in redirect preservation
  - network-switch replay idempotence
  - cancel-during-switch behavior
  - market watch origin preservation
- Fix or isolate the current jsdom/node environment issue so these tests can actually run in CI and locally.

## TDD Plan

1. Add an executable entry success test that fails while `GameEntryModal` still navigates to legacy `/play/map` or
   `/play/hex`.
2. Add a history behavior test that fails while Back from the game reopens `/enter/...`.
3. Add a landing-state preservation test that fails while opening entry from season mode remounts `PlayView` and resets
   `modeFilter`.
4. Add a navigation-shell test that fails while `/enter/...` shows learn/news/factory content with Play chrome
   highlighted.
5. Add a replay-state test that fails when double-clicking the switch CTA replays a guarded action twice.
6. Add a cancel-during-switch test that fails while a dismissed prompt can still replay after the async switch resolves.
7. Add a sign-in chain-alignment test that fails while selected-chain state updates but the connector remains bound to
   startup chain configuration.
8. Add a market-watch origin test that fails while closing a fresh-tab `/enter/...` flow falls back to `/`.
9. Add or update lint coverage so `LandingEntryRoute` fails until hooks are unconditional.
10. Implement the smallest production changes needed to make the tests pass in that order.
11. Re-run targeted tests first, then run the repo-required checks for the final code change set.

## Verification Plan

- Targeted routing tests for `play-route`, entry navigation, and landing entry state.
- Targeted interaction tests for `game-card-grid` network switching and prompt cancel behavior.
- Targeted sign-in flow test for redirect and chain alignment.
- Manual browser verification:
  - landing play -> enter -> success -> Back
  - learn/news/factory -> sign-in redirect -> close
  - season mode -> enter -> close
  - market watch in a new tab -> close
  - chain mismatch -> switch -> replay once
  - chain mismatch -> switch -> cancel before resolution

## Risks

- Preserving landing state too broadly can over-couple the entry route to page-local UI concerns.
- Reworking connector chain ownership can affect existing wallet reconnection behavior.
- History fixes need care to avoid breaking deep-link entry or spectate reload behavior.

## Rollout Notes

- Land canonical routing and hooks/lint fixes first.
- Land network-switch replay hardening next because it is transaction-sensitive.
- Land connector chain alignment only with direct verification on non-default chains.
