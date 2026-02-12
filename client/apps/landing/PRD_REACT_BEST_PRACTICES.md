# PRD: `client/apps/landing` React Best-Practices Remediation

## Document Control
- Product: Landing App (`client/apps/landing`)
- Date: February 12, 2026
- Owner: Frontend Platform + Landing Team
- Status: Draft for execution

## 1. Problem Statement
The landing app has correctness and performance risks in high-traffic routes (`/`, `/$collection`, `/trade/$collection`, `/mint`) that increase bundle cost, trigger unnecessary rerenders/refetches, and can produce incorrect marketplace data in some flows.

This remediation effort defines a focused, measurable upgrade to React/TanStack-query patterns aligned with Vercel React best practices (bundle, async/data, rerender optimization).

## 2. Goals
1. Fix correctness issues in marketplace UX (listing/order state consistency).
2. Reduce initial and route-level JS payload for common user paths.
3. Remove avoidable rerenders and client work in token-heavy pages.
4. Normalize loading/data-fetch patterns for maintainability and predictable UX.
5. Establish guardrails to prevent regression.

## 3. Non-Goals
1. Full visual redesign of the landing app.
2. Backend/Torii schema redesign.
3. Migration away from TanStack Query/Router.
4. Changing game logic, blockchain contracts, or marketplace business rules.

## 4. Success Metrics
## 4.1 Product/UX Metrics
1. Zero known incorrect listing-detail lookups across collections.
2. No user-facing regressions in buy/list/cancel/edit flow.

## 4.2 Performance Metrics
1. Reduce non-loot collection route JS payload by removing chest-opening heavy code from eager route chunks.
2. Improve interaction latency on `/trade/$collection` during sweep selection.
3. Decrease redundant re-renders in collection grids and pagination controls.

## 4.3 Engineering Metrics
1. Remove production `console.log` calls from landing app source.
2. Eliminate dead/duplicated loading paths (`Suspense` + manual loading for same tree).
3. Add lint/test checks to block key regression classes.

## 5. Current-State Findings (Scope Drivers)
1. Wrong contract source in modal order lookup for non-season-pass tokens.
   - `client/apps/landing/src/components/modules/token-detail-modal.tsx`
2. Chest-opening flow imported eagerly in `/$collection`.
   - `client/apps/landing/src/routes/$collection.lazy.tsx`
   - `client/apps/landing/src/components/modules/chest-opening/opening-stage.tsx`
3. Duplicated loading logic and ineffective suspense usage.
   - `client/apps/landing/src/routes/$collection.lazy.tsx`
   - `client/apps/landing/src/routes/mint.lazy.tsx`
   - `client/apps/landing/src/routes/trade/activity.lazy.tsx`
   - `client/apps/landing/src/routes/trade/$collection/activity.lazy.tsx`
   - `client/apps/landing/src/routes/trade/$collection/index.lazy.tsx`
4. Expensive selection loop updates in trade collection route.
   - `client/apps/landing/src/routes/trade/$collection/index.lazy.tsx`
   - `client/apps/landing/src/stores/selected-passes.ts`
5. Unbounded page-link rendering in wallet collection route.
   - `client/apps/landing/src/routes/$collection.lazy.tsx`
6. Sidebar state persistence bug (writes stale value).
   - `client/apps/landing/src/components/ui/sidebar.tsx`
7. Polling/logging overhead in hot paths.
   - `client/apps/landing/src/hooks/services/apiClient.ts`
   - `client/apps/landing/src/stores/selected-passes.ts`
   - `client/apps/landing/src/routes/trade/$collection/index.lazy.tsx`

## 6. Product Requirements by Epic

## Epic A: Correctness + Production Hygiene
### Objective
Resolve known behavior bugs and remove noisy production diagnostics.

### Requirements
1. Token detail order queries must use the selected token’s contract address, not a hardcoded collection address.
2. Sidebar persisted open/closed state must match the newly set state.
3. Remove production `console.log` usage from app runtime code.
4. Preserve error logging where it provides user-relevant diagnostics (`console.error` only when meaningful).

### Acceptance Criteria
1. Opening token details for at least 3 different collections shows correct listing/order state.
2. Sidebar open/collapse state persists correctly across refresh.
3. `rg "console.log\(" client/apps/landing/src` returns zero matches.

### Implementation Scope
1. `client/apps/landing/src/components/modules/token-detail-modal.tsx`
2. `client/apps/landing/src/components/ui/sidebar.tsx`
3. All `client/apps/landing/src/**` runtime logging sites

## Epic B: Bundle and Render Performance
### Objective
Reduce eagerly loaded code and unnecessary render/update work.

### Requirements
1. Chest-opening experience and related heavy media logic must be code-split from generic collection route execution.
2. Replace per-item selection toggling loops with batched store updates for sweep behavior.
3. Replace full-page-number rendering with bounded pagination windowing on large collections.
4. Remove no-op or redundant suspense wrappers where data is not suspense-driven.

### Acceptance Criteria
1. Visiting non-loot `/$collection` route does not load chest-opening code chunk(s).
2. Sweep interaction performs one batched state update per user action (not N toggles).
3. Wallet collection pagination renders bounded links (window + first/last behavior).
4. Loading UI appears exactly once per route state transition (no duplicated spinners/fallbacks).

### Implementation Scope
1. `client/apps/landing/src/routes/$collection.lazy.tsx`
2. `client/apps/landing/src/routes/trade/$collection/index.lazy.tsx`
3. `client/apps/landing/src/stores/selected-passes.ts`
4. `client/apps/landing/src/routes/mint.lazy.tsx`
5. `client/apps/landing/src/routes/trade/activity.lazy.tsx`
6. `client/apps/landing/src/routes/trade/$collection/activity.lazy.tsx`

## Epic C: Data-Fetch Governance and Polling Discipline
### Objective
Control refetch behavior and enforce consistent query patterns.

### Requirements
1. Standardize query options for polling, stale time, and background behavior by route intent.
2. Add request cancellation support for fetch helpers to avoid stale/overlapping responses during quick UI changes.
3. Ensure suspense usage is intentional and aligned with suspense query hooks.

### Acceptance Criteria
1. Query configs for core routes are centralized or consistently shared.
2. Aborted navigation/filter changes do not apply stale results to UI.
3. Polling intervals are justified and documented for each high-frequency query path.

### Implementation Scope
1. `client/apps/landing/src/hooks/services/apiClient.ts`
2. `client/apps/landing/src/hooks/services/index.ts`
3. Query call sites in routes and modal components

## 7. Functional Requirements
1. Users can list, edit, cancel, and buy NFTs without cross-collection order mismatch.
2. Route transitions and filtering do not display contradictory loading states.
3. Large token collections remain responsive during selection and pagination.
4. Loot-chest functionality is unchanged for loot-chest users.

## 8. Technical Requirements
1. Use lazy boundaries (`React.lazy`/route-level split points) for chest-opening module chain.
2. Extend selection store with bulk operations:
   - `setSelection(pageId, tokens[])`
   - `removeSelection(pageId, tokenIds[])`
   - Optional `replaceSelection(pageId, tokens[])`
3. Ensure query keys remain deterministic and primitive-based where possible.
4. Keep TypeScript strictness and existing route contracts intact.

## 9. UX Requirements
1. No flicker/double-spinner in route-level loading.
2. Pagination controls remain understandable when windowed.
3. No behavioral changes to current button labels/actions unless needed for correctness.

## 10. Rollout Plan
## Phase 1 (Week 1): Correctness + Hygiene
1. Fix token detail query source.
2. Fix sidebar cookie persistence.
3. Remove production logs.
4. Add/adjust tests for correctness paths.

## Phase 2 (Week 2): Bundle + Render
1. Implement chest-flow lazy loading split.
2. Batch selection store updates and integrate in trade collection page.
3. Window pagination in wallet collection route.
4. Simplify duplicated suspense/loading states.

## Phase 3 (Week 3): Query Governance
1. Introduce shared query option policy.
2. Add abort support through fetch helpers and query functions.
3. Final pass for polling rationalization and docs.

## 11. Test Plan
## 11.1 Automated
1. Unit tests:
   - selection store batched behavior
   - pagination window calculations
2. Component/integration tests:
   - token detail modal data correctness per collection
   - loading-state behavior per route
3. Static checks:
   - lint rules for `console.log` ban in production source
   - optional custom lint rule or CI grep check

## 11.2 Manual QA
1. Collections: realms, season-passes, loot-chests, cosmetics.
2. Flows: browse, filter, paginate, select sweep, buy, list, edit, cancel.
3. Device classes: desktop + mobile sidebar behavior.
4. Route warm/cold navigation to validate lazy chunk behavior.

## 12. Risks and Mitigations
1. Risk: Over-splitting creates loading jank.
   - Mitigation: Keep split boundaries feature-driven; preload on intent where needed.
2. Risk: Batch selection logic changes selection semantics.
   - Mitigation: Snapshot tests for selection transitions + manual QA on sweep controls.
3. Risk: Polling reductions may slow freshness perception.
   - Mitigation: Keep critical trading feeds on justified intervals; tune with QA feedback.

## 13. Dependencies
1. Frontend team bandwidth for route/store refactors.
2. CI support for lint/test updates.
3. Optional analytics/perf instrumentation access for before/after comparison.

## 14. Definition of Done
1. All Epic A acceptance criteria pass.
2. Epic B shows measured bundle/render improvements and no functional regressions.
3. Epic C query policies are implemented and documented.
4. QA checklist completed across target routes and devices.
5. PR merged with changelog notes and follow-up tickets only for explicitly deferred items.

## 15. Out-of-Scope Follow-Ups (Backlog)
1. Full query architecture consolidation into route loaders where appropriate.
2. Broader media optimization (image CDN policy, responsive source sets).
3. Extended performance budgets in CI (bundle-size threshold gates).
