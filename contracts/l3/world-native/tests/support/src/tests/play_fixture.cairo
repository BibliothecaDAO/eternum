pub use snforge_std::{EventSpyTrait, EventsFilterTrait};
pub use starknet::ContractAddress;
pub use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess};
pub use crate::commands::Command;
pub use crate::registrar::{IRegistrarDispatcher, IRegistrarDispatcherTrait};
pub use crate::settlement::ISettlementEntryDispatcherTrait;

#[derive(Copy, Drop)]
pub struct TestAction {
    pub game_id: u32,
    pub actor: ContractAddress,
    pub command: Command,
}

#[starknet::interface]
pub trait IPlayFixture<T> {
    fn play_with_root(ref self: T, game_id: u32, release_id: u32, command: Span<felt252>, root: u256);
    fn last_applied(self: @T) -> bool;
}
pub const FIXTURE_START: u64 = 120;
pub const FIXTURE_SEASON_SECONDS: u64 = 999960;
pub const FIXTURE_REALM_TRAITS: u32 = 0x4000001;
pub fn fixture_params(name: felt252) -> crate::registrar::CreateGameParams {
    crate::registrar::CreateGameParams {
        name,
        family: crate::game::FRONTIER,
        start_settling_at: FIXTURE_START,
        start_main_at: FIXTURE_START,
        duration_seconds: FIXTURE_SEASON_SECONDS,
        dev_mode_on: false,
        registration_start: 0,
        biome_climate: crate::rules::BiomeClimateConfig {
            elevation_scale_bps: 10000,
            moisture_scale_bps: 10000,
            elevation_bias_bps: 10000,
            moisture_bias_bps: 10000,
            elevation_seed: 0,
            moisture_seed: 0,
        },
        map_override: None,
        seed: 1,
        clock_scale: 1,
    }
}
pub fn create_game(games: ContractAddress, params: crate::registrar::CreateGameParams) -> u32 {
    snforge_std::cheat_caller_address(games, super::authority(), snforge_std::CheatSpan::TargetCalls(1));
    IRegistrarDispatcher { contract_address: games }.create_game(params)
}
pub fn create_games(games: ContractAddress) {
    assert!(create_game(games, fixture_params('fixture-1')) == 1, "the first fixture game is game 1");
    assert!(create_game(games, fixture_params('fixture-2')) == 2, "the second fixture game is game 2");
}
pub fn pins(games: ContractAddress, game_id: u32) -> u32 {
    snforge_std::interact_with_state(games, || crate::state::read().game_releases.read(game_id))
}
pub fn encode(command: Command) -> Span<felt252> {
    let mut encoded = array![];
    command.serialize(ref encoded);
    encoded.span()
}
pub fn caller(games: ContractAddress, actor: ContractAddress, timestamp: u64) {
    snforge_std::start_cheat_caller_address(games, actor);
    snforge_std::start_cheat_account_contract_address(games, actor);
    snforge_std::start_cheat_block_timestamp_global(timestamp);
    snforge_std::start_cheat_block_timestamp(games, timestamp);
}
pub fn play(games: ContractAddress, action: TestAction, root: u256, timestamp: u64) -> bool {
    let release = pins(games, action.game_id);
    caller(games, action.actor, timestamp);
    let fixture = IPlayFixtureDispatcher { contract_address: games };
    fixture.play_with_root(action.game_id, release, encode(action.command), root);
    fixture.last_applied()
}
pub fn rejection(ref spy: snforge_std::EventSpy, games: ContractAddress) -> crate::commands::GameplayRejected {
    let mut rejected = None;
    for (_, event) in spy.get_events().emitted_by(games).events.span() {
        if *event.keys.at(0) == selector!("GameplayRejected") {
            let mut keys = event.keys.span().slice(1, event.keys.len() - 1);
            let mut data = event.data.span();
            assert!(rejected.is_none(), "duplicate rejection");
            rejected = starknet::Event::deserialize(ref keys, ref data);
            assert!(keys.is_empty() && data.is_empty(), "trailing rejection fields");
        }
    }
    rejected.expect('MISSING_REJECTION')
}

#[feature("safe_dispatcher")]
pub fn assert_preflight_rejection(games: ContractAddress, action: TestAction, timestamp: u64) {
    let release = pins(games, action.game_id);
    let before = snforge_std::interact_with_state(
        games,
        || {
            let state = crate::state::read();
            (state.games.games.read(action.game_id), state.games.next_entity.read(action.game_id))
        },
    );
    caller(games, action.actor, timestamp);
    let mut spy = snforge_std::spy_events();
    assert!(
        IPlayFixtureSafeDispatcher { contract_address: games }
            .play_with_root(action.game_id, release, encode(action.command), 987654321)
            .is_err(),
    );
    assert_eq!(pins(games, action.game_id), release);
    assert_eq!(
        snforge_std::interact_with_state(
            games,
            || {
                let state = crate::state::read();
                (state.games.games.read(action.game_id), state.games.next_entity.read(action.game_id))
            },
        ),
        before,
    );
    assert!(spy.get_events().emitted_by(games).events.is_empty());
}
pub fn gameplay_snapshot(games: ContractAddress) -> Array<felt252> {
    snforge_std::interact_with_state(
        games,
        || {
            let state = crate::state::read();
            let mut facts = array![];
            for game_id in array![1_u32, 2, 3] {
                state.games.games.read(game_id).serialize(ref facts);
                state.game_releases.read(game_id).serialize(ref facts);
                state.games.next_entity.read(game_id).serialize(ref facts);
                for home in 1_u32..4 {
                    state.games.home_entities.read((game_id, home)).serialize(ref facts);
                }
            }
            facts
        },
    )
}
pub fn settled_home(
    d: super::Deployment, game_id: u32, actor: ContractAddress, realm_id: u32, timestamp: u64,
) -> crate::resources::ResourceKey {
    let settle = settle_action(d, game_id, actor, realm_id);
    let mut spy = snforge_std::spy_events();
    if !play(d.games, settle, 987654321, timestamp) {
        panic!("the home does not settle: {}", rejection(ref spy, d.games).reason);
    }
    let entry = crate::settlement::ISettlementEntryDispatcher { contract_address: d.games };
    let home = crate::resources::ResourceKey { game_id, entity_id: entry.settled_realm(game_id, realm_id) };
    deploy_starting_troops(d, actor, home, timestamp);
    home
}
pub fn deploy_starting_troops(
    d: super::Deployment, actor: ContractAddress, home: crate::resources::ResourceKey, timestamp: u64,
) {
    let mut held = None;
    for category in array![
        crate::troops::TroopType::Knight, crate::troops::TroopType::Paladin, crate::troops::TroopType::Crossbowman,
    ] {
        let troops = balance(d, home, crate::troops::troop_resource(category, 0));
        if troops > 0 {
            held = Some((category, troops));
        }
    }
    let (category, troops) = held.expect('the home holds no troops');
    for slot in 0_u8..2 {
        let command = Command::CreateExplorer(
            crate::commands::CreateExplorer {
                slot,
                structure_id: home.entity_id,
                category: category.into(),
                tier: 0,
                amount: troops / 2,
                direction: slot,
            },
        );
        let mut spy = snforge_std::spy_events();
        if !play(d.games, TestAction { game_id: home.game_id, actor, command }, 987654321, timestamp) {
            panic!("the starting troops do not deploy: {}", rejection(ref spy, d.games).reason);
        }
    }
}
pub fn deploy_home_troops(d: super::Deployment, game_id: u32, timestamp: u64) -> crate::resources::ResourceKey {
    let home = crate::resources::ResourceKey {
        game_id,
        entity_id: snforge_std::interact_with_state(d.games, || crate::entity_ids::home_for_actor(game_id, d.actor)),
    };
    deploy_starting_troops(d, d.actor, home, timestamp);
    home
}
fn balance(d: super::Deployment, home: crate::resources::ResourceKey, resource_type: u8) -> u128 {
    crate::tests::state::ResourceObservationTrait::resource_balance(
        crate::resources::IResourceOperationsDispatcher { contract_address: d.games },
        crate::resources::ResourceSlot { game_id: home.game_id, entity_id: home.entity_id, resource_type },
    )
}
pub fn settle_action(d: super::Deployment, game_id: u32, actor: ContractAddress, realm_id: u32) -> TestAction {
    super::resource_commands::set_fixture(
        d.games,
        selector!("realms"),
        selector!("catalogue_count"),
        array![].span(),
        crate::realms::CANONICAL_REALM_COUNT,
    );
    super::resource_commands::set_fixture(
        d.games, selector!("realms"), selector!("traits"), array![realm_id.into()].span(), FIXTURE_REALM_TRAITS,
    );
    hold_realm(d, game_id, actor, realm_id);
    let command = Command::SettleSeason(crate::realms::SettleSeason { selected_realm: None, order: None });
    TestAction { game_id, actor, command }
}
pub fn hold_realm(d: super::Deployment, game_id: u32, owner: ContractAddress, realm_id: u32) {
    super::entry::set_operator(d, super::authority());
    let held = crate::settlement::EntryEntitlement {
        realm_id: realm_id.into(),
        metadata_1: 0,
        metadata_2: 0,
        metadata_3: 0,
        pass_kind: crate::settlement::HELD_REALM_KIND,
    };
    snforge_std::cheat_caller_address(d.games, super::authority(), snforge_std::CheatSpan::TargetCalls(1));
    crate::settlement::ISettlementEntryDispatcher { contract_address: d.games }
        .register_entitlement(crate::settlement::EntryKey { game_id, owner }, held);
}
