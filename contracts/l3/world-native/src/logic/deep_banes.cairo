use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess};
use crate::deep::{AltarBar, TeamBane, TeamBaneKey};

pub fn bane(key: TeamBaneKey) -> Option<TeamBane> {
    crate::state::read()
        .deep
        .team_banes
        .read((key.game_id, key.aspect, key.day))
        .map(|value| {
            let (source, issued_day, quest) = value;
            TeamBane { source, issued_day, quest }
        })
}

pub fn height_blocked(game_id: u32, aspect: u8, timestamp: u64) -> bool {
    let Some(day) = day(game_id, timestamp) else {
        return false;
    };
    if bane(TeamBaneKey { game_id, aspect, day: day.index }).is_none() {
        return false;
    }
    if crate::logic::banes::required(game_id, aspect, day.index) == 0 {
        return false;
    }
    let ended = crate::logic::banes::progress(game_id, aspect, day.index).ended_at;
    ended == 0 || timestamp < ended
}

pub fn credit(game_id: u32, source: u8, boundary: u64) {
    let rules = crate::logic::deep_sites::rules_entry(game_id).expect('missing Deep rules');
    let state = crate::state::write();
    let previous = state.deep.altar_bars.read((game_id, source));
    let threshold = rules.altar_threshold.read();
    let mut charge = previous + core::cmp::min(threshold - previous, rules.altar_per_tick.read());
    if charge == threshold && issue_next_day(game_id, source, boundary) {
        charge = 0;
    }
    state.deep.altar_bars.write((game_id, source), charge);
    crate::logic::deep::emit('AltarBar', crate::race::AspectKey { game_id, aspect: source }, AltarBar { charge });
}

fn issue_next_day(game_id: u32, source: u8, boundary: u64) -> bool {
    let end = crate::state::read().games.games.entry(game_id).end_at.read();
    if boundary >= end {
        return false;
    }
    let day = day(game_id, boundary - 1).expect('Altar tick outside season');
    if day.end >= end {
        return false;
    }
    let Some(target) = target(game_id, source, day.index, boundary - 1) else {
        return false;
    };
    issue(TeamBaneKey { game_id, aspect: target, day: day.index + 1 }, source, day.index);
    true
}

fn target(game_id: u32, source: u8, day: u64, timestamp: u64) -> Option<u8> {
    for aspect in crate::logic::race::aspect_order(game_id) {
        if *aspect == source || height_blocked(game_id, *aspect, timestamp) {
            continue;
        }
        if bane(TeamBaneKey { game_id, aspect: *aspect, day: day + 1 }).is_some() {
            continue;
        }
        return Some(*aspect);
    }
    None
}

fn issue(key: TeamBaneKey, source: u8, issued_day: u64) {
    assert!(bane(key).is_none(), "team bane already issued");
    let quest = next_quest(key, source);
    let state = crate::state::write();
    state.deep.team_banes.write((key.game_id, key.aspect, key.day), Some((source, issued_day, quest)));
    state.deep.latest_bane_day.write((key.game_id, key.aspect), Some(key.day));
    crate::logic::deep::emit('TeamBane', key, TeamBane { source, issued_day, quest });
    if state.banes.first_team_day.read(key.game_id).is_none() {
        state.banes.first_team_day.write(key.game_id, Some(issued_day));
        crate::logic::deep::emit('FirstTeamBane', key.game_id, Some(issued_day));
    }
}

fn next_quest(key: TeamBaneKey, source: u8) -> u8 {
    let previous = crate::state::read()
        .deep
        .latest_bane_day
        .read((key.game_id, key.aspect))
        .map(|day| bane(TeamBaneKey { day, ..key }).expect('missing previous team bane').quest);
    let seed = crate::state::read().games.games.entry(key.game_id).seed.read();
    let draw: u256 = core::poseidon::poseidon_hash_span(
        array![seed, 'team-bane-quest', key.aspect.into(), source.into(), key.day.into()].span(),
    )
        .into();
    let choices = if previous.is_some() {
        2
    } else {
        3
    };
    let mut quest: u8 = (draw % choices).try_into().unwrap();
    quest += crate::quests::STAND;
    if let Some(previous) = previous {
        if quest >= previous {
            quest += 1;
        }
    }
    quest
}

fn day(game_id: u32, timestamp: u64) -> Option<crate::days::Day> {
    let state = crate::state::read();
    let game = state.games.games.entry(game_id);
    let start = game.start_main_at.read();
    let end = match crate::logic::race::result(game_id) {
        Some(result) => result.scheduled_end_at,
        None => game.end_at.read(),
    };
    if timestamp < start || timestamp >= end {
        return None;
    }
    Some(
        crate::days::calendar_day(
            game.seed.read(),
            start,
            end,
            crate::logic::preset_record::for_game(game_id).rules.day_unit_seconds.read(),
            timestamp,
        ),
    )
}
