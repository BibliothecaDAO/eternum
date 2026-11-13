use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess};
use crate::expeditions::{ExpeditionDiscovery, ExpeditionDiscoveryKey};
use crate::logic::expeditions::{depth_at, discovery, ruin_key, write_discovery};
use crate::resources::ResourceKey;
use crate::troops::Coord;

// Library-only entitlement calls, owned by the game's Map class. Games exposes no forwarding method.
#[starknet::interface]
pub trait IRuinEntitlements<T> {
    fn ruin_disappeared(self: @T, key: ResourceKey) -> bool;
    fn ruin_cleared_at(self: @T, key: ExpeditionDiscoveryKey, depth: u8) -> bool;
    fn cache_ruin_depths(ref self: T, key: ExpeditionDiscoveryKey);
    fn close_ruins(ref self: T, key: ExpeditionDiscoveryKey, depth: u8);
}

pub fn disappeared(key: ResourceKey) -> bool {
    let Some((epoch, coord)) = uncleared_ruin(key) else {
        return false;
    };
    cleared_at(
        ExpeditionDiscoveryKey { game_id: key.game_id, structure_id: key.entity_id, epoch },
        depth_at(key.game_id, coord),
    )
}

fn uncleared_ruin(key: crate::resources::ResourceKey) -> Option<(u64, Coord)> {
    let state = crate::state::read();
    let storage_key = (key.game_id, key.entity_id);
    if state.structures.structures.entry(storage_key).base.read().category != crate::taxonomy::RUIN_CATEGORY {
        return None;
    }
    let Some(chest) = state.structures.site_chests.read(storage_key) else {
        return None;
    };
    let Some(site) = state.structures.expedition_sites.read(storage_key) else {
        return None;
    };
    if site.clear.is_some() {
        return None;
    }
    let coord = Coord { alt: site.alt, x: site.col, y: site.row };
    Some((chest.reservation_day, coord))
}

pub fn cleared_at(key: ExpeditionDiscoveryKey, depth: u8) -> bool {
    cleared_depths(key) & depth_bit(depth) != 0
}

pub fn close(key: ExpeditionDiscoveryKey, depth: u8) {
    let previous = discovery(key).unwrap_or(ExpeditionDiscovery { empty_reveals: 0, ruin_cleared: false });
    let mask = cleared_depths(key);
    let bit = depth_bit(depth);
    assert!(mask & bit == 0, "realm already cleared this depth today");
    crate::state::write().map_rules.cleared_ruin_depths.write(ruin_key(key), mask | bit);
    write_discovery(key, ExpeditionDiscovery { ruin_cleared: true, ..previous });
}

pub fn cache(key: ExpeditionDiscoveryKey) {
    let state = crate::state::write();
    let storage_key = ruin_key(key);
    if state.map_rules.cleared_ruin_depths.read(storage_key) == 0 && state.map_rules.ruin_cleared.read(storage_key) {
        state.map_rules.cleared_ruin_depths.write(storage_key, legacy_cleared_depths(key));
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

fn legacy_cleared_depths(key: ExpeditionDiscoveryKey) -> u8 {
    let state = crate::state::read();
    let home = crate::entity_ids::namespace(key.structure_id);
    let allocated = state.games.home_entities.read((key.game_id, home));
    let spacing = crate::logic::preset_record::for_game(key.game_id).settlement_spacing.read();
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
