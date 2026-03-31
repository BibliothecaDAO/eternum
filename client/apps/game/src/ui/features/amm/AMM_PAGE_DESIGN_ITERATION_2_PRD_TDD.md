# AMM Page Design Iteration 2 PRD / TDD

## Status

- Status: Implemented
- Issue: `#4520`
- Scope: `client/apps/game/src/ui/features/amm/*` and `client/apps/game/src/ui/features/landing/views/amm-view.tsx`
- Primary goal: tighten the Agora desktop AMM layout so the pool rail, action panel, and chart align cleanly without
  text collisions or wasted panel space

## Why This Exists

The first AMM design pass improved the pool rail and sorter, but the page still has layout regressions:

- the desktop pool rail can visually extend below the action and chart panels
- pool row names still compete with the LORDS spot price for the same horizontal space
- the action card repeats context that is already obvious from the selected pool
- the swap metrics row leaves unused width and wraps more than necessary

Issue `#4520` is a follow-up design pass to remove those rough edges without changing AMM behavior.

## Product Goals

### User goals

- Pool browsing should feel contained inside the desktop AMM shell.
- Resource names should stay readable without colliding with price text.
- The action panel should remove redundant labels and emphasize the controls.
- Swap metrics should use the available width so values do not wrap unnecessarily.

### Engineering goals

- Keep layout ownership local to the components that already own each section.
- Preserve the existing AMM page structure instead of introducing a new shell.
- Cover the design changes with source-level regression tests before implementation.

## Non-goals

- No change to AMM calculations, routing, or transaction flow.
- No redesign of the chart panel beyond alignment with the surrounding layout.
- No change to mobile-first behavior outside of keeping the existing shell intact.

## Product Requirements

### Pool rail shell

1. The desktop pool rail must align with the bottom of the action and chart region while the swap tab is selected.
2. The desktop rail should be wider than the previous 300px layout so row content has more room.
3. Pool browsing must remain internally scrollable within the rail.

### Pool row content

1. Resource names must own the full top line in each pool row.
2. The redundant `Resource Pool` label must be removed.
3. The LORDS spot price must move below the resource name while keeping the same compact visual treatment.
4. Market cap and TVL must remain right-aligned and readable without overlapping the price block.
5. The displayed spot price should stay formatted to four decimal places.

### Action card content

1. The selected pool pair subtitle under `Agora Actions` must be removed.
2. The route panel should no longer render the `Route` label.
3. The route content itself should remain visible.

### Swap metrics row

1. The swap metrics cards must expand to fill the available action panel width.
2. The cards should avoid unnecessary text wrapping at desktop sizes.

## TDD Plan

## Red

1. Extend `amm-integration.source.test.ts` with one test that locks the desktop rail width and bounded-height shell.
2. Extend `amm-integration.source.test.ts` with one test that locks the pool row copy and layout changes.
3. Extend `amm-integration.source.test.ts` with one test that locks the action-card header cleanup and wider metrics
   row.
4. Run the targeted Vitest file and confirm the new assertions fail for the expected reasons.

## Green

1. Update `amm-dashboard.tsx` to widen the desktop rail and keep the dashboard columns aligned.
2. Update `amm-pool-list.tsx` and `amm-pool-row.tsx` to give the pool rail more horizontal space and reorganize the row
   layout.
3. Update `amm-swap.tsx` to remove the route label and rebalance the metrics grid.
4. Update `amm-dashboard.tsx` to remove the redundant selected-pair subtitle in the action card.
5. Add the required latest-features entry documenting the UX improvement.

## Refactor

1. Re-read the top-level AMM orchestration functions for readability and local ownership.
2. Keep layout class names and helper names business-oriented rather than implementation-oriented.
3. Avoid introducing inline layout complexity into parent orchestration components when a child already owns the
   section.

## Verification Plan

1. Run `pnpm exec vitest run src/ui/features/amm/amm-integration.source.test.ts` from `client/apps/game`.
2. Run `pnpm run format`.
3. Run `pnpm run knip`.
4. If practical in the local environment, do one browser pass on the AMM page to verify the desktop composition
   visually.

## Verification Notes

1. `npx -y node@20.19.0 $(which pnpm) --dir client/apps/game test -- src/ui/features/amm/amm-integration.source.test.ts`
   passed.
2. `npx -y node@20.19.0 $(which pnpm) run format` passed.
3. `npx -y node@20.19.0 $(which pnpm) run knip` passed.
