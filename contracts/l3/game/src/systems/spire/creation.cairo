use dojo::model::ModelStorage;
use dojo::world::{IWorldDispatcherTrait, WorldStorage};
use crate::alias::ID;
use crate::models::config::{SettlementConfig, SettlementConfigImpl, WorldConfigUtilImpl};
use crate::models::map::{Tile, TileImpl, TileOccupier};
use crate::models::map2::TileOpt;
use crate::models::position::{Coord, CoordImpl, CoordTrait, DirectionTrait, REGULAR_TO_ALTERNATE_MAP_SCALE};
use crate::system_libraries::biome_library::{IBiomeLibraryDispatcherTrait, biome_library};
use crate::systems::utils::map::IMapImpl;
use crate::utils::map::biomes::Biome;

pub fn create_preset_spires(ref world: WorldStorage, game_id: u32) {
    let mut config: SettlementConfig = WorldConfigUtilImpl::get_member(world, game_id, selector!("settlement_config"));
    assert!(config.spires_max_count > 0, "Eternum: season preset requires a spire");
    assert!(config.spires_settled_count == 0, "Eternum: spires already initialized");
    validate_spire_lattice(config);
    let center = CoordImpl::center(ref world, game_id);
    create_spire_at_coord(ref world, game_id, center);
    config.spires_settled_count = 1;
    let mut layer: u32 = 1;
    while config.spires_settled_count < config.spires_max_count {
        for point in 0..layer {
            for side in 0_u32..6 {
                if config.spires_settled_count == config.spires_max_count {
                    break;
                }
                let coord = config.generate_coord(true, side, layer, point, center);
                create_spire_at_coord(ref world, game_id, coord);
                config.spires_settled_count += 1;
            }
        }
        layer += 1;
    }
    WorldConfigUtilImpl::set_member(ref world, game_id, selector!("settlement_config"), config);
}

fn validate_spire_lattice(config: SettlementConfig) {
    if config.spires_max_count == 1 {
        return;
    }
    assert!(config.base_distance > 0 && config.spires_layer_distance > 0, "Eternum: invalid spire spacing");
    let spacing: u32 = config.base_distance.into() * config.spires_layer_distance.into();
    assert!(
        spacing.into() % REGULAR_TO_ALTERNATE_MAP_SCALE == 0, "Eternum: spire spacing must align with ethereal steps",
    );
    let capacity = SettlementConfigImpl::spire_capacity(config);
    assert!(config.spires_max_count.into() <= capacity, "Eternum: spire count exceeds lattice");
}

fn explore_if_needed(ref world: WorldStorage, game_id: u32, ref tile: Tile) {
    if tile.not_discovered() {
        let biome_library = biome_library::get_dispatcher(@world);
        let biome: Biome = biome_library.get_biome(world, game_id, tile.alt, tile.col.into(), tile.row.into());
        IMapImpl::explore(ref world, ref tile, biome);
    }
}

fn create_spire_at_coord(ref world: WorldStorage, game_id: u32, coord: Coord) {
    let spire_id: ID = world.dispatcher.uuid();

    let regular_tile_opt: TileOpt = world.read_model((game_id, false, coord.x, coord.y));
    let mut regular_tile: Tile = regular_tile_opt.into();
    let alternate_tile_opt: TileOpt = world.read_model((game_id, true, coord.x, coord.y));
    let mut alternate_tile: Tile = alternate_tile_opt.into();

    assert!(regular_tile.not_occupied(), "Eternum: Spire regular tile occupied");
    assert!(alternate_tile.not_occupied(), "Eternum: Spire alternate tile occupied");

    explore_if_needed(ref world, game_id, ref regular_tile);
    explore_if_needed(ref world, game_id, ref alternate_tile);

    IMapImpl::occupy(ref world, ref regular_tile, TileOccupier::Spire, spire_id);
    IMapImpl::occupy(ref world, ref alternate_tile, TileOccupier::Spire, spire_id);
    reveal_spire_access(ref world, game_id, coord);
}

fn reveal_spire_access(ref world: WorldStorage, game_id: u32, coord: Coord) {
    for direction in DirectionTrait::all() {
        // Portal access stays one coordinate away on both layers, unlike ethereal movement.
        let access = coord.spire_neighbor(direction);
        for alt in array![false, true] {
            let tile: TileOpt = world.read_model((game_id, alt, access.x, access.y));
            let mut tile: Tile = tile.into();
            explore_if_needed(ref world, game_id, ref tile);
        }
    }
}
