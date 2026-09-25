use crate::expeditions::{ExpeditionSite, SiteKind, site_reward};
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

#[test]
fn site_payout_keeps_initial_scaled_guard_count_and_has_no_clock_factor() {
    let initial = 1001 * RESOURCE_PRECISION + 1;
    let camp = ExpeditionSite { kind: SiteKind::Camp, initial_guard_count: initial, cleared: false };
    assert_eq!(
        site_reward(camp).unwrap(), crate::resources::ResourceAmount { resource_type: LABOR, amount: initial / 2 },
    );
    assert_eq!(site_reward(ExpeditionSite { cleared: true, ..camp }), site_reward(camp));
    let rift = ExpeditionSite { kind: SiteKind::Rift, ..camp };
    assert_eq!(
        site_reward(rift).unwrap(), crate::resources::ResourceAmount { resource_type: ESSENCE, amount: initial * 3 },
    );
    assert!(site_reward(ExpeditionSite { kind: SiteKind::FallenRealm, ..camp }).is_none());
}

#[test]
fn site_payout_counts_all_initial_guard_troops_without_tier_weighting() {
    for tier in array![TroopTier::T1, TroopTier::T2, TroopTier::T3] {
        let entity_id = match tier {
            TroopTier::T1 => 1,
            TroopTier::T2 => 2,
            TroopTier::T3 => 3,
        };
        let key = crate::resources::ResourceKey { game_id: 1, entity_id };
        let guards = array![
            Troops { count: 700 * RESOURCE_PRECISION, tier, ..Default::default() },
            Troops { count: 400 * RESOURCE_PRECISION, tier, ..Default::default() },
        ];
        crate::logic::expeditions::create_site(key, SiteKind::Camp, guards.span());
        let site = crate::logic::expeditions::expedition_site(key).unwrap();
        assert_eq!(site.initial_guard_count, 1100 * RESOURCE_PRECISION);
        assert_eq!(site_reward(site).unwrap().amount, 550 * RESOURCE_PRECISION);
        let cleared = crate::logic::expeditions::clear_site(key);
        assert_eq!(cleared.initial_guard_count, site.initial_guard_count);
        assert_eq!(
            site_reward(ExpeditionSite { kind: SiteKind::Rift, ..cleared }).unwrap().amount, 3300 * RESOURCE_PRECISION,
        );
    }
}
