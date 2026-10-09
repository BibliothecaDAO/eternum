use snforge_std::fs::{FileTrait, read_txt};
use snforge_std::{EventSpyTrait, EventsFilterTrait};
use starknet::ContractAddress;
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess};
use crate::commands::Command;
use crate::game::GameRegistry;
use crate::registrar::{IRegistrarDispatcher, IRegistrarDispatcherTrait};

#[derive(Copy, Drop)]
pub struct TestAction {
    pub game_id: u32,
    pub actor: ContractAddress,
    pub command: Command,
}

#[starknet::interface]
pub trait IPlayFixture<T> {
    fn play_with_root(
        ref self: T, game_id: u32, release_id: u32, preset_commitment: felt252, command: Span<felt252>, root: u256,
    );
    fn last_applied(self: @T) -> bool;
}

pub const BLITZ_COMMAND_MASK: u128 = 71478916396378193887;
pub const ETERNUM_COMMAND_MASK: u128 = 73786976294838206463;

pub const BLITZ_RULES: u32 = crate::rules::HOME_REWARDS
    + crate::rules::DISCOVER_CAMPS
    + crate::rules::DISCOVER_CHESTS
    + crate::rules::CAPTURE_VILLAGES
    + crate::rules::SAME_OWNER_TRANSFER
    + crate::rules::RESERVED_HYPERSTRUCTURES
    + crate::rules::OWNER_ONLY_SHARES
    + crate::rules::HYPERSTRUCTURE_MULTIPLIERS
    + crate::rules::PRODUCTION_START
    + crate::rules::COMBAT_DICE_ETHEREAL;

pub const ETERNUM_RULES: u32 = crate::rules::DISCOVER_HYPERSTRUCTURES
    + crate::rules::SPIRES
    + crate::rules::SEASON_CLOSE
    + crate::rules::DEV_VILLAGE_ENTRY
    + crate::rules::COMBAT_DICE_ETHEREAL;

pub fn rules() -> crate::rules::SliceRules {
    let data = read_txt(@FileTrait::new("tests/fixtures/current-presets/preset-3.txt"));
    let mut fields = data.span();
    Serde::deserialize(ref fields).unwrap()
}
pub fn create_games(registry: ContractAddress) {
    for game_id in array![1, 2] {
        seed_game(
            registry,
            game_id,
            GameRegistry {
                name: 'fixture',
                preset_id: 3,
                settled: false,
                ready: true,
                dev_mode_on: true,
                start_settling_at: 0,
                start_main_at: 0,
                end_at: 999999,
                end_grace_seconds: 0,
                seed: 1,
            },
            rules(),
        );
    }
}
pub fn fixture_preset(rules: crate::rules::SliceRules) -> crate::presets::PresetDefinition {
    let mut preset = super::registrar::definition(rules.entry_rule == crate::rules::ENTRY_ROSTER);
    preset.rules = rules;
    if rules.day_unit_seconds != 0 {
        preset.economy.labor = Some(crate::entry::LaborRules { amount: 1000, account_daily_limit: 0 });
        preset.economy.progression = Some(super::preset_projection::frontier_progression_rules());
    }
    preset.season_win_points = 0;
    preset.economy.withdrawals = None;
    preset
        .settlement
        .spires =
            if crate::rules::rule_enabled(rules, crate::rules::SPIRES) {
                Some(crate::spires::SpireLayout { count: 1, base_distance: 0, layer_distance: 0, max_layer: 0 })
            } else {
                None
            };
    preset
}

pub fn seed_game(registry: ContractAddress, game_id: u32, game: GameRegistry, rules: crate::rules::SliceRules) {
    seed_game_with_preset(registry, game_id, game, fixture_preset(rules));
}

pub fn seed_game_with_preset(
    registry: ContractAddress, game_id: u32, game: GameRegistry, definition: crate::presets::PresetDefinition,
) {
    let registrar = IRegistrarDispatcher { contract_address: registry };
    let commitment = crate::presets::commitment(definition);
    let mut preset_id = 10000 + game_id;
    loop {
        let existing = registrar.preset_commitment(preset_id);
        if existing == 0 || existing == commitment {
            break;
        }
        preset_id += 1;
    }
    if registrar.preset_commitment(preset_id) == 0 {
        let authority = snforge_std::interact_with_state(registry, || crate::state::read().authority.read());
        snforge_std::cheat_caller_address(registry, authority, snforge_std::CheatSpan::TargetCalls(1));
        registrar.register_preset(preset_id, definition);
    }
    let rules = definition.rules;
    snforge_std::interact_with_state(
        registry,
        || {
            let state = crate::state::write();
            state.game_releases.write(game_id, state.current_release.read());
            state.games.games.write(game_id, GameRegistry { preset_id, ..game });
            state
                .games
                .overrides
                .write(
                    game_id,
                    crate::game::GameOverrides {
                        registration_start: 0,
                        biome_climate: rules.biome_climate_config,
                        map: None,
                        map_center_offset: rules.map_center_offset,
                    },
                );
            if state.games.next_entity.read(game_id) == 0 {
                state.games.next_entity.write(game_id, 1);
            }
        },
    );
}

pub fn pins(games: ContractAddress, game_id: u32) -> (u32, felt252) {
    snforge_std::interact_with_state(
        games,
        || {
            let state = crate::state::read();
            let game = crate::logic::game::game(game_id);
            (state.game_releases.read(game_id), crate::logic::game::preset_commitment(game))
        },
    )
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
    let (release, preset) = pins(games, action.game_id);
    caller(games, action.actor, timestamp);
    let fixture = IPlayFixtureDispatcher { contract_address: games };
    fixture.play_with_root(action.game_id, release, preset, encode(action.command), root);
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
    let (release, preset) = pins(games, action.game_id);
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
            .play_with_root(action.game_id, release, preset, encode(action.command), 987654321)
            .is_err(),
    );
    assert_eq!(pins(games, action.game_id), (release, preset));
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

pub fn prepare_homes(games: ContractAddress, game_id: u32, owner: ContractAddress) {
    snforge_std::interact_with_state(games, || prepare_fixture_home(game_id, owner));
}

// Synthetic fixture builders retain their small ids. Unprepared production settlement is tested separately.
pub fn prepare_fixture_home(game_id: u32, owner: ContractAddress) {
    let state = crate::state::write();
    let rules = crate::logic::game::rules(game_id);
    if rules.entry_rule == crate::rules::ENTRY_OPEN && rules.day_unit_seconds != 0 {
        if state.games.open_homes.read((game_id, owner)) == 0 {
            let first = crate::logic::game::allocate_setup_entity(game_id);
            state.games.open_homes.write((game_id, owner), first.into());
            state.games.namespace_owners.write((game_id, first), owner);
        }
    } else {
        crate::entity_ids::reserve_homes(game_id, owner);
    }
}
