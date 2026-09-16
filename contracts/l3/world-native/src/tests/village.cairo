use eternum_randomness_protocol::entrypoint::{
    IRecordedExecutionViewsDispatcher, IRecordedExecutionViewsDispatcherTrait,
};
use snforge_std::fs::{FileTrait, read_txt};
use snforge_std::{start_cheat_block_timestamp_global, start_cheat_caller_address, stop_cheat_caller_address};
use crate::commands::{Command, ExecutionContext};
use crate::game::{IGameDispatcher, IGameDispatcherTrait};
use crate::map::{IMapDispatcher, IMapDispatcherTrait};
use crate::resources::{IResourcesDispatcher, IResourcesDispatcherTrait, ResourceKey, ResourceRule, ResourceSlot};
use crate::season::{ISeasonDispatcher, ISeasonDispatcherTrait};
use crate::settlement::{
    ISettlementConfigurationDispatcher, ISettlementConfigurationDispatcherTrait, ISettlementCreationDispatcher,
    ISettlementCreationDispatcherTrait, ISettlementPoolDispatcher, ISettlementPoolDispatcherTrait, RealmGrants,
    SettlementMode, SettlementRules,
};
use crate::structures::{IStructuresDispatcher, IStructuresDispatcherTrait};
use crate::troops::Coord;
use crate::village::{
    IVillagesDispatcher, IVillagesDispatcherTrait, IVillagesSafeDispatcher, IVillagesSafeDispatcherTrait, SettleVillage,
    VillagePassKey, VillageRules,
};
use super::{Deployment, authority, context, intent, recorded, signature};

fn village_rules() -> VillageRules {
    let data = read_txt(@FileTrait::new("tests/fixtures/village.txt"));
    let mut fields = data.span();
    let rules = Serde::deserialize(ref fields).unwrap();
    assert!(fields.is_empty());
    rules
}

fn setup(dev: bool) -> (Deployment, u32) {
    setup_config(dev, SettlementMode::Single, recorded::rules())
}
fn setup_config(dev: bool, mode: SettlementMode, game_rules: crate::rules::SliceRules) -> (Deployment, u32) {
    let deployment = super::setup_with_structures(true, "StructuresDomain");
    let games = IGameDispatcher { contract_address: deployment.peers.season };
    start_cheat_caller_address(deployment.peers.season, authority());
    games.create_game(3, crate::game::GameRegistry { dev_mode_on: dev, ..games.game(1) }, game_rules);
    recorded::configure_submitter(deployment.peers.season, super::submitter());
    stop_cheat_caller_address(deployment.peers.season);
    let data = read_txt(@FileTrait::new("tests/fixtures/settlement.txt"));
    let mut fields = data.span();
    let grants: RealmGrants = Serde::deserialize(ref fields).unwrap();
    start_cheat_caller_address(deployment.peers.settlement, authority());
    ISettlementConfigurationDispatcher { contract_address: deployment.peers.settlement }
        .configure_settlement(
            3,
            SettlementRules {
                registration_start: 0,
                registration_limit: 2,
                mode,
                reward_profile: 1,
                cosmetic_limit: 0,
                cosmetic_collection: 0.try_into().unwrap(),
                cosmetic_timelock: 0.try_into().unwrap(),
                ledger_operator: authority(),
            },
            grants,
        );
    IVillagesDispatcher { contract_address: deployment.peers.settlement }
        .configure_villages(3, VillageRules { troop_delay_ticks: 2, ..village_rules() });
    stop_cheat_caller_address(deployment.peers.settlement);
    let data = read_txt(@FileTrait::new("tests/fixtures/preset-1.txt"));
    let mut fields = data.span();
    let _: crate::rules::SliceRules = Serde::deserialize(ref fields).unwrap();
    let resources: Span<ResourceRule> = Serde::deserialize(ref fields).unwrap();
    let buildings: Span<crate::buildings::BuildingRuleConfig> = Serde::deserialize(ref fields).unwrap();
    start_cheat_caller_address(deployment.peers.structures, authority());
    start_cheat_caller_address(deployment.peers.resources, authority());
    IResourcesDispatcher { contract_address: deployment.peers.resources }.configure_resources(3, resources);
    crate::buildings::IBuildingRulesDispatcherTrait::configure_buildings(
        crate::buildings::IBuildingRulesDispatcher { contract_address: deployment.peers.structures }, 3, buildings,
    );

    stop_cheat_caller_address(deployment.peers.resources);
    start_cheat_caller_address(deployment.peers.structures, deployment.peers.settlement);
    let realm = ISettlementCreationDispatcher { contract_address: deployment.peers.structures }
        .create_settlement(
            3,
            deployment.actor,
            Coord { alt: false, x: 2000000, y: 2000000 },
            crate::settlement::SettlementCreation::Realm(
                crate::settlement::RealmCreation {
                    realm_id: 1,
                    traits: crate::realms::RealmTraits { wonder: 1, order: 0, resources: grants.realm_resources },
                    grant_troops: false,
                    activate_economy: false,
                },
            ),
            context(),
        );
    stop_cheat_caller_address(deployment.peers.structures);
    (deployment, realm)
}

fn run(deployment: Deployment, command: Command, timestamp: u64) -> bool {
    start_cheat_block_timestamp_global(timestamp);
    let season = ISeasonDispatcher { contract_address: deployment.peers.season };
    let action = recorded::FixtureAction {
        command,
        rules: IGameDispatcher { contract_address: deployment.peers.season }.rules(3),
        nonce: season.next_nonce(3, deployment.actor),
        deadline: 10000,
        ..intent(deployment, 3),
    };
    let (r, s) = signature(deployment, action);
    let ticket = recorded::make_intent(deployment.peers.season, action);
    let recorded_context = recorded::make_context(
        deployment.peers.season, action, ExecutionContext { timestamp, ..context() },
    );
    snforge_std::start_cheat_block_timestamp(deployment.peers.season, timestamp);
    snforge_std::cheat_caller_address(
        deployment.peers.season, super::submitter(), snforge_std::CheatSpan::TargetCalls(1),
    );
    eternum_randomness_protocol::entrypoint::IRecordedExecutionDispatcherTrait::execute(
        eternum_randomness_protocol::entrypoint::IRecordedExecutionDispatcher {
            contract_address: deployment.peers.season,
        },
        ticket,
        recorded_context,
        r,
        s,
    );
    IRecordedExecutionViewsDispatcher { contract_address: deployment.peers.season }
        .get_result(season.execution_head().order)
        .status == 1
}

fn settle(realm: u32, pass_id: u16) -> Command {
    Command::SettleVillage(
        SettleVillage { owner: 0x333.try_into().unwrap(), pass_id, connected_realm_entity_id: realm },
    )
}

#[test]
#[feature("safe_dispatcher")]
fn production_pass_is_atomic_single_use_and_army_grant_uses_recorded_time() {
    let (deployment, realm) = setup(false);
    let ledger = IVillagesSafeDispatcher { contract_address: deployment.peers.settlement };
    let pass = VillagePassKey { game_id: 3, pass_id: 7 };
    assert!(!run(deployment, settle(realm, 7), 100));
    assert!(ledger.village_pass(pass).unwrap().is_none());
    start_cheat_caller_address(deployment.peers.settlement, deployment.actor);
    assert!(ledger.register_village_pass(pass, 0x333.try_into().unwrap()).is_err());
    start_cheat_caller_address(deployment.peers.settlement, authority());
    ledger.register_village_pass(pass, 0x333.try_into().unwrap()).unwrap();
    assert!(ledger.register_village_pass(pass, deployment.actor).is_err());
    stop_cheat_caller_address(deployment.peers.settlement);
    let pools = ISettlementPoolDispatcher { contract_address: deployment.peers.map };
    let before = pools.village_pool(3);
    assert!(!run(deployment, settle(0xffffffff, 7), 100));
    assert!(ledger.village_pass(pass).unwrap().unwrap().village_id == 0);
    assert!(pools.village_pool(3) == before, "failed placement retained reservations");
    assert!(run(deployment, settle(realm, 7), 100));
    let village_id = ledger.village_pass(pass).unwrap().unwrap().village_id;
    let structures = IStructuresDispatcher { contract_address: deployment.peers.structures };
    let resource_store = IResourcesDispatcher { contract_address: deployment.peers.resources };
    let key = ResourceKey { game_id: 3, entity_id: village_id };
    let village = structures.structure(key).unwrap();
    assert!(village.base.category == 5 && village.metadata.village_realm == realm);
    assert!(village.owner == deployment.actor && !village.base.starting_troops_granted);
    assert!(village.base.coord_x != 2000000 || village.base.coord_y != 2000000);
    assert!(
        resource_store
            .resource_production(ResourceSlot { game_id: 3, entity_id: village_id, resource_type: 23 })
            .production_rate > 0,
    );
    let coord = Coord { alt: false, x: village.base.coord_x, y: village.base.coord_y };
    let map = IMapDispatcher { contract_address: deployment.peers.map };
    for direction in 0_u8..6 {
        assert!(
            map.tile(crate::geometry::tile_key(3, crate::geometry::neighbor(coord, direction))).is_none(),
            "village revealed a neighbour",
        );
    }
    assert!(!run(deployment, settle(realm, 7), 100));
    assert!(!run(deployment, Command::ReceiveVillageArmy(village_id), 100));
    let interval = recorded::rules().tick_config.armies_tick_in_seconds;
    let claimable_at = (100 / interval + 2) * interval;
    assert!(run(deployment, Command::ReceiveVillageArmy(village_id), claimable_at));
    let granted = structures.structure(key).unwrap();
    assert!(granted.base.starting_troops_granted);
    assert!(granted.troop_guards.delta.count == 10 * crate::rules::RESOURCE_PRECISION);
    assert!(!run(deployment, Command::ReceiveVillageArmy(village_id), claimable_at));
}

#[test]
fn development_villages_skip_passes_and_have_no_six_per_realm_limit() {
    let (deployment, realm) = setup(true);
    for _ in 0..7_u8 {
        assert!(run(deployment, settle(realm, 0), 100));
    }
    let ledger = IVillagesDispatcher { contract_address: deployment.peers.settlement };
    assert!(ledger.village_pass(VillagePassKey { game_id: 3, pass_id: 0 }).is_none());
}


fn register_pass(deployment: Deployment, pass_id: u16) -> VillagePassKey {
    let key = VillagePassKey { game_id: 3, pass_id };
    start_cheat_caller_address(deployment.peers.settlement, authority());
    IVillagesDispatcher { contract_address: deployment.peers.settlement }
        .register_village_pass(key, 0x333.try_into().unwrap());
    stop_cheat_caller_address(deployment.peers.settlement);
    key
}

fn assert_blitz_village(mode: SettlementMode) {
    let (deployment, realm) = setup_config(
        false, mode, crate::rules::SliceRules { blitz_mode_on: true, ..recorded::rules() },
    );
    let pass = register_pass(deployment, 1);
    assert!(run(deployment, settle(realm, 1), 100));
    let ledger = IVillagesDispatcher { contract_address: deployment.peers.settlement };
    assert!(ledger.village_pass(pass).unwrap().village_id != 0);
    assert!(!run(deployment, settle(realm, 1), 100));
    let progress = crate::settlement::ISettlementViewsDispatcherTrait::settlement_progress(
        crate::settlement::ISettlementViewsDispatcher { contract_address: deployment.peers.settlement }, 3,
    );
    assert!(progress.registered == 0 && progress.realm_count == 0);
    let pool = ISettlementPoolDispatcher { contract_address: deployment.peers.map };
    start_cheat_caller_address(deployment.peers.map, deployment.peers.settlement);
    assert!(pool.claim_settlement(3, 0, 1).len() == 3);
    assert!(pool.claim_settlement(3, 1, 2).len() == 3);
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
        false, SettlementMode::Single, crate::rules::SliceRules { map_center_offset: 2147483646, ..recorded::rules() },
    );
    let pass = register_pass(deployment, 9);
    assert!(!run(deployment, settle(realm, 9), 100));
    let ledger = IVillagesDispatcher { contract_address: deployment.peers.settlement };
    assert!(ledger.village_pass(pass).unwrap().village_id == 0);
    let pool = ISettlementPoolDispatcher { contract_address: deployment.peers.map };
    assert!(pool.village_pool(3).opened == 0 && pool.settlement_pool(3).opened == 0);
    let season = ISeasonDispatcher { contract_address: deployment.peers.season };
    let result = IRecordedExecutionViewsDispatcher { contract_address: deployment.peers.season }.get_result(1);
    assert!(result.status == 2 && result.result == 'GAMEPLAY_REJECTED');
    assert!(season.execution_head().order == 1 && season.next_nonce(3, deployment.actor) == 1);
}
