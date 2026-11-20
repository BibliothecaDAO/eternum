pub use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
pub use crate::buildings::CreateBuilding;
pub use crate::commands::Command;
pub use crate::resources::{
    IResourceOperationsDispatcher, IResourceOperationsDispatcherTrait, Production, ResourceKey, ResourceSlot,
    UNLIMITED_OUTPUT,
};
pub use crate::tests::state::ResourceObservationTrait;
pub use super::resource_commands::{execute, grant, set_fixture};
pub const LABOR: u8 = 23;
pub const BARRACKS: u8 = 28;
pub const KNIGHT: u8 = 26;
pub const WORN: u128 = UNLIMITED_OUTPUT - 1_000_000;
pub fn resources(deployment: super::Deployment) -> IResourceOperationsDispatcher {
    IResourceOperationsDispatcher { contract_address: deployment.games }
}
pub fn slot(home: ResourceKey, resource_type: u8) -> ResourceSlot {
    ResourceSlot { game_id: home.game_id, entity_id: home.entity_id, resource_type }
}
pub fn context(deployment: super::Deployment, home: ResourceKey) -> crate::commands::ResourceContext {
    crate::commands::resource_context(super::context(deployment.games, home.game_id))
}
pub /// Spending nothing settles one resource, as any action that touches it does.
 fn settle(deployment: super::Deployment, home: ResourceKey, resource_type: u8, timestamp: u64) -> Production {
    start_cheat_caller_address(deployment.games, deployment.games);
    resources(deployment).spend_resource(home, resource_type, 0, timestamp, context(deployment, home));
    stop_cheat_caller_address(deployment.games);
    resources(deployment).resource_production(slot(home, resource_type))
}
pub /// A realm's labor producer as provisioning starts it: no cap on what it may make.
 fn start_unlimited_labor(deployment: super::Deployment, home: ResourceKey, timestamp: u64) {
    start_cheat_caller_address(deployment.games, deployment.games);
    resources(deployment).start_production(home, LABOR, 3, UNLIMITED_OUTPUT, timestamp, context(deployment, home));
    stop_cheat_caller_address(deployment.games);
}
pub fn labor_stays_unlimited_through_every_settlement() {
    let (deployment, home, _) = super::resource_commands::setup();
    let start = super::play_fixture::FIXTURE_START;
    start_unlimited_labor(deployment, home, start + 40);
    let rate: u128 = resources(deployment).resource_production(slot(home, LABOR)).production_rate.into();
    let before = resources(deployment).resource_balance(slot(home, LABOR));
    for timestamp in array![start + 50, start + 60, start + 75, start + 100] {
        assert_eq!(settle(deployment, home, LABOR, timestamp).output_amount_left, UNLIMITED_OUTPUT);
    }
    assert_eq!(resources(deployment).resource_balance(slot(home, LABOR)), before + rate * 60);
}
