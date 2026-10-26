pub use crate::commands::Command;
pub use crate::discovery::{Discovery, ethereal, surface};
pub use crate::map::IMapLogicDispatcher;
pub use crate::ownership::TransferOwnership;
pub use crate::resources::{ResourceAmount, ResourceKey};
pub use crate::structures::{IStructureOperationsDispatcher, StructureRecord};
pub use crate::tests::state::{MapObservationTrait, StructureObservationTrait};
pub use crate::upgrades::{UpgradeLimits, UpgradeRecipe};
pub use super::resource_commands::{assert_terminal_rejection, execute, grant, set_fixture, setup, setup_with_rules};
pub fn record(d: super::Deployment, key: ResourceKey) -> StructureRecord {
    let row = IStructureOperationsDispatcher { contract_address: d.games }.structure(key).unwrap();
    StructureRecord { owner: row.owner, base: row.base, resources_packed: row.resources_packed, metadata: row.metadata }
}
pub fn save(d: super::Deployment, key: ResourceKey, row: StructureRecord) {
    set_fixture(
        d.games,
        selector!("structures"),
        selector!("structures"),
        array![key.game_id.into(), key.entity_id.into()].span(),
        row,
    );
}
