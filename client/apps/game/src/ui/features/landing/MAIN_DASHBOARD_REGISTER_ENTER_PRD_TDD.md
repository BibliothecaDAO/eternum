# Main Dashboard Register / Enter PRD / TDD

## Status

- Status: Proposed
- Scope:
  - `client/apps/game/src/ui/features/landing/views/play-view.tsx`
  - `client/apps/game/src/ui/features/landing/components/game-selector/game-card-grid.tsx`
  - `client/apps/game/src/ui/features/landing/components/game-entry-modal.tsx`
  - `client/apps/game/src/ui/layouts/sign-in-prompt-modal.tsx`
  - `client/apps/game/src/ui/layouts/game-loading-overlay.tsx`
  - `client/apps/game/src/hooks/use-world-availability.ts`
  - `client/apps/game/src/hooks/use-world-registration.ts`
  - `client/apps/game/src/runtime/world/*`
  - `client/apps/game/src/ui/utils/network-switch.ts`
- Primary goal: make registration and game entry from the main dashboard feel immediate, resumable, and chain-safe

## Why This Exists

The current dashboard path works, but it does too much work in the wrong places and loses user intent too easily.

What the player feels:

- clicking `Register` can sit in a long pre-transaction flow with unclear progress
- clicking `Play` opens a modal that still has to re-resolve world state and bootstrap the client
- connecting a wallet after choosing a game can dump the player onto a generic `/play` route instead of continuing the chosen action
- switching the wallet network interrupts the flow but does not resume it
- entering the game still takes a double handoff through `/play/hex?col=0&row=0` before the player finally lands on the world map

This is not one bug. It is a flow-ownership problem.

The dashboard currently mixes three jobs:

1. Discover every world and enrich every card eagerly.
2. Guard actions for account and chain state.
3. Perform world-specific bootstrap after the player already chose a game.

That creates visible latency, extra network load, and brittle transition state.

## Product Goals

### User goals

1. Choosing `Register` from a dashboard card should feel like one clear action, not a mini-bootstrap.
2. Choosing `Play` or `Settle` should continue the exact game the player picked, even if they had to connect first.
3. A successful network switch should continue the action automatically.
4. Entering a game should land directly in the intended world view without an obvious intermediate hop.
5. Loading states should explain what is happening and never feel stuck or ambiguous.

### Engineering goals

1. Preserve action intent across sign-in, network switching, and modal transitions.
2. Reduce eager landing-page fetch fanout so dashboard load scales with what is visible, not with every known world.
3. Remove redundant world resolution and route hops from the happy path.
4. Keep chain checks and tx execution aligned so post-switch calls do not use stale state.
5. Cover the repaired flow with targeted tests before implementation.

## Non-goals

1. Rebuilding unrelated market, cosmetics, or factory flows in this pass.
2. Replacing Dojo bootstrap architecture wholesale.
3. Redesigning the landing page layout or art direction.
4. Changing gameplay rules for registration, settlement, or pass ownership.

## Current-State Diagnosis

### Dashboard load is too eager

- `UnifiedGameGrid` fetches both chains and then resolves per-world availability and metadata.
- `useWorldsAvailability()` layers world config, player registration, settled-realm checks, and jackpot lookups on top.
- This happens before the player has chosen a game.

Visible result:

- dashboard load scales with total world count
- card state feels sluggish to update
- the app burns network budget on worlds the player may never touch

### Sign-in breaks action continuity

- `PlayView` knows which world and which action the user picked
- `SignInPromptModal` does not
- after connect, it only navigates to `/play`

Visible result:

- the player has to re-find or re-trigger the game they already chose
- route recovery depends on storage side effects instead of explicit state

### Network switching is prompt-only, not flow-owned

- the dashboard detects wrong-chain state and opens `SwitchNetworkPrompt`
- after a successful switch, the prompt closes
- the original action is dropped
- modal tx handlers do not all re-check the chain before executing

Visible result:

- “switch network” feels like it broke the button
- the player has to guess that they should click again
- some later tx paths can still run with stale state

### Entry pays the cost twice

- dashboard card click opens `GameEntryModal`
- the modal re-fetches world metadata for the selected world
- the modal rebuilds the world profile
- bootstrap runs
- normal players enter `/play/hex?col=0&row=0`
- the loading overlay later redirects to the real `/play/map?...`

Visible result:

- entry feels slow even after the player already chose the world
- the flow shows more transition states than the player expects

### Registration is front-loaded with hidden work

- mainnet cards pre-check fee token balances
- registration resolves contracts from factory
- entry-token worlds may mint then poll for token visibility
- polling can last up to 60 seconds before the final register call

Visible result:

- the `Register` button feels inconsistent across worlds
- delay happens before the player gets a strong success or failure signal

## Product Requirements

### Functional requirements

1. Dashboard actions must preserve a `pendingGameIntent` object that includes:
   - action type: `register`, `play`, `settle`, `spectate`
   - world identity: `name`, `chain`, `worldAddress`
   - mode-specific extras only when needed
2. If a player connects from the sign-in modal, the app must continue the stored intent instead of navigating to generic `/play`.
3. If a player confirms a network switch, the app must replay the stored action automatically after the switch succeeds.
4. Modal tx handlers must reject stale-chain execution and use the same guard strategy as the dashboard.
5. Entering a game must navigate directly to the intended world map route whenever the target location is already known.
6. The dashboard must stop eagerly enriching every card with all optional data on first load.
7. World-card data must load in tiers:
   - tier 1: world identity, mode, coarse timing, basic availability
   - tier 2: registration count and player-specific registration state for visible cards
   - tier 3: optional enrichments such as jackpot and prediction-market data only when needed
8. Registration progress must expose explicit stages that map to real work:
   - eligibility check
   - fee / token preparation
   - wallet approval or mint
   - registration submit
   - confirmation
9. The entry modal must reuse already-known world identity data and avoid unnecessary duplicate profile fetches when the selection is fresh.

### UX requirements

1. Clicking `Play` or `Settle` from the dashboard should require at most one user click after sign-in or chain switch, not two.
2. The player should never lose the selected game after connect.
3. Wrong-chain actions should explain that the app will continue automatically after switching.
4. Entry loading copy should reflect one forward-moving handoff, not multiple hidden transitions.
5. Registration errors should identify the failing phase, not just say `Registration failed`.

### Performance requirements

1. Dashboard first render must not require full metadata fanout for every world.
2. Normal player entry must eliminate the extra `/play/hex?col=0&row=0` hop.
3. World bootstrap should start from a fully specified selected world and avoid redundant world-profile rebuilding where cached data is fresh.
4. Registration should avoid blind polling when transaction or event confirmation can answer faster.

## Proposed Solution

## 1. Add a dashboard-owned pending intent controller

Create one landing-owned state seam for action continuation.

Suggested shape:

```ts
interface PendingDashboardIntent {
  action: "register" | "play" | "settle" | "spectate";
  world: {
    name: string;
    chain: Chain;
    worldAddress?: string;
  };
  createdAt: number;
}
```

Responsibilities:

- set before opening sign-in or switch-network prompts
- clear only after the action has been resumed or explicitly cancelled
- provide one `resumePendingIntent()` entry point

## 2. Make sign-in resumable

Replace the generic `navigate("/play")` behavior in `SignInPromptModal`.

New behavior:

1. If there is a pending dashboard intent, close the modal and resume it.
2. If there is no pending intent, keep today’s generic fallback.

This keeps the flow business-correct:

- choose game
- connect
- continue chosen game

## 3. Make network switching resumable

Upgrade `runWithNetworkGuard()` from “open prompt” to “store pending action and continue after switch”.

New behavior:

1. Card click stores the action closure or a resumable action descriptor.
2. Prompt copy explains the action will continue automatically.
3. `handleSwitchNetwork()` re-validates the connected chain and replays the pending action.
4. Modal tx flows use the same guard before `execute()`.

## 4. Split dashboard card data into tiers

The landing dashboard should not hydrate every possible card detail on first load.

Recommended split:

- Tier 1, eager:
  - world list
  - mode
  - coarse season timing
  - online/offline availability
- Tier 2, visible-card only:
  - registration count
  - player registration state
  - settled realm state
- Tier 3, opt-in:
  - jackpot amount
  - prediction market lookup
  - claim summary for ended games

Implementation rule:

- expensive enrichments should be gated by viewport visibility, active column, or explicit interaction

## 5. Remove the double navigation on entry

The player should not enter `/play/hex?col=0&row=0` unless there is no better target.

New happy path:

1. Resolve the target map position before route navigation if it is already known.
2. Navigate directly to `/play/map?...`.
3. Keep the loading overlay as a renderer/data readiness handoff, not as a second route handoff.

Fallback path:

- only use the old generic location when no target position is yet knowable

## 6. Make registration stage ownership honest

`useWorldRegistration()` already exposes stages. Tighten them around real work and improve surfaced errors.

Recommended changes:

- separate preflight from tx submission
- distinguish `waiting-for-token` from `waiting-for-register-confirmation`
- attach user-facing error mapping per stage
- evaluate whether entry-token confirmation can use transaction receipts or indexed events before a full owner scan loop

## 7. Reuse selected-world data through entry

The selected world card already knows part of what the modal needs.

New rule:

- pass a typed `SelectedWorldContext` into the modal
- reuse that context for bootstrap seed data
- only fetch missing profile data
- avoid rebuilding the same world profile twice in the same short-lived dashboard handoff

## Delivery Slices

### Slice 1, unblock broken continuity

1. Pending dashboard intent state
2. Sign-in resume
3. Network-switch resume
4. Modal-level chain guard

This is the highest-value slice. It fixes the “network switch broke it” and “connect lost my game” complaints directly.

### Slice 2, remove the most visible entry latency

1. Direct-to-map entry
2. Overlay reduced to readiness only
3. Selected-world data reuse through entry bootstrap

### Slice 3, reduce dashboard fetch pressure

1. Tiered card data
2. Visible-card gating
3. Deferred jackpot / market / claim enrichment

### Slice 4, tighten registration latency

1. Better stage mapping
2. Less blind polling
3. Stage-aware error copy

## TDD Plan

## Red

1. Add a source or unit test for `SignInPromptModal` that fails until connect resumes the selected dashboard intent instead of navigating to generic `/play`.
2. Add a unit test for dashboard network switching that fails until the original action is replayed after a successful switch.
3. Add a source or unit test for `GameEntryModal` that fails until the normal player path goes directly to `/play/map?...` when target coordinates are known.
4. Add a unit test for dashboard data loading seams that fails until optional enrichments are not part of the eager first-load path.
5. Add a unit test for registration-stage mapping that fails until stage-specific errors and confirmation phases are explicit.
6. Run the targeted tests and confirm they fail for the expected missing behavior.

## Green

1. Add the pending dashboard intent store/controller.
2. Update `PlayView` and `SignInPromptModal` to preserve and resume the chosen action.
3. Update `runWithNetworkGuard()` and the switch prompt flow to replay pending actions automatically.
4. Add a shared chain guard for modal tx actions.
5. Update entry navigation to prefer direct world-map handoff.
6. Reduce eager card enrichment and gate optional enrichments behind visibility or interaction.
7. Tighten registration stage ownership and stage-aware error mapping.

## Refactor

1. Re-read `PlayView`, `GameCard`, and `GameEntryModal` top-level handlers in order.
2. Extract business-oriented helpers so top-level orchestration reads like a checklist:
   - `storePendingDashboardIntent(...)`
   - `resumePendingDashboardIntentIfPossible(...)`
   - `guardDashboardActionByWalletChain(...)`
   - `resolveDirectWorldEntryTarget(...)`
   - `loadVisibleCardRegistrationState(...)`
3. Keep route, bootstrap, and tx detail out of the top-level click handlers.

## Verification Plan

1. Run the targeted landing and entry tests added in this work.
2. Run the relevant registration and world-availability tests.
3. Run `pnpm run format`.
4. Run `pnpm run knip`.
5. Do one browser pass covering:
   - click `Play` while logged out, connect, confirm the chosen game resumes
   - click `Play` or `Register` on the wrong chain, switch, confirm the action resumes automatically
   - register on a mainnet-fee world and a token-entry world
   - enter a normal player flow and confirm direct map entry without the extra route hop

## Risks

1. Intent replay must avoid storing stale closures across unmounts. Prefer action descriptors over raw callbacks where practical.
2. Tiered card loading can accidentally create inconsistent card states if tier boundaries are not explicit.
3. Direct-to-map entry must preserve spectator and fallback behaviors.
4. Registration confirmation changes must stay correct for both mainnet and non-mainnet entry-token worlds.

## Open Questions

1. Can entry-token confirmation be derived from the obtain-token transaction receipt or event stream instead of wallet ownership polling?
2. Which card enrichments actually need first-paint accuracy, and which can trail by one interaction?
3. Is there any remaining hard dependency on `/play/hex?col=0&row=0` for the normal player path, or can it become fallback-only?
