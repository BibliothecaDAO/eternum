use starknet::Event;
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess};
use crate::banes::{BaneEffects, BaneProgress, BaneWindow, IBaneEffectsDispatcherTrait, IBaneEffectsLibraryDispatcher};
use crate::resources::ResourceKey;

pub fn effects(home: ResourceKey, from: u64, until: u64) -> BaneEffects {
    let state = crate::state::read();
    let release = state.game_releases.read(home.game_id);
    IBaneEffectsLibraryDispatcher { class_hash: state.releases.entry(release).classes.production.read() }
        .bane_effects(home, from, until)
}

pub fn kind(game_id: u32, day: u64) -> Option<u8> {
    let Some((step, _, _, _, _)) = crate::logic::preset_record::for_game(game_id).bane_rules.read() else {
        return None;
    };
    crate::banes::world_kind(
        crate::state::read().games.games.entry(game_id).seed.read(),
        day,
        crate::state::read().banes.first_team_day.read(game_id),
        step,
    )
}

pub fn quest_kind(home: ResourceKey, day: u64) -> u8 {
    if let Some(kind) = kind(home.game_id, day) {
        return crate::banes::quest_kind(kind);
    }
    crate::quests::daily_quest(crate::state::read().games.games.entry(home.game_id).seed.read(), day)
}

pub fn target(home: ResourceKey, kind: u8, level: u8) -> u128 {
    let preset = crate::logic::preset_record::for_game(home.game_id);
    if kind < crate::quests::QUEST_COUNT {
        return Into::<u32, u128>::into(preset.quest_counts.read(kind)) * Into::<u8, u128>::into(level);
    }
    assert!(kind >= crate::quests::STAND && kind <= crate::quests::CULL, "invalid bane quest");
    let count = preset.bane_quest_counts.read((kind - crate::quests::STAND) * 4 + level - 1);
    count * if kind == crate::quests::CULL {
        crate::rules::RESOURCE_PRECISION
    } else {
        1
    }
}

pub fn required(game_id: u32, aspect: u8, day: u64) -> u32 {
    let (_, percent, _, _, _) = crate::logic::preset_record::for_game(game_id).bane_rules.read().unwrap();
    let active = if day == 0 {
        0
    } else {
        crate::state::read().troops.aspect_activity.read((game_id, aspect, day - 1))
    };
    crate::banes::required(active, percent)
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
    if kind(home.game_id, day).is_none() {
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
    emit(
        crate::events::RowSet {
            version: 1,
            model: 'BaneProgress',
            keys: array![home.game_id.into(), aspect.into(), day.into()].span(),
            values: array![completed.into(), ended_at.into()].span(),
        },
    );
}

pub fn read_effects(home: ResourceKey, from: u64, until: u64) -> BaneEffects {
    let preset = crate::logic::preset_record::for_game(home.game_id);
    let Some((step, quorum, beast_percent, stamina_percent, production_percent)) = preset.bane_rules.read() else {
        return BaneEffects {
            windows: array![].span(), beast_percent: 100, stamina_percent: 100, production_percent: 100,
        };
    };
    let effects = BaneEffects { windows: array![].span(), beast_percent, stamina_percent, production_percent };
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
    let game = state.games.games.entry(home.game_id);
    let seed = game.seed.read();
    let start = game.start_main_at.read();
    let end = game.end_at.read();
    let first_team_day = state.banes.first_team_day.read(home.game_id);
    let unit = preset.rules.day_unit_seconds.read();
    let mut cursor = core::cmp::max(from, start);
    let until = core::cmp::min(until, end);
    let mut windows = array![];
    while cursor < until {
        let day = crate::days::calendar_day(seed, start, end, unit, cursor);
        if let Some(kind) = crate::banes::world_kind(seed, day.index, first_team_day, step) {
            let ended = progress(home.game_id, aspect, day.index).ended_at;
            let active = if day.index == 0 {
                0
            } else {
                state.troops.aspect_activity.read((home.game_id, aspect, day.index - 1))
            };
            let end = if crate::banes::required(active, quorum) == 0 {
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

fn emit(row: crate::events::RowSet) {
    let event = BaneState::Event::RowSet(row);
    let mut keys = array![selector!("BaneEvent")];
    let mut data = array![];
    event.append_keys_and_data(ref keys, ref data);
    starknet::syscalls::emit_event_syscall(keys.span(), data.span()).unwrap();
}

#[starknet::component]
pub mod BaneState {
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

pub fn beast_percent(site: ResourceKey, timestamp: u64) -> u16 {
    let home = ResourceKey {
        game_id: site.game_id,
        entity_id: Into::<u32, u64>::into(crate::entity_ids::namespace(site.entity_id)) * 0x100000000 + 1,
    };
    let effects = effects(home, timestamp, timestamp + 1);
    for window in effects.windows {
        if *window.kind == crate::banes::BLOOD_MOON {
            return effects.beast_percent;
        }
    }
    100
}
