use eternum_randomness_protocol::entrypoint::{
    IRecordedExecutionViewsDispatcher, IRecordedExecutionViewsDispatcherTrait,
};
use eternum_randomness_protocol::{Envelope, Intent, action_identity};
use snforge_std::fs::{FileTrait, read_txt};
use snforge_std::signature::SignerTrait;
use snforge_std::signature::stark_curve::StarkCurveSignerImpl;
use snforge_std::{start_cheat_block_timestamp_global, start_cheat_caller_address, stop_cheat_caller_address};
use starknet::ContractAddress;
use world_native::commands::{Command, command_commitment};
use world_native::game::{IGameDispatcher, IGameDispatcherTrait};
use world_native::lifecycle::{IDomainDispatcher, IDomainDispatcherTrait};
use world_native::resources::{IResourcesDispatcher, IResourcesDispatcherTrait, ResourceKey, ResourceRule};
use world_native::season::{ISeasonDispatcher, ISeasonDispatcherTrait};
use world_native::settlement::{
    AcceptedCosmetic, CosmeticsKey, EntryKey, IBlitzHyperstructuresSafeDispatcher,
    IBlitzHyperstructuresSafeDispatcherTrait, IBlitzReservationsSafeDispatcher, IBlitzReservationsSafeDispatcherTrait,
    IRealmCreationSafeDispatcher, IRealmCreationSafeDispatcherTrait, ISettlementCommandsSafeDispatcher,
    ISettlementCommandsSafeDispatcherTrait, ISettlementConfigurationDispatcher, ISettlementConfigurationDispatcherTrait,
    ISettlementCreationSafeDispatcher, ISettlementCreationSafeDispatcherTrait, ISettlementViewsDispatcher,
    ISettlementViewsDispatcherTrait, RealmGrants, SettleBlitz, SettlementMode, SettlementRules,
};
use world_native::structures::{IStructuresDispatcher, IStructuresDispatcherTrait};
use super::{IRecordedExecutionDispatcher, IRecordedExecutionDispatcherTrait, context, pair, setup};

fn prepare() -> ContractAddress {
    prepare_with_resources(None)
}

fn prepare_with_resources(grant_override: Option<Span<world_native::resources::ResourceAmount>>) -> ContractAddress {
    let season = setup();
    let peers = IDomainDispatcher { contract_address: season }.domain_state().peers;
    let input = read_txt(@FileTrait::new("tests/fixtures/preset-1.txt"));
    let mut fields = input.span();
    let mut rules: world_native::rules::SliceRules = Serde::deserialize(ref fields).unwrap();
    let resources: Span<ResourceRule> = Serde::deserialize(ref fields).unwrap();
    rules.blitz_mode_on = true;
    let games = IGameDispatcher { contract_address: season };
    let game = world_native::game::GameRegistry {
        dev_mode_on: false, start_main_at: 1200, end_at: 1300, ..games.game(7),
    };
    start_cheat_caller_address(season, 222.try_into().unwrap());
    games.create_game(8, game, rules);
    let input = read_txt(@FileTrait::new("tests/fixtures/settlement.txt"));
    let mut fields = input.span();
    let mut grants: RealmGrants = Serde::deserialize(ref fields).unwrap();
    if let Some(resources) = grant_override {
        grants.resources = resources;
    }
    start_cheat_caller_address(peers.settlement, 222.try_into().unwrap());
    ISettlementConfigurationDispatcher {
        contract_address: IDomainDispatcher { contract_address: season }.domain_state().peers.settlement,
    }
        .configure_settlement(
            8,
            SettlementRules {
                registration_start: 900,
                registration_limit: 2,
                mode: SettlementMode::Single,
                reward_profile: 1,
                cosmetic_limit: 3,
                cosmetic_collection: 11.try_into().unwrap(),
                cosmetic_timelock: 12.try_into().unwrap(),
                ledger_operator: 0.try_into().unwrap(),
            },
            grants,
        );
    stop_cheat_caller_address(season);
    stop_cheat_caller_address(peers.settlement);
    start_cheat_caller_address(peers.structures, 222.try_into().unwrap());
    start_cheat_caller_address(peers.resources, 222.try_into().unwrap());
    IResourcesDispatcher { contract_address: peers.resources }.configure_resources(8, resources);
    stop_cheat_caller_address(peers.resources);
    stop_cheat_caller_address(peers.structures);
    execute(season, Command::ReserveHyperstructures(255), 1005);
    season
}

fn accepted(season: ContractAddress, command: Command, timestamp: u64) -> (Intent, Envelope) {
    let admission = IRecordedExecutionViewsDispatcher { contract_address: season }.get_admission(8, 456);
    let mut arguments = array![];
    command.serialize(ref arguments);
    let action = Intent {
        chain: 'TEST',
        deployment: season.into(),
        game_id: 8,
        actor: 456,
        nonce: admission.nonce,
        command: command_commitment(command),
        rules: admission.rules,
        valid_from: timestamp,
        valid_until: timestamp + 10,
        last_order: 100,
        arguments,
    };
    let envelope = Envelope {
        action: action_identity(@action),
        order: admission.order,
        predecessor: admission.predecessor,
        preceding_state: admission.preceding_state,
        timestamp,
        execution_config: admission.execution_config,
        l2_gas: 1200000000,
        root: 987654321,
    };
    (action, envelope)
}
fn execute(season: ContractAddress, command: Command, timestamp: u64) {
    let (action, envelope) = accepted(season, command, timestamp);
    submit(season, action, envelope);
}
fn submit(season: ContractAddress, action: Intent, envelope: Envelope) {
    let (r, s) = pair().sign(action_identity(@action)).unwrap();
    IRecordedExecutionDispatcher { contract_address: season }.execute(action, context(@envelope), r, s);
}
fn command(owner: ContractAddress) -> Command {
    Command::SettleBlitz(
        SettleBlitz {
            cosmetics_block_hash: 0xabc,
            cosmetics_block_number: 2,
            name: 'retained',
            owner,
            grant_starting_troops: false,
            cosmetics: array![AcceptedCosmetic { token_id: 19, owner, attributes: 321 }].span(),
        },
    )
}
fn settled_facts(season: ContractAddress) -> Array<felt252> {
    let peers = IDomainDispatcher { contract_address: season }.domain_state().peers;
    let views = ISettlementViewsDispatcher {
        contract_address: IDomainDispatcher { contract_address: season }.domain_state().peers.settlement,
    };
    let mut facts = array![];
    views.settlement_progress(8).serialize(ref facts);
    views.player_entry(EntryKey { game_id: 8, owner: 123.try_into().unwrap() }).serialize(ref facts);
    views.player_cosmetics(CosmeticsKey { game_id: 8, player: 456.try_into().unwrap() }).serialize(ref facts);
    IStructuresDispatcher { contract_address: peers.structures }
        .structure(ResourceKey { game_id: 8, entity_id: 1 })
        .serialize(ref facts);
    facts
}

#[test]
fn accepted_settlement_keeps_recorded_cosmetics_and_time_after_game_end() {
    let mut immediate = array![];
    for clock in array![1100_u64, 100000].span() {
        let season = prepare();
        let (action, envelope) = accepted(season, command(123.try_into().unwrap()), 1005);
        start_cheat_block_timestamp_global(*clock);
        submit(season, action, envelope);
        let result = IRecordedExecutionViewsDispatcher { contract_address: season }.get_result(2);
        assert!(result.status == 1, "accepted settlement failed");
        let views = ISettlementViewsDispatcher {
            contract_address: IDomainDispatcher { contract_address: season }.domain_state().peers.settlement,
        };
        assert!(views.settlement_progress(8).registered == 1);
        assert!(
            views
                .player_cosmetics(CosmeticsKey { game_id: 8, player: 456.try_into().unwrap() })
                .attributes == array![321_u128]
                .span(),
        );
        let facts = settled_facts(season);
        if immediate.is_empty() {
            immediate = facts;
        } else {
            assert!(facts == immediate, "delayed settlement changed facts");
        }
    }
}

#[test]
fn accepted_settlement_keeps_the_admitted_wallet_after_registry_rebinding() {
    let season = prepare();
    let (action, envelope) = accepted(season, command(123.try_into().unwrap()), 1005);
    let registry = ISeasonDispatcher { contract_address: season }.authentication().registry;
    snforge_std::start_mock_call(registry, selector!("owner_of"), 789_felt252);
    snforge_std::start_mock_call(registry, selector!("account_of"), 456_felt252);
    start_cheat_block_timestamp_global(100000);
    submit(season, action, envelope);
    assert!(IRecordedExecutionViewsDispatcher { contract_address: season }.get_result(2).status == 1);
    let views = ISettlementViewsDispatcher {
        contract_address: IDomainDispatcher { contract_address: season }.domain_state().peers.settlement,
    };
    assert!(views.player_entry(EntryKey { game_id: 8, owner: 123.try_into().unwrap() }).is_some());
    assert!(views.player_entry(EntryKey { game_id: 8, owner: 789.try_into().unwrap() }).is_none());
    assert!(
        views
            .player_cosmetics(CosmeticsKey { game_id: 8, player: 456.try_into().unwrap() })
            .attributes == array![321_u128]
            .span(),
    );
}

#[test]
fn cosmetic_snapshot_identity_is_bound_to_the_signed_command() {
    let season = prepare();
    let Command::SettleBlitz(original) = command(123.try_into().unwrap()) else {
        panic!("expected settlement");
    };
    let altered = Command::SettleBlitz(SettleBlitz { cosmetics_block_hash: 0xdef, ..original });
    let altered_height = Command::SettleBlitz(SettleBlitz { cosmetics_block_number: 3, ..original });
    assert!(command_commitment(command(123.try_into().unwrap())) != command_commitment(altered));
    assert!(command_commitment(altered) != command_commitment(altered_height));
    execute(season, Command::SettleBlitz(SettleBlitz { cosmetics_block_hash: 0, ..original }), 1005);
    assert!(IRecordedExecutionViewsDispatcher { contract_address: season }.get_result(2).status == 2);
    assert!(
        ISettlementViewsDispatcher {
            contract_address: IDomainDispatcher { contract_address: season }.domain_state().peers.settlement,
        }
            .settlement_progress(8)
            .registered == 0,
    );
}

#[test]
fn rejected_settlement_rolls_back_entry_and_leaves_later_ticket_executable() {
    let season = prepare();
    let invalid = Command::SettleBlitz(
        SettleBlitz {
            cosmetics_block_hash: 0xabc,
            cosmetics_block_number: 2,
            name: 'retained',
            owner: 123.try_into().unwrap(),
            grant_starting_troops: false,
            cosmetics: array![AcceptedCosmetic { token_id: 19, owner: 789.try_into().unwrap(), attributes: 321 }]
                .span(),
        },
    );
    execute(season, invalid, 1005);
    let results = IRecordedExecutionViewsDispatcher { contract_address: season };
    assert!(results.get_result(2).status == 2);
    let views = ISettlementViewsDispatcher {
        contract_address: IDomainDispatcher { contract_address: season }.domain_state().peers.settlement,
    };
    assert!(views.player_entry(EntryKey { game_id: 8, owner: 123.try_into().unwrap() }).is_none());
    assert!(views.settlement_progress(8).registered == 0);
    execute(season, command(123.try_into().unwrap()), 1005);
    assert!(results.get_result(3).status == 1);
    execute(season, command(123.try_into().unwrap()), 1005);
    assert!(results.get_result(4).status == 2);
    assert!(views.settlement_progress(8).registered == 1);
    assert!(ISeasonDispatcher { contract_address: season }.next_nonce(8, 456.try_into().unwrap()) == 4);
}

#[test]
fn delayed_provisioning_starts_labor_once_without_regranting_starting_troops() {
    let season = prepare();
    execute(
        season,
        Command::SettleBlitz(
            SettleBlitz {
                cosmetics_block_hash: 0xabc,
                cosmetics_block_number: 2,
                name: 'provision',
                owner: 123.try_into().unwrap(),
                cosmetics: array![].span(),
                grant_starting_troops: true,
            },
        ),
        1005,
    );
    let peers = IDomainDispatcher { contract_address: season }.domain_state().peers;
    let structures = IStructuresDispatcher { contract_address: peers.structures };
    let resource_store = IResourcesDispatcher { contract_address: peers.resources };
    let key = ResourceKey { game_id: 8, entity_id: 1 };
    let before = structures.structure(key).unwrap();
    assert!(before.base.starting_troops_granted);
    assert!(before.base.troop_guard_count == 1);
    assert!(before.troop_guards.delta.count == 1500 * world_native::rules::RESOURCE_PRECISION);
    let troop_type = world_native::troops::troop_resource(before.troop_guards.delta.category, 0);
    let slot = world_native::resources::ResourceSlot { game_id: 8, entity_id: 1, resource_type: troop_type };
    let troop_balance = resource_store.resource_balance(slot);
    let (action, envelope) = accepted(season, Command::ProvisionRealm(1), 1201);
    start_cheat_block_timestamp_global(100000);
    submit(season, action, envelope);
    let results = IRecordedExecutionViewsDispatcher { contract_address: season };
    assert!(results.get_result(3).status == 1, "recorded provisioning rejected after outage");
    assert!(structures.structure(key).unwrap().troop_guards == before.troop_guards);
    assert!(resource_store.resource_balance(slot) == troop_balance);
    let labor = world_native::resources::ResourceSlot { resource_type: 23, ..slot };
    let production = resource_store.resource_production(labor);
    assert!(production.building_count == 1);
    assert!(production.production_rate > 0);
    execute(season, Command::ProvisionRealm(1), 1201);
    assert!(results.get_result(4).status == 2);
    assert!(resource_store.resource_production(labor) == production);
    assert!(resource_store.resource_balance(slot) == troop_balance);
}

#[test]
fn provisioning_accepts_stone_and_rejects_lords_without_partial_grants() {
    for resource_type in array![1_u8, world_native::resources::LORDS].span() {
        let grants = array![
            world_native::resources::ResourceAmount {
                resource_type: *resource_type, amount: 100 * world_native::rules::RESOURCE_PRECISION,
            },
        ];
        let season = prepare_with_resources(Some(grants.span()));
        execute(season, command(123.try_into().unwrap()), 1005);
        let peers = IDomainDispatcher { contract_address: season }.domain_state().peers;
        let structures = IStructuresDispatcher { contract_address: peers.structures };
        let resource_store = IResourcesDispatcher { contract_address: peers.resources };
        let key = ResourceKey { game_id: 8, entity_id: 1 };
        let before = structures.structure(key).unwrap();
        let slot = world_native::resources::ResourceSlot { game_id: 8, entity_id: 1, resource_type: *resource_type };
        let balance = resource_store.resource_balance(slot);
        start_cheat_block_timestamp_global(1300);
        execute(season, Command::ProvisionRealm(1), 1201);
        let result = IRecordedExecutionViewsDispatcher { contract_address: season }.get_result(3);
        if *resource_type == world_native::resources::LORDS {
            assert!(result.status == 2, "LORDS grant accepted");
            assert!(resource_store.resource_balance(slot) == balance);
            assert!(structures.structure(key).unwrap() == before, "rejection partially provisioned realm");
            assert!(
                resource_store
                    .resource_production(world_native::resources::ResourceSlot { resource_type: 23, ..slot })
                    .building_count == 0,
            );
        } else {
            assert!(result.status == 1, "Stone grant rejected");
            assert!(resource_store.resource_balance(slot) == balance + 100 * world_native::rules::RESOURCE_PRECISION);
            assert!(
                resource_store
                    .resource_production(world_native::resources::ResourceSlot { resource_type: 23, ..slot })
                    .building_count == 1,
            );
        }
    }
}

#[test]
fn reserved_hyperstructure_uses_recorded_time_after_an_outage() {
    let mut immediate = array![];
    for clock in array![1201_u64, 100000].span() {
        let season = prepare();
        let rules = IGameDispatcher { contract_address: season }.rules(8);
        let center = 2147483646 - rules.map_center_offset;
        let coord = world_native::troops::Coord { alt: false, x: center, y: center };
        let (action, envelope) = accepted(season, Command::CreateReservedHyperstructure(coord), 1201);
        start_cheat_block_timestamp_global(*clock);
        submit(season, action, envelope);
        let results = IRecordedExecutionViewsDispatcher { contract_address: season };
        assert!(results.get_result(2).status == 1, "recorded materialization failed");
        let peers = IDomainDispatcher { contract_address: season }.domain_state().peers;
        let structures = IStructuresDispatcher { contract_address: peers.structures };
        let key = ResourceKey { game_id: 8, entity_id: 1 };
        let hyper = structures.hyperstructure(key).unwrap();
        assert!(hyper.initialized && hyper.completed);
        let mut facts = array![];
        hyper.serialize(ref facts);
        structures.structure(key).unwrap().serialize(ref facts);
        if immediate.is_empty() {
            immediate = facts;
        } else {
            assert!(immediate == facts, "materialization changed after delay");
        }
        execute(season, Command::CreateReservedHyperstructure(coord), 1201);
        assert!(results.get_result(3).status == 2);
        assert!(structures.hyperstructure(key).unwrap() == hyper);
    }
}

#[test]
#[feature("safe_dispatcher")]
fn settlement_commands_reject_forged_domain_callers_before_mutating() {
    let season = prepare();
    let peers = IDomainDispatcher { contract_address: season }.domain_state().peers;
    let rules = IGameDispatcher { contract_address: season }.rules(8);
    let center = 2147483646 - rules.map_center_offset;
    let coord = world_native::troops::Coord { alt: false, x: center, y: center };
    let actor = 456.try_into().unwrap();
    let context = world_native::commands::ExecutionContext { raw_root: 19, timestamp: 1005 };
    start_cheat_caller_address(peers.settlement, actor);
    assert!(
        ISettlementCommandsSafeDispatcher {
            contract_address: IDomainDispatcher { contract_address: season }.domain_state().peers.settlement,
        }
            .settle_blitz(
                8,
                actor,
                SettleBlitz {
                    cosmetics_block_hash: 0xabc,
                    cosmetics_block_number: 2,
                    name: 'forged',
                    owner: 123.try_into().unwrap(),
                    cosmetics: array![].span(),
                    grant_starting_troops: false,
                },
                context,
            )
            .is_err(),
    );
    stop_cheat_caller_address(peers.settlement);
    assert!(
        ISettlementViewsDispatcher {
            contract_address: IDomainDispatcher { contract_address: season }.domain_state().peers.settlement,
        }
            .settlement_progress(8)
            .registered == 0,
    );
    start_cheat_caller_address(peers.structures, peers.map);
    assert!(
        ISettlementCreationSafeDispatcher { contract_address: peers.structures }
            .create_settlement(
                8,
                actor,
                world_native::troops::Coord { x: center + 50, y: center + 50, ..coord },
                world_native::settlement::SettlementCreation::Realm(
                    world_native::settlement::RealmCreation {
                        realm_id: 1,
                        traits: world_native::realms::RealmTraits { wonder: 1, order: 0, resources: array![].span() },
                        grant_troops: false,
                        activate_economy: false,
                    },
                ),
                context,
            )
            .is_err(),
    );
    assert!(
        IBlitzHyperstructuresSafeDispatcher { contract_address: peers.structures }
            .create_reserved_hyperstructure(8, actor, coord, context)
            .is_err(),
    );
    stop_cheat_caller_address(peers.structures);
    start_cheat_caller_address(peers.map, actor);
    assert!(IBlitzReservationsSafeDispatcher { contract_address: peers.map }.release_hyperstructure(8, coord).is_err());
    stop_cheat_caller_address(peers.map);
    execute(season, command(123.try_into().unwrap()), 1005);
    start_cheat_block_timestamp_global(1201);
    start_cheat_caller_address(peers.structures, peers.map);
    assert!(
        IRealmCreationSafeDispatcher { contract_address: peers.structures }
            .activate_realm_economy(
                8, actor, 1, world_native::commands::ExecutionContext { timestamp: 1201, ..context },
            )
            .is_err(),
    );
    stop_cheat_caller_address(peers.structures);
    assert!(
        IResourcesDispatcher { contract_address: peers.resources }
            .resource_production(world_native::resources::ResourceSlot { game_id: 8, entity_id: 1, resource_type: 23 })
            .building_count == 0,
    );
}
