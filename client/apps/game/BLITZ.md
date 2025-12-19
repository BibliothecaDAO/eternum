# BLITZ — Improvements / Bugfixes Qualification + Implementation Plans

This document qualifies each requested item against the current Blitz desktop client codebase and proposes an
implementation plan (with concrete code pointers). Where details are missing, questions are included per item.

## Legend

- **Ownership**
  - **Game app**: `client/apps/game/*`
  - **Shared core**: `packages/core/*` (imported as `@bibliothecadao/eternum`)
  - **Types**: `packages/types/*` (imported as `@bibliothecadao/types`)
  - **Torii / SQL**: `sqlApi` + `@bibliothecadao/torii` fetchers
- **Effort**: S (≤1 day), M (2–4 days), L (≥1 week / multi-team)
- **Risk**: Low/Med/High (risk of regressions / UX complexity / contract dependency)

---

## 1) Bugfixes

### 1.1 Transfer desync (auto arrival triggering too soon)

**Observed symptom**  
Auto-offload (“auto arrival”) triggers before the arrival is actually claimable, causing a failed/pending tx and
potentially a client “desync” experience.

**Where in code**

- Auto-claim loop + indicators: `client/apps/game/src/ui/store-managers.tsx` (`ResourceArrivalsStoreManager`)
- Arrival schedule derivation: `packages/core/src/utils/resource-arrivals.ts` (`getAllArrivals` / `formatArrivals`)
- Time source: `packages/core/src/utils/timestamp.ts` (`getBlockTimestamp()` uses `Date.now()`)

**Why this can happen in this codebase (likely contributors)**

- **Client time drift**: `getBlockTimestamp()` is derived from local wall clock, not chain time. If the user clock is
  ahead, the client believes `now >= arrivesAt` earlier than the chain does, so it submits `arrivals_offload` too soon.
- **Too-aggressive safety buffer**: auto-claim currently adds `configManager.getTick(TickIds.Default)` as a delay
  (`blockDelaySeconds` in `client/apps/game/src/ui/store-managers.tsx`). If `TickIds.Default` is small, it may not cover
  Torii/indexer lag (and it is not explicitly tied to delivery tick cadence).
- **Potential BigInt/number mixing**: `ResourceArrivalInfo.arrivesAt` is a `bigint` (`packages/types/src/types/common.ts`)
  but `updateArrivalIndicators()` compares `arrival.arrivesAt <= now` where `now` is a `number`
  (`client/apps/game/src/ui/store-managers.tsx`). That can throw in JS and break the scheduler/indicators, amplifying
  “desync” perception.

**Proposed solution (preferred)**

- Make arrival readiness use a **network-derived timestamp** (Torii/provider) instead of local time, plus a configurable
  **safety buffer**.
- Fix all `bigint` vs `number` comparisons consistently to avoid runtime exceptions.

**Implementation plan (M / Med risk)**

1. **Fix BigInt comparisons**
   - In `client/apps/game/src/ui/store-managers.tsx`, update `updateArrivalIndicators()` to compare using either
     `Number(arrival.arrivesAt)` or `BigInt(now)`.
   - Audit other arrival comparisons (e.g. `client/apps/game/src/ui/features/economy/resources/deposit-resources.tsx`)
     to ensure they always `Number()` the BigInt side or use BigInt consistently.
2. **Introduce a network-sourced “now”**
   - Option A (preferred): derive current block timestamp from Torii/provider heartbeats and store it in a store
     (e.g. `use-network-status-store` or a new `use-chain-time-store`).
   - Option B: poll a lightweight endpoint for current block timestamp (if already available in Torii SQL).
   - Use the network “now” (with drift correction) for auto-claim readiness and for UI countdowns.
3. **Tune auto-claim readiness**
   - Replace `blockDelaySeconds = configManager.getTick(TickIds.Default)` with a dedicated constant
     (e.g. `AUTO_CLAIM_SAFETY_BUFFER_SECONDS = 10–30`) or tie to `TickIds.Delivery`.
   - Add “desync aware” gating: if network status is desynced/pending-tx, pause auto-claims.
4. **Improve backoff semantics**
   - Current retry uses `retryDelaySeconds = max(blockDelaySeconds, 1)`; move to exponential backoff capped at e.g. 60s
     per arrival key.
5. **Add debug instrumentation**
   - In dev builds, log `{ arrivalKey, arrivesAt, now, driftSeconds }` when submitting offloads.

**Validation**

- With a skewed system clock (±60s), auto-claim should not submit early.
- No runtime exceptions from BigInt/number comparisons.
- Auto-claim submits once per arrival and doesn’t spam failures under Torii lag.

**Questions**

- Is this repro’d mostly on specific machines/browsers (clock drift), or universally?
- When it happens, do you see reverted txs for `arrivals_offload`, or do they hang pending?
- What’s the expected UX: always auto-claim, or only when player is idle / not in combat?

---

### 1.2 Capping a hyperstructure triggers an “allocate shares” tx you can’t act on

**Observed symptom**  
On capturing (“capping”) a hyperstructure, an `allocate_shares` transaction is triggered automatically and appears
un-actionable (likely an unexpected wallet prompt or stuck internal tx state).

**Where in code**

- Auto allocation component: `client/apps/game/src/ui/features/world/components/hyperstructures/blitz-hyperstructure-shareholder.tsx`
- Mounted globally: `client/apps/game/src/ui/layouts/world.tsx` (`<BlitzSetHyperstructureShareholdersTo100 />`)
- Share tx messaging: `client/apps/game/src/ui/shared/components/tx-emit.tsx` (`TransactionType.SET_CO_OWNERS`)

**Why this can happen in this codebase**

- The component executes `allocate_shares` inside a `useEffect` whenever `ownedHyperstructures` changes (including right
  after a capture), with no explicit user intent, no gating on wallet type, and no queueing relative to the capture tx.
- If the capture is optimistic / pending, ownership might not be final, making the call revert or produce a confusing
  prompt.

**Proposed solution (preferred)**

- Remove “silent auto-tx” behavior. Either:
  1. **Contract-side fix**: ensure new/captured hyperstructures default to `[(owner, 100%)]` (best, but contract change),
     or
  2. **Client-side UX fix**: prompt once (“Set shares to 100%?”) and run it on user click, not automatically.

**Implementation plan (S/M / Med risk)**

1. Add hard gates in `client/apps/game/src/ui/features/world/components/hyperstructures/blitz-hyperstructure-shareholder.tsx`:
   - skip if `account.address === "0x0"` or no signer
   - skip if provider has a pending tx queue
   - skip if the hyperstructure was already processed in this session (track in `useRef<Set<ID>>()`)
2. Replace auto execution with an explicit UX surface:
   - Add a small banner/button inside the hyperstructure panel (or a toast) to “Normalize shares (100%)”.
   - Only auto-run if the account is a burner / auto-sign account (if the provider exposes that signal).
3. Longer-term: consider a contract/system change so capture/creation sets shares automatically.

**Validation**

- Capturing a hyperstructure no longer triggers unexpected `allocate_shares` prompts.
- If the user chooses to normalize shares, tx is actionable and succeeds.

**Questions**

- Is this strictly a Blitz behavior requirement, or should it apply in Eternum too?
- What does “can’t do anything with” mean exactly: wallet prompt never appears, appears behind overlay, or tx is stuck in
  internal queue?

---

### 1.3 Map labels/state not syncing (defenses not refreshed after a fight / reinforcement)

**Observed symptom**  
Selected tile panel shows correct defense state, but world-map labels (3D CSS labels) are stale after fights or defense
changes.

**Where in code**

- Label update optimization (dirty-key): `client/apps/game/src/three/managers/structure-manager.ts`
  - `updateStructureLabelData()` builds a `dataKey` for skipping DOM updates
  - `guardKey` currently uses `slot:category:tier:count` but not stamina
- Guard label UI includes stamina bars: `client/apps/game/src/three/utils/labels/label-factory.ts`
  - `createGuardArmyDisplay()` (via `label-components`) uses `stamina`
- Structure updates come from:
  - `packages/core/src/systems/world-update-listener.ts` (`Structure.onStructureUpdate`)
  - consumed in `client/apps/game/src/three/scenes/worldmap.tsx` (`Structure.onStructureUpdate` subscription)

**Why this can happen in this codebase**

- `StructureLabelType` displays stamina (bars) but the dirty-key omits stamina, so stamina-only changes won’t re-render.
- After combat, stamina changes are very likely even when troop counts don’t.

**Proposed solution**

- Include stamina (and any other label-relevant fields) in the label `dataKey`.

**Implementation plan (S / Low risk)**

1. In `client/apps/game/src/three/managers/structure-manager.ts`, update:
   - `guardKey` to include stamina (e.g. `${slot}:${category}:${tier}:${count}:${stamina}`).
2. (Optional) Include any other label-driven fields not currently covered (e.g. guildName if shown).
3. Validate that performance impact is acceptable (this increases update frequency, but still gated by visibility).

**Validation**

- After a fight, defense stamina bars and any “cooldown” indicators update without requiring a chunk refresh.
- After reinforcement, label matches selected panel immediately.

**Questions**

- What exactly is stale on the label: troop counts, stamina bars, cooldown icon, or ownership marker?

---

### 1.4 Auto build sometimes returns “space is occupied”

**Observed symptom**  
Using “Auto build” sometimes fails with an on-chain (or preflight) error that the target tile is already occupied.

**Where in code**

- Auto build selection logic: `client/apps/game/src/ui/features/settlement/construction/select-preview-building.tsx`
  - `handleAutoBuild()` picks `availableSpot` by checking `TileManager.isHexOccupied()` plus optimistic `occupied/vacated`
    sets

**Why this can happen in this codebase**

- Occupancy is checked against the local ECS snapshot (Torii stream). Under lag/desync, it can be stale relative to the
  sequencer state.
- When multiple build txs are in-flight, local optimistic tracking may not reflect the final state fast enough.

**Proposed solution**

- Make auto-build resilient: treat “space is occupied” as a recoverable error and retry with another candidate slot.

**Implementation plan (S/M / Low–Med risk)**

1. In `handleAutoBuild()`:
   - Precompute candidate list.
   - Attempt `placeBuilding(...)`.
   - On a failure matching “occupied”, mark that candidate as occupied and try the next (max N attempts).
2. If all candidates fail, show a targeted toast:
   - “World state is stale — try re-syncing or waiting for pending tx confirmation.”
3. Optionally fetch a fresher occupancy snapshot right before selecting candidates (Torii SQL endpoint if available).

**Validation**

- Repeated auto-build clicks should pick a new slot instead of repeatedly failing the same one.

**Questions**

- Is the “space is occupied” error definitely from the chain, or from client validation inside `TileManager`?
- Does it correlate with `NetworkDesyncIndicator` being active?

---

### 1.5 Transfer relics then troops if merging troops that own relics

**Observed symptom**  
When moving/merging troops away from an explorer that holds relics, relic handling happens too late (or not at all),
causing relics to be stranded/lost.

**Where in code**

- Troop transfer/merge flow: `client/apps/game/src/ui/features/military/components/transfer-troops-container.tsx`
  - uses system calls `explorer_explorer_swap`, `explorer_guard_swap`, `guard_explorer_swap`, `explorer_add`
- Relic data already exists client-side:
  - `client/apps/game/src/ui/store-managers.tsx` (`RelicsStoreManager` polls `sqlApi.fetchAllPlayerRelics`)
  - stored in `useUIStore.playerRelics` (`client/apps/game/src/hooks/store/use-realm-store.ts`)
- Relic transfer UI: `client/apps/game/src/ui/features/military/components/transfer-resources-container.tsx`

**Why this can happen in this codebase**

- Troop system calls move troops but do not imply relic transfers.
- If the source explorer ends up at 0 troops and gets removed/invalidated, relics attached to that explorer become hard
  to recover.

**Proposed solution (safe UX-first)**

- Detect “source explorer has relics AND this operation will empty it” and enforce relic transfer first (or batch).

**Implementation plan (M / Med risk)**

1. Add preflight checks in `client/apps/game/src/ui/features/military/components/transfer-troops-container.tsx`:
   - Determine the “from explorer id” for the chosen direction.
   - Determine if `troopAmount` equals the explorer’s current troop count.
   - Lookup relics for that explorer from `useUIStore.playerRelics.armies`.
2. If relics exist and transfer would empty the explorer:
   - Block the action with an inline warning panel and disable the submit button.
   - Provide CTA: “Transfer relics first” that switches the Help modal to the Relics tab (or deep-links).
3. (If supported by the underlying provider): build a single multi-call:
   - transfer relics → transfer troops.

**Validation**

- Explorers with relics cannot be emptied via troop transfer unless relics are moved first.

**Questions**

- Should this guard apply only when emptying the explorer, or always warn on any troop transfer from a relic-holder?
- Are relics expected to follow troops automatically in-game design, or remain independent assets?

---

### 1.6 Secondary popup auto-close is annoying

**Observed symptom**  
Certain SecondaryPopup-based flows close when clicking outside (or otherwise lose focus), disrupting multi-step actions.

**Where in code**

- Modal overlay click-to-close: `client/apps/game/src/ui/layouts/play-overlay-manager.tsx`
  - closes `toggleModal(null)` when pointer-down on overlay background
- SecondaryPopup is used inside modal content for several flows:
  - `client/apps/game/src/ui/features/military/components/help-modal.tsx`
  - `client/apps/game/src/ui/features/military/components/unified-army-creation-modal/unified-army-creation-modal.tsx`
  - `client/apps/game/src/ui/design-system/molecules/secondary-popup.tsx` (draggable window)

**Why this can happen in this codebase**

- `toggleModal(...)` uses a full-screen `BlankOverlayContainer` that closes on outside click. This is correct for true
  modals, but SecondaryPopup is also used as a “window” UI.

**Proposed solution**

- Add modal options to control dismissal behavior (overlay click / Escape), and apply them per popup type.

**Implementation plan (M / Med risk)**

1. Extend UI store modal API (e.g. `toggleModal(content, options?)`) with:
   - `closeOnOverlayClick` (default `true`)
   - `closeOnEscape` (default `true`)
2. Update `client/apps/game/src/ui/layouts/play-overlay-manager.tsx` to respect these options.
3. Mark SecondaryPopup-based “window” flows as `closeOnOverlayClick: false` so accidental outside clicks don’t kill them.
4. (Optional, better UX) Split “modal” vs “window” concepts:
   - windows rendered without a full-screen overlay, allowing map interaction while open

**Validation**

- Clicking outside the transfer/army creation window no longer closes it (when configured).

**Questions**

- Which popups should remain strict modals (blocking) vs act like draggable windows?
- Should map interactions be allowed while they are open?

---

### 1.7 Swap realms while in the army creation popup

**Observed symptom**  
While the army creation UI is open, you cannot switch the active realm without closing/reopening the popup.

**Where in code**

- Army creation popup: `client/apps/game/src/ui/features/military/components/unified-army-creation-modal/unified-army-creation-modal.tsx`
  - `activeStructureId` is derived from `structureId` prop and is not user-changeable

**Proposed solution**

- Add a realm selector inside the popup (dropdown) and make `activeStructureId` internal state.

**Implementation plan (M / Low–Med risk)**

1. Change the modal to manage `activeStructureId` as state:
   - initialize from prop `structureId` (or from currently selected realm)
2. Render dropdown using `playerStructures` (already computed in the modal).
3. On realm change, reset realm-dependent state:
   - free directions, selected direction, troop count, selected troop combo, guard slot selection, cached direction load
4. Ensure the “create” action uses the current `activeStructureId`.

**Validation**

- Switching realms updates available troops, slots, and directions live without closing.

**Questions**

- When switching realms, should the modal preserve attack/defense mode and troop selection, or reset fully?

---

### 1.8 Fix bottom-right panel when a relic is active

**Observed symptom**  
When an entity has an active relic effect, the bottom-right selected tile panel behaves incorrectly (layout/scroll/visual
bugs).

**Where in code**

- Bottom-right panel shell: `client/apps/game/src/ui/features/world/components/bottom-right-panel/bottom-right-panel.tsx`
- Active relic effects rendering:
  - `client/apps/game/src/ui/features/world/components/entities/active-relic-effects.tsx`
  - embedded in `client/apps/game/src/ui/features/world/components/entities/banner/structure-banner-entity-detail.tsx`

**Likely causes in this codebase**

- `StructureBannerEntityDetail` wraps `ActiveRelicEffects` with its own “Active Relic Effects” header, but
  `ActiveRelicEffects` also renders a header + divider. This can lead to duplicated headers/dividers and awkward spacing.
- Height constraints: bottom-right panel is `35vh`. The relic section may push tab controls out of view if scroll isn’t
  correctly applied to the right container.

**Proposed solution**

- Make `ActiveRelicEffects` embeddable (optional header/divider), and ensure the selected-tile panel always scrolls
  correctly under height constraints.

**Implementation plan (S/M / Low risk)**

1. Add props to `ActiveRelicEffects`:
   - `showHeader?: boolean` (default true)
   - `showDivider?: boolean` (default true)
2. Update `StructureBannerEntityDetail` to either:
   - remove its wrapper header and let `ActiveRelicEffects` own it, or
   - set `showHeader={false}` and keep the wrapper header.
3. Verify scroll:
   - ensure the content container around `SelectedWorldmapEntity` uses `min-h-0` + `overflow-auto` at the correct level.

**Validation**

- With active relic effects, the bottom panel remains usable: tabs visible, scroll works, no duplicated headers.

**Questions**

- What exactly is the failure mode (cannot scroll, clipped content, duplicated UI, performance drop)? A screenshot/video
  would make this one much faster to pinpoint.

---

## 2) QoL

### 2.1 Auto register points every once in a while

**Goal**  
Automatically call `claim_share_points` periodically so users don’t forget to register shareholder points.

**Where in code**

- Manual register button: `client/apps/game/src/ui/features/social/components/register-points-button.tsx`
- System call entrypoint: `claim_share_points` (Dojo system call)

**Constraints**

- If users use external wallets, auto-register will trigger signing prompts (potentially annoying).

**Implementation plan (M / Med risk)**

1. Add a user preference (persisted) for auto-register:
   - interval (e.g. 5–15 minutes)
   - minimum unregistered points threshold
2. Implement a background effect (similar to `RelicsStoreManager` in `client/apps/game/src/ui/store-managers.tsx`):
   - compute `unregisteredShareholderPoints`
   - if above threshold and not already pending, submit `claim_share_points`
3. Rate-limit and dedupe:
   - don’t submit while there’s a pending tx
   - enforce “cooldown” between attempts
4. Refresh leaderboard data after success (already done in the button).

**Questions**

- Should auto-register default ON for Blitz (burner wallets) and OFF otherwise?
- Should it only run near endgame, or always?

---

### 2.2 Plunder camp button

**Goal**  
When selecting a camp (Blitz `StructureType.Village`), provide a one-click entrypoint to attack/raid it.

**Where in code**

- Camp is surfaced as “Camp”: `client/apps/game/src/ui/features/story-events/story-event-stream.tsx` (`getLocationLabel`)
- Camp structure detail UI: `client/apps/game/src/ui/features/world/components/entities/banner/structure-banner-entity-detail.tsx`
- Existing battle system calls:
  - `client/apps/game/src/ui/features/military/battle/quick-attack-preview.tsx`
  - `client/apps/game/src/ui/features/military/battle/raid-container.tsx`

**Implementation plan (M / Med risk)**

1. Define “plunderable camp” rule:
   - likely `StructureType.Village` and `owner == bandits/0` (need exact condition)
2. Add a `Plunder` button in `StructureBannerEntityDetail` when viewing a camp:
   - on click: open a lightweight attacker picker (nearest army / selected army / guard)
   - then open `QuickAttackPreview` / combat modal prefilled with target
3. Wire to the correct system call (guard-vs-explorer vs explorer-vs-guard vs raid).

**Questions**

- Is “plunder” always the same system call, or does it depend on camp type/state?
- Should the button appear only when the player has an eligible attacker adjacent / in range?

---

### 2.3 “Send donkeys to this structure” button

**Goal**  
From a structure’s detail panel, quickly open the transfers UI with that structure as the destination.

**Where in code**

- Transfers window: `client/apps/game/src/ui/features/economy/transfers/transfer-automation-popup.tsx`
- Transfer panel: `client/apps/game/src/ui/features/economy/transfers/transfer-automation-panel.tsx`
- Existing prefill is source-only: `useUIStore.transferPanelSourceId`

**Implementation plan (M / Low–Med risk)**

1. Extend UI store with a destination prefill:
   - `transferPanelDestinationId: number | null`
2. Extend `TransferAutomationPanel` props:
   - add `initialDestinationId?: number | null` and prefill `destinationIds`
3. Add the button to entity detail UI:
   - `StructureBannerEntityDetail` (for structures)
   - possibly `ArmyBannerEntityDetail` (send to owning realm) if desired
4. UX behavior:
   - if user owns multiple sources, either default source to “currently controlled realm” or leave source unselected but
     destination prefilled.

**Questions**

- Should this work for any structure, or only owned/friendly structures?
- Should it preselect Donkey resource and open the “Transfer” tab automatically?

---

### 2.4 Better battle feed notifications

**Goal**  
Make battle notifications clearer, more actionable, and less spammy.

**Where in code**

- Battle feed UI: `client/apps/game/src/ui/features/story-events/story-event-stream.tsx`
- “Under attack” toast (separate system): `client/apps/game/src/three/scenes/worldmap.tsx` (`notifyArmyUnderAttack`)
- Toast infra for story events: `client/apps/game/src/ui/features/story-events/story-event-toast-provider.tsx`

**Implementation plan (M / Med risk)**

1. Unify battle notifications onto one mechanism (preferably the story-event toast provider):
   - migrate `notifyArmyUnderAttack` to use the same provider/styling + dedupe
2. Add severity + user filtering:
   - only “my units/structures” by default
   - toggle for “global battles” when spectating
3. Improve actions:
   - “Focus camera”
   - “Open logs”
   - “Mute battle alerts (15m)”
4. Ensure dedupe keys are stable (battleId + timestamp).

**Questions**

- Which events are considered high priority (under attack, win/loss, camp capture)?
- Should spectating show all battles by default?

---

### 2.5 Improve top header data

**Goal**  
Expose the most important at-a-glance status in the top header (without clutter).

**Where in code**

- Top header: `client/apps/game/src/ui/features/world/containers/top-header/top-header.tsx`
- Structure select: `client/apps/game/src/ui/features/world/containers/top-header/structure-select-panel.tsx`
- Already available status sources:
  - arrivals counts: `useUIStore.arrivedArrivalsNumber/pendingArrivalsNumber`
  - automation: `useAutomationStore.nextRunTimestamp`, last execution summaries
  - points: `useLandingLeaderboardStore`, `RegisterPointsButton` logic

**Implementation plan (M / Low risk)**

1. Decide which 2–4 metrics matter most for Blitz:
   - points + unregistered points
   - pending arrivals
   - automation health
   - current realm coords / level
2. Add compact “status pills” with tooltips and click actions:
   - click arrivals → open Resource Arrivals view
   - click points → open leaderboard / register points
   - click automation → open automation window
3. Keep it responsive (truncate and hide on small widths).

**Questions**

- What’s the priority order for top header metrics in Blitz?

---

### 2.6 Spec mode: cycle players top left

**Goal**  
When spectating, cycle through players (likely leaderboard order) from the top header without manual searching.

**Where in code**

- Spectator mode state: `client/apps/game/src/hooks/store/use-realm-store.ts` (`isSpectating`, `setStructureEntityId`)
- Leaderboard data: `client/apps/game/src/ui/features/landing/lib/use-landing-leaderboard-store.ts`
- Navigation helper: `client/apps/game/src/hooks/helpers/use-navigate.ts`
- Player structure lookup exists elsewhere:
  - `sqlApi.fetchPlayerStructures(...)` is used in `client/apps/game/src/ui/features/social/components/player-id.tsx`

**Implementation plan (M/L / Med risk)**

1. Define “player roster”:
   - top N leaderboard entries (fast + stable)
2. Add prev/next controls in `TopHeader` visible when `isSpectating`:
   - maintain current roster index in local state or store
3. On cycle:
   - fetch cached player structures via `sqlApi.fetchPlayerStructures(address)`
   - pick a “primary” structure (rule: first realm, or highest level, or last active)
   - navigate using `goToStructure(..., spectator: true)`
4. Cache results per address to keep cycling snappy.

**Questions**

- Cycle through top 50 only, or allow expanding to all players?
- What should be the default “primary structure” for a player?

---

### 2.7 Reduce relics popup width

**Goal**  
Make relic activation popup narrower/denser so it doesn’t dominate the screen.

**Where in code**

- Relic activation modal: `client/apps/game/src/ui/features/relics/components/relic-activation-selector.tsx`
  - currently uses `contentClassName="max-w-[520px]"`
- Modal wrapper: `client/apps/game/src/ui/design-system/molecules/base-popup.tsx`

**Implementation plan (S / Low risk)**

1. Reduce width:
   - change `max-w-[520px]` → `max-w-[420px]` (or responsive: `max-w-sm md:max-w-[420px]`)
2. Ensure content wraps:
   - long entity names should truncate/wrap within cards
3. Validate with multiple holders (scroll still OK).

**Questions**

- Target width preference (e.g. 360, 420, 480)?

---

### 2.8 Indicator: running low on resource + automation not running

**Goal**  
Warn when key inputs are running low and/or the automation loop is stalled.

**Where in code**

- Automation state: `client/apps/game/src/hooks/store/use-automation-store.ts`
  - `nextRunTimestamp`, `lastExecution.skipped`, etc.
- Automation engine: `client/apps/game/src/hooks/use-automation.tsx`

**Implementation plan (M / Med risk)**

1. Define health signals:
   - “automation stalled” if `nextRunTimestamp` is in the past by > X minutes
   - “automation skipping” if `lastExecution.skipped` has recent entries
   - “low resource” if any monitored resource is below threshold (per realm or global)
2. Add a derived selector/helper:
   - e.g. `getAutomationHealthSummary()` returning `{ level, reasons }`
3. Render a compact indicator in TopHeader or LeftCommandSidebar with tooltip + click to open automation window.

**Questions**

- Which resources should be monitored in Blitz (Donkey/Labor/Essence/Lords/food)?
- Should this be global or per-realm (and if per-realm, which realm is “active”)?

---

### 2.9 Rework army module

**Goal**  
Broad UX/system refactor for army management (creation, transfers, defense, merging, relic safety).

**Where in code (main hotspots)**

- Creation: `client/apps/game/src/ui/features/military/components/unified-army-creation-modal/*`
- Transfers: `client/apps/game/src/ui/features/military/components/transfer-troops-container.tsx` +
  `client/apps/game/src/ui/features/military/components/transfer-resources-container.tsx`
- Battle entrypoints: `client/apps/game/src/ui/features/military/battle/*`
- Map action routing: `client/apps/game/src/three/scenes/worldmap.tsx` (entity actions → modals)

**Implementation plan (L / High risk)**

Phase 0 (define scope)

- Collect concrete pain points and desired UX flows (what “rework” means).

Phase 1 (structure + safety)

- Make window behavior consistent (modal vs window).
- Add realm switching in creation modal.
- Add relic-first safety gate for transfers/merges (see 1.5).

Phase 2 (information architecture)

- Consolidate army actions into a single “Army” window with clear tabs:
  - Create / Reinforce / Transfer / Relics / Battle
- Reduce duplicate UI between “help modal” and “army management card”.

Phase 3 (polish)

- Keyboard shortcuts, better defaults, clearer error messaging.
- Optional: persist last-used settings per realm.

**Questions**

- What is the top 3 pain list for “army module” today (with repro steps)?
- Any design reference (Figma/screenshots) to target?

---

### 2.10 Highlight relevant tile when a realm is selected or when navigating to a battle

**Goal**  
Selecting a realm via UI (sidebar/header) or navigating to a battle location should visually highlight that tile in the
3D world map.

**Where in code**

- UI sets selection programmatically:
  - `client/apps/game/src/ui/features/world/containers/left-command-sidebar.tsx` (`setSelectedHex(...)`)
  - `client/apps/game/src/ui/features/story-events/story-event-stream.tsx` (`setSelectedHex(...)`)
- 3D selection highlight is only updated on in-scene clicks:
  - `client/apps/game/src/three/scenes/worldmap.tsx` (`handleHexSelection()` calls `selectedHexManager.setPosition(...)`)
- Store subscription in scene base class does **not** include `selectedHex`:
  - `client/apps/game/src/three/scenes/hexagon-scene.ts` subscribes to `leftNavigationView/structureEntityId/cycle*`

**Why this happens**

The Three scene never reacts to store-driven `selectedHex` updates unless the selection originated from a 3D click.

**Implementation plan (S/M / Low–Med risk)**

1. Add a worldmap-specific store subscription for `selectedHex`:
   - either extend the `HexagonScene` subscription set, or add a separate `useUIStore.subscribe` in `WorldmapScene`
2. When `selectedHex` changes:
   - translate to world coords and call `selectedHexManager.setPosition(...)`
   - optionally show a pulse via `selectionPulseManager` with a distinct color for battle nav
3. Ensure clear/reset behavior stays correct (`clearSelection()`).

**Validation**

- Clicking “go to battle” highlights the battle tile after navigation.
- Selecting a realm from the sidebar highlights the realm tile.

**Questions**

- Do you want different highlight colors for realm selection vs battle navigation vs quests/chests?

---

## Suggested delivery order (if you want a quick “Blitz patch”)

1. **1.3 (labels stale)** + **2.10 (tile highlight)**: cheap, high-visible wins.
2. **1.6/1.7 (popup + realm swap)**: unblocks smoother army workflows.
3. **1.5 (relic safety)**: prevents asset-loss scenarios.
4. **1.1 (auto arrival timing)**: more involved, but reduces desync/pending tx pain.
5. QoL buttons: **2.3 (send donkeys)**, **2.2 (plunder camp)**, then header/notifications polish.

