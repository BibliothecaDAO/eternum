pub use world_test_support::tests::mines::*;

#[test]
fn a_mine_draw_takes_its_kind_from_the_release_surface_pool_and_its_cap_from_that_kind() {
    let deployment = super::setup_with_domains(true, "StructuresLogic", "TroopsLogic");
    let rules = IMineRulesDispatcher { contract_address: deployment.games };
    let pool = crate::balance::resources::SURFACE_MINES.span();
    for root in 0_u64..32 {
        let seed = root.into();
        let (kind, config, amount) = rules.mine_draw(MinePoolKey { game_id: 1 }, seed);
        assert_eq!(kind, select_kind(pool, seed));
        assert_eq!(config, *crate::balance::resources::MINE_KINDS.span().at(kind.into() - 1));
        assert_eq!(config, rules.mine_kind(MineKindKey { game_id: 1, kind }));
        assert_eq!(amount, cap(config, seed));
    }
}

#[test]
fn fragment_cap_is_the_original_ten_step_draw_and_rift_cap_is_fixed() {
    let fragment = (*kinds().at(1)).config;
    let rift = (*kinds().at(0)).config;
    let mut seen = 0_u16;
    for root in 0_u64..128 {
        let seed = root.into();
        let expected = 1 + crate::random::range(seed, 124, 10);
        let amount = cap(fragment, seed);
        assert_eq!(amount, 300000 * RESOURCE_PRECISION * expected);
        assert!(amount >= fragment.cap_min && amount <= 10 * fragment.cap_min);
        let mut bit = 1_u16;
        for _ in 1..expected {
            bit *= 2;
        }
        if seen / bit % 2 == 0 {
            seen += bit;
        }
        assert_eq!(cap(rift, seed), 36000 * RESOURCE_PRECISION);
    }
    assert_eq!(seen, 1023);
    let custom = MineKindConfig { cap_min: 17, cap_steps: 3, ..rift };
    for root in 0_u64..32 {
        let amount = cap(custom, root.into());
        assert!(amount == 17 || amount == 34 || amount == 51);
    }
}

#[test]
fn pool_weights_use_one_draw_across_the_complete_distribution() {
    let weights = array![MineWeight { kind: 1, weight: 3 }, MineWeight { kind: 2, weight: 7 }].span();
    for root in 0_u64..64 {
        let seed = root.into();
        let roll = crate::random::range(seed, 'MINE_KIND', 10);
        assert_eq!(select_kind(weights, seed), if roll < 3 {
            1
        } else {
            2
        });
    }
}

#[test]
fn discovered_surface_mines_use_kind_production_without_revealing_neighbors() {
    let (deployment, _, _) = super::resource_commands::setup_with_preset(
        super::resource_commands::fixture_preset(super::play_fixture::rules()),
    );
    let mine_rules = IMineRulesDispatcher { contract_address: deployment.games };
    start_cheat_caller_address(deployment.games, deployment.games);
    let structures = IStructureOperationsDispatcher { contract_address: deployment.games };
    let resources = IResourceOperationsDispatcher { contract_address: deployment.games };
    let map = IMapLogicDispatcher { contract_address: deployment.games };
    let guard_types = array![
        TroopType::Crossbowman, TroopType::Knight, TroopType::Crossbowman, TroopType::Paladin, TroopType::Crossbowman,
        TroopType::Crossbowman, TroopType::Crossbowman, TroopType::Crossbowman, TroopType::Knight, TroopType::Knight,
        TroopType::Paladin, TroopType::Crossbowman,
    ];
    let mut seen = 0_u8;
    for index in 0_u32..12 {
        let coord = Coord { alt: false, x: 2000100 + index * 10, y: 2000100 };
        let seed: u256 = index.into();
        let (kind, config, cap) = mine_rules.mine_draw(MinePoolKey { game_id: 3 }, seed);
        let id = structures
            .create_discovery(
                3,
                1,
                coord,
                crate::discovery::Discovery::Mine,
                seed,
                30,
                crate::commands::action_context(
                    crate::commands::ExecutionContext { timestamp: 30, ..crate::tests::context(deployment.games, 3) },
                ),
            );
        let structure = structures.structure(ResourceKey { game_id: 3, entity_id: id }).unwrap();
        assert_eq!(structure.metadata.mine_kind, kind);
        assert_eq!(structure.base.category, 4);
        assert_eq!(structures.position(ResourceKey { game_id: 3, entity_id: id }).unwrap(), coord);
        assert_eq!(
            crate::guards::IGuardsDispatcherTrait::guard(
                crate::guards::IGuardsDispatcher { contract_address: deployment.games },
                crate::guards::GuardKey { game_id: 3, structure_id: id, slot: 0 },
            )
                .troops
                .category,
            *guard_types.at(index),
        );
        assert_eq!(
            crate::guards::IGuardsDispatcherTrait::guard(
                crate::guards::IGuardsDispatcher { contract_address: deployment.games },
                crate::guards::GuardKey { game_id: 3, structure_id: id, slot: 0 },
            )
                .troops
                .tier,
            TroopTier::T1,
        );
        for slot in 1_u8..4 {
            assert_eq!(
                crate::guards::IGuardsDispatcherTrait::guard(
                    crate::guards::IGuardsDispatcher { contract_address: deployment.games },
                    crate::guards::GuardKey { game_id: 3, structure_id: id, slot },
                ),
                Default::default(),
            );
        }
        let production = resources
            .resource_production(ResourceSlot { game_id: 3, entity_id: id, resource_type: config.resource_type });
        assert_eq!(production.production_rate, config.production_rate);
        assert_eq!(production.output_amount_left, cap);
        assert_eq!(production.building_count, 1);
        // Discovered at time 30, with no production before that second.
        assert_eq!(production.last_settled_at, 30);
        assert!(map.tile(crate::geometry::tile_key(3, coord)).is_some());
        for direction in 0_u8..6 {
            assert!(map.tile(crate::geometry::tile_key(3, crate::geometry::neighbor(coord, direction))).is_none());
        }
        seen = seen | if kind == 1 {
            1
        } else {
            2
        };
    }
    let mut pool = 0_u8;
    for entry in crate::balance::resources::SURFACE_MINES.span() {
        pool = pool | if *entry.kind == 1 {
            1
        } else {
            2
        };
    }
    assert_eq!(seen, pool);
    stop_cheat_caller_address(deployment.games);
}

#[test]
fn ethereal_discovery_never_draws_from_the_ordinary_mine_pool() {
    let d = super::setup(true);
    let game = IGameDispatcher { contract_address: d.games };
    let mut rules = super::play_fixture::rules();
    rules.map_config.shards_mines_win_probability = 1;
    rules.map_config.shards_mines_fail_probability = 0;
    let mut preset = super::play_fixture::fixture_preset(rules);
    preset.resources.surface_mines = surface();
    super::play_fixture::seed_game_with_preset(d.games, 3, game.game(1), preset);
    let map = IMapLogicDispatcher { contract_address: d.games };
    for root in 0_u64..8 {
        assert_eq!(
            map
                .discovery(
                    crate::map::TileKey { game_id: 3, alt: true, col: 2000100, row: 2000100 },
                    root.into(),
                    30,
                    crate::commands::action_context(
                        crate::commands::ExecutionContext { timestamp: 30, ..crate::tests::context(d.games, 3) },
                    ),
                ),
            crate::discovery::Discovery::None,
        );
    }
}
