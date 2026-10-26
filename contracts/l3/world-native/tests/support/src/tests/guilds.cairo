pub use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
pub use starknet::ContractAddress;
pub use crate::commands::Command;
pub use crate::guilds::{CreateGuild, IGuildsDispatcher, IGuildsDispatcherTrait, JoinGuild, SetWhitelist, WhitelistKey};
pub use crate::resources::ResourceKey;
pub use super::resource_commands::{execute, setup_with_rules};
pub fn setup() -> (super::Deployment, ResourceKey, ResourceKey, ContractAddress) {
    let (d, home, second) = setup_with_rules(super::play_fixture::rules());
    let (friend, _) = super::deploy_player(3, super::GUARDIAN);
    assert!(
        execute(
            d,
            Command::TransferStructureOwnership(
                crate::ownership::TransferOwnership { entity_id: second.entity_id, new_owner: friend },
            ),
            30,
        ),
    );
    (d, home, second, friend)
}
pub fn view(d: super::Deployment) -> IGuildsDispatcher {
    IGuildsDispatcher { contract_address: d.games }
}
pub fn member(d: super::Deployment, player: ContractAddress) -> ContractAddress {
    view(d).guild_member(3, player)
}
pub fn create(home: ResourceKey, public: bool) -> Command {
    Command::CreateGuild(CreateGuild { owned_structure_id: home.entity_id, public, name: 'guild' })
}
pub fn join(home: ResourceKey, guild_id: ContractAddress) -> Command {
    Command::JoinGuild(JoinGuild { owned_structure_id: home.entity_id, guild_id })
}
pub fn whitelist(home: ResourceKey, player: ContractAddress, allowed: bool) -> Command {
    Command::SetGuildWhitelist(SetWhitelist { owned_structure_id: home.entity_id, player, allowed })
}
pub fn act(d: super::Deployment, actor: ContractAddress, command: Command) -> bool {
    act_at(d, actor, command, 40)
}
pub fn act_at(d: super::Deployment, actor: ContractAddress, command: Command, timestamp: u64) -> bool {
    execute(super::Deployment { actor, ..d }, command, timestamp)
}
