# Bitcoin Mine Implementation Plan

**Status:** Implemented

**Goal:** Implement Bitcoin Mines - discoverable structures in the Ethereal layer that allow players to contribute labor
to participate in a phase-based lottery for SATOSHI rewards.

---

## Architecture Overview

### Key Components

1. **Structure**: `StructureCategory::BitcoinMine` with `TileOccupier::BitcoinMine`
2. **Resource**: `SATOSHI` (resource type 58) - in-game resource awarded as prize
3. **Phase System**: Time-based phases using `TickConfig.bitcoin_phase_in_seconds`
4. **Lottery**: Weighted random selection using VRF, with labor contribution as weight
5. **Discovery**: Ethereal-layer only (1/50 chance during exploration)
6. **Defenders**: T3 Paladin guards matching Ethereal Agents pattern

### Tech Stack

Cairo 2.13.1, Dojo 1.8.0, snforge for testing

---

## Models

### BitcoinPhaseLabor

Tracks global state for each phase.

```cairo
#[dojo::model]
pub struct BitcoinPhaseLabor {
    #[key]
    pub phase_id: u64,
    pub prize_pool: u128,           // SATOSHI allocated (base + rollover)
    pub total_labor: u128,          // cumulative labor deposited
    pub participant_count: u32,     // distinct mines that contributed
    pub claim_count: u32,           // mines that have attempted claim
    pub reward_receiver_phase: u64  // where reward went (self/forwarded/0=pending)
}
```

**reward_receiver_phase values:**

- `phase_id` (self): Winner found in this phase
- `other_phase_id`: Prize forwarded to another phase
- `0`: Pending or burned (no qualifying phase found)

### BitcoinMinePhaseLabor

Tracks each mine's contribution per phase.

```cairo
#[dojo::model]
pub struct BitcoinMinePhaseLabor {
    #[key]
    pub phase_id: u64,
    #[key]
    pub mine_id: ID,
    pub labor_contributed: u128,
    pub claimed: bool  // has this mine attempted claim yet
}
```

### BitcoinPhaseImpl

Utility functions for phase timing calculations.

```cairo
#[generate_trait]
pub impl BitcoinPhaseImpl of BitcoinPhaseTrait {
    /// Phase end time = 1 second before next phase starts
    fn end_time(phase_id: u64, tick: TickInterval) -> u64 {
        tick.convert_to_estimated_timestamp(phase_id + 1) - 1
    }

    /// Contribution window is open if now < end_time
    fn is_contribution_open(phase_id: u64, tick: TickInterval) -> bool;

    /// Contribution window is closed if now >= end_time
    fn has_contribution_closed(phase_id: u64, tick: TickInterval) -> bool;
}
```

---

## Configuration

### BitcoinMineConfig

```cairo
pub struct BitcoinMineConfig {
    pub enabled: bool,
    pub prize_per_phase: u128,           // SATOSHI awarded per phase
    pub min_labor_per_contribution: u128 // Minimum labor per contribution (must be > 0)
}
```

### TickConfig

```cairo
pub struct TickConfig {
    pub armies_tick_in_seconds: u64,
    pub delivery_tick_in_seconds: u64,
    pub bitcoin_phase_in_seconds: u64  // 600 = 10 minutes
}
```

Phase timing is derived from `bitcoin_phase_in_seconds`:

- `current_phase = now / bitcoin_phase_in_seconds`
- Phase end time calculated via `BitcoinPhaseImpl::end_time()`

### MapConfig

Discovery probability fields:

```cairo
pub bitcoin_mine_win_probability: u16,   // 200 (2% = 1/50)
pub bitcoin_mine_fail_probability: u16,  // 9800
```

---

## Constants

```cairo
pub const SATOSHI: u8 = 58;           // Resource type
pub const MAX_FUTURE_PHASES: u64 = 30; // Can contribute up to 30 phases ahead
pub const MAX_ROLLOVER_PHASES: u64 = 6; // Prize rolls over for max 6 phases
```

---

## System Interface

```cairo
#[starknet::interface]
pub trait IBitcoinMineSystems<T> {
    /// Contribute labor to a phase
    fn contribute_labor(ref self: T, mine_id: ID, target_phase_id: u64, labor_amount: u128);

    /// Process claims for multiple mines in a phase (permissionless)
    fn claim_phase_reward(ref self: T, phase_id: u64, mine_ids: Array<ID>);

    /// View: Get current phase ID (time-based)
    fn get_current_phase(self: @T) -> u64;

    /// View: Get mine's contribution percentage for a phase (basis points)
    fn get_mine_contribution(self: @T, mine_id: ID, phase_id: u64) -> u128;
}
```

---

## Core Mechanics

### 1. Contributing Labor (`contribute_labor`)

**Validations:**

- Season started and not over
- Bitcoin mine system enabled
- Caller owns the mine
- Structure is a BitcoinMine
- `target_phase_id > 0`
- `target_phase_id >= current_phase` (can't contribute to past)
- `target_phase_id <= current_phase + MAX_FUTURE_PHASES` (max 30 phases ahead)
- Contribution window still open for target phase
- `labor_amount > 0`
- `labor_amount >= config.min_labor_per_contribution`
- Mine has sufficient labor balance

**Actions:**

1. Initialize phase prize pool if first contributor
2. Burn labor from mine
3. Add labor to phase total
4. Track mine's contribution
5. Increment participant count if first contribution from this mine
6. Emit `BitcoinMineProductionStory` event

### 2. Claiming Rewards (`claim_phase_reward`)

**Validations:**

- Season started and not over
- Bitcoin mine system enabled
- Phase has participants
- Contribution window has closed
- Phase ends before season end_at (if end_at > 0)

**Early Exit:**

- If `reward_receiver_phase.is_non_zero()` or `total_labor.is_zero()`: return immediately

**Lottery Processing:**

For each mine in the provided array:

1. Skip if no labor contributed or already claimed
2. Mark mine as claimed, increment claim_count
3. Run weighted lottery: `success_weight = labor_contributed`, `fail_weight = total_labor - labor_contributed`
4. If winner:
   - Set `reward_receiver_phase = phase_id`
   - Mint SATOSHI at winning mine
   - Emit `BitcoinPhaseLotteryStory` event
   - Return immediately

**Rollover (if all claimed with no winner):**

- Check 6 phases starting from `current_phase`
- Find first phase where `reward_receiver_phase.is_zero()`
- Add prize to that phase's prize_pool
- Set `reward_receiver_phase = next_phase_id`
- If no qualifying phase found: prize burned (`reward_receiver_phase` stays 0)

### 3. Phase Timing

Phase calculation is purely time-based:

```
current_phase = now / bitcoin_phase_in_seconds
phase_end_time = (phase_id + 1) * bitcoin_phase_in_seconds - 1
```

No stored phase timestamps - all calculated on the fly using `BitcoinPhaseImpl`.

---

## Events

### BitcoinMineProductionStory

```cairo
pub struct BitcoinMineProductionStory {
    pub mine_id: ID,
    pub owner: ContractAddress,
    pub phase_id: u64,
    pub labor_deposited: u128,
}
```

### BitcoinPhaseLotteryStory

```cairo
pub struct BitcoinPhaseLotteryStory {
    pub phase_id: u64,
    pub total_labor: u128,
    pub winner_mine_id: ID,
    pub winner_owner: ContractAddress,
    pub winner_labor: u128,
    pub prize_awarded: u128,
}
```

---

## Discovery System

Bitcoin mines are discovered during exploration in the Ethereal layer:

1. Only in Ethereal layer (`coord.alt == true`)
2. 1/50 chance (2% probability)
3. Created with T3 Paladin defenders (same tier as Ethereal Agents)
4. Initial state: no owner (bandits), must be conquered

**Files:**

- `contracts/game/src/systems/utils/bitcoin_mine.cairo` - discovery utility
- Integration in exploration system's `find_treasure` function

---

## Key Design Decisions

1. **Time-based phases**: No stored phase timestamps. Phase timing calculated from `bitcoin_phase_in_seconds`.

2. **Labor = Weight**: Players contribute labor directly. Labor contribution determines lottery odds (not converted to
   "work").

3. **In-game SATOSHI**: Prize is in-game SATOSHI resource (minted at winning mine), not ERC20 transfer.

4. **Weighted lottery**: Uses
   `get_weighted_choice_bool_simple(labor_contributed, total_labor - labor_contributed, seed)` for fair probability.

5. **reward_receiver_phase tracking**: Single field tracks:
   - Winner found (self)
   - Prize forwarded (other phase)
   - Pending/burned (0)

6. **Rollover from current_phase**: When prize rolls over, it goes to phases starting from current_phase (not the
   claimed phase), ensuring prizes go to active/upcoming phases.

7. **Permissionless claiming**: Anyone can call `claim_phase_reward` with a batch of mine IDs.

8. **Prize accumulation**: Unclaimed prizes roll forward, creating jackpot potential. After 6 phases, unclaimed prizes
   are burned.

---

## File Summary

| File                                                      | Purpose                             |
| --------------------------------------------------------- | ----------------------------------- |
| `contracts/game/src/constants.cairo`                      | SATOSHI type, MAX_FUTURE/ROLLOVER   |
| `contracts/game/src/models/bitcoin_mine.cairo`            | BitcoinPhaseLabor, BitcoinPhaseImpl |
| `contracts/game/src/models/config.cairo`                  | BitcoinMineConfig, TickConfig       |
| `contracts/game/src/models/events.cairo`                  | Production and Lottery story events |
| `contracts/game/src/systems/bitcoin_mine/contracts.cairo` | Main system contract                |
| `contracts/game/src/systems/bitcoin_mine/tests.cairo`     | Unit tests                          |
| `contracts/game/src/systems/utils/bitcoin_mine.cairo`     | Discovery utility                   |
| `contracts/game/src/systems/config/contracts.cairo`       | Config setter (with validation)     |
