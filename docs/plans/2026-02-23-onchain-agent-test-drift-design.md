# Onchain-Agent Test Drift Alignment Design

## Goal

Align `client/apps/onchain-agent` tests with current implementation behavior and remove stale assumptions, while keeping live Torii validation enabled and stable using `testy-testy-9`.

## Scope

- Update failing test suites that are asserting removed or outdated behavior.
- Keep production behavior unchanged unless a true defect is proven.
- Keep live Torii tests running by default, but make assertions schema/shape-first (not data-value brittle).

## Non-Goals

- Broad refactors of runtime architecture.
- Expanding feature scope beyond drift correction.
- Rewriting all tests; only drifted suites are targeted.

## Current Drift Categories

1. Action registry initialization drift
- Current implementation requires explicit `initializeActions(...)` before action execution.
- Several tests still assume legacy always-registered handlers.

2. TUI input API drift
- Current code uses `tui.addInputListener(...)`.
- Tests still mock an older terminal callback pattern.

3. Session fixture path drift
- Two session tests read missing root-level fixtures (`manifest.json`, `policy.json`, `profile.json`) that are not present in this repo shape.

4. World-state SQL method drift
- Current world-state path prefers `fetchResourceBalancesWithProduction` fallback logic.
- Some tests/mocks assert old method names and old returned shape assumptions.

5. ABI param schema drift
- Parser can emit `object` for struct params.
- Test allowlist rejects that valid current type.

6. Live Torii brittleness
- Existing endpoint assumptions became stale.
- Live tests need schema/shape checks over hardcoded world-content checks.

## Design

### A. Drift correction policy

Tests must validate what the current implementation does, not what older versions did.
If behavior changed intentionally, tests are updated.
If behavior appears incorrect, first prove a production defect via failing focused test, then fix runtime code.

### B. Live Torii test strategy (schema/shape-first)

Use `https://api.cartridge.gg/x/testy-testy-9/torii/sql` as base.

Assertions should prioritize:
- endpoint availability,
- table presence,
- non-empty result where appropriate,
- row schema/type expectations,
- transformability into expected adapter/view shapes.

Avoid:
- fixed owner addresses,
- exact row counts,
- assumptions tied to one momentary world state.

### C. Fixture strategy

Tests should resolve fixtures from repo-local deterministic paths under `client/apps/onchain-agent/test/`.
Where legacy fixtures are missing, replace with existing fixture files or generate comparable in-test fixtures.

### D. Verification strategy

Run targeted suite groups during each drift fix, then run full `bun run test`.
Success criteria: failing suites pass without masking failures, and live Torii tests pass against `testy-testy-9` with shape-first checks.

## Risks and Mitigations

1. Risk: tests become too permissive.
- Mitigation: enforce shape/type assertions, required keys, and transform invariants.

2. Risk: live endpoint shape changes.
- Mitigation: focus on contract-level schema expectations and avoid incidental value checks.

3. Risk: hidden production bug mistakenly labeled as drift.
- Mitigation: use systematic-debugging workflow before any runtime code change.

## Acceptance Criteria

- Previously failing drifted suites are green under current implementation.
- Live Torii tests run against `testy-testy-9` and remain stable under normal data churn.
- No unrelated production behavior changes introduced.
