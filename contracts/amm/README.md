# Eternum AMM

This package contains the standalone Starknet AMM contract and LP token.

## Pool Initialization

- New pools permanently lock `MINIMUM_LIQUIDITY = 1000` raw LP units on the first successful liquidity add.
- The lock is minted to the AMM contract address, not the zero address.
- The first deposit must exceed the lock floor or `add_liquidity` reverts with `insufficient initial liquidity`.
- User-facing `lp_minted` values report only the redeemable LP minted to the provider.

## Operational Notes

- Existing pools do not retroactively gain the minimum-liquidity floor. Operators must recreate and re-seed a pool if
  they want the new floor semantics on a legacy deployment.
- AMM pools are intended for standard ERC20 tokens only. Fee-on-transfer, rebasing, or other balance-mutating token
  mechanics are out of scope for this implementation.

## SDK Parity

- `packages/amm-sdk` mirrors the minimum-liquidity floor and LP mint math used by this contract.
