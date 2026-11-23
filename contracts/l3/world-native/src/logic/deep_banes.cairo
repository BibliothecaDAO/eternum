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
    timestamp < height_block_end(game_id, aspect, timestamp)
}

pub fn height_block_end(game_id: u32, aspect: u8, timestamp: u64) -> u64 {
    let Some(day) = day(game_id, timestamp) else {
        return 0;
    };
    if bane(TeamBaneKey { game_id, aspect, day: day.index }).is_none() {
        return 0;
    }
    if crate::logic::banes::required(game_id, aspect, day.index) == 0 {
        return 0;
    }
    let ended = crate::logic::banes::progress(game_id, aspect, day.index).ended_at;
    if ended == 0 {
        day.end
    } else {
        ended
    }
}

pub fn settle_altar(game_id: u32, source: u8, charge: u32, boundary: u64, heights: Span<u32>) -> u32 {
    assert!(source >= 1 && source <= 4, "invalid Altar Aspect");
    let threshold = crate::logic::deep_sites::rules().altar_threshold;
    assert!(charge <= threshold, "Altar charge over its threshold");
    let settled = if charge == threshold && issue_next_day(game_id, source, boundary, heights) {
        0
    } else {
        charge
    };
    let state = crate::state::write();
    if state.banes.altar_bars.read((game_id, source)) != settled {
        state.banes.altar_bars.write((game_id, source), settled);
        crate::logic::banes::emit(
            'AltarBar', array![game_id.into(), source.into()].span(), array![settled.into()].span(),
        );
    }
    settled
}

fn issue_next_day(game_id: u32, source: u8, boundary: u64, heights: Span<u32>) -> bool {
    let end = crate::state::read().games.games.entry(game_id).end_at.read();
    if boundary >= end {
        return false;
    }
    let prepared_until = core::cmp::min(crate::state::read().banes.next_roll_at.read(game_id), end);
    let issued_at = core::cmp::max(boundary, prepared_until) - 1;
    let day = day(game_id, issued_at).expect('Altar tick outside season');
    if day.end >= end {
        return false;
    }
    let Some(target) = target(game_id, source, day.index, issued_at, heights) else {
        return false;
    };
    issue(TeamBaneKey { game_id, aspect: target, day: day.index + 1 }, source, day.index);
    true
}

fn target(game_id: u32, source: u8, day: u64, timestamp: u64, heights: Span<u32>) -> Option<u8> {
    let mut selected = None;
    let mut height = 0;
    for aspect in 1_u8..5 {
        if aspect == source
            || height_blocked(game_id, aspect, timestamp)
            || bane(TeamBaneKey { game_id, aspect, day: day + 1 }).is_some() {
            continue;
        }
        let rival_height = *heights.at((aspect - 1).into());
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
    crate::logic::banes::emit(
        'TeamBane',
        array![key.game_id.into(), key.aspect.into(), key.day.into()].span(),
        array![source.into(), issued_day.into(), quest.into()].span(),
    );
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
    if timestamp < game.start_main_at || timestamp >= game.end_at {
        return None;
    }
    Some(crate::days::day_of(game, crate::clock::day_unit_seconds(game), timestamp))
}

pub fn team_quest(home: crate::resources::ResourceKey, day: u64) -> Option<u8> {
    let aspect = crate::logic::aspects::home_aspect(home);
    bane(TeamBaneKey { game_id: home.game_id, aspect, day }).map(|bane| bane.quest)
}
