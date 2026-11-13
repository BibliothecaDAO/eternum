use crate::resources::ResourceKey;
use crate::troops::Coord;

pub fn percent(home: ResourceKey, coord: Coord, stage: u8, timestamp: u64) -> u16 {
    crate::race::IRaceDispatcherTrait::triumph_percent(
        crate::logic::race::dispatcher(home.game_id), home, coord, stage, timestamp,
    )
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
