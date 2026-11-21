use crate::commands::ExecutionContext;
use crate::geometry::tile_key;
use crate::troops::{Coord, ExplorerKey, IBattleResolutionDispatcherTrait};

#[cfg(feature: "blitz")]
pub fn contains(_game_id: u32, _coord: Coord) -> bool {
    false
}

#[cfg(not(feature: "blitz"))]
pub fn contains(game_id: u32, coord: Coord) -> bool {
    crate::logic::game::game_exists(game_id) && crate::deep::contains(coord, crate::logic::settlement::spacing())
}

pub fn assert_step(game_id: u32, origin: Coord, destination: Coord) {
    let spacing = crate::logic::settlement::spacing();
    if contains(game_id, origin) {
        assert!(crate::deep::contains(destination, spacing), "movement leaves Deep");
    } else {
        crate::expeditions::assert_same_region(origin, destination, spacing);
    }
}

pub fn arrival(game_id: u32, aspect: u8, context: ExecutionContext) -> Coord {
    let spacing = crate::logic::settlement::spacing();
    let origin = crate::deep::gate(crate::logic::deep_sites::rules().gate_distance, aspect, spacing);
    clear_expired_occupant(game_id, origin, context);
    if crate::logic::map::occupancy(tile_key(game_id, origin)).is_none() {
        return origin;
    }
    for radius in 1..crate::rules::DEEP_MAP_SIZE * 2 {
        for direction in 0_u8..6 {
            for step in 0..radius {
                let Some(point) = crate::geometry::checked_neighbor_at_distance(origin, direction, radius)
                    .and_then(
                        |corner| crate::geometry::checked_neighbor_at_distance(corner, (direction + 2) % 6, step),
                    ) else {
                    continue;
                };
                if !crate::deep::contains(point, spacing) {
                    continue;
                }
                clear_expired_occupant(game_id, point, context);
                if crate::logic::map::occupancy(tile_key(game_id, point)).is_none() {
                    return point;
                }
            }
        }
    }
    panic!("Deep is full")
}

pub fn clear_expired_occupant(game_id: u32, coord: Coord, context: ExecutionContext) {
    if !contains(game_id, coord) {
        return;
    }
    let Some(occupied) = crate::logic::map::occupancy(tile_key(game_id, coord)) else {
        return;
    };
    let key = ExplorerKey { game_id, explorer_id: occupied.entity_id };
    let Some(explorer) = crate::logic::troops::explorer(key) else {
        return;
    };
    let today = crate::days::day_of(
        context.game.unbox(), crate::balance::rules::SWITCHES.day_unit_seconds, context.timestamp,
    )
        .index;
    if crate::logic::army_days::require(key) != today {
        crate::logic::combat::combat_troops(game_id)
            .expire_explorer(key, explorer, crate::commands::action_context(context));
    } else {
        let _ = crate::logic::troops::command_explorer(key, None, context.timestamp, context);
    }
}
