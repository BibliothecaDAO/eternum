#[derive(Copy, Drop, Serde)]
pub struct SpireSettlement {
    pub side: u32,
    pub layer: u32,
    pub point: u32,
}

#[starknet::interface]
pub trait ISpireSystems<T> {
    fn create_spires(ref self: T, settlements: Span<SpireSettlement>);
}

#[dojo::contract]
pub mod spire_systems {
    use dojo::model::ModelStorage;
    use dojo::world::{IWorldDispatcherTrait, WorldStorage};
    use crate::alias::ID;
    use crate::constants::DEFAULT_NS;
    use crate::models::config::{SettlementConfig, SettlementConfigImpl, WorldConfigUtilImpl};
    use crate::models::map::{Tile, TileImpl, TileOccupier};
    use crate::models::map2::TileOpt;
    use crate::models::position::{Coord, CoordImpl};
    use crate::systems::utils::map::IMapImpl;
    use crate::system_libraries::biome_library::{IBiomeLibraryDispatcherTrait, biome_library};
    use crate::utils::map::biomes::Biome;
    use super::SpireSettlement;

    fn explore_if_needed(ref world: WorldStorage, ref tile: Tile) {
        if tile.not_discovered() {
            let biome_library = biome_library::get_dispatcher(@world);
            let biome: Biome = biome_library.get_biome(tile.alt, tile.col.into(), tile.row.into());
            IMapImpl::explore(ref world, ref tile, biome);
        }
    }

    #[abi(embed_v0)]
    impl SpireSystemsImpl of super::ISpireSystems<ContractState> {
        fn create_spires(ref self: ContractState, settlements: Span<SpireSettlement>) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());

            let map_center: Coord = CoordImpl::center(ref world);
            let mut settlement_config: SettlementConfig = WorldConfigUtilImpl::get_member(
                world, selector!("settlement_config"),
            );
            for settlement in settlements {
                let settlement = *settlement;
                assert!(
                    settlement_config.spires_settled_count < settlement_config.spires_max_count,
                    "Eternum: All spires have been created"
                );

                let coord: Coord = settlement_config
                    .generate_coord(true, settlement.side, settlement.layer, settlement.point, map_center);

                let spire_id: ID = world.dispatcher.uuid();

                let regular_tile_opt: TileOpt = world.read_model((false, coord.x, coord.y));
                let mut regular_tile: Tile = regular_tile_opt.into();
                let alternate_tile_opt: TileOpt = world.read_model((true, coord.x, coord.y));
                let mut alternate_tile: Tile = alternate_tile_opt.into();

                assert!(regular_tile.not_occupied(), "Eternum: Spire regular tile occupied");
                assert!(alternate_tile.not_occupied(), "Eternum: Spire alternate tile occupied");

                explore_if_needed(ref world, ref regular_tile);
                explore_if_needed(ref world, ref alternate_tile);

                IMapImpl::occupy(ref world, ref regular_tile, TileOccupier::Spire, spire_id);
                IMapImpl::occupy(ref world, ref alternate_tile, TileOccupier::Spire, spire_id);

                settlement_config.spires_settled_count += 1;
            }
            WorldConfigUtilImpl::set_member(
                ref world, selector!("settlement_config"), settlement_config,
            );
        }
    }
}
