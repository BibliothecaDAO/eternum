use starknet::ContractAddress;
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
use crate::game::PointActivity;
use crate::map::{BIOME_SCALE, BYTE_RANGE};
use crate::resources::ResourceKey;
use crate::troops::Coord;

pub fn reserve_sites(game_id: u32, players: u32) {
    let context = crate::commands::load_context(game_id, 0, starknet::get_block_timestamp());
    let center = crate::settlement_grid::map_center(context.rules.unbox().map_center_offset);
    let spacing = crate::logic::settlement::spacing();
    for site in 0..crate::settlement_grid::reservation_count(players) {
        let key = crate::geometry::tile_key(
            game_id, crate::settlement_grid::reservation_location(center, spacing, site),
        );
        if !revealed(key) {
            crate::logic::map::MapState::reveal(
                key, crate::logic::map::biome(key, crate::commands::biome_context(context)),
            );
        }
        crate::logic::map::MapState::reserve_hyperstructure(key);
    }
}

fn revealed(key: crate::map::TileKey) -> bool {
    match crate::logic::map::tile(key) {
        Some(tile) => tile.data / BIOME_SCALE % BYTE_RANGE != 0,
        None => false,
    }
}

pub fn claim_id(game_id: u32) -> ResourceKey {
    let state = crate::state::write();
    let count = state.hyperstructures.counts.read(game_id);
    let entity_id: u64 = (crate::entity_ids::MAX_HOME_NAMESPACE - count).into();
    state.hyperstructures.counts.write(game_id, count + 1);
    ResourceKey { game_id, entity_id }
}

pub fn change_hands(key: ResourceKey, holder: ContractAddress, timestamp: u64) {
    let state = crate::state::write();
    if holder != 0.try_into().unwrap() {
        let held: u128 = (timestamp - state.hyperstructures.held_since.read((key.game_id, key.entity_id))).into();
        let points = held * crate::balance::points::HOLD_POINTS_PER_SECOND * multiplier(key);
        if points != 0 {
            crate::logic::blitz::points::award(key.game_id, holder, PointActivity::HyperstructureHolding, points);
        }
    }
    state.hyperstructures.held_since.write((key.game_id, key.entity_id), timestamp);
}

pub fn multiplier(key: ResourceKey) -> u128 {
    let mut realms = 0;
    for point in watch_points(crate::structures::structure_coord(key)) {
        let occupant = crate::map::structure_occupant(crate::geometry::tile_key(key.game_id, *point)).unwrap_or(0);
        if occupant != 0 {
            let neighbour = ResourceKey { game_id: key.game_id, entity_id: occupant };
            if crate::logic::structures::record(neighbour).base.category == crate::taxonomy::REALM_CATEGORY {
                realms += 1;
            }
        }
    }
    realms
}

pub fn watch_points(origin: Coord) -> Span<Coord> {
    let distance = crate::logic::settlement::spacing();
    let mut points = array![];
    for (first, second) in array![(0_u8, 4_u8), (1, 5), (2, 0), (3, 1), (4, 2), (5, 3)] {
        let out = crate::geometry::checked_neighbor_at_distance(origin, first, distance).unwrap();
        points.append(crate::geometry::checked_neighbor_at_distance(out, second, distance / 2).unwrap());
    }
    points.span()
}
