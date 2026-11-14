use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess};
use crate::deep::{TeamBane, TeamBaneKey};

pub fn bane(key: TeamBaneKey) -> Option<TeamBane> {
    crate::state::read()
        .banes
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
    let preset = crate::logic::preset_record::for_game(game_id);
    if preset.bane_rules.read().is_none() { return; }
    assert!(source >= 1 && source <= 4, "invalid Altar Aspect");
    let game = crate::logic::game::game(game_id);
    assert!(boundary > game.start_main_at && boundary <= game.end_at, "Altar tick outside season");
    assert!(boundary % preset.rules.tick_config.armies_tick_in_seconds.read() == 0, "Altar credit outside tick");
    let rules = preset.deep_rules.read().expect('missing Deep rules');
    let state = crate::state::write();
    let previous = state.banes.altar_bars.read((game_id, source));
    let threshold = rules.altar_threshold;
    let mut charge = previous + core::cmp::min(threshold - previous, rules.altar_per_tick);
    if charge == threshold && issue_next_day(game_id, source, boundary) {
        charge = 0;
    }
    state.banes.altar_bars.write((game_id, source), charge);
    crate::logic::banes::emit('AltarBar', array![game_id.into(), source.into()].span(), array![charge.into()].span());
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
    let mut selected = None;
    let mut height = 0;
    for aspect in 1_u8..5 {
        if aspect == source || height_blocked(game_id, aspect, timestamp)
            || bane(TeamBaneKey { game_id, aspect, day: day + 1 }).is_some() {
            continue;
        }
        let rival_height = crate::state::read().season.aspect_heights.read((game_id, aspect));
        if selected.is_none() || rival_height > height {
            selected = Some(aspect);
            height = rival_height;
        }
    }
    selected
}

fn issue(key: TeamBaneKey, source: u8, issued_day: u64) {
    assert!(bane(key).is_none(), "team bane already issued");
    let quest = next_quest(key, source);
    let state = crate::state::write();
    state.banes.team_banes.write((key.game_id, key.aspect, key.day), Some((source, issued_day, quest)));
    state.banes.latest_bane_day.write((key.game_id, key.aspect), Some(key.day));
    crate::logic::banes::emit('TeamBane', array![key.game_id.into(), key.aspect.into(), key.day.into()].span(), array![source.into(), issued_day.into(), quest.into()].span());
    if state.banes.first_team_day.read(key.game_id).is_none() {
        state.banes.first_team_day.write(key.game_id, Some(issued_day));
        crate::logic::banes::emit('FirstTeamBane', array![key.game_id.into()].span(), array![issued_day.into()].span());
    }
}

fn next_quest(key: TeamBaneKey, source: u8) -> u8 {
    let previous = crate::state::read()
        .banes
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
    let game = crate::logic::game::game(game_id);
    if timestamp < game.start_main_at || timestamp >= game.end_at { return None; }
    Some(crate::days::day_of(game, crate::logic::preset_record::for_game(game_id).rules.day_unit_seconds.read(), timestamp))
}

pub fn team_quest(home: crate::resources::ResourceKey, day: u64) -> Option<u8> {
    if crate::logic::preset_record::for_game(home.game_id).bane_rules.read().is_none() { return None; }
    let aspect = crate::logic::aspects::home_aspect(home);
    bane(TeamBaneKey { game_id: home.game_id, aspect, day }).map(|bane| bane.quest)
}
