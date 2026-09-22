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
use world_native::entry::{ILedgerOperatorDispatcher, ILedgerOperatorDispatcherTrait};
use world_native::game::{IGameDispatcher, IGameDispatcherTrait};
use world_native::guards::{GuardKey, IGuardsDispatcher, IGuardsDispatcherTrait};
use world_native::hyperstructures::{IHyperstructuresDispatcher, IHyperstructuresDispatcherTrait};
use world_native::lifecycle::{IDomainDispatcher, IDomainDispatcherTrait};
use world_native::resources::{
    IResourcesDispatcher, IResourcesDispatcherTrait, ResourceAmount, ResourceKey, ResourceRule, ResourceSlot,
};
use world_native::rules::RESOURCE_PRECISION;
use world_native::season::{ISeasonDispatcher, ISeasonDispatcherTrait};
use world_native::settlement::{
    EntryEntitlement, EntryKey, IBlitzHyperstructuresSafeDispatcher, IBlitzHyperstructuresSafeDispatcherTrait,
    IBlitzReservationsSafeDispatcher, IBlitzReservationsSafeDispatcherTrait, IRealmCreationSafeDispatcher,
    IRealmCreationSafeDispatcherTrait, ISettlementCommandsSafeDispatcher, ISettlementCommandsSafeDispatcherTrait,
    ISettlementConfigurationDispatcher, ISettlementConfigurationDispatcherTrait, ISettlementCreationDispatcher,
    ISettlementCreationDispatcherTrait, ISettlementCreationSafeDispatcher, ISettlementCreationSafeDispatcherTrait,
    ISettlementEntryDispatcher, ISettlementEntryDispatcherTrait, ISettlementViewsDispatcher,
    ISettlementViewsDispatcherTrait, RealmCreation, RealmGrants, SettlementCreation, SettlementMode, SettlementRules,
};
use world_native::structures::{IStructuresDispatcher, IStructuresDispatcherTrait};
use world_native::upgrades::{IUpgradeRulesDispatcher, IUpgradeRulesDispatcherTrait, UpgradeLimits, UpgradeRecipe};
use super::super::receipts::RecordedReceiptsTrait;
use super::{IRecordedExecutionDispatcher, IRecordedExecutionDispatcherTrait, context, pair, setup};

fn prepare() -> ContractAddress {
    prepare_without_entitlement(None, true)
}
fn prepare_with_resources(grants: Option<Span<ResourceAmount>>) -> ContractAddress {
    prepare_without_entitlement(grants, true)
}

#[feature("safe_dispatcher")]
fn prepare_without_entitlement(
    grant_override: Option<Span<world_native::resources::ResourceAmount>>, blitz: bool,
) -> ContractAddress {
    let season = setup();
    let peers = IDomainDispatcher { contract_address: season }.domain_state().peers;
    let input = read_txt(@FileTrait::new("tests/fixtures/preset-1.txt"));
    let mut fields = input.span();
    let mut rules: world_native::rules::SliceRules = Serde::deserialize(ref fields).unwrap();
    let resources: Span<ResourceRule> = Serde::deserialize(ref fields).unwrap();
    let buildings: Span<world_native::buildings::BuildingRuleConfig> = Serde::deserialize(ref fields).unwrap();
    if blitz {
        rules.command_mask = 71478916396378193887;
        rules.mode_rules = world_native::rules::HOME_REWARDS
            + world_native::rules::DISCOVER_CAMPS
            + world_native::rules::DISCOVER_CHESTS
            + world_native::rules::CAPTURE_VILLAGES
            + world_native::rules::SAME_OWNER_TRANSFER
            + world_native::rules::RESERVED_HYPERSTRUCTURES
            + world_native::rules::OWNER_ONLY_SHARES
            + world_native::rules::HYPERSTRUCTURE_MULTIPLIERS
            + world_native::rules::PRODUCTION_START;
        rules.entry_rule = world_native::rules::ENTRY_ROSTER;
    }
    let games = IGameDispatcher { contract_address: peers.registry };
    let game = world_native::game::GameRegistry {
        dev_mode_on: false, start_main_at: 1200, end_at: 1300, ..games.game(7),
    };
    start_cheat_caller_address(peers.registry, 222.try_into().unwrap());
    games.initialize_game(8, game, rules);
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
                registration_limit: 3,
                mode: if blitz {
                    SettlementMode::Triple
                } else {
                    SettlementMode::Single
                },
                spacing: 6,
            },
            grants,
        );
    stop_cheat_caller_address(season);
    stop_cheat_caller_address(peers.settlement);
    start_cheat_caller_address(peers.structures, 222.try_into().unwrap());
    start_cheat_caller_address(peers.resources, 222.try_into().unwrap());
    IResourcesDispatcher { contract_address: peers.resources }.configure_resources(8, resources);
    world_native::buildings::IBuildingRulesDispatcherTrait::configure_buildings(
        world_native::buildings::IBuildingRulesDispatcher { contract_address: peers.structures }, 8, buildings,
    );

    stop_cheat_caller_address(peers.resources);
    stop_cheat_caller_address(peers.structures);
    if blitz {
        start_cheat_caller_address(peers.map, peers.registry);
        IBlitzReservationsSafeDispatcher { contract_address: peers.map }.initialize_reservations(8).unwrap();
        stop_cheat_caller_address(peers.map);
    }
    start_cheat_caller_address(peers.registry, 222.try_into().unwrap());
    ILedgerOperatorDispatcher { contract_address: peers.registry }.set_ledger_operator(222.try_into().unwrap());
    stop_cheat_caller_address(peers.registry);
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
        timestamp,
        execution_config: admission.execution_config,
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
fn command() -> Command {
    Command::SettleSeason(world_native::realms::SettleSeason { name: 'retained', selected_realm: None })
}
fn grant_entry(season: ContractAddress, owner: ContractAddress) {
    let peers = IDomainDispatcher { contract_address: season }.domain_state().peers;
    start_cheat_caller_address(peers.settlement, 222.try_into().unwrap());
    ISettlementEntryDispatcher { contract_address: peers.settlement }
        .register_entitlement(
            EntryKey { game_id: 8, owner },
            EntryEntitlement {
                realm_id: 1, metadata_1: 0x0103070402020302010009, metadata_2: 0, metadata_3: 0, pass_kind: 1,
            },
        );
    stop_cheat_caller_address(peers.settlement);
}
fn unprovisioned_realm(season: ContractAddress, grant_troops: bool) {
    let peers = IDomainDispatcher { contract_address: season }.domain_state().peers;
    let center = 2147483646 - IGameDispatcher { contract_address: peers.registry }.rules(8).map_center_offset;
    let coord = *world_native::settlement_grid::settlement_location(
        world_native::troops::Coord { alt: false, x: center, y: center }, SettlementMode::Triple, 6, 0,
    )
        .at(0);
    start_cheat_caller_address(peers.structures, peers.settlement);
    ISettlementCreationDispatcher { contract_address: peers.structures }
        .create_settlement(
            8,
            456.try_into().unwrap(),
            coord,
            SettlementCreation::Realm(
                RealmCreation {
                    realm_id: 1,
                    traits: world_native::realms::RealmTraits { wonder: 1, order: 0, resources: array![1_u8].span() },
                    grant_troops,
                    activate_economy: false,
                },
            ),
            world_native::commands::ExecutionContext { raw_root: 987654321, timestamp: 1005 },
        );
    stop_cheat_caller_address(peers.structures);
}
fn settled_facts(season: ContractAddress) -> Array<felt252> {
    let peers = IDomainDispatcher { contract_address: season }.domain_state().peers;
    let views = ISettlementViewsDispatcher {
        contract_address: IDomainDispatcher { contract_address: season }.domain_state().peers.settlement,
    };
    let mut facts = array![];
    views.settlement_progress(8).serialize(ref facts);
    views.player_entry(EntryKey { game_id: 8, owner: 123.try_into().unwrap() }).serialize(ref facts);
    IStructuresDispatcher { contract_address: peers.structures }
        .structure(ResourceKey { game_id: 8, entity_id: 1 })
        .serialize(ref facts);
    facts
}

#[test]
fn accepted_eternum_settlement_keeps_recorded_time_after_game_end() {
    let mut immediate = array![].span();
    for clock in array![1100_u64, 100000] {
        let season = prepare_without_entitlement(None, false);
        grant_entry(season, 123.try_into().unwrap());
        let (action, envelope) = accepted(season, command(), 1005);
        start_cheat_block_timestamp_global(clock);
        submit(season, action, envelope);
        assert!(
            IRecordedExecutionViewsDispatcher { contract_address: season }.recorded_outcome(1).unwrap().status == 1,
        );
        let facts = settled_facts(season);
        if immediate.is_empty() {
            immediate = facts.span();
        } else {
            assert!(facts.span() == immediate, "late settlement changed facts");
        }
    }
}

#[test]
fn settlement_uses_the_bound_wallet_and_cannot_spend_another_owners_entitlement() {
    let season = prepare_without_entitlement(None, false);
    grant_entry(season, 789.try_into().unwrap());
    let views = ISettlementViewsDispatcher {
        contract_address: IDomainDispatcher { contract_address: season }.domain_state().peers.settlement,
    };
    let results = IRecordedExecutionViewsDispatcher { contract_address: season };
    execute(season, command(), 1005);
    assert!(results.recorded_outcome(1).unwrap().status == 2);
    assert!(views.player_entry(EntryKey { game_id: 8, owner: 789.try_into().unwrap() }).is_none());
    assert!(views.settlement_progress(8).realm_count == 0);
    grant_entry(season, 123.try_into().unwrap());
    execute(season, command(), 1005);
    assert!(results.recorded_outcome(2).unwrap().status == 1);
    assert!(
        views
            .player_entry(EntryKey { game_id: 8, owner: 123.try_into().unwrap() })
            .unwrap()
            .player == 456
            .try_into()
            .unwrap(),
    );
}

#[test]
fn rejected_settlement_rolls_back_entry_and_leaves_later_ticket_executable() {
    let season = prepare_without_entitlement(None, false);
    grant_entry(season, 123.try_into().unwrap());
    execute(season, Command::SettleSeason(world_native::realms::SettleSeason { name: 0, selected_realm: None }), 1005);
    let results = IRecordedExecutionViewsDispatcher { contract_address: season };
    assert!(results.recorded_outcome(1).unwrap().status == 2);
    let views = ISettlementViewsDispatcher {
        contract_address: IDomainDispatcher { contract_address: season }.domain_state().peers.settlement,
    };
    assert!(views.player_entry(EntryKey { game_id: 8, owner: 123.try_into().unwrap() }).is_none());
    assert!(views.settlement_progress(8).realm_count == 0);
    execute(season, command(), 1005);
    assert!(results.recorded_outcome(2).unwrap().status == 1);
}

#[test]
fn delayed_provisioning_starts_labor_once_without_regranting_starting_troops() {
    let season = prepare();
    unprovisioned_realm(season, true);
    let peers = IDomainDispatcher { contract_address: season }.domain_state().peers;
    let structures = IStructuresDispatcher { contract_address: peers.structures };
    let resource_store = IResourcesDispatcher { contract_address: peers.resources };
    let key = ResourceKey { game_id: 8, entity_id: 1 };
    let before = structures.structure(key).unwrap();
    assert!(before.base.starting_troops_granted);
    let guards = IGuardsDispatcher { contract_address: peers.troops };
    let guard_key = GuardKey { game_id: 8, structure_id: 1, slot: 0 };
    let before_guard = guards.guard(guard_key);
    assert!(before_guard.troops.count == 1500 * world_native::rules::RESOURCE_PRECISION);
    for slot in 1_u8..4 {
        assert!(guards.guard(GuardKey { slot, ..guard_key }) == Default::default());
    }
    let troop_type = world_native::troops::troop_resource(before_guard.troops.category, 0);
    let slot = world_native::resources::ResourceSlot { game_id: 8, entity_id: 1, resource_type: troop_type };
    let troop_balance = resource_store.resource_balance(slot);
    let (action, envelope) = accepted(season, Command::ProvisionRealm(1), 1201);
    start_cheat_block_timestamp_global(100000);
    submit(season, action, envelope);
    let results = IRecordedExecutionViewsDispatcher { contract_address: season };
    assert!(results.recorded_outcome(1).unwrap().status == 1, "recorded provisioning rejected after outage");
    assert!(guards.guard(guard_key) == before_guard);
    assert!(resource_store.resource_balance(slot) == troop_balance);
    let labor = world_native::resources::ResourceSlot { resource_type: 23, ..slot };
    let production = resource_store.resource_production(labor);
    assert!(production.building_count == 1);
    assert!(production.production_rate > 0);
    execute(season, Command::ProvisionRealm(1), 1201);
    assert!(results.recorded_outcome(2).unwrap().status == 2);
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
        unprovisioned_realm(season, false);
        let peers = IDomainDispatcher { contract_address: season }.domain_state().peers;
        let structures = IStructuresDispatcher { contract_address: peers.structures };
        let resource_store = IResourcesDispatcher { contract_address: peers.resources };
        let key = ResourceKey { game_id: 8, entity_id: 1 };
        let before = structures.structure(key).unwrap();
        let slot = world_native::resources::ResourceSlot { game_id: 8, entity_id: 1, resource_type: *resource_type };
        let balance = resource_store.resource_balance(slot);
        start_cheat_block_timestamp_global(1300);
        execute(season, Command::ProvisionRealm(1), 1201);
        let result = IRecordedExecutionViewsDispatcher { contract_address: season }.recorded_outcome(1).unwrap();
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
    let mut immediate = array![].span();
    for clock in array![1201_u64, 100000].span() {
        let season = prepare();
        let peers = IDomainDispatcher { contract_address: season }.domain_state().peers;
        let rules = IGameDispatcher { contract_address: peers.registry }.rules(8);
        let center = 2147483646 - rules.map_center_offset;
        let coord = world_native::troops::Coord { alt: false, x: center, y: center };
        let (action, envelope) = accepted(season, Command::CreateReservedHyperstructure(coord), 1201);
        start_cheat_block_timestamp_global(*clock);
        submit(season, action, envelope);
        let results = IRecordedExecutionViewsDispatcher { contract_address: season };
        assert!(results.recorded_outcome(1).unwrap().status == 1, "recorded materialization failed");
        let structures = IStructuresDispatcher { contract_address: peers.structures };
        let key = ResourceKey { game_id: 8, entity_id: 1 };
        let hyper = IHyperstructuresDispatcher { contract_address: peers.economy }.hyperstructure(key).unwrap();
        assert!(hyper.stage == world_native::hyperstructures::Stage::Complete);
        let mut facts = array![];
        hyper.serialize(ref facts);
        structures.structure(key).unwrap().serialize(ref facts);
        if immediate.is_empty() {
            immediate = facts.span();
        } else {
            assert!(immediate == facts.span(), "materialization changed after delay");
        }
        execute(season, Command::CreateReservedHyperstructure(coord), 1201);
        assert!(results.recorded_outcome(2).unwrap().status == 2);
        assert!(IHyperstructuresDispatcher { contract_address: peers.economy }.hyperstructure(key).unwrap() == hyper);
    }
}

#[test]
#[feature("safe_dispatcher")]
fn settlement_commands_reject_forged_domain_callers_before_mutating() {
    let season = prepare();
    let peers = IDomainDispatcher { contract_address: season }.domain_state().peers;
    let rules = IGameDispatcher { contract_address: peers.registry }.rules(8);
    let center = 2147483646 - rules.map_center_offset;
    let coord = world_native::troops::Coord { alt: false, x: center, y: center };
    let actor = 456.try_into().unwrap();
    let context = world_native::commands::ExecutionContext { raw_root: 19, timestamp: 1005 };
    start_cheat_caller_address(peers.settlement, actor);
    assert!(
        ISettlementCommandsSafeDispatcher {
            contract_address: IDomainDispatcher { contract_address: season }.domain_state().peers.settlement,
        }
            .settle_blitz_roster(8, actor, context)
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
    unprovisioned_realm(season, false);
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

#[test]
fn provision_and_upgrade_is_one_atomic_recorded_action() {
    for cost in array![100_u128, 101].span() {
        let season = prepare_with_resources(
            Some(array![ResourceAmount { resource_type: 1, amount: 100 * RESOURCE_PRECISION }].span()),
        );
        let registry = IDomainDispatcher { contract_address: season }.domain_state().peers.registry;
        start_cheat_caller_address(registry, 222.try_into().unwrap());
        IUpgradeRulesDispatcher { contract_address: registry }
            .configure_upgrades(
                8,
                UpgradeLimits { realm_max: 1, village_max: 1 },
                array![
                    UpgradeRecipe {
                        costs: array![ResourceAmount { resource_type: 1, amount: *cost * RESOURCE_PRECISION }].span(),
                    },
                ]
                    .span(),
            );
        stop_cheat_caller_address(registry);
        unprovisioned_realm(season, false);
        let peers = IDomainDispatcher { contract_address: season }.domain_state().peers;
        let structures = IStructuresDispatcher { contract_address: peers.structures };
        let resources = IResourcesDispatcher { contract_address: peers.resources };
        let key = ResourceKey { game_id: 8, entity_id: 1 };
        let stone = ResourceSlot { game_id: 8, entity_id: 1, resource_type: 1 };
        let labor = ResourceSlot { resource_type: 23, ..stone };
        let before = structures.structure(key).unwrap();
        let stone_before = resources.resource_balance(stone);
        let production_before = resources.resource_production(labor);
        start_cheat_block_timestamp_global(100000);
        execute(season, Command::ProvisionAndUpgradeRealm(1), 1201);
        let result = IRecordedExecutionViewsDispatcher { contract_address: season }.recorded_outcome(1).unwrap();
        if *cost == 100 {
            assert!(result.status == 1);
            assert!(structures.structure(key).unwrap().base.level == 1);
            assert!(resources.resource_production(labor).building_count == 1);
            assert!(resources.resource_balance(stone) == stone_before);
        } else {
            assert!(result.status == 2);
            assert!(structures.structure(key).unwrap() == before);
            assert!(resources.resource_balance(stone) == stone_before);
            assert!(resources.resource_production(labor) == production_before);
        }
        assert!(ISeasonDispatcher { contract_address: season }.next_nonce(8, 456.try_into().unwrap()) == 1);
    }
}
