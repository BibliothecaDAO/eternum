use crate::models::config::{MapConfig, TroopLimitConfig, TroopStaminaConfig};
use crate::models::events::ExploreFind;
use crate::models::map::Tile;

#[starknet::interface]
pub trait IBitcoinMineDiscoverySystems<T> {
    fn find_treasure(
        self: @T,
        vrf_seed: u256,
        tile: Tile,
        caller: starknet::ContractAddress,
        map_config: MapConfig,
        troop_limit_config: TroopLimitConfig,
        troop_stamina_config: TroopStaminaConfig,
        current_tick: u64,
        season_mode_on: bool,
    ) -> (bool, ExploreFind);
}

#[dojo::contract]
pub mod bitcoin_mine_discovery_systems {
    use dojo::world::WorldStorageTrait;
    use crate::constants::DEFAULT_NS;
    use crate::models::config::{
        BitcoinMineConfig, MapConfig, TroopLimitConfig, TroopStaminaConfig, WorldConfigUtilImpl,
    };
    use crate::models::events::ExploreFind;
    use crate::models::map::Tile;
    use crate::models::position::Coord;
    use crate::systems::utils::bitcoin_mine::iBitcoinMineDiscoveryImpl;

    #[abi(embed_v0)]
    impl BitcoinMineDiscoverySystemsImpl of super::IBitcoinMineDiscoverySystems<ContractState> {
        fn find_treasure(
            self: @ContractState,
            vrf_seed: u256,
            tile: Tile,
            caller: starknet::ContractAddress,
            map_config: MapConfig,
            troop_limit_config: TroopLimitConfig,
            troop_stamina_config: TroopStaminaConfig,
            current_tick: u64,
            season_mode_on: bool,
        ) -> (bool, ExploreFind) {
            let mut world = self.world(DEFAULT_NS());

            // Ensure caller is the troop utils movement systems
            let (troop_movement_util_systems, _) = world.dns(@"troop_movement_util_systems").unwrap();
            assert!(
                starknet::get_caller_address() == troop_movement_util_systems,
                "caller must be the troop_movement_util_systems",
            );

            // Check if bitcoin mine system is enabled
            let bitcoin_mine_config: BitcoinMineConfig = WorldConfigUtilImpl::get_member(
                world, selector!("bitcoin_mine_config"),
            );
            if !bitcoin_mine_config.enabled {
                return (false, ExploreFind::None);
            }

            // Bitcoin mines are only discoverable in season mode (not blitz)
            if !season_mode_on {
                return (false, ExploreFind::None);
            }

            // Bitcoin mines can only be in Ethereal (alt) layer
            let coord: Coord = tile.into();
            if !coord.alt {
                return (false, ExploreFind::None);
            }

            // Run lottery
            let won = iBitcoinMineDiscoveryImpl::lottery(map_config, vrf_seed, world);
            if won {
                iBitcoinMineDiscoveryImpl::create(ref world, coord, troop_limit_config, troop_stamina_config, vrf_seed);
                return (true, ExploreFind::BitcoinMine);
            }

            (false, ExploreFind::None)
        }
    }
}
