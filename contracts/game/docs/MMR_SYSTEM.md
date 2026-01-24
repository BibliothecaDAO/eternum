# Blitz MMR System Documentation

This document explains how the MMR (Matchmaking Rating) system works in Eternum's Blitz game mode.

## Overview

The MMR system tracks player skill ratings across ranked Blitz games. It uses a multi-step rating update formula with features like:

- **Percentile-based scoring** - Players gain/lose MMR based on how they perform vs expectations
- **Diminishing returns** - Caps prevent extreme rating swings
- **Mean regression** - Gently pulls ratings toward the distribution center
- **Gas-efficient design** - Two-phase commit + batch claim pattern

## Architecture

### Two-Phase Update Pattern

To avoid expensive on-chain loops over all players, the system uses a commit + claim pattern:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Game Ends &    │     │  Anyone Commits │     │  Anyone Claims  │
│  Rankings       │ ──▶ │  MMR Metadata   │ ──▶ │  MMR Updates    │
│  Finalized      │     │  (medians)      │     │  (all players)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

1. **Commit Phase** (`commit_game_mmr_meta`): After game rankings are revealed, anyone can call this with the list of players sorted by MMR ascending. The contract verifies each player has a valid rank, reads their current MMR from the token, and calculates the median on-chain. This trustless verification prevents manipulation.

2. **Claim Phase** (`claim_game_mmr`): Anyone can claim MMR updates for all players at once. The system calculates and applies the rating change for each player in a single transaction.

### Data Models

| Model | Key(s) | Purpose |
|-------|--------|---------|
| `MMRConfig` | (WorldConfig) | Global system configuration |
| `MMRGameMeta` | trial_id | Committed game metadata (median) |
| `MMRClaimed` | (WorldConfig) | Tracks if claim has been processed |

## MMR Token Contract

The MMR system uses a soul-bound ERC20 token (`MMRToken`) with 18 decimals:

### Key Characteristics

- **Soul-bound**: Non-transferable (all transfer functions revert)
- **18 decimals**: Standard ERC20 decimal precision (1000 MMR = 1000e18 tokens)
- **Auto-initialization**: `balance_of` returns `INITIAL_MMR` (1000e18) for uninitialized players
- **Floor enforcement**: MMR cannot drop below `MIN_MMR` (100e18)
- **Access control**: Only authorized game contracts can update MMR

### Interface

```cairo
#[starknet::interface]
trait IMMRToken<T> {
    /// Get player's current MMR balance
    /// Returns INITIAL_MMR (1000e18) if player has never been initialized
    fn balance_of(self: @T, player: ContractAddress) -> u256;

    /// Update a player's MMR to a new value
    /// Enforces minimum MMR floor, auto-initializes if first update
    fn update_mmr(ref self: T, player: ContractAddress, new_mmr: u256);

    /// Batch update multiple players' MMR
    fn update_mmr_batch(ref self: T, updates: Array<(ContractAddress, u256)>);
}
```

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `INITIAL_MMR` | 1000e18 | Starting MMR for new players |
| `MIN_MMR` | 100e18 | Hard floor - MMR cannot go below this |
| `decimals()` | 18 | Standard ERC20 decimals |

### Precision Handling

The game system internally works with "logical" MMR values (1000 = 1000 MMR) while the token stores values with 18 decimals:

```cairo
// Reading from token (divide by precision)
let current_mmr: u128 = (mmr_token.balance_of(player) / 1e18).try_into().unwrap();

// Writing to token (multiply by precision)
let new_mmr_scaled: u256 = new_mmr.into() * 1e18;
mmr_token.update_mmr(player, new_mmr_scaled);
```

## On-Chain Verification

The commit phase uses trustless on-chain verification to prevent manipulation:

1. **Caller provides player list**: The caller passes an `Array<ContractAddress>` of all players **sorted by MMR ascending**
2. **Player count verification**: Contract asserts `players.len() == trial.total_player_count_revealed`
3. **Player rank verification**: For each player, contract reads `PlayerRank` and asserts `rank > 0`
4. **MMR collection**: For each verified player, reads current MMR from token (or uses `INITIAL_MMR`)
5. **Sort order verification**: Asserts players are sorted by MMR ascending
6. **Median calculation**: Contract computes median on-chain (O(1) since already sorted)

**Note**: The median uses current MMR at commit time, not registration time. This is a design choice that prioritizes simplicity over perfect accuracy when players complete other games between registration and completion.

## Eligibility Requirements

A game is eligible for MMR updates when ALL conditions are met:

| Requirement | Config Field | Default |
|-------------|--------------|---------|
| MMR system enabled | `enabled` | `false` |
| All players revealed | `total_player_count_revealed == committed` | - |
| Minimum players | `min_players` | 6 |
| Token address set | `mmr_token_address` | - |

## The Rating Formula

### Step 1: Median MMR

Calculate the median MMR of all players in the game lobby:
```
M = median{MMR_1, MMR_2, ..., MMR_N}
```

For even-length arrays, returns the average of the two middle values.

### Step 2: Expected Percentile

Using a logistic function, calculate where a player is expected to finish based on their MMR relative to the lobby median:

```
p_exp = 1 / (1 + e^((MMR - M) / D))
```

Where:
- `MMR` = player's current rating
- `M` = lobby median
- `D` = spread factor (default: 450)

| Player MMR vs Median | Expected Percentile |
|---------------------|---------------------|
| Higher than median | < 0.5 (expected to place higher) |
| Equal to median | = 0.5 |
| Lower than median | > 0.5 (expected to place lower) |

### Step 3: Actual Percentile

Calculate where the player actually finished:

```
p_act = (rank - 1) / (N - 1)
```

Where:
- `rank` = player's finish position (1 = winner)
- `N` = total players

| Rank | Actual Percentile |
|------|------------------|
| 1st place | 0.0 |
| Middle | ~0.5 |
| Last place | 1.0 |

### Step 4: Raw Delta

Calculate the base rating change from the difference between expected and actual performance:

```
Δ_base = K₀ × √(N/6) × [p_exp - p_act]
```

Where:
- `K₀` = base K-factor (default: 50)
- `N` = player count
- `√(N/6)` = lobby size scaling factor

**Interpretation:**
- `p_exp > p_act` → Player did better than expected → **positive delta**
- `p_exp < p_act` → Player did worse than expected → **negative delta**

### Step 5: Diminishing Returns

Apply a soft cap using hyperbolic tangent to prevent extreme swings:

```
Δ = Δ_max × tanh(Δ_base / Δ_max)
```

Where `Δ_max` = maximum delta (default: 45)

This ensures:
- Small deltas pass through mostly unchanged
- Large deltas asymptotically approach `±Δ_max`

### Step 6: Mean Regression

Gently pull ratings toward the distribution mean to prevent rating inflation/deflation:

```
Δ_reg = Δ - λ × (MMR - μ)
```

Where:
- `λ` = mean regression factor (default: 0.015)
- `μ` = distribution mean (default: 1500)

| Player MMR vs Mean | Effect |
|-------------------|--------|
| Above mean (1500) | Delta reduced |
| Below mean (1500) | Delta increased |
| At mean | No change |

### Step 7: Final Rating

Apply the adjusted delta:

```
MMR' = MMR + Δ_reg
```

Note: The MMR token contract enforces `min_mmr` (100) in `update_mmr()` and returns `initial_mmr` (1000) for uninitialized players in `balance_of()`.

## Configuration Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `enabled` | bool | false | Master switch for MMR system |
| `mmr_token_address` | ContractAddress | - | Address of MMR token contract |
| `distribution_mean` | u16 | 1500 | Target center of distribution |
| `spread_factor` | u16 | 450 | Controls expected percentile spread |
| `max_delta` | u8 | 45 | Cap on rating change per game |
| `k_factor` | u8 | 50 | Base scaling factor |
| `lobby_split_weight_scaled` | u16 | 2500 | Split lobby weight (0.25 scaled by 10000) |
| `mean_regression_scaled` | u16 | 150 | Mean pull strength (0.015 scaled by 10000) |
| `min_players` | u8 | 6 | Minimum for ranked game |

Note: `initial_mmr` (1000) and `min_mmr` (100) are handled by the MMR token contract, not the game contract.

## API Reference

### Write Functions

```cairo
/// Commit MMR metadata for a completed game with on-chain verification
/// Players must be sorted by MMR ascending
fn commit_game_mmr_meta(ref self: T, players: Array<ContractAddress>);

/// Claim MMR updates for all players (permissionless, batch operation)
fn claim_game_mmr(ref self: T, players: Array<ContractAddress>);
```

### Events

| Event | When Emitted |
|-------|--------------|
| `MMRGameCommitted` | When `commit_game_mmr_meta` succeeds |
| `PlayerMMRChanged` | For each player when `claim_game_mmr` updates their MMR |

## Example Scenarios

### Scenario 1: Average Player Wins

- Current MMR: 1000
- Lobby median: 1000
- Rank: 1st of 6 players

Expected percentile = 0.5 (at median), Actual = 0 (won)
→ Large positive delta → Gains ~25-30 MMR

### Scenario 2: High-Rated Player Expected Win

- Current MMR: 1500
- Lobby median: 1000
- Rank: 1st of 6 players

Expected percentile < 0.5 (expected to win), Actual = 0 (did win)
→ Small positive delta (met expectations) → Gains ~5-10 MMR

### Scenario 3: Low-Rated Upset Loss

- Current MMR: 800
- Lobby median: 1000
- Rank: 6th of 6 players

Expected percentile > 0.5 (expected to lose), Actual = 1 (did lose)
→ Small negative delta (met expectations)
→ But mean regression pulls toward 1500, partially offsetting
→ May only lose ~10-15 MMR (or even break even)

## Implementation Files

| File | Purpose |
|------|---------|
| `contracts/game/src/systems/mmr/contracts.cairo` | Main system contract |
| `contracts/game/src/models/mmr.cairo` | Data model definitions |
| `contracts/game/src/systems/utils/mmr.cairo` | MMR calculation library |
| `contracts/game/src/systems/mmr/tests/test_mmr_systems.cairo` | Integration tests |
| `contracts/mmr/src/contract.cairo` | Soul-bound MMR token contract |
| `contracts/mmr/src/tests.cairo` | Token contract tests |
