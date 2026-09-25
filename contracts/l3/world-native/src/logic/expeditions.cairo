use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
use crate::expeditions::*;
use crate::troops::Coord;

pub fn expedition_site(key: crate::resources::ResourceKey) -> Option<ExpeditionSite> {
    crate::state::read().structures.expedition_sites.read((key.game_id, key.entity_id))
}

pub fn create_site(key: crate::resources::ResourceKey, kind: SiteKind, guards: Span<crate::troops::Troops>) {
    assert!(expedition_site(key).is_none(), "site already initialized");
    let mut initial_guard_count = 0;
    for guard in guards {
        initial_guard_count += *guard.count;
    }
    assert!(initial_guard_count != 0, "empty site guard");
    write_site(key, ExpeditionSite { kind, initial_guard_count, cleared: false });
}

pub fn clear_site(key: crate::resources::ResourceKey) -> ExpeditionSite {
    let mut site = expedition_site(key).expect('missing expedition site');
    assert!(!site.cleared, "site already cleared");
    site.cleared = true;
    write_site(key, site);
    site
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
    let spacing = crate::logic::settlement::rules(game_id).spacing;
    depth_rules(game_id, (coord.y / spacing % 4).try_into().unwrap())
}

pub fn depth_rules(game_id: u32, depth: u8) -> DepthRules {
    crate::logic::preset_record::for_game(game_id).depth_rules.read(depth).expect('missing depth rules')
}

pub fn discovery(key: ExpeditionDiscoveryKey) -> Option<ExpeditionDiscovery> {
    crate::state::read()
        .map_rules
        .empty_reveals
        .read((key.game_id, key.structure_id, key.epoch))
        .map(|empty_reveals| ExpeditionDiscovery { empty_reveals })
}

pub fn record_discovery(key: ExpeditionDiscoveryKey, result: crate::discovery::Discovery) {
    let empty_reveals = if result == crate::discovery::Discovery::None {
        discovery(key).map(|value| value.empty_reveals).unwrap_or(0) + 1
    } else {
        0
    };
    crate::state::write()
        .map_rules
        .empty_reveals
        .write((key.game_id, key.structure_id, key.epoch), Some(empty_reveals));
    let mut keys = array![];
    key.serialize(ref keys);
    crate::logic::map::MapState::emit(
        crate::logic::map::MapState::Event::RowSet(
            crate::events::RowSet {
                version: 1,
                model: 'ExpeditionDiscovery',
                keys: keys.span(),
                values: array![empty_reveals.into()].span(),
            },
        ),
    );
}
