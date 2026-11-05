use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess};
use crate::expeditions::*;
use crate::troops::Coord;

pub fn expedition_site(key: crate::resources::ResourceKey) -> Option<ExpeditionSite> {
    crate::state::read().structures.expedition_sites.read((key.game_id, key.entity_id))
}

pub fn create_site(key: crate::resources::ResourceKey, guards: Span<crate::troops::Troops>) {
    let coord = crate::structures::structure_coord(key);
    let category = crate::logic::structures::record(key).base.category;
    assert!(crate::expeditions::is_site_category(category), "not a guarded site");
    assert!(expedition_site(key).is_none(), "site already initialized");
    let mut initial_guard_count = 0;
    for guard in guards {
        initial_guard_count += *guard.count;
    }
    assert!(initial_guard_count != 0, "empty site guard");
    write_site(
        key, ExpeditionSite { category, initial_guard_count, alt: coord.alt, col: coord.x, row: coord.y, clear: None },
    );
}

pub fn clear_site(key: crate::resources::ResourceKey, result: SiteClear) {
    let mut site = expedition_site(key).expect('missing expedition site');
    assert!(site.clear.is_none(), "site already cleared");
    site.clear = Some(result);
    write_site(key, site);
    crate::logic::map::MapState::clear_expedition_site(key);
    crate::logic::guards::GuardState::reset(key);
    crate::logic::structures::StructureState::remove(key);
}

fn write_site(key: crate::resources::ResourceKey, site: ExpeditionSite) {
    crate::state::write().structures.expedition_sites.write((key.game_id, key.entity_id), Some(site));
    let mut keys = array![];
    key.serialize(ref keys);
    let mut values = array![];
    site.serialize(ref values);
    crate::logic::structures::StructureState::emit(
        crate::logic::structures::StructureState::Event::RowSet(
            crate::events::RowSet { version: 1, model: 'ExpeditionSite', keys: keys.span(), values: values.span() },
        ),
    );
}

pub fn depth_rules_at(game_id: u32, coord: Coord) -> DepthRules {
    depth_rules(game_id, depth_at(game_id, coord))
}

pub fn depth_at(game_id: u32, coord: Coord) -> u8 {
    let spacing = crate::logic::settlement::rules(game_id).spacing;
    (coord.y / spacing % 4).try_into().unwrap()
}

pub fn depth_rules(game_id: u32, depth: u8) -> DepthRules {
    crate::logic::preset_record::for_game(game_id).depth_rules.read(depth).expect('missing depth rules')
}

pub fn discovery(key: ExpeditionDiscoveryKey) -> Option<ExpeditionDiscovery> {
    let state = crate::state::read();
    let storage_key = (key.game_id, key.structure_id, key.epoch);
    state
        .map_rules
        .empty_reveals
        .read(storage_key)
        .map(
            |
                empty_reveals,
            | ExpeditionDiscovery { empty_reveals, ruin_cleared: state.map_rules.ruin_cleared.read(ruin_key(key)) },
        )
}

fn ruin_key(key: ExpeditionDiscoveryKey) -> (u32, u64, u64) {
    (key.game_id, crate::entity_ids::namespace(key.structure_id).into(), key.epoch)
}

pub fn ruin_disappeared(key: crate::resources::ResourceKey) -> bool {
    let state = crate::state::read();
    let storage_key = (key.game_id, key.entity_id);
    if state.structures.structures.entry(storage_key).base.read().category != crate::taxonomy::RUIN_CATEGORY {
        return false;
    }
    let Some(chest) = state.structures.site_chests.read(storage_key) else {
        return false;
    };
    let Some(site) = state.structures.expedition_sites.read(storage_key) else {
        return false;
    };
    if site.clear.is_some() {
        return false;
    }
    let coord = Coord { alt: site.alt, x: site.col, y: site.row };
    ruin_cleared_at(
        ExpeditionDiscoveryKey { game_id: key.game_id, structure_id: key.entity_id, epoch: chest.reservation_day },
        depth_at(key.game_id, coord),
    )
}

pub fn ruin_cleared_at(key: ExpeditionDiscoveryKey, depth: u8) -> bool {
    if per_depth_ruins(key.game_id) {
        cleared_depths(key) & depth_bit(depth) != 0
    } else {
        crate::state::read().map_rules.ruin_cleared.read(ruin_key(key))
    }
}

fn depth_bit(depth: u8) -> u8 {
    match depth {
        0 => 1,
        1 => 2,
        2 => 4,
        3 => 8,
        _ => panic!("invalid ruin depth"),
    }
}

fn per_depth_ruins(game_id: u32) -> bool {
    crate::state::read().game_releases.read(game_id) >= crate::logic::release::RUIN_DEPTH_LIMIT_RELEASE
}

fn cleared_depths(key: ExpeditionDiscoveryKey) -> u8 {
    let state = crate::state::read();
    let mask = state.map_rules.cleared_ruin_depths.read(ruin_key(key));
    assert!(mask <= 15, "invalid ruin depth mask");
    if mask == 0 && state.map_rules.ruin_cleared.read(ruin_key(key)) {
        legacy_cleared_depths(key)
    } else {
        mask
    }
}

// Before depth limits, one clear receipt identified the depth hidden by the home's daily boolean.
fn legacy_cleared_depths(key: ExpeditionDiscoveryKey) -> u8 {
    let state = crate::state::read();
    let home = crate::entity_ids::namespace(key.structure_id);
    let allocated = state.games.home_entities.read((key.game_id, home));
    let spacing = crate::logic::settlement::rules(key.game_id).spacing;
    let mut mask = 0;
    for local in 1_u64..Into::<u32, u64>::into(allocated) + 1 {
        let entity_id = Into::<u32, u64>::into(home) * 0x100000000 + local;
        let Some(site) = state.structures.expedition_sites.read((key.game_id, entity_id)) else {
            continue;
        };
        if site.category != crate::taxonomy::RUIN_CATEGORY {
            continue;
        }
        let Some(clear) = site.clear else {
            continue;
        };
        let coord = Coord { alt: site.alt, x: site.col, y: site.row };
        if crate::entity_ids::namespace(clear.home_id) != home
            || crate::expeditions::region_day(coord, spacing) != key.epoch {
            continue;
        }
        let chest = state.structures.site_chests.read((key.game_id, entity_id)).expect('missing legacy ruin chest');
        assert!(chest.reservation_day == key.epoch, "legacy ruin day mismatch");
        mask = mask | depth_bit(depth_at(key.game_id, coord));
    }
    assert!(mask != 0, "missing legacy ruin clear");
    mask
}

pub fn close_ruins(key: ExpeditionDiscoveryKey, depth: u8) {
    let previous = discovery(key).unwrap_or(ExpeditionDiscovery { empty_reveals: 0, ruin_cleared: false });
    if per_depth_ruins(key.game_id) {
        let mask = cleared_depths(key);
        let bit = depth_bit(depth);
        assert!(mask & bit == 0, "realm already cleared this depth today");
        crate::state::write().map_rules.cleared_ruin_depths.write(ruin_key(key), mask | bit);
    } else {
        assert!(!previous.ruin_cleared, "realm already cleared a ruin today");
    }
    write_discovery(key, ExpeditionDiscovery { ruin_cleared: true, ..previous });
}

pub fn cache_ruin_depths(key: ExpeditionDiscoveryKey) {
    let state = crate::state::write();
    let storage_key = ruin_key(key);
    if per_depth_ruins(key.game_id)
        && state.map_rules.cleared_ruin_depths.read(storage_key) == 0
        && state.map_rules.ruin_cleared.read(storage_key) {
        state.map_rules.cleared_ruin_depths.write(storage_key, legacy_cleared_depths(key));
    }
}

pub fn record_discovery(key: ExpeditionDiscoveryKey, result: crate::discovery::Discovery) {
    let previous = discovery(key).unwrap_or(ExpeditionDiscovery { empty_reveals: 0, ruin_cleared: false });
    cache_ruin_depths(key);
    let next = ExpeditionDiscovery {
        empty_reveals: if result == crate::discovery::Discovery::None {
            previous.empty_reveals + 1
        } else {
            0
        },
        ruin_cleared: previous.ruin_cleared,
    };
    write_discovery(key, next);
}

fn write_discovery(key: ExpeditionDiscoveryKey, next: ExpeditionDiscovery) {
    let storage_key = (key.game_id, key.structure_id, key.epoch);
    let state = crate::state::write();
    state.map_rules.empty_reveals.write(storage_key, Some(next.empty_reveals));
    state.map_rules.ruin_cleared.write(ruin_key(key), next.ruin_cleared);
    let mut keys = array![];
    key.serialize(ref keys);
    let mut values = array![];
    next.serialize(ref values);
    crate::logic::map::MapState::emit(
        crate::logic::map::MapState::Event::RowSet(
            crate::events::RowSet {
                version: 1, model: 'ExpeditionDiscovery', keys: keys.span(), values: values.span(),
            },
        ),
    );
}
