use eternum_randomness_protocol::entrypoint::{
    ExecutionContext, IRecordedExecutionDispatcher, IRecordedExecutionDispatcherTrait,
    IRecordedExecutionViewsDispatcher, IRecordedExecutionViewsDispatcherTrait,
};
use eternum_randomness_protocol::{Envelope, action_identity, encode_envelope};
use snforge_std::signature::SignerTrait;
use snforge_std::signature::stark_curve::StarkCurveSignerImpl;
use snforge_std::{EventSpyTrait, EventsFilterTrait, interact_with_state, spy_events, start_cheat_caller_address};
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
use crate::game::{IGameDispatcher, IGameDispatcherTrait};
use crate::games::{IGamesAuthenticationDispatcher, IGamesAuthenticationDispatcherTrait};
use crate::logic::release::{
    IReleasesDispatcher, IReleasesDispatcherTrait, IReleasesSafeDispatcher, IReleasesSafeDispatcherTrait, Release,
};
use crate::registrar::{CreateGameParams, IRegistrarDispatcher, IRegistrarDispatcherTrait};
use crate::resources::{ResourceKey, ResourceSlot};
use crate::tests::state::{
    GameState, MapObservationTrait, ResourceObservationTrait, StructureObservationTrait, TroopObservationTrait,
};
use crate::troops::ExplorerKey;
use super::recorded_receipts::RecordedReceiptsTrait;
use super::{authority, declare_logic};

#[starknet::contract]
mod ReleaseMigrationFixture {
    #[storage]
    struct Storage {}

    #[abi(embed_v0)]
    impl Migration of crate::logic::release::IReleaseMigration<ContractState> {
        fn migrate(ref self: ContractState, game_id: u32, previous_release: u32, release_id: u32) {
            assert!(release_id == previous_release + 1, "unexpected migration route");
            let mut game = crate::logic::game::game(game_id);
            game.seed += if release_id == 2 {
                1
            } else {
                10
            };
            crate::logic::game::write_game(game_id, game);
        }
    }
}

#[starknet::contract]
mod FailingReleaseMigrationFixture {
    #[storage]
    struct Storage {}

    #[abi(embed_v0)]
    impl Migration of crate::logic::release::IReleaseMigration<ContractState> {
        fn migrate(ref self: ContractState, game_id: u32, previous_release: u32, release_id: u32) {
            let mut game = crate::logic::game::game(game_id);
            game.seed += 1;
            crate::logic::game::write_game(game_id, game);
            panic!("migration failed");
        }
    }
}

#[test]
#[feature("safe_dispatcher")]
fn fresh_shard_uses_the_published_release_without_running_its_upgrade_migration() {
    let d = super::registrar::setup();
    let authentication = IGamesAuthenticationDispatcher { contract_address: d.games }.authentication();
    let release = Release {
        migration: declare_logic("FailingReleaseMigrationFixture"),
        ..IReleasesDispatcher { contract_address: d.games }.release(1),
    };
    let mut args = array![authority().into()];
    authentication.serialize(ref args);
    args.append(7);
    release.serialize(ref args);
    let (games, _) = super::deploy("Games", @args);
    let releases = IReleasesDispatcher { contract_address: games };
    let safe = IReleasesSafeDispatcher { contract_address: games };
    assert_eq!(releases.current_release(), 7);
    assert_eq!(releases.release(7), release);
    assert!(safe.release(1).is_err());
    let registrar = IRegistrarDispatcher { contract_address: games };
    let preset = super::registrar::definition(true);
    start_cheat_caller_address(games, authority());
    registrar.register_preset(1, preset);
    let game_id = registrar.create_game(super::registrar::params(true), preset);
    assert_eq!(releases.game_release(game_id), 7);
    releases.register_release(7, release);
    releases.apply_release(game_id, 7);
    assert_eq!(releases.game_release(game_id), 7);
}

#[test]
#[feature("safe_dispatcher")]
fn release_registration_is_authorized_immutable_and_pins_only_new_games() {
    let d = super::registrar::setup();
    let releases = IReleasesDispatcher { contract_address: d.games };
    let safe = IReleasesSafeDispatcher { contract_address: d.games };
    let registrar = IRegistrarDispatcher { contract_address: d.games };
    let preset = super::registrar::definition(true);
    let params = super::registrar::params(true);
    start_cheat_caller_address(d.games, authority());
    registrar.register_preset(1, preset);
    let first = registrar.create_game(params, preset);
    let original = releases.release(1);
    let next = Release {
        classes: games_storage::release::LogicClasses { movement: declare_logic("TroopFixture"), ..original.classes },
        ..original,
    };
    start_cheat_caller_address(d.games, d.actor);
    assert!(safe.register_release(2, next).is_err());
    start_cheat_caller_address(d.games, authority());
    let missing_movement = Release {
        classes: games_storage::release::LogicClasses { movement: 0.try_into().unwrap(), ..original.classes },
        ..original,
    };
    assert!(safe.register_release(2, missing_movement).is_err());
    releases.register_release(2, next);
    assert_eq!(releases.current_release(), 2);
    assert_eq!(releases.game_release(first), 1);
    assert_eq!(registrar.create_game(params, preset), first);
    let second = registrar.create_game(CreateGameParams { name: 'new-release', ..params }, preset);
    assert_eq!(releases.game_release(second), 2);
    let mut events = spy_events();
    releases.register_release(2, next);
    releases.register_release(1, original);
    assert_eq!(releases.current_release(), 2);
    assert!(events.get_events().emitted_by(d.games).events.is_empty());
    let error = safe.register_release(2, original).unwrap_err();
    let mut expected = array![core::byte_array::BYTE_ARRAY_MAGIC];
    let message: ByteArray = "release is immutable";
    message.serialize(ref expected);
    expected.append('ENTRYPOINT_FAILED');
    assert_eq!(error, expected);
    assert!(safe.register_release(0, original).is_err());
    assert!(safe.register_release(4, original).is_err());
    assert_eq!(releases.release(2), next);
}

#[test]
#[feature("safe_dispatcher")]
fn creator_hotfix_migrates_a_populated_frontier_day_once_and_play_continues() {
    let d = super::registrar::setup();
    let (game_id, preset, category) = super::registrar::expedition_home(d);
    let (first, second) = super::registrar::expedition_armies(d, game_id, category);
    let other = super::bind_authority(d);
    super::resource_commands::set_fixture(
        d.games, selector!("realms"), selector!("traits"), array![2].span(), 0x4000001_u32,
    );
    let other_home = ResourceKey {
        game_id, entity_id: interact_with_state(d.games, || crate::state::read().games.next_entity.read(game_id)),
    };
    assert!(
        super::resource_commands::execute_in_game(
            other,
            game_id,
            crate::commands::Command::SettleSeason(
                crate::realms::SettleSeason { name: 'second', selected_realm: Some(2) },
            ),
            351,
            351,
        ),
    );
    let home_state = crate::structures::IStructureOperationsDispatcher { contract_address: d.games }
        .structure(other_home)
        .unwrap();
    assert_eq!(home_state.owner, other.actor);
    assert_eq!(home_state.metadata.realm_id, 2);
    let guard = crate::guards::IGuardsDispatcherTrait::guard(
        crate::guards::IGuardsDispatcher { contract_address: d.games },
        crate::guards::GuardKey { game_id, structure_id: other_home.entity_id, slot: 0 },
    );
    assert!(
        super::resource_commands::execute_in_game(
            other,
            game_id,
            crate::commands::Command::CreateExplorer(
                crate::commands::CreateExplorer {
                    structure_id: other_home.entity_id,
                    category: guard.troops.category.into(),
                    tier: 0,
                    amount: crate::rules::RESOURCE_PRECISION,
                    direction: 0,
                },
            ),
            351,
            351,
        ),
    );
    let third = ExplorerKey {
        game_id,
        explorer_id: *crate::structures::IStructureOperationsDispatcher { contract_address: d.games }
            .structure(other_home)
            .unwrap()
            .troop_explorers
            .at(0),
    };
    let homes = array![ResourceKey { game_id, entity_id: 1 }, other_home].span();
    let armies = array![first, second, third].span();
    interact_with_state(
        d.games,
        || {
            let state = crate::state::write();
            let mut game = state.games.games.read(game_id);
            game.creator = d.actor;
            state.games.games.write(game_id, game);
        },
    );
    let releases = IReleasesDispatcher { contract_address: d.games };
    let safe = IReleasesSafeDispatcher { contract_address: d.games };
    let games = IGameDispatcher { contract_address: d.games };
    let before = populated_facts(d, game_id, homes, armies);
    let seed = games.game(game_id).seed;
    start_cheat_caller_address(d.games, authority());
    releases
        .register_release(2, Release { migration: declare_logic("ReleaseMigrationFixture"), ..releases.release(1) });
    assert!(safe.apply_release(game_id, 2).is_err());
    assert_eq!(releases.game_release(game_id), 1);
    start_cheat_caller_address(d.games, d.actor);
    let mut events = spy_events();
    releases.apply_release(game_id, 2);
    assert_eq!(releases.game_release(game_id), 2);
    assert_eq!(games.game(game_id).seed, seed + 1);
    assert_eq!(populated_facts(d, game_id, homes, armies), before);
    let emitted = events.get_events().emitted_by(d.games);
    assert_eq!(emitted.events.len(), 2);
    let (_, pin) = emitted.events.at(0);
    assert_eq!(pin.keys.span(), array![selector!("GameEvent"), selector!("RowSet"), 1, 'GameRelease'].span());
    assert_eq!(pin.data.span(), array![1, game_id.into(), 2, 2, crate::presets::commitment(preset)].span());
    let mut repeated = spy_events();
    releases.apply_release(game_id, 2);
    assert!(repeated.get_events().emitted_by(d.games).events.is_empty());
    assert_eq!(games.game(game_id).seed, seed + 1);
    assert!(safe.apply_release(game_id, 1).is_err());
    assert!(safe.apply_release(game_id, 3).is_err());
    assert!(
        super::resource_commands::execute_in_game(d, game_id, super::registrar::transfer(first, second, 1), 352, 352),
    );
}

fn populated_facts(
    d: super::Deployment, game_id: u32, homes: Span<ResourceKey>, armies: Span<ExplorerKey>,
) -> Array<felt252> {
    let state = GameState { contract_address: d.games };
    let structures = crate::structures::IStructureOperationsDispatcher { contract_address: d.games };
    let resources = crate::resources::IResourceOperationsDispatcher { contract_address: d.games };
    let map = crate::map::IMapLogicDispatcher { contract_address: d.games };
    let mut facts = array![];
    let mut game = IGameDispatcher { contract_address: d.games }.game(game_id);
    game.seed = 0;
    game.serialize(ref facts);
    let mut entities = array![];
    for home in homes {
        let realm = structures.structure(*home).unwrap();
        realm.serialize(ref facts);
        structures.structure_buildings(*home).serialize(ref facts);
        let labor = structures
            .building(
                crate::buildings::BuildingKey {
                    game_id,
                    alt: false,
                    outer_col: realm.base.coord_x,
                    outer_row: realm.base.coord_y,
                    inner_col: 10,
                    inner_row: 10,
                },
            )
            .unwrap();
        assert_eq!(labor.category, 25);
        labor.serialize(ref facts);
        for slot in 0_u8..4 {
            crate::guards::IGuardsDispatcherTrait::guard(
                crate::guards::IGuardsDispatcher { contract_address: d.games },
                crate::guards::GuardKey { game_id, structure_id: *home.entity_id, slot },
            )
                .serialize(ref facts);
        }
        entities.append(*home.entity_id);
    }
    for army in armies {
        let explorer = state.explorer(*army).unwrap();
        explorer.serialize(ref facts);
        map.tile(crate::geometry::tile_key(game_id, explorer.coord)).serialize(ref facts);
        entities.append(*army.explorer_id);
    }
    for entity_id in entities {
        for resource_type in 1_u8..59 {
            let slot = ResourceSlot { game_id, entity_id, resource_type };
            resources.resource_balance(slot).serialize(ref facts);
            resources.resource_production(slot).serialize(ref facts);
        }
    }
    facts
}

#[test]
#[feature("safe_dispatcher")]
fn failing_migration_rolls_back_pin_and_data() {
    let d = super::setup(true);
    let releases = IReleasesDispatcher { contract_address: d.games };
    let safe = IReleasesSafeDispatcher { contract_address: d.games };
    let games = IGameDispatcher { contract_address: d.games };
    start_cheat_caller_address(d.games, authority());
    releases
        .register_release(
            2, Release { migration: declare_logic("FailingReleaseMigrationFixture"), ..releases.release(1) },
        );
    let game = games.game(1);
    let release_fact = stored_release_fact(d.games, 1);
    // snforge syscall_hooks.rs appends spy events without revert truncation; verify their source storage instead.
    assert!(safe.apply_release(1, 2).is_err());
    assert_eq!(releases.game_release(1), 1);
    assert_eq!(games.game(1), game);
    assert_eq!(stored_release_fact(d.games, 1), release_fact);
}

fn stored_release_fact(address: starknet::ContractAddress, game_id: u32) -> (u32, felt252) {
    interact_with_state(
        address,
        || {
            let state = crate::state::read();
            let game = crate::logic::game::game(game_id);
            (state.game_releases.read(game_id), state.registrar.presets.read(game.preset_id))
        },
    )
}

#[test]
fn hotfix_refuses_an_old_signed_intent_without_gameplay_and_accepts_the_resigned_intent() {
    let d = super::setup(true);
    super::execute(d, super::intent(d, 1));
    let action = super::recorded::FixtureAction {
        nonce: 1,
        command: crate::commands::Command::CreateExplorer(
            crate::commands::CreateExplorer { structure_id: 8, category: 0, tier: 0, amount: 0, direction: 0 },
        ),
        ..super::intent(d, 1),
    };
    let old_intent = super::recorded::make_intent(d.games, action);
    let envelope = Envelope {
        action: action_identity(@old_intent),
        order: super::recorded::head(d.games, 1).order + 1,
        timestamp: 100,
        release_id: old_intent.release_id,
        preset_commitment: old_intent.preset_commitment,
        epoch: 0,
        root: 987654321,
    };
    let device = super::keypair(12345);
    let (r, s) = device.sign(envelope.action).unwrap();
    let signed = array![device.public_key, r, s].span();
    let releases = IReleasesDispatcher { contract_address: d.games };
    start_cheat_caller_address(d.games, authority());
    releases.register_release(2, releases.release(1));
    releases.apply_release(1, 2);
    let views = IRecordedExecutionViewsDispatcher { contract_address: d.games };
    let admission = views.get_admission(1, d.actor.into());
    assert_eq!(admission.release_id, 2);
    let before = gameplay_facts(d.games);
    start_cheat_caller_address(d.games, super::submitter());
    IRecordedExecutionDispatcher { contract_address: d.games }
        .execute(old_intent, ExecutionContext { envelope: encode_envelope(@envelope) }, signed);
    let refused = views.recorded_outcome(1, envelope.order).unwrap();
    assert_eq!(refused.status_class, 'STALE_RELEASE');
    assert!(!refused.nonce_consumed);
    assert_eq!(views.get_admission(1, d.actor.into()).nonce, admission.nonce);
    assert_eq!(gameplay_facts(d.games), before);
    super::execute(d, action);
    assert_eq!(views.recorded_outcome(1, envelope.order + 1).unwrap().status, 1);
    assert_eq!(views.get_admission(1, d.actor.into()).nonce, admission.nonce + 1);
}

fn gameplay_facts(address: starknet::ContractAddress) -> Array<felt252> {
    interact_with_state(
        address,
        || {
            let state = crate::state::read();
            let mut facts = array![];
            state.games.games.read(1).serialize(ref facts);
            state.games.rules.read(1).serialize(ref facts);
            state.games.next_entity.read(1).serialize(ref facts);
            for explorer_id in array![7, 8] {
                crate::logic::troops::explorer(ExplorerKey { game_id: 1, explorer_id }).serialize(ref facts);
            }
            facts
        },
    )
}

#[test]
#[feature("safe_dispatcher")]
fn migrations_cannot_be_skipped_and_rollback_is_a_new_forward_release() {
    let d = super::setup(true);
    let releases = IReleasesDispatcher { contract_address: d.games };
    let safe = IReleasesSafeDispatcher { contract_address: d.games };
    start_cheat_caller_address(d.games, authority());
    let original = releases.release(1);
    let migration = Release { migration: declare_logic("ReleaseMigrationFixture"), ..original };
    releases.register_release(2, migration);
    releases.register_release(3, migration);
    let games = IGameDispatcher { contract_address: d.games };
    let before = games.game(1);
    let error = safe.apply_release(1, 3).unwrap_err();
    let mut expected = array![core::byte_array::BYTE_ARRAY_MAGIC];
    let message: ByteArray = "release must follow game pin";
    message.serialize(ref expected);
    expected.append('ENTRYPOINT_FAILED');
    assert_eq!(error, expected);
    assert_eq!(releases.game_release(1), 1);
    assert_eq!(games.game(1), before);
    releases.apply_release(1, 2);
    assert_eq!(games.game(1).seed, before.seed + 1);
    releases.apply_release(1, 3);
    assert_eq!(games.game(1).seed, before.seed + 11);
    releases.apply_release(1, 3);
    assert_eq!(games.game(1).seed, before.seed + 11);
    assert!(safe.apply_release(1, 2).is_err());
    releases.register_release(4, original);
    releases.apply_release(1, 4);
    assert_eq!(releases.game_release(1), 4);
    assert_eq!(releases.release(4), original);
    assert_eq!(games.game(1).seed, before.seed + 11);
}
