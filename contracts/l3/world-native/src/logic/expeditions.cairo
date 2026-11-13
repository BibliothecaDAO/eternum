use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess};
use crate::expeditions::*;
use crate::logic::ruins::IRuinEntitlementsDispatcherTrait;
use crate::troops::Coord;

pub fn expedition_site(key: crate::resources::ResourceKey) -> Option<ExpeditionSite> {
    crate::state::read().structures.expedition_sites.read((key.game_id, key.entity_id))
}

pub fn create_site(key: crate::resources::ResourceKey, guards: Span<crate::troops::Troops>, seed: u256) {
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
        key,
        ExpeditionSite {
            category,
            initial_guard_count,
            beast_kind: crate::expeditions::beast_kind(category, seed),
            alt: coord.alt,
            col: coord.x,
            row: coord.y,
            clear: None,
        },
    );
}

pub fn clear_rewarded_site(key: crate::resources::ResourceKey, site: ExpeditionSite, result: SiteClear, depth: u8) {
    if site.category != crate::taxonomy::RUIN_CATEGORY || crate::logic::army_relics::enabled(key.game_id) {
        clear_site(key, result);
        return;
    }
    let entitlement = ExpeditionDiscoveryKey {
        game_id: key.game_id,
        structure_id: result.home_id,
        epoch: region_day(
            Coord { alt: site.alt, x: site.col, y: site.row }, crate::logic::settlement::rules(key.game_id).spacing,
        ),
    };
    if per_depth_ruins(key.game_id) {
        // Recover prior clears before this receipt can participate in the scan.
        close_ruins(entitlement, depth);
        clear_site(key, result);
    } else {
        // Legacy visibility must stay open until occupancy and structure removal finish.
        clear_site(key, result);
        close_ruins(entitlement, depth);
    }
}

pub fn clear_site(key: crate::resources::ResourceKey, result: SiteClear) {
    let mut site = expedition_site(key).expect('missing expedition site');
    assert!(site.clear.is_none(), "site already cleared");
    site.clear = Some(result);
    write_site(key, site);
    if site.category == crate::taxonomy::CAMP_CATEGORY {
        crate::state::write()
            .structures
            .supply_posts
            .write((key.game_id, site.alt, site.col, site.row), result.home_id);
    }
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

pub fn ruin_key(key: ExpeditionDiscoveryKey) -> (u32, u64, u64) {
    (key.game_id, crate::entity_ids::namespace(key.structure_id).into(), key.epoch)
}

pub fn ruin_disappeared(key: crate::resources::ResourceKey) -> bool {
    let state = crate::state::read();
    let storage_key = (key.game_id, key.entity_id);
    if state.structures.structures.entry(storage_key).base.read().category != crate::taxonomy::RUIN_CATEGORY {
        return false;
    }
    if per_depth_ruins(key.game_id) {
        return ruin_entitlements(key.game_id).ruin_disappeared(key);
    }
    let Some(chest) = state.structures.site_chests.read(storage_key) else {
        return false;
    };
    state
        .map_rules
        .ruin_cleared
        .read((key.game_id, crate::entity_ids::namespace(key.entity_id).into(), chest.reservation_day))
}

pub fn ruin_cleared_at(key: ExpeditionDiscoveryKey, depth: u8) -> bool {
    if per_depth_ruins(key.game_id) {
        ruin_entitlements(key.game_id).ruin_cleared_at(key, depth)
    } else {
        crate::state::read().map_rules.ruin_cleared.read(ruin_key(key))
    }
}

fn per_depth_ruins(game_id: u32) -> bool {
    crate::state::read().game_releases.read(game_id) >= crate::logic::release::RUIN_DEPTH_LIMIT_RELEASE
}

pub fn close_ruins(key: ExpeditionDiscoveryKey, depth: u8) {
    if per_depth_ruins(key.game_id) {
        ruin_entitlements(key.game_id).close_ruins(key, depth);
        return;
    }
    let previous = discovery(key).unwrap_or(ExpeditionDiscovery { empty_reveals: 0, ruin_cleared: false });
    assert!(!previous.ruin_cleared, "realm already cleared a ruin today");
    write_discovery(key, ExpeditionDiscovery { ruin_cleared: true, ..previous });
}

pub fn cache_ruin_depths(key: ExpeditionDiscoveryKey) {
    if per_depth_ruins(key.game_id) {
        ruin_entitlements(key.game_id).cache_ruin_depths(key);
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

pub fn write_discovery(key: ExpeditionDiscoveryKey, next: ExpeditionDiscovery) {
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

fn ruin_entitlements(game_id: u32) -> crate::logic::ruins::IRuinEntitlementsLibraryDispatcher {
    let state = crate::state::read();
    let release_id = state.game_releases.read(game_id);
    crate::logic::ruins::IRuinEntitlementsLibraryDispatcher {
        class_hash: state.releases.entry(release_id).classes.map.read(),
    }
}
