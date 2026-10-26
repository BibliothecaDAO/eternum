pub use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
pub use crate::artificer::{
    IArtificerDispatcher, IArtificerDispatcherTrait, IArtificerSafeDispatcher, IArtificerSafeDispatcherTrait, RESEARCH,
};
pub use crate::commands::Command;
pub use crate::game::IGameDispatcherTrait;
pub use crate::registrar::IRegistrarSafeDispatcherTrait;
pub use crate::resources::{IResourceOperationsDispatcher, ResourceKey, ResourceSlot};
pub use crate::rules::RESOURCE_PRECISION;
pub use crate::structures::{IStructureOperationsDispatcher, StructureRecord};
pub use crate::tests::state::{ResourceObservationTrait, StructureObservationTrait};
pub use super::resource_commands::{assert_terminal_rejection, execute, grant, set_fixture};
pub fn view(d: super::Deployment) -> IArtificerDispatcher {
    IArtificerDispatcher { contract_address: d.games }
}
pub fn setup(blitz: bool) -> (super::Deployment, ResourceKey) {
    let mut rules = super::play_fixture::rules();
    rules.mode_rules = if blitz {
        super::play_fixture::BLITZ_RULES
    } else {
        super::play_fixture::ETERNUM_RULES
    };
    rules
        .command_mask =
            if blitz {
                super::play_fixture::BLITZ_COMMAND_MASK
            } else {
                super::play_fixture::ETERNUM_COMMAND_MASK
            };
    rules.entry_rule = if blitz {
        crate::rules::ENTRY_ROSTER
    } else {
        crate::rules::ENTRY_ENTITLEMENT
    };
    let mut preset = super::resource_commands::fixture_preset(rules);
    preset.economy.research_cost = 10 * RESOURCE_PRECISION;
    preset.economy.relics = super::relics::rules();
    preset.economy.chests = None;
    let (d, home, _) = super::resource_commands::setup_with_preset(preset);
    grant(d, home, RESEARCH, 20 * RESOURCE_PRECISION);
    (d, home)
}
pub fn balance(d: super::Deployment, home: ResourceKey, id: u8) -> u128 {
    IResourceOperationsDispatcher { contract_address: d.games }
        .resource_balance(ResourceSlot { game_id: home.game_id, entity_id: home.entity_id, resource_type: id })
}
pub fn structure(d: super::Deployment, key: ResourceKey, owner: starknet::ContractAddress, category: u8) {
    let value = IStructureOperationsDispatcher { contract_address: d.games }.structure(key).unwrap();
    set_fixture(
        d.games,
        selector!("structures"),
        selector!("structures"),
        array![key.game_id.into(), key.entity_id.into()].span(),
        StructureRecord {
            owner,
            base: crate::structures::StructureBase { category, ..value.base },
            resources_packed: value.resources_packed,
            metadata: value.metadata,
        },
    );
}
