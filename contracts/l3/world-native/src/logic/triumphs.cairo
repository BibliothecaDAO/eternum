use starknet::storage::{StorageMapReadAccess, StoragePathEntry, StoragePointerReadAccess};
use crate::race::TriumphKey;
use crate::resources::ResourceKey;
use crate::troops::Coord;

pub fn percent(home: ResourceKey, coord: Coord, stage: u8, timestamp: u64) -> u16 {
    let state = crate::state::read();
    let release = state.game_releases.read(home.game_id);
    crate::race::IRaceDispatcherTrait::triumph_percent(
        crate::race::IRaceLibraryDispatcher { class_hash: state.releases.entry(release).classes.economy.read() },
        home,
        coord,
        stage,
        timestamp,
    )
}

pub fn read_percent(home: ResourceKey, coord: Coord, stage: u8, timestamp: u64) -> u16 {
    let Some(rules) = crate::logic::race::rules(home.game_id) else {
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
    if crate::logic::race::triumph_day(TriumphKey { game_id: home.game_id, aspect, stage }) != Some(day.index) {
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

pub fn beast_percent(site: ResourceKey, timestamp: u64) -> u16 {
    let coord = crate::structures::structure_coord(site);
    if crate::logic::expeditions::depth_at(site.game_id, coord) == 3 {
        return 100;
    }
    let home = ResourceKey { game_id: site.game_id, entity_id: crate::entity_ids::open_home(site.entity_id) };
    let triumph: u32 = percent(home, coord, crate::rules::PALE_MOON_STAGE, timestamp).into();
    let bane: u32 = crate::logic::banes::beast_percent(site, timestamp).into();
    (triumph * bane / 100).try_into().unwrap()
}
