use eternum_randomness_protocol::entrypoint::{
    IRecordedExecutionViewsDispatcher, IRecordedExecutionViewsDispatcherTrait,
};
use snforge_std::{start_cheat_block_timestamp_global, start_cheat_caller_address, stop_cheat_caller_address};
use starknet::ContractAddress;
use crate::commands::Command;
use crate::guilds::{
    CreateGuild, IGuildsDispatcher, IGuildsDispatcherTrait, IGuildsSafeDispatcher, IGuildsSafeDispatcherTrait,
    JoinGuild, SetWhitelist, WhitelistKey,
};
use crate::resources::ResourceKey;
use crate::season::{ISeasonDispatcher, ISeasonDispatcherTrait};
use super::resource_commands::{execute, execute_recorded_at, setup_with_rules};
fn setup() -> (super::Deployment, ResourceKey, ResourceKey, ContractAddress) {
    let (d, home, second) = setup_with_rules(super::recorded::rules());
    let (friend, _) = super::deploy("AccountFixture", @array![super::keypair(12345).public_key]);
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
fn view(d: super::Deployment) -> IGuildsDispatcher {
    IGuildsDispatcher { contract_address: d.peers.registry }
}
fn member(d: super::Deployment, player: ContractAddress) -> ContractAddress {
    view(d).guild_member(3, player)
}
fn create(home: ResourceKey, public: bool) -> Command {
    Command::CreateGuild(CreateGuild { owned_structure_id: home.entity_id, public, name: 'guild' })
}
fn join(home: ResourceKey, guild_id: ContractAddress) -> Command {
    Command::JoinGuild(JoinGuild { owned_structure_id: home.entity_id, guild_id })
}
fn whitelist(home: ResourceKey, player: ContractAddress, allowed: bool) -> Command {
    Command::SetGuildWhitelist(SetWhitelist { owned_structure_id: home.entity_id, player, allowed })
}
fn act(d: super::Deployment, actor: ContractAddress, command: Command) -> bool {
    act_at(d, actor, command, 40, 40)
}
fn act_at(d: super::Deployment, actor: ContractAddress, command: Command, accepted: u64, executed: u64) -> bool {
    let season = ISeasonDispatcher { contract_address: d.peers.season };
    start_cheat_block_timestamp_global(accepted);
    let admission = IRecordedExecutionViewsDispatcher { contract_address: d.peers.season }
        .get_admission(3, actor.into());
    let order = super::recorded::head(d.peers.season, 3).order;
    let ok = execute_recorded_at(super::Deployment { actor, ..d }, command, accepted, executed);
    assert_eq!(season.next_nonce(3, actor), admission.nonce + 1);
    assert_eq!(super::recorded::head(d.peers.season, 3).order, order + 1);
    ok
}
#[test]
fn public_membership_is_unique_and_last_departure_deletes_the_guild() {
    let (d, home, other, friend) = setup();
    assert!(act(d, d.actor, create(home, true)));
    assert!(act(d, d.actor, join(home, d.actor)));
    assert!(act(d, friend, join(other, d.actor)));
    assert_eq!(member(d, friend), d.actor);
    assert!(act(d, friend, Command::LeaveGuild));
    assert!(view(d).guild(3, d.actor).is_some());
    assert!(act(d, d.actor, Command::LeaveGuild));
    assert!(view(d).guild(3, d.actor).is_none());
    assert_eq!(member(d, d.actor), 0.try_into().unwrap());
    assert!(!act(d, d.actor, Command::LeaveGuild));
}
#[test]
fn private_guilds_require_whitelisting_and_only_the_founder_can_remove_members() {
    let (d, home, other, friend) = setup();
    assert!(act(d, d.actor, create(home, false)));
    assert!(!act(d, friend, join(other, d.actor)));
    assert!(!act(d, friend, whitelist(other, friend, true)));
    assert!(!act(d, d.actor, whitelist(home, friend, true)));
    assert!(act(d, d.actor, whitelist(other, friend, true)));
    assert!(view(d).guild_whitelisted(WhitelistKey { game_id: 3, guild_id: d.actor, player: friend }));
    assert!(act(d, friend, join(other, d.actor)));
    assert!(!act(d, friend, Command::RemoveGuildMember(d.actor)));
    assert!(act(d, d.actor, Command::RemoveGuildMember(friend)));
    assert_eq!(member(d, friend), 0.try_into().unwrap());
    assert!(act(d, d.actor, whitelist(other, friend, false)));
    assert!(!view(d).guild_whitelisted(WhitelistKey { game_id: 3, guild_id: d.actor, player: friend }));
    assert!(!act(d, friend, join(other, d.actor)));
}
#[test]
fn founding_a_guild_detaches_the_founder_from_the_previous_guild() {
    let (d, home, other, friend) = setup();
    assert!(act(d, d.actor, create(home, true)));
    assert!(act(d, friend, join(other, d.actor)));
    assert!(act(d, friend, create(other, true)));
    assert_eq!(member(d, friend), friend);
    assert!(act(d, d.actor, Command::LeaveGuild));
    assert!(view(d).guild(3, d.actor).is_none());
    assert!(view(d).guild(3, friend).is_some());
    assert!(act(d, friend, Command::LeaveGuild));
    assert!(view(d).guild(3, friend).is_none());
}
#[test]
fn switching_guilds_updates_both_memberships_without_duplicating_a_member() {
    let (d, home, other, friend) = setup();
    assert!(act(d, d.actor, create(home, true)));
    assert!(act(d, friend, create(other, true)));
    assert!(act(d, friend, join(other, d.actor)));
    assert!(view(d).guild(3, friend).is_none());
    assert_eq!(member(d, friend), d.actor);
    assert!(act(d, d.actor, Command::LeaveGuild));
    assert!(view(d).guild(3, d.actor).is_some());
    assert!(act(d, d.actor, Command::RemoveGuildMember(friend)));
    assert!(view(d).guild(3, d.actor).is_none());
}
#[test]
fn invalid_names_ownership_and_missing_guilds_reject_without_moving_membership() {
    let (d, home, other, friend) = setup();
    assert!(
        !act(
            d, d.actor, Command::CreateGuild(CreateGuild { owned_structure_id: home.entity_id, public: true, name: 0 }),
        ),
    );
    assert!(!act(d, friend, create(home, true)));
    assert!(act(d, d.actor, create(home, true)));
    assert!(!act(d, d.actor, create(home, false)));
    assert!(!act(d, d.actor, join(home, friend)));
    assert_eq!(member(d, d.actor), d.actor);
    assert!(!act(d, friend, join(home, d.actor)));
    assert!(act(d, friend, join(other, d.actor)));
    assert!(!act(d, d.actor, Command::RemoveGuildMember(999.try_into().unwrap())));
    assert_eq!(member(d, friend), d.actor);
}
#[test]
fn accepted_guild_actions_survive_outages_but_actions_accepted_after_end_reject() {
    let (early, early_home, _) = setup_with_rules(super::recorded::rules());
    assert!(!act_at(early, early.actor, create(early_home, true), 19, 19));
    let (d, home, _, _) = setup();
    assert!(act_at(d, d.actor, create(home, true), 40, 5000));
    assert!(view(d).guild(3, d.actor).is_some());
    assert!(act_at(d, d.actor, Command::LeaveGuild, 199, 5000));
    assert!(view(d).guild(3, d.actor).is_none());
    let (late, home, _, _) = setup();
    assert!(act_at(late, late.actor, create(home, true), 40, 5000));
    assert!(!act_at(late, late.actor, Command::LeaveGuild, 200, 5000));
    assert_eq!(member(late, late.actor), late.actor);
}
#[test]
#[feature("safe_dispatcher")]
fn foreign_callers_cannot_forge_a_guild_actor_and_games_are_isolated() {
    let (d, home, _, _) = setup();
    let safe = IGuildsSafeDispatcher { contract_address: d.peers.registry };
    assert!(
        safe
            .create_guild(
                3,
                d.actor,
                CreateGuild { owned_structure_id: home.entity_id, public: true, name: 'guild' },
                super::context(),
            )
            .is_err(),
    );
    assert!(act(d, d.actor, create(home, true)));
    assert!(view(d).guild(2, d.actor).is_none());
    assert_eq!(view(d).guild_member(2, d.actor), 0.try_into().unwrap());
    start_cheat_caller_address(d.peers.registry, d.peers.structures);
    assert!(safe.leave_guild(3, d.actor, super::context()).is_err());
    stop_cheat_caller_address(d.peers.registry);
    assert_eq!(member(d, d.actor), d.actor);
}
