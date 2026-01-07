use core::num::traits::zero::Zero;
use dojo::model::{Model, ModelStorage};
use dojo::storage::dojo_store::DojoStore;
use dojo::world::WorldStorage;
use crate::alias::ID;
use crate::constants::{WORLD_CONFIG_ID, UNIVERSAL_DEPLOYER_ADDRESS};
use crate::models::position::{Coord, CoordImpl, Direction};
use crate::utils::random::VRFImpl;
use starknet::ContractAddress;
use crate::utils::interfaces::collectibles::{ICollectibleDispatcher, ICollectibleDispatcherTrait};
use crate::utils::math::{PercentageImpl};

//
// GLOBAL CONFIGS
//

#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
#[dojo::model]
pub struct WorldConfig {
    #[key]
    pub config_id: ID,
    pub admin_address: ContractAddress,
    pub vrf_provider_address: ContractAddress,
    pub map_center_offset: u32,
    pub season_addresses_config: SeasonAddressesConfig,
    pub hyperstructure_config: HyperstructureConfig,
    pub hyperstructure_cost_config: HyperstructureCostConfig,
    pub speed_config: SpeedConfig,
    pub map_config: MapConfig,
    pub settlement_config: SettlementConfig,
    pub blitz_mode_on: bool,
    pub blitz_settlement_config: BlitzSettlementConfig,
    pub blitz_hypers_settlement_config: BlitzHypersSettlementConfig,
    pub blitz_registration_config: BlitzRegistrationConfig,
    pub tick_config: TickConfig,
    pub bank_config: BankConfig,
    pub resource_bridge_config: ResourceBridgeConfig,
    pub res_bridge_fee_split_config: ResourceBridgeFeeSplitConfig,
    pub structure_max_level_config: StructureMaxLevelConfig,
    pub building_config: BuildingConfig,
    pub troop_damage_config: TroopDamageConfig,
    pub troop_stamina_config: TroopStaminaConfig,
    pub troop_limit_config: TroopLimitConfig,
    pub capacity_config: CapacityConfig,
    pub trade_config: TradeConfig,
    pub battle_config: BattleConfig,
    pub realm_count_config: RealmCountConfig,
    pub season_config: SeasonConfig,
    pub agent_controller_config: AgentControllerConfig,
    pub realm_start_resources_config: StartingResourcesConfig,
    pub village_start_resources_config: StartingResourcesConfig,
    pub village_find_resources_config: VillageFoundResourcesConfig,
    pub village_controller_config: VillageControllerConfig,
    pub village_pass_config: VillageTokenConfig,
    pub quest_config: QuestConfig,
    pub structure_capacity_config: StructureCapacityConfig,
    pub victory_points_grant_config: VictoryPointsGrantConfig,
    pub victory_points_win_config: VictoryPointsWinConfig,
}

#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct WonderProductionBonusConfig {
    pub within_tile_distance: u8,
    pub bonus_percent_num: u128,
}

#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct AgentControllerConfig {
    pub address: ContractAddress,
}
#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct VillageTokenConfig {
    pub token_address: ContractAddress,
    pub mint_recipient_address: ContractAddress,
}

#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct VillageControllerConfig {
    pub addresses: Span<ContractAddress>,
}

#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct SeasonConfig {
    pub dev_mode_on: bool,
    pub start_settling_at: u64,
    pub start_main_at: u64,
    pub end_at: u64,
    pub end_grace_seconds: u32,
    pub registration_grace_seconds: u32,
}

#[generate_trait]
pub impl SeasonConfigImpl of SeasonConfigTrait {
    fn get(world: WorldStorage) -> SeasonConfig {
        WorldConfigUtilImpl::get_member(world, selector!("season_config"))
    }

    fn has_ended(self: SeasonConfig) -> bool {
        if self.dev_mode_on {
            return false;
        }
        let now = starknet::get_block_timestamp();
        if self.end_at == 0 {
            return false;
        }
        now >= self.end_at
    }

    fn has_settling_started(self: SeasonConfig) -> bool {
        if self.dev_mode_on {
            return true;
        }
        let now = starknet::get_block_timestamp();
        now >= self.start_settling_at
    }

    fn has_main_started(self: SeasonConfig) -> bool {
        if self.dev_mode_on {
            return true;
        }
        let now = starknet::get_block_timestamp();
        now >= self.start_main_at
    }


    fn assert_started_settling(self: SeasonConfig) {
        let now = starknet::get_block_timestamp();
        assert!(
            self.has_settling_started(),
            "You will be able to settle your realm or village in {} hours {} minutes, {} seconds",
            (self.start_settling_at - now) / 60 / 60,
            ((self.start_settling_at - now) / 60) % 60,
            (self.start_settling_at - now) % 60,
        );
    }


    fn assert_started_main(self: SeasonConfig) {
        let now = starknet::get_block_timestamp();
        assert!(
            self.has_main_started() && self.has_settling_started(),
            "The game starts in {} hours {} minutes, {} seconds",
            (self.start_main_at - now) / 60 / 60,
            ((self.start_main_at - now) / 60) % 60,
            (self.start_main_at - now) % 60,
        );
    }
    fn assert_settling_started_and_not_over(self: SeasonConfig) {
        self.assert_started_settling();
        assert!(!self.has_ended(), "Season is over");
    }

    fn assert_started_and_not_over(self: SeasonConfig) {
        self.assert_started_main();
        assert!(!self.has_ended(), "Season is over");
    }

    fn assert_settling_started_and_grace_period_not_elapsed(self: SeasonConfig) {
        self.assert_started_settling();
        if self.has_ended() {
            let now = starknet::get_block_timestamp();
            assert!(now <= self.end_at + self.end_grace_seconds.into(), "The Game is Over");
        }
    }
    fn assert_main_game_started_and_grace_period_not_elapsed(self: SeasonConfig) {
        self.assert_started_main();
        if self.has_ended() {
            let now = starknet::get_block_timestamp();
            assert!(now <= self.end_at + self.end_grace_seconds.into(), "The Game is Over");
        }
    }
    fn assert_main_game_started_and_point_registration_grace_not_elapsed(self: SeasonConfig) {
        self.assert_started_main();
        if self.has_ended() {
            let now = starknet::get_block_timestamp();
            assert!(
                now <= self.end_at + self.registration_grace_seconds.into(), "The registration grace period is over",
            );
        }
    }

    fn assert_game_ended_and_points_registration_closed(self: SeasonConfig) {
        self.assert_started_main();
        assert!(self.has_ended(), "Season is not over");

        let now = starknet::get_block_timestamp();
        assert!(now > self.end_at + self.registration_grace_seconds.into(), "The registration grace period is not over");
    }

    fn end_season(ref world: WorldStorage) {
        let season_config_selector = selector!("season_config");
        let mut season_config: SeasonConfig = WorldConfigUtilImpl::get_member(world, season_config_selector);
        // ensure season is not over
        assert!(season_config.has_ended() == false, "Season is over");
        // set season as over
        season_config.end_at = starknet::get_block_timestamp();
        WorldConfigUtilImpl::set_member(ref world, season_config_selector, season_config);
    }
}

#[generate_trait]
pub impl WorldConfigUtilImpl of WorldConfigTrait {
    fn get_member<T, impl TSerde: Serde<T>, impl TDojoStore: DojoStore<T>>(
        world: WorldStorage, selector: felt252,
    ) -> T {
        world.read_member(Model::<WorldConfig>::ptr_from_keys(WORLD_CONFIG_ID), selector)
    }
    fn set_member<T, impl TSerde: Serde<T>, impl TDrop: Drop<T>, impl TDojoStore: DojoStore<T>>(
        ref world: WorldStorage, selector: felt252, value: T,
    ) {
        world.write_member(Model::<WorldConfig>::ptr_from_keys(WORLD_CONFIG_ID), selector, value)
    }
}


#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct TradeConfig {
    pub max_count: u8,
}


#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct SeasonAddressesConfig {
    pub season_pass_address: ContractAddress,
    pub realms_address: ContractAddress,
    pub lords_address: ContractAddress,
}


#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct HyperstrtConstructConfig {
    #[key]
    pub resource_type: u8,
    pub resource_contribution_points: u64,
    pub min_amount: u32,
    pub max_amount: u32,
}

#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct HyperstructureConfig {
    pub initialize_shards_amount: u128,
}

#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct HyperstructureCostConfig {
    pub construction_resources_ids: Span<u8>,
}

#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct CapacityConfig {
    pub structure_capacity: u128, // grams // deprecated
    pub troop_capacity: u32, // grams
    pub donkey_capacity: u32, // grams
    pub storehouse_boost_capacity: u32,
}

#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct StructureCapacityConfig {
    pub realm_capacity: u64, // grams
    pub village_capacity: u64, // grams
    pub hyperstructure_capacity: u64, // grams
    pub fragment_mine_capacity: u64, // grams
    pub bank_structure_capacity: u64,
}

// speed
#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct SpeedConfig {
    pub donkey_sec_per_km: u16,
}

#[generate_trait]
pub impl SpeedImpl of SpeedTrait {
    fn for_donkey(ref world: WorldStorage) -> u16 {
        let speed_config: SpeedConfig = WorldConfigUtilImpl::get_member(world, selector!("speed_config"));
        speed_config.donkey_sec_per_km
    }
}

#[derive(IntrospectPacked, Copy, Drop, Serde, DojoStore)]
pub struct MapConfig {
    pub reward_resource_amount: u16,
    pub shards_mines_win_probability: u16,
    pub shards_mines_fail_probability: u16,
    pub agent_discovery_prob: u16,
    pub agent_discovery_fail_prob: u16,
    pub village_win_probability: u16,
    pub village_fail_probability: u16,
    pub hyps_win_prob: u32,
    pub hyps_fail_prob: u32,
    // fail probability increase per hex distance from center
    pub hyps_fail_prob_increase_p_hex: u16,
    // fail probability increase per hyperstructure found
    pub hyps_fail_prob_increase_p_fnd: u16,
    // Relic discovery
    pub relic_discovery_interval_sec: u16,
    pub relic_hex_dist_from_center: u8,
    pub relic_chest_relics_per_chest: u8,
}

#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct QuestConfig {
    pub quest_discovery_prob: u16,
    pub quest_discovery_fail_prob: u16,
}

#[derive(IntrospectPacked, Copy, Drop, Serde, DojoStore)]
pub struct SettlementConfig {
    pub center: u32,
    pub base_distance: u8,
    pub layers_skipped: u8,
    pub layer_max: u8,
    pub layer_capacity_increment: u8,
    pub layer_capacity_bps: u16,

    pub spires_layer_distance: u8,
    pub spires_max_count: u16,
    pub spires_settled_count: u16,

}

#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct RealmCountConfig {
    pub count: u16,
}


#[generate_trait]
pub impl SettlementConfigImpl of SettlementConfigTrait {

    fn _num_hex_directions() -> u32 {
        6
    }

    // Calculate sum of x*y + x*(y-1) + x*(y-2) + ... + x*0
    // Formula: x * (y + 1) * y / 2
    // Used to calculate total capacity up to a certain layer
    fn _calculate_sum(x: u32, y: u32) -> u32 {
        (x * (y + 1) * y) / 2
    }



    fn _max_spots(layer_number: u32, layers_skipped: u32) -> u32 {
        // this gets the max number of points that can fit 
        // in from layer 1 to layer y where each layer
        // has capacity of _num_hex_directions() * layer_number

        // we also need to account for layers skipped

        assert!(layer_number >= layers_skipped, "Layer number must be greater than or equal to layers skipped");
        if layer_number == layers_skipped {return 0;}
        let a = Self::_calculate_sum( Self::_num_hex_directions(), layer_number);
        let b = Self::_calculate_sum( Self::_num_hex_directions(), layers_skipped);
        a - b
    }

    fn _spire_layer_number(layer_number: u32, spires_layer_distance: u8) -> u32 {
        layer_number / spires_layer_distance.into()
    }
    
    fn _spire_center_point_count() -> u32 {
        1
    }

    fn _max_spire_spots(layer_number: u32, spires_layer_distance: u8) -> u16 {
        (Self::_spire_center_point_count() 
        + Self::_max_spots(
            Self::_spire_layer_number(layer_number, spires_layer_distance), 
            0
        )).try_into().unwrap()
    }

    fn _max_point_index(layer: u32) -> u32 {
        layer - 1
    }

    // todo: test aggresively
    fn generate_coord(self: SettlementConfig, spire: bool, side: u32, mut layer: u32, point_index: u32, map_center: Coord) -> Coord {
        assert!(side < 6, "Side must be less than 6"); // 0 - 5
        assert!(layer > 0, "Layer must be greater than 0"); // 1 - layer_max

        let mut base_distance: u32 = self.base_distance.into();
        if spire {

             
            let max_spire_layer = Self::_spire_layer_number(self.layer_max.into(), self.spires_layer_distance);
            assert!(layer <= max_spire_layer.into(), "Layer must be less than max layer for spires");

            // scale the map such that layer 1 of spires is 
            // like layer 6 (self.spires_layer_distance) for realms
            // so we scale down the layer number and scale up the base distance.
            // we basically zoom out and rescale the map for spires.
            // we expect the layer to be scaled down already

            base_distance = self.base_distance.into() * self.spires_layer_distance.into(); 

        } else {
            assert!(layer <= self.layer_max.into(), "Layer must be less than max layer");
            assert!(layer > self.layers_skipped.into(), "Layer must be greater than layers skipped");
        }

        assert!(point_index <= Self::_max_point_index(layer), "Point must be less than max side points");


        let mut start_coord: Coord = map_center;

        let start_directions: Array<(Direction, Direction)> = array![
            (Direction::East, Direction::SouthWest),
            (Direction::SouthEast, Direction::West), 
            (Direction::SouthWest, Direction::NorthWest), 
            (Direction::West, Direction::NorthEast), 
            (Direction::NorthWest, Direction::East),
            (Direction::NorthEast, Direction::SouthEast)
        ];
        let (start_direction, triangle_direction) = *start_directions.at(side);

        // get the coord of the first structure on layer 1 of the selected side
        let side_first_structure__layer_one: Coord = start_coord
            .neighbor_after_distance(start_direction, base_distance);

        // get the coord of the first structure on selected layer of the selected side
        let side_first_structure__layer_x = side_first_structure__layer_one
            .neighbor_after_distance(start_direction, base_distance * (layer - 1));

        let destination_coord: Coord = side_first_structure__layer_x
            .neighbor_after_distance(triangle_direction, base_distance * point_index);
        return destination_coord;
    }

    fn update_max_layer_and_spires(ref self: SettlementConfig, realm_count: u64) {

        // max realm spots
        let mut current_max_realm_spots_capacity 
            = Self::_max_spots(self.layer_max.into(), self.layers_skipped.into())
            // add back the center spire spot that will be taken in _max_spire_spots 
            // because it is not counted in realms spots
            + Self::_spire_center_point_count()
            - Self::_max_spire_spots(self.layer_max.into(), self.spires_layer_distance).into();


        let capacity_threshold = PercentageImpl::get(
                current_max_realm_spots_capacity.into(), self.layer_capacity_bps.into(),
            );
        if realm_count > capacity_threshold{
            self.layer_max += self.layer_capacity_increment;
            self.spires_max_count = Self::_max_spire_spots(
                self.layer_max.into(), 
                self.spires_layer_distance
            );
        }
    }
}

#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct BlitzSettlementConfig {
    pub base_distance: u32,
    pub side: u32,
    pub step: u32,
    pub point: u32,
    pub single_realm_mode: bool,
}

#[generate_trait]
pub impl BlitzSettlementConfigImpl of BlitzSettlementConfigTrait {
    fn new(base_distance: u32, single_realm_mode: bool) -> BlitzSettlementConfig {
        BlitzSettlementConfig { base_distance, single_realm_mode, side: 0, step: 1, point: 1 }
    }

    fn next(ref self: BlitzSettlementConfig) {
        if self.side == 5 {
            if self.point == self.max_points() {
                self.step += 1;
                self.point = 1;
            } else {
                self.point += 1;
            }
            self.side = 0;
        } else {
            self.side += 1;
        }
    }

    fn max_points(self: BlitzSettlementConfig) -> u32 {
        self.step * 2
    }

    fn step_tile_distance() -> u32 {
        15
    }

    fn realm_tile_radius() -> u32 {
        3
    }

    fn center_tile_radius() -> u32 {
        2 // must be divisible by 2
    }

    fn mirror_first_step_tile_distance() -> u32 {
        11
    }

    fn mirror_second_step_tile_distance() -> u32 {
        4
    }

    // Html & JS interactive implementation reference: contracts/game/ext/formulas/blitz_hex_map.html

    fn generate_coords(ref self: BlitzSettlementConfig, map_center: Coord) -> Array<Coord> {
        let mut start_coord: Coord = map_center;
        let start_directions: Array<(Direction, Direction)> = array![
            (Direction::NorthEast, Direction::West), (Direction::West, Direction::SouthEast),
            (Direction::SouthEast, Direction::NorthEast), (Direction::NorthWest, Direction::SouthWest),
            (Direction::SouthWest, Direction::East), (Direction::East, Direction::NorthWest),
        ];
        let (start_direction, triangle_direction) = *start_directions.at(self.side);
        assert!(self.base_distance % 2 == 0, "base distance must be exactly divisble by 2 so the map isnt skewed");

        // get the coord of the first structure on step 1 of the selected side
        let side_first_structure__step_one: Coord = start_coord
            .neighbor_after_distance(start_direction, self.base_distance)
            .neighbor_after_distance(triangle_direction, self.base_distance / 2);

        // get the coord of the first structure on selected layer of the selected side
        let side_first_structure__step_x = side_first_structure__step_one
            .neighbor_after_distance(start_direction, Self::step_tile_distance() * (self.step - 1));

        let is_mirrored = self.point > self.max_points() / 2;
        if !is_mirrored {
            let destination_start_coord: Coord = side_first_structure__step_x
                .neighbor_after_distance(triangle_direction, Self::step_tile_distance() * (self.point - 1));

            // coords a, b and c form a triangle
            let a = destination_start_coord;
            let b = destination_start_coord.neighbor_after_distance(start_direction, Self::realm_tile_radius());
            let c = b.neighbor_after_distance(triangle_direction, Self::realm_tile_radius());

            // coord middle is the middle of the triangle
            let middle = a.neighbor_after_distance(start_direction, Self::center_tile_radius())
                .neighbor_after_distance(triangle_direction, Self::center_tile_radius() / 2);

            if self.single_realm_mode {
                return array![middle];
            } else {
                return array![a, b, c];
            }
        } else {
            let start_point = self.max_points() - self.point + 1;
            let destination_start_coord: Coord = side_first_structure__step_x
                .neighbor_after_distance(triangle_direction, Self::step_tile_distance() * (start_point - 1));

            // coords a, b and c form a triangle
            let a = destination_start_coord
                .neighbor_after_distance(start_direction, Self::mirror_first_step_tile_distance())
                .neighbor_after_distance(triangle_direction, Self::mirror_second_step_tile_distance());
            let b = a.neighbor_after_distance(triangle_direction, Self::realm_tile_radius());
            let c = b.neighbor_after_distance(start_direction, Self::realm_tile_radius());

            // coord middle is the middle of the triangle
            let middle = a.neighbor_after_distance(triangle_direction, Self::center_tile_radius())
                .neighbor_after_distance(start_direction, Self::center_tile_radius() / 2);

            if self.single_realm_mode {
                return array![middle];
            } else { 
                return array![a, b, c];
            }
        }
    }
}


#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct BlitzHypersSettlementConfig {
    pub max_ring_count: u8,
    pub current_ring_count: u8,
    pub point: u8,
    pub side: u32,
}

#[generate_trait]
pub impl BlitzHypersSettlementConfigImpl of BlitzHypersSettlementConfigTrait {
    fn new() -> BlitzHypersSettlementConfig {
        BlitzHypersSettlementConfig { max_ring_count: 0, current_ring_count: 0, side: 5, point: 1 }
    }

    fn is_valid_ring(ref self: BlitzHypersSettlementConfig) -> bool {
        if self.current_ring_count > self.max_ring_count {
            return false;
        }
        return true;
    }

    fn next(ref self: BlitzHypersSettlementConfig) {
        if self.point >= self.current_ring_count.into() {
            self.point = 1;
            if self.side == 5 {
                self.side = 0;
                self.current_ring_count += 1;
            } else {
                self.side += 1;
            }
        } else {
            self.point += 1;
        }
    }

    fn ring_tile_distance() -> u32 {
        15
    }

    // Html & JS interactive implementation reference: contracts/game/ext/formulas/blitz_hex_map.html
    fn next_coord(self: BlitzHypersSettlementConfig, map_center: Coord) -> Coord {
        let mut start_coord: Coord = map_center;
        let start_directions: Array<(Direction, Direction)> = array![
            (Direction::East, Direction::NorthWest), (Direction::SouthEast, Direction::NorthEast),
            (Direction::SouthWest, Direction::East), (Direction::West, Direction::SouthEast),
            (Direction::NorthWest, Direction::SouthWest), (Direction::NorthEast, Direction::West),
        ];
        let (start_direction, triangle_direction) = *start_directions.at(self.side);
        return start_coord
            .neighbor_after_distance(start_direction, Self::ring_tile_distance() * self.current_ring_count.into())
            .neighbor_after_distance(triangle_direction, Self::ring_tile_distance() * (self.point.into() - 1));
    }
}


#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct BlitzRegistrationConfig {
    pub fee_amount: u256,
    pub fee_token: ContractAddress,
    pub fee_recipient: ContractAddress,
    pub entry_token_address: ContractAddress,
    pub collectibles_cosmetics_max: u8,
    pub collectibles_cosmetics_address: ContractAddress,
    pub collectibles_timelock_address: ContractAddress,
    pub collectibles_lootchest_address: ContractAddress,
    pub collectibles_elitenft_address: ContractAddress,
    pub registration_count: u16,
    pub registration_count_max: u16,
    pub registration_start_at: u32,
    pub assigned_positions_count: u16,
}

#[generate_trait]
pub impl BlitzRegistrationConfigImpl of BlitzRegistrationConfigTrait {
    fn is_registration_full(self: BlitzRegistrationConfig) -> bool {
        self.registration_count >= self.registration_count_max
    }

    fn increase_registration_count(ref self: BlitzRegistrationConfig) {
        self.registration_count += 1;
    }

    fn is_registration_open(self: BlitzRegistrationConfig, now: u32) -> bool {
        now >= self.registration_start_at
    }

    fn deploy_entry_token(self: BlitzRegistrationConfig, entry_token_class_hash: felt252, calldata: Span<felt252>) -> ContractAddress {
        let deployment_salt: felt252 =  starknet::get_tx_info().unbox().transaction_hash;
        let deployment_unique: felt252 =  1; // true
        let mut deployment_calldata: Array<felt252> = array![
                entry_token_class_hash,
                deployment_salt,
                deployment_unique,
                calldata.len().into(),
        ];
        for i in 0..calldata.len() {
            deployment_calldata.append(*calldata.at(i));
        }
        let deploy_result_span = starknet::syscalls::call_contract_syscall(
            UNIVERSAL_DEPLOYER_ADDRESS.try_into().unwrap(), 
            0x1987cbd17808b9a23693d4de7e246a443cfe37e6e7fbaeabd7d7e6532b07c3d, // selector!("deployContract")
            deployment_calldata.span()
        ).unwrap();

        // @audit could this fail and not panic?
        (*deploy_result_span.at(0)).try_into().unwrap()
    }


    fn setup_entry_token(self: BlitzRegistrationConfig, ipfs_cid: ByteArray) {
        let dispatcher = ICollectibleDispatcher {contract_address: self.entry_token_address};
        dispatcher.set_attrs_raw_to_ipfs_cid(
            self.entry_token_attrs_raw(),
            ipfs_cid,
            false
        );
    }

    fn entry_token_lock_id(self: BlitzRegistrationConfig) -> felt252 {
        69
    }

    fn entry_token_attrs_raw(self: BlitzRegistrationConfig) -> u128 {
        1
    }

    fn collectibles_lootchest_attrs_raw(self: BlitzRegistrationConfig) -> u128 {
        0x101 // @todo @note to be changed 
    }

    fn collectibles_elitenft_attrs_raw(self: BlitzRegistrationConfig) -> u128 {
        0x101 // @todo @note to be changed 
    }

    fn update_entry_token_lock(self: BlitzRegistrationConfig, unlock_at: u64) {
        let dispatcher = ICollectibleDispatcher {contract_address: self.entry_token_address};
        dispatcher.lock_state_update(
            self.entry_token_lock_id(),
            unlock_at
        );
    }
}

#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct VictoryPointsGrantConfig {
    pub hyp_points_per_second: u32,
    // Only granted when claim hyperstructure from bandits
    pub claim_hyperstructure_points: u32,
    // Only granted when claim non hyperstructure from bandits
    pub claim_otherstructure_points: u32,
    pub explore_tiles_points: u32,
    pub relic_open_points: u32,
}

#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct VictoryPointsWinConfig {
    pub points_for_win: u128,
}

#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct TickConfig {
    pub armies_tick_in_seconds: u64,
    pub delivery_tick_in_seconds: u64,
}


// todo: regroup meaningfully to avoid retrieving too many fields
#[derive(Copy, Drop, Serde, Introspect, Debug, PartialEq, Default, DojoStore)]
pub struct TroopDamageConfig {
    pub damage_raid_percent_num: u16,
    // Combat modifiers. Used for biome damage calculations
    pub damage_biome_bonus_num: u16,
    // Used in damage calculations for troop scaling
    pub damage_beta_small: u64, // Fixed
    pub damage_beta_large: u64, // Fixed
    pub damage_scaling_factor: u128,
    pub damage_c0: u128, // Fixed
    pub damage_delta: u128, // Fixed
    pub t1_damage_value: u128,
    pub t2_damage_multiplier: u128, // Fixed
    pub t3_damage_multiplier: u128,
}

#[derive(Copy, Drop, Serde, Introspect, Debug, PartialEq, Default, DojoStore)]
pub struct TroopStaminaConfig {
    // Base stamina settings
    pub stamina_gain_per_tick: u16, // Stamina gained per tick
    pub stamina_initial: u16, // Initial stamina for explorers
    pub stamina_bonus_value: u16, // Used for stamina movement bonuses
    // Max stamina per troop type
    pub stamina_knight_max: u16, // Maximum stamina for knights
    pub stamina_paladin_max: u16, // Maximum stamina for paladins
    pub stamina_crossbowman_max: u16, // Maximum stamina for crossbowmen
    // Combat stamina requirements
    pub stamina_attack_req: u16, // Minimum stamina required to attack
    pub stamina_defense_req: u16, // Minimum stamina required for effecttive defense
    // Exploration and travel stamina costs
    pub stamina_explore_stamina_cost: u16,
    pub stamina_travel_stamina_cost: u16,
    // Exploration food costs
    pub stamina_explore_wheat_cost: u32,
    pub stamina_explore_fish_cost: u32,
    // Travel food costs
    pub stamina_travel_wheat_cost: u32,
    pub stamina_travel_fish_cost: u32,
}


#[derive(Copy, Drop, Serde, Introspect, Debug, PartialEq, Default, DojoStore)]
pub struct TroopLimitConfig {
    // Maximum number of explorers allowed per structure
    pub explorer_max_party_count: u8,
    // Troop count per army limits without precision
    // Applies to both explorers and guards
    pub explorer_guard_max_troop_count: u32,
    // Guard specific settings
    pub guard_resurrection_delay: u32,
    // Mercenary bounds without precision
    pub mercenaries_troop_lower_bound: u32,
    // without precision
    pub mercenaries_troop_upper_bound: u32,
    // Agents bounds without precision
    pub agents_troop_lower_bound: u32,
    // without precision
    pub agents_troop_upper_bound: u32,
}


#[generate_trait]
pub impl CombatConfigImpl of CombatConfigTrait {
    fn troop_damage_config(ref world: WorldStorage) -> TroopDamageConfig {
        return WorldConfigUtilImpl::get_member(world, selector!("troop_damage_config"));
    }

    fn troop_stamina_config(ref world: WorldStorage) -> TroopStaminaConfig {
        return WorldConfigUtilImpl::get_member(world, selector!("troop_stamina_config"));
    }

    fn troop_limit_config(ref world: WorldStorage) -> TroopLimitConfig {
        return WorldConfigUtilImpl::get_member(world, selector!("troop_limit_config"));
    }
}


#[derive(Copy, Drop, Serde, DojoStore)]
pub struct TickInterval {
    pub tick_interval: u64,
}

#[generate_trait]
pub impl TickImpl of TickTrait {
    fn _tick_config(ref world: WorldStorage) -> TickConfig {
        WorldConfigUtilImpl::get_member(world, selector!("tick_config"))
    }

    // get world tick config
    fn get_tick_interval(ref world: WorldStorage) -> TickInterval {
        let tick_config: TickConfig = Self::_tick_config(ref world);
        return TickInterval { tick_interval: tick_config.armies_tick_in_seconds };
    }

    fn get_delivery_tick_interval(ref world: WorldStorage) -> TickInterval {
        let tick_config: TickConfig = Self::_tick_config(ref world);
        return TickInterval { tick_interval: tick_config.delivery_tick_in_seconds };
    }

    fn interval(self: TickInterval) -> u64 {
        self.tick_interval
    }

    fn current(self: TickInterval) -> u64 {
        let now = starknet::get_block_timestamp();
        now / self.interval()
    }

    fn at(self: TickInterval, time: u64) -> u64 {
        time / self.interval()
    }

    fn after(self: TickInterval, time_spent: u64) -> u64 {
        (starknet::get_block_timestamp() + time_spent) / self.interval()
    }

    fn next_tick_timestamp(self: TickInterval) -> u64 {
        self.current() + self.interval()
    }

    fn convert_from_seconds(self: TickInterval, seconds: u64) -> u64 {
        let mut ticks = seconds / self.interval();
        let rem = seconds % self.interval();
        if rem.is_non_zero() {
            ticks += 1;
        }
        ticks
    }

    fn convert_to_estimated_timestamp(self: TickInterval, tick: u64) -> u64 {
        tick * self.interval()
    }
}

// weight
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct WeightConfig {
    #[key]
    pub resource_type: u8,
    pub weight_gram: u128,
}


#[derive(IntrospectPacked, Copy, Drop, Serde, Default)]
#[dojo::model]
pub struct ResourceFactoryConfig {
    #[key]
    pub resource_type: u8,
    // production machine output per second
    pub realm_output_per_second: u64,
    pub village_output_per_second: u64,
    pub labor_output_per_resource: u64,
    pub output_per_simple_input: u64, // loinput = labor only input
    pub output_per_complex_input: u64, // nlinput = non labor input
    pub simple_input_list_id: ID,
    pub complex_input_list_id: ID,
    pub simple_input_list_count: u8,
    pub complex_input_list_count: u8,
}


#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct BuildingCategoryConfig {
    #[key]
    pub category: u8,
    pub complex_erection_cost_id: ID,
    pub complex_erection_cost_count: u8,
    pub simple_erection_cost_id: ID,
    pub simple_erection_cost_count: u8,
    pub population_cost: u8,
    pub capacity_grant: u8,
}


#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct BuildingConfig {
    pub base_population: u32,
    pub base_cost_percent_increase: u16,
}


#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct BankConfig {
    pub lp_fee_num: u32,
    pub lp_fee_denom: u32,
    pub owner_fee_num: u32,
    pub owner_fee_denom: u32,
}

#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct BattleConfig {
    pub regular_immunity_ticks: u8,
    pub hyperstructure_immunity_ticks: u8,
}

#[generate_trait]
pub impl BattleConfigImpl of BattleConfigTrait {
    fn get(ref world: WorldStorage) -> BattleConfig {
        WorldConfigUtilImpl::get_member(world, selector!("battle_config"))
    }
}


#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct StartingResourcesConfig {
    pub resources_list_id: ID,
    pub resources_list_count: u8,
}

#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct VillageFoundResourcesConfig {
    pub resources_mm_list_id: ID,
    pub resources_mm_list_count: u8,
}

#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct ResourceBridgeConfig {
    pub deposit_paused: bool,
    pub withdraw_paused: bool,
}

#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct ResourceBridgeFeeSplitConfig {
    // the percentage of the deposit and withdrawal amount that the velords addr will receive
    pub velords_fee_on_dpt_percent: u16,
    pub velords_fee_on_wtdr_percent: u16,
    // the percentage of the deposit and withdrawal amount that the season pool will receive
    pub season_pool_fee_on_dpt_percent: u16,
    pub season_pool_fee_on_wtdr_percent: u16,
    // the percentage of the deposit and withdrawal amount that the frontend provider will receive
    pub client_fee_on_dpt_percent: u16,
    pub client_fee_on_wtdr_percent: u16,
    // max bank fee amount
    pub realm_fee_dpt_percent: u16,
    pub realm_fee_wtdr_percent: u16,
    // the address that will receive the velords fee percentage
    pub velords_fee_recipient: ContractAddress,
    // the address that will receive the season pool fee
    pub season_pool_fee_recipient: ContractAddress,
}


#[dojo::model]
#[derive(Copy, Drop, Serde)]
pub struct ResourceBridgeWtlConfig {
    #[key]
    pub token: ContractAddress,
    pub resource_type: u8,
}

#[dojo::model]
#[derive(Introspect, Copy, Drop, Serde)]
pub struct ResourceRevBridgeWtlConfig {
    #[key]
    pub resource_type: u8,
    pub token: ContractAddress,
}

// speed
#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct StructureMaxLevelConfig {
    pub realm_max: u8,
    pub village_max: u8,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct StructureLevelConfig {
    #[key]
    pub level: u8,
    pub required_resources_id: ID,
    pub required_resource_count: u8,
}


#[derive(Copy, Drop, Serde, Introspect)]
#[dojo::model]
pub struct BlitzRealmPositionRegister {
    #[key]
    pub spot_number: u16,
    pub coords: Span<Coord>,
}

#[derive(Copy, Drop, Serde, Introspect)]
#[dojo::model]
pub struct BlitzRealmSettleFinish {
    #[key]
    pub player: ContractAddress,
    pub coords: Span<Coord>,
    pub structure_ids: Span<ID>,
    pub labor_prod_started: bool,
}

#[derive(Copy, Drop, Serde, Introspect)]
#[dojo::model]
pub struct BlitzRealmPlayerRegister {
    #[key]
    pub player: ContractAddress,
    pub once_registered: bool,
    pub registered: bool,
}

#[derive(Copy, Drop, Serde, Introspect)]
#[dojo::model]
pub struct BlitzEntryTokenRegister {
    #[key]
    pub token_id: u128,
    pub registered: bool,
}

#[derive(Copy, Drop, Serde, Introspect)]
#[dojo::model]
pub struct BlitzCosmeticAttrsRegister {
    #[key]
    pub player: ContractAddress,
    pub attrs: Span<u128>,
}

#[derive(Copy, Drop, Serde, Introspect)]
#[dojo::model]
pub struct BlitzPreviousGame {
    #[key]
    pub config_id: ID,
    pub last_prize_distribution_systems: ContractAddress,
}
