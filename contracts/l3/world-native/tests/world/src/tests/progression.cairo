pub use world_test_support::tests::progression::*;

#[test]
fn exploring_at_each_depth_awards_exact_xp_once() {
    for (depth, xp) in array![(0_u8, 2_u32), (1, 3), (2, 4), (3, 5)] {
        let (d, game_id, key) = super::registrar::setup_frontier_chests();
        let map = crate::map::IMapLogicDispatcher { contract_address: d.games };
        place_army_at_depth(d, key, depth);

        let before = read_progress(d, key);
        let target = super::frontier_explore_chest::destination(d, key);
        super::frontier_explore_chest::explore(d, key, super::frontier_explore_chest::HIT_ROOT, 360);
        let after = read_progress(d, key);
        assert_eq!(after, ArmyProgress { xp: before.xp + xp, ..before });
        assert!(map.tile(crate::geometry::tile_key(game_id, target)).is_some());
        assert!(
            !super::play_fixture::play(
                d.games,
                super::play_fixture::TestAction {
                    game_id,
                    actor: d.actor,
                    command: crate::commands::Command::Explore(
                        crate::commands::Explore { explorer_id: key.explorer_id, direction: 0 },
                    ),
                },
                1,
                361,
            ),
        );
        assert_eq!(read_progress(d, key), after);
    }
}

#[test]
fn thresholds_repeat_and_every_crossed_point_is_awarded_once() {
    let mut progress = crate::progression::initial();
    let mut previous = 0;
    for (xp, rank) in array![(75_u32, 1_u8), (200, 2), (400, 3), (800, 4), (1500, 5), (1575, 1)] {
        crate::progression::earn_xp(ref progress, rules(), xp - previous - 1);
        assert_eq!(crate::progression::points(progress, rank), if xp == 1575 {
            1
        } else {
            0
        });
        crate::progression::earn_xp(ref progress, rules(), 1);
        assert_eq!(crate::progression::points(progress, rank), if xp == 1575 {
            2
        } else {
            1
        });
        previous = xp;
    }
    crate::progression::earn_xp(ref progress, rules(), 2925);
    assert_eq!(progress.xp, 4500);
    for rank in 1_u8..6 {
        assert_eq!(crate::progression::points(progress, rank), 3);
    }
    crate::progression::earn_xp(ref progress, rules(), 0);
    for rank in 1_u8..6 {
        assert_eq!(crate::progression::points(progress, rank), 3);
    }
}

#[test]
fn each_point_raises_one_rank_and_spending_never_reduces_xp() {
    let mut progress = crate::progression::initial();
    crate::progression::earn_xp(ref progress, rules(), 1500);
    for rank in 1_u8..6 {
        let spent = crate::progression::spend_skill_point(ref progress, spend(SkillPointUse::Battle));
        assert_eq!(spent.tier, Some(rank));
        assert_eq!(spent.point_rank, rank);
        assert_eq!(spent.stamina, Into::<u8, u64>::into(10 + rank * 10));
        assert_eq!(progress.xp, 1500);
        assert_eq!(crate::progression::points(progress, rank), 0);
    }
    assert_eq!(progress.battle, 5);
}

#[test]
fn training_skips_ranks_but_the_lowest_fitting_point_is_always_used() {
    let mut progress = ArmyProgress {
        battle: 2,
        common_points: 2,
        uncommon_points: 1,
        epic_points: 1,
        legendary_points: 1,
        ..crate::progression::initial(),
    };
    let spent = crate::progression::spend_skill_point(ref progress, spend(SkillPointUse::Battle));
    assert_eq!((spent.tier, spent.point_rank, spent.stamina), (Some(3), 4, 50));
    assert_eq!(
        (progress.common_points, progress.uncommon_points, progress.epic_points, progress.legendary_points),
        (2, 1, 0, 1),
    );
}

#[test]
fn stamina_alone_spends_the_selected_point_for_double_its_refill() {
    let mut progress = crate::progression::initial();
    crate::progression::earn_xp(ref progress, rules(), 1500);
    for rank in 1_u8..6 {
        let spent = crate::progression::spend_skill_point(ref progress, spend(SkillPointUse::Stamina(rank)));
        assert_eq!(spent.tier, None);
        assert_eq!(spent.stamina, Into::<u8, u64>::into(20 + rank * 20));
        assert_eq!(crate::progression::points(progress, rank), 0);
    }
    assert_eq!(
        (progress.xp, progress.battle, progress.logistics, progress.scouting, progress.homecoming), (1500, 0, 0, 0, 0),
    );
}

#[test]
fn each_scouting_rank_preserves_its_choice_including_the_fifth() {
    let mut progress = crate::progression::initial();
    crate::progression::earn_xp(ref progress, rules(), 1500);
    for kind in array![
        ScoutingKind::Rift, ScoutingKind::Camp, ScoutingKind::Rift, ScoutingKind::Sanctuaries, ScoutingKind::Rift,
    ] {
        crate::progression::spend_skill_point(ref progress, scout(kind));
    }
    assert_eq!(progress.scouting, 5);
    assert_eq!(progress.scouting_kinds, 2 + 4 + 2 * 16 + 3 * 64 + 2 * 256);
    assert_eq!(crate::progression::scouting_bonus(progress), (1500, 6000, 2500));
    for kind in array![ScoutingKind::Camp, ScoutingKind::Rift, ScoutingKind::Sanctuaries] {
        let mut all = crate::progression::initial();
        crate::progression::earn_xp(ref all, rules(), 1500);
        for _ in 0_u8..5 {
            crate::progression::spend_skill_point(ref all, scout(kind));
        }
        let expected = match kind {
            ScoutingKind::Camp => (10000, 0, 0),
            ScoutingKind::Rift => (0, 10000, 0),
            ScoutingKind::Sanctuaries => (0, 0, 10000),
        };
        assert_eq!(crate::progression::scouting_bonus(all), expected);
    }
}

#[test]
#[should_panic(expected: "attribute is legendary")]
fn a_legendary_attribute_refuses_another_rank() {
    let mut progress = ArmyProgress { logistics: 5, legendary_points: 1, ..crate::progression::initial() };
    crate::progression::spend_skill_point(ref progress, spend(SkillPointUse::Logistics));
}

#[test]
#[should_panic(expected: "no fitting skill point")]
fn lower_rank_points_cannot_raise_a_trained_attribute() {
    let mut progress = ArmyProgress {
        battle: 2, common_points: 99, uncommon_points: 99, ..crate::progression::initial(),
    };
    crate::progression::spend_skill_point(ref progress, spend(SkillPointUse::Battle));
}

#[test]
#[should_panic(expected: "invalid point rank")]
fn stamina_cannot_spend_an_invalid_point_rank() {
    let mut progress = crate::progression::initial();
    crate::progression::spend_skill_point(ref progress, spend(SkillPointUse::Stamina(0)));
}

#[test]
#[should_panic(expected: "no skill point of that rank")]
fn stamina_requires_the_selected_rank_to_be_held() {
    let mut progress = ArmyProgress { common_points: 1, ..crate::progression::initial() };
    crate::progression::spend_skill_point(ref progress, spend(SkillPointUse::Stamina(2)));
}

#[test]
fn a_clear_pays_two_and_a_half_times_the_root_of_the_guard_strength() {
    let troops = crate::rules::RESOURCE_PRECISION;
    for (strength, xp) in array![(430_u128, 51_u32), (1300, 90), (3000, 136), (25000, 395), (49500, 556)] {
        assert_eq!(crate::progression::clear_xp(strength * troops), xp);
    }
}

#[test]
#[fuzzer(runs: 64)]
fn packed_progress_round_trips_every_tier_and_the_full_xp_range(xp: u32, a: u8, b: u8, c: u8, d: u8, kinds: u16) {
    let progress = ArmyProgress {
        xp,
        common_points: xp,
        uncommon_points: xp,
        rare_points: xp,
        epic_points: xp,
        legendary_points: xp,
        battle: a % 6,
        logistics: b % 6,
        scouting: c % 6,
        scouting_kinds: kinds,
        homecoming: d % 6,
    };
    assert_eq!(ProgressPacking::unpack(ProgressPacking::pack(progress)), progress);
}

#[test]
fn reveals_and_clears_pay_their_xp() {
    let d = super::registrar::setup();
    let (game_id, _, category) = super::registrar::expedition_home(d);
    let (key, _) = super::registrar::expedition_armies(d, game_id, category);
    snforge_std::interact_with_state(
        d.games,
        || {
            crate::logic::progression::award_xp(
                key, crate::progression::XpAward::Reveal(crate::troops::Coord { alt: false, x: 1, y: 1 }),
            );
            crate::logic::progression::award_xp(
                key, crate::progression::XpAward::Clear(1300 * crate::rules::RESOURCE_PRECISION),
            );
        },
    );
    assert_eq!(read_progress(d, key).xp, 2 + 90);
}

#[test]
fn rank_spending_and_stamina_spending_use_the_real_command_and_clamp() {
    let d = super::registrar::setup();
    let (game_id, _, category) = super::registrar::expedition_home(d);
    let (key, _) = super::registrar::expedition_armies(d, game_id, category);
    let progress = ArmyProgress { xp: 250, common_points: 1, uncommon_points: 1, ..crate::progression::initial() };
    write_progress(d, key, progress);
    set_bar(d, key, 0, 360);
    assert!(execute_spend(d, key, SkillPointUse::Battle));
    assert_eq!(read_progress(d, key), ArmyProgress { battle: 1, common_points: 0, ..progress });
    assert_eq!(bar(d, key, game_id), 20);
    assert!(execute_spend(d, key, SkillPointUse::Stamina(2)));
    assert_eq!(bar(d, key, game_id), 80);
    assert_eq!(read_progress(d, key).xp, 250);
    assert!(!execute_spend(d, key, SkillPointUse::Battle));
    write_progress(d, key, progress);
    set_bar(d, key, 110, 360);
    assert!(execute_spend(d, key, SkillPointUse::Stamina(1)));
    assert_eq!(bar(d, key, game_id), 120);
    let full = read_progress(d, key);
    assert!(!execute_spend(d, key, SkillPointUse::Stamina(2)));
    assert_eq!(read_progress(d, key), full);
}

#[test]
fn zero_rank_progress_exists_and_destroying_it_removes_its_points() {
    let d = super::registrar::setup();
    let (game_id, _, category) = super::registrar::expedition_home(d);
    let (key, _) = super::registrar::expedition_armies(d, game_id, category);
    assert_eq!(read_progress(d, key), crate::progression::initial());
    snforge_std::interact_with_state(
        d.games,
        || {
            crate::logic::progression::grant_point(key, 1);
            assert_eq!(crate::logic::progression::require(key).common_points, 1);
            crate::logic::progression::destroy(key);
            assert!(crate::logic::progression::read(key).is_none());
            let recreated = crate::logic::progression::create(key, 0);
            assert_eq!(recreated, crate::progression::initial());
            assert_eq!(crate::logic::progression::read(key), Some(recreated));
        },
    );
}

#[test]
fn a_logistics_tier_raises_the_maximum_and_the_bar_takes_only_the_purchase_refill() {
    let d = super::registrar::setup();
    let (game_id, preset, category) = super::registrar::expedition_home(d);
    let (key, _) = super::registrar::expedition_armies(d, game_id, category);
    let rules = preset.rules.troop_stamina_config;
    let timestamp = 360;
    let base = crate::progression::stamina_max(crate::progression::initial(), crate::troops::TroopType::Knight, rules);
    // A full bar rises only as far as the new maximum; a low one takes the 20 a Common point refills.
    for (amount, after) in array![(base, base + 20), (40, 60)] {
        write_progress(d, key, ArmyProgress { xp: 100, common_points: 1, ..crate::progression::initial() });
        set_bar(d, key, amount, timestamp);
        assert!(execute_spend(d, key, SkillPointUse::Logistics));
        assert_eq!(bar(d, key, game_id), after);
        assert_eq!(
            crate::progression::stamina_max(read_progress(d, key), crate::troops::TroopType::Knight, rules), base + 20,
        );
    }
}

#[test]
fn battle_tiers_multiply_damage_by_the_ruled_table() {
    let d = super::registrar::setup();
    let (game_id, preset, category) = super::registrar::expedition_home(d);
    let (key, _) = super::registrar::expedition_armies(d, game_id, category);
    let common = damage_at_battle(d, key, 0, preset.rules);
    assert!(common > 0);
    // Combat rounds losses to whole troops.
    let troop = crate::rules::RESOURCE_PRECISION;
    for (tier, percent) in array![(1_u8, 110_u128), (2, 125), (3, 145), (4, 170), (5, 200)] {
        let dealt = damage_at_battle(d, key, tier, preset.rules);
        assert!(
            dealt * 100 >= common * percent - 100 * troop && dealt * 100 <= common * percent + 100 * troop,
            "Battle tier {} deals {} against {}",
            tier,
            dealt,
            common,
        );
    }
}

#[test]
fn logistics_tiers_set_the_maximum_stamina_by_the_ruled_table() {
    let (_, frontier) = super::preset_projection::current_definition("frontier");
    let rules = frontier.rules.troop_stamina_config;
    for (logistics, maximum) in array![(0_u8, 120_u64), (1, 140), (2, 165), (3, 195), (4, 230), (5, 270)] {
        let progress = ArmyProgress { logistics, ..crate::progression::initial() };
        assert_eq!(crate::progression::stamina_max(progress, crate::troops::TroopType::Knight, rules), maximum);
    }
}

#[test]
fn added_stamina_stops_at_the_armys_own_maximum() {
    let (_, frontier) = super::preset_projection::current_definition("frontier");
    let rules = frontier.rules.troop_stamina_config;
    let maximum = crate::progression::stamina_max(
        ArmyProgress { logistics: 3, ..crate::progression::initial() }, crate::troops::TroopType::Knight, rules,
    );
    assert_eq!(maximum, 195);
    let mut boosts: crate::troops::TroopBoosts = Default::default();
    // Past the troop's base of 120, up to the army's own 195, and never beyond it.
    let mut bar = crate::troops::Stamina { amount: 110, settled_at: 5, remainder: 0 };
    bar.add(ref boosts, maximum, rules, 25, 120, 5);
    assert_eq!(bar.amount, 135);
    bar.add(ref boosts, maximum, rules, 100, 120, 5);
    assert_eq!(bar.amount, 195);
}

#[test]
fn an_armys_own_maximum_reads_its_logistics_tier_and_a_troops_without_progress() {
    let d = super::registrar::setup();
    let (game_id, preset, category) = super::registrar::expedition_home(d);
    let (key, _) = super::registrar::expedition_armies(d, game_id, category);
    let rules = preset.rules.troop_stamina_config;
    write_progress(d, key, ArmyProgress { logistics: 3, ..crate::progression::initial() });
    let (troops, own, other) = snforge_std::interact_with_state(
        d.games,
        || {
            let troops = crate::logic::troops::explorer(key).unwrap().troops;
            let other = crate::troops::ExplorerKey { game_id, explorer_id: 9999 };
            (
                troops,
                crate::logic::progression::own_stamina_max(key, troops, rules),
                crate::logic::progression::own_stamina_max(other, troops, rules),
            )
        },
    );
    assert_eq!(own, crate::stamina::StaminaImpl::max(troops.category, crate::troops::TroopTier::T1, rules) + 75);
    assert_eq!(other, crate::stamina::StaminaImpl::max(troops.category, troops.tier, rules));
}

#[test]
fn homecoming_returns_each_expired_armys_own_share_of_its_survivors() {
    let d = super::registrar::setup();
    let (game_id, _, category) = super::registrar::expedition_home(d);
    let (first, second) = super::registrar::expedition_armies(d, game_id, category);
    let troop = crate::rules::RESOURCE_PRECISION;
    let stock = snforge_std::interact_with_state(
        d.games,
        || {
            // An unlimited store isolates the share from capacity clipping.
            crate::state::write()
                .resources
                .weights
                .write(
                    (game_id, 1), crate::resources::Weight { capacity: 0xffffffffffffffffffffffffffffffff, weight: 0 },
                );
            // The first army ends the day 10,000 strong at epic Homecoming, the second 1,000 strong at rare.
            for (key, count, homecoming) in array![(first, 10_000_u128, 4_u8), (second, 1_000, 3)] {
                let mut troops = crate::logic::troops::explorer(key).unwrap().troops;
                troops.count = count * troop;
                crate::logic::troops::TroopState::update_troops(key, troops);
                crate::logic::progression::write(key, ArmyProgress { homecoming, ..crate::progression::initial() });
            }
            let troops = crate::logic::troops::explorer(first).unwrap().troops;
            crate::troops::stock_resource(troops.category, troops.tier)
        },
    );
    let resources = crate::resources::IResourceOperationsDispatcher { contract_address: d.games };
    let slot = crate::resources::ResourceSlot { game_id, entity_id: 1, resource_type: stock };
    let before = resources.resource_balance(slot);
    let tomorrow = super::registrar::day_start(d, game_id, 1);
    // The next day's first deploy removes yesterday's armies: 21% of 10,000 and 14% of 1,000 come home.
    assert!(
        super::resource_commands::execute_in_game(d, game_id, super::registrar::muster_command(category, 0), tomorrow),
    );
    let troops = super::state::GameState { contract_address: d.games };
    assert!(troops.explorer(first).is_none() && troops.explorer(second).is_none());
    assert_eq!(resources.resource_balance(slot), before + 2100 * troop + 140 * troop - troop);
}

#[test]
fn homecoming_returns_whole_troops_and_nothing_at_zero() {
    for (count, homecoming, returned) in array![(10_000_u128, 0_u8, 0_u128), (99, 4, 20), (33, 1, 0), (34, 1, 1)] {
        let share: u128 = crate::rules::homecoming_bps(homecoming).into();
        assert_eq!(count * share / 10000, returned);
    }
    assert_eq!(crate::rules::homecoming_bps(5), 3000);
}

#[test]
fn training_starts_only_later_armies_at_their_realms_tiers_and_full_at_their_logistics_maximum() {
    let d = super::registrar::setup();
    let (game_id, preset, category) = super::registrar::expedition_home(d);
    let home = crate::resources::ResourceKey { game_id, entity_id: 1 };
    snforge_std::start_cheat_caller_address(d.games, d.games);
    crate::resources::IResourceOperationsDispatcher { contract_address: d.games }
        .grant_resource(
            home,
            26,
            1000 * crate::rules::RESOURCE_PRECISION,
            351,
            crate::commands::resource_context(
                crate::commands::ExecutionContext { timestamp: 351, ..crate::tests::context(d.games, game_id) },
            ),
        );
    snforge_std::stop_cheat_caller_address(d.games);
    let untrained = deploy(d, game_id, category, 0);
    assert_eq!(read_progress(d, untrained), crate::progression::initial());

    // War hall Uncommon, Supply yard Common, Hearth Rare; the Scouts' lodge untrained.
    let mut learned = 0;
    for (row, tiers) in array![
        (crate::research::ROW_WAR_HALL, 2_u8), (crate::research::ROW_SUPPLY_YARD, 1), (crate::research::ROW_HEARTH, 3),
    ] {
        for _ in 0..tiers {
            learned = crate::research::learn(learned, row, 0);
        }
    }
    let learned = learned;
    snforge_std::interact_with_state(
        d.games, || crate::logic::research::write(home, crate::research::RealmKnowledge { learned }),
    );
    let trained = deploy(d, game_id, category, 1);
    let progress = read_progress(d, trained);
    assert_eq!(
        (progress.battle, progress.logistics, progress.scouting, progress.homecoming, progress.xp), (2, 1, 0, 3, 0),
    );
    // Training changes no army already deployed.
    assert_eq!(read_progress(d, untrained), crate::progression::initial());
    let troops = super::state::GameState { contract_address: d.games }.resolved_explorer(trained).unwrap().troops;
    assert_eq!(
        troops.stamina.inline().amount,
        crate::progression::stamina_max(progress, troops.category, preset.rules.troop_stamina_config),
    );
    assert_eq!(
        troops.stamina.inline().amount,
        crate::stamina::StaminaImpl::max(
            troops.category, crate::troops::TroopTier::T1, preset.rules.troop_stamina_config,
        )
            + crate::rules::logistics_stamina(1).into(),
    );
}

#[test]
fn trained_scouting_carries_every_choice_from_the_lodge() {
    let mut learned = crate::research::learn(0, crate::research::ROW_SHRINE, 0);
    for kind in array![
        crate::research::KIND_RIFTS, crate::research::KIND_CAMPS, crate::research::KIND_SANCTUARIES,
        crate::research::KIND_RIFTS, crate::research::KIND_SANCTUARIES,
    ] {
        learned = crate::research::learn(learned, crate::research::ROW_SCOUTS_LODGE, kind);
    }
    let progress = crate::progression::trained(learned);
    assert_eq!(progress.scouting, 5);
    assert_eq!(progress.scouting_kinds, 2 + 4 + 3 * 16 + 2 * 64 + 3 * 256);
    assert_eq!(progress.xp, 0);
}

#[test]
fn shrine_roll_boundaries_shift_one_rank_per_depth_and_cap_at_legendary() {
    for depth in 0_u8..4 {
        for (draw, surface_rank) in array![
            (0_u32, 1_u8), (4999, 1), (5000, 2), (7999, 2), (8000, 3), (9499, 3), (9500, 4), (9899, 4), (9900, 5),
            (9999, 5),
        ] {
            let rank = crate::progression::shrine_point(depth, draw);
            assert_eq!(rank, core::cmp::min(surface_rank + depth, 5));
            let before = ArmyProgress { xp: 199, common_points: 2, ..crate::progression::initial() };
            let mut after = before;
            crate::progression::earn_point(ref after, rank);
            assert_eq!(after.xp, before.xp);
            for held_rank in 1_u8..6 {
                assert_eq!(
                    crate::progression::points(after, held_rank),
                    crate::progression::points(before, held_rank) + if held_rank == rank {
                        1
                    } else {
                        0
                    },
                );
            }
        }
    }
}

#[test]
fn discovery_stores_a_depth_scaled_point_and_public_use_grants_it_once_without_xp() {
    for depth in 0_u8..4 {
        let rules = super::preset_projection::frontier_discovery_rules();
        let unlocked = crate::expeditions::FrontierDiscoveryRules { well_bps: 0, ..rules };
        let (d, game_id, key) = super::registrar::setup_frontier_chests_with_rules(Some(unlocked));
        place_army_at_depth(d, key, depth);
        let army = super::state::GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
        snforge_std::interact_with_state(
            d.games,
            || {
                crate::logic::research::write(
                    crate::resources::ResourceKey { game_id, entity_id: army.owner },
                    crate::research::RealmKnowledge {
                        learned: crate::research::learn(0, crate::research::ROW_SHRINE, 0),
                    },
                );
            },
        );
        let root = super::registrar::discovery_root(
            game_id, unlocked, 0, Some(super::registrar::any_chest()), crate::discovery::Discovery::Shrine,
        );
        let target = super::frontier_explore_chest::destination(d, key);
        super::frontier_explore_chest::explore(d, key, root, 360);
        let occupied = snforge_std::interact_with_state(
            d.games, || crate::logic::map::occupancy(crate::geometry::tile_key(game_id, target)).unwrap(),
        );
        assert_eq!(occupied.category, crate::taxonomy::SHRINE_OCCUPIER);
        let site = crate::resources::ResourceKey { game_id, entity_id: occupied.entity_id };
        let reward = snforge_std::interact_with_state(d.games, || crate::logic::shrines::read(site).unwrap());
        let mut recorded = root;
        let seed = crate::random::game_root(ref recorded, game_id);
        assert_eq!(
            reward.rank,
            crate::progression::shrine_point(
                depth, crate::random::range(seed, 'shrine point', 10000).try_into().unwrap(),
            ),
        );
        assert!(reward.rank > depth);
        let before = read_progress(d, key);
        let action = super::play_fixture::TestAction {
            game_id,
            actor: d.actor,
            command: crate::commands::Command::InteractSite(
                crate::relics::InteractSite { explorer_id: key.explorer_id, coord: target },
            ),
        };
        assert!(super::play_fixture::play(d.games, action, 987654321, 361));
        let mut expected = before;
        crate::progression::earn_point(ref expected, reward.rank);
        assert_eq!(read_progress(d, key), expected);
        assert!(snforge_std::interact_with_state(d.games, || crate::logic::shrines::read(site)).is_none());
        assert!(
            snforge_std::interact_with_state(
                d.games, || crate::logic::map::occupancy(crate::geometry::tile_key(game_id, target)),
            )
                .is_none(),
        );
        assert!(!super::play_fixture::play(d.games, action, 123456789, 362));
        assert_eq!(read_progress(d, key), expected);
    }
}

#[test]
#[test_case(8, name: "shrine")]
#[test_case(9, name: "well")]
fn sanctuary_points_require_either_research_and_spend_once(row: u8) {
    let d = super::registrar::setup();
    let (game_id, _, category) = super::registrar::expedition_home(d);
    let (key, _) = super::registrar::expedition_armies(d, game_id, category);
    let progress = ArmyProgress { common_points: 1, ..crate::progression::initial() };
    write_progress(d, key, progress);
    let choice = SkillPointUse::Scouting(ScoutingKind::Sanctuaries);
    assert!(!execute_spend(d, key, choice));
    assert_eq!(read_progress(d, key), progress);
    let home = crate::resources::ResourceKey { game_id, entity_id: 1 };
    snforge_std::start_cheat_caller_address(d.games, d.games);
    crate::resources::IResourceOperationsDispatcher { contract_address: d.games }
        .grant_resource(
            home,
            crate::resources::ESSENCE,
            10000 * crate::rules::RESOURCE_PRECISION,
            360,
            crate::commands::resource_context(
                crate::commands::ExecutionContext { timestamp: 360, ..crate::tests::context(d.games, game_id) },
            ),
        );
    snforge_std::stop_cheat_caller_address(d.games);
    assert!(
        super::resource_commands::execute_in_game(
            d,
            game_id,
            crate::commands::Command::Research(crate::research::Research { structure_id: 1, row, choice: 0 }),
            360,
        ),
    );
    assert!(execute_spend(d, key, choice));
    assert_eq!(read_progress(d, key), ArmyProgress { scouting: 1, scouting_kinds: 3, common_points: 0, ..progress });
    assert!(!execute_spend(d, key, choice));
}

#[test]
fn sanctuary_spending_records_a_new_history_discriminant() {
    let mut progress = ArmyProgress { common_points: 1, ..crate::progression::initial() };
    let spent = crate::progression::spend_skill_point(ref progress, scout(ScoutingKind::Sanctuaries));
    let mut fields = array![];
    spent.serialize(ref fields);
    assert_eq!(fields, array![7, 2, 3, 1, 0, 1, 20]);
    let mut old_fields = array![7, 2, 2, 1, 0, 1, 20].span();
    let old: crate::progression::SkillPointSpent = Serde::deserialize(ref old_fields).unwrap();
    assert_eq!(
        old.choice,
        crate::progression::RecordedSkillPointUse::Scouting(crate::progression::RecordedScoutingKind::Beasts),
    );
}
