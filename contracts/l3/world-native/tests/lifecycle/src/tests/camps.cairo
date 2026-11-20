pub use world_test_support::tests::camps::*;

#[test]
fn camp_lottery_obeys_discoverable_rules_after_mines() {
    let mut config = rules(true).map_config;
    for seed in 0_u64..32 {
        assert_eq!(surface(config, seed.into(), crate::rules::DISCOVER_CAMPS), Discovery::Camp);
        assert_eq!(surface(config, seed.into(), 0), Discovery::None);
    }
    config.camp_win_probability = 3;
    config.camp_fail_probability = 7;
    for seed in 0_u64..32 {
        let won = crate::random::lottery(seed.into(), 7, 3, 7);
        assert_eq!(
            surface(config, seed.into(), crate::rules::DISCOVER_CAMPS),
            if won {
                Discovery::Camp
            } else {
                Discovery::None
            },
        );
    }
    config.shards_mines_win_probability = 1;
    config.shards_mines_fail_probability = 0;
    assert_eq!(surface(config, 101, crate::rules::DISCOVER_CAMPS), Discovery::Mine);
}
#[test]
fn a_camp_produces_labor_at_the_camp_rate_not_the_village_rate() {
    let (d, _, _) = super::resource_commands::setup_with_preset(camp_preset(true));
    let key = create(d, coord());
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let camp_rate = crate::balance::structures::CAMP_LABOR_RATE;
    assert!(resources.resource_rule(crate::resources::LABOR).village_rate != camp_rate);
    let slot = ResourceSlot { game_id: 3, entity_id: key.entity_id, resource_type: crate::resources::LABOR };
    assert_eq!(resources.resource_production(slot).production_rate, camp_rate);
}
#[test]
fn camp_reveals_six_biomes_without_neighbor_lotteries_or_points() {
    let (d, _) = setup(true);
    let key = create(d, coord());
    let map = IMapLogicDispatcher { contract_address: d.games };
    assert_eq!(map.occupancy(tile_key(3, coord())).unwrap().category, crate::taxonomy::CAMP_OCCUPIER);
    for direction in 0_u8..6 {
        let tile = map.tile(tile_key(3, neighbor(coord(), direction))).unwrap();
        assert!(map.occupancy(tile_key(3, neighbor(coord(), direction))).is_none());
        assert!((tile.data / 0x20000000000) % 256 != 0);
    }
    assert_eq!(key.game_id, 3);
}
#[test]
#[feature("safe_dispatcher")]
fn camp_presets_need_authority_known_resources_and_a_new_id() {
    let (d, _, _) = setup_with_rules(rules(true));
    let registrar = crate::registrar::IRegistrarSafeDispatcher { contract_address: d.games };
    let mut preset = super::resource_commands::fixture_preset(rules(true));
    preset.structures.camps.resources = array![].span();
    start_cheat_caller_address(d.games, d.actor);
    assert!(registrar.register_preset(20000, preset).is_err());
    start_cheat_caller_address(d.games, super::authority());
    let mut invalid = preset;
    invalid.structures.camps.resources = array![ResourceAmount { resource_type: 99, amount: 1 }].span();
    assert!(registrar.register_preset(20000, invalid).is_err());
    assert!(registrar.register_preset(20000, preset).is_ok());
    assert!(registrar.register_preset(20000, preset).is_err());
    stop_cheat_caller_address(d.games);
}

#[test]
fn eternum_exploration_does_not_create_a_camp() {
    let (d, home) = setup(false);
    for resource in array![26_u8, 35, 36] {
        grant(d, home, resource, 100 * RESOURCE_PRECISION);
    }
    assert!(
        execute(
            d,
            Command::CreateExplorer(
                CreateExplorer {
                    slot: 0,
                    structure_id: home.entity_id,
                    category: 0,
                    tier: 0,
                    amount: RESOURCE_PRECISION,
                    direction: 0,
                },
            ),
            80,
        ),
    );
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let explorer_id = *structures.home_armies(home).at(0);
    let key = ExplorerKey { game_id: 3, explorer_id };
    let troops = GameState { contract_address: d.games };
    let destination = neighbor(troops.explorer(key).unwrap().coord, 0);
    assert!(execute(d, Command::Explore(Explore { explorer_id, direction: 0 }), 140));
    let _tile = IMapLogicDispatcher { contract_address: d.games }.tile(tile_key(3, destination)).unwrap();
    let occupant = IMapLogicDispatcher { contract_address: d.games }.occupancy(tile_key(3, destination)).unwrap();
    assert!(!occupant.is_structure);
    assert_eq!(occupant.entity_id, explorer_id);
    assert_eq!(troops.explorer(key).unwrap().coord, destination);
    assert!(snforge_std::interact_with_state(d.games, || crate::logic::progression::read(key)).is_none());
}

