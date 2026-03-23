# AMM Audit Hardening PRD And TDD

This document turns the latest AMM contract review into a delivery plan.

It does not blindly accept every review claim as written.

It separates:

- confirmed hardening work we should ship
- findings that were directionally right but technically imprecise
- adjacent risks that should be documented while this code is open

The goal is a safer and more explicit AMM stack across:

- `contracts/amm`
- `packages/amm-sdk`
- operator deployment and migration docs

## Review Triage

### Concerns We Should Address In This Release

- add a permanent minimum-liquidity floor for newly initialized pools
- harden multiply-before-divide math paths against intermediate `u256` overflow
- expand edge-case coverage around initial liquidity, large-value math, and reserve invariants
- document Starknet-specific deployment constraints instead of carrying EVM assumptions into the fix

### Review Claims We Are Narrowing

- The current zero-supply LP design should be treated as protocol hardening debt, not as a proven "drain later deposits"
  exploit.
- Cairo `u256` math does not silently wrap here; it reverts on overflow. The risk is availability and unexpected
  reverts, not silent bad pricing.
- The suggested "mint minimum liquidity to the zero address" implementation is invalid for this stack because
  OpenZeppelin Cairo ERC20 forbids minting to the zero address.

### Additional Risk Surfaced During Triage

- Reserve accounting assumes standard ERC20 behavior. Fee-on-transfer, rebasing, or callback-heavy tokens are not
  supported and must stay out of AMM pools unless the protocol adds explicit support for them later.

## Product Goal

After this hardening release:

1. newly created or re-seeded pools always retain a permanent LP supply floor
2. mathematically valid large-value swaps and liquidity operations do not revert only because an intermediate product
   exceeds `u256`
3. the contract and SDK use the same LP-mint and quote semantics
4. operators have explicit guidance for minimum initial liquidity, lock semantics, and migration of pre-upgrade pools

## Goals

- add minimum-liquidity lock semantics that fit Starknet and OpenZeppelin Cairo
- upgrade AMM math helpers to use wide intermediate arithmetic where needed
- keep top-level AMM behavior readable and testable
- mirror the same economics in `packages/amm-sdk`
- ship a clear operator runbook for rollout and pool migration decisions

## Non-Goals

- gas micro-optimizations
- redesigning swap or liquidity UX
- changing LP fee or protocol fee policy
- adding Dojo integration to the AMM
- adding support for fee-on-transfer or rebasing pool tokens
- retroactively changing live pool economics without an explicit migration ceremony

## Product Decisions

### 1. Minimum Liquidity Is A Hardening Floor

This release adopts permanent minimum liquidity for new pool initializations.

Required design:

- introduce a fixed `MINIMUM_LIQUIDITY` constant in raw LP units
- on first liquidity addition, mint `MINIMUM_LIQUIDITY` LP to the AMM contract address as non-redeemable protocol-held
  supply
- mint `initial_lp - MINIMUM_LIQUIDITY` to the first provider
- revert if the first deposit is too small to leave a positive provider mint after locking the floor
- keep subsequent LP minting proportional to reserve growth

Why this design:

- it provides the common AMM "dust lock" behavior without relying on zero-address minting
- OpenZeppelin Cairo allows minting to the AMM contract address and the current public flow has no path to redeem
  AMM-held LP

Explicit limitation:

- this is not retroactive for already-seeded pools
- pre-upgrade pools only gain the floor if operators intentionally recreate and re-seed them

### 2. Large-Value Arithmetic Uses Wide Intermediates

This release treats overflow as a real correctness and availability concern even though Cairo reverts instead of
wrapping.

Required design:

- replace narrow multiply-before-divide paths with wide intermediate helpers
- use `u512`-style intermediate arithmetic for contract math where the final result may fit even when the intermediate
  product does not fit in `u256`
- preserve existing revert behavior for invalid reserves, invalid denominators, and impossible outputs

Targeted math surfaces:

- `get_input_price`
- `get_output_price`
- `quote`
- `compute_lp_mint`
- `compute_lp_burn`

### 3. Standard ERC20 Support Stays Explicit

This release does not attempt to make the AMM compatible with non-standard token mechanics.

Required design:

- deployment docs must state that AMM pools are limited to vetted standard ERC20s
- pool listing procedures must reject fee-on-transfer and rebasing assets
- tests may include a negative fixture or operator note proving why those token classes are out of scope

## Functional Requirements

### 1. Harden Initial Pool Seeding

Required behavior:

- the first LP deposit must lock `MINIMUM_LIQUIDITY`
- `add_liquidity` must report only the provider-minted LP amount in user-facing return values and events
- `remove_liquidity` must never allow the public LP supply to reach zero for a pool created after this change
- if the first deposit does not exceed the floor, the transaction must revert with an explicit
  insufficient-initial-liquidity error

Acceptance:

- first-provider redemption cannot fully empty a newly created pool
- a newly created pool keeps nonzero reserves and nonzero LP total supply after the first provider removes all
  redeemable LP
- proportional minting for later LPs remains unchanged except for the permanent locked dust

### 2. Support Valid High-Range Math

Required behavior:

- quote and LP math must succeed for high-range values whenever the mathematically correct final result still fits in
  `u256`
- the contract must continue to revert when the final result or input state is invalid
- SDK math must mirror the same formulas using `bigint`

Acceptance:

- targeted large-value fixtures that currently hit `u256_mul Overflow` pass after the change
- normal-size fixtures keep their current outputs
- impossible reserve or output states still revert

### 3. Keep Contract And SDK Semantics Aligned

Required behavior:

- `packages/amm-sdk` must use the same first-mint floor and subsequent LP math as Cairo
- SDK docs and tests must make the first-provider floor explicit
- any helper that exposes LP mint estimates must match the onchain result for the same pool state

Acceptance:

- shared fixture values match between Cairo tests and SDK tests
- first-provider LP estimates no longer overstate the user-minted amount

### 4. Expand Regression Coverage

Required behavior:

- add edge-case tests for first deposit, full provider withdrawal, and boundary math
- preserve current reserve and balance invariants for standard swap and liquidity flows
- add explicit tests for no-fee and fee-bearing paths after the hardening change

Acceptance:

- regression coverage proves the new floor does not break existing swap flows
- reserve-to-balance equality still holds after swaps and liquidity actions in standard-token fixtures

### 5. Make Rollout And Migration Explicit

Required behavior:

- operator docs must define `MINIMUM_LIQUIDITY`, the lock recipient strategy, and the minimum first-deposit requirement
- rollout docs must explain that existing pools do not retroactively gain the floor without recreation
- deployment docs must update any suggestion that references zero-address minting

Acceptance:

- operators can tell which pools need recreation to gain the floor
- deployment guidance is Starknet-correct and internally consistent

## Delivery Workstreams

### Workstream A: Cairo Math And Liquidity Hardening

Files expected to change:

- `contracts/amm/src/math.cairo`
- `contracts/amm/src/amm.cairo`
- `contracts/amm/src/tests/test_amm.cairo`

Outcome:

- new pools receive permanent minimum-liquidity lock behavior
- high-range math uses wide intermediates where required

### Workstream B: SDK Parity

Files expected to change:

- `packages/amm-sdk/src/utils/math.ts`
- `packages/amm-sdk/tests/math.test.ts`
- any small documentation surface that explains LP mint estimation

Outcome:

- SDK math matches contract behavior for both first LP minting and large-value arithmetic

### Workstream C: Operator Docs

Files expected to change:

- deployment or AMM docs describing rollout and pool recreation guidance

Outcome:

- operators know how to initialize pools after the upgrade and how to treat legacy pools

## TDD Plan

The order below is intentional.

No production code should be written until the named failing test exists and has been observed failing for the expected
reason.

### Red 1: First-Mint Floor In Pure Math

Add failing unit tests in:

- `contracts/amm/src/math.cairo`
- `packages/amm-sdk/tests/math.test.ts`

Tests to add:

- first LP mint returns `initial_liquidity - MINIMUM_LIQUIDITY`
- first LP mint reverts when `initial_liquidity <= MINIMUM_LIQUIDITY`
- subsequent LP mint remains proportional

Expected current failure:

- first LP mint returns the full initial liquidity amount
- too-small first deposits do not revert for the minimum-liquidity reason

### Green 1

Implement the smallest possible change in math helpers to introduce `MINIMUM_LIQUIDITY` semantics for first minting.

### Refactor 1

- extract a clearly named LP-floor helper if the top-level math flow becomes noisy
- keep the constant name identical across Cairo and TypeScript

### Red 2: First-Provider Withdrawal Cannot Drain A New Pool

Add failing contract integration tests in `contracts/amm/src/tests/test_amm.cairo` for:

- first liquidity addition mints the lock amount to the AMM contract address
- first provider removing all redeemable LP leaves nonzero reserves and nonzero total LP supply
- event and return values report only provider-minted LP

Expected current failure:

- total LP supply can return to zero
- reserves can return to zero when the only LP exits

### Green 2

Implement the minimal `add_liquidity` change required to mint the floor to the AMM contract address on first
initialization.

### Refactor 2

- extract reusable LP-balance and total-supply assertions in the contract tests
- keep liquidity orchestration readable at the top level

### Red 3: Large-Value Quote Math

Add failing Cairo and SDK tests for high-range fixtures where:

- the mathematically correct final output fits in `u256`
- the current implementation reverts because an intermediate multiplication overflows

Target functions:

- `get_input_price`
- `get_output_price`
- `quote`

Expected current failure:

- revert with `u256_mul Overflow` or equivalent overflow panic

### Green 3

Implement wide intermediate helpers for quote math until the high-range fixtures pass without changing normal-size
outputs.

### Refactor 3

- centralize wide divide helpers under names that describe business intent, not arithmetic plumbing
- remove duplicated high-range fixture setup between Cairo tests where practical

### Red 4: Large-Value LP Accounting

Add failing Cairo and SDK tests for:

- `compute_lp_mint` with large reserves and supply
- `compute_lp_burn` with large reserves and supply

Expected current failure:

- intermediate multiplication overflows even though the final result should fit

### Green 4

Extend wide intermediate helpers to LP mint and burn calculations.

### Refactor 4

- keep LP accounting helpers at one level of abstraction
- rename any temporary math helpers that read like implementation scratch work

### Red 5: Cross-Stack Parity Fixtures

Add failing or incomplete parity tests proving that:

- the same fixture pool state produces the same LP mint result in Cairo and SDK
- the same large-value quote fixtures produce the same result in Cairo and SDK

Expected current failure:

- SDK still reflects old first-provider semantics or lacks the new boundary fixtures

### Green 5

Update SDK helpers and fixtures until parity is explicit and repeatable.

## Post-Green Regression Suite

After the main red-green work is complete, run and keep:

- existing AMM swap and liquidity tests
- new reserve-to-balance assertions after standard swap flows
- no-fee regression fixtures
- fee-bearing regression fixtures

Recommended additional coverage if time permits:

- malicious-token reentrancy harnesses for swap and liquidity entrypoints
- an explicit negative fixture or operator-note test for unsupported fee-on-transfer token behavior

## Verification

- targeted `snforge` runs for AMM math and integration tests
- targeted SDK unit tests
- readability review of exported functions and top-level helpers after implementation
- `scarb fmt`
- `pnpm run format`
- `pnpm run knip`

## Release Notes To Capture

- new pools now lock permanent minimum liquidity
- first-provider LP mint estimates are slightly lower by the lock amount
- existing pools do not automatically gain the floor
- zero-address minting is not part of the Starknet implementation
