pub use world_test_support::tests::guilds::*;
use super::fixture::{blitz_realm, rival_realm};
use super::play_fixture::FIXTURE_START;
use super::resource_commands::execute_in_game;

const NOW: u64 = FIXTURE_START + 40;

fn act_in(d: super::Deployment, home: ResourceKey, actor: ContractAddress, command: Command) -> bool {
    execute_in_game(super::Deployment { actor, ..d }, home.game_id, command, NOW)
}

fn nobody() -> ContractAddress {
    0.try_into().unwrap()
}

fn member_of(d: super::Deployment, home: ResourceKey, player: ContractAddress) -> ContractAddress {
    view(d).guild_member(home.game_id, player)
}

#[test]
fn a_player_joins_a_public_guild_and_leaves_it() {
    let (d, home) = blitz_realm();
    let (rival, rival_home) = rival_realm(d, home);
    assert!(act_in(d, home, d.actor, create(home, true)));
    assert!(act_in(d, home, rival, join(rival_home, d.actor)));
    assert_eq!(member_of(d, home, rival), d.actor);
    assert!(act_in(d, home, rival, Command::LeaveGuild(())));
    assert_eq!(member_of(d, home, rival), nobody());
}

#[test]
fn a_private_guild_takes_only_the_players_its_founder_lists() {
    let (d, home) = blitz_realm();
    let (rival, rival_home) = rival_realm(d, home);
    assert!(act_in(d, home, d.actor, create(home, false)));
    assert!(!act_in(d, home, rival, join(rival_home, d.actor)));
    assert!(act_in(d, home, d.actor, whitelist(rival_home, rival, true)));
    assert!(act_in(d, home, rival, join(rival_home, d.actor)));
    assert_eq!(member_of(d, home, rival), d.actor);
}

#[test]
fn a_founder_removes_a_member() {
    let (d, home) = blitz_realm();
    let (rival, rival_home) = rival_realm(d, home);
    assert!(act_in(d, home, d.actor, create(home, true)));
    assert!(act_in(d, home, rival, join(rival_home, d.actor)));
    assert!(act_in(d, home, d.actor, Command::RemoveGuildMember(rival)));
    assert_eq!(member_of(d, home, rival), nobody());
}
