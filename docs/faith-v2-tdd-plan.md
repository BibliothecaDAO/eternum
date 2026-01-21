# Wonder v2 Faith System — TDD Plan

## Overview
This plan implements Wonder v2 (Faith Points) in Cairo using a strict TDD cadence. Each phase adds tests first, then implementation to satisfy them.

## Core Formulas
**FP generation (per Eternum Day):**
```
Daily FP = 50 (base) + (realms × 10) + (villages × 1) + (wonders × 50)
```

**FP distribution (per tick):**
```
Owner Share = Generated FP × 30%
Follower Pool = Generated FP × 70%
Per-Holder = Pool × (holder_contribution / total_contribution)
```
Notes:
- Owner participates in the 70% pool based on their own contribution (e.g., Wonder base FP).
- Subservient Wonders forfeit baseline FP + followers while faithful and cannot attract faith.
- Holy Sites count as Wonder Realms for FP (50) but are non‑playable structures.

**Prize distribution (season end):**
```
Level 1: Pool → Top 10 Wonders by rank curve
Level 2: Wonder Prize → Owner (30%) + FP Holders (70% proportional)
```
Ties: combine tied rank shares and split evenly (Blitz behavior).

## Phase Breakdown (46 tests)

### Phase 1 — Config & Models (3)
- `test_faith_config_storage`
- `test_faith_config_invalid_shares`
- `test_wonder_faith_default_values`

### Phase 2 — Pledge System (6)
- `test_pledge_faith_realm_to_wonder`
- `test_pledge_faith_village_to_wonder`
- `test_pledge_faith_wonder_to_wonder`
- `test_pledge_faith_to_own_wonder_fails`
- `test_pledge_faith_when_already_pledged_fails`
- `test_pledge_faith_not_owner_fails`

### Phase 3 — Revocation (3)
- `test_revoke_faith`
- `test_revoke_faith_preserves_accrued_fp`
- `test_revoke_faith_when_not_pledged_fails`

### Phase 4 — FP Generation (6)
- `test_faith_generation_baseline`
- `test_faith_generation_with_realm_followers`
- `test_faith_generation_mixed_followers`
- `test_faith_generation_multi_day_catchup`
- `test_faith_generation_idempotent`
- `test_faith_distribution_split` (30/70 + owner holder share)

### Phase 5 — Season Snapshot & Claim Window (4)
- `test_season_snapshot_created_on_distribution`
- `test_claim_prize_within_window`
- `test_claim_prize_after_window_fails`
- `test_withdraw_unclaimed_after_window`

### Phase 6 — Capture Integration (4)
- `test_wonder_capture_creates_history`
- `test_wonder_capture_resets_current_fp`
- `test_wonder_capture_preserves_followers`
- `test_original_owner_claims_historical_prize`

### Phase 7 — Leaderboard (3)
- `test_leaderboard_updates_on_fp_generation`
- `test_leaderboard_rank_change_event`
- `test_leaderboard_tiebreaker` (deterministic ordering; prize ties handled in Phase 8)

### Phase 8 — Prizes (8)
- `test_fund_prize_pool`
- `test_season_prize_distribution_top_10_curve`
- `test_season_prize_distribution_two_level_split` (owner can also receive holder share)
- `test_season_prize_distribution_fewer_than_10` (unused to DAO)
- `test_season_prize_distribution_tie_combines_shares`
- `test_season_prize_distribution_before_end_fails`
- `test_double_claim_prize_fails`
- `test_fp_holder_claims_proportional_share` (owner as holder)

### Phase 9 — Edge & Security (9)
- `test_zero_followers_generates_baseline_only`
- `test_follower_leaves_before_fp_tick`
- `test_circular_wonder_allegiance_direct_fails`
- `test_circular_wonder_allegiance_transitive_fails`
- `test_non_circular_wonder_chain_allowed`
- `test_fp_accumulation_no_overflow`
- `test_deleted_entity_pledge_fails`
- `test_max_depth_circular_check`
- `test_village_owned_by_wonder_owner_cannot_pledge`

## Sprint Order
1) **Sprint 1:** models + config + basic pledge tests
2) **Sprint 2:** pledge validation + revoke + generation
3) **Sprint 3:** snapshot + claim window + capture integration
4) **Sprint 4:** leaderboard + prize distribution
5) **Sprint 5:** edge cases + hardening

## Test Command
```
cd contracts/game
sozo test -f faith
```
