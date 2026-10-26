pub use world_test_support::tests::village::*;


#[test]
#[feature("safe_dispatcher")]
fn production_pass_is_atomic_single_use_and_army_grant_uses_block_time() {
    let (deployment, realm) = setup(false);
    let ledger = IVillagesSafeDispatcher { contract_address: deployment.games };
    let pass = VillagePassKey { game_id: 3, pass_id: 7 };
    assert!(!run(deployment, settle(realm, 7), 100));
    assert!(ledger.village_pass(pass).unwrap().is_none());
    start_cheat_caller_address(deployment.games, deployment.actor);
    assert!(ledger.register_village_pass(pass, deployment.actor).is_err());
    start_cheat_caller_address(deployment.games, authority());
    ledger.register_village_pass(pass, deployment.actor).unwrap();
    assert!(ledger.register_village_pass(pass, 0x333.try_into().unwrap()).is_err());
    stop_cheat_caller_address(deployment.games);
    let realm_map = IMapLogicDispatcher { contract_address: deployment.games };
    for direction in 0_u8..6 {
        let neighbor = crate::geometry::neighbor(Coord { alt: false, x: 2000000, y: 2000000 }, direction);
        let tile = realm_map.tile(crate::geometry::tile_key(3, neighbor)).unwrap();
        assert!(realm_map.occupancy(crate::geometry::tile_key(3, neighbor)).is_none());
        assert!(tile.data / 0x20000000000 % 256 != 0, "realm neighbour biome missing");
    }
    let pools = ISettlementPoolDispatcher { contract_address: deployment.games };
    let before = pools.village_pool(3, crate::tests::map_center(deployment.games, 3));
    assert!(!run(deployment, settle(0xffffffff, 7), 100));
    assert!(ledger.village_pass(pass).unwrap().unwrap().village_id == 0);
    assert!(
        pools.village_pool(3, crate::tests::map_center(deployment.games, 3)) == before,
        "failed placement retained reservations",
    );
    assert!(run(deployment, settle(realm, 7), 100));
    let village_id = ledger.village_pass(pass).unwrap().unwrap().village_id;
    let structures = IStructureOperationsDispatcher { contract_address: deployment.games };
    let resource_store = IResourceOperationsDispatcher { contract_address: deployment.games };
    let key = ResourceKey { game_id: 3, entity_id: village_id };
    let village = structures.structure(key).unwrap();
    assert!(village.base.category == 5 && village.metadata.village_realm == realm);
    assert!(village.owner == deployment.actor && !village.base.starting_troops_granted);
    let coord = structures.position(key).unwrap();
    assert!(coord.x != 2000000 || coord.y != 2000000);
    assert!(
        resource_store
            .resource_production(ResourceSlot { game_id: 3, entity_id: village_id, resource_type: 23 })
            .production_rate > 0,
    );
    let map = IMapLogicDispatcher { contract_address: deployment.games };
    for direction in 0_u8..6 {
        let tile = map.tile(crate::geometry::tile_key(3, crate::geometry::neighbor(coord, direction))).unwrap();
        assert!(map.occupancy(crate::geometry::tile_key(3, crate::geometry::neighbor(coord, direction))).is_none());
        assert!(tile.data / 0x20000000000 % 256 != 0, "neighbour biome missing");
    }
    assert!(
        crate::game::IPointsDispatcher { contract_address: deployment.games }.player_points(3, deployment.actor) == 0,
    );
    assert!(!run(deployment, settle(realm, 7), 100));
    assert!(!run(deployment, Command::ReceiveVillageArmy(village_id), 100));
    let interval = play_fixture::rules().tick_config.armies_tick_in_seconds;
    let claimable_at = (100 / interval + 2) * interval;
    let mut spy = spy_events();
    assert!(run(deployment, Command::ReceiveVillageArmy(village_id), claimable_at));
    let mut guard_stories = 0;
    for (_, event) in spy.get_events().emitted_by(deployment.games).events.span() {
        if *event.keys.at(0) == selector!("StoryEvent") {
            let mut data = event.data.span();
            let story: crate::ownership::Story = Serde::deserialize(ref data).unwrap();
            if let crate::ownership::Story::GuardAddStory(guard) = story {
                assert_eq!(guard.structure_id, village_id);
                assert_eq!(guard.slot, 0);
                assert_eq!(guard.amount, 10 * crate::rules::RESOURCE_PRECISION);
                guard_stories += 1;
            }
        }
    }
    assert_eq!(guard_stories, 1);
    let granted = structures.structure(key).unwrap();
    assert!(granted.base.starting_troops_granted);
    assert!(
        crate::guards::IGuardsDispatcherTrait::guard(
            crate::guards::IGuardsDispatcher { contract_address: deployment.games },
            crate::guards::GuardKey { game_id: 3, structure_id: village_id, slot: 0 },
        )
            .troops
            .count == 10
            * crate::rules::RESOURCE_PRECISION,
    );
    assert!(!run(deployment, Command::ReceiveVillageArmy(village_id), claimable_at));
}

#[test]
fn development_villages_skip_passes_and_have_no_six_per_realm_limit() {
    let (deployment, realm) = setup(true);
    for _ in 0..7_u8 {
        assert!(run(deployment, settle(realm, 0), 100));
    }
    let ledger = IVillagesDispatcher { contract_address: deployment.games };
    assert!(ledger.village_pass(VillagePassKey { game_id: 3, pass_id: 0 }).is_none());
}

#[test]
fn triple_village_consumes_one_pass_and_leaves_both_entries_available() {
    assert_blitz_village(SettlementMode::Triple);
}

#[test]
fn duel_village_consumes_one_pass_and_leaves_both_entries_available() {
    assert_blitz_village(SettlementMode::Duel);
}

#[test]
fn exhausted_geometry_records_rejection_and_keeps_the_pass() {
    let (deployment, realm) = setup_config(
        false,
        SettlementMode::Single,
        crate::rules::SliceRules { map_center_offset: 2147483646, ..play_fixture::rules() },
    );
    let pass = register_pass(deployment, 9);
    let mut rejection_spy = spy_events();
    assert!(!run(deployment, settle(realm, 9), 100));
    let ledger = IVillagesDispatcher { contract_address: deployment.games };
    assert!(ledger.village_pass(pass).unwrap().village_id == 0);
    let pool = ISettlementPoolDispatcher { contract_address: deployment.games };
    assert!(
        pool.village_pool(3, crate::tests::map_center(deployment.games, 3)).opened == 0
            && pool.settlement_pool(3, crate::tests::map_center(deployment.games, 3)).opened == 0,
    );
    let result = super::play_fixture::rejection(ref rejection_spy, deployment.games);
    assert!(result.status_class == 'GAMEPLAY_REJECTED');
    assert_eq!(result.reason, "settlement geometry exhausted");
}

#[test]
fn a_founded_realm_castle_uses_no_population_even_where_labor_buildings_cost_it() {
    let mut preset = village_preset(SettlementMode::Single, play_fixture::rules());
    let mut buildings = array![];
    for building in preset.structures.buildings {
        buildings
            .append(
                if *building.category == 25 {
                    crate::buildings::BuildingRuleConfig {
                        rule: crate::buildings::BuildingRule { population_cost: 2, ..*building.rule }, ..*building,
                    }
                } else {
                    *building
                },
            );
    }
    preset.structures.buildings = buildings.span();
    let deployment = season_world(true, preset);

    let realm = ResourceKey { game_id: 3, entity_id: settle_season_realm(deployment) };
    let structures = IStructureOperationsDispatcher { contract_address: deployment.games };
    assert!(structures.structure_buildings(realm).packed_counts_2 > 0);
    assert_eq!(structures.structure_buildings(realm).population.current, 0);
}

#[test]
fn season_settlement_random_draw_reserves_realm_and_provisions_its_economy() {
    let deployment = season_world(true, village_preset(SettlementMode::Single, play_fixture::rules()));
    let id = settle_season_realm(deployment);
    let key = ResourceKey { game_id: 3, entity_id: id };
    let row = IStructureOperationsDispatcher { contract_address: deployment.games }.structure(key).unwrap();
    assert_eq!(row.metadata.realm_id, 3492);
    assert_eq!(row.metadata.order, 5);
    assert!(row.metadata.has_wonder);
    assert_eq!(row.owner, deployment.actor);
    assert_eq!(row.base.level, 0);
    assert!(row.base.starting_troops_granted);
    assert!(
        IResourceOperationsDispatcher { contract_address: deployment.games }
            .resource_production(ResourceSlot { game_id: 3, entity_id: id, resource_type: 23 })
            .production_rate > 0,
    );
    assert_eq!(
        crate::realms::ISeasonRealmsDispatcherTrait::available_realm(
            crate::realms::ISeasonRealmsDispatcher { contract_address: deployment.games }, 3, 3491,
        ),
        8000,
    );
}

#[test]
fn real_season_entitlement_with_missing_operator_and_missing_pass() {
    assert_season_entitlement_mode(false, false, false);
}
#[test]
fn real_season_entitlement_with_missing_operator_and_present_pass() {
    assert_season_entitlement_mode(false, false, true);
}
#[test]
fn real_season_entitlement_with_configured_operator_and_missing_pass() {
    assert_season_entitlement_mode(false, true, false);
}
#[test]
fn real_season_entitlement_with_configured_operator_and_present_pass() {
    assert_season_entitlement_mode(false, true, true);
}
#[test]
fn dev_season_entitlement_with_missing_operator_and_missing_pass() {
    assert_season_entitlement_mode(true, false, false);
}
#[test]
fn dev_season_entitlement_with_missing_operator_and_present_pass() {
    assert_season_entitlement_mode(true, false, true);
}
#[test]
fn dev_season_entitlement_with_configured_operator_and_missing_pass() {
    assert_season_entitlement_mode(true, true, false);
}
#[test]
fn dev_season_entitlement_with_configured_operator_and_present_pass() {
    assert_season_entitlement_mode(true, true, true);
}
