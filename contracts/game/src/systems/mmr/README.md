# Blitz MMR System - Technical Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Data Models](#data-models)
4. [Rating Algorithm](#rating-algorithm)
5. [MMR Systems Contract](#mmr-systems-contract)
6. [MMR Token Contract](#mmr-token-contract)
7. [Integration Guide](#integration-guide)
8. [Configuration](#configuration)
9. [Testing](#testing)

---

## Overview

The **Blitz MMR (Matchmaking Rating) System** is a skill-tracking framework for competitive Blitz games in Eternum. It provides persistent player ratings that reflect relative skill levels across games.

### Key Features

- **Persistent Ratings**: Player MMR persists across games and sessions
- **Soul-Bound Token**: MMR is represented as a non-transferable ERC20 token
- **Gaussian Distribution**: Ratings follow a bell curve centered at 1500
- **Performance-Based Updates**: Rating changes reflect performance vs expectations
- **Configurable Parameters**: All formula constants are tunable via WorldConfig
- **Integration with Trials**: Automatically processes MMR when games complete

### Design Goals

1. **Fair Competition**: Match players of similar skill for balanced games
2. **Skill Progression**: Reward improvement, not just grinding
3. **Smurf Resistance**: Mean regression prevents rating manipulation
4. **Transparency**: All calculations are on-chain and verifiable

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           Blitz MMR System                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────┐    ┌─────────────────────┐    ┌──────────────────┐  │
│  │   MMR Systems       │    │  MMR Calculator     │    │   MMR Token      │  │
│  │   (Dojo Contract)   │───▶│  (Utils Library)    │    │   (ERC20)        │  │
│  │                     │    │                     │    │                  │  │
│  │ • commit_game_mmr   │    │ • 8-step formula    │    │ • Soul-bound     │  │
│  │ • claim_game_mmr    │    │                     │    │                 │  │
│  │ • set_series_ranked │    │ • Median calc       │    │ • GAME_ROLE only │  │
│  │ • get_player_stats  │    │ • Fixed-point math  │    │ • Min floor 100  │  │
│  └─────────────────────┘    └─────────────────────┘    └──────────────────┘  │
│           │                                                    ▲             │
│           │ writes                                             │ updates     │
│           ▼                                                    │             │
│  ┌─────────────────────────────────────────────────────────────┘             │
│  │                                                                           │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐           │
│  │  │ PlayerMMRStats  │  │ GameMMRRecord   │  │ SeriesMMRConfig │           │
│  │  │                 │  │                 │  │                 │           │
│  │  │ • games_played  │  │ • mmr_before    │  │ • is_ranked     │           │
│  │  │ • highest_mmr   │  │ • mmr_after     │  │ • mmr_processed │           │
│  │  │ • lowest_mmr    │  │ • rank          │  │                 │           │
│  │  │ • streak        │  │ • median_mmr    │  │                 │           │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘           │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                           External Integration                                │
│                                                                              │
│  Client/Keeper ───────▶ commit_game_mmr_meta() + claim_game_mmr()          │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Location | Purpose |
|-----------|----------|---------|
| **MMR Systems** | `contracts/game/src/systems/mmr/contracts.cairo` | Dojo contract orchestrating MMR processing |
| **MMR Calculator** | `contracts/game/src/systems/utils/mmr.cairo` | Pure calculation library (8-step formula) |
| **MMR Token** | `contracts/mmr/src/contract.cairo` | Soul-bound ERC20 storing actual ratings |
| **MMR Models** | `contracts/game/src/models/mmr.cairo` | Data structures for stats and records |

---

## Data Models

### MMRConfig

Configuration for the MMR system, stored in WorldConfig.

```cairo
struct MMRConfig {
    enabled: bool,                    // Master switch for MMR tracking
    mmr_token_address: ContractAddress, // Address of MMR token contract
    // Note: initial_mmr and min_mmr are handled by the token contract
    distribution_mean: u16,           // Target mean μ (default: 1500)
    spread_factor: u16,               // D value for logistic function (default: 450)
    max_delta: u8,                    // Maximum rating change per game (default: 45)
    k_factor: u8,                     // Base scaling factor K₀ (default: 50)
    lobby_split_weight_scaled: u16,   // w × 10000 for split-lobby scaling (default: 2500 = 0.25)
    mean_regression_scaled: u16,      // λ × 10000 for regression (default: 150 = 0.015)
    min_players: u8,                  // Minimum players for rated game (default: 6)
}
```

### PlayerMMRStats

Per-player statistics, updated after each rated game.

```cairo
struct PlayerMMRStats {
    #[key] player: ContractAddress,
    games_played: u32,                // Total rated games
    highest_mmr: u128,                // Peak rating achieved
    lowest_mmr: u128,                 // Lowest rating recorded
    last_game_timestamp: u64,         // When last game was played
    last_mmr_change_magnitude: u128,  // Absolute value of last change
    last_mmr_change_negative: bool,   // True if last change was a loss
    current_streak: u16,              // Consecutive wins or losses
    streak_is_wins: bool,             // True if streak is wins
}
```

### GameMMRRecord

Historical record for a specific player in a specific game.

```cairo
struct GameMMRRecord {
    #[key] trial_id: u128,
    #[key] player: ContractAddress,
    mmr_before: u128,                 // Rating before this game
    mmr_after: u128,                  // Rating after this game
    rank: u16,                        // Final placement (1 = winner)
    player_count: u16,                // Total players in game
    median_mmr: u128,                 // Median MMR of lobby
    timestamp: u64,                   // When game ended
}
```

### SeriesMMRConfig

Per-trial configuration for MMR eligibility.

```cairo
struct SeriesMMRConfig {
    #[key] trial_id: u128,
    is_ranked: bool,                  // Whether this series affects MMR
    mmr_processed: bool,              // Whether MMR has been calculated
}
```

### MMRGameMeta

Committed metadata required for permissionless per-player claims.

```cairo
struct MMRGameMeta {
    #[key] trial_id: u128,
    player_count: u16,                // Total players in game
    game_median: u128,                // Median MMR of this game
    global_median: u128,              // Global median for split lobbies
    committed_at: u64,                // When meta was committed
    committed_by: ContractAddress,    // Who committed the meta
    processed_count: u16,             // Claims processed so far
}
```

### MMRClaimed

Tracks whether a player has claimed their MMR update for a trial.

```cairo
struct MMRClaimed {
    #[key] trial_id: u128,
    #[key] player: ContractAddress,
    claimed: bool,
    claimed_at: u64,
}
```

---

## Rating Algorithm

The MMR system uses an **8-step formula** to calculate rating changes:

### Step 1: Median MMR

Calculate the median MMR of all players in the game:

```
M = median{MMR₁, MMR₂, ..., MMRₙ}
```

The median (not mean) is used to reduce the impact of outliers.

### Step 2: Expected Percentile

Calculate where the player is expected to finish based on their MMR:

```
p_exp = 1 / (1 + e^((MMR - M) / D))
```

Where:
- `MMR` = player's current rating
- `M` = median from Step 1
- `D` = spread factor (default 450)

**Interpretation**:
- High MMR → Low `p_exp` (expected to place well)
- Low MMR → High `p_exp` (expected to place poorly)
- At median → `p_exp = 0.5`

### Step 3: Actual Percentile

Calculate where the player actually finished:

```
p_act = (rank - 1) / (N - 1)
```

Where:
- `rank` = final placement (1 = winner)
- `N` = total players

**Range**: 0 (winner) to 1 (last place)

### Step 4: Raw Delta

Calculate the base rating change:

```
Δ_base = K₀ × √(N/6) × [p_exp - p_act]
```

Where:
- `K₀` = base K-factor (default 50)
- `N` = player count
- `√(N/6)` = lobby size scaling (larger lobbies → bigger swings)

**Key insight**: If you outperform expectations (`p_act < p_exp`), you gain rating.

### Step 5: Diminishing Returns

Apply soft cap using hyperbolic tangent:

```
Δ = Δ_max × tanh(Δ_base / Δ_max)
```

Where:
- `Δ_max` = maximum delta (default 45)
- `tanh` smoothly caps extreme values

**Effect**: Small deltas pass through mostly unchanged; large deltas asymptotically approach `Δ_max`.

### Step 6: Split Lobby Adjustment (if applicable)

When a large registration lobby is split into multiple games (tiers), adjust
MMR swings to reflect the relative strength of each tier.

Compute the global median of the *entire* registration lobby and the median of
the specific game the player is assigned to:

```
M_global = median{MMR₁..MMRₙ}   // across all registered players
M_game   = median{MMR in this game}
```

Define a bounded tier bias and a multiplier, then scale the delta from Step 5:

```
bias = clamp((M_game - M_global) / D, -0.5, 0.5)
mult = 1 + w × bias
Δ_tier = Δ × mult
```

Where:
- `D` = spread factor (default 450)
- `w` = lobby_split_weight (default 0.25)

**Effect**:
- Higher-median games get slightly larger swings (mult > 1)
- Lower-median games get slightly smaller swings (mult < 1)
- If there is no split, `M_game == M_global` and `mult = 1`

### Step 7: Mean Regression

Pull ratings toward the distribution mean:

```
Δ_reg = Δ_tier - λ × (MMR - μ)
```

Where:
- `λ` = regression factor (default 0.015)
- `μ` = distribution mean (default 1500)

**Effect**:
- Players above mean lose a bit more / gain a bit less
- Players below mean lose a bit less / gain a bit more
- Prevents rating inflation/deflation over time

### Step 8: Final Rating

Apply the change:

```
MMR' = MMR + Δ_reg
```

Note: The MMR token contract enforces the `min_mmr` floor (100) in `update_mmr()` and returns `initial_mmr` (1000) for uninitialized players in `get_player_mmr()`.

### Example Calculation

**Scenario**: 6-player game, all at 1000 MMR, player finishes 1st

| Step | Calculation | Result |
|------|-------------|--------|
| 1. Median | median{1000, 1000, 1000, 1000, 1000, 1000} | M_game = 1000 |
| 2. Expected | 1 / (1 + e^((1000-1000)/450)) | p_exp = 0.5 |
| 3. Actual | (1-1) / (6-1) | p_act = 0.0 |
| 4. Raw Delta | 50 × √(6/6) × [0.5 - 0.0] | Δ_base = 25 |
| 5. Diminishing | 45 × tanh(25/45) | Δ ≈ 22.4 |
| 6. Split Adjust | M_global = 1000 ⇒ mult = 1 + 0.25 × 0 | Δ_tier ≈ 22.4 |
| 7. Regression | 22.4 - 0.015 × (1000-1500) | Δ_reg ≈ 29.9 |
| 8. Final | max(100, 1000 + 29.9) | MMR' ≈ 1030 |

### Split Lobby Handling (MMR)

When a registration lobby exceeds 24 players, split into multiple games by
descending MMR and distribute players as evenly as possible across games.

**Example (58 players)**:
- Split into 3 games with sizes 20 / 19 / 19
- Top-rated players go to Game A (20), next to Game B (19), lowest to Game C (19)

**MMR calculation per game**:
1. Compute `M_global` across all 58 registered players
2. Compute `M_game` for each split game
3. Apply Steps 1-8 using `M_game`, and apply Step 6 with `M_global`

This keeps MMR changes tied to the specific game a player was placed in, while
slightly favoring higher-tier games via the split adjustment multiplier.

---

## MMR Systems Contract

### Interface

```cairo
#[starknet::interface]
pub trait IMMRSystems<T> {
    /// Mark a series as ranked (MMR-eligible) - Admin only
    fn set_series_ranked(ref self: T, trial_id: u128, is_ranked: bool);

    /// Check if a series is ranked
    fn is_series_ranked(self: @T, trial_id: u128) -> bool;

    /// Commit MMR metadata (medians) for a completed game
    fn commit_game_mmr_meta(ref self: T, trial_id: u128, game_median: u128, global_median: u128);

    /// Permissionless per-player claim
    fn claim_game_mmr(ref self: T, trial_id: u128, player: ContractAddress);

    /// Get a player's current MMR
    fn get_player_mmr(self: @T, player: ContractAddress) -> u128;

    /// Get a player's full statistics
    fn get_player_stats(self: @T, player: ContractAddress) -> PlayerMMRStats;

    /// Get the MMR record for a player in a specific game
    fn get_game_mmr_record(self: @T, trial_id: u128, player: ContractAddress) -> GameMMRRecord;

    /// Get committed MMR metadata for a game
    fn get_game_mmr_meta(self: @T, trial_id: u128) -> MMRGameMeta;

    /// Check if a player has already claimed
    fn has_player_claimed_mmr(self: @T, trial_id: u128, player: ContractAddress) -> bool;

    /// Check if a game meets MMR eligibility requirements
    fn is_game_mmr_eligible(self: @T, trial_id: u128, player_count: u16, entry_fee: u256) -> bool;
}
```

### Events

```cairo
#[dojo::event]
pub struct MMRGameProcessed {
    #[key] trial_id: u128,
    player_count: u16,
    median_mmr: u128,
    timestamp: u64,
}

#[dojo::event]
pub struct PlayerMMRChanged {
    #[key] player: ContractAddress,
    #[key] trial_id: u128,
    old_mmr: u128,
    new_mmr: u128,
    rank: u16,
    timestamp: u64,
}
```

### Eligibility Requirements

A game is eligible for MMR updates when:
1. `mmr_config.enabled == true`
2. Series is marked as ranked (`is_ranked == true`)
3. Game has not been processed yet (`mmr_processed == false`)
4. Player count >= `min_players` (default 6)
5. Entry fee >= `min_entry_fee` (default $1 in LORDS)

---

## MMR Token Contract

The MMR Token is a **soul-bound ERC20** token that represents player ratings.

### Key Properties

| Property | Value |
|----------|-------|
| Name | "Blitz MMR" |
| Symbol | "MMR" |
| Decimals | 18 |
| Initial MMR | 1000 (stored as 1000e18) |
| Minimum MMR | 100 (hard floor) |
| Transferable | No (soul-bound) |

### Interface

```cairo
#[starknet::interface]
pub trait IMMRToken<T> {
    /// Get player's MMR (balance / 1e18 for display)
    fn get_mmr(self: @T, player: ContractAddress) -> u256;

    /// Check if player has been initialized
    fn has_mmr(self: @T, player: ContractAddress) -> bool;

    /// Initialize player with starting MMR (GAME_ROLE only)
    fn initialize_player(ref self: T, player: ContractAddress);

    /// Update player's MMR (GAME_ROLE only)
    fn update_mmr(ref self: T, player: ContractAddress, new_mmr: u256);

    /// Batch update multiple players (GAME_ROLE only)
    fn update_mmr_batch(ref self: T, updates: Array<(ContractAddress, u256)>);
}
```

### Access Control

| Role | Can Do |
|------|--------|
| `DEFAULT_ADMIN_ROLE` | Grant/revoke roles |
| `GAME_ROLE` | Initialize players, update MMR |
| `UPGRADER_ROLE` | Upgrade contract |

### Soul-Bound Implementation

The token blocks all transfers via the ERC20 `before_update` hook:

```cairo
fn before_update(ref self, from: ContractAddress, to: ContractAddress, amount: u256) {
    // Allow mints (from is zero)
    if Zero::is_zero(@from) { return; }
    // Allow burns (to is zero)
    if Zero::is_zero(@to) { return; }
    // Block transfers
    panic!("MMRToken: Soul-bound token cannot be transferred");
}
```

---

## Integration Guide

### Marking a Series as Ranked

Before a game starts, an admin must mark the series as ranked:

```cairo
// In game setup (admin only)
let mmr_systems = mmr_systems::get_dispatcher(@world);
mmr_systems.set_series_ranked(trial_id, true);
```

### Processing MMR After Game Completion (Commit + Claim)

The MMR flow is claim-based to avoid lobby-wide loops.

**Step 1: Commit meta (medians) once**

```cairo
// Client/keeper after rankings are finalized
mmr_systems.commit_game_mmr_meta(trial_id, game_median, global_median);
```

> Note: medians are computed off-chain and committed once. The contract does not
> verify medians on-chain to avoid lobby-wide loops.

**Step 2: Permissionless per-player claim**

```cairo
// Any caller can submit a claim for any player
mmr_systems.claim_game_mmr(trial_id, player);
```

Each claim will:
1. Read the player's rank from `PlayerRank`
2. Calculate the new MMR for that player
3. Update `PlayerMMRStats`
4. Create a `GameMMRRecord`
5. Update the MMR token (if configured)
6. Emit `PlayerMMRChanged`

When all players are claimed, `SeriesMMRConfig.mmr_processed` is set and
`MMRGameProcessed` is emitted.

### Querying Player Data

```cairo
let mmr_systems = mmr_systems::get_dispatcher(@world);

// Get current MMR
let mmr = mmr_systems.get_player_mmr(player_address);

// Get full statistics
let stats = mmr_systems.get_player_stats(player_address);
println!("Games played: {}", stats.games_played);
println!("Highest MMR: {}", stats.highest_mmr);
println!("Current streak: {}", stats.current_streak);

// Get specific game record
let record = mmr_systems.get_game_mmr_record(trial_id, player_address);
println!("Rank: {}, MMR change: {} -> {}", record.rank, record.mmr_before, record.mmr_after);

// Check committed meta + claim status
let meta = mmr_systems.get_game_mmr_meta(trial_id);
let claimed = mmr_systems.has_player_claimed_mmr(trial_id, player_address);
```

---

## Configuration

### Default Values

| Parameter | Default | Description |
|-----------|---------|-------------|
| `enabled` | false | Master switch (disabled by default) |
| `distribution_mean` | 1500 | Target population mean |
| `spread_factor` | 450 | Logistic function width (D) |
| `max_delta` | 45 | Maximum rating change per game |
| `k_factor` | 50 | Base scaling factor (K₀) |
| `lobby_split_weight_scaled` | 2500 | w × 10000 (0.25 = 25%) |
| `mean_regression_scaled` | 150 | λ × 10000 (0.015 = 1.5%) |
| `min_players` | 6 | Minimum for rated game |

Note: `initial_mmr` (1000) and `min_mmr` (100) are handled by the MMR token contract.

### Tuning Guidelines

**Want more rating volatility?**
- Increase `k_factor` (more swing per game)
- Increase `max_delta` (allow larger changes)

**Want more stable ratings?**
- Decrease `k_factor`
- Decrease `max_delta`
- Increase `spread_factor` (flatter expected percentile curve)

**Want faster convergence to true skill?**
- Increase `mean_regression_scaled` (stronger pull to mean)
- Be careful: too high and ratings feel "sticky"

**Want to exclude casual games?**
- Increase `min_players`
- Increase `min_entry_fee`

### Setting Configuration

```cairo
let mmr_config = MMRConfig {
    enabled: true,
    mmr_token_address: token_address,
    distribution_mean: 1500,
    spread_factor: 450,
    max_delta: 45,
    k_factor: 50,
    lobby_split_weight_scaled: 2500, // 0.25
    mean_regression_scaled: 150, // 0.015
    min_players: 6,
};

WorldConfigUtilImpl::set_member(ref world, selector!("mmr_config"), mmr_config);
```

---

## Testing

### Test Organization

| Test File | Coverage |
|-----------|----------|
| `models/mmr.cairo` | Model unit tests (PlayerMMRStats) |
| `systems/utils/mmr.cairo` | Algorithm unit tests (all 8 steps) |
| `systems/mmr/tests/test_mmr_systems.cairo` | Integration tests |

### Running Tests

```bash
# Run all MMR tests
cd contracts/game && sozo test -f mmr

# Run specific test groups
sozo test -f test_mmr_calculator        # Algorithm tests
sozo test -f test_commit_and_claim      # System tests
sozo test -f test_player_stats          # Model tests
```

### Test Coverage Summary

- **89 total tests** across all MMR components
- **Model tests**: Player stats tracking, streak management
- **Algorithm tests**: Each formula step, edge cases, upset scenarios
- **Integration tests**: Full game processing, eligibility checks, idempotency

### CI Integration

MMR tests run automatically on PRs modifying `contracts/game/**`:

```yaml
# .github/workflows/test-contracts.yml
test: [troop_management, mmr]
```

---

## Appendix: Mathematical Properties

### Rating Distribution

With default parameters:
- Mean: μ = 1500
- Players start at 1000, naturally migrate toward 1500
- Hard floor at 100 prevents negative-like ratings

### Expected Percentile Curve

The logistic function `1 / (1 + e^x)` creates a smooth S-curve:

```
p_exp
  1 │          ________
    │         /
0.5 │--------*--------  ← At median
    │       /
  0 │______/
    └────────────────── MMR
       Low    Med   High
```

### Diminishing Returns

The `tanh` function creates soft caps:

```
Δ
 45│           _______ ← asymptotic cap
   │          /
   │        /
  0│───────*─────────── Raw Δ
   │      /
-45│_____/              ← negative cap
```

### Mean Regression Effect

Over many games, ratings cluster around μ = 1500:

```
Count
  │      ╱╲
  │     ╱  ╲
  │    ╱    ╲
  │   ╱      ╲
  │__╱________╲__
  └──────────────── MMR
     μ=1500
```
