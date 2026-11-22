pub use world_test_support::tests::troop_management::*;
use crate::village::{IVillagePassesDispatcher, IVillagePassesDispatcherTrait, SettleVillage, VillagePassKey};
use super::fixture::blitz_realm;
use super::play_fixture::{FIXTURE_START, encode};
use super::resource_commands::{assert_executes, execute_in_game};

const NOW: u64 = FIXTURE_START + 40;
const PASS: u16 = 1;

fn register_pass(d: super::Deployment, game_id: u32) -> VillagePassKey {
    let pass = VillagePassKey { game_id, pass_id: PASS };
    set_fixture(d.games, selector!("entry"), selector!("operator"), array![].span(), super::authority());
    start_cheat_caller_address(d.games, super::authority());
    IVillagePassesDispatcher { contract_address: d.games }.register_village_pass(pass, d.actor);
    stop_cheat_caller_address(d.games);
    pass
}

fn settle(home: ResourceKey) -> Command {
    Command::SettleVillage(SettleVillage { pass_id: PASS, connected_realm_entity_id: home.entity_id })
}

#[test]
fn a_village_pass_settles_a_village_tied_to_the_realm() {
    let (d, home) = blitz_realm();
    let pass = register_pass(d, home.game_id);
    assert_executes(d, home.game_id, settle(home), NOW);
    let village_id = IVillagePassesDispatcher { contract_address: d.games }.village_pass(pass).unwrap().village_id;
    let village = IStructureOperationsDispatcher { contract_address: d.games }
        .structure(ResourceKey { game_id: home.game_id, entity_id: village_id })
        .unwrap();
    assert_eq!(village.owner, d.actor);
    assert_eq!(village.base.category, crate::taxonomy::VILLAGE_CATEGORY);
    assert_eq!(village.metadata.village_realm, home.entity_id);
}

#[test]
fn a_village_pass_settles_one_village() {
    let (d, home) = blitz_realm();
    register_pass(d, home.game_id);
    assert_executes(d, home.game_id, settle(home), NOW);
    assert!(!execute_in_game(d, home.game_id, settle(home), NOW));
}

#[test]
fn a_blitz_realm_is_never_provisioned_by_command_since_the_roster_provisions_it() {
    let (d, home) = blitz_realm();
    super::assert_entry_refusal(
        d, home.game_id, 1, encode(Command::ProvisionRealm(home.entity_id)), "command disabled",
    );
}

#[test]
fn a_blitz_player_never_settles_a_season_realm_since_the_roster_seats_them() {
    let (d, game_id) = super::fixture::blitz_game();
    let settle = crate::realms::SettleSeason { selected_realm: Option::None, order: None };
    super::assert_entry_refusal(d, game_id, 1, encode(Command::SettleSeason(settle)), "command disabled");
}
