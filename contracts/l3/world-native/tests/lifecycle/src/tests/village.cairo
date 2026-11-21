pub use world_test_support::tests::village::*;

#[test]
fn a_founded_realm_castle_uses_no_population_even_where_labor_buildings_cost_it() {
    assert!(*crate::balance::structures::BUILDINGS.span().at(24).population_cost != 0);
    let deployment = season_world();
    let realm = ResourceKey { game_id: 3, entity_id: settle_season_realm(deployment) };
    let structures = IStructureOperationsDispatcher { contract_address: deployment.games };
    assert!(structures.structure_buildings(realm).packed_counts_2 > 0);
    assert_eq!(structures.structure_buildings(realm).population.current, 0);
}

#[test]
fn season_settlement_of_a_held_realm_takes_its_traits_and_provisions_its_economy() {
    let deployment = season_world();
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
}

#[test]
fn season_entitlement_with_missing_operator_and_missing_pass() {
    assert_season_entitlement_mode(false, false);
}
#[test]
fn season_entitlement_with_missing_operator_and_present_pass() {
    assert_season_entitlement_mode(false, true);
}
#[test]
fn season_entitlement_with_configured_operator_and_missing_pass() {
    assert_season_entitlement_mode(true, false);
}
#[test]
fn season_entitlement_with_configured_operator_and_present_pass() {
    assert_season_entitlement_mode(true, true);
}
