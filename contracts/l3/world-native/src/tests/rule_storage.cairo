use starknet::storage_access::Store;
use crate::rules::*;

#[test]
#[fuzzer(runs: 256)]
fn troopstaminaconfig_packing_preserves_every_field(
    stamina_gain_per_tick: u16,
    stamina_initial: u16,
    stamina_bonus_value: u16,
    stamina_knight_max: u16,
    stamina_paladin_max: u16,
    stamina_crossbowman_max: u16,
    stamina_attack_req: u16,
    stamina_defense_req: u16,
    stamina_explore_stamina_cost: u16,
    stamina_travel_stamina_cost: u16,
    stamina_explore_wheat_cost: u32,
    stamina_explore_fish_cost: u32,
    stamina_travel_wheat_cost: u32,
    stamina_travel_fish_cost: u32,
) {
    let value = TroopStaminaConfig {
        stamina_gain_per_tick,
        stamina_initial,
        stamina_bonus_value,
        stamina_knight_max,
        stamina_paladin_max,
        stamina_crossbowman_max,
        stamina_attack_req,
        stamina_defense_req,
        stamina_explore_stamina_cost,
        stamina_travel_stamina_cost,
        stamina_explore_wheat_cost,
        stamina_explore_fish_cost,
        stamina_travel_wheat_cost,
        stamina_travel_fish_cost,
    };
    assert!(TroopStaminaConfigPacking::unpack(TroopStaminaConfigPacking::pack(value)) == value);
    assert!(Store::<TroopStaminaConfig>::size() == 3);
}

#[test]
#[fuzzer(runs: 256)]
fn trooplimitconfig_packing_preserves_every_field(
    guard_resurrection_delay: u16,
    mercenaries_troop_lower_bound: u16,
    mercenaries_troop_upper_bound: u16,
    settlement_deployment_cap: u32,
    city_deployment_cap: u32,
    kingdom_deployment_cap: u32,
    empire_deployment_cap: u32,
    t1_tier_strength: u8,
    t2_tier_strength: u8,
    t3_tier_strength: u8,
    t1_tier_modifier: u8,
    t2_tier_modifier: u8,
    t3_tier_modifier: u8,
) {
    let value = TroopLimitConfig {
        guard_resurrection_delay,
        mercenaries_troop_lower_bound,
        mercenaries_troop_upper_bound,
        settlement_deployment_cap,
        city_deployment_cap,
        kingdom_deployment_cap,
        empire_deployment_cap,
        t1_tier_strength,
        t2_tier_strength,
        t3_tier_strength,
        t1_tier_modifier,
        t2_tier_modifier,
        t3_tier_modifier,
    };
    assert!(TroopLimitConfigPacking::unpack(TroopLimitConfigPacking::pack(value)) == value);
    assert!(Store::<TroopLimitConfig>::size() == 3);
}

#[test]
#[fuzzer(runs: 256)]
fn mapconfig_packing_preserves_every_field(
    reward_resource_amount: u16,
    shards_mines_win_probability: u16,
    shards_mines_fail_probability: u16,
    camp_win_probability: u16,
    camp_fail_probability: u16,
    holysite_win_probability: u16,
    holysite_fail_probability: u16,
    bitcoin_mine_win_probability: u16,
    bitcoin_mine_fail_probability: u16,
    hyps_win_prob: u32,
    hyps_fail_prob: u32,
    hyps_fail_prob_increase_p_hex: u16,
    hyps_fail_prob_increase_p_fnd: u16,
    relic_discovery_interval_sec: u16,
    relic_hex_dist_from_center: u8,
    relic_chest_relics_per_chest: u8,
) {
    let value = MapConfig {
        reward_resource_amount,
        shards_mines_win_probability,
        shards_mines_fail_probability,
        camp_win_probability,
        camp_fail_probability,
        holysite_win_probability,
        holysite_fail_probability,
        bitcoin_mine_win_probability,
        bitcoin_mine_fail_probability,
        hyps_win_prob,
        hyps_fail_prob,
        hyps_fail_prob_increase_p_hex,
        hyps_fail_prob_increase_p_fnd,
        relic_discovery_interval_sec,
        relic_hex_dist_from_center,
        relic_chest_relics_per_chest,
    };
    assert!(MapConfigPacking::unpack(MapConfigPacking::pack(value)) == value);
    assert!(Store::<MapConfig>::size() == 3);
}
