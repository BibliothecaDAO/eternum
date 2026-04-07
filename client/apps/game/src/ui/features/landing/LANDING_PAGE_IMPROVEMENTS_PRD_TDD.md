# Landing Page Improvements PRD / TDD

## Status

- Status: Implemented
- Issue: `#4375`
- Scope:
  - `client/apps/game/src/ui/features/landing/*`
  - `client/apps/game/src/ui/features/market/landing-markets/*`
  - `client/apps/game/src/ui/features/world/latest-features.ts`
- Primary goal: make the landing News and Learn tabs easier to maintain, and make Prediction Markets more actionable on
  first visit

## Why This Exists

Issue `#4375` groups three connected landing-page improvements:

1. News should stop depending on manual ordering and stale hardcoded metadata.
2. Learn should give new players a clear first step and visible guide freshness.
3. Prediction Markets should default to actionable markets, explain themselves, and expose real sort controls.

Some adjacent groundwork already exists in the repo:

- game cards already know how to deep-link into a market when one exists
- controller-name display is already routed through the shared `MaybeController` wrapper

This pass should preserve that working behavior while finishing the missing discoverability and maintainability work.

## Product Goals

### User goals

1. Players should immediately understand what changed recently without reading a stale or misordered changelog.
2. New players should see one obvious onboarding path before being asked to choose among many guides.
3. Markets should open on live opportunities, explain what the page is, and let players sort by the stat they care
   about.

### Engineering goals

1. News and Learn content should move toward explicit data contracts instead of inline view literals.
2. Sorting, capping, and grouping rules should live in named helpers rather than implicit array order.
3. The top level of landing views should read in product terms, not data-shaping detail.

## Non-goals

1. No redesign of the landing shell or tab navigation.
2. No change to prediction-market trading mechanics or modal flows.
3. No automatic CMS or remote content source for News or Learn in this pass.
4. No removal of historical guide entries; deprecated entries should become hidden, not deleted.

## Product Requirements

### News tab

1. Every news entry must carry a `date`.
2. Display order must be derived by descending date, not by manual array order.
3. The feed shown on the landing page must be capped to the 10 newest entries.
4. Each entry may optionally include:
   - `gameSlug`
   - `readMore`
5. Type badges must remain visually prominent in both the landing News tab and the popup feed.

### Learn tab

1. The top of the tab must contain a single pinned `New? Start Here` card.
2. Guides must be grouped into explicit `Beginner` and `Advanced` sections.
3. Each visible guide must show `verifiedAt`.
4. Guides marked `deprecated: true` must be excluded from the rendered lists without deleting the data entry.
5. Practice Games must stay below the onboarding and guide sections.

### Prediction Markets

1. The landing Markets view must default to the `Live` filter when no explicit status is provided.
2. The page must show a collapsible explainer header that gives first-time visitors basic context.
3. Sort controls must allow:
   - Creation Date
   - End Time
   - Volume
   - Pool Size
4. Live market cards must surface current TVL as the primary stat instead of all-time volume.
5. Existing game-card deep links and controller-name display must remain intact.

## Delivery Notes

1. The issue text asks for three separate branches, but this workspace request is to produce one implementation plan and
   begin shipping the code.
2. I am treating the work as one coordinated landing-page pass while keeping each slice isolated in its own helpers and
   tests.
3. The controller-name and game-card market-link behavior already appear present in the current codebase, so this pass
   will lock them in rather than re-invent them.

## TDD Plan

## Red

1. Add a behavior test for `latest-features.ts` that fails until the feed auto-sorts descending, caps to 10, and keeps
   optional metadata.
2. Add a Learn data test that fails until start-here content, guide tiers, `verifiedAt`, and `deprecated` filtering
   exist behind a named data contract.
3. Add a Markets source test that fails until the view defaults to `Live`, exposes a collapsible explainer, renders real
   sort controls, and shows TVL as the primary live-card stat.
4. Run the targeted landing-page tests and confirm they fail for the missing seams above.

## Green

1. Refactor latest-features data into a sorted, capped feed with optional metadata support.
2. Refactor Learn content into explicit data structures and render `New? Start Here`, tiered guides, and freshness
   labels.
3. Update Markets view and market aggregation helpers to support interactive sorting and TVL-first live-card
   presentation.
4. Add the required latest-features entry describing the landing-page UX improvements.

## Refactor

1. Re-read the landing view top-level flows and keep them orchestration-focused.
2. Prefer named builders and resolvers for data shaping over inline array logic inside React components.
3. Keep market sorting rules in a dedicated helper path instead of mixing them into button rendering code.

## Verification Plan

1. Run targeted landing-page tests until red then green.
2. Run `pnpm run format`.
3. Run `pnpm run knip`.
4. If the environment allows it, do one local browser pass on News, Learn, and Markets.

## Verification Notes

1. `npx -y node@20.19.0 $(which pnpm) --dir client/apps/game test -- src/ui/features/world/latest-features.test.ts src/ui/features/landing/views/play-view.learn-hierarchy.source.test.ts src/ui/features/landing/views/markets-view.discoverability.source.test.ts src/ui/features/landing/views/play-view.market-provider-gating.test.ts src/ui/features/landing/views/play-view.live-dev-games.test.ts src/ui/features/landing/views/markets-view.modal-chain-prop.test.ts src/ui/features/market/landing-markets/use-multi-chain-markets.live-priority.test.ts src/ui/features/landing/components/game-selector/game-card-grid.prediction-market-visibility.test.ts`
   passed.
2. `npx -y node@20.19.0 $(which pnpm) run format` passed.
3. `npx -y node@20.19.0 $(which pnpm) run knip` passed.
4. `npx -y node@20.19.0 $(which pnpm) --dir client/apps/game exec tsc --noEmit` is not a clean signal in this workspace
   right now; it fails on broad pre-existing `@bibliothecadao/*` module resolution and unrelated type issues outside the
   landing-page changes.
5. Manual browser verification was not run in this session.
