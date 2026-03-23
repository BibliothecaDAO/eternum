## Expand Prize Funding Visibility and Eligibility in Factory V2

### Summary

Make prize funding available anywhere a game is actually ready to receive funds, not only on completed Blitz game/series
runs.

Adopt these rules:

- Keep a single `Admin prize funding` card at the parent run level.
- Show it for `game`, `series`, and `rotation` runs.
- Show it for both `blitz` and `eternum`.
- For single-game runs, show it when the run has a `worldAddress` and the game-level `configure-world` step succeeded.
- For series/rotation runs, show it when at least one child game has a `worldAddress` and that child's
  `configure-worlds` child step succeeded.
- Parent `run.status === complete` is no longer required.
- Default selections include eligible unfunded child games only.

### Implementation Changes

#### Backend eligibility and funding flow

- Replace the current `complete + blitz only` prize-funding guards in the worker and CLI with a shared readiness rule:
  - single game is fundable if `artifacts.worldAddress` exists and `configure-world` succeeded
  - series/rotation child is fundable if child `artifacts.worldAddress` exists and its grouped config step is marked
    succeeded in stored child `steps[]`
- Add rotation prize-funding support end to end:
  - add `POST /api/factory/rotation-runs/:environment/:rotationName/actions/fund-prize`
  - route it through the same workflow dispatch as game/series funding
  - enable `runKind=rotation` in `fund-prizes.ts`
  - record transfers back onto the selected child games in the rotation ledger
- Remove the `blitz`-only rejection in worker/CLI and allow `eternum` runs to fund as long as address resolution
  succeeds.
- Keep address resolution chain-based, not mode-based. If the resolved prize distribution address is missing or zero,
  fail with a clear error.

#### UI behavior in Factory V2

- Broaden the client-side funding predicate so the watch workspace can render the card for:
  - eligible individual game runs in `attention`, `waiting`, or `complete`
  - eligible series runs even if the parent is incomplete
  - eligible rotation runs
  - both Blitz and Eternum environments
- Keep the existing parent-level card shape.
- For series/rotation runs, populate the selector from eligible child games only:
  - eligible + unfunded children selected by default
  - already funded eligible children visible but unselected
  - ineligible children visible with a clear "not ready" label
- Update the card copy so it no longer says "Blitz" or "after setup is complete" when those statements are no longer
  true.

#### Data mapping and eligibility plumbing

- Extend the client run mapper/types so the watch UI can tell whether a child is config-complete, instead of inferring
  only from coarse `status`.
- Reuse backend stored child `steps[]` as the source of truth for grouped readiness; do not invent new storage.
- Add one shared helper for prize-funding eligibility in the clean deployer path so worker and CLI use identical rules.

### Public Interfaces / Types

- Add a rotation funding API path in the worker API surface and corresponding client API call.
- Broaden the internal client "fundable run" type from `game | series` to `game | series | rotation`.
- Extend mapped child run data with the minimum readiness signal needed for UI labeling/default selection.

### Test Plan

- Worker tests:
  - game run in `attention` with world created and config succeeded can fund
  - game run with world created but config not succeeded is rejected
  - incomplete series funds only eligible children
  - incomplete rotation funds only eligible children
  - eternum game/series/rotation no longer fail with "only supported for blitz"
- CLI tests:
  - `runKind=rotation` succeeds for selected eligible children
  - selected ineligible child fails with a readiness error
  - default selection skips funded and not-ready children
- Client tests:
  - prize funding card renders for eligible incomplete game runs
  - prize funding card renders for rotation runs
  - default selection includes only eligible unfunded children
  - ineligible children are shown but disabled/labeled not ready
  - copy no longer claims Blitz-only or complete-only behavior

### Assumptions

- "Created successfully" is implemented as `worldAddress exists + config step succeeded`.
- "Config step" means `configure-world` for single-game runs and stored child grouped config success for series/rotation
  children; later steps like lootchest, village-pass, banks, and indexer are not required for funding eligibility.
- The existing chain manifest/factory resolution for `prize_distribution_systems` is valid for Eternum as well as Blitz;
  if not, the funding attempt should fail explicitly rather than being hidden in the UI.
