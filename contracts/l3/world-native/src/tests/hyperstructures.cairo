use snforge_std::{start_cheat_block_timestamp_global, start_cheat_caller_address, stop_cheat_caller_address};
use crate::commands::{Command, ExecutionContext};
use crate::game::{IGameDispatcher, IGameDispatcherTrait};
use crate::hyperstructures::{
    AllocateShares, ConstructionAccess, ConstructionResource, Contribution, HyperstructureRules,
    IHyperstructuresDispatcher, IHyperstructuresDispatcherTrait, IHyperstructuresSafeDispatcher,
    IHyperstructuresSafeDispatcherTrait, SetConstructionAccess, Share, Stage,
};
use crate::resources::{IResourcesDispatcher, IResourcesDispatcherTrait, ResourceAmount, ResourceKey, ResourceSlot};
use crate::rules::RESOURCE_PRECISION;
use crate::structures::{IStructuresDispatcher, IStructuresDispatcherTrait, StructureRecord};
use super::resource_commands::{
    assert_terminal_rejection, execute, execute_recorded_at, grant, set_fixture, setup_with_rules,
};

pub fn rules() -> HyperstructureRules {
    HyperstructureRules {
        initialize_shards: 5 * RESOURCE_PRECISION,
        resources: array![
            ConstructionResource { resource_type: 2, minimum: 10, maximum: 10, points: 1000 },
            ConstructionResource { resource_type: 3, minimum: 20, maximum: 20, points: 2000 },
        ]
            .span(),
    }
}
pub fn setup() -> (super::Deployment, ResourceKey, ResourceKey, ResourceKey) {
    setup_mode(false)
}
pub fn setup_mode(blitz: bool) -> (super::Deployment, ResourceKey, ResourceKey, ResourceKey) {
    let mut ruleset = super::recorded::rules();
    ruleset.mode_rules = if blitz {
        super::recorded::BLITZ_RULES
    } else {
        super::recorded::ETERNUM_RULES
    };
    ruleset
        .command_mask = if blitz {
            super::recorded::BLITZ_COMMAND_MASK
        } else {
            super::recorded::ETERNUM_COMMAND_MASK
        };
    ruleset.entry_rule = if blitz {
        crate::rules::ENTRY_ROSTER
    } else {
        crate::rules::ENTRY_ENTITLEMENT
    };
    ruleset.victory_points_grant_config.hyp_points_per_second = 1000;
    let (deployment, first, second) = setup_with_rules(ruleset);
    start_cheat_caller_address(deployment.peers.economy, super::authority());
    view(deployment).configure_hyperstructures(3, rules());
    stop_cheat_caller_address(deployment.peers.economy);
    start_cheat_caller_address(deployment.peers.structures, deployment.peers.troops);
    start_cheat_block_timestamp_global(30);
    let id = IStructuresDispatcher { contract_address: deployment.peers.structures }
        .create_discovery(
            3,
            crate::troops::Coord { alt: false, x: 2000100, y: 2000000 },
            crate::discovery::Discovery::Hyperstructure,
            101,
            30,
        );
    stop_cheat_caller_address(deployment.peers.structures);
    let hyper = ResourceKey { game_id: 3, entity_id: id };
    owner(deployment, hyper, deployment.actor);
    grant(deployment, hyper, 24, 5 * RESOURCE_PRECISION);
    for key in array![first, second] {
        grant(deployment, key, 2, 100 * RESOURCE_PRECISION);
        grant(deployment, key, 3, 100 * RESOURCE_PRECISION);
    }
    (deployment, hyper, first, second)
}
fn view(deployment: super::Deployment) -> IHyperstructuresDispatcher {
    IHyperstructuresDispatcher { contract_address: deployment.peers.economy }
}
pub fn owner(deployment: super::Deployment, key: ResourceKey, owner: starknet::ContractAddress) {
    let value = IStructuresDispatcher { contract_address: deployment.peers.structures }.structure(key).unwrap();
    set_fixture(
        deployment.peers.structures,
        selector!("structures"),
        array![key.game_id.into(), key.entity_id.into()].span(),
        StructureRecord { owner, base: value.base, resources_packed: value.resources_packed, metadata: value.metadata },
    );
}
pub fn contribute(hyper: ResourceKey, from: ResourceKey, resources: Span<ResourceAmount>) -> Command {
    Command::ContributeHyperstructure(
        Contribution { hyperstructure_id: hyper.entity_id, from_structure_id: from.entity_id, resources },
    )
}
pub fn amount(resource_type: u8, amount: u128) -> ResourceAmount {
    ResourceAmount { resource_type, amount: amount * RESOURCE_PRECISION }
}
fn balance(deployment: super::Deployment, key: ResourceKey, resource_type: u8) -> u128 {
    IResourcesDispatcher { contract_address: deployment.peers.resources }
        .resource_balance(ResourceSlot { game_id: key.game_id, entity_id: key.entity_id, resource_type })
}
fn points(deployment: super::Deployment, actor: starknet::ContractAddress) -> u128 {
    IGameDispatcher { contract_address: deployment.peers.season }.player_points(3, actor)
}
fn access(hyper: ResourceKey, access: ConstructionAccess) -> Command {
    Command::SetConstructionAccess(SetConstructionAccess { hyperstructure_id: hyper.entity_id, access })
}
pub fn complete(deployment: super::Deployment, hyper: ResourceKey, from: ResourceKey) {
    assert!(execute(deployment, Command::InitializeHyperstructure(hyper.entity_id), 40));
    assert!(execute(deployment, contribute(hyper, from, array![amount(2, 10), amount(3, 20)].span()), 50));
}
fn allocate(hyper: ResourceKey, shares: Span<Share>) -> Command {
    Command::AllocateHyperstructureShares(AllocateShares { hyperstructure_id: hyper.entity_id, shareholders: shares })
}

#[test]
fn initialization_burns_only_shards_and_progress_completes_with_clamped_contributions() {
    let (deployment, hyper, from, _) = setup();
    let original_points = points(deployment, deployment.actor);
    assert_eq!(view(deployment).hyperstructure(hyper).unwrap().stage, Stage::Foundation);
    assert_eq!(view(deployment).hyperstructure_count(3), 1);
    assert_eq!(view(deployment).hyperstructure_count(2), 0);
    assert!(execute(deployment, Command::InitializeHyperstructure(hyper.entity_id), 40));
    assert_eq!(balance(deployment, hyper, 24), 0);
    assert_eq!(view(deployment).hyperstructure(hyper).unwrap().stage, Stage::Construction);
    assert_terminal_rejection(deployment, Command::InitializeHyperstructure(hyper.entity_id), 40);
    assert!(execute(deployment, contribute(hyper, from, array![amount(2, 4)].span()), 45));
    assert_eq!(points(deployment, deployment.actor) - original_points, 400);
    assert!(execute(deployment, contribute(hyper, from, array![amount(2, 999), amount(3, 999)].span()), 50));
    assert_eq!(balance(deployment, from, 2), 90 * RESOURCE_PRECISION);
    assert_eq!(balance(deployment, from, 3), 80 * RESOURCE_PRECISION);
    assert_eq!(points(deployment, deployment.actor) - original_points, 3000);
    assert_eq!(view(deployment).hyperstructure(hyper).unwrap().stage, Stage::Complete);
    assert_eq!(view(deployment).completed_hyperstructure_count(3), 1);
    let allocation = view(deployment).hyperstructure_shares(hyper);
    assert_eq!(allocation.start_at, 50);
    assert_eq!(allocation.multiplier, 1);
    assert_eq!(allocation.shareholders, array![Share { player: deployment.actor, bps: 10000 }].span());
    let tile = crate::map::IMapDispatcherTrait::tile(
        crate::map::IMapDispatcher { contract_address: deployment.peers.map },
        crate::map::TileKey { game_id: 3, alt: false, col: 2000100, row: 2000000 },
    )
        .unwrap();
    assert_eq!(crate::map::structure_occupant(tile), Some(hyper.entity_id));
}
#[test]
fn contribution_rejections_roll_back_the_whole_batch_and_consume_the_ticket() {
    let (deployment, hyper, from, _) = setup();
    assert_terminal_rejection(deployment, contribute(hyper, from, array![amount(2, 1)].span()), 35);
    assert!(execute(deployment, Command::InitializeHyperstructure(hyper.entity_id), 40));
    let initial = points(deployment, deployment.actor);
    for resources in array![
        array![].span(), array![amount(2, 0)].span(),
        array![amount(2, 1), ResourceAmount { resource_type: 3, amount: 1 }].span(),
        array![amount(2, 10), amount(2, 1)].span(), array![amount(24, 1)].span(),
    ] {
        assert_terminal_rejection(deployment, contribute(hyper, from, resources), 45);
        assert_eq!(balance(deployment, from, 2), 100 * RESOURCE_PRECISION);
        assert_eq!(
            view(deployment)
                .hyperstructure_progress(ResourceSlot { game_id: 3, entity_id: hyper.entity_id, resource_type: 2 }),
            0,
        );
        assert_eq!(points(deployment, deployment.actor), initial);
    }
    assert_terminal_rejection(deployment, contribute(hyper, from, array![amount(2, 1)].span()), 200);
    assert_eq!(
        IGameDispatcher { contract_address: deployment.peers.season }.season_points(3),
        points(deployment, deployment.actor),
    );
}
#[test]
fn shares_checkpoint_old_owners_before_reallocation_and_stop_at_game_end() {
    let (deployment, hyper, from, _) = setup();
    complete(deployment, hyper, from);
    let old = points(deployment, deployment.actor);
    let other: starknet::ContractAddress = 987.try_into().unwrap();
    assert!(
        execute(
            deployment,
            allocate(
                hyper, array![Share { player: deployment.actor, bps: 2500 }, Share { player: other, bps: 7500 }].span(),
            ),
            100,
        ),
    );
    assert_eq!(points(deployment, deployment.actor) - old, 50000);
    checkpoint(deployment, 500);
    assert_eq!(points(deployment, deployment.actor) - old, 75000);
    assert_eq!(points(deployment, other), 75000);
    assert_eq!(view(deployment).hyperstructure_shares(hyper).start_at, 200);
    assert_eq!(points(deployment, other), 75000);
}
#[test]
fn delayed_construction_and_allocation_use_recorded_time_and_keep_same_rewards() {
    let (deployment, hyper, from, _) = setup();
    assert!(execute_recorded_at(deployment, Command::InitializeHyperstructure(hyper.entity_id), 40, 5000));
    assert!(
        execute_recorded_at(deployment, contribute(hyper, from, array![amount(2, 10), amount(3, 20)].span()), 50, 5001),
    );
    let old = points(deployment, deployment.actor);
    assert!(
        execute_recorded_at(
            deployment, allocate(hyper, array![Share { player: deployment.actor, bps: 10000 }].span()), 100, 5002,
        ),
    );
    assert_eq!(points(deployment, deployment.actor) - old, 50000);
    assert_eq!(view(deployment).hyperstructure_shares(hyper).start_at, 100);
}
#[test]
fn share_rejections_preserve_allocation_and_points() {
    let (deployment, hyper, from, _) = setup();
    complete(deployment, hyper, from);
    let initial = view(deployment).hyperstructure_shares(hyper);
    let old = points(deployment, deployment.actor);
    for shares in array![
        array![].span(), array![Share { player: deployment.actor, bps: 9999 }].span(),
        array![Share { player: 0.try_into().unwrap(), bps: 10000 }].span(),
        array![Share { player: deployment.actor, bps: 99 }, Share { player: deployment.actor, bps: 9901 }].span(),
    ] {
        assert_terminal_rejection(deployment, allocate(hyper, shares), 60);
        assert_eq!(view(deployment).hyperstructure_shares(hyper), initial);
        assert_eq!(points(deployment, deployment.actor), old);
    }
    let mut too_many = array![];
    for _ in 0_u32..21 {
        too_many.append(Share { player: deployment.actor, bps: 100 });
    }
    assert_terminal_rejection(deployment, allocate(hyper, too_many.span()), 60);
}
#[test]
#[feature("safe_dispatcher")]
fn construction_access_applies_to_contributor_and_current_owners_guild() {
    let (deployment, hyper, from, other) = setup();
    assert_terminal_rejection(deployment, access(hyper, ConstructionAccess::Public), 35);
    assert!(execute(deployment, Command::InitializeHyperstructure(hyper.entity_id), 40));
    let friend: starknet::ContractAddress = 987.try_into().unwrap();
    owner(deployment, other, friend);
    let safe = IHyperstructuresSafeDispatcher { contract_address: deployment.peers.economy };
    let command = Contribution {
        hyperstructure_id: hyper.entity_id, from_structure_id: other.entity_id, resources: array![amount(2, 1)].span(),
    };
    start_cheat_block_timestamp_global(45);
    start_cheat_caller_address(deployment.peers.economy, deployment.peers.season);
    assert!(
        safe
            .contribute_hyperstructure(3, friend, command, ExecutionContext { timestamp: 45, ..super::context() })
            .is_err(),
    );
    stop_cheat_caller_address(deployment.peers.economy);
    assert_terminal_rejection(deployment, access(hyper, ConstructionAccess::GuildOnly), 45);
    set_fixture(deployment.peers.registry, selector!("members"), array![3, deployment.actor.into()].span(), 1_felt252);
    assert!(execute(deployment, access(hyper, ConstructionAccess::GuildOnly), 45));
    start_cheat_caller_address(deployment.peers.economy, deployment.peers.season);
    assert!(
        safe
            .contribute_hyperstructure(3, friend, command, ExecutionContext { timestamp: 45, ..super::context() })
            .is_err(),
    );
    set_fixture(deployment.peers.registry, selector!("members"), array![3, friend.into()].span(), 1_felt252);
    assert!(
        safe
            .contribute_hyperstructure(3, friend, command, ExecutionContext { timestamp: 45, ..super::context() })
            .is_ok(),
    );
    stop_cheat_caller_address(deployment.peers.economy);
    assert!(execute(deployment, access(hyper, ConstructionAccess::Public), 46));
    set_fixture(deployment.peers.registry, selector!("members"), array![3, friend.into()].span(), 2_felt252);
    start_cheat_caller_address(deployment.peers.economy, deployment.peers.season);
    start_cheat_block_timestamp_global(46);
    assert!(
        safe
            .contribute_hyperstructure(3, friend, command, ExecutionContext { timestamp: 46, ..super::context() })
            .is_ok(),
    );
    assert!(
        safe
            .contribute_hyperstructure(
                3,
                friend,
                Contribution { from_structure_id: from.entity_id, ..command },
                ExecutionContext { timestamp: 46, ..super::context() },
            )
            .is_err(),
    );
}
#[test]
#[feature("safe_dispatcher")]
fn only_authority_configures_and_only_domains_create_or_mutate_hyperstructures() {
    let (deployment, hyper, from, _) = setup();
    let safe = IHyperstructuresSafeDispatcher { contract_address: deployment.peers.economy };
    assert!(safe.configure_hyperstructures(1, rules()).is_err());
    assert!(safe.record_hyperstructure(ResourceKey { game_id: 3, entity_id: 999 }, 1, false).is_err());
    assert!(safe.initialize_hyperstructure(3, deployment.actor, hyper.entity_id, super::context()).is_err());
    assert!(safe.settle_completed_hyperstructures(3, super::context().timestamp).is_err());
    start_cheat_caller_address(deployment.peers.economy, super::authority());
    assert!(safe.configure_hyperstructures(3, rules()).is_err());
    assert!(safe.configure_hyperstructures(1, HyperstructureRules { resources: array![].span(), ..rules() }).is_err());
    assert!(safe.configure_hyperstructures(1, rules()).is_ok());
    stop_cheat_caller_address(deployment.peers.economy);
    assert_terminal_rejection(deployment, Command::InitializeHyperstructure(from.entity_id), 40);
    owner(deployment, hyper, 987.try_into().unwrap());
    assert_terminal_rejection(deployment, Command::InitializeHyperstructure(hyper.entity_id), 40);
}
#[test]
fn construction_requirements_preserve_per_resource_seed_division_and_exclusive_maximum() {
    let cost = ConstructionResource { resource_type: 2, minimum: 10, maximum: 20, points: 1000 };
    assert_eq!(crate::hyperstructures::required_amount(101, cost), 10 * RESOURCE_PRECISION);
    assert_eq!(crate::hyperstructures::required_amount(119, cost), 19 * RESOURCE_PRECISION);
    assert_eq!(
        crate::hyperstructures::required_amount(119, ConstructionResource { resource_type: 3, ..cost }),
        19 * RESOURCE_PRECISION,
    );
    assert_eq!(
        crate::hyperstructures::required_amount(999, ConstructionResource { maximum: 10, ..cost }),
        10 * RESOURCE_PRECISION,
    );
}

pub fn settlement(deployment: super::Deployment, mode: crate::settlement::SettlementMode, spacing: u32) {
    let fields = snforge_std::fs::read_txt(@snforge_std::fs::FileTrait::new("tests/fixtures/settlement.txt"));
    let mut fields = fields.span();
    let grants: crate::settlement::RealmGrants = Serde::deserialize(ref fields).unwrap();
    start_cheat_caller_address(deployment.peers.settlement, super::authority());
    crate::settlement::ISettlementConfigurationDispatcherTrait::configure_settlement(
        crate::settlement::ISettlementConfigurationDispatcher { contract_address: deployment.peers.settlement },
        3,
        crate::settlement::SettlementRules { registration_start: 10, registration_limit: 96, mode, spacing },
        grants,
    );
    stop_cheat_caller_address(deployment.peers.settlement);
}
#[test]
fn blitz_duel_multiplier_and_owner_only_shares_match_entry_rules() {
    let (deployment, hyper, from, _) = setup_mode(true);
    settlement(deployment, crate::settlement::SettlementMode::Duel, 6);
    complete(deployment, hyper, from);
    assert_eq!(view(deployment).hyperstructure_shares(hyper).multiplier, 2);
    let before = points(deployment, deployment.actor);
    assert_terminal_rejection(
        deployment, allocate(hyper, array![Share { player: 987.try_into().unwrap(), bps: 10000 }].span()), 60,
    );
    assert_terminal_rejection(
        deployment,
        allocate(
            hyper,
            array![Share { player: deployment.actor, bps: 5000 }, Share { player: deployment.actor, bps: 5000 }].span(),
        ),
        60,
    );
    assert!(execute(deployment, allocate(hyper, array![Share { player: deployment.actor, bps: 10000 }].span()), 60));
    assert_eq!(points(deployment, deployment.actor) - before, 20000);
}
#[test]
fn blitz_multiplier_counts_realms_in_the_configured_geometry_and_preserves_old_rate() {
    let (deployment, hyper, from, _) = setup_mode(true);
    settlement(deployment, crate::settlement::SettlementMode::Single, 6);
    complete(deployment, hyper, from);
    assert_eq!(view(deployment).hyperstructure_shares(hyper).multiplier, 0);
    let coord = crate::geometry::checked_neighbor_at_distance(
        crate::geometry::checked_neighbor_at_distance(crate::troops::Coord { alt: false, x: 2000100, y: 2000000 }, 0, 8)
            .unwrap(),
        4,
        4,
    )
        .unwrap();
    start_cheat_caller_address(deployment.peers.structures, deployment.peers.settlement);
    crate::settlement::ISettlementCreationDispatcherTrait::create_settlement(
        crate::settlement::ISettlementCreationDispatcher { contract_address: deployment.peers.structures },
        3,
        deployment.actor,
        coord,
        crate::settlement::SettlementCreation::Realm(
            crate::settlement::RealmCreation {
                realm_id: 3,
                traits: crate::realms::RealmTraits { wonder: 0, order: 0, resources: array![].span() },
                grant_troops: false,
                activate_economy: false,
            },
        ),
        ExecutionContext { timestamp: 55, ..super::context() },
    );
    stop_cheat_caller_address(deployment.peers.structures);
    let before = points(deployment, deployment.actor);
    assert!(execute(deployment, allocate(hyper, array![Share { player: deployment.actor, bps: 10000 }].span()), 60));
    assert_eq!(points(deployment, deployment.actor), before);
    assert_eq!(view(deployment).hyperstructure_shares(hyper).multiplier, 1);
    checkpoint(deployment, 70);
    assert_eq!(points(deployment, deployment.actor) - before, 10000);
    assert_eq!(crate::settlement_grid::hyperstructure_scan_distance(8, crate::settlement::SettlementMode::Single), 10);
    assert_eq!(crate::settlement_grid::hyperstructure_scan_distance(6, crate::settlement::SettlementMode::Triple), 6);
}
#[test]
fn duplicate_shareholders_reject_without_changing_allocation_or_accrued_points() {
    let (deployment, hyper, from, _) = setup();
    complete(deployment, hyper, from);
    let initial = view(deployment).hyperstructure_shares(hyper);
    let before = points(deployment, deployment.actor);
    assert_terminal_rejection(
        deployment,
        allocate(
            hyper,
            array![Share { player: deployment.actor, bps: 2500 }, Share { player: deployment.actor, bps: 7500 }].span(),
        ),
        60,
    );
    assert_eq!(view(deployment).hyperstructure_shares(hyper), initial);
    assert_eq!(points(deployment, deployment.actor), before);
    checkpoint(deployment, 70);
    assert_eq!(points(deployment, deployment.actor) - before, 20000);
}

#[test]
fn insufficient_shards_or_a_later_resource_leave_construction_unchanged() {
    let (deployment, hyper, from, _) = setup();
    assert!(
        execute(
            deployment,
            Command::BurnStructureResources(
                crate::resources::ResourceBurn { entity_id: hyper.entity_id, resources: array![amount(24, 5)].span() },
            ),
            35,
        ),
    );
    assert_terminal_rejection(deployment, Command::InitializeHyperstructure(hyper.entity_id), 40);
    assert_eq!(view(deployment).hyperstructure(hyper).unwrap().stage, Stage::Foundation);
    grant(deployment, hyper, 24, 5 * RESOURCE_PRECISION);
    assert!(execute(deployment, Command::InitializeHyperstructure(hyper.entity_id), 40));
    assert!(
        execute(
            deployment,
            Command::BurnStructureResources(
                crate::resources::ResourceBurn { entity_id: from.entity_id, resources: array![amount(3, 100)].span() },
            ),
            41,
        ),
    );
    assert_terminal_rejection(deployment, contribute(hyper, from, array![amount(2, 10), amount(3, 20)].span()), 45);
    assert_eq!(balance(deployment, from, 2), 100 * RESOURCE_PRECISION);
    assert_eq!(
        view(deployment)
            .hyperstructure_progress(ResourceSlot { game_id: 3, entity_id: hyper.entity_id, resource_type: 2 }),
        0,
    );
    assert_eq!(view(deployment).hyperstructure(hyper).unwrap().stage, Stage::Construction);
}

pub fn checkpoint(deployment: super::Deployment, timestamp: u64) {
    snforge_std::start_cheat_block_timestamp(deployment.peers.economy, timestamp);
    start_cheat_caller_address(deployment.peers.economy, deployment.peers.season);
    assert_eq!(view(deployment).settle_completed_hyperstructures(3, timestamp), 0);
    stop_cheat_caller_address(deployment.peers.economy);
}
