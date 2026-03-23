# AMM Security Remediation PRD And TDD

This document turns the AMM audit findings into a product requirement and delivery plan.

This is not a redesign document.

This is a correctness and safety document for the shipped AMM stack:

- onchain reserves must match actual token balances
- protocol-fee swaps must not leak or strand value
- indexed reserves, candles, and LP positions must match the live contract
- indexer failures must be explicit and recoverable instead of silent or brittle

## Findings In Scope

1. The AMM contract double-subtracts protocol fees from stored reserves during swaps with protocol fees enabled.
2. The indexer now applies reserve math that does not match the current contract when protocol fees are enabled.
3. The indexer can hard-fail block processing when required pool context is missing.

## Product Goal

After any AMM swap or liquidity action:

1. the AMM contract's stored reserves match the AMM contract's actual ERC20 balances
2. the SDK quote shown to the user matches the net amount the user can receive
3. the indexer reproduces the same reserve transition as the contract
4. pool history, candles, TVL, and LP position views stay aligned with the live protocol
5. operational misconfiguration produces a diagnosable recovery path instead of undefined state

## Why This Matters

These bugs are not cosmetic.

If protocol fees are enabled in production:

- LP accounting becomes incorrect
- reserve-based pricing and TVL become incorrect
- indexer state drifts from the protocol
- replay safety degrades
- later product decisions get made from corrupted analytics

## Users And Stakeholders

- Traders need execution quotes and slippage protection that match live settlement.
- LPs need reserve accounting and position values that match redeemable value.
- Operators need a replayable indexer and explicit failure signals when config or bootstrap state is wrong.
- Integrators need clear quote semantics so they do not mix gross and net output paths.

## Goals

- Fix reserve accounting in the upgradeable AMM contract.
- Make fee-aware quote semantics explicit and testable across contract, SDK, and indexer.
- Make routed swap accounting deterministic per touched pool.
- Replace brittle indexer crash paths with explicit preflight validation and recoverable event handling.
- Define the replay and rollout order required to repair existing indexed state.

## Non-Goals

- redesigning the AMM UI
- adding new AMM features unrelated to security or correctness
- changing fee policy or fee recipient logic
- adding wallet-balance UX improvements
- changing LP token economics outside the reserve-accounting fix

## Core Invariants

These invariants are the source of truth for both implementation and tests.

### Contract Invariants

- For every pool, `get_reserves(token)` must equal the AMM contract's actual balances of LORDS and `token`.
- For a direct swap, `gross_output = user_output + protocol_fee`.
- For a routed swap, each hop must satisfy the same rule independently.
- LP fees stay in the pool and may grow `k`; protocol fees leave the pool and must not be subtracted from reserves
  twice.
- Liquidity add and remove flows must continue to preserve reserve-to-balance alignment after any prior fee-bearing
  swaps.

### Indexer Invariants

- The indexer must derive the same next reserves as the contract from the same event stream.
- A routed swap is two pool mutations, not one synthetic route-level mutation.
- Pool candles and swap rows must be written from pool-hop mutations, not only from route-level labels.
- If pool context is missing, the indexer must not write guessed reserves.

### Quote Invariants

- Offchain quotes used for UX must represent the user's net received output.
- Minimum received must be computed from net output.
- Any surface that returns gross output must be explicitly named or documented as gross-only and must not drive user
  execution safety checks.

## Functional Requirements

### 1. Correct Onchain Reserve Accounting

The AMM contract must update stored reserves exactly once for gross output depletion.

Required behavior:

- `swap_lords_for_token` must reduce token reserves by gross token output, not by gross output plus protocol fee.
- `swap_token_for_lords` must reduce LORDS reserves by gross LORDS output, not by gross output plus protocol fee.
- `swap_token_for_token` must apply the same rule to both touched pools.
- External transfers must continue to send net output to the user and protocol fees to the fee recipient.
- `Swap` event semantics must remain explicit: `amount_out` is net user output, `protocol_fee` is additional extracted
  value.

Acceptance:

- reserve-to-balance equality holds after direct swaps with protocol fees
- reserve-to-balance equality holds after routed swaps with per-hop protocol fees
- LP withdrawal after fee-bearing swaps returns values consistent with stored reserves
- current no-fee behavior remains unchanged

### 2. Define And Enforce Quote Semantics

The stack must stop relying on implicit gross-vs-net assumptions.

Required behavior:

- `packages/amm-sdk` remains the canonical UX quote implementation for net output
- the indexer API `/api/v1/quote` returns net user output and total protocol fee
- if the onchain `quote_lords_for_token` and `quote_token_for_lords` views remain gross-only, they must be documented
  and covered by tests as gross-only views
- client execution paths must use net-output quote helpers for slippage calculations

Acceptance:

- direct quote tests prove net output equals executable output under matching pool state
- routed quote tests prove composed per-hop quoting equals executable routed output
- quote documentation leaves no ambiguity about net vs gross outputs

### 3. Align Indexer Reserve Mutation With Contract Math

The indexer must mirror the contract, not a simplified approximation.

Required behavior:

- direct swaps use event net output plus event protocol fee to reconstruct gross reserve depletion
- routed swaps derive first-hop and second-hop gross output, net output, and protocol fees using the same fee math as
  the AMM contract
- `buildSwapMutations` rejects inconsistent routed events with an explicit typed error
- pool rows, swap rows, and candle rows are written from the per-pool mutations

Acceptance:

- direct swap indexer tests pass for fee-free and fee-bearing pools
- routed swap indexer tests pass when one or both pools charge protocol fees
- indexed reserves match contract reserves on replay fixtures
- candle close/high/low values reflect corrected post-swap reserves

### 4. Harden Indexer Failure Handling

The indexer needs deterministic operational behavior when its local context is incomplete.

Required behavior:

- startup fails fast if `AMM_ADDRESS` or `LORDS_ADDRESS` is missing
- startup validates that the configured LORDS address is not the zero/default empty value
- missing pool state during swap processing produces a structured recovery signal, not an untyped throw
- the recovery path must make it obvious whether to backfill, reindex, or fix configuration
- the indexer package must expose a runnable automated test command so these failure paths stay under TDD

Preferred behavior:

- persist or log a structured replay-gap record with block number, tx hash, token addresses, and cause
- continue processing only if doing so does not require guessed reserves

Acceptance:

- a bad LORDS config is rejected before stream processing starts
- a missing pool row produces a stable, asserted failure mode in tests
- operator logs identify the precise replay action needed
- `client/apps/amm-indexer/package.json` includes a dedicated test script

### 5. Repair Existing Indexed State

Fixing code is not enough if the current database already contains drifted values.

Required behavior:

- define the earliest block from which AMM pools or fees may have been live
- if any fee-bearing swap has been indexed with the buggy math, replay from a safe starting block
- rebuild pools, swaps, candles, and any derived pool stats from canonical events
- communicate expected analytics changes from the replay

Acceptance:

- replay procedure is documented and repeatable
- post-replay sampled reserves match live onchain reserves
- sampled pool histories and candles are internally consistent after replay

## Delivery Plan

### Workstream A: Contract Fix

Files expected to change:

- `contracts/amm/src/amm.cairo`
- `contracts/amm/src/tests/test_amm.cairo`

Outcome:

- reserve updates subtract only gross output once
- direct and routed swaps preserve reserve-to-balance equality

### Workstream B: SDK Quote Semantics

Files expected to change:

- `packages/amm-sdk/src/index.ts`
- `packages/amm-sdk/tests/client.test.ts`
- optional documentation or naming surfaces if gross-only onchain quote semantics remain exposed

Outcome:

- net-output quote behavior is explicit and tested

### Workstream C: Indexer Math And Resilience

Files expected to change:

- `client/apps/amm-indexer/indexers/amm.indexer.ts`
- `client/apps/amm-indexer/indexers/swap-accounting.ts`
- `client/apps/amm-indexer/indexers/swap-accounting.test.ts`
- `client/apps/amm-indexer/api/server.ts`
- `client/apps/amm-indexer/package.json`

Outcome:

- indexer reproduces contract math
- failure handling is deterministic
- package supports package-local test execution

### Workstream D: Rollout And Replay

Files expected to change:

- docs or runbooks describing upgrade, replay, and verification

Outcome:

- operators can safely upgrade the AMM, reindex, and verify the repaired state

## TDD Plan

The order below is mandatory.

No production code should be written until the named failing test exists and has been observed failing for the expected
reason.

### Red 1: Direct Swap Reserve Conservation In Contract

Add failing Cairo tests for:

- `protocol_fee_lords_for_token_keeps_reserve_equal_to_contract_balance`
- `protocol_fee_token_for_lords_keeps_reserve_equal_to_contract_balance`
- `protocol_fee_direct_swap_gross_output_equals_user_plus_fee`

Assertions:

- AMM ERC20 balances equal `get_reserves`
- `gross_output == amount_out + protocol_fee`
- fee recipient balance increases by `protocol_fee`

Expected failure on current code:

- stored reserve is lower than actual AMM token balance by exactly the protocol fee amount

### Green 1

Implement the minimal `_swap_in_pool` change required to make stored reserve depletion equal gross output only once.

### Refactor 1

- extract reusable reserve-vs-balance assertions in Cairo tests
- name helpers in business terms, not math scratch terms

### Red 2: Routed Swap Reserve Conservation In Contract

Add failing Cairo tests for:

- `protocol_fee_token_to_token_keeps_both_pools_aligned_with_balances`
- `protocol_fee_token_to_token_applies_per_hop_fee_once`
- `lp_withdraw_after_fee_bearing_route_matches_recorded_reserves`

Assertions:

- both touched pools maintain reserve-to-balance equality
- per-hop extracted fees add up to emitted total protocol fee
- LP redemption after routed fee-bearing swaps matches expected reserves

### Green 2

Apply the same corrected reserve logic to routed execution through the shared internal swap path.

### Refactor 2

- remove duplicated direct-vs-routed assertions in test helpers
- keep `Swap` event semantics explicit in test names and comments

### Red 3: Quote Semantics

Add failing SDK tests for:

- `quote_swap_returns_net_output_when_protocol_fee_is_enabled`
- `quote_swap_minimum_received_uses_net_output`
- `composed_routed_quote_matches_two_hop_net_execution`

If onchain quote views remain gross-only, add contract or doc tests for:

- `onchain_quote_views_are_gross_only_and_not_execution_safe`

Assertions:

- SDK quotes are net-output quotes
- routed quotes compose from per-hop net outputs
- any gross-only view is explicitly identified as such

### Green 3

Implement the minimum quote changes or documentation changes needed to make net-vs-gross semantics unambiguous.

### Red 4: Direct Swap Indexer Math

Add failing indexer tests for:

- `direct_fee_bearing_swap_mutation_matches_contract_reserve_delta`
- `direct_fee_bearing_swap_records_net_amount_out_and_fee_separately`

Assertions:

- indexed next reserves equal corrected contract reserves
- swap row stores net `amountOut`
- mutation math uses gross reserve depletion derived from net output plus fee

Expected failure on current code, if contract fix lands first:

- indexer reserves remain too high because the helper still subtracts only one fee-adjusted net amount

### Green 4

Update direct swap mutation logic to mirror corrected contract semantics exactly.

### Red 5: Routed Swap Indexer Math

Add failing indexer tests for:

- `routed_fee_bearing_swap_mutates_input_and_output_pools_correctly`
- `routed_fee_bearing_swap_derives_per_hop_fees`
- `routed_fee_bearing_swap_captures_per_pool_history_rows`

Assertions:

- first hop and second hop each match corrected contract math
- final net output matches event `amountOut`
- per-pool rows and candle values use the corrected post-swap reserves

### Green 5

Implement the minimal routed mutation changes needed to align with the corrected contract.

### Refactor 5

- centralize gross/net/protocol-fee derivation in one shared indexer helper
- keep the top-level transform flow readable: decode event, resolve pool context, build mutations, persist mutations

### Red 6: Indexer Missing-Context Handling

Add failing tests for:

- `missing_pool_context_returns_structured_replay_error`
- `missing_lords_config_fails_preflight_validation`
- `route_derivation_mismatch_is_logged_as_recoverable_gap`

Assertions:

- failures are typed and actionable
- logs or persisted error records include block, tx, event, and token addresses
- no guessed reserve writes occur after a missing-context failure

### Green 6

Implement preflight validation and structured failure handling for missing pool or config context.

### Red 7: Replay Verification

Add failing integration or fixture-driven tests for:

- `replayed_pool_reserves_match_onchain_sample`
- `replayed_lp_positions_match_pool_reserves`
- `replayed_candles_match_corrected_swap_sequence`

Assertions:

- a replay from canonical events produces stable corrected state
- sampled derived views agree with pool reserves

### Green 7

Implement the minimum replay tooling or documented replay procedure needed to verify repaired state.

## Test Matrix

### Contract

- zero protocol fee direct swap
- nonzero protocol fee direct swap
- nonzero protocol fee routed swap with fee on one pool
- nonzero protocol fee routed swap with fee on both pools
- LP add/remove after fee-bearing swaps
- constant-product checks with LP fee retained and protocol fee extracted

Command:

```bash
snforge test --package eternum_amm
```

### SDK

- direct quote net output
- minimum received from net output
- routed composed quote correctness
- gross-vs-net semantics documentation tests if needed

Command:

```bash
pnpm --dir packages/amm-sdk test
```

### Indexer

- direct mutation math
- routed mutation math
- candle updates from corrected per-pool mutations
- missing pool context handling
- config preflight validation

Command requirement:

- add `test` to `client/apps/amm-indexer/package.json`

Target command after that change:

```bash
pnpm --dir client/apps/amm-indexer test
```

### Repo Checks

```bash
pnpm run format
pnpm run knip
```

## Rollout Plan

### Phase 1: Land Tests And Contract Fix

- merge failing tests first in local development
- implement contract fix
- run AMM Cairo tests

### Phase 2: Land SDK And Indexer Alignment

- merge corrected quote semantics
- merge corrected indexer mutation logic
- merge structured failure handling

### Phase 3: Upgrade And Replay

- deploy upgraded AMM class if the affected contract is live and upgradeable
- restart indexer with corrected config validation
- replay from the agreed safe starting block

### Phase 4: Verify Live State

- sample multiple pools and compare onchain `get_reserves` to indexed `pools`
- sample recent swaps and verify candle closes and swap rows
- sample user LP positions against reserve-derived values

## Success Metrics

- zero observed reserve-to-balance divergence in post-deploy sampling
- zero routed-swap derivation mismatches on replayed data
- zero untyped indexer crashes caused by missing pool context
- net quote output matches executed output in targeted regression tests

## Open Questions

1. Do we want to keep the onchain quote view functions gross-only, or should they be upgraded to net-output semantics?
2. Should missing pool context halt only the affected route or halt the full indexer until replay is performed?
3. From which exact block must replay begin to guarantee removal of corrupted AMM analytics?

## Exit Criteria

The work is complete only when:

1. contract reserve accounting is fixed and covered by failing-then-passing tests
2. indexer math matches the corrected contract for direct and routed swaps
3. indexer failure handling is explicit and tested
4. replay instructions have been executed or validated on a representative fixture
5. verification confirms onchain, indexed, and quoted state agree
