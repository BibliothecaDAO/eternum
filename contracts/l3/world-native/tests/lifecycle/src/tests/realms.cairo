pub use world_test_support::tests::realms::*;


#[test]
#[feature("safe_dispatcher")]
fn catalogue_appends_once_and_commits_ordered_contents() {
    let pool = fixture();
    let safe = IRealmPoolFixtureSafeDispatcher { contract_address: pool.contract_address };
    let first = 0x4000003_u32;
    let second = 0x9000002_u32;
    assert!(safe.traits(1).is_err());
    assert!(safe.initialize(2, array![first].span()).is_err());
    let mut spy = spy_events();
    pool.initialize(1, array![first].span());
    assert!(safe.initialize(1, array![second].span()).is_err());
    pool.initialize(2, array![second].span());
    let prefix = core::poseidon::poseidon_hash_span(array![0, 1, first.into()].span());
    let digest = core::poseidon::poseidon_hash_span(array![prefix, 2, second.into()].span());
    assert!(pool.catalogue() == RealmCatalogue { initialized: 2, digest });
    let events = spy.get_events().emitted_by(pool.contract_address);
    assert_eq!(events.events.len(), 2);
    for (_, event) in events.events {
        assert_eq!(event.keys.span(), array![selector!("RowSet"), 1, 'RealmTraits'].span());
    }
    assert!(safe.traits(1).is_err());
}

#[test]
#[feature("safe_dispatcher")]
fn sparse_allocation_removes_the_moved_tail_and_is_game_scoped() {
    let pool = fixture();
    let safe = IRealmPoolFixtureSafeDispatcher { contract_address: pool.contract_address };
    pool.reserve(1, 2, 0);
    assert!(pool.available(1, 1, 1) == 8000);
    pool.reserve(1, 8000, 1);
    assert!(pool.available(1, 1, 2) == 7999);
    assert!(pool.available(2, 1, 0) == 2);
    assert!(safe.reserve(1, 2, 2).is_err());
    assert!(safe.reserve(1, 8000, 2).is_err());
    assert!(safe.reserve(1, 0, 2).is_err());
    assert!(safe.reserve(1, 8001, 2).is_err());
    assert!(safe.available(1, 7998, 2).is_err());
}

#[test]
fn packed_traits_and_entitlement_keep_ordered_resources() {
    let packed = crate::realms::decode_traits(0x9000002);
    assert!(packed.wonder == 2 && packed.order == 5 && packed.resources == array![2_u8].span());
    let traits = crate::realms::decode_entitlement(0x0103070402020302010009);
    assert!(traits.wonder == 1 && traits.order == 3 && traits.resources == array![2_u8, 4, 7].span());
}

#[test]
#[feature("safe_dispatcher")]
fn only_deployment_authority_can_append_canonical_traits() {
    let deployment = super::setup(true);
    let safe = crate::realms::ISeasonRealmsSafeDispatcher { contract_address: deployment.games };
    snforge_std::start_cheat_caller_address(deployment.games, deployment.actor);
    assert!(
        crate::realms::ISeasonRealmsSafeDispatcherTrait::initialize_realm_traits(safe, 1, array![0x4000003].span())
            .is_err(),
    );
    snforge_std::start_cheat_caller_address(deployment.games, super::authority());
    crate::realms::ISeasonRealmsSafeDispatcherTrait::initialize_realm_traits(safe, 1, array![0x4000003].span())
        .unwrap();
    let result = crate::realms::ISeasonRealmsSafeDispatcherTrait::realm_catalogue(safe).unwrap();
    assert!(result.initialized == 1);
}

#[test]
#[feature("safe_dispatcher")]
fn forged_season_commands_cannot_allocate_or_place_realms() {
    // Authorization belongs to the production Games surface, not the library-call fixture host.
    let deployment = super::setup_with_host(true, "StructuresLogic", "TroopsLogic", "Games");
    let before = super::play_fixture::gameplay_snapshot(deployment.games);
    let season = crate::realms::ISeasonRealmsSafeDispatcher { contract_address: deployment.games };
    snforge_std::start_cheat_caller_address(deployment.games, deployment.actor);
    assert!(
        crate::realms::ISeasonRealmsSafeDispatcherTrait::settle_season(
            season,
            1,
            deployment.actor,
            crate::realms::SettleSeason { name: 'forged', selected_realm: Option::None },
            crate::commands::action_context(super::context(deployment.games, 1)),
        )
            .is_err(),
    );
    let map = crate::realms::ISeasonPlacementSafeDispatcher { contract_address: deployment.games };
    snforge_std::start_cheat_caller_address(deployment.games, deployment.actor);
    assert!(
        crate::realms::ISeasonPlacementSafeDispatcherTrait::claim_season_settlement(
            map, 1, 0, 123, crate::tests::map_center(deployment.games, 1),
        )
            .is_err(),
    );
    assert_eq!(super::play_fixture::gameplay_snapshot(deployment.games), before);
}
