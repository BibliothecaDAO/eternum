pub use world_test_support::tests::relics::*;


#[test]
fn every_relic_activation_records_actor_target_and_applied_effect_once() {
    let (deployment, home, explorer) = setup(false);
    for id in 39_u8..57 {
        let (target, recipient) = if id < 49 {
            (explorer, Recipient::Explorer)
        } else if id < 51 {
            (home, Recipient::StructureGuard)
        } else {
            (home, Recipient::StructureProduction)
        };
        let mut spy = snforge_std::spy_events();
        assert!(execute(deployment, apply(target, id, recipient), 40));
        let stories = activations(ref spy, deployment.games);
        assert_eq!(stories.len(), 1);
        let story = stories.at(0);
        assert_eq!(*story.game_id, 3);
        assert_eq!(*story.owner, Some(deployment.actor));
        assert_eq!(*story.entity_id, Some(target.entity_id));
        assert_eq!(*story.timestamp, 40);
        let rule = *rules().at((id - 39).into());
        assert_eq!(
            *story.story,
            crate::ownership::Story::RelicActivated(
                crate::relics::RelicActivated {
                    relic_id: id,
                    recipient,
                    rate_bps: rule.rate_bps,
                    duration_seconds: if id == 45 || id == 46 {
                        0
                    } else {
                        30
                    },
                    radius: if id == 45 || id == 46 {
                        rule.uses
                    } else {
                        0
                    },
                },
            ),
        );
    }
}
#[test]
fn explorer_relics_charge_the_home_with_second_based_effects() {
    let (deployment, home, explorer) = setup(false);
    for id in array![39_u8, 40, 41, 42, 43, 44, 47, 48] {
        let before = balance(deployment, home, 38);
        assert!(execute(deployment, apply(explorer, id, Recipient::Explorer), 40));
        assert_eq!(balance(deployment, explorer, id), 2 * RESOURCE_PRECISION);
        let rule = *rules().at((id - 39).into());
        assert_eq!(balance(deployment, home, 38), before - rule.essence_cost * RESOURCE_PRECISION);
        let boost = troop(deployment, explorer).troops.boosts;
        match id {
            39 |
            40 => {
                assert_eq!(boost.incr_stamina_regen_percent_num, rule.rate_bps);
                assert_eq!(boost.incr_stamina_regen_seconds_left, 30);
            },
            41 |
            42 => {
                assert_eq!(boost.incr_damage_dealt_percent_num, rule.rate_bps);
                assert_eq!(boost.incr_damage_dealt_end_at, 70);
            },
            43 |
            44 => {
                assert_eq!(boost.decr_damage_gotten_percent_num, rule.rate_bps);
                assert_eq!(boost.decr_damage_gotten_end_at, 70);
            },
            _ => {
                assert_eq!(boost.incr_explore_reward_percent_num, rule.rate_bps);
                assert_eq!(boost.incr_explore_reward_end_at, 70);
            },
        }
    }
}
#[test]
fn production_relics_pay_their_full_window_and_reapplication_replaces_the_bonus() {
    for (weak, strong, resource, first_output, replacement_output) in array![
        (51_u8, 52_u8, 4_u8, 140_u128, 120_u128), (53, 54, 23, 120, 120), (55, 56, 26, 130, 115),
    ] {
        for replace in array![false, true] {
            let (deployment, home, _) = setup(false);
            grant(deployment, home, 2, 1000);
            assert!(execute(deployment, apply(home, strong, Recipient::StructureProduction), 47));
            let (end, output) = if replace {
                assert!(execute(deployment, apply(home, weak, Recipient::StructureProduction), 52));
                (82_u64, replacement_output)
            } else {
                (77_u64, first_output)
            };
            let refill = Command::BurnLaborForResourceProduction(
                crate::production::RefillProduction {
                    structure_id: home.entity_id,
                    resource_types: array![resource].span(),
                    amounts: array![1_u128].span(),
                },
            );
            let resources = IResourceOperationsDispatcher { contract_address: deployment.games };
            let slot = ResourceSlot { game_id: home.game_id, entity_id: home.entity_id, resource_type: resource };
            let stored_before = resources.resource_balance(slot);
            assert!(execute(deployment, refill, end - 1));
            assert_eq!(resources.resource_production(slot).output_amount_left, output);
            assert!(execute(deployment, refill, end));
            assert_eq!(resources.resource_production(slot).output_amount_left, output + 100);
            assert_eq!(resources.resource_balance(slot), stored_before);
            assert_eq!(balance(deployment, home, 2), 980);
        }
    }
}
#[test]
fn guard_relics_apply_to_all_four_slots_and_preserve_destroyed_ticks() {
    let (deployment, home, _) = setup(false);
    let key = crate::guards::GuardKey { game_id: 3, structure_id: home.entity_id, slot: 2 };
    let guard = crate::guards::Guard { destroyed_tick: 2, ..Default::default() };
    set_fixture(
        deployment.games, selector!("guards"), selector!("guards"), array![3, home.entity_id.into(), 2].span(), guard,
    );
    for id in array![49_u8, 50] {
        let applied_at = if id == 49 {
            47
        } else {
            52
        };
        assert!(execute(deployment, apply(home, id, Recipient::StructureGuard), applied_at));
        for slot in 0_u8..4 {
            let value = crate::guards::IGuardsDispatcherTrait::guard(
                crate::guards::IGuardsDispatcher { contract_address: deployment.games },
                crate::guards::GuardKey { slot, ..key },
            );
            assert_eq!(value.troops.boosts.decr_damage_gotten_end_at, (applied_at + 30).try_into().unwrap());
            assert_eq!(value.troops.boosts.decr_damage_gotten_percent_num, if id == 49 {
                1500
            } else {
                3000
            });
            assert_eq!(value.destroyed_tick, if slot == 2 {
                2
            } else {
                0
            });
        }
    }
}
#[test]
fn failed_payments_and_wrong_targets_roll_back_effects() {
    let (deployment, home, explorer) = setup(false);
    let mut spy = snforge_std::spy_events();
    let original = troop(deployment, explorer);
    for (id, recipient, key) in array![
        (56_u8, Recipient::Explorer, explorer), (39, Recipient::StructureGuard, home),
        (39, Recipient::StructureProduction, home), (38, Recipient::Explorer, explorer),
        (57, Recipient::Explorer, explorer),
    ] {
        assert_terminal_rejection(deployment, apply(key, id, recipient), 40);
    }
    assert!(
        execute(
            deployment,
            Command::BurnStructureResources(
                crate::resources::ResourceBurn {
                    entity_id: home.entity_id,
                    resources: array![
                        crate::resources::ResourceAmount { resource_type: 38, amount: 10000 * RESOURCE_PRECISION },
                    ]
                        .span(),
                },
            ),
            40,
        ),
    );
    assert_terminal_rejection(deployment, apply(explorer, 42, Recipient::Explorer), 40);
    assert_eq!(troop(deployment, explorer), original);
    assert_eq!(balance(deployment, explorer, 42), 3 * RESOURCE_PRECISION);
    move_fixture(deployment, explorer, Coord { alt: true, ..original.coord });
    assert_terminal_rejection(deployment, apply(explorer, 39, Recipient::Explorer), 40);
    assert!(activations(ref spy, deployment.games).is_empty(), "rejected activation recorded a story");
}
#[test]
fn reveal_relics_reveal_only_the_ring_without_points_or_discovery() {
    let (deployment, home, explorer) = setup(false);
    move_fixture(deployment, explorer, Coord { alt: false, x: 2000100, y: 2000100 });
    let origin = troop(deployment, explorer).coord;
    let before = crate::game::IPointsDispatcherTrait::player_points(
        crate::game::IPointsDispatcher { contract_address: deployment.games }, 3, deployment.actor,
    );
    for id in array![45_u8, 46] {
        assert!(execute(deployment, apply(explorer, id, Recipient::Explorer), 40));
    }
    let map = IMapLogicDispatcher { contract_address: deployment.games };
    let mut revealed = 0;
    for x in 2000098_u32..2000103 {
        for y in 2000098_u32..2000103 {
            let coord = Coord { alt: false, x, y };
            if crate::geometry::distance(origin, coord) > 0 && crate::geometry::distance(origin, coord) <= 2 {
                let _tile = map.tile(crate::geometry::tile_key(3, coord)).unwrap();
                assert!(map.occupancy(crate::geometry::tile_key(3, coord)).is_none());
                revealed += 1;
            }
        }
    }
    assert_eq!(revealed, 18);
    assert_eq!(
        crate::game::IPointsDispatcherTrait::player_points(
            crate::game::IPointsDispatcher { contract_address: deployment.games }, 3, deployment.actor,
        ),
        before,
    );
    // Moving the fixture places its occupancy but does not reveal its terrain.
    let origin_tile = map.tile(crate::geometry::tile_key(3, origin)).unwrap();
    assert_eq!(origin_tile.data / crate::map::BIOME_SCALE % crate::map::BYTE_RANGE, 0);
    assert_eq!(map.occupancy(crate::geometry::tile_key(3, origin)).unwrap().entity_id, explorer.entity_id);
    assert_eq!(balance(deployment, home, 38), 9250 * RESOURCE_PRECISION);
}
#[test]
fn chest_discovery_is_surface_only_timed_and_skips_reserved_or_occupied_tiles() {
    let (deployment, _, _) = setup(true);
    let origin = Coord { alt: false, x: 2000200, y: 2000200 };
    let expected = crate::relics::chest_destination(origin, 321, 12);
    set_fixture(
        deployment.games,
        selector!("settlement_pool"),
        selector!("reserved"),
        array![3, expected.x.into(), expected.y.into()].span(),
        true,
    );
    chest(deployment, origin, 321, 40);
    let actual = crate::geometry::neighbor(expected, 0);
    let _tile = IMapLogicDispatcher { contract_address: deployment.games }
        .tile(crate::geometry::tile_key(3, actual))
        .unwrap();
    assert_eq!(
        IMapLogicDispatcher { contract_address: deployment.games }
            .occupancy(crate::geometry::tile_key(3, actual))
            .unwrap()
            .category,
        34,
    );
    assert_eq!(map_relics(deployment).relic_discovery_time(3), 40);
    start_cheat_caller_address(deployment.games, deployment.games);
    start_cheat_block_timestamp_global(49);
    map_relics(deployment)
        .discover_relic_chest(
            3,
            1,
            origin,
            origin,
            322,
            49,
            crate::commands::action_context(
                crate::commands::ExecutionContext { timestamp: 49, ..crate::tests::context(deployment.games, 3) },
            ),
        );
    assert_eq!(map_relics(deployment).relic_discovery_time(3), 40);
    start_cheat_block_timestamp_global(50);
    map_relics(deployment)
        .discover_relic_chest(
            3,
            1,
            Coord { alt: true, ..origin },
            origin,
            322,
            50,
            crate::commands::action_context(
                crate::commands::ExecutionContext { timestamp: 50, ..crate::tests::context(deployment.games, 3) },
            ),
        );
    assert_eq!(map_relics(deployment).relic_discovery_time(3), 40);
    map_relics(deployment)
        .discover_relic_chest(
            3,
            1,
            origin,
            origin,
            322,
            50,
            crate::commands::action_context(
                crate::commands::ExecutionContext { timestamp: 50, ..crate::tests::context(deployment.games, 3) },
            ),
        );
    assert_eq!(map_relics(deployment).relic_discovery_time(3), 50);
}
#[test]
fn opening_a_chest_grants_its_stored_pack_once_and_replay_cannot_reopen_it() {
    let (deployment, home, explorer) = setup(true);
    let coord = chest(deployment, Coord { alt: false, x: 2000200, y: 2000200 }, 321, 40);
    move_fixture(deployment, explorer, crate::geometry::neighbor(coord, 0));
    let command = Command::OpenRelicChest(OpenChest { explorer_id: explorer.entity_id, coord });
    // Seed 321 draws an unlucky War pack: Damage I, Damage Reduction I and Stamina I, all army relics.
    assert_eq!(crate::relics::draw_chest(321), RelicChest { pack: RelicPack::War, lucky: false });
    let chest_id = IMapLogicDispatcher { contract_address: deployment.games }
        .occupancy(crate::geometry::tile_key(3, coord))
        .unwrap()
        .entity_id;
    assert_eq!(stored_chest(deployment, chest_id), Some(RelicChest { pack: RelicPack::War, lucky: false }));
    let points = crate::game::IPointsDispatcherTrait::player_points(
        crate::game::IPointsDispatcher { contract_address: deployment.games }, 3, deployment.actor,
    );
    assert!(execute(deployment, command, 50));
    assert_relics_granted(deployment, explorer, array![41, 43, 39].span());
    assert_relics_granted(deployment, home, array![].span());
    assert_eq!(
        crate::game::IPointsDispatcherTrait::player_points(
            crate::game::IPointsDispatcher { contract_address: deployment.games }, 3, deployment.actor,
        ),
        points + 77,
    );
    assert_eq!(stored_chest(deployment, chest_id), None);
    assert_terminal_rejection(deployment, command, 51);
    assert_relics_granted(deployment, explorer, array![41, 43, 39].span());
    assert!(
        IMapLogicDispatcher { contract_address: deployment.games }
            .occupancy(crate::geometry::tile_key(3, coord))
            .is_none(),
    );
}

#[test]
fn opening_pays_army_relics_to_the_army_and_structure_relics_to_its_home() {
    // Produce: Production, Labor Production and Troop Production all boost the home.
    assert_opening_pays(3, RelicChest { pack: RelicPack::Produce, lucky: false }, array![], array![51, 53, 55]);
    assert_opening_pays(16, RelicChest { pack: RelicPack::Produce, lucky: true }, array![], array![52, 54, 56]);
    // Fortress: Damage Reduction stays with the army; Structure Defense and Troop Production go home.
    assert_opening_pays(10, RelicChest { pack: RelicPack::Fortress, lucky: false }, array![43], array![49, 55]);
    assert_opening_pays(12, RelicChest { pack: RelicPack::Fortress, lucky: true }, array![44], array![50, 56]);
}

#[test]
#[feature("safe_dispatcher")]
fn relic_configuration_requires_authority_and_application_requires_owner() {
    let (deployment, _, explorer) = setup(false);
    let safe = IRelicsSafeDispatcher { contract_address: deployment.games };
    let registrar = crate::registrar::IRegistrarSafeDispatcher { contract_address: deployment.games };
    let mut preset = super::resource_commands::fixture_preset(super::play_fixture::rules());
    start_cheat_caller_address(deployment.games, deployment.actor);
    assert!(registrar.register_preset(20000, preset).is_err());
    stop_cheat_caller_address(deployment.games);
    let relics_before = balance(deployment, explorer, 39);
    let (release, commitment) = super::play_fixture::pins(deployment.games, 3);
    super::play_fixture::caller(deployment.games, deployment.actor, 100);
    start_cheat_caller_address(deployment.games, super::authority());
    let mut rejected = snforge_std::spy_events();
    assert!(
        super::play_fixture::IPlayFixtureSafeDispatcherTrait::play_with_root(
            super::play_fixture::IPlayFixtureSafeDispatcher { contract_address: deployment.games },
            3,
            release,
            commitment,
            super::play_fixture::encode(apply(explorer, 39, Recipient::Explorer)),
            987654321,
        )
            .is_err(),
    );
    assert_eq!(balance(deployment, explorer, 39), relics_before);
    assert_eq!(super::play_fixture::pins(deployment.games, 3), (release, commitment));
    assert!(
        snforge_std::EventsFilterTrait::emitted_by(
            @snforge_std::EventSpyTrait::get_events(ref rejected), deployment.games,
        )
            .events
            .is_empty(),
    );
    start_cheat_caller_address(deployment.games, super::authority());
    let games = crate::game::IGameDispatcher { contract_address: deployment.games };
    assert!(registrar.register_preset(games.game(3).preset_id, preset).is_err());
    preset.economy.relics = array![].span();
    assert!(registrar.register_preset(20000, preset).is_err());
    stop_cheat_caller_address(deployment.games);
    let _ = IRelicMapSafeDispatcher { contract_address: deployment.games };
    let _ = troop(deployment, explorer).coord;
    let _ = crate::relics::IRelicTroopsSafeDispatcher { contract_address: deployment.games };
    let _ = crate::relics::IRelicProductionSafeDispatcher { contract_address: deployment.games };
    start_cheat_caller_address(deployment.games, deployment.games);
    start_cheat_block_timestamp_global(40);
    assert!(
        safe
            .apply_relic(
                3,
                987.try_into().unwrap(),
                ApplyRelic { entity_id: explorer.entity_id, relic_id: 39, recipient: Recipient::Explorer },
                crate::commands::action_context(
                    ExecutionContext { timestamp: 40, ..super::context(deployment.games, 3) },
                ),
            )
            .is_err(),
    );
}

#[test]
fn pinned_draw_vectors_keep_the_crafting_weights_and_direction_retry_order() {
    assert_eq!(crate::relics::draw_relic(rules(), 12345), 39);
    assert_eq!(
        crate::relics::chest_destination(Coord { alt: false, x: 2000200, y: 2000200 }, 321, 12),
        Coord { alt: false, x: 2000199, y: 2000186 },
    );
}

#[test]
fn every_pack_and_its_lucky_roll_is_reachable_by_seed() {
    let cases = array![
        (4_u256, RelicPack::War, false, array![41_u8, 43, 39]), (1, RelicPack::War, true, array![42, 44, 40]),
        (2, RelicPack::Explore, false, array![45, 47, 39]), (30, RelicPack::Explore, true, array![46, 48, 40]),
        (3, RelicPack::Produce, false, array![51, 53, 55]), (16, RelicPack::Produce, true, array![52, 54, 56]),
        (10, RelicPack::Fortress, false, array![49, 43, 55]), (12, RelicPack::Fortress, true, array![50, 44, 56]),
    ];
    for (seed, pack, lucky, relics) in cases {
        let chest = crate::relics::draw_chest(seed);
        assert_eq!(chest, RelicChest { pack, lucky });
        assert_eq!(crate::relics::pack_relics(chest), relics.span());
    }
}

#[test]
fn packs_follow_their_odds_and_one_chest_in_five_is_lucky() {
    let (mut war, mut explore, mut produce, mut fortress, mut lucky) = (0_u32, 0_u32, 0_u32, 0_u32, 0_u32);
    for sample in 0_u64..10000 {
        let chest = crate::relics::draw_chest(0x5041434b + sample.into());
        match chest.pack {
            RelicPack::War => war += 1,
            RelicPack::Explore => explore += 1,
            RelicPack::Produce => produce += 1,
            RelicPack::Fortress => fortress += 1,
        }
        if chest.lucky {
            lucky += 1;
        }
    }
    // Each count sits within three standard deviations (at most 46) of its expectation.
    assert!(war >= 2860 && war <= 3140 && explore >= 2860 && explore <= 3140, "War or Explore off 30 percent");
    assert!(produce >= 2370 && produce <= 2630 && fortress >= 1390 && fortress <= 1610, "Produce or Fortress off");
    assert!(lucky >= 1880 && lucky <= 2120, "lucky chests off 20 percent");
    println!("10000 chests: War {} Explore {} Produce {} Fortress {} lucky {}", war, explore, produce, fortress, lucky);
}

#[test]
fn extraction_applies_active_boost_once_and_routes_eternum_rewards_to_the_explorer() {
    let (deployment, home, explorer) = setup(false);
    assert!(execute(deployment, apply(explorer, 48, Recipient::Explorer), 40));
    let before = balance(deployment, explorer, 2);
    let home_before = balance(deployment, home, 2);
    assert!(extract_reward(deployment, explorer.entity_id, 69));
    assert_eq!(balance(deployment, explorer, 2), before + 30 * RESOURCE_PRECISION);
    assert_eq!(balance(deployment, home, 2), home_before);
    assert!(extract_reward(deployment, explorer.entity_id, 70));
    assert_eq!(balance(deployment, explorer, 2), before + 30 * RESOURCE_PRECISION);
}
#[test]
fn extraction_after_bonus_expiry_routes_blitz_resources_to_home() {
    let (deployment, home, explorer) = setup(true);
    assert!(execute(deployment, apply(explorer, 48, Recipient::Explorer), 40));
    let before = balance(deployment, home, 2);
    assert!(extract_reward(deployment, explorer.entity_id, 70));
    assert_eq!(balance(deployment, home, 2), before + 10 * RESOURCE_PRECISION);
    assert_eq!(balance(deployment, explorer, 2), 0);
}
#[test]
fn blitz_relic_rewards_stay_with_the_explorer() {
    let (deployment, home, explorer) = setup_with_reward(true, 39, 1);
    let before = balance(deployment, explorer, 39);
    let home_before = balance(deployment, home, 39);
    assert!(extract_reward(deployment, explorer.entity_id, 40));
    assert_eq!(balance(deployment, explorer, 39), before + RESOURCE_PRECISION);
    assert_eq!(balance(deployment, home, 39), home_before);
}
#[test]
fn extraction_rejects_wrong_layer_dead_explorer_and_mismatched_tile() {
    let (deployment, _, explorer) = setup(false);
    let original = troop(deployment, explorer);
    move_fixture(deployment, explorer, Coord { alt: true, ..original.coord });
    assert!(!extract_reward(deployment, explorer.entity_id, 40));
    move_fixture(deployment, explorer, crate::geometry::neighbor(original.coord, 0));
    assert!(!extract_reward(deployment, explorer.entity_id, 40));
    crate::tests::resource_commands::set_explorer_fixture(
        deployment.games,
        crate::troops::ExplorerKey { game_id: 3, explorer_id: explorer.entity_id },
        crate::troops::ExplorerTroops { troops: crate::troops::Troops { count: 0, ..original.troops }, ..original },
    );
    assert!(!extract_reward(deployment, explorer.entity_id, 40));
    crate::tests::resource_commands::set_explorer_fixture(
        deployment.games, crate::troops::ExplorerKey { game_id: 3, explorer_id: explorer.entity_id }, original,
    );
    assert!(extract_reward(deployment, explorer.entity_id, 40));
}

#[test]
fn an_explore_action_discovers_a_chest_while_eternum_does_not() {
    let (deployment, home, explorer) = setup(true);
    grant(deployment, home, 35, 1000 * RESOURCE_PRECISION);
    grant(deployment, home, 36, 1000 * RESOURCE_PRECISION);
    assert!(
        execute(
            deployment,
            Command::Explore(crate::commands::Explore { explorer_id: explorer.entity_id, direction: 0 }),
            40,
        ),
    );
    assert_eq!(map_relics(deployment).relic_discovery_time(3), 40);
    let (eternum, _, _) = setup(false);
    chest(eternum, Coord { alt: false, x: 2000200, y: 2000200 }, 321, 40);
    assert_eq!(map_relics(eternum).relic_discovery_time(3), 0);
}

#[test]
fn chest_rejections_leave_the_chest_and_points_untouched() {
    let (deployment, _, explorer) = setup(true);
    let coord = chest(deployment, Coord { alt: false, x: 2000200, y: 2000200 }, 321, 40);
    let command = Command::OpenRelicChest(OpenChest { explorer_id: explorer.entity_id, coord });
    let map = IMapLogicDispatcher { contract_address: deployment.games };
    let key = crate::geometry::tile_key(3, coord);
    let before = map.tile(key);
    assert_terminal_rejection(deployment, command, 40);
    assert_eq!(map.tile(key), before);
    move_fixture(deployment, explorer, crate::geometry::neighbor(coord, 0));
    assert_terminal_rejection(
        deployment,
        Command::OpenRelicChest(
            OpenChest { explorer_id: explorer.entity_id, coord: crate::geometry::neighbor(coord, 1) },
        ),
        40,
    );
    assert_eq!(map.tile(key), before);
    assert!(execute(deployment, command, 40));
}

#[test]
#[feature("safe_dispatcher")]
fn extraction_requires_immutable_authorized_configuration() {
    let (deployment, _, explorer) = setup(false);
    let registrar = crate::registrar::IRegistrarSafeDispatcher { contract_address: deployment.games };
    let mut preset = super::resource_commands::fixture_preset(super::play_fixture::rules());
    let rewards = array![ExplorationReward { resource_type: 2, percent: 10, percent_max: 10, weight: 1 }].span();
    preset.exploration = rewards;
    start_cheat_caller_address(deployment.games, deployment.actor);
    assert!(registrar.register_preset(20000, preset).is_err());
    start_cheat_caller_address(deployment.games, super::authority());
    preset.exploration = array![].span();
    assert!(registrar.register_preset(20000, preset).is_err());
    preset.exploration = rewards;
    assert!(registrar.register_preset(20000, preset).is_ok());
    assert!(registrar.register_preset(20000, preset).is_err());
    stop_cheat_caller_address(deployment.games);
    assert!(extract_reward(deployment, explorer.entity_id, 40));
}

#[test]
fn exploration_grants_a_surface_reward_atomically_and_extraction_cannot_pay_twice() {
    for blitz in array![true, false] {
        let (deployment, home, explorer) = setup(blitz);
        grant(deployment, home, 35, 1000 * RESOURCE_PRECISION);
        grant(deployment, home, 36, 1000 * RESOURCE_PRECISION);
        let recipient = if blitz {
            home
        } else {
            explorer
        };
        let before = balance(deployment, recipient, 2);
        assert!(
            execute(
                deployment,
                Command::Explore(crate::commands::Explore { explorer_id: explorer.entity_id, direction: 0 }),
                40,
            ),
        );
        assert_eq!(balance(deployment, recipient, 2), before + 10 * RESOURCE_PRECISION);
        assert!(extract_reward(deployment, explorer.entity_id, 41));
        assert_eq!(balance(deployment, recipient, 2), before + 10 * RESOURCE_PRECISION);
    }
}

#[test]
fn chest_search_skips_the_explorers_vacated_start_tile() {
    let (deployment, _, _) = setup(true);
    let origin = Coord { alt: false, x: 2000200, y: 2000200 };
    let vacated = crate::relics::chest_destination(origin, 321, 12);
    start_cheat_block_timestamp_global(40);
    start_cheat_caller_address(deployment.games, deployment.games);
    map_relics(deployment)
        .discover_relic_chest(
            3,
            1,
            origin,
            vacated,
            321,
            40,
            crate::commands::action_context(
                crate::commands::ExecutionContext { timestamp: 40, ..crate::tests::context(deployment.games, 3) },
            ),
        );
    let map = IMapLogicDispatcher { contract_address: deployment.games };
    assert!(map.tile(crate::geometry::tile_key(3, vacated)).is_none());
    let _tile = map.tile(crate::geometry::tile_key(3, crate::geometry::neighbor(vacated, 0))).unwrap();
    assert_eq!(
        map.occupancy(crate::geometry::tile_key(3, crate::geometry::neighbor(vacated, 0))).unwrap().category, 34,
    );
}

#[test]
fn different_launch_seeds_cannot_change_the_same_stamped_chest_draw() {
    assert_eq!(opened_contents_with_launch_seed(1), opened_contents_with_launch_seed(999));
}

#[test]
fn exploration_relics_pay_the_full_window_and_replace_on_reapplication() {
    for replace in array![false, true] {
        for at_end in array![false, true] {
            let (deployment, _, explorer) = setup(false);
            assert!(execute(deployment, apply(explorer, 48, Recipient::Explorer), 47));
            let (end, reward) = if replace {
                assert!(execute(deployment, apply(explorer, 47, Recipient::Explorer), 52));
                (82_u64, 20_u128)
            } else {
                (77_u64, 30_u128)
            };
            let now = if at_end {
                end
            } else {
                end - 1
            };
            assert!(extract_reward(deployment, explorer.entity_id, now));
            assert_eq!(balance(deployment, explorer, 2), (if at_end {
                10
            } else {
                reward
            }) * RESOURCE_PRECISION);
        }
    }
}
