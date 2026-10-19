use crate::expeditions::{ExpeditionSite, site_reward};
use crate::exploration_rewards::reveal_reward;
use crate::resources::{ESSENCE, LABOR};
use crate::rules::RESOURCE_PRECISION;
use crate::taxonomy::{BEASTS_CATEGORY, RIFT_CATEGORY, RUIN_CATEGORY};
use crate::troops::{TroopTier, Troops};

#[test]
fn frontier_reveal_keeps_scaled_precision_and_ignores_boosts() {
    let limits = crate::rules::TroopLimitConfig {
        t1_tier_strength: 1,
        t2_tier_strength: 3,
        t3_tier_strength: 9,
        ..super::play_fixture::rules().troop_limit_config,
    };
    let mut troops = Troops {
        count: 1500 * RESOURCE_PRECISION + RESOURCE_PRECISION / 2, tier: TroopTier::T1, ..Default::default(),
    };
    assert_eq!(reveal_reward(troops, limits, 15, 123).amount, 225075000000);
    troops.boosts.incr_explore_reward_percent_num = 5000;
    troops.boosts.incr_explore_reward_end_at = 100000;
    troops.boosts.incr_damage_dealt_percent_num = 40;
    troops.boosts.incr_stamina_regen_percent_num = 5000;
    assert_eq!(reveal_reward(troops, limits, 15, 123).amount, 225075000000);
    troops.count = 999999999;
    assert_eq!(reveal_reward(troops, limits, 15, 123).amount, 149999999);
    troops.tier = TroopTier::T3;
    assert_eq!(reveal_reward(troops, limits, 25, 123).amount, 2249999997);
}

#[test]
fn frontier_reveal_draws_only_essence_or_labor_evenly_over_ten_thousand_reveals() {
    let limits = super::play_fixture::rules().troop_limit_config;
    let troops = Troops { count: 1500 * RESOURCE_PRECISION, tier: TroopTier::T1, ..Default::default() };
    let mut essence = 0_u32;
    let mut labor = 0_u32;
    for sample in 0_u64..10000 {
        let reward = reveal_reward(troops, limits, 10, 0x46524f4e54494552 + Into::<u64, u256>::into(sample));
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
    let camp_category = crate::taxonomy::CAMP_CATEGORY;
    let site = ExpeditionSite { initial_guard_count: initial, alt: false, col: 1, row: 1, clear: None };
    assert_eq!(
        site_reward(camp_category, site).unwrap(),
        crate::resources::ResourceAmount { resource_type: LABOR, amount: initial / 2 },
    );
    assert_eq!(
        site_reward(
            camp_category,
            ExpeditionSite {
                clear: Some(crate::expeditions::SiteClear { explorer_id: 7, home_id: 1, reward: None }), ..site,
            },
        ),
        site_reward(camp_category, site),
    );
    assert_eq!(
        site_reward(RIFT_CATEGORY, site).unwrap(),
        crate::resources::ResourceAmount { resource_type: ESSENCE, amount: initial * 3 },
    );
    assert!(site_reward(BEASTS_CATEGORY, site).is_none());
    assert!(site_reward(RUIN_CATEGORY, site).is_none());
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
        let coord = crate::troops::Coord { alt: false, x: entity_id.try_into().unwrap(), y: 1 };
        let tile = crate::geometry::tile_key(key.game_id, coord);
        crate::logic::map::MapState::occupy(tile, entity_id, crate::taxonomy::CAMP_OCCUPIER, true);
        crate::logic::expeditions::create_site(key, guards.span());
        let site = crate::logic::expeditions::expedition_site(key).unwrap();
        assert_eq!(site.initial_guard_count, 1100 * RESOURCE_PRECISION);
        assert_eq!(site_reward(crate::taxonomy::CAMP_CATEGORY, site).unwrap().amount, 550 * RESOURCE_PRECISION);
        let receipt = crate::expeditions::SiteClear { explorer_id: 7, home_id: 1, reward: None };
        crate::logic::expeditions::clear_site(key, receipt);
        let cleared = crate::logic::expeditions::expedition_site(key).unwrap();
        assert_eq!(cleared.clear, Some(receipt));
        assert!(crate::logic::map::occupancy(tile).is_none());
        assert!(crate::logic::map::entity_coord(key).is_none());
        crate::logic::map::MapState::occupy(tile, 100, crate::taxonomy::EXPLORER_KNIGHT_T1_OCCUPIER, false);
        crate::logic::map::MapState::vacate(tile, 100);
        assert_eq!(crate::logic::expeditions::expedition_site(key), Some(cleared));
        assert_eq!(cleared.initial_guard_count, site.initial_guard_count);
        assert_eq!(site_reward(RIFT_CATEGORY, cleared).unwrap().amount, 3300 * RESOURCE_PRECISION);
    }
}

#[test]
fn every_guarded_site_keeps_its_receipt_and_only_releases_its_blocker() {
    for (entity_id, category) in array![
        (1_u64, crate::taxonomy::CAMP_OCCUPIER), (2_u64, crate::taxonomy::RIFT_OCCUPIER),
        (3_u64, crate::taxonomy::RUIN_OCCUPIER), (4_u64, crate::taxonomy::BEASTS_OCCUPIER),
    ] {
        let key = crate::resources::ResourceKey { game_id: 1, entity_id };
        let coord = crate::troops::Coord { alt: false, x: entity_id.try_into().unwrap(), y: 10 };
        let tile = crate::geometry::tile_key(key.game_id, coord);
        crate::logic::map::MapState::occupy(tile, entity_id, category, true);
        crate::logic::expeditions::create_site(
            key, array![Troops { count: 100 * RESOURCE_PRECISION, ..Default::default() }].span(),
        );
        let result = crate::expeditions::SiteClear { explorer_id: 20, home_id: 30, reward: None };
        crate::logic::expeditions::clear_site(key, result);
        let site = crate::logic::expeditions::expedition_site(key).unwrap();
        assert_eq!(site.clear, Some(result));
        assert_eq!((site.col, site.row, site.alt), (coord.x, coord.y, coord.alt));
        assert!(crate::logic::map::occupancy(tile).is_none());
        crate::logic::map::MapState::occupy(tile, 20, crate::taxonomy::EXPLORER_KNIGHT_T1_OCCUPIER, false);
        assert_eq!(crate::logic::expeditions::expedition_site(key), Some(site));
        crate::logic::map::MapState::vacate(tile, 20);
    }
}

#[test]
#[should_panic(expected: "site already cleared")]
fn a_site_cannot_clear_again_after_an_army_enters_its_tile() {
    let key = crate::resources::ResourceKey { game_id: 1, entity_id: 1 };
    let tile = crate::map::TileKey { game_id: 1, alt: false, col: 1, row: 1 };
    crate::logic::map::MapState::occupy(tile, 1, crate::taxonomy::CAMP_OCCUPIER, true);
    crate::logic::expeditions::create_site(
        key, array![Troops { count: RESOURCE_PRECISION, ..Default::default() }].span(),
    );
    let result = crate::expeditions::SiteClear { explorer_id: 2, home_id: 3, reward: None };
    crate::logic::expeditions::clear_site(key, result);
    crate::logic::map::MapState::occupy(tile, 2, crate::taxonomy::EXPLORER_KNIGHT_T1_OCCUPIER, false);
    crate::logic::expeditions::clear_site(key, result);
}
