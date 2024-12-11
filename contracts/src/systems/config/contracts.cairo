use dojo::world::IWorldDispatcher;
use s0_eternum::alias::ID;
use s0_eternum::models::buildings::BuildingCategory;
use s0_eternum::models::combat::{Troops};
use s0_eternum::models::config::{
    TroopConfig, MapConfig, BattleConfig, MercenariesConfig, CapacityConfig, ResourceBridgeConfig,
    ResourceBridgeFeeSplitConfig, ResourceBridgeWhitelistConfig, TravelFoodCostConfig, SeasonAddressesConfig
};
use s0_eternum::models::position::Coord;

#[starknet::interface]
trait IWorldConfig<T> {
    fn set_world_config(
        ref self: T, admin_address: starknet::ContractAddress, realm_l2_contract: starknet::ContractAddress
    );
}


#[starknet::interface]
trait ISeasonConfig<T> {
    fn set_season_config(
        ref self: T,
        season_pass_address: starknet::ContractAddress,
        realms_address: starknet::ContractAddress,
        lords_address: starknet::ContractAddress,
        start_at: u64
    );

    fn set_season_bridge_config(ref self: T, close_after_end_seconds: u64);
}


#[starknet::interface]
trait IVRFConfig<T> {
    fn set_vrf_config(ref self: T, vrf_provider_address: starknet::ContractAddress);
}


#[starknet::interface]
trait IQuestConfig<T> {
    fn set_quest_config(ref self: T, production_material_multiplier: u16);
    fn set_quest_reward_config(ref self: T, quest_id: ID, resources: Span<(u8, u128)>);
}

#[starknet::interface]
trait IRealmLevelConfig<T> {
    fn set_realm_max_level_config(ref self: T, new_max_level: u8);
    fn set_realm_level_config(ref self: T, level: u8, resources: Span<(u8, u128)>);
}

#[starknet::interface]
trait IWeightConfig<T> {
    fn set_weight_config(ref self: T, entity_type: ID, weight_gram: u128);
}

#[starknet::interface]
trait IBattleConfig<T> {
    fn set_battle_config(ref self: T, battle_config: BattleConfig);
}

#[starknet::interface]
trait ICapacityConfig<T> {
    fn set_capacity_config(ref self: T, capacity_config: CapacityConfig);
}

#[starknet::interface]
trait ITickConfig<T> {
    fn set_tick_config(ref self: T, tick_id: u8, tick_interval_in_seconds: u64);
}

#[starknet::interface]
trait IStaminaConfig<T> {
    fn set_stamina_config(ref self: T, unit_type: u8, max_stamina: u16);
}

#[starknet::interface]
trait ITravelFoodCostConfig<T> {
    fn set_travel_food_cost_config(ref self: T, travel_food_cost_config: TravelFoodCostConfig);
}

#[starknet::interface]
trait IStaminaRefillConfig<T> {
    fn set_stamina_refill_config(ref self: T, amount_per_tick: u16, start_boost_tick_count: u8);
}

#[starknet::interface]
trait ITransportConfig<T> {
    fn set_speed_config(ref self: T, entity_type: ID, sec_per_km: u16);
}

#[starknet::interface]
trait IHyperstructureConfig<T> {
    fn set_hyperstructure_config(
        ref self: T,
        resources_for_completion: Span<(u8, u128, u128)>,
        time_between_shares_change: u64,
        points_per_cycle: u128,
        points_for_win: u128,
        points_on_completion: u128
    );
}

#[starknet::interface]
trait ILevelingConfig<T> {
    fn set_leveling_config(
        ref self: T,
        config_id: ID,
        decay_interval: u64,
        max_level: u64,
        decay_scaled: u128,
        cost_percentage_scaled: u128,
        base_multiplier: u128,
        wheat_base_amount: u128,
        fish_base_amount: u128,
        resource_1_costs: Span<(u8, u128)>,
        resource_2_costs: Span<(u8, u128)>,
        resource_3_costs: Span<(u8, u128)>,
    );
}

#[starknet::interface]
trait IBankConfig<T> {
    fn set_bank_config(ref self: T, lords_cost: u128, lp_fee_num: u128, lp_fee_denom: u128);
}


#[starknet::interface]
trait IMapConfig<T> {
    fn set_map_config(ref self: T, map_config: MapConfig);
}


#[starknet::interface]
trait IProductionConfig<T> {
    fn set_production_config(ref self: T, resource_type: u8, amount: u128, cost: Span<(u8, u128)>);
}

#[starknet::interface]
trait ITravelStaminaCostConfig<T> {
    fn set_travel_stamina_cost_config(ref self: T, travel_type: u8, cost: u16);
}

#[starknet::interface]
trait ITroopConfig<T> {
    fn set_troop_config(ref self: T, troop_config: TroopConfig);
}

#[starknet::interface]
trait IBuildingConfig<T> {
    fn set_building_general_config(ref self: T, base_cost_percent_increase: u16);
    fn set_building_config(
        ref self: T, building_category: BuildingCategory, building_resource_type: u8, cost_of_building: Span<(u8, u128)>
    );
}

#[starknet::interface]
trait IBuildingCategoryPopConfig<T> {
    fn set_building_category_pop_config(
        ref self: T, building_category: BuildingCategory, population: u32, capacity: u32
    );
}

#[starknet::interface]
trait IPopulationConfig<T> {
    fn set_population_config(ref self: T, base_population: u32);
}

#[starknet::interface]
trait IMercenariesConfig<T> {
    fn set_mercenaries_config(
        ref self: T,
        knights_lower_bound: u64,
        knights_upper_bound: u64,
        paladins_lower_bound: u64,
        paladins_upper_bound: u64,
        crossbowmen_lower_bound: u64,
        crossbowmen_upper_bound: u64,
        rewards: Span<(u8, u128)>
    );
}

#[starknet::interface]
trait IResourceBridgeConfig<T> {
    fn set_resource_bridge_config(ref self: T, resource_bridge_config: ResourceBridgeConfig);
    fn set_resource_bridge_fee_split_config(
        ref self: T, resource_bridge_fee_split_config: ResourceBridgeFeeSplitConfig
    );
    fn set_resource_bridge_whitelist_config(
        ref self: T, resource_bridge_whitelist_config: ResourceBridgeWhitelistConfig
    );
}

#[starknet::interface]
trait ISettlementConfig<T> {
    fn set_settlement_config(
        ref self: T,
        center: u32,
        base_distance: u32,
        min_first_layer_distance: u32,
        points_placed: u32,
        current_layer: u32,
        current_side: u32,
        current_point_on_side: u32
    );
}


#[dojo::contract]
mod config_systems {
    use achievement::components::achievable::AchievableComponent;

    use dojo::model::ModelStorage;
    use dojo::world::WorldStorage;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

    use s0_eternum::alias::ID;

    use s0_eternum::constants::{
        ResourceTypes, WORLD_CONFIG_ID, TRANSPORT_CONFIG_ID, COMBAT_CONFIG_ID, REALM_LEVELING_CONFIG_ID,
        HYPERSTRUCTURE_CONFIG_ID, REALM_FREE_MINT_CONFIG_ID, BUILDING_CONFIG_ID, BUILDING_CATEGORY_POPULATION_CONFIG_ID,
        POPULATION_CONFIG_ID, DEFAULT_NS
    };
    use s0_eternum::models::bank::bank::{Bank};
    use s0_eternum::models::buildings::{BuildingCategory};
    use s0_eternum::models::combat::{Troops};

    use s0_eternum::models::config::{
        CapacityConfig, SpeedConfig, WeightConfig, WorldConfig, LevelingConfig, QuestConfig, QuestRewardConfig,
        MapConfig, TickConfig, ProductionConfig, BankConfig, TroopConfig, BuildingConfig, BuildingCategoryPopConfig,
        PopulationConfig, HyperstructureResourceConfig, HyperstructureConfig, StaminaConfig, StaminaRefillConfig,
        ResourceBridgeConfig, ResourceBridgeFeeSplitConfig, ResourceBridgeWhitelistConfig, BuildingGeneralConfig,
        MercenariesConfig, BattleConfig, TravelStaminaCostConfig, SettlementConfig, RealmLevelConfig,
        RealmMaxLevelConfig, TravelFoodCostConfig, SeasonAddressesConfig, VRFConfig, SeasonBridgeConfig
    };

    use s0_eternum::models::position::{Position, PositionTrait, Coord};
    use s0_eternum::models::production::{ProductionInput, ProductionOutput};
    use s0_eternum::models::resources::{ResourceCost, DetachedResource};
    use s0_eternum::models::season::{Season};
    use s0_eternum::utils::trophies::index::{Trophy, TrophyTrait, TROPHY_COUNT};

    // Components

    component!(path: AchievableComponent, storage: achievable, event: AchievableEvent);
    impl AchievableInternalImpl = AchievableComponent::InternalImpl<ContractState>;

    // Storage

    #[storage]
    struct Storage {
        #[substorage(v0)]
        achievable: AchievableComponent::Storage,
    }

    // Events

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        AchievableEvent: AchievableComponent::Event,
    }

    // Constuctor

    fn dojo_init(self: @ContractState,) {
        // [Event] Emit all Trophy events
        let mut world: WorldStorage = self.world(DEFAULT_NS());
        let mut trophy_id: u8 = TROPHY_COUNT;
        while trophy_id > 0 {
            let trophy: Trophy = trophy_id.into();
            self
                .achievable
                .create(
                    world,
                    id: trophy.identifier(),
                    hidden: trophy.hidden(),
                    index: trophy.index(),
                    points: trophy.points(),
                    start: 0,
                    end: 0,
                    group: trophy.group(),
                    icon: trophy.icon(),
                    title: trophy.title(),
                    description: trophy.description(),
                    tasks: trophy.tasks(),
                    data: trophy.data(),
                );
            trophy_id -= 1;
        }
    }


    fn assert_caller_is_admin(world: WorldStorage) {
        let mut world_config: WorldConfig = world.read_model(WORLD_CONFIG_ID);
        let admin_address = world_config.admin_address;
        if admin_address != Zeroable::zero() {
            assert(starknet::get_caller_address() == admin_address, 'caller not admin');
        }
    }

    #[abi(embed_v0)]
    impl WorldConfigImpl of super::IWorldConfig<ContractState> {
        fn set_world_config(
            ref self: ContractState,
            admin_address: starknet::ContractAddress,
            realm_l2_contract: starknet::ContractAddress
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            world.write_model(@WorldConfig { config_id: WORLD_CONFIG_ID, admin_address, realm_l2_contract });
        }
    }


    #[abi(embed_v0)]
    impl SeasonConfigImpl of super::ISeasonConfig<ContractState> {
        fn set_season_config(
            ref self: ContractState,
            season_pass_address: starknet::ContractAddress,
            realms_address: starknet::ContractAddress,
            lords_address: starknet::ContractAddress,
            start_at: u64
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            world
                .write_model(
                    @SeasonAddressesConfig {
                        config_id: WORLD_CONFIG_ID, season_pass_address, realms_address, lords_address,
                    }
                );

            let mut season: Season = world.read_model(WORLD_CONFIG_ID);
            if !season.is_over {
                season.start_at = start_at;
                world.write_model(@season);
            }
        }


        fn set_season_bridge_config(ref self: ContractState, close_after_end_seconds: u64) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            world.write_model(@SeasonBridgeConfig { config_id: WORLD_CONFIG_ID, close_after_end_seconds });
        }
    }

    #[abi(embed_v0)]
    impl VRFConfigImpl of super::IVRFConfig<ContractState> {
        fn set_vrf_config(ref self: ContractState, vrf_provider_address: starknet::ContractAddress) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            world.write_model(@VRFConfig { config_id: WORLD_CONFIG_ID, vrf_provider_address });
        }
    }

    #[abi(embed_v0)]
    impl QuestConfigImpl of super::IQuestConfig<ContractState> {
        fn set_quest_config(ref self: ContractState, production_material_multiplier: u16) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            world.write_model(@QuestConfig { config_id: WORLD_CONFIG_ID, production_material_multiplier });
        }

        fn set_quest_reward_config(ref self: ContractState, quest_id: ID, resources: Span<(u8, u128)>) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            // ensure quest id is greater than 0
            assert!(quest_id.is_non_zero(), "quest id must be greater than 0");

            let detached_resource_id = world.dispatcher.uuid();
            let detached_resource_count = resources.len();
            let mut resources = resources;
            let mut index = 0;
            loop {
                match resources.pop_front() {
                    Option::Some((
                        resource_type, resource_amount
                    )) => {
                        let (resource_type, resource_amount) = (*resource_type, *resource_amount);
                        // ensure lords can't be minted
                        assert!(resource_type != ResourceTypes::LORDS, "lords can't be minted as part of quest");
                        assert(resource_amount > 0, 'amount must not be 0');

                        world
                            .write_model(
                                @DetachedResource {
                                    entity_id: detached_resource_id,
                                    index,
                                    resource_type,
                                    resource_amount: resource_amount
                                }
                            );

                        index += 1;
                    },
                    Option::None => { break; }
                };
            };

            world.write_model(@QuestRewardConfig { quest_id, detached_resource_id, detached_resource_count });
        }
    }


    #[abi(embed_v0)]
    impl MapConfigImpl of super::IMapConfig<ContractState> {
        fn set_map_config(ref self: ContractState, mut map_config: MapConfig) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            map_config.config_id = WORLD_CONFIG_ID;
            world.write_model(@map_config);
        }
    }


    #[abi(embed_v0)]
    impl CapacityConfigImpl of super::ICapacityConfig<ContractState> {
        fn set_capacity_config(ref self: ContractState, capacity_config: CapacityConfig) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            world.write_model(@capacity_config);
        }
    }

    #[abi(embed_v0)]
    impl TravelStaminaCostConfigImpl of super::ITravelStaminaCostConfig<ContractState> {
        fn set_travel_stamina_cost_config(ref self: ContractState, travel_type: u8, cost: u16) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            world.write_model(@TravelStaminaCostConfig { config_id: WORLD_CONFIG_ID, travel_type, cost });
        }
    }

    #[abi(embed_v0)]
    impl WeightConfigImpl of super::IWeightConfig<ContractState> {
        fn set_weight_config(ref self: ContractState, entity_type: ID, weight_gram: u128) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            //note: if you change the weight of a resource e.g wood,
            //      it wont change the preexisting entities' weights
            world
                .write_model(
                    @WeightConfig {
                        config_id: WORLD_CONFIG_ID, weight_config_id: entity_type, entity_type, weight_gram,
                    }
                );
        }
    }

    #[abi(embed_v0)]
    impl BattleConfigImpl of super::IBattleConfig<ContractState> {
        fn set_battle_config(ref self: ContractState, mut battle_config: BattleConfig) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            battle_config.config_id = WORLD_CONFIG_ID;
            world.write_model(@battle_config);
        }
    }

    #[abi(embed_v0)]
    impl TickConfigImpl of super::ITickConfig<ContractState> {
        fn set_tick_config(ref self: ContractState, tick_id: u8, tick_interval_in_seconds: u64) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            world.write_model(@TickConfig { config_id: WORLD_CONFIG_ID, tick_id, tick_interval_in_seconds });
        }
    }

    #[abi(embed_v0)]
    impl StaminaConfigImpl of super::IStaminaConfig<ContractState> {
        fn set_stamina_config(ref self: ContractState, unit_type: u8, max_stamina: u16) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            world.write_model(@StaminaConfig { config_id: WORLD_CONFIG_ID, unit_type, max_stamina });
        }
    }

    #[abi(embed_v0)]
    impl TravelFoodCostConfigImpl of super::ITravelFoodCostConfig<ContractState> {
        fn set_travel_food_cost_config(ref self: ContractState, mut travel_food_cost_config: TravelFoodCostConfig) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            travel_food_cost_config.config_id = WORLD_CONFIG_ID;
            world.write_model(@travel_food_cost_config);
        }
    }

    #[abi(embed_v0)]
    impl StaminaRefillConfigImpl of super::IStaminaRefillConfig<ContractState> {
        fn set_stamina_refill_config(ref self: ContractState, amount_per_tick: u16, start_boost_tick_count: u8) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            world
                .write_model(
                    @StaminaRefillConfig { config_id: WORLD_CONFIG_ID, amount_per_tick, start_boost_tick_count }
                );
        }
    }

    #[abi(embed_v0)]
    impl LevelingConfigImpl of super::ILevelingConfig<ContractState> {
        fn set_leveling_config(
            ref self: ContractState,
            config_id: ID,
            decay_interval: u64,
            max_level: u64,
            decay_scaled: u128,
            cost_percentage_scaled: u128,
            base_multiplier: u128,
            wheat_base_amount: u128,
            fish_base_amount: u128,
            resource_1_costs: Span<(u8, u128)>,
            resource_2_costs: Span<(u8, u128)>,
            resource_3_costs: Span<(u8, u128)>,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            let resource_1_cost_id = world.dispatcher.uuid();
            let mut index = 0;
            loop {
                if index == resource_1_costs.len() {
                    break;
                }
                let (resource_type, resource_amount) = *resource_1_costs.at(index);
                world
                    .write_model(
                        @ResourceCost { entity_id: resource_1_cost_id, index, resource_type, amount: resource_amount }
                    );

                index += 1;
            };

            let resource_2_cost_id = world.dispatcher.uuid();
            let mut index = 0;
            loop {
                if index == resource_2_costs.len() {
                    break;
                }
                let (resource_type, resource_amount) = *resource_2_costs.at(index);
                world
                    .write_model(
                        @ResourceCost { entity_id: resource_2_cost_id, index, resource_type, amount: resource_amount }
                    );

                index += 1;
            };

            let resource_3_cost_id = world.dispatcher.uuid();
            let mut index = 0;
            loop {
                if index == resource_3_costs.len() {
                    break;
                }
                let (resource_type, resource_amount) = *resource_3_costs.at(index);
                world
                    .write_model(
                        @ResourceCost { entity_id: resource_3_cost_id, index, resource_type, amount: resource_amount }
                    );

                index += 1;
            };

            world
                .write_model(
                    @LevelingConfig {
                        config_id,
                        decay_interval,
                        max_level,
                        wheat_base_amount,
                        fish_base_amount,
                        resource_1_cost_id,
                        resource_2_cost_id,
                        resource_3_cost_id,
                        resource_1_cost_count: resource_1_costs.len(),
                        resource_2_cost_count: resource_2_costs.len(),
                        resource_3_cost_count: resource_3_costs.len(),
                        decay_scaled,
                        cost_percentage_scaled,
                        base_multiplier,
                    }
                );
        }
    }


    #[abi(embed_v0)]
    impl ProductionConfigImpl of super::IProductionConfig<ContractState> {
        fn set_production_config(ref self: ContractState, resource_type: u8, amount: u128, mut cost: Span<(u8, u128)>) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            let mut resource_production_config: ProductionConfig = world.read_model(resource_type);
            resource_production_config.amount = amount;
            world.write_model(@resource_production_config);
        }
    }


    #[abi(embed_v0)]
    impl TransportConfigImpl of super::ITransportConfig<ContractState> {
        fn set_speed_config(ref self: ContractState, entity_type: ID, sec_per_km: u16) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            world
                .write_model(
                    @SpeedConfig { config_id: WORLD_CONFIG_ID, speed_config_id: entity_type, entity_type, sec_per_km, }
                );
        }
    }


    #[abi(embed_v0)]
    impl HyperstructureConfigImpl of super::IHyperstructureConfig<ContractState> {
        fn set_hyperstructure_config(
            ref self: ContractState,
            resources_for_completion: Span<(u8, u128, u128)>,
            time_between_shares_change: u64,
            points_per_cycle: u128,
            points_for_win: u128,
            points_on_completion: u128
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            let mut i = 0;
            while (i < resources_for_completion.len()) {
                let (tier, min_amount, max_amount) = *resources_for_completion.at(i);

                world
                    .write_model(
                        @HyperstructureResourceConfig {
                            config_id: HYPERSTRUCTURE_CONFIG_ID, resource_tier: tier, min_amount, max_amount
                        }
                    );
                i += 1;
            };
            world
                .write_model(
                    @HyperstructureConfig {
                        config_id: HYPERSTRUCTURE_CONFIG_ID,
                        time_between_shares_change,
                        points_per_cycle,
                        points_for_win,
                        points_on_completion
                    }
                );
        }
    }


    #[abi(embed_v0)]
    impl BankConfigImpl of super::IBankConfig<ContractState> {
        fn set_bank_config(ref self: ContractState, lords_cost: u128, lp_fee_num: u128, lp_fee_denom: u128) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            world.write_model(@BankConfig { config_id: WORLD_CONFIG_ID, lords_cost, lp_fee_num, lp_fee_denom });
        }
    }

    #[abi(embed_v0)]
    impl TroopConfigImpl of super::ITroopConfig<ContractState> {
        fn set_troop_config(ref self: ContractState, mut troop_config: TroopConfig) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            troop_config.config_id = WORLD_CONFIG_ID;
            world.write_model(@troop_config);
        }
    }

    #[abi(embed_v0)]
    impl BuildingCategoryPopulationConfigImpl of super::IBuildingCategoryPopConfig<ContractState> {
        fn set_building_category_pop_config(
            ref self: ContractState, building_category: BuildingCategory, population: u32, capacity: u32
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            world
                .write_model(
                    @BuildingCategoryPopConfig {
                        config_id: BUILDING_CATEGORY_POPULATION_CONFIG_ID, building_category, population, capacity
                    }
                )
        }
    }

    #[abi(embed_v0)]
    impl PopulationConfigImpl of super::IPopulationConfig<ContractState> {
        fn set_population_config(ref self: ContractState, base_population: u32) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            world.write_model(@PopulationConfig { config_id: POPULATION_CONFIG_ID, base_population });
        }
    }

    #[abi(embed_v0)]
    impl BuildingConfigImpl of super::IBuildingConfig<ContractState> {
        fn set_building_general_config(ref self: ContractState, base_cost_percent_increase: u16) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            world.write_model(@BuildingGeneralConfig { config_id: WORLD_CONFIG_ID, base_cost_percent_increase });
        }

        fn set_building_config(
            ref self: ContractState,
            building_category: BuildingCategory,
            building_resource_type: u8,
            cost_of_building: Span<(u8, u128)>
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            let resource_cost_id = world.dispatcher.uuid();
            let mut index = 0;
            loop {
                if index == cost_of_building.len() {
                    break;
                }
                let (resource_type, resource_amount) = *cost_of_building.at(index);
                world
                    .write_model(
                        @ResourceCost { entity_id: resource_cost_id, index, resource_type, amount: resource_amount }
                    );

                index += 1;
            };
            world
                .write_model(
                    @BuildingConfig {
                        config_id: WORLD_CONFIG_ID,
                        category: building_category,
                        resource_type: building_resource_type,
                        resource_cost_id,
                        resource_cost_count: cost_of_building.len()
                    }
                );
        }
    }

    #[abi(embed_v0)]
    impl IMercenariesConfig of super::IMercenariesConfig<ContractState> {
        fn set_mercenaries_config(
            ref self: ContractState,
            knights_lower_bound: u64,
            knights_upper_bound: u64,
            paladins_lower_bound: u64,
            paladins_upper_bound: u64,
            crossbowmen_lower_bound: u64,
            crossbowmen_upper_bound: u64,
            rewards: Span<(u8, u128)>
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            assert!(
                knights_lower_bound < knights_upper_bound, "knights_lower_bound must be lower than knights_upper_bound"
            );
            assert!(
                paladins_lower_bound < paladins_upper_bound,
                "paladins_lower_bound must be lower than paladins_upper_bound"
            );
            assert!(
                crossbowmen_lower_bound < crossbowmen_upper_bound,
                "crossbowmen_lower_bound must be lower than crossbowmen_upper_bound"
            );

            world
                .write_model(
                    @MercenariesConfig {
                        config_id: WORLD_CONFIG_ID,
                        knights_lower_bound,
                        knights_upper_bound,
                        paladins_lower_bound,
                        paladins_upper_bound,
                        crossbowmen_lower_bound,
                        crossbowmen_upper_bound,
                        rewards
                    }
                );
        }
    }

    #[abi(embed_v0)]
    impl IResourceBridgeConfig of super::IResourceBridgeConfig<ContractState> {
        fn set_resource_bridge_config(ref self: ContractState, mut resource_bridge_config: ResourceBridgeConfig) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            resource_bridge_config.config_id = WORLD_CONFIG_ID;
            world.write_model(@resource_bridge_config);
        }

        fn set_resource_bridge_fee_split_config(
            ref self: ContractState, mut resource_bridge_fee_split_config: ResourceBridgeFeeSplitConfig
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            resource_bridge_fee_split_config.config_id = WORLD_CONFIG_ID;
            world.write_model(@resource_bridge_fee_split_config);
        }

        fn set_resource_bridge_whitelist_config(
            ref self: ContractState, mut resource_bridge_whitelist_config: ResourceBridgeWhitelistConfig
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            // note: if we are whitelisting a NEW resource type, we WILL need to
            // update several functions related to resources in `s0_eternum::constants`
            // so the new resource type is recognized throughout the contract.

            assert!(resource_bridge_whitelist_config.resource_type > 0, "resource type should be non zero");
            assert!(
                resource_bridge_whitelist_config.resource_type <= 255,
                "the system only supports at most 255 resource types"
            );

            world.write_model(@resource_bridge_whitelist_config);
        }
    }

    #[abi(embed_v0)]
    impl RealmLevelConfigImpl of super::IRealmLevelConfig<ContractState> {
        fn set_realm_max_level_config(ref self: ContractState, new_max_level: u8) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            world.write_model(@RealmMaxLevelConfig { config_id: WORLD_CONFIG_ID, max_level: new_max_level });
        }

        fn set_realm_level_config(ref self: ContractState, level: u8, mut resources: Span<(u8, u128)>) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            let detached_resource_id = world.dispatcher.uuid();
            let detached_resource_count = resources.len();
            let mut index = 0;
            for (
                resource_type, resource_amount
            ) in resources {
                let (resource_type, resource_amount) = (*resource_type, *resource_amount);
                assert(resource_amount > 0, 'amount must not be 0');

                world
                    .write_model(
                        @DetachedResource { entity_id: detached_resource_id, index, resource_type, resource_amount }
                    );

                index += 1;
            };

            world
                .write_model(
                    @RealmLevelConfig {
                        level,
                        required_resources_id: detached_resource_id.into(),
                        required_resource_count: detached_resource_count.try_into().unwrap()
                    }
                );
        }
    }

    #[abi(embed_v0)]
    impl ISettlementConfig of super::ISettlementConfig<ContractState> {
        fn set_settlement_config(
            ref self: ContractState,
            center: u32,
            base_distance: u32,
            min_first_layer_distance: u32,
            points_placed: u32,
            current_layer: u32,
            current_side: u32,
            current_point_on_side: u32
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            world
                .write_model(
                    @SettlementConfig {
                        config_id: WORLD_CONFIG_ID,
                        center,
                        base_distance,
                        min_first_layer_distance,
                        points_placed,
                        current_layer,
                        current_side,
                        current_point_on_side,
                    }
                );
        }
    }
}
