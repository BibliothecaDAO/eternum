use crate::models::position::Coord;

#[starknet::interface]
pub trait IBlitzHyperstructureCreateSystems<T> {
    fn reserve_hyperstructures(ref self: T, count: u8);
    fn create_hyperstructure(ref self: T, coord: Coord);
}

#[dojo::contract]
pub mod hyperstructure_create_systems {
    use core::poseidon::poseidon_hash_span;
    use dojo::model::ModelStorage;
    use dojo::world::WorldStorage;
    use crate::constants::DEFAULT_NS;
    use crate::models::config::{
        BlitzExplorationConfig, BlitzHypersSettlementConfig, BlitzHypersSettlementConfigImpl, BlitzRegistrationConfig,
        BlitzSettlementConfig, CombatConfigImpl, MapConfig, SeasonConfigImpl, WorldConfigUtilImpl,
    };
    use crate::models::map::{Tile, TileImpl, TileOccupier};
    use crate::models::map2::TileOpt;
    use crate::models::position::{Coord, CoordImpl};
    use crate::systems::utils::hyperstructure::iHyperstructureDiscoveryImpl;
    use crate::systems::utils::map::IMapImpl;
    use crate::utils::map::biomes::get_biome_from_world;

    ////////////////////////////////////////////////
    // Public Entrypoints
    ////////////////////////////////////////////////

    #[abi(embed_v0)]
    impl BlitzHyperstructureCreateSystemsImpl of super::IBlitzHyperstructureCreateSystems<ContractState> {
        fn reserve_hyperstructures(ref self: ContractState, count: u8) {
            ////////////////////////////////////////////////
            // Validate Blitz Reservation Window
            ////////////////////////////////////////////////

            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let blitz_mode_on: bool = WorldConfigUtilImpl::get_member(world, selector!("blitz_mode_on"));
            assert!(blitz_mode_on == true, "Eternum: Not a blitz game");

            let season_config = SeasonConfigImpl::get(world);
            assert!(!season_config.has_ended(), "Season is over");

            let blitz_registration_config: BlitzRegistrationConfig = WorldConfigUtilImpl::get_member(
                world, selector!("blitz_registration_config"),
            );

            ////////////////////////////////////////////////
            // Load Reservation Cursor
            ////////////////////////////////////////////////

            let blitz_settlement_config: BlitzSettlementConfig = WorldConfigUtilImpl::get_member(
                world, selector!("blitz_settlement_config"),
            );
            let blitz_exploration_config: BlitzExplorationConfig = WorldConfigUtilImpl::get_member(
                world, selector!("blitz_exploration_config"),
            );
            let mut blitz_hyperstructure_settlement_config: BlitzHypersSettlementConfig =
                WorldConfigUtilImpl::get_member(
                world, selector!("blitz_hypers_settlement_config"),
            );
            let map_center: Coord = CoordImpl::center(ref world);

            blitz_hyperstructure_settlement_config
                .max_ring_count =
                    BlitzHypersSettlementConfigImpl::max_ring_count_for_registration_count(
                        blitz_registration_config.registration_count_max.into(),
                        blitz_settlement_config.two_player_mode,
                    );

            ////////////////////////////////////////////////
            // Reserve Placeholder Tiles
            ////////////////////////////////////////////////

            for _ in 0..count {
                if !blitz_hyperstructure_settlement_config.is_valid_ring(blitz_settlement_config.two_player_mode) {
                    break;
                }

                BlitzHyperstructureReservationInternalImpl::reserve_next_coord(
                    ref world,
                    ref blitz_hyperstructure_settlement_config,
                    map_center,
                    blitz_settlement_config.two_player_mode,
                    blitz_exploration_config.reward_profile_id,
                );
            }

            ////////////////////////////////////////////////
            // Persist Reservation Cursor
            ////////////////////////////////////////////////

            WorldConfigUtilImpl::set_member(
                ref world, selector!("blitz_hypers_settlement_config"), blitz_hyperstructure_settlement_config,
            );
        }

        fn create_hyperstructure(ref self: ContractState, coord: Coord) {
            ////////////////////////////////////////////////
            // Validate Blitz Main-Game Window
            ////////////////////////////////////////////////

            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let blitz_mode_on: bool = WorldConfigUtilImpl::get_member(world, selector!("blitz_mode_on"));
            assert!(blitz_mode_on == true, "Eternum: Not a blitz game");

            let season_config = SeasonConfigImpl::get(world);
            assert!(!season_config.has_ended(), "Game over");

            ////////////////////////////////////////////////
            // Materialize Reserved Hyperstructure
            ////////////////////////////////////////////////

            BlitzHyperstructureMaterializationInternalImpl::create_reserved(ref world, coord);
        }
    }

    ////////////////////////////////////////////////
    // Reservation Helpers
    ////////////////////////////////////////////////

    #[generate_trait]
    impl BlitzHyperstructureReservationInternalImpl of BlitzHyperstructureReservationInternalTrait {
        fn reserve_next_coord(
            ref world: WorldStorage,
            ref blitz_hyperstructure_settlement_config: BlitzHypersSettlementConfig,
            map_center: Coord,
            two_player_mode: bool,
            reward_profile_id: u8,
        ) {
            let coord = blitz_hyperstructure_settlement_config
                .next_coord(map_center, two_player_mode, reward_profile_id);
            let tile_opt: TileOpt = world.read_model((coord.alt, coord.x, coord.y));
            let mut tile: Tile = tile_opt.into();

            assert!(tile.not_occupied(), "Eternum: Hyperstructure tile is occupied");

            // Reserved hyperstructures are visible and collision-proof before they become real
            // bandit-owned structures later in the season.
            IMapImpl::explore(
                ref world, ref tile, get_biome_from_world(world, coord.alt, coord.x.into(), coord.y.into()),
            );
            IMapImpl::occupy(ref world, ref tile, TileOccupier::ReservedHyperstructure, 0);

            blitz_hyperstructure_settlement_config.next(two_player_mode);
        }
    }

    ////////////////////////////////////////////////
    // Materialization Helpers
    ////////////////////////////////////////////////

    #[generate_trait]
    impl BlitzHyperstructureMaterializationInternalImpl of BlitzHyperstructureMaterializationInternalTrait {
        fn seed_salt() -> felt252 {
            starknet::get_block_timestamp().into()
        }

        fn derive_seed(coord: Coord) -> u256 {
            let alt: felt252 = if coord.alt {
                1
            } else {
                0
            };
            let coord_seed = ((alt * 0x10000000000000000) + (coord.x.into() * 0x100000000) + coord.y.into());
            poseidon_hash_span(array![coord_seed, Self::seed_salt()].span()).into()
        }

        fn create_reserved(ref world: WorldStorage, coord: Coord) {
            let tile_opt: TileOpt = world.read_model((coord.alt, coord.x, coord.y));
            let mut tile: Tile = tile_opt.into();
            assert!(
                tile.occupier_type == TileOccupier::ReservedHyperstructure.into(),
                "Eternum: Hyperstructure has already been created",
            );

            let map_config: MapConfig = WorldConfigUtilImpl::get_member(world, selector!("map_config"));
            let troop_limit_config = CombatConfigImpl::troop_limit_config(ref world);
            let troop_stamina_config = CombatConfigImpl::troop_stamina_config(ref world);
            let hyperstructure_seed = Self::derive_seed(coord);

            // Remove the placeholder marker before materializing the real hyperstructure on the tile.
            IMapImpl::unoccupy(ref world, ref tile);
            iHyperstructureDiscoveryImpl::create(
                ref world,
                coord,
                starknet::get_caller_address(),
                map_config,
                troop_limit_config,
                troop_stamina_config,
                hyperstructure_seed,
                true,
                true,
            );
        }
    }
}
