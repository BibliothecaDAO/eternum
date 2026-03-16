# Eternum S2 Dev Preview Registration PRD / TDD

Date: 2026-03-16
Status: Proposed
Scope: local-only Blitz preview entry, pending cosmetic loadout promotion, session-scoped preview gating, game-entry UX, runtime application, tests, and explicit separation from real onchain registration

## Implementation Tracking

- [x] Phase 0: Baseline Lock and Scope Guardrails
- [ ] Phase 1: Session-Scoped Dev Preview State
- [ ] Phase 2: Dev Preview Entry UX
- [ ] Phase 3: Runtime Promotion and Resolver Application
- [ ] Phase 4: Entry Gating and Lifecycle Reset
- [ ] Phase 5: Signoff Matrix and Follow-Up Fence

## 1. Objective

Introduce a real client-side dev preview entry flow so a developer can:

1. select cosmetics in the existing Cosmetics UI,
2. enter a Blitz world without sending a registration transaction,
3. see those cosmetics applied through the normal runtime store, resolver, and renderer path,
4. keep the effect local to their browser session,
5. avoid conflating preview entry with real onchain registration.

This feature is explicitly for local viewing and iteration.
It is not intended to create contract state, Torii state, or real competitive participation.

## 2. Background

The repo now has a materially complete cosmetic runtime path:

- pending Blitz loadouts can be selected in the Cosmetics UI,
- registration can serialize cosmetic token ids,
- applied loadouts become runtime cosmetic state,
- the resolver exposes explicit skin semantics,
- armies and structures consume shared cached skin assets,
- worldmap refreshes cosmetics by owner.

However, the current system still assumes a real registration seam.

For day-to-day developer iteration, that is heavier than needed.
Sometimes the developer only needs to:

- pick cosmetics,
- open a world,
- visually inspect armies and structures,
- verify attachment placement and skin loading,
- avoid the transaction loop entirely.

The existing `CosmeticsDebug` controller is useful, but it is not enough.
It is a global override in [debug-controller.ts](/Users/os/conductor/workspaces/eternum/san-juan-v5/client/apps/game/src/three/cosmetics/debug-controller.ts), not a real end-to-end preview of the user-facing pending-loadout flow.

## 3. Problem Statement

There is currently no client-only entry path that lets a developer test the real cosmetics loadout flow without touching the chain.

The gap has three parts:

### 3.1 The current path is too coupled to registration

The loadout selection UI is now wired into the runtime store, but the intended promotion boundary is still a successful registration call in [use-world-registration.ts](/Users/os/conductor/workspaces/eternum/san-juan-v5/client/apps/game/src/hooks/use-world-registration.ts).

### 3.2 The existing debug override is not representative

`window.CosmeticsDebug` in [debug-controller.ts](/Users/os/conductor/workspaces/eternum/san-juan-v5/client/apps/game/src/three/cosmetics/debug-controller.ts) bypasses ownership, loadout drafting, and applied-world semantics.

It is useful for renderer probing, but not for testing:

- pending draft UX,
- world-scoped applied loadouts,
- entry modal messaging,
- runtime store promotion,
- owner-scoped refresh after selection changes.

### 3.3 Full no-onchain preview and full no-entity preview are different problems

If the developer bypasses registration but already has world entities for their account, the existing runtime can still show meaningful cosmetics.

If the developer has no entities in that world, there is nothing to render.

That means:

- local preview entry is a reasonable MVP,
- synthetic preview fixtures are a separate follow-up scope.

This PRD covers the MVP only.

## 4. Confirmed Findings

### 4.1 The runtime store is already the correct promotion seam

[player-cosmetics-store.ts](/Users/os/conductor/workspaces/eternum/san-juan-v5/client/apps/game/src/three/cosmetics/player-cosmetics-store.ts) already tracks pending and applied loadouts and can promote world-scoped draft state into active runtime selection.

### 4.2 World entry should not overload real registration semantics

Overloading the existing `Register` UX would blur the difference between:

- preview-only entry,
- actual transaction-backed entry.

That is bad for correctness and bad for operator trust.

### 4.3 Worldmap refresh is already owner-scoped

Worldmap now subscribes to cosmetics-store changes and forwards owner-scoped refresh requests to army and structure managers.

Implication:

- a dev preview flow can reuse the normal resolver and renderer path once the applied loadout is promoted locally.

### 4.4 The main MVP risk is not cosmetics, it is player presence

The cosmetics stack can only affect visible entities that exist for the player.

Implication:

- the MVP should be framed as local preview entry for existing player-owned world state,
- preview fixtures are explicitly out of scope here.

## 5. Goals

1. Let developers enter a world in dev mode without calling `register`.
2. Reuse the existing pending loadout and applied loadout runtime path.
3. Keep preview entry local to the browser session and current account.
4. Keep the normal registration flow unchanged and truthful.
5. Make the entry UI explicitly say this is local-only preview behavior.
6. Ensure preview entry can be reset cleanly.
7. Keep the scope small enough to ship independently of synthetic fixture work.

## 6. Non-Goals

- Creating contract or Torii state that pretends the player registered.
- Making the server or other clients observe preview entry.
- Faking leaderboard or game participation state.
- Spawning synthetic armies or structures for accounts with no world presence.
- Replacing `CosmeticsDebug`.
- Supporting production users; this is dev-only.

## 7. Product Requirements

### R1. Dev preview entry must be explicit and dev-only

The feature must only exist in development contexts.

Acceptance:

- the action is gated by `import.meta.env.DEV` and/or a dedicated env flag,
- the UI copy clearly says it is local-only,
- production builds do not expose the preview entry affordance.

### R2. Preview entry must not call the registration transaction

The preview path must bypass Starknet execution entirely.

Acceptance:

- no `register` call is sent,
- no entry-token flow runs,
- no lock or approval calldata is emitted,
- local preview entry still opens the game client.

### R3. Pending cosmetic loadout must be promoted into active runtime state

When the developer enters preview mode for a world, the selected pending draft for that world context must become the active applied loadout for that local session.

Acceptance:

- armies and structures resolve the promoted loadout through the normal runtime store,
- the resolver path remains the same as the real applied-loadout path,
- changing the draft later does not silently alter an already entered preview world unless explicitly reapplied.

### R4. Preview entry gating must be local and session-scoped

The client must maintain a local preview-entry record keyed by:

- account,
- chain,
- world.

Acceptance:

- the state survives view changes during the current session,
- it does not survive as fake global truth in shared data stores,
- clearing session state removes the preview entry.

### R5. Game-entry UX must disclose preview mode

The entry modal and/or world card must tell the developer that:

- this is not real registration,
- cosmetics are local-only,
- other clients will not see the preview.

Acceptance:

- the modal contains explicit copy,
- the user can distinguish real entry from preview entry,
- there is a clear exit/reset action.

### R6. Preview entry must not mutate unrelated runtime state

The preview path must not fabricate broader world truths.

Acceptance:

- it does not rewrite `isRegistered` from Torii,
- it does not impersonate settlement completion,
- it only relaxes local client gating enough to enter and preview cosmetics.

### R7. The scope must stop before synthetic fixture injection

If the player has no visible entities in the target world, the system may enter preview mode but there may be little or nothing to observe.

Acceptance:

- this limitation is documented,
- no hidden fake entity spawning is bundled into this MVP,
- follow-up work for synthetic fixtures is tracked separately.

## 8. Technical Design

### 8.1 Local preview session model

Introduce a small client-only preview state keyed by:

```ts
type DevPreviewWorldKey = `${chain}:${worldName}:${address}`;

interface DevPreviewEntryState {
  previewEntered: boolean;
  enteredAt: number;
  loadoutWorldKey: string;
}
```

Preferred storage:

- in-memory store for current runtime,
- mirrored to `sessionStorage` for refresh resilience during a dev session.

Not required:

- persistent multi-session storage,
- synchronization across tabs,
- synchronization across devices.

### 8.2 Entry model

Do not overload the real `register()` path as a hidden branch.

Preferred design:

- keep real registration in [use-world-registration.ts](/Users/os/conductor/workspaces/eternum/san-juan-v5/client/apps/game/src/hooks/use-world-registration.ts),
- add a sibling preview-entry path, either:
  - `enterPreview()`,
  - or a separate `use-world-preview-entry.ts`.

The preview path should:

1. resolve the current pending loadout,
2. validate that the draft is locally usable,
3. promote the draft to `activeBlitzLoadouts`,
4. mark the local preview session as entered,
5. open the game-entry modal / bootstrap flow without any tx.

### 8.3 Loadout promotion

Promotion should use the existing runtime seam:

- `setPendingBlitzLoadout(...)`
- `markAppliedBlitzLoadout(...)`

No parallel cosmetics state should be created for preview mode.

The preview entry flow should copy the relevant draft into the world-scoped applied slot and let the resolver consume it normally.

### 8.4 UI integration

Primary touchpoints:

- [cosmetics-view.tsx](/Users/os/conductor/workspaces/eternum/san-juan-v5/client/apps/game/src/ui/features/cosmetics/cosmetics-view.tsx)
- [game-card-grid.tsx](/Users/os/conductor/workspaces/eternum/san-juan-v5/client/apps/game/src/ui/features/landing/components/game-selector/game-card-grid.tsx)
- [game-entry-modal.tsx](/Users/os/conductor/workspaces/eternum/san-juan-v5/client/apps/game/src/ui/features/landing/components/game-entry-modal.tsx)

Preferred UX:

- keep the existing pending loadout summary,
- add a dev-only `Preview Enter` or `Local Preview` action,
- add preview-mode disclosure in the entry modal,
- add `Clear Preview` or equivalent reset affordance.

### 8.5 Client-side entry gating

The client already uses world availability and registration state to decide how the user enters games.

For preview mode, the client should treat:

- `previewEntered === true`

as sufficient local permission to continue into bootstrap, without rewriting remote registration truth.

That means:

- UI gating is relaxed locally,
- data truth from Torii remains untouched,
- the feature remains obviously local-only.

### 8.6 Runtime application

No resolver fork should be introduced.

The expected path is:

```text
Cosmetics UI draft
  -> pending loadout in playerCosmeticsStore
  -> dev preview entry promotes draft to active loadout
  -> bootstrap / world entry
  -> resolver reads applied loadout
  -> worldmap owner refresh applies skins and attachments
```

### 8.7 Reset behavior

Preview state must be easy to clear.

Required reset points:

- manual clear action,
- explicit preview exit,
- optional modal close reset if we choose that UX.

Preferred behavior:

- clearing preview removes the session record,
- clearing preview does not erase the pending draft unless explicitly requested,
- applied preview loadout can be replaced by re-entering preview with a new draft.

## 9. Files In Scope

Primary files:

- `client/apps/game/src/hooks/use-world-registration.ts`
- `client/apps/game/src/ui/features/landing/components/game-selector/game-card-grid.tsx`
- `client/apps/game/src/ui/features/landing/components/game-entry-modal.tsx`
- `client/apps/game/src/ui/features/cosmetics/model/use-cosmetic-loadout-store.ts`
- `client/apps/game/src/three/cosmetics/player-cosmetics-store.ts`
- `client/apps/game/src/three/scenes/worldmap.tsx`

Likely new files:

- `client/apps/game/src/hooks/use-world-preview-entry.ts`
- `client/apps/game/src/hooks/store/use-dev-preview-entry-store.ts`
- preview-entry tests adjacent to the new hook/store

## 10. TDD Delivery Plan

### Phase 0: Baseline Lock and Scope Guardrails

Scope:

- define the preview-entry contract,
- lock that it is dev-only,
- lock that it is separate from real registration.

Tests first:

- add failing tests proving preview entry is gated behind dev-only conditions,
- add failing tests proving preview entry does not call registration execution,
- add failing tests proving the new state is session-scoped by account/world key.

Acceptance:

- the code has a clear preview-entry seam,
- production registration remains untouched,
- tests fail if preview mode leaks into non-dev flow.

### Phase 1: Session-Scoped Dev Preview State

Scope:

- add a local preview-entry store,
- support read/write/reset,
- optionally mirror to `sessionStorage`.

Tests first:

- add failing tests for set/get/reset,
- add failing tests for account/world isolation,
- add failing tests for session restore semantics.

Acceptance:

- preview state is local-only and correctly keyed,
- reset behavior is deterministic,
- no remote registration state is modified.

### Phase 2: Dev Preview Entry UX

Scope:

- add the dev-only world-card action,
- surface preview-mode disclosure in the modal,
- connect the existing pending loadout summary.

Tests first:

- add failing tests for the dev-only action visibility,
- add failing tests for modal disclosure copy,
- add failing tests for pending-loadout summary visibility in preview entry.

Acceptance:

- the preview action is clearly separate from `Register`,
- users can see that the mode is local-only,
- the modal reflects the selected loadout.

### Phase 3: Runtime Promotion and Resolver Application

Scope:

- promote pending loadout into applied state on preview entry,
- reuse existing resolver/runtime store,
- trigger owner-scoped refresh as needed.

Tests first:

- add failing tests for draft -> applied promotion,
- add failing tests for army resolution after preview entry,
- add failing tests for structure resolution after preview entry,
- add failing tests for attachment application after preview entry.

Acceptance:

- the preview loadout renders through the normal runtime path,
- no debug-only cosmetics fork is created,
- worldmap picks up the local applied state.

### Phase 4: Entry Gating and Lifecycle Reset

Scope:

- let preview entry bypass local client gating,
- preserve explicit reset behavior,
- ensure exit does not poison later sessions.

Tests first:

- add failing tests for local enter permission with preview state,
- add failing tests for clear-preview reset,
- add failing tests proving real registration truth remains unchanged.

Acceptance:

- the developer can enter a game locally without tx,
- clearing preview removes the local bypass,
- the client does not pretend remote registration changed.

### Phase 5: Signoff Matrix and Follow-Up Fence

Scope:

- add a compact signoff matrix for the MVP,
- document the synthetic-fixture follow-up as separate scope.

Tests first:

- add end-to-end tests for pending draft -> preview entry -> army render,
- add end-to-end tests for pending draft -> preview entry -> structure render,
- add tests for reset and re-entry with a different draft.

Acceptance:

- the MVP path is covered,
- limitations around missing player entities are explicit,
- fixture injection remains outside this delivery.

## 11. Risks and Mitigations

### 11.1 Preview entry could be mistaken for real registration

Mitigation:

- separate button/action,
- explicit modal copy,
- dev-only gating.

### 11.2 Local gating bypass could accidentally drift into production behavior

Mitigation:

- keep the path dev-only,
- lock it with tests,
- avoid mutating the normal registration hook in place where unnecessary.

### 11.3 Players with no world entities may think the feature is broken

Mitigation:

- document the limitation clearly,
- optionally show a message when no player-owned entities are visible,
- keep synthetic fixtures as a separate follow-up.

### 11.4 Preview state could outlive its useful session

Mitigation:

- session-only persistence,
- explicit clear action,
- deterministic reset on exit where appropriate.

## 12. Definition of Done

This PRD is complete when:

1. a dev-only preview entry action exists,
2. it bypasses tx registration entirely,
3. it promotes the pending draft into local applied runtime state,
4. the game-entry UX clearly marks preview mode as local-only,
5. armies and structures render the applied preview loadout through the normal runtime path,
6. preview state is session-scoped and resettable,
7. tests cover the preview-entry seam end to end,
8. synthetic fixture injection remains explicitly out of scope.

## 13. Follow-Up Scope (Not In This PRD)

If we later want cosmetics preview to work even when the player has no real world entities, that should be a new PRD covering:

- synthetic preview structures,
- synthetic preview armies,
- explicit visual labeling for fake entities,
- cleanup and ownership boundaries for injected preview data.

That work should not be silently folded into this MVP.
