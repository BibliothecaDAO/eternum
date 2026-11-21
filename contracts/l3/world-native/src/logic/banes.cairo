use starknet::Event;
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess};
#[cfg(not(feature: "blitz"))]
use crate::banes::BaneWindow;
use crate::banes::{BaneEffects, BaneProgress, IBaneEffectsDispatcherTrait, IBaneEffectsLibraryDispatcher};
use crate::resources::ResourceKey;

pub fn effects(home: ResourceKey, from: u64, until: u64) -> BaneEffects {
    IBaneEffectsLibraryDispatcher { class_hash: crate::logic::release::class_of(home.game_id, crate::slots::BRIDGE) }
        .bane_effects(home, from, until)
}

pub fn kind(game_id: u32, day: u64) -> Option<u8> {
    crate::logic::bane_calendar::kind(game_id, day)
}

pub fn quest_kind(home: ResourceKey, day: u64) -> u8 {
    if let Some(quest) = crate::logic::deep_banes::team_quest(home, day) {
        return quest;
    }
    if let Some(kind) = kind(home.game_id, day) {
        return crate::banes::quest_kind(kind);
    }
    crate::quests::daily_quest(crate::state::read().games.games.entry(home.game_id).seed.read(), day)
}

#[cfg(feature: "blitz")]
pub fn target(_kind: u8, _level: u8) -> u128 {
    panic!("daily quests are disabled")
}

#[cfg(not(feature: "blitz"))]
pub fn target(kind: u8, level: u8) -> u128 {
    if kind < crate::quests::QUEST_COUNT {
        let count = *crate::balance::quests::BASE_COUNTS.span().at(kind.into());
        return Into::<u32, u128>::into(count) * Into::<u8, u128>::into(level);
    }
    assert!(kind >= crate::quests::STAND && kind <= crate::quests::CULL, "invalid bane quest");
    *crate::balance::banes::QUEST_COUNTS.span().at(((kind - crate::quests::STAND) * 4 + level - 1).into())
}

#[cfg(feature: "blitz")]
pub fn required(_game_id: u32, _aspect: u8, _day: u64) -> u32 {
    panic!("this family has no Banes")
}

#[cfg(not(feature: "blitz"))]
pub fn required(game_id: u32, aspect: u8, day: u64) -> u32 {
    let active = if day == 0 {
        0
    } else {
        crate::state::read().troops.aspect_activity.read((game_id, aspect, day - 1))
    };
    crate::banes::required(active, crate::balance::banes::QUORUM_PERCENT)
}

pub fn progress(game_id: u32, aspect: u8, day: u64) -> BaneProgress {
    let (completed, ended_at) = crate::state::read().banes.progress.read((game_id, aspect, day));
    BaneProgress { completed, ended_at }
}

pub fn won(home: ResourceKey, day: u64) -> bool {
    if kind(home.game_id, day).is_none() {
        return false;
    }
    let aspect = crate::logic::aspects::home_aspect(home);
    required(home.game_id, aspect, day) == 0 || progress(home.game_id, aspect, day).ended_at != 0
}

pub fn complete(home: ResourceKey, day: u64, timestamp: u64) {
    if kind(home.game_id, day).is_none() && crate::logic::deep_banes::team_quest(home, day).is_none() {
        return;
    }
    let aspect = crate::logic::aspects::home_aspect(home);
    let previous = progress(home.game_id, aspect, day);
    let completed = previous.completed + 1;
    let goal = required(home.game_id, aspect, day);
    let ended_at = if previous.ended_at != 0 {
        previous.ended_at
    } else if completed >= goal {
        timestamp
    } else {
        0
    };
    crate::state::write().banes.progress.write((home.game_id, aspect, day), (completed, ended_at));
    emit_row(
        crate::events::RowSet {
            version: 1,
            model: 'BaneProgress',
            keys: array![home.game_id.into(), aspect.into(), day.into()].span(),
            values: array![completed.into(), ended_at.into()].span(),
        },
    );
}

#[cfg(feature: "blitz")]
pub fn read_effects(_home: ResourceKey, _from: u64, _until: u64) -> BaneEffects {
    BaneEffects { windows: array![].span(), beast_percent: 100, stamina_percent: 100, production_percent: 100 }
}

#[cfg(not(feature: "blitz"))]
pub fn read_effects(home: ResourceKey, from: u64, until: u64) -> BaneEffects {
    let effects = BaneEffects {
        windows: array![].span(),
        beast_percent: crate::balance::banes::BEAST_PERCENT,
        stamina_percent: crate::balance::banes::STAMINA_PERCENT,
        production_percent: crate::balance::banes::PRODUCTION_PERCENT,
    };
    if from >= until {
        return effects;
    }
    let state = crate::state::read();
    assert!(crate::logic::structures::exists(home), "missing structure");
    if state
        .structures
        .structures
        .entry((home.game_id, home.entity_id))
        .base
        .read()
        .category != crate::taxonomy::REALM_CATEGORY {
        return effects;
    }
    let aspect = crate::logic::aspects::home_aspect(home);
    let game = crate::logic::game::game(home.game_id);
    let start = game.start_main_at;
    let end = game.end_at;
    let unit = crate::balance::rules::SWITCHES.day_unit_seconds;
    let mut cursor = core::cmp::max(from, start);
    let until = core::cmp::min(until, end);
    let mut windows = array![];
    while cursor < until {
        let day = crate::days::day_of(game, unit, cursor);
        if let Some(kind) = kind(home.game_id, day.index) {
            let ended = progress(home.game_id, aspect, day.index).ended_at;
            let active = if day.index == 0 {
                0
            } else {
                state.troops.aspect_activity.read((home.game_id, aspect, day.index - 1))
            };
            let end = if crate::banes::required(active, crate::balance::banes::QUORUM_PERCENT) == 0 {
                day.start
            } else if ended != 0 {
                core::cmp::min(ended, day.end)
            } else {
                day.end
            };
            let start = core::cmp::max(cursor, day.start);
            let end = core::cmp::min(end, until);
            if start < end {
                windows.append(BaneWindow { kind, start, end });
            }
        }
        cursor = day.end;
    }
    BaneEffects { windows: windows.span(), ..effects }
}

fn emit_row(row: crate::events::RowSet) {
    let event = BaneState::Event::RowSet(row);
    let mut keys = array![selector!("BaneEvent")];
    let mut data = array![];
    event.append_keys_and_data(ref keys, ref data);
    starknet::syscalls::emit_event_syscall(keys.span(), data.span()).unwrap();
}

#[starknet::component]
pub mod BaneState {
    #[embeddable_as(EffectsImpl)]
    pub impl Effects<
        TContractState, +HasComponent<TContractState>, +Drop<TContractState>,
    > of crate::banes::IBaneEffects<ComponentState<TContractState>> {
        fn bane_effects(
            self: @ComponentState<TContractState>, home: crate::resources::ResourceKey, from: u64, until: u64,
        ) -> crate::banes::BaneEffects {
            super::read_effects(home, from, until)
        }
    }

    #[embeddable_as(CalendarImpl)]
    pub impl Calendar<
        TContractState, +HasComponent<TContractState>, +Drop<TContractState>,
    > of crate::banes::IWorldBanes<ComponentState<TContractState>> {
        fn initialize_bane_calendar(ref self: ComponentState<TContractState>, game_id: u32) {
            crate::logic::bane_calendar::initialize(game_id);
        }
        fn prepare_bane_day(
            ref self: ComponentState<TContractState>, game_id: u32, context: crate::commands::ActionContext,
        ) {
            crate::logic::bane_calendar::prepare(game_id, context);
        }
    }

    #[embeddable_as(TeamImpl)]
    pub impl Team<
        TContractState, +HasComponent<TContractState>, +Drop<TContractState>,
    > of crate::deep::IDeepBanes<ComponentState<TContractState>> {
        fn height_block_end(self: @ComponentState<TContractState>, game_id: u32, aspect: u8, timestamp: u64) -> u64 {
            crate::logic::deep_banes::height_block_end(game_id, aspect, timestamp)
        }
        fn settle_altar(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            source: u8,
            charge: u32,
            boundary: u64,
            heights: Span<u32>,
        ) -> u32 {
            crate::logic::deep_banes::settle_altar(game_id, source, charge, boundary, heights)
        }
        fn team_quest(
            self: @ComponentState<TContractState>, home: crate::resources::ResourceKey, day: u64,
        ) -> Option<u8> {
            crate::logic::deep_banes::team_quest(home, day)
        }
    }

    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    pub struct Storage {
        #[flat]
        pub data: crate::state::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: crate::events::RowSet,
    }
}

pub fn emit(model: felt252, keys: Span<felt252>, values: Span<felt252>) {
    emit_row(crate::events::RowSet { version: 1, model, keys, values });
}
