use core::dict::Felt252Dict;
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
use crate::race::{AspectHyperstructure, AspectKey, RaceMember, RaceResult, RaceRules, TriumphKey};
use crate::resources::ResourceKey;

#[cfg(feature: "blitz")]
pub fn rules() -> RaceRules {
    panic!("this family has no race")
}

#[cfg(not(feature: "blitz"))]
pub fn rules() -> RaceRules {
    crate::balance::race::RACE_RULES
}

pub fn member(key: ResourceKey) -> RaceMember {
    let (glory, contribution) = crate::state::read().season.race_members.read((key.game_id, key.entity_id));
    RaceMember { glory, contribution }
}

pub fn hyperstructure(key: AspectKey) -> AspectHyperstructure {
    assert!(key.aspect >= 1 && key.aspect <= 4, "invalid Aspect");
    let state = crate::state::read();
    AspectHyperstructure { height: state.season.aspect_heights.read((key.game_id, key.aspect)) }
}

pub fn triumph_day(key: TriumphKey) -> Option<u64> {
    assert!(key.aspect >= 1 && key.aspect <= 4, "invalid Aspect");
    assert!(key.stage >= 1 && key.stage < crate::race::STAGE_COUNT, "invalid Triumph stage");
    crate::state::read().season.triumph_days.read((key.game_id, key.aspect, key.stage))
}

pub fn result(game_id: u32) -> Option<RaceResult> {
    crate::state::read()
        .season
        .race_winners
        .read(game_id)
        .map(
            |winner| {
                let game = crate::logic::game::game(game_id);
                RaceResult {
                    winner: if winner == 0 {
                        None
                    } else {
                        Some(winner)
                    },
                    ended_at: game.end_at,
                    scheduled_end_at: game.scheduled_end_at,
                }
            },
        )
}

#[cfg(feature: "blitz")]
fn initialize(_game_id: u32) {}

#[cfg(not(feature: "blitz"))]
fn initialize(game_id: u32) {
    validate_game(game_id);
    for aspect in 1_u8..5 {
        let key = AspectKey { game_id, aspect };
        emit('AspectHyperstructure', key, hyperstructure(key));
    }
}

fn validate_game(game_id: u32) {
    let game = crate::logic::game::game(game_id);
    let unit: u64 = crate::balance::rules::SWITCHES.day_unit_seconds.into();
    let duration = rules().season_days / crate::days::DAYS_PER_BAG * crate::days::UNITS_PER_BAG * unit;
    assert!(game.scheduled_end_at - game.start_main_at <= duration, "race exceeds season day limit");
}


#[derive(Destruct)]
pub struct DeepRace {
    game_id: u32,
    finish_height: u32,
    heights: Felt252Dict<u32>,
    block_ends: Felt252Dict<u64>,
    raised: Array<u8>,
    glory: Felt252Dict<u128>,
    contribution: Felt252Dict<u128>,
    homes: Array<u64>,
    finished: bool,
}

#[generate_trait]
pub impl DeepRaceImpl of DeepRaceTrait {
    fn load(game_id: u32, boundary: u64) -> DeepRace {
        let state = crate::state::read();
        let bridge = crate::deep::IDeepBanesLibraryDispatcher {
            class_hash: crate::logic::release::release_class(state.game_releases.read(game_id), crate::slots::BRIDGE),
        };
        let mut heights: Felt252Dict<u32> = Default::default();
        let mut block_ends: Felt252Dict<u64> = Default::default();
        for aspect in 1_u8..5 {
            heights.insert(aspect.into(), hyperstructure(AspectKey { game_id, aspect }).height);
            block_ends
                .insert(
                    aspect.into(),
                    crate::deep::IDeepBanesDispatcherTrait::height_block_end(bridge, game_id, aspect, boundary - 1),
                );
        }
        DeepRace {
            game_id,
            finish_height: rules().stage_height * Into::<u8, u32>::into(crate::race::STAGE_COUNT),
            heights,
            block_ends,
            raised: array![],
            glory: Default::default(),
            contribution: Default::default(),
            homes: array![],
            finished: false,
        }
    }

    fn pay(
        ref self: DeepRace, kind: u8, aspect: u8, shares: Span<crate::deep::DeepShare>, amount: u32, boundary: u64,
    ) -> (Span<u128>, Span<u128>) {
        let glory = crate::race::split_payment(
            Into::<u32, u128>::into(amount) * crate::rules::RESOURCE_PRECISION, shares,
        );
        let height = if kind == crate::rules::DEEP_FOUNDATION {
            self.build(aspect, amount, boundary)
        } else {
            0
        };
        let contribution = crate::race::split_payment(
            Into::<u32, u128>::into(height) * crate::rules::RESOURCE_PRECISION, shares,
        );
        (glory, contribution)
    }

    fn credit(ref self: DeepRace, home: u64, glory: u128, contribution: u128) {
        if glory == 0 && contribution == 0 {
            return;
        }
        let key: felt252 = home.into();
        let (earned, built) = (self.glory.get(key), self.contribution.get(key));
        if earned == 0 && built == 0 {
            self.homes.append(home);
        }
        self.glory.insert(key, earned + glory);
        self.contribution.insert(key, built + contribution);
    }

    fn heights(ref self: DeepRace) -> Span<u32> {
        let mut heights = array![];
        for aspect in 1_u8..5 {
            heights.append(self.heights.get(aspect.into()));
        }
        heights.span()
    }

    fn finished(self: @DeepRace) -> bool {
        *self.finished
    }

    fn flush(ref self: DeepRace) {
        let game_id = self.game_id;
        for aspect in self.raised.span() {
            let key = AspectKey { game_id, aspect: *aspect };
            let height = self.heights.get((*aspect).into());
            crate::state::write().season.aspect_heights.write((game_id, *aspect), height);
            emit('AspectHyperstructure', key, AspectHyperstructure { height });
        }
        for home in self.homes.span() {
            let key = ResourceKey { game_id, entity_id: *home };
            let mut value = member(key);
            value.glory += self.glory.get((*home).into());
            value.contribution += self.contribution.get((*home).into());
            crate::state::write().season.race_members.write((game_id, *home), (value.glory, value.contribution));
            emit('RaceMember', key, value);
        }
    }

    fn build(ref self: DeepRace, aspect: u8, amount: u32, boundary: u64) -> u32 {
        let before = self.heights.get(aspect.into());
        if boundary - 1 < self.block_ends.get(aspect.into()) {
            return 0;
        }
        let height = before + core::cmp::min(amount, self.finish_height - before);
        if height == before {
            return 0;
        }
        let mut raised = true;
        for value in self.raised.span() {
            if *value == aspect {
                raised = false;
            }
        }
        if raised {
            self.raised.append(aspect);
        }
        self.heights.insert(aspect.into(), height);
        let key = AspectKey { game_id: self.game_id, aspect };
        schedule_triumph(key, before, height, boundary);
        if height == self.finish_height {
            finish(self.game_id, Some(aspect), boundary);
            self.finished = true;
        }
        height - before
    }
}

fn schedule_triumph(key: AspectKey, before: u32, height: u32, timestamp: u64) {
    let stage_height = rules().stage_height;
    let stage: u8 = (height / stage_height).try_into().unwrap();
    if stage == crate::race::STAGE_COUNT || before / stage_height == height / stage_height {
        return;
    }
    let game = crate::logic::game::game(key.game_id);
    let day = crate::days::day_of(game, crate::balance::rules::SWITCHES.day_unit_seconds, timestamp - 1);
    if day.end >= game.end_at {
        return;
    }
    let key = TriumphKey { game_id: key.game_id, aspect: key.aspect, stage };
    assert!(triumph_day(key).is_none(), "Triumph already scheduled");
    crate::state::write().season.triumph_days.write((key.game_id, key.aspect, key.stage), Some(day.index + 1));
    emit('TriumphDay', key, day.index + 1);
}

#[cfg(feature: "blitz")]
pub fn finish_expired(_game_id: u32, _timestamp: u64) {}

#[cfg(not(feature: "blitz"))]
pub fn finish_expired(game_id: u32, timestamp: u64) {
    if result(game_id).is_some() {
        return;
    }
    let game = crate::logic::game::game(game_id);
    if timestamp >= game.end_at {
        finish(game_id, None, game.end_at);
    }
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
        fn site_beast_bps(
            self: @ComponentState<TContractState>, site: crate::resources::ResourceKey, home: u64, timestamp: u64,
        ) -> u32 {
            crate::logic::triumphs::site_beast_bps(site, home, timestamp)
        }
        fn finish_expired_race(ref self: ComponentState<TContractState>, game_id: u32, timestamp: u64) {
            super::finish_expired(game_id, timestamp);
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
        fn expedition_effects(
            self: @ComponentState<TContractState>, home: crate::resources::ResourceKey, timestamp: u64,
        ) -> crate::race::ExpeditionEffects {
            crate::logic::triumphs::read_effects(home, timestamp)
        }
        fn race_result(self: @ComponentState<TContractState>, game_id: u32) -> Option<crate::race::RaceResult> {
            super::result(game_id)
        }
    }
    #[embeddable_as(DeepTicksImpl)]
    pub impl DeepTicks<
        TContractState, +HasComponent<TContractState>, +Drop<TContractState>,
    > of crate::deep::IDeepTicks<ComponentState<TContractState>> {
        fn settle_deep(
            ref self: ComponentState<TContractState>, game_id: u32, context: crate::commands::ActionContext,
        ) {
            crate::logic::deep_ticks::settle(game_id, crate::commands::execution_context(game_id, context));
        }
    }
}
