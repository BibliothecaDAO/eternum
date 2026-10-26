pub use world_test_support::tests::guilds::*;

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
fn guild_actions_require_the_current_block_to_be_in_the_game_window() {
    let (early, early_home, _) = setup_with_rules(super::play_fixture::rules());
    assert!(!act_at(early, early.actor, create(early_home, true), 19));
    let (d, home, _, _) = setup();
    assert!(act_at(d, d.actor, create(home, true), 40));
    assert!(view(d).guild(3, d.actor).is_some());
    assert!(act_at(d, d.actor, Command::LeaveGuild, 199));
    assert!(view(d).guild(3, d.actor).is_none());
    let (late, home, _, _) = setup();
    assert!(act_at(late, late.actor, create(home, true), 40));
    assert!(!act_at(late, late.actor, Command::LeaveGuild, 200));
    assert_eq!(member(late, late.actor), late.actor);
}
#[test]
#[feature("safe_dispatcher")]
fn guild_membership_is_game_scoped() {
    let (d, home, _, _) = setup();
    assert!(act(d, d.actor, create(home, true)));
    assert!(view(d).guild(2, d.actor).is_none());
    assert_eq!(view(d).guild_member(2, d.actor), 0.try_into().unwrap());
    start_cheat_caller_address(d.games, d.games);
    stop_cheat_caller_address(d.games);
    assert_eq!(member(d, d.actor), d.actor);
}
