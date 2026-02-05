# Bitcoin Mine System Tests Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Write comprehensive tests for the Bitcoin Mine system following the patterns established in the faith system
tests.

**Reference:** `contracts/game/src/systems/faith/tests.cairo` for testing patterns

---

## Test File Structure

**Location:** `contracts/game/src/systems/bitcoin_mine/tests.cairo`

**Organization:**

```cairo
#[cfg(test)]
mod tests {
    // === Imports ===
    // === Constants ===
    // === Config Helpers ===
    // === Namespace & Contract Definitions ===
    // === World Setup ===
    // === Test Fixtures ===
    // === Unit Tests: contribute_labor ===
    // === Unit Tests: claim_phase_reward ===
    // === Unit Tests: View Functions ===
    // === Integration Tests: Full Flow ===
    // === Edge Cases ===
    // === Error/Validation Tests ===
}
```

---

## Task 1: Test Setup Infrastructure

**Step 1: Add required imports**

```cairo
use core::num::traits::Zero;
use dojo::model::ModelStorage;
use dojo::world::{WorldStorage, WorldStorageTrait};
use dojo_cairo_test::{
    ContractDef, ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait,
    spawn_test_world,
};
use starknet::ContractAddress;
use starknet::testing::{set_block_timestamp, set_caller_address};
use snforge_std::{start_cheat_block_timestamp_global, start_cheat_caller_address, stop_cheat_caller_address};

use crate::alias::ID;
use crate::constants::{DEFAULT_NS, DEFAULT_NS_STR, MAX_FUTURE_PHASES, MAX_ROLLOVER_PHASES, ResourceTypes, RESOURCE_PRECISION};
use crate::models::bitcoin_mine::{BitcoinMinePhaseLabor, BitcoinPhaseLabor};
use crate::models::config::{BitcoinMineConfig, SeasonConfig, TickConfig, WorldConfigUtilImpl};
use crate::models::structure::{Structure, StructureBase, StructureCategory};
use crate::models::resource::resource::SingleResource;
use crate::models::weight::Weight;
use crate::systems::bitcoin_mine::contracts::{
    IBitcoinMineSystemsDispatcher, IBitcoinMineSystemsDispatcherTrait, bitcoin_mine_systems,
};
```

**Step 2: Add test constants**

```cairo
const PHASE_DURATION: u64 = 600; // 10 minutes
const PRIZE_PER_PHASE: u128 = 1_000_000_000_000_000_000; // 1 SATOSHI with precision
const MIN_LABOR: u128 = 100_000_000_000_000_000_000; // 100 labor with precision
const PLAYER_1: felt252 = 'player_1';
const PLAYER_2: felt252 = 'player_2';
const PLAYER_3: felt252 = 'player_3';
```

**Step 3: Add config helper functions**

```cairo
fn get_default_bitcoin_mine_config() -> BitcoinMineConfig {
    BitcoinMineConfig {
        enabled: true,
        prize_per_phase: PRIZE_PER_PHASE,
        min_labor_per_contribution: MIN_LABOR,
    }
}

fn get_default_tick_config() -> TickConfig {
    TickConfig {
        armies_tick_in_seconds: 60,
        delivery_tick_in_seconds: 60,
        bitcoin_phase_in_seconds: PHASE_DURATION,
    }
}

fn get_active_season_config() -> SeasonConfig {
    SeasonConfig {
        dev_mode_on: false,
        start_settling_at: 0,
        start_main_at: 100,
        end_at: 1_000_000, // Far future
        end_grace_seconds: 3600,
        registration_grace_seconds: 3600,
    }
}
```

**Step 4: Add namespace and contract definitions**

```cairo
fn namespace_def() -> NamespaceDef {
    NamespaceDef {
        namespace: DEFAULT_NS_STR(),
        resources: [
            TestResource::Model(m_WorldConfig::TEST_CLASS_HASH),
            TestResource::Model(m_BitcoinPhaseLabor::TEST_CLASS_HASH),
            TestResource::Model(m_BitcoinMinePhaseLabor::TEST_CLASS_HASH),
            TestResource::Model(m_Structure::TEST_CLASS_HASH),
            TestResource::Model(m_SingleResource::TEST_CLASS_HASH),
            TestResource::Model(m_Weight::TEST_CLASS_HASH),
            TestResource::Event(bitcoin_mine_systems::e_StoryEvent::TEST_CLASS_HASH),
            TestResource::Contract(bitcoin_mine_systems::TEST_CLASS_HASH),
        ].span(),
    }
}

fn contract_defs() -> Span<ContractDef> {
    [
        ContractDefTrait::new(@"eternum", @"bitcoin_mine_systems")
            .with_writer_of([dojo::utils::bytearray_hash(@"eternum")].span()),
    ].span()
}
```

**Step 5: Add world setup function**

```cairo
fn setup_world() -> WorldStorage {
    let mut world = spawn_test_world([namespace_def()].span());
    world.sync_perms_and_inits(contract_defs());

    // Setup configs
    let bitcoin_config = get_default_bitcoin_mine_config();
    let tick_config = get_default_tick_config();
    let season_config = get_active_season_config();

    WorldConfigUtilImpl::set_member(ref world, selector!("bitcoin_mine_config"), bitcoin_config);
    WorldConfigUtilImpl::set_member(ref world, selector!("tick_config"), tick_config);
    WorldConfigUtilImpl::set_member(ref world, selector!("season_config"), season_config);

    world
}

fn get_dispatcher(ref world: WorldStorage) -> (ContractAddress, IBitcoinMineSystemsDispatcher) {
    let (contract_address, _) = world.dns(@"bitcoin_mine_systems").unwrap();
    (contract_address, IBitcoinMineSystemsDispatcher { contract_address })
}
```

**Step 6: Add test fixture functions**

```cairo
fn spawn_bitcoin_mine(ref world: WorldStorage, owner: ContractAddress) -> ID {
    let mine_id = world.dispatcher.uuid();

    // Create structure base
    let structure = Structure {
        entity_id: mine_id,
        base: StructureBase {
            category: StructureCategory::BitcoinMine.into(),
            // ... other fields
        },
    };
    world.write_model_test(@structure);

    // Set owner
    let owner_model = StructureOwner { entity_id: mine_id, owner };
    world.write_model_test(@owner_model);

    // Add labor to the mine
    add_labor_to_mine(ref world, mine_id, 10_000 * RESOURCE_PRECISION);

    mine_id
}

fn add_labor_to_mine(ref world: WorldStorage, mine_id: ID, amount: u128) {
    let mut resource: SingleResource = world.read_model((mine_id, ResourceTypes::LABOR));
    resource.balance += amount;
    world.write_model_test(@resource);
}

fn get_player_address(player: felt252) -> ContractAddress {
    starknet::contract_address_const::<player>()
}
```

---

## Task 2: Unit Tests - contribute_labor

### Happy Path Tests

```cairo
#[test]
fn test_contribute_labor_success() {
    // Setup: Mine with labor, current phase
    // Action: Contribute labor to current phase
    // Verify: Phase labor updated, mine contribution recorded, participant count = 1
}

#[test]
fn test_contribute_labor_to_future_phase() {
    // Setup: Mine with labor
    // Action: Contribute to phase current_phase + 5
    // Verify: Future phase has labor, contribution window still open
}

#[test]
fn test_contribute_labor_multiple_contributions_same_mine() {
    // Setup: Mine with labor
    // Action: Contribute twice to same phase
    // Verify: labor_contributed accumulated, participant_count still 1
}

#[test]
fn test_contribute_labor_multiple_mines_same_phase() {
    // Setup: Two mines with different owners
    // Action: Both contribute to same phase
    // Verify: total_labor = sum, participant_count = 2
}

#[test]
fn test_contribute_labor_initializes_prize_pool() {
    // Setup: Empty phase
    // Action: First contribution to phase
    // Verify: prize_pool = config.prize_per_phase
}
```

### Validation/Error Tests

```cairo
#[test]
#[should_panic(expected: "Bitcoin mine system is not enabled")]
fn test_contribute_labor_system_disabled() {
    // Setup: Disabled config
    // Action: Try to contribute
}

#[test]
#[should_panic(expected: "Only mine owner can contribute")]
fn test_contribute_labor_not_owner() {
    // Setup: Mine owned by player_1
    // Action: player_2 tries to contribute
}

#[test]
#[should_panic(expected: "Structure is not a bitcoin mine")]
fn test_contribute_labor_wrong_structure_type() {
    // Setup: Realm structure
    // Action: Try to contribute labor
}

#[test]
#[should_panic(expected: "Phase ID must be greater than 0")]
fn test_contribute_labor_phase_zero() {
    // Action: Contribute to phase 0
}

#[test]
#[should_panic(expected: "Cannot contribute to past phase")]
fn test_contribute_labor_past_phase() {
    // Setup: Current phase = 10
    // Action: Contribute to phase 5
}

#[test]
#[should_panic(expected: "Cannot contribute to phase more than 30 phases in the future")]
fn test_contribute_labor_too_far_future() {
    // Setup: Current phase = 1
    // Action: Contribute to phase 32 (1 + 31 > MAX_FUTURE_PHASES)
}

#[test]
#[should_panic(expected: "Contribution window has closed")]
fn test_contribute_labor_window_closed() {
    // Setup: Advance time past phase end
    // Action: Try to contribute to that phase
}

#[test]
#[should_panic(expected: "Labor amount must be > 0")]
fn test_contribute_labor_zero_amount() {
    // Action: Contribute 0 labor
}

#[test]
#[should_panic(expected: "Labor below minimum contribution")]
fn test_contribute_labor_below_minimum() {
    // Action: Contribute less than min_labor_per_contribution
}

#[test]
#[should_panic(expected: "Not enough labor")]
fn test_contribute_labor_insufficient_balance() {
    // Setup: Mine with 50 labor
    // Action: Try to contribute 100 labor
}
```

---

## Task 3: Unit Tests - claim_phase_reward

### Happy Path Tests

```cairo
#[test]
fn test_claim_phase_reward_single_mine_wins() {
    // Setup: Phase with one contributor
    // Action: Claim after window closes
    // Verify: Winner gets SATOSHI, reward_receiver_phase = phase_id
}

#[test]
fn test_claim_phase_reward_higher_labor_more_likely() {
    // Setup: Mine A with 90% labor, Mine B with 10%
    // Action: Claim multiple times with different seeds
    // Verify: Statistical distribution matches weights (approximate)
}

#[test]
fn test_claim_phase_reward_permissionless() {
    // Setup: Mine owned by player_1
    // Action: player_2 calls claim
    // Verify: Works - anyone can call
}

#[test]
fn test_claim_phase_reward_batch_processing() {
    // Setup: 3 mines contributed
    // Action: Claim with array of all 3 mine IDs
    // Verify: All marked as claimed, one winner
}

#[test]
fn test_claim_phase_reward_partial_batch() {
    // Setup: 3 mines contributed
    // Action: Claim with array of 2 mine IDs
    // Verify: 2 marked as claimed, 1 still unclaimed
}

#[test]
fn test_claim_phase_reward_skips_already_claimed() {
    // Setup: Mine already claimed
    // Action: Include in claim array again
    // Verify: Skipped, no error
}

#[test]
fn test_claim_phase_reward_skips_non_contributors() {
    // Setup: Mine with 0 labor in phase
    // Action: Include in claim array
    // Verify: Skipped, no error
}
```

### Rollover Tests

```cairo
#[test]
fn test_claim_phase_reward_rollover_to_current_phase() {
    // Setup: Phase 1 with contributors, no winner after all claim
    // Time: Now in phase 5
    // Action: Last claimant loses
    // Verify: Prize rolls to phase 5 (current), not phase 2
}

#[test]
fn test_claim_phase_reward_rollover_skips_claimed_phases() {
    // Setup: Phase 5 already has reward_receiver_phase set
    // Action: Rollover from old phase
    // Verify: Skips phase 5, goes to phase 6
}

#[test]
fn test_claim_phase_reward_rollover_accumulates_prize() {
    // Setup: Phase with prize_pool = 100, target phase already has 50
    // Action: Rollover
    // Verify: Target phase prize_pool = 150
}

#[test]
fn test_claim_phase_reward_rollover_burned_after_max() {
    // Setup: All 6 future phases have reward_receiver_phase set
    // Action: Rollover attempt
    // Verify: Original phase reward_receiver_phase stays 0 (burned)
}

#[test]
fn test_claim_phase_reward_no_rollover_if_winner() {
    // Setup: One mine wins
    // Verify: No rollover triggered, reward_receiver_phase = own phase_id
}
```

### Validation/Error Tests

```cairo
#[test]
#[should_panic(expected: "Bitcoin mine system is not enabled")]
fn test_claim_phase_reward_system_disabled() {
    // Setup: Disabled config
    // Action: Try to claim
}

#[test]
#[should_panic(expected: "Phase has no participants")]
fn test_claim_phase_reward_no_participants() {
    // Setup: Empty phase
    // Action: Try to claim
}

#[test]
#[should_panic(expected: "Contribution window has not closed yet")]
fn test_claim_phase_reward_window_still_open() {
    // Setup: Current phase with active window
    // Action: Try to claim
}

#[test]
#[should_panic(expected: "phase ends after season")]
fn test_claim_phase_reward_after_season_end() {
    // Setup: Phase that ends after season.end_at
    // Action: Try to claim
}

#[test]
fn test_claim_phase_reward_early_exit_already_processed() {
    // Setup: Phase with reward_receiver_phase already set
    // Action: Call claim again
    // Verify: Returns immediately, no changes
}
```

---

## Task 4: Unit Tests - View Functions

```cairo
#[test]
fn test_get_current_phase() {
    // Setup: Time = 1500, phase_duration = 600
    // Verify: current_phase = 2 (1500 / 600)
}

#[test]
fn test_get_current_phase_at_boundary() {
    // Setup: Time = 1200 (exactly 2 phases)
    // Verify: current_phase = 2
}

#[test]
fn test_get_mine_contribution_percentage() {
    // Setup: Mine contributed 3000, total = 10000
    // Verify: get_mine_contribution returns 3000 (30% in basis points)
}

#[test]
fn test_get_mine_contribution_no_labor() {
    // Setup: Empty phase
    // Verify: Returns 0
}

#[test]
fn test_get_mine_contribution_non_contributor() {
    // Setup: Phase with labor, but not from this mine
    // Verify: Returns 0
}
```

---

## Task 5: Integration Tests - Full Flow

```cairo
#[test]
fn test_full_flow_single_phase_single_winner() {
    // 1. Setup world, spawn mine
    // 2. Contribute labor to current phase
    // 3. Advance time past phase end
    // 4. Claim phase reward
    // 5. Verify SATOSHI minted at mine
    // 6. Verify phase marked as won
}

#[test]
fn test_full_flow_multiple_phases_accumulating_jackpot() {
    // 1. Phase 1: Contribute, claim, no winner -> rollover
    // 2. Phase 2: Contribute, claim, no winner -> rollover (prize doubled)
    // 3. Phase 3: Contribute, claim, winner gets accumulated prize
    // Verify: Final prize = 3x prize_per_phase
}

#[test]
fn test_full_flow_multiple_mines_competitive() {
    // 1. Setup 3 mines with different owners
    // 2. All contribute different amounts (10%, 30%, 60%)
    // 3. Advance time, claim for all
    // 4. Verify winner gets prize, others marked claimed
    // 5. Verify weighted lottery (60% contributor more likely)
}

#[test]
fn test_full_flow_contribute_to_multiple_phases() {
    // 1. Mine contributes to phases 5, 6, 7 simultaneously
    // 2. Advance time, claim each phase
    // 3. Verify independent outcomes per phase
}

#[test]
fn test_full_flow_claim_old_phase_rollover_to_current() {
    // 1. Phase 1: Contribute, but don't claim
    // 2. Advance time to phase 10
    // 3. Claim phase 1, no winner
    // 4. Verify rollover goes to phase 10 (current), not phase 2
}
```

---

## Task 6: Edge Cases

```cairo
#[test]
fn test_edge_case_max_future_phases() {
    // Contribute to exactly current_phase + MAX_FUTURE_PHASES
    // Verify: Succeeds
}

#[test]
fn test_edge_case_contribute_at_phase_boundary() {
    // Time = 599 (1 second before phase 1 starts)
    // Contribute to phase 0
    // Verify: Still allowed (window not closed)
}

#[test]
fn test_edge_case_claim_at_exact_phase_end() {
    // Time = exactly phase_end_time
    // Verify: Contribution closed, claim allowed
}

#[test]
fn test_edge_case_single_contributor_always_wins() {
    // Setup: Only one mine in phase
    // Verify: Always wins (100% probability)
}

#[test]
fn test_edge_case_all_labor_from_one_mine() {
    // Setup: Mine A contributes 100%, Mine B contributes 0
    // Verify: Mine A always wins, Mine B can't win
}

#[test]
fn test_edge_case_very_small_contribution() {
    // Mine A: 99.99% labor, Mine B: 0.01% labor
    // Verify: Mine B still has non-zero chance
}

#[test]
fn test_edge_case_prize_pool_with_existing_rollover() {
    // Setup: Phase already has rollover prize
    // Action: First contributor adds to phase
    // Verify: prize_pool = rollover + config.prize_per_phase
}

#[test]
fn test_edge_case_multiple_rollovers_accumulate() {
    // Phase 1 rolls to Phase 5
    // Phase 2 also rolls to Phase 5
    // Verify: Phase 5 has sum of both prizes
}
```

---

## Task 7: Run Tests and Verify

**Step 1: Run all bitcoin mine tests**

```bash
cd contracts/game && sozo test -f bitcoin
```

**Step 2: Verify coverage**

- All happy paths covered
- All error conditions tested
- Edge cases documented and tested
- Integration flows verified

**Step 3: Commit**

```bash
git add contracts/game/src/systems/bitcoin_mine/tests.cairo
git commit -m "$(cat <<'EOF'
test(bitcoin-mine): add comprehensive system tests

Tests cover:
- contribute_labor: happy paths, validations, edge cases
- claim_phase_reward: lottery, rollover, batch processing
- View functions: current_phase, contribution percentage
- Integration: full flows, multi-phase scenarios
- Edge cases: boundaries, probabilities, accumulation

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Summary

| Category                    | Test Count | Description                              |
| --------------------------- | ---------- | ---------------------------------------- |
| contribute_labor happy path | 5          | Basic contribution scenarios             |
| contribute_labor validation | 11         | Error conditions and panics              |
| claim_phase_reward happy    | 7          | Lottery, batching, skipping              |
| claim_phase_reward rollover | 5          | Prize forwarding mechanics               |
| claim_phase_reward errors   | 5          | Validation and early exits               |
| View functions              | 5          | get_current_phase, get_mine_contribution |
| Integration tests           | 5          | Full multi-step flows                    |
| Edge cases                  | 8          | Boundary conditions, probabilities       |
| **Total**                   | **51**     |                                          |

Key testing patterns from faith system applied:

1. **Isolated setup** - Fresh world per test
2. **Time manipulation** - `start_cheat_block_timestamp_global`
3. **Caller impersonation** - `start_cheat_caller_address`
4. **Direct state writes** - `world.write_model_test()` for fixtures
5. **Comprehensive assertions** - Check multiple models after each action
6. **Clear panic expectations** - `#[should_panic(expected: "...")]`
