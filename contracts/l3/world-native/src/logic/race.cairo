use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess};
use crate::race::{AspectHyperstructure, AspectKey, IRaceDispatcherTrait, RaceMember, RaceResult, RaceRules, TriumphKey};
use crate::resources::ResourceKey;
use crate::troops::Coord;

pub fn dispatcher(game_id: u32) -> crate::race::IRaceLibraryDispatcher {
    let state = crate::state::read();
    let release = state.game_releases.read(game_id);
    crate::race::IRaceLibraryDispatcher { class_hash: state.releases.entry(release).classes.economy.read() }
}

pub fn enabled(game_id: u32) -> bool {
    dispatcher(game_id).race_enabled(game_id)
}

fn rules(game_id: u32) -> Option<RaceRules> {
    crate::logic::preset_record::for_game(game_id).race_rules.read()
}

pub fn member(key: ResourceKey) -> RaceMember {
    let (glory, contribution) = crate::state::read().season.race_members.read((key.game_id, key.entity_id));
    RaceMember { glory, contribution }
}

fn hyperstructure(key: AspectKey) -> AspectHyperstructure {
    crate::race::assert_aspect(key.aspect);
    let state = crate::state::read();
    let entity_id = state.season.aspect_hyperstructures.read((key.game_id, key.aspect));
    assert!(entity_id != 0, "race hyperstructure is missing");
    AspectHyperstructure { entity_id, height: state.season.aspect_heights.read((key.game_id, key.aspect)) }
}

pub fn triumph_day(key: TriumphKey) -> Option<u64> {
    crate::race::assert_aspect(key.aspect);
    assert!(key.stage >= 1 && key.stage <= 4, "invalid Triumph stage");
    crate::state::read().season.triumph_days.read((key.game_id, key.aspect, key.stage))
}

pub fn result(game_id: u32) -> Option<RaceResult> {
    crate::state::read()
        .season
        .race_results
        .read(game_id)
        .map(
            |value| {
                let (winner, ended_at, scheduled_end_at) = value;
                RaceResult { winner: if winner == 0 {
                    None
                } else {
                    Some(winner)
                }, ended_at, scheduled_end_at }
            },
        )
}

pub fn aspect_order(game_id: u32) -> Span<u8> {
    let reader = dispatcher(game_id);
    let mut heights = array![];
    for aspect in 1_u8..5 {
        heights.append(reader.aspect_hyperstructure(AspectKey { game_id, aspect }).height);
    }
    let mut ranked = array![];
    for rank in 0_u8..4 {
        for aspect in 1_u8..5 {
            let height = *heights.at((aspect - 1).into());
            let mut ahead = 0_u8;
            for other in 1_u8..5 {
                let other_height = *heights.at((other - 1).into());
                if other_height > height || (other_height == height && other < aspect) {
                    ahead += 1;
                }
            }
            if ahead == rank {
                ranked.append(aspect);
            }
        }
    }
    ranked.span()
}

fn triumph_percent(home: ResourceKey, coord: Coord, stage: u8, timestamp: u64) -> u16 {
    let Some(rules) = rules(home.game_id) else {
        return 100;
    };
    if crate::logic::expeditions::depth_at(home.game_id, coord) == 3 {
        return 100;
    }
    let game = crate::logic::game::game(home.game_id);
    if timestamp < game.start_main_at || timestamp >= game.end_at {
        return 100;
    }
    let aspect = crate::logic::aspects::home_aspect(home);
    let day = crate::days::day_of(
        game, crate::logic::preset_record::for_game(home.game_id).rules.day_unit_seconds.read(), timestamp,
    );
    if triumph_day(TriumphKey { game_id: home.game_id, aspect, stage }) != Some(day.index) {
        return 100;
    }
    if stage == crate::rules::CLEAR_MIST_STAGE {
        rules.clear_mist_percent
    } else if stage == crate::rules::SECOND_WIND_STAGE {
        rules.second_wind_percent
    } else if stage == crate::rules::PALE_MOON_STAGE {
        rules.pale_moon_percent
    } else if stage == crate::rules::SPOILS_STAGE {
        rules.spoils_percent
    } else {
        panic!("invalid Triumph stage")
    }
}

fn initialize(game_id: u32) {
    let Some(rules) = rules(game_id) else {
        return;
    };
    assert!(crate::logic::aspects::rules(game_id).is_some(), "race requires Aspects");
    let game = crate::logic::game::game(game_id);
    let unit: u64 = crate::logic::preset_record::for_game(game_id).rules.day_unit_seconds.read().into();
    let duration = rules.season_days / crate::days::DAYS_PER_BAG * crate::days::UNITS_PER_BAG * unit;
    assert!(game.end_at - game.start_main_at <= duration, "race exceeds season day limit");
    let spacing = crate::logic::preset_record::for_game(game_id).settlement_spacing.read();
    for aspect in 1_u8..5 {
        initialize_hyperstructure(AspectKey { game_id, aspect }, rules, spacing);
    }
}

fn initialize_hyperstructure(key: AspectKey, rules: RaceRules, spacing: u32) {
    if crate::state::read().season.aspect_hyperstructures.read((key.game_id, key.aspect)) != 0 {
        return;
    }
    let center = crate::deep::center(spacing);
    let half = crate::rules::DEEP_MAP_SIZE / 2;
    let local = crate::race::local_coord(rules, key.aspect);
    let coord = crate::troops::Coord { alt: false, x: center.x - half + local.x, y: center.y - half + local.y };
    assert!(coord != crate::deep::arrival(spacing), "hyperstructure blocks Deep arrival");
    let entity_id: u64 = crate::logic::game::allocate_setup_entity(key.game_id).into();
    crate::logic::map::MapState::occupy(
        crate::geometry::tile_key(key.game_id, coord), entity_id, crate::taxonomy::HYPERSTRUCTURE_OCCUPIER, false,
    );
    crate::state::write().season.aspect_hyperstructures.write((key.game_id, key.aspect), entity_id);
    emit('AspectHyperstructure', key, AspectHyperstructure { entity_id, height: 0 });
}

fn pay_tick(game_id: u32, kind: u8, aspect: u8, shares: Span<crate::deep::DeepShare>, timestamp: u64) {
    let rules = rules(game_id).expect('race is disabled');
    validate_tick(game_id, kind, aspect, shares, timestamp);
    let glory = crate::race::split_payment(rules.glory_per_tick * crate::rules::RESOURCE_PRECISION, shares);
    let height = if kind == crate::rules::DEEP_FOUNDATION {
        build_height(AspectKey { game_id, aspect }, rules, timestamp)
    } else {
        0
    };
    let contributions = crate::race::split_payment(
        Into::<u32, u128>::into(height) * crate::rules::RESOURCE_PRECISION, shares,
    );
    credit_members(game_id, shares, glory, contributions);
}

fn credit_members(game_id: u32, shares: Span<crate::deep::DeepShare>, glory: Span<u128>, contributions: Span<u128>) {
    for index in 0..shares.len() {
        let key = ResourceKey { game_id, entity_id: *shares.at(index).home };
        let mut value = member(key);
        value.glory += *glory.at(index);
        value.contribution += *contributions.at(index);
        crate::state::write().season.race_members.write((game_id, key.entity_id), (value.glory, value.contribution));
        emit('RaceMember', key, value);
    }
}

fn validate_tick(game_id: u32, kind: u8, aspect: u8, shares: Span<crate::deep::DeepShare>, timestamp: u64) {
    assert!(kind == crate::rules::DEEP_FOUNDATION || kind == crate::rules::DEEP_ALTAR, "site does not pay Glory");
    crate::race::assert_aspect(aspect);
    let game = crate::logic::game::game(game_id);
    assert!(timestamp > game.start_main_at && timestamp <= game.end_at, "reward outside season");
    assert!(
        timestamp % crate::logic::preset_record::for_game(game_id).rules.tick_config.armies_tick_in_seconds.read() == 0,
        "reward outside army tick",
    );
    for share in shares {
        assert!(
            crate::logic::aspects::home_aspect(ResourceKey { game_id, entity_id: *share.home }) == aspect,
            "reward guard belongs to another Aspect",
        );
    }
}

fn build_height(key: AspectKey, rules: RaceRules, timestamp: u64) -> u32 {
    let before = hyperstructure(key);
    let blocked = height_blocked(key, timestamp - 1);
    let height = crate::race::height_after(rules, before.height, blocked);
    if height == before.height {
        return 0;
    }
    crate::state::write().season.aspect_heights.write((key.game_id, key.aspect), height);
    emit('AspectHyperstructure', key, AspectHyperstructure { height, ..before });
    schedule_triumph(key, rules, before.height, height, timestamp);
    if height == rules.stage_height * 5 {
        finish(key.game_id, Some(key.aspect), timestamp);
    }
    height - before.height
}

fn height_blocked(key: AspectKey, timestamp: u64) -> bool {
    let state = crate::state::read();
    let release = state.game_releases.read(key.game_id);
    return crate::race::IHeightBaneDispatcherTrait::height_blocked(
        crate::race::IHeightBaneLibraryDispatcher { class_hash: state.releases.entry(release).classes.combat.read() },
        key.game_id,
        key.aspect,
        timestamp,
    );
}

fn schedule_triumph(key: AspectKey, rules: RaceRules, before: u32, height: u32, timestamp: u64) {
    let stage: u8 = (height / rules.stage_height).try_into().unwrap();
    if stage == 5 || before / rules.stage_height == height / rules.stage_height {
        return;
    }
    let game = crate::logic::game::game(key.game_id);
    let day = crate::days::day_of(
        game, crate::logic::preset_record::for_game(key.game_id).rules.day_unit_seconds.read(), timestamp - 1,
    );
    let key = TriumphKey { game_id: key.game_id, aspect: key.aspect, stage };
    assert!(triumph_day(key).is_none(), "Triumph already scheduled");
    crate::state::write().season.triumph_days.write((key.game_id, key.aspect, key.stage), Some(day.index + 1));
    emit('TriumphDay', key, day.index + 1);
}

fn finish(game_id: u32, winner: Option<u8>, timestamp: u64) {
    assert!(result(game_id).is_none(), "race already finished");
    let mut game = crate::logic::game::game(game_id);
    assert!(timestamp <= game.end_at, "race finish after season");
    let scheduled_end_at = game.end_at;
    game.end_at = timestamp;
    crate::logic::game::write_game(game_id, game);
    crate::state::write().season.race_results.write(game_id, Some((winner.unwrap_or(0), timestamp, scheduled_end_at)));
    emit('RaceResult', game_id, RaceResult { winner, ended_at: timestamp, scheduled_end_at });
}

fn finalize(game_id: u32, timestamp: u64) {
    if result(game_id).is_some() {
        return;
    }
    let game = crate::logic::game::game(game_id);
    assert!(timestamp >= game.end_at, "race has not ended");
    finish(game_id, None, game.end_at);
}

fn emit<K, V, +Serde<K>, +Serde<V>, +Drop<K>, +Drop<V>>(model: felt252, key: K, value: V) {
    let mut keys = array![];
    let mut values = array![];
    key.serialize(ref keys);
    value.serialize(ref values);
    RaceState::emit(
        RaceState::Event::RowSet(crate::events::RowSet { version: 1, model, keys: keys.span(), values: values.span() }),
    );
}

#[starknet::component]
pub mod RaceState {
    use starknet::Event as EventTrait;
    #[storage]
    pub struct Storage {}
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: crate::events::RowSet,
    }
    pub fn emit(event: Event) {
        let mut keys = array![selector!("RaceEvent")];
        let mut data = array![];
        event.append_keys_and_data(ref keys, ref data);
        starknet::syscalls::emit_event_syscall(keys.span(), data.span()).unwrap();
    }
    #[embeddable_as(RaceImpl)]
    pub impl Race<
        TContractState, +HasComponent<TContractState>, +Drop<TContractState>,
    > of crate::race::IRace<ComponentState<TContractState>> {
        fn initialize_race(ref self: ComponentState<TContractState>, game_id: u32) {
            super::initialize(game_id);
        }
        fn finalize_race(ref self: ComponentState<TContractState>, game_id: u32, timestamp: u64) {
            super::finalize(game_id, timestamp);
        }
        fn triumph_percent(
            self: @ComponentState<TContractState>,
            home: crate::resources::ResourceKey,
            coord: crate::troops::Coord,
            stage: u8,
            timestamp: u64,
        ) -> u16 {
            super::triumph_percent(home, coord, stage, timestamp)
        }
        fn race_enabled(self: @ComponentState<TContractState>, game_id: u32) -> bool {
            super::rules(game_id).is_some()
        }
        fn race_rules(self: @ComponentState<TContractState>, game_id: u32) -> Option<crate::race::RaceRules> {
            super::rules(game_id)
        }
        fn race_member(
            self: @ComponentState<TContractState>, key: crate::resources::ResourceKey,
        ) -> crate::race::RaceMember {
            super::member(key)
        }
        fn aspect_hyperstructure(
            self: @ComponentState<TContractState>, key: crate::race::AspectKey,
        ) -> crate::race::AspectHyperstructure {
            super::hyperstructure(key)
        }
        fn triumph_day(self: @ComponentState<TContractState>, key: crate::race::TriumphKey) -> Option<u64> {
            super::triumph_day(key)
        }
        fn race_result(self: @ComponentState<TContractState>, game_id: u32) -> Option<crate::race::RaceResult> {
            super::result(game_id)
        }
    }
    #[embeddable_as(DeepRewardsImpl)]
    pub impl DeepRewards<
        TContractState, +HasComponent<TContractState>, +Drop<TContractState>,
    > of crate::deep::IDeepRewards<ComponentState<TContractState>> {
        fn pay_deep_tick(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            kind: u8,
            aspect: u8,
            shares: Span<crate::deep::DeepShare>,
            timestamp: u64,
        ) {
            super::pay_tick(game_id, kind, aspect, shares, timestamp);
        }
    }
}
