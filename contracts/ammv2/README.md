# RealmsSwap AMMv2

RealmsSwap AMMv2 is the Cairo AMM core in this package.

Main contracts:

- [Factory](/Users/credence/conductor/workspaces/eternum2-v3/denver/contracts/ammv2/src/packages/core/contracts/factory.cairo)
- [Pair](/Users/credence/conductor/workspaces/eternum2-v3/denver/contracts/ammv2/src/packages/core/contracts/pair.cairo)
- [Router](/Users/credence/conductor/workspaces/eternum2-v3/denver/contracts/ammv2/src/packages/core/contracts/router.cairo)

## Deviation From Uniswap v2

The main intentional economic deviation is in
[pair.cairo](/Users/credence/conductor/workspaces/eternum2-v3/denver/contracts/ammv2/src/packages/core/components/pair.cairo),
inside protocol fee minting.

Classic Uniswap v2:

- charges one trader-visible swap fee
- leaves that fee inside the pool during swaps
- if `fee_to` is enabled, later mints LP tokens to protocol for roughly `1/6` of fee growth

RealmsSwap keeps the same general model:

- swaps still pay one visible fee through normal v2 pricing
- protocol is still not paid during the swap itself
- protocol is still paid later through LP token minting

But RealmsSwap changes the protocol share from roughly `1/6` to roughly `1/3` of fee growth.

Why:

- if operators set the total swap fee to `1.5%` by using `fee_amount = 985`
- then this protocol share targets roughly `0.5%` to protocol
- while roughly `1.0%` remains with LPs

So the deviation is not “take a second protocol skim during swaps.” It is “when protocol LP minting happens later, mint
a larger share than Uniswap v2 would.”

“Fee growth” here means growth in `sqrt(reserve0 * reserve1)` between `k_last` snapshots, which is the same style of
proxy Uniswap v2 uses.

## How To Retune Fees Later

There are two different knobs.

### 1. Total trader-visible swap fee

This is controlled by the factory `fee_amount` numerator over `1000`.

Formula:

- total swap fee = `(1000 - fee_amount) / 1000`

Examples:

- `fee_amount = 997` => `0.3%` total swap fee
- `fee_amount = 990` => `1.0%` total swap fee
- `fee_amount = 985` => `1.5%` total swap fee

### 2. Protocol share of fee growth

This is controlled in
[pair.cairo](/Users/credence/conductor/workspaces/eternum2-v3/denver/contracts/ammv2/src/packages/core/components/pair.cairo)
by the coefficient in:

- `root_k * N + root_k_last`

Approximate rule:

- protocol share of fee growth ≈ `1 / (N + 1)`
- LP share of fee growth ≈ `N / (N + 1)`

Examples:

- `N = 5` => roughly Uniswap v2, protocol gets `1/6`
- `N = 2` => current RealmsSwap, protocol gets `1/3`
- `N = 1` => protocol gets `1/2`

### Putting both together

If you want a target split, choose both knobs together.

Examples:

- `1.5%` total fee with `0.5%` to protocol and `1.0%` to LPs:
  - set `fee_amount = 985`
  - use `N = 2`

- `1.5%` total fee with `0.25%` to protocol and `1.25%` to LPs:
  - set `fee_amount = 985`
  - use `N = 5`

- `1.0%` total fee with roughly `0.1667%` to protocol and `0.8333%` to LPs:
  - set `fee_amount = 990`
  - use `N = 5`

This remains an approximation because protocol capture is realized later through LP minting, not as an immediate
per-swap token transfer.

## Deployment Notes

The deployment scripts live under
[scripts](/Users/credence/conductor/workspaces/eternum2-v3/denver/contracts/ammv2/scripts).

When the deployment config says `setFeeAmountNumeratorAssumeDivIs1000`, it is setting the total trader-visible swap fee
numerator over `1000`.
