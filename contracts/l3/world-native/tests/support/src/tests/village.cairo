pub use snforge_std::fs::{FileTrait, read_txt};
pub use snforge_std::{
    EventSpyTrait, EventsFilterTrait, spy_events, start_cheat_caller_address, stop_cheat_caller_address,
};
pub use starknet::storage::StorageMapWriteAccess;
pub use crate::commands::Command;
pub use crate::game::{IGameDispatcher, IGameDispatcherTrait};
pub use crate::map::IMapLogicDispatcher;
pub use crate::resources::{IResourceOperationsDispatcher, ResourceKey, ResourceSlot};
pub use crate::settlement::{
    ISettlementCreationDispatcher, ISettlementCreationDispatcherTrait, ISettlementPoolDispatcher,
    ISettlementPoolDispatcherTrait, SettlementMode,
};
pub use crate::structures::IStructureOperationsDispatcher;
pub use crate::tests::state::{MapObservationTrait, ResourceObservationTrait, StructureObservationTrait};
pub use crate::troops::Coord;
pub use crate::village::{
    IVillagePassesDispatcher, IVillagePassesDispatcherTrait, IVillagePassesSafeDispatcher,
    IVillagePassesSafeDispatcherTrait, SettleVillage, VillagePassKey, VillageRules,
};
pub use super::{Deployment, authority, context, play_fixture};
pub fn village_rules() -> VillageRules {
    let data = read_txt(@FileTrait::new("../fixtures/village.txt"));
    let mut fields = data.span();
    let rules = Serde::deserialize(ref fields).unwrap();
    assert!(fields.is_empty());
    rules
}
pub fn season_world() -> Deployment {
    let deployment = super::setup_with_domains(true, "StructuresLogic", "TroopsLogic");
    super::entry::set_operator(deployment, authority());
    let game_id = play_fixture::create_game(deployment.games, play_fixture::fixture_params('village'));
    assert!(game_id == 3, "the village game follows the two fixture games");
    deployment
}
pub fn setup() -> (Deployment, u64) {
    let deployment = season_world();
    let realm = play_fixture::settled_home(deployment, 3, deployment.actor, 1, play_fixture::FIXTURE_START);
    (deployment, realm.entity_id)
}
pub fn run(deployment: Deployment, command: Command, timestamp: u64) -> bool {
    super::resource_commands::execute(deployment, command, timestamp)
}
pub fn settle(realm: u64, pass_id: u16) -> Command {
    Command::SettleVillage(SettleVillage { pass_id, connected_realm_entity_id: realm })
}
pub fn register_pass(deployment: Deployment, pass_id: u16) -> VillagePassKey {
    let key = VillagePassKey { game_id: 3, pass_id };
    start_cheat_caller_address(deployment.games, authority());
    IVillagePassesDispatcher { contract_address: deployment.games }.register_village_pass(key, deployment.actor);
    stop_cheat_caller_address(deployment.games);
    key
}
pub // The realm a settlement created, read from its RealmCreatedStory.
 fn created_realm(ref spy: snforge_std::EventSpy, deployment: Deployment) -> u64 {
    let mut created = Option::None;
    for (_, event) in spy.get_events().emitted_by(deployment.games).events.span() {
        if *event.keys.at(0) == selector!("StoryEvent") {
            let mut keys = event.keys.span().slice(1, event.keys.len() - 1);
            let mut values = event.data.span();
            let story: crate::ownership::StoryEvent = starknet::Event::deserialize(ref keys, ref values).unwrap();
            if let crate::ownership::Story::RealmCreatedStory(_) = story.story {
                created = story.entity_id;
            }
        }
    }
    created.expect('missing realm story')
}
pub // Settles one season realm. Catalogue loading is covered separately; this draw uses the pinned salt 71419 after
// scoping raw root 987654321 to game 3: realm 3492.
fn settle_season_realm(deployment: Deployment) -> u64 {
    super::resource_commands::set_fixture(
        deployment.games, selector!("realms"), selector!("catalogue_count"), array![].span(), 8000_u32,
    );
    super::resource_commands::set_fixture(
        deployment.games, selector!("realms"), selector!("traits"), array![3492].span(), 0x9000002_u32,
    );
    play_fixture::hold_realm(deployment, 3, deployment.actor, 3492);
    let mut spy = spy_events();
    assert!(
        run(
            deployment,
            Command::SettleSeason(crate::realms::SettleSeason { selected_realm: Option::None, order: None }),
            play_fixture::FIXTURE_START,
        ),
    );
    created_realm(ref spy, deployment)
}
pub fn assert_season_entitlement_mode(has_operator: bool, has_entitlement: bool) {
    let d = season_world();
    // The authenticated account is the player that holds entitlements.
    let owner = d.actor;
    super::resource_commands::set_fixture(
        d.games, selector!("realms"), selector!("catalogue_count"), array![].span(), 8000_u32,
    );
    super::resource_commands::set_fixture(
        d.games, selector!("realms"), selector!("traits"), array![7].span(), 0x9000002_u32,
    );
    if has_entitlement {
        play_fixture::hold_realm(d, 3, owner, 7);
    }
    super::entry::set_operator(d, if has_operator {
        authority()
    } else {
        0.try_into().unwrap()
    });
    let mut spy = spy_events();
    assert_eq!(
        run(
            d,
            Command::SettleSeason(crate::realms::SettleSeason { selected_realm: Option::None, order: None }),
            play_fixture::FIXTURE_START,
        ),
        has_entitlement,
    );
    let mut created = false;
    for (_, event) in spy.get_events().emitted_by(d.games).events.span() {
        if event.keys.len() >= 3
            && *event.keys.at(event.keys.len() - 3) == selector!("RowSet")
            && *event.keys.at(event.keys.len() - 1) == 'Structure' {
            let mut data = event.data.span();
            let _: Span<felt252> = Serde::deserialize(ref data).unwrap();
            let mut values: Span<felt252> = Serde::deserialize(ref data).unwrap();
            let record: crate::structures::Structure = Serde::deserialize(ref values).unwrap();
            assert_eq!(record.metadata.realm_id, 7);
            created = true;
        }
    }
    assert_eq!(created, has_entitlement);
}
