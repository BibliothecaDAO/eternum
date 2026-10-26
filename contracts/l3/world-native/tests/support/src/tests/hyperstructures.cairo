pub use snforge_std::{
    EventSpyTrait, EventsFilterTrait, start_cheat_block_timestamp_global, start_cheat_caller_address,
    stop_cheat_caller_address,
};
pub use starknet::storage::StorageMapReadAccess;
pub use crate::commands::{Command, ExecutionContext};
pub use crate::game::IPointsDispatcherTrait;
pub use crate::hyperstructures::{
    AllocateShares, ConstructionAccess, ConstructionResource, Contribution, HyperstructureRules,
    IHyperstructuresDispatcher, IHyperstructuresDispatcherTrait, IHyperstructuresSafeDispatcher,
    IHyperstructuresSafeDispatcherTrait, SetConstructionAccess, Share, ShareAllocation, Stage,
};
pub use crate::registrar::IRegistrarSafeDispatcherTrait;
pub use crate::resources::{IResourceOperationsDispatcher, ResourceAmount, ResourceKey, ResourceSlot};
pub use crate::rules::RESOURCE_PRECISION;
pub use crate::settlement::{IBlitzHyperstructuresDispatcherTrait, IBlitzHyperstructuresLibraryDispatcher};
pub use crate::structures::{IStructureOperationsDispatcher, IStructureOperationsDispatcherTrait, StructureRecord};
pub use crate::tests::state::{ResourceObservationTrait, StructureObservationTrait};
pub use super::resource_commands::{assert_terminal_rejection, execute, grant, set_fixture};
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
pub fn setup_with_threshold(points: u128) -> (super::Deployment, ResourceKey, ResourceKey, ResourceKey) {
    setup_mode_with_threshold(false, points, None)
}
pub fn setup_mode(blitz: bool) -> (super::Deployment, ResourceKey, ResourceKey, ResourceKey) {
    setup_mode_with_threshold(blitz, 0, None)
}
pub fn setup_mode_with_threshold(
    blitz: bool, points: u128, mode: Option<crate::settlement::SettlementMode>,
) -> (super::Deployment, ResourceKey, ResourceKey, ResourceKey) {
    let mut ruleset = super::play_fixture::rules();
    ruleset.mode_rules = if blitz {
        super::play_fixture::BLITZ_RULES
    } else {
        super::play_fixture::ETERNUM_RULES
    };
    ruleset
        .command_mask =
            if blitz {
                super::play_fixture::BLITZ_COMMAND_MASK
            } else {
                super::play_fixture::ETERNUM_COMMAND_MASK
            };
    ruleset.entry_rule = if blitz {
        crate::rules::ENTRY_ROSTER
    } else {
        crate::rules::ENTRY_ENTITLEMENT
    };
    ruleset.victory_points_grant_config.hyp_points_per_second = 1000;
    let mut preset = super::resource_commands::fixture_preset(ruleset);
    preset.economy.hyperstructures = rules();
    preset.season_win_points = points;
    if let Some(mode) = mode {
        preset.settlement.mode = mode;
        preset.settlement.spacing = 6;
        preset.settlement.realms = super::settlement::grants_for(preset.rules.entry_rule);
    }
    let (deployment, first, second) = super::resource_commands::setup_with_preset(preset);
    start_cheat_caller_address(deployment.games, deployment.games);
    start_cheat_block_timestamp_global(30);
    let id = IStructureOperationsDispatcher { contract_address: deployment.games }
        .create_discovery(
            3,
            1,
            crate::troops::Coord { alt: false, x: 2000100, y: 2000000 },
            crate::discovery::Discovery::Hyperstructure,
            101,
            30,
            crate::commands::action_context(
                crate::commands::ExecutionContext { timestamp: 30, ..crate::tests::context(deployment.games, 3) },
            ),
        );
    stop_cheat_caller_address(deployment.games);
    let hyper = ResourceKey { game_id: 3, entity_id: id };
    owner(deployment, hyper, deployment.actor);
    grant(deployment, hyper, 24, 5 * RESOURCE_PRECISION);
    for key in array![first, second] {
        grant(deployment, key, 2, 100 * RESOURCE_PRECISION);
        grant(deployment, key, 3, 100 * RESOURCE_PRECISION);
    }
    (deployment, hyper, first, second)
}
pub fn view(deployment: super::Deployment) -> IHyperstructuresDispatcher {
    IHyperstructuresDispatcher { contract_address: deployment.games }
}
pub fn owner(deployment: super::Deployment, key: ResourceKey, owner: starknet::ContractAddress) {
    let value = IStructureOperationsDispatcher { contract_address: deployment.games }.structure(key).unwrap();
    set_fixture(
        deployment.games,
        selector!("structures"),
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
pub fn balance(deployment: super::Deployment, key: ResourceKey, resource_type: u8) -> u128 {
    IResourceOperationsDispatcher { contract_address: deployment.games }
        .resource_balance(ResourceSlot { game_id: key.game_id, entity_id: key.entity_id, resource_type })
}
pub fn points(deployment: super::Deployment, actor: starknet::ContractAddress) -> u128 {
    crate::game::IPointsDispatcher { contract_address: deployment.games }.player_points(3, actor)
}
pub fn access(hyper: ResourceKey, access: ConstructionAccess) -> Command {
    Command::SetConstructionAccess(SetConstructionAccess { hyperstructure_id: hyper.entity_id, access })
}
pub fn complete(deployment: super::Deployment, hyper: ResourceKey, from: ResourceKey) {
    assert!(execute(deployment, Command::InitializeHyperstructure(hyper.entity_id), 40));
    assert!(execute(deployment, contribute(hyper, from, array![amount(2, 10), amount(3, 20)].span()), 50));
}
pub fn allocate(hyper: ResourceKey, shares: Span<Share>) -> Command {
    Command::AllocateHyperstructureShares(AllocateShares { hyperstructure_id: hyper.entity_id, shareholders: shares })
}
pub fn checkpoint(deployment: super::Deployment, timestamp: u64) {
    snforge_std::start_cheat_block_timestamp(deployment.games, timestamp);
    start_cheat_caller_address(deployment.games, deployment.games);
    assert_eq!(
        view(deployment)
            .settle_completed_hyperstructures(
                3,
                timestamp,
                crate::commands::action_context(
                    crate::commands::ExecutionContext {
                        timestamp: timestamp, ..crate::tests::context(deployment.games, 3),
                    },
                ),
            ),
        0,
    );
    stop_cheat_caller_address(deployment.games);
}
pub fn create_reserved(deployment: super::Deployment, timestamp: u64) -> ResourceKey {
    let coord = crate::troops::Coord { alt: false, x: 2000200, y: 2000000 };
    let tile = crate::geometry::tile_key(3, coord);
    snforge_std::interact_with_state(
        deployment.games,
        || {
            crate::logic::map::MapState::reveal(tile, 1);
            crate::logic::map::MapState::reserve_hyperstructure(tile);
        },
    );
    let library = IBlitzHyperstructuresLibraryDispatcher { class_hash: super::declare_logic("StructuresLogic") };
    start_cheat_caller_address(deployment.games, deployment.games);
    snforge_std::interact_with_state(
        deployment.games,
        || {
            library
                .create_reserved_hyperstructure(
                    3,
                    deployment.actor,
                    coord,
                    crate::commands::action_context(crate::commands::load_context(3, 42, timestamp)),
                );
        },
    );
    stop_cheat_caller_address(deployment.games);
    ResourceKey {
        game_id: 3,
        entity_id: snforge_std::interact_with_state(
            deployment.games, || crate::logic::map::occupancy(tile).unwrap().entity_id,
        ),
    }
}
pub fn capture(deployment: super::Deployment, hyper: ResourceKey, home: ResourceKey, timestamp: u64) {
    snforge_std::start_cheat_block_timestamp(deployment.games, timestamp);
    start_cheat_caller_address(deployment.games, deployment.games);
    crate::guards::IStructureCaptureDispatcherTrait::capture_structure(
        crate::guards::IStructureCaptureDispatcher { contract_address: deployment.games },
        hyper,
        home.entity_id,
        timestamp,
        crate::commands::action_context(ExecutionContext { timestamp, ..crate::tests::context(deployment.games, 3) }),
    );
    stop_cheat_caller_address(deployment.games);
}
pub /// The shares writes one hyperstructure emitted, in order: 'set' for a full row, else the member written.
fn share_writes(
    ref events: snforge_std::EventSpy, deployment: super::Deployment, hyper: ResourceKey,
) -> Array<felt252> {
    let mut writes = array![];
    for (_, event) in events.get_events().emitted_by(deployment.games).events.span() {
        if event.keys.len() < 4
            || *event.keys.at(3) != 'HyperstructureShares'
            || *event.data.at(2) != hyper.entity_id.into() {
            continue;
        }
        if *event.keys.at(1) == selector!("RowSet") {
            writes.append('set');
        } else if *event.keys.at(1) == selector!("RowMemberSet") {
            writes.append(*event.keys.at(4));
        }
    }
    writes
}
