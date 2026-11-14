use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess};
use crate::race::{AspectHyperstructure, AspectKey, RaceMember, RaceResult, RaceRules, TriumphKey};
use crate::resources::ResourceKey;

pub fn rules(game_id: u32) -> Option<RaceRules> {
    crate::logic::preset_record::for_game(game_id).race_rules.read()
}

pub fn member(key: ResourceKey) -> RaceMember {
    let (glory, contribution) = crate::state::read().season.race_members.read((key.game_id, key.entity_id));
    RaceMember { glory, contribution }
}

pub fn hyperstructure(key: AspectKey) -> AspectHyperstructure {
    assert!(key.aspect >= 1 && key.aspect <= 4, "invalid Aspect");
    let state = crate::state::read();
    let entity_id = state.season.aspect_hyperstructures.read((key.game_id, key.aspect));
    assert!(entity_id != 0, "race hyperstructure is missing");
    AspectHyperstructure { entity_id, height: state.season.aspect_heights.read((key.game_id, key.aspect)) }
}

pub fn triumph_day(key: TriumphKey) -> Option<u64> {
    assert!(key.aspect >= 1 && key.aspect <= 4, "invalid Aspect");
    assert!(key.stage >= 1 && key.stage < crate::race::STAGE_COUNT, "invalid Triumph stage");
    crate::state::read().season.triumph_days.read((key.game_id, key.aspect, key.stage))
}

pub fn result(game_id: u32) -> Option<RaceResult> {
    crate::state::read().season.race_winners.read(game_id).map(|winner| {
        let game = crate::logic::game::game(game_id);
        RaceResult {
            winner: if winner == 0 { None } else { Some(winner) },
            ended_at: game.end_at,
            scheduled_end_at: game.scheduled_end_at,
        }
    })
}

fn initialize(game_id: u32) {
    let Some(rules) = rules(game_id) else {
        return;
    };
    validate_game(game_id, rules);
    let spacing = crate::logic::preset_record::for_game(game_id).settlement_spacing.read();
    for aspect in 1_u8..5 {
        initialize_hyperstructure(AspectKey { game_id, aspect }, rules, spacing);
    }
}

fn validate_game(game_id: u32, rules: RaceRules) {
    assert!(crate::logic::aspects::rules(game_id).is_some(), "race requires Aspects");
    let game = crate::logic::game::game(game_id);
    let unit: u64 = crate::logic::preset_record::for_game(game_id).rules.day_unit_seconds.read().into();
    let duration = rules.season_days / crate::days::DAYS_PER_BAG * crate::days::UNITS_PER_BAG * unit;
    assert!(game.scheduled_end_at - game.start_main_at <= duration, "race exceeds season day limit");
    let tick = crate::logic::preset_record::for_game(game_id).rules.tick_config.armies_tick_in_seconds.read();
    let ticks = game.scheduled_end_at / tick - game.start_main_at / tick;
    let maximum_glory = Into::<u128, u256>::into(rules.glory_per_tick * crate::rules::RESOURCE_PRECISION)
        * Into::<u64, u256>::into(ticks) * 2;
    let _: u128 = maximum_glory.try_into().expect('race Glory exceeds limit');
}

fn initialize_hyperstructure(key: AspectKey, rules: RaceRules, spacing: u32) {
    if crate::state::read().season.aspect_hyperstructures.read((key.game_id, key.aspect)) != 0 {
        return;
    }
    let local = crate::race::local_coord(rules, key.aspect);
    let coord = crate::deep::site_position(local.x, local.y, spacing);
    let entity_id: u64 = crate::logic::game::allocate_setup_entity(key.game_id).into();
    crate::logic::map::MapState::occupy(
        crate::geometry::tile_key(key.game_id, coord), entity_id, crate::taxonomy::HYPERSTRUCTURE_OCCUPIER, true,
    );
    crate::logic::structures::StructureState::create(
        ResourceKey { game_id: key.game_id, entity_id },
        crate::structures::StructureRecord {
            owner: 0.try_into().unwrap(),
            base: crate::structures::StructureBase {
                category: crate::taxonomy::HYPERSTRUCTURE_CATEGORY,
                created_at: crate::logic::game::game(key.game_id).start_main_at.try_into().unwrap(),
                ..Default::default()
            },
            resources_packed: 0,
            metadata: Default::default(),
        },
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
    assert!(aspect >= 1 && aspect <= 4, "invalid Aspect");
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
    let finish_height = rules.stage_height * Into::<u8, u32>::into(crate::race::STAGE_COUNT);
    let height = if blocked { before.height } else { before.height + core::cmp::min(rules.height_per_tick, finish_height - before.height) };
    if height == before.height {
        return 0;
    }
    crate::state::write().season.aspect_heights.write((key.game_id, key.aspect), height);
    emit('AspectHyperstructure', key, AspectHyperstructure { height, ..before });
    schedule_triumph(key, rules, before.height, height, timestamp);
    if height == finish_height {
        finish(key.game_id, Some(key.aspect), timestamp);
    }
    height - before.height
}

fn height_blocked(key: AspectKey, timestamp: u64) -> bool {
    let state = crate::state::read();
    let release = state.game_releases.read(key.game_id);
    return crate::deep::IDeepBanesDispatcherTrait::height_blocked(
        crate::deep::IDeepBanesLibraryDispatcher { class_hash: state.releases.entry(release).classes.bridge.read() },
        key.game_id,
        key.aspect,
        timestamp,
    );
}

fn schedule_triumph(key: AspectKey, rules: RaceRules, before: u32, height: u32, timestamp: u64) {
    let stage: u8 = (height / rules.stage_height).try_into().unwrap();
    if stage == crate::race::STAGE_COUNT || before / rules.stage_height == height / rules.stage_height {
        return;
    }
    let game = crate::logic::game::game(key.game_id);
    let day = crate::days::day_of(
        game, crate::logic::preset_record::for_game(key.game_id).rules.day_unit_seconds.read(), timestamp - 1,
    );
    if day.end >= game.end_at {
        return;
    }
    let key = TriumphKey { game_id: key.game_id, aspect: key.aspect, stage };
    assert!(triumph_day(key).is_none(), "Triumph already scheduled");
    crate::state::write().season.triumph_days.write((key.game_id, key.aspect, key.stage), Some(day.index + 1));
    emit('TriumphDay', key, day.index + 1);
}

fn finish(game_id: u32, winner: Option<u8>, timestamp: u64) {
    assert!(result(game_id).is_none(), "race already finished");
    let mut game = crate::logic::game::game(game_id);
    assert!(timestamp <= game.end_at, "race finish after season");
    game.end_at = timestamp;
    crate::logic::game::write_game(game_id, game);
    crate::state::write().season.race_winners.write(game_id, Some(winner.unwrap_or(0)));
    emit('RaceResult', game_id, result(game_id).unwrap());
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
