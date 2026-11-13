use starknet::Event;
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess};
use crate::banes::{BaneProgress, BaneWindow};
use crate::resources::ResourceKey;

pub fn enabled(game_id: u32) -> bool {
    crate::logic::preset_record::for_game(game_id).bane_rules.read().is_some()
}

pub fn kind(game_id: u32, day: u64) -> Option<u8> {
    let Some((step, _, _, _, _)) = crate::logic::preset_record::for_game(game_id).bane_rules.read() else {
        return None;
    };
    crate::banes::world_kind(
        crate::logic::game::game(game_id).seed, day, crate::state::read().banes.first_team_day.read(game_id), step,
    )
}

pub fn quest_kind(home: ResourceKey, day: u64) -> u8 {
    if let Some(kind) = kind(home.game_id, day) {
        return crate::banes::quest_kind(kind);
    }
    crate::quests::daily_quest(crate::logic::game::game(home.game_id).seed, day)
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

pub fn windows(home: ResourceKey, from: u64, until: u64) -> Span<BaneWindow> {
    let mut windows = array![];
    if !enabled(home.game_id) || from >= until {
        return windows.span();
    }
    if crate::logic::structures::record(home).base.category != crate::taxonomy::REALM_CATEGORY {
        return windows.span();
    }
    let aspect = crate::logic::aspects::home_aspect(home);
    let game = crate::logic::game::game(home.game_id);
    let unit = crate::logic::preset_record::for_game(home.game_id).rules.day_unit_seconds.read();
    let mut cursor = core::cmp::max(from, game.start_main_at);
    let until = core::cmp::min(until, game.end_at);
    while cursor < until {
        let day = crate::days::day_of(game, unit, cursor);
        if let Some(kind) = kind(home.game_id, day.index) {
            let ended = progress(home.game_id, aspect, day.index).ended_at;
            let end = if required(home.game_id, aspect, day.index) == 0 {
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
    windows.span()
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

pub fn production_percent(game_id: u32) -> u16 {
    match crate::logic::preset_record::for_game(game_id).bane_rules.read() {
        Some((_, _, _, _, rate)) => rate,
        None => 100,
    }
}
pub fn stamina_percent(game_id: u32) -> u16 {
    match crate::logic::preset_record::for_game(game_id).bane_rules.read() {
        Some((_, _, _, rate, _)) => rate,
        None => 100,
    }
}
pub fn beast_percent(site: ResourceKey, timestamp: u64) -> u16 {
    let Some((_, _, rate, _, _)) = crate::logic::preset_record::for_game(site.game_id).bane_rules.read() else {
        return 100;
    };
    let home = ResourceKey {
        game_id: site.game_id,
        entity_id: Into::<u32, u64>::into(crate::entity_ids::namespace(site.entity_id)) * 0x100000000 + 1,
    };
    for window in windows(home, timestamp, timestamp + 1) {
        if *window.kind == crate::banes::BLOOD_MOON {
            return rate;
        }
    }
    100
}
