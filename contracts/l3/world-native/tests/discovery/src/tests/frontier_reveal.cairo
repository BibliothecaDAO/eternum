pub use world_test_support::tests::frontier_reveal::*;


#[test]
fn frontier_reveal_keeps_scaled_precision_and_ignores_boosts() {
    let limits = crate::rules::TroopLimitConfig {
        t1_tier_strength: 1, t2_tier_strength: 3, t3_tier_strength: 9, ..crate::balance::rules::TROOP_LIMIT_CONFIG,
    };
    let surface = crate::logic::expeditions::depth_rules(0);
    let veil = crate::logic::expeditions::depth_rules(1);
    let hollow = crate::logic::expeditions::depth_rules(2);
    let high_cap_15 = crate::expeditions::DepthRules { reveal_percent: 15, reveal_cap: 1000000, ..surface };
    let high_cap_25 = crate::expeditions::DepthRules { reveal_percent: 25, reveal_cap: 1000000, ..surface };
    let mut troops = Troops {
        count: 1500 * RESOURCE_PRECISION + RESOURCE_PRECISION / 2, tier: TroopTier::T1, ..Default::default(),
    };
    assert_eq!(reveal_reward(troops, limits, high_cap_15, 123).amount, 225075000000);
    troops.boosts.incr_explore_reward_percent_num = 5000;
    troops.boosts.incr_explore_reward_end_at = 100000;
    troops.boosts.incr_damage_dealt_percent_num = 40;
    troops.boosts.incr_stamina_regen_percent_num = 5000;
    assert_eq!(reveal_reward(troops, limits, high_cap_15, 123).amount, 225075000000);
    troops.count = 999999999;
    assert_eq!(reveal_reward(troops, limits, high_cap_15, 123).amount, 149999999);
    troops.tier = TroopTier::T3;
    assert_eq!(reveal_reward(troops, limits, high_cap_25, 123).amount, 2249999997);
    troops.tier = TroopTier::T1;
    troops.count = 20000 * RESOURCE_PRECISION;
    assert_eq!(reveal_reward(troops, limits, surface, 123).amount, surface.reveal_cap.into() * RESOURCE_PRECISION);
    assert_eq!(reveal_reward(troops, limits, veil, 123).amount, veil.reveal_cap.into() * RESOURCE_PRECISION);
    assert_eq!(reveal_reward(troops, limits, hollow, 123).amount, hollow.reveal_cap.into() * RESOURCE_PRECISION);
    troops.count = 5000 * RESOURCE_PRECISION;
    assert_eq!(reveal_reward(troops, limits, surface, 123).amount, 500 * RESOURCE_PRECISION);
    assert_eq!(reveal_reward(troops, limits, veil, 123).amount, 500 * RESOURCE_PRECISION);
    assert_eq!(reveal_reward(troops, limits, hollow, 123).amount, 500 * RESOURCE_PRECISION);
}

#[test]
fn frontier_reveal_draws_only_essence_or_labor_evenly_over_ten_thousand_reveals() {
    let limits = crate::balance::rules::TROOP_LIMIT_CONFIG;
    let surface = crate::logic::expeditions::depth_rules(0);
    let troops = Troops { count: 1500 * RESOURCE_PRECISION, tier: TroopTier::T1, ..Default::default() };
    let mut essence = 0_u32;
    let mut labor = 0_u32;
    for sample in 0_u64..10000 {
        let reward = reveal_reward(troops, limits, surface, 0x46524f4e54494552 + Into::<u64, u256>::into(sample));
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
    let rules = crate::logic::expeditions::depth_rules(0);
    let initial = 1001 * RESOURCE_PRECISION + 1;
    let camp_category = crate::taxonomy::CAMP_CATEGORY;
    let site = ExpeditionSite {
        category: camp_category, initial_guard_count: initial, alt: false, col: 1, row: 1, clear: None,
    };
    assert_eq!(
        site_reward(camp_category, site, 0, false, rules).unwrap(),
        crate::resources::ResourceAmount { resource_type: LABOR, amount: initial / 2 },
    );
    assert_eq!(
        site_reward(
            camp_category,
            ExpeditionSite {
                clear: Some(crate::expeditions::SiteClear { explorer_id: 7, home_id: 1, reward: None }), ..site,
            },
            0,
            false,
            rules,
        ),
        site_reward(camp_category, site, 0, false, rules),
    );
    assert_eq!(
        site_reward(RIFT_CATEGORY, site, 0, false, rules).unwrap(),
        crate::resources::ResourceAmount {
            resource_type: ESSENCE, amount: initial * rules.rift_essence_bps.into() / 10000,
        },
    );
    assert_eq!(
        site_reward(BEASTS_CATEGORY, site, 0, false, rules).unwrap(),
        crate::resources::ResourceAmount { resource_type: crate::resources::WHEAT, amount: initial * 4 },
    );
    assert!(site_reward(RUIN_CATEGORY, site, 0, false, rules).is_none());
}

#[test]
fn site_payout_counts_all_initial_guard_troops_without_tier_weighting() {
    let rules = crate::logic::expeditions::depth_rules(0);
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
        create_site_structure(key, crate::taxonomy::CAMP_CATEGORY);
        crate::logic::expeditions::create_site(key, guards.span());
        let site = crate::logic::expeditions::expedition_site(key).unwrap();
        assert_eq!(site.initial_guard_count, 1100 * RESOURCE_PRECISION);
        assert_eq!(
            site_reward(crate::taxonomy::CAMP_CATEGORY, site, 0, false, rules).unwrap().amount,
            550 * RESOURCE_PRECISION,
        );
        let receipt = crate::expeditions::SiteClear { explorer_id: 7, home_id: 1, reward: None };
        crate::logic::expeditions::clear_site(key, receipt);
        let cleared = crate::logic::expeditions::expedition_site(key).unwrap();
        assert_eq!(cleared.clear, Some(receipt));
        assert_eq!(
            crate::logic::map::occupancy(tile),
            Some(
                crate::map::TileOccupancy {
                    entity_id, category: crate::taxonomy::SUPPLY_POST_OCCUPIER, is_structure: true,
                },
            ),
        );
        assert_eq!(crate::logic::map::entity_coord(key), Some(coord));
        assert_eq!(cleared.initial_guard_count, site.initial_guard_count);
        assert_eq!(
            site_reward(RIFT_CATEGORY, cleared, 0, false, rules).unwrap().amount,
            1100 * RESOURCE_PRECISION * rules.rift_essence_bps.into() / 10000,
        );
    }
}

#[test]
fn every_guarded_site_keeps_terrain_and_receipt_and_removes_structure_and_guards() {
    let d = super::setup(true);
    let unallocated: u64 = super::registrar::next_setup_entity(d, 1).into();
    snforge_std::interact_with_state(
        d.games,
        || {
            for (x, category, occupier) in array![
                (1_u32, crate::taxonomy::CAMP_CATEGORY, crate::taxonomy::CAMP_OCCUPIER),
                (2_u32, crate::taxonomy::RIFT_CATEGORY, crate::taxonomy::RIFT_OCCUPIER),
                (3_u32, crate::taxonomy::RUIN_CATEGORY, crate::taxonomy::RUIN_OCCUPIER),
                (4_u32, crate::taxonomy::BEASTS_CATEGORY, crate::taxonomy::BEASTS_OCCUPIER),
            ] {
                let entity_id = unallocated + x.into();
                let key = crate::resources::ResourceKey { game_id: 1, entity_id };
                let coord = crate::troops::Coord { alt: false, x, y: 10 };
                let tile = crate::geometry::tile_key(key.game_id, coord);
                crate::logic::map::MapState::reveal(tile, 5);
                let terrain = crate::logic::map::tile(tile);
                crate::logic::map::MapState::occupy(tile, entity_id, occupier, true);
                create_site_structure(key, category);
                for slot in 0_u8..4 {
                    crate::logic::guards::GuardState::save(
                        crate::guards::GuardKey { game_id: key.game_id, structure_id: entity_id, slot },
                        crate::guards::Guard { destroyed_tick: 10, ..Default::default() },
                    );
                }
                crate::logic::expeditions::create_site(
                    key, array![Troops { count: 100 * RESOURCE_PRECISION, ..Default::default() }].span(),
                );
                let result = crate::expeditions::SiteClear { explorer_id: 20, home_id: 30, reward: None };
                crate::logic::expeditions::clear_site(key, result);
                let site = crate::logic::expeditions::expedition_site(key).unwrap();
                assert_eq!(site.clear, Some(result));
                assert_eq!(site.category, category);
                assert_eq!(crate::logic::map::tile(tile), terrain);
                assert!(crate::logic::structures::structure(key).is_none());
                assert_eq!(crate::logic::structures::owner(key), 0.try_into().unwrap());
                for slot in 0_u8..4 {
                    assert_eq!(
                        crate::logic::guards::guard(
                            crate::guards::GuardKey { game_id: key.game_id, structure_id: entity_id, slot },
                        ),
                        Default::default(),
                    );
                }
                assert_eq!((site.col, site.row, site.alt), (coord.x, coord.y, coord.alt));
                if category == crate::taxonomy::CAMP_CATEGORY {
                    assert_eq!(
                        crate::logic::map::occupancy(tile),
                        Some(
                            crate::map::TileOccupancy {
                                entity_id, category: crate::taxonomy::SUPPLY_POST_OCCUPIER, is_structure: true,
                            },
                        ),
                    );
                } else {
                    assert!(crate::logic::map::occupancy(tile).is_none());
                    let army = unallocated + 5;
                    crate::logic::map::MapState::occupy(
                        tile, army, crate::taxonomy::EXPLORER_KNIGHT_T1_OCCUPIER, false,
                    );
                    assert_eq!(crate::logic::expeditions::expedition_site(key), Some(site));
                    crate::logic::map::MapState::vacate(tile, army);
                }
            }
        },
    );
}

#[test]
#[should_panic(expected: "site already cleared")]
fn a_site_cannot_clear_again_after_an_army_enters_its_tile() {
    let key = crate::resources::ResourceKey { game_id: 1, entity_id: 1 };
    let tile = crate::map::TileKey { game_id: 1, alt: false, col: 1, row: 1 };
    crate::logic::map::MapState::occupy(tile, 1, crate::taxonomy::RIFT_OCCUPIER, true);
    create_site_structure(key, crate::taxonomy::RIFT_CATEGORY);
    crate::logic::expeditions::create_site(
        key, array![Troops { count: RESOURCE_PRECISION, ..Default::default() }].span(),
    );
    let result = crate::expeditions::SiteClear { explorer_id: 2, home_id: 3, reward: None };
    crate::logic::expeditions::clear_site(key, result);
    crate::logic::map::MapState::occupy(tile, 2, crate::taxonomy::EXPLORER_KNIGHT_T1_OCCUPIER, false);
    crate::logic::expeditions::clear_site(key, result);
}

#[test]
fn herd_pays_wheat_and_band_pays_no_resources() {
    for (depth, strength, wheat) in array![(0_u8, 350_u128, 1400_u128), (1, 700, 4200), (2, 1400, 11200)] {
        let rules = crate::logic::expeditions::depth_rules(depth);
        let site = ExpeditionSite {
            category: BEASTS_CATEGORY,
            initial_guard_count: strength * RESOURCE_PRECISION,
            alt: false,
            col: 0,
            row: 0,
            clear: None,
        };
        assert_eq!(
            site_reward(BEASTS_CATEGORY, site, depth, false, rules).unwrap(),
            crate::resources::ResourceAmount {
                resource_type: crate::resources::WHEAT, amount: wheat * RESOURCE_PRECISION,
            },
        );
        assert!(site_reward(BEASTS_CATEGORY, site, depth, true, rules).is_none());
    }
}

#[test]
fn site_resources_scale_by_depth_after_the_base_integer_payout() {
    let rules = crate::logic::expeditions::depth_rules(0);
    let site = ExpeditionSite {
        category: BEASTS_CATEGORY, alt: false, col: 0, row: 0, initial_guard_count: 1001, clear: None,
    };
    let rift_base = 1001_u128 * rules.rift_essence_bps.into() / 10000;
    for (depth, wheat, essence) in array![
        (0_u8, 4004_u128, rift_base), (1, 6006, rift_base * 3 / 2), (2, 8008, rift_base * 4 / 2),
        (3, 10010, rift_base * 5 / 2),
    ] {
        assert_eq!(site_reward(BEASTS_CATEGORY, site, depth, false, rules).unwrap().amount, wheat);
        assert_eq!(site_reward(RIFT_CATEGORY, site, depth, false, rules).unwrap().amount, essence);
        assert!(site_reward(RUIN_CATEGORY, site, depth, false, rules).is_none());
    }
}
