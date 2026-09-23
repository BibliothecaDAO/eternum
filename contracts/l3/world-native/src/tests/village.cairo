use eternum_randomness_protocol::entrypoint::IRecordedExecutionViewsDispatcher;
use snforge_std::fs::{FileTrait, read_txt};
use snforge_std::{
    EventSpyTrait, EventsFilterTrait, spy_events, start_cheat_block_timestamp_global, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use crate::commands::{Command, ExecutionContext};
use crate::game::{IGameDispatcher, IGameDispatcherTrait, IPointsDispatcherTrait};
use crate::games::{IGamesAuthenticationDispatcher, IGamesAuthenticationDispatcherTrait};
use crate::map::IMapLogicDispatcher;
use crate::resources::{
    IResourceOperationsDispatcher, IResourceOperationsDispatcherTrait, ResourceKey, ResourceRule, ResourceSlot,
};
use crate::settlement::{
    ISettlementConfigurationDispatcher, ISettlementConfigurationDispatcherTrait, ISettlementCreationDispatcher,
    ISettlementCreationDispatcherTrait, ISettlementPoolDispatcher, ISettlementPoolDispatcherTrait, RealmGrants,
    SettlementMode, SettlementRules,
};
use crate::structures::IStructureOperationsDispatcher;
use crate::tests::state::{MapObservationTrait, ResourceObservationTrait, StructureObservationTrait};
use crate::troops::Coord;
use crate::village::{
    IVillagesDispatcher, IVillagesDispatcherTrait, IVillagesSafeDispatcher, IVillagesSafeDispatcherTrait, SettleVillage,
    VillagePassKey, VillageRules,
};
use super::recorded_receipts::RecordedReceiptsTrait;
use super::{Deployment, authority, context, intent, recorded, signature};

pub fn village_rules() -> VillageRules {
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
    let deployment = super::setup_with_domains(true, "StructuresLogic", "TroopsLogic");
    super::entry::set_operator(deployment, authority());
    let games = IGameDispatcher { contract_address: deployment.games };
    super::recorded::seed_game(
        deployment.games, 3, crate::game::GameRegistry { dev_mode_on: dev, ..games.game(1) }, game_rules,
    );
    recorded::configure_submitter(deployment.games, super::submitter());
    let data = read_txt(@FileTrait::new("tests/fixtures/settlement.txt"));
    let mut fields = data.span();
    let grants: RealmGrants = Serde::deserialize(ref fields).unwrap();
    start_cheat_caller_address(deployment.games, authority());
    ISettlementConfigurationDispatcher { contract_address: deployment.games }
        .configure_settlement(
            3, SettlementRules { registration_start: 0, registration_limit: 2, mode, spacing: 6 }, grants,
        );
    IVillagesDispatcher { contract_address: deployment.games }
        .configure_villages(3, VillageRules { troop_delay_ticks: 2, ..village_rules() });
    stop_cheat_caller_address(deployment.games);
    let data = read_txt(@FileTrait::new("tests/fixtures/preset-3.txt"));
    let mut fields = data.span();
    let _: crate::rules::SliceRules = Serde::deserialize(ref fields).unwrap();
    let resources: Span<ResourceRule> = Serde::deserialize(ref fields).unwrap();
    let buildings: Span<crate::buildings::BuildingRuleConfig> = Serde::deserialize(ref fields).unwrap();
    start_cheat_caller_address(deployment.games, authority());
    start_cheat_caller_address(deployment.games, authority());
    IResourceOperationsDispatcher { contract_address: deployment.games }.configure_resources(3, resources);
    crate::buildings::IBuildingRulesDispatcherTrait::configure_buildings(
        crate::buildings::IBuildingRulesDispatcher { contract_address: deployment.games }, 3, buildings, None,
    );

    stop_cheat_caller_address(deployment.games);
    start_cheat_caller_address(deployment.games, deployment.games);
    let realm = ISettlementCreationDispatcher { contract_address: deployment.games }
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
    stop_cheat_caller_address(deployment.games);
    (deployment, realm)
}

fn run(deployment: Deployment, command: Command, timestamp: u64) -> bool {
    start_cheat_block_timestamp_global(timestamp);
    let season = IGamesAuthenticationDispatcher { contract_address: deployment.games };
    let action = recorded::FixtureAction {
        command,
        rules: IGameDispatcher { contract_address: deployment.games }.rules(3),
        nonce: season.next_nonce(3, deployment.actor),
        deadline: 10000,
        ..intent(deployment, 3),
    };
    let signed = signature(deployment, action);
    let ticket = recorded::make_intent(deployment.games, action);
    let recorded_context = recorded::make_context(
        deployment.games, action, ExecutionContext { timestamp, ..context() },
    );
    snforge_std::start_cheat_block_timestamp(deployment.games, timestamp);
    snforge_std::cheat_caller_address(deployment.games, super::submitter(), snforge_std::CheatSpan::TargetCalls(1));
    eternum_randomness_protocol::entrypoint::IRecordedExecutionDispatcherTrait::execute(
        eternum_randomness_protocol::entrypoint::IRecordedExecutionDispatcher { contract_address: deployment.games },
        ticket,
        recorded_context,
        signed,
    );
    IRecordedExecutionViewsDispatcher { contract_address: deployment.games }
        .recorded_outcome(3, super::recorded::head(deployment.games, 3).order)
        .unwrap()
        .status == 1
}

fn settle(realm: u32, pass_id: u16) -> Command {
    Command::SettleVillage(SettleVillage { pass_id, connected_realm_entity_id: realm })
}

#[test]
#[feature("safe_dispatcher")]
fn production_pass_is_atomic_single_use_and_army_grant_uses_recorded_time() {
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
        assert!(tile.data % 0x20000000000 == 0, "realm neighbours must be biome only");
        assert!(tile.data / 0x20000000000 % 256 != 0, "realm neighbour biome missing");
    }
    let pools = ISettlementPoolDispatcher { contract_address: deployment.games };
    let before = pools.village_pool(3);
    assert!(!run(deployment, settle(0xffffffff, 7), 100));
    assert!(ledger.village_pass(pass).unwrap().unwrap().village_id == 0);
    assert!(pools.village_pool(3) == before, "failed placement retained reservations");
    assert!(run(deployment, settle(realm, 7), 100));
    let village_id = ledger.village_pass(pass).unwrap().unwrap().village_id;
    let structures = IStructureOperationsDispatcher { contract_address: deployment.games };
    let resource_store = IResourceOperationsDispatcher { contract_address: deployment.games };
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
    let map = IMapLogicDispatcher { contract_address: deployment.games };
    for direction in 0_u8..6 {
        let tile = map.tile(crate::geometry::tile_key(3, crate::geometry::neighbor(coord, direction))).unwrap();
        assert!(tile.data % 0x20000000000 == 0, "settlement surroundings must have no occupant or discovery");
        assert!(tile.data / 0x20000000000 % 256 != 0, "neighbour biome missing");
    }
    assert!(
        crate::game::IPointsDispatcher { contract_address: deployment.games }.player_points(3, deployment.actor) == 0,
    );
    assert!(!run(deployment, settle(realm, 7), 100));
    assert!(!run(deployment, Command::ReceiveVillageArmy(village_id), 100));
    let interval = recorded::rules().tick_config.armies_tick_in_seconds;
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

fn register_pass(deployment: Deployment, pass_id: u16) -> VillagePassKey {
    let key = VillagePassKey { game_id: 3, pass_id };
    start_cheat_caller_address(deployment.games, authority());
    IVillagesDispatcher { contract_address: deployment.games }.register_village_pass(key, deployment.actor);
    stop_cheat_caller_address(deployment.games);
    key
}

fn assert_blitz_village(mode: SettlementMode) {
    let (deployment, realm) = setup_config(
        false,
        mode,
        crate::rules::SliceRules {
            mode_rules: super::recorded::BLITZ_RULES,
            entry_rule: crate::rules::ENTRY_ROSTER,
            command_mask: super::recorded::BLITZ_COMMAND_MASK,
            ..recorded::rules(),
        },
    );
    let pass = register_pass(deployment, 1);
    assert!(run(deployment, settle(realm, 1), 100));
    let ledger = IVillagesDispatcher { contract_address: deployment.games };
    assert!(ledger.village_pass(pass).unwrap().village_id != 0);
    assert!(!run(deployment, settle(realm, 1), 100));
    let progress = crate::settlement::ISettlementViewsDispatcherTrait::settlement_progress(
        crate::settlement::ISettlementViewsDispatcher { contract_address: deployment.games }, 3,
    );
    assert!(progress.registered == 0 && progress.realm_count == 0);
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
    let ledger = IVillagesDispatcher { contract_address: deployment.games };
    assert!(ledger.village_pass(pass).unwrap().village_id == 0);
    let pool = ISettlementPoolDispatcher { contract_address: deployment.games };
    assert!(pool.village_pool(3).opened == 0 && pool.settlement_pool(3).opened == 0);
    let season = IGamesAuthenticationDispatcher { contract_address: deployment.games };
    let result = IRecordedExecutionViewsDispatcher { contract_address: deployment.games }
        .recorded_outcome(3, 1)
        .unwrap();
    assert!(result.status == 2 && result.reason == 'GAMEPLAY_REJECTED');
    assert!(super::recorded::head(deployment.games, 3).order == 1 && season.next_nonce(3, deployment.actor) == 1);
}

#[test]
fn season_settlement_random_draw_reserves_realm_and_provisions_its_economy() {
    let (deployment, _) = setup(true);
    super::entry::set_operator(deployment, 0.try_into().unwrap());
    // Catalogue loading is covered separately; this draw uses the pinned salt 71419
    // after scoping raw root 987654321 to game 3 with seed 1: realm 2239.
    super::resource_commands::set_fixture(
        deployment.games, selector!("realms"), selector!("catalogue_count"), array![].span(), 8000_u32,
    );
    super::resource_commands::set_fixture(
        deployment.games, selector!("realms"), selector!("traits"), array![2239].span(), 0x9000002_u32,
    );
    let mut spy = spy_events();
    assert!(
        run(
            deployment,
            Command::SettleSeason(crate::realms::SettleSeason { name: 'Season player', selected_realm: Option::None }),
            100,
        ),
    );
    let mut created = Option::None;
    for (_, event) in spy.get_events().emitted_by(deployment.games).events.span() {
        if *event.keys.at(0) == selector!("StoryEvent") {
            let mut keys = event.keys.span();
            let _ = keys.pop_front(); // event selector
            let _ = keys.pop_front(); // version
            let _ = keys.pop_front(); // game
            let _ = keys.pop_front(); // story id
            let _: Option<starknet::ContractAddress> = Serde::deserialize(ref keys).unwrap();
            let entity: Option<u32> = Serde::deserialize(ref keys).unwrap();
            let mut values = event.data.span();
            let story: crate::ownership::Story = Serde::deserialize(ref values).unwrap();
            if let crate::ownership::Story::RealmCreatedStory(_) = story {
                created = entity;
            }
        }
    }
    let id = created.expect('missing realm story');
    let key = ResourceKey { game_id: 3, entity_id: id };
    let row = IStructureOperationsDispatcher { contract_address: deployment.games }.structure(key).unwrap();
    assert_eq!(row.metadata.realm_id, 2239);
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
        crate::names::INamesDispatcherTrait::address_name(
            crate::names::INamesDispatcher { contract_address: deployment.games }, deployment.actor,
        )
            .name,
        'Season player',
    );
    assert_eq!(
        crate::realms::ISeasonRealmsDispatcherTrait::available_realm(
            crate::realms::ISeasonRealmsDispatcher { contract_address: deployment.games }, 3, 2238,
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
fn assert_season_entitlement_mode(dev: bool, has_operator: bool, has_entitlement: bool) {
    let (d, _) = setup(dev);
    // The authenticated account is the player that holds entitlements.
    let owner = d.actor;
    if has_entitlement {
        super::resource_commands::set_fixture(
            d.games,
            selector!("settlements"),
            selector!("entitlements"),
            array![3, owner.into()].span(),
            Some(
                crate::settlement::EntryEntitlement {
                    realm_id: 7, metadata_1: 0x0103070402020302010009, metadata_2: 0, metadata_3: 0, pass_kind: 1,
                },
            ),
        );
    }
    super::entry::set_operator(d, if has_operator {
        authority()
    } else {
        0.try_into().unwrap()
    });
    super::resource_commands::set_fixture(
        d.games, selector!("realms"), selector!("catalogue_count"), array![].span(), 8000_u32,
    );
    super::resource_commands::set_fixture(
        d.games, selector!("realms"), selector!("traits"), array![2239].span(), 0x9000002_u32,
    );
    let mut spy = spy_events();
    assert_eq!(
        run(
            d,
            Command::SettleSeason(crate::realms::SettleSeason { name: 'Season player', selected_realm: Option::None }),
            100,
        ),
        dev || has_entitlement,
    );
    let mut created = false;
    for (_, event) in spy.get_events().emitted_by(d.games).events.span() {
        if event.keys.len() >= 3
            && *event.keys.at(event.keys.len() - 3) == selector!("RowSet")
            && *event.keys.at(event.keys.len() - 1) == 'Structure' {
            let mut data = event.data.span();
            let _: Span<felt252> = Serde::deserialize(ref data).unwrap();
            let mut values: Span<felt252> = Serde::deserialize(ref data).unwrap();
            let record: crate::structures::Structure = Serde::deserialize(ref values).unwrap();
            assert_eq!(record.metadata.realm_id, if dev {
                2239
            } else {
                7
            });
            created = true;
        }
    }
    assert_eq!(created, dev || has_entitlement);
}
