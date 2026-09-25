use crate::exploration_rewards::reveal_reward;
use crate::resources::{ESSENCE, LABOR};
use crate::rules::RESOURCE_PRECISION;
use crate::troops::{TroopTier, Troops};

#[test]
fn frontier_reveal_keeps_scaled_precision_and_ignores_boosts() {
    let limits = crate::rules::TroopLimitConfig {
        t1_tier_strength: 1, t2_tier_strength: 3, t3_tier_strength: 9, ..super::recorded::rules().troop_limit_config,
    };
    let mut troops = Troops {
        count: 1500 * RESOURCE_PRECISION + RESOURCE_PRECISION / 2, tier: TroopTier::T1, ..Default::default(),
    };
    assert_eq!(reveal_reward(troops, limits, 15, 123, 100).amount, 225075000000);
    troops.boosts.incr_explore_reward_percent_num = 5000;
    troops.boosts.incr_explore_reward_end_tick = 100000;
    troops.boosts.incr_damage_dealt_percent_num = 40;
    troops.boosts.incr_stamina_regen_percent_num = 5000;
    assert_eq!(reveal_reward(troops, limits, 15, 123, 100).amount, 225075000000);
    troops.count = 999999999;
    assert_eq!(reveal_reward(troops, limits, 15, 123, 100).amount, 149999999);
    troops.tier = TroopTier::T3;
    assert_eq!(reveal_reward(troops, limits, 25, 123, 100).amount, 2249999997);
}

#[test]
fn frontier_reveal_draws_only_essence_or_labor_evenly_over_ten_thousand_reveals() {
    let limits = super::recorded::rules().troop_limit_config;
    let troops = Troops { count: 1500 * RESOURCE_PRECISION, tier: TroopTier::T1, ..Default::default() };
    let mut essence = 0_u32;
    let mut labor = 0_u32;
    for timestamp in 0_u64..10000 {
        let reward = reveal_reward(troops, limits, 10, 0x46524f4e54494552, timestamp);
        if reward.resource_type == ESSENCE {
            essence += 1;
        } else {
            assert_eq!(reward.resource_type, LABOR);
            labor += 1;
        }
    }
    assert!(essence >= 4900 && essence <= 5100, "Essence outside 50 +/- 1 percent");
    assert_eq!(essence + labor, 10000);
    println!("10000 reveal draws: Essence {}, labor {}", essence, labor);
}
