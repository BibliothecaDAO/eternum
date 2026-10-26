pub use snforge_std::start_cheat_caller_address;
pub use crate::commands::Command;
pub use crate::faith::{
    ClaimPlayer, FaithRules, IFaithOwnershipViewsDispatcher, IFaithOwnershipViewsDispatcherTrait, IFaithSafeDispatcher,
    IFaithSafeDispatcherTrait, PlayerFaithKey, Pledge,
};
pub use crate::game::IGameDispatcherTrait;
pub use crate::registrar::IRegistrarSafeDispatcherTrait;
pub use crate::resources::ResourceKey;
pub use crate::structures::{IStructureOperationsDispatcher, StructureRecord};
pub use crate::tests::state::StructureObservationTrait;
pub use super::resource_commands::{assert_terminal_rejection, execute, set_fixture, setup_with_rules};
pub fn setup() -> (super::Deployment, ResourceKey, ResourceKey) {
    let mut rules = super::play_fixture::rules();
    rules.faith_enabled = true;
    rules.mode_rules = super::play_fixture::ETERNUM_RULES;
    rules.command_mask = super::play_fixture::ETERNUM_COMMAND_MASK;
    rules.entry_rule = crate::rules::ENTRY_ENTITLEMENT;
    let mut preset = super::resource_commands::fixture_preset(rules);
    preset.structures.faith = config();
    let (deployment, wonder, realm) = super::resource_commands::setup_with_preset(preset);
    set_wonder(deployment, wonder, true);
    set_wonder(deployment, realm, false);
    (deployment, wonder, realm)
}
pub fn config() -> FaithRules {
    FaithRules { wonder_rate: 500, realm_rate: 100, village_rate: 10, owner_share_bps: 3000 }
}
pub fn set_wonder(deployment: super::Deployment, key: ResourceKey, enabled: bool) {
    let value = IStructureOperationsDispatcher { contract_address: deployment.games }.structure(key).unwrap();
    set_fixture(
        deployment.games,
        selector!("structures"),
        selector!("structures"),
        array![3, key.entity_id.into()].span(),
        StructureRecord {
            owner: value.owner,
            base: value.base,
            resources_packed: value.resources_packed,
            metadata: crate::structures::StructureMetadata { has_wonder: enabled, ..value.metadata },
        },
    );
}
pub fn view(deployment: super::Deployment) -> IFaithOwnershipViewsDispatcher {
    IFaithOwnershipViewsDispatcher { contract_address: deployment.games }
}
pub fn pledge(structure: ResourceKey, wonder: ResourceKey) -> Command {
    Command::PledgeFaith(Pledge { structure_id: structure.entity_id, wonder_id: wonder.entity_id })
}
pub fn claim(player: starknet::ContractAddress, wonder: ResourceKey) -> Command {
    Command::ClaimPlayerFaithPoints(ClaimPlayer { player, wonder_id: wonder.entity_id })
}
pub fn points(
    deployment: super::Deployment, player: starknet::ContractAddress, wonder: ResourceKey,
) -> crate::faith::PlayerFaithPoints {
    view(deployment).player_faith_points(PlayerFaithKey { game_id: 3, player, wonder_id: wonder.entity_id })
}
pub fn transfer(key: ResourceKey, owner: starknet::ContractAddress) -> Command {
    Command::TransferStructureOwnership(
        crate::ownership::TransferOwnership { entity_id: key.entity_id, new_owner: owner },
    )
}
