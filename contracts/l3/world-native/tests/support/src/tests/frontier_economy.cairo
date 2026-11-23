pub use snforge_std::{EventSpyTrait, EventsFilterTrait, start_cheat_caller_address, stop_cheat_caller_address};
pub use crate::buildings::{ChangeBuilding, CreateBuilding};
pub use crate::commands::{Command, CreateExplorer};
pub use crate::production::RefillProduction;
pub use crate::resources::{
    IResourceOperationsDispatcher, IResourceOperationsDispatcherTrait, IResourceOperationsSafeDispatcher,
    IResourceOperationsSafeDispatcherTrait, ResourceAmount, ResourceKey, ResourceRule, ResourceSlot,
};
pub use crate::rules::RESOURCE_PRECISION;
pub use crate::structures::IStructureOperationsDispatcher;
pub use crate::tests::state::{ResourceObservationTrait, StructureObservationTrait};
pub use crate::troop_management::{ManageTroops, RecruitExplorer};
pub use crate::troops::Coord;
pub use super::resource_commands::{assert_terminal_rejection, execute, grant, set_fixture};
pub const KNIGHT: u8 = 26;
pub const WHEAT: u8 = 35;
pub const BARRACKS: u8 = 28;
pub const FARM: u8 = 37;
pub const EAST: u8 = 0;
pub const WEST: u8 = 3;
pub fn frontier_realm() -> (super::Deployment, ResourceKey) {
    let (deployment, home) = super::building_commands::building_world();
    grant(deployment, home, crate::resources::LABOR, 1000000 * RESOURCE_PRECISION);
    (deployment, home)
}
pub fn build(home: ResourceKey, category: u8, direction: u8) -> Command {
    Command::CreateBuilding(
        CreateBuilding {
            structure_id: home.entity_id, directions: array![direction].span(), category, use_simple: true,
        },
    )
}
pub fn demolish(home: ResourceKey, direction: u8) -> Command {
    Command::DestroyBuilding(
        ChangeBuilding {
            structure_id: home.entity_id,
            coord: crate::geometry::neighbor(Coord { alt: false, x: 10, y: 10 }, direction),
        },
    )
}
pub fn raise(home: ResourceKey, troops: u128, direction: u8, slot: u8) -> Command {
    Command::CreateExplorer(
        CreateExplorer {
            slot, structure_id: home.entity_id, category: 0, tier: 0, amount: troops * RESOURCE_PRECISION, direction,
        },
    )
}
pub fn reinforce(explorer_id: u64, troops: u128) -> Command {
    Command::ManageTroops(
        ManageTroops::RecruitExplorer(
            RecruitExplorer { explorer_id, amount: troops * RESOURCE_PRECISION, supply_post: None },
        ),
    )
}
pub fn resources(deployment: super::Deployment) -> IResourceOperationsDispatcher {
    IResourceOperationsDispatcher { contract_address: deployment.games }
}
pub fn slot(home: ResourceKey, resource_type: u8) -> ResourceSlot {
    ResourceSlot { game_id: home.game_id, entity_id: home.entity_id, resource_type }
}
pub fn stored(deployment: super::Deployment, home: ResourceKey, resource_type: u8) -> u128 {
    resources(deployment).resource_balance(slot(home, resource_type))
}
pub fn rate(deployment: super::Deployment, home: ResourceKey, resource_type: u8) -> u128 {
    resources(deployment).resource_production(slot(home, resource_type)).production_rate.into()
}
pub /// Spending nothing is the smallest action that touches one resource.
 fn settle(deployment: super::Deployment, home: ResourceKey, resource_type: u8, timestamp: u64) {
    start_cheat_caller_address(deployment.games, deployment.games);
    resources(deployment)
        .spend_resource(
            home,
            resource_type,
            0,
            timestamp,
            crate::commands::resource_context(super::context(deployment.games, home.game_id)),
        );
    stop_cheat_caller_address(deployment.games);
}
pub fn spend(deployment: super::Deployment, home: ResourceKey, resource_type: u8, amount: u128, timestamp: u64) {
    start_cheat_caller_address(deployment.games, deployment.games);
    resources(deployment)
        .spend_resource(
            home,
            resource_type,
            amount,
            timestamp,
            crate::commands::resource_context(super::context(deployment.games, home.game_id)),
        );
    stop_cheat_caller_address(deployment.games);
}
pub fn castle_limit(level: u8) -> u128 {
    let cap = crate::troops::deployment_cap(crate::balance::rules::TROOP_LIMIT_CONFIG, level);
    2 * Into::<u32, u128>::into(cap) * RESOURCE_PRECISION
}
pub /// Stores exactly `amount`, under the limit, to leave a store a known room.
 fn store_exactly(deployment: super::Deployment, home: ResourceKey, resource_type: u8, amount: u128) {
    set_fixture(
        deployment.games,
        selector!("resources"),
        selector!("balances"),
        array![home.game_id.into(), home.entity_id.into(), resource_type.into()].span(),
        amount,
    );
}
pub fn allow_armies(deployment: super::Deployment, home: ResourceKey) {
    let original = IStructureOperationsDispatcher { contract_address: deployment.games }.structure(home).unwrap();
    set_fixture(
        deployment.games,
        selector!("structures"),
        selector!("structures"),
        array![home.game_id.into(), home.entity_id.into()].span(),
        crate::structures::StructureRecord {
            owner: original.owner,
            base: crate::structures::StructureBase { troop_max_explorer_count: 4, ..original.base },
            resources_packed: original.resources_packed,
            metadata: original.metadata,
        },
    );
}
