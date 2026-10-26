pub use snforge_std::fs::{FileTrait, read_txt};
pub use snforge_std::{
    EventSpyTrait, EventsFilterTrait, spy_events, start_cheat_caller_address, stop_cheat_caller_address,
};
pub use starknet::storage::StorageMapWriteAccess;
pub use crate::commands::Command;
pub use crate::game::{IGameDispatcher, IGameDispatcherTrait, IPointsDispatcherTrait};
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
    IVillagesDispatcher, IVillagesDispatcherTrait, IVillagesSafeDispatcher, IVillagesSafeDispatcherTrait, SettleVillage,
    VillagePassKey, VillageRules,
};
pub use super::{Deployment, authority, context, play_fixture};
pub fn village_rules() -> VillageRules {
    let data = read_txt(@FileTrait::new("../fixtures/village.txt"));
    let mut fields = data.span();
    let rules = Serde::deserialize(ref fields).unwrap();
    assert!(fields.is_empty());
    rules
}
pub fn setup(dev: bool) -> (Deployment, u64) {
    setup_config(dev, SettlementMode::Single, play_fixture::rules())
}
pub fn village_preset(mode: SettlementMode, game_rules: crate::rules::SliceRules) -> crate::presets::PresetDefinition {
    let mut preset = play_fixture::fixture_preset(game_rules);
    preset.settlement.mode = mode;
    preset.settlement.spacing = 6;
    preset.settlement.realms = super::settlement::grants_for(preset.rules.entry_rule);
    preset.settlement.villages = VillageRules { troop_delay_ticks: 2, ..village_rules() };
    let data = read_txt(@FileTrait::new("../fixtures/current-presets/preset-3.txt"));
    let mut fields = data.span();
    let _: crate::rules::SliceRules = Serde::deserialize(ref fields).unwrap();
    preset.resources.resources = Serde::deserialize(ref fields).unwrap();
    preset.structures.buildings = Serde::deserialize(ref fields).unwrap();
    preset.structures.board = None;
    preset
}
pub fn setup_config(dev: bool, mode: SettlementMode, game_rules: crate::rules::SliceRules) -> (Deployment, u64) {
    setup_preset(dev, village_preset(mode, game_rules))
}
pub fn seed_world(dev: bool, preset: crate::presets::PresetDefinition) -> Deployment {
    let deployment = super::setup_with_domains(true, "StructuresLogic", "TroopsLogic");
    super::entry::set_operator(deployment, authority());
    let games = IGameDispatcher { contract_address: deployment.games };
    play_fixture::seed_game_with_preset(
        deployment.games, 3, crate::game::GameRegistry { dev_mode_on: dev, ..games.game(1) }, preset,
    );
    snforge_std::interact_with_state(
        deployment.games, || {
            crate::state::write().registrar.roster_sizes.write(3, 2);
        },
    );
    deployment
}
pub fn season_world(dev: bool, preset: crate::presets::PresetDefinition) -> Deployment {
    let deployment = seed_world(dev, preset);
    play_fixture::reserve_fixture_homes(deployment.games, 3, deployment.actor);
    deployment
}
pub fn setup_preset(dev: bool, preset: crate::presets::PresetDefinition) -> (Deployment, u64) {
    let deployment = seed_world(dev, preset);
    let grants = preset.settlement.realms;
    start_cheat_caller_address(deployment.games, deployment.games);
    let realm = ISettlementCreationDispatcher { contract_address: deployment.games }
        .create_settlement(
            3,
            deployment.actor,
            Coord { alt: false, x: 2000000, y: 2000000 },
            crate::settlement::SettlementCreation::Realm(
                crate::settlement::RealmCreation {
                    realm_id: 1,
                    traits: crate::realms::RealmTraits { wonder: 1, order: 0, resources: grants.realm_resources },
                    troops: crate::settlement::StartingTroops::None,
                    activate_economy: false,
                },
            ),
            crate::commands::action_context(context(deployment.games, 3)),
        );
    stop_cheat_caller_address(deployment.games);
    (deployment, realm)
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
    IVillagesDispatcher { contract_address: deployment.games }.register_village_pass(key, deployment.actor);
    stop_cheat_caller_address(deployment.games);
    key
}
pub fn assert_blitz_village(mode: SettlementMode) {
    let (deployment, realm) = setup_config(
        false,
        mode,
        crate::rules::SliceRules {
            mode_rules: super::play_fixture::BLITZ_RULES,
            entry_rule: crate::rules::ENTRY_ROSTER,
            command_mask: super::play_fixture::BLITZ_COMMAND_MASK,
            ..play_fixture::rules(),
        },
    );
    let pass = register_pass(deployment, 1);
    assert!(run(deployment, settle(realm, 1), 100));
    let ledger = IVillagesDispatcher { contract_address: deployment.games };
    assert!(ledger.village_pass(pass).unwrap().village_id != 0);
    assert!(!run(deployment, settle(realm, 1), 100));
    let progress = crate::settlement::ISettlementViewsDispatcherTrait::settlement_progress(
        crate::settlement::ISettlementViewsDispatcher { contract_address: deployment.games }, 3,
    );
    assert!(progress.registered == 0 && progress.realm_count == 0);
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
    super::entry::set_operator(deployment, 0.try_into().unwrap());
    super::resource_commands::set_fixture(
        deployment.games, selector!("realms"), selector!("catalogue_count"), array![].span(), 8000_u32,
    );
    super::resource_commands::set_fixture(
        deployment.games, selector!("realms"), selector!("traits"), array![3492].span(), 0x9000002_u32,
    );
    let mut spy = spy_events();
    assert!(
        run(
            deployment,
            Command::SettleSeason(crate::realms::SettleSeason { name: 'Season player', selected_realm: Option::None }),
            100,
        ),
    );
    created_realm(ref spy, deployment)
}
pub fn assert_season_entitlement_mode(dev: bool, has_operator: bool, has_entitlement: bool) {
    let d = season_world(dev, village_preset(SettlementMode::Single, play_fixture::rules()));
    // The authenticated account is the player that holds entitlements.
    let owner = d.actor;
    if has_entitlement {
        super::resource_commands::set_fixture(
            d.games,
            selector!("settlements"),
            selector!("entitlements"),
            array![3, owner.into()].span(),
            Some(
                crate::settlement::EntryEntitlement {
                    realm_id: 7, metadata_1: 0x0103070402020302010009, metadata_2: 0, metadata_3: 0, pass_kind: 1,
                },
            ),
        );
    }
    super::entry::set_operator(d, if has_operator {
        authority()
    } else {
        0.try_into().unwrap()
    });
    super::resource_commands::set_fixture(
        d.games, selector!("realms"), selector!("catalogue_count"), array![].span(), 8000_u32,
    );
    super::resource_commands::set_fixture(
        d.games, selector!("realms"), selector!("traits"), array![3492].span(), 0x9000002_u32,
    );
    let mut spy = spy_events();
    assert_eq!(
        run(
            d,
            Command::SettleSeason(crate::realms::SettleSeason { name: 'Season player', selected_realm: Option::None }),
            100,
        ),
        dev || has_entitlement,
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
            assert_eq!(record.metadata.realm_id, if dev {
                3492
            } else {
                7
            });
            created = true;
        }
    }
    assert_eq!(created, dev || has_entitlement);
}
