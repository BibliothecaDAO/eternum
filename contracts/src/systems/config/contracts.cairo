use dojo::world::IWorldDispatcher;
use eternum::alias::ID;
use eternum::models::buildings::BuildingCategory;
use eternum::models::combat::{Troops};
use eternum::models::config::{
    TroopConfig, MapConfig, BattleConfig, MercenariesConfig, CapacityConfig, ResourceBridgeConfig,
    ResourceBridgeFeeSplitConfig, ResourceBridgeWhitelistConfig, TravelFoodCostConfig
};
use eternum::models::position::Coord;

#[dojo::interface]
trait IWorldConfig {
    fn set_world_config(
        ref world: IWorldDispatcher,
        admin_address: starknet::ContractAddress,
        realm_l2_contract: starknet::ContractAddress
    );
}

#[dojo::interface]
trait IRealmFreeMintConfig {
    fn set_mint_config(ref world: IWorldDispatcher, config_id: ID, resources: Span<(u8, u128)>);
}

#[dojo::interface]
trait IRealmLevelConfig {
    fn set_realm_max_level_config(ref world: IWorldDispatcher, new_max_level: u8);
    fn set_realm_level_config(ref world: IWorldDispatcher, level: u8, resources: Span<(u8, u128)>);
}

#[dojo::interface]
trait IWeightConfig {
    fn set_weight_config(ref world: IWorldDispatcher, entity_type: ID, weight_gram: u128);
}

#[dojo::interface]
trait IBattleConfig {
    fn set_battle_config(ref world: IWorldDispatcher, battle_config: BattleConfig);
}

#[dojo::interface]
trait ICapacityConfig {
    fn set_capacity_config(ref world: IWorldDispatcher, capacity_config: CapacityConfig);
}

#[dojo::interface]
trait ITickConfig {
    fn set_tick_config(ref world: IWorldDispatcher, tick_id: u8, tick_interval_in_seconds: u64);
}

#[dojo::interface]
trait IStaminaConfig {
    fn set_stamina_config(ref world: IWorldDispatcher, unit_type: u8, max_stamina: u16);
}

#[dojo::interface]
trait ITravelFoodCostConfig {
    fn set_travel_food_cost_config(ref world: IWorldDispatcher, travel_food_cost_config: TravelFoodCostConfig);
}

#[dojo::interface]
trait IStaminaRefillConfig {
    fn set_stamina_refill_config(ref world: IWorldDispatcher, amount: u16);
}

#[dojo::interface]
trait ITransportConfig {
    fn set_speed_config(ref world: IWorldDispatcher, entity_type: ID, sec_per_km: u16);
}

#[dojo::interface]
trait IHyperstructureConfig {
    fn set_hyperstructure_config(
        ref world: IWorldDispatcher,
        resources_for_completion: Span<(u8, u128)>,
        time_between_shares_change: u64,
        points_per_cycle: u128,
        points_for_win: u128,
        points_on_completion: u128
    );
}

#[dojo::interface]
trait ILevelingConfig {
    fn set_leveling_config(
        ref world: IWorldDispatcher,
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

#[dojo::interface]
trait IBankConfig {
    fn set_bank_config(ref world: IWorldDispatcher, lords_cost: u128, lp_fee_num: u128, lp_fee_denom: u128);
}


#[dojo::interface]
trait IMapConfig {
    fn set_map_config(ref world: IWorldDispatcher, map_config: MapConfig);
}


#[dojo::interface]
trait IProductionConfig {
    fn set_production_config(ref world: IWorldDispatcher, resource_type: u8, amount: u128, cost: Span<(u8, u128)>);
}

#[dojo::interface]
trait ITravelStaminaCostConfig {
    fn set_travel_stamina_cost_config(ref world: IWorldDispatcher, travel_type: u8, cost: u16);
}

#[dojo::interface]
trait ITroopConfig {
    fn set_troop_config(ref world: IWorldDispatcher, troop_config: TroopConfig);
}

#[dojo::interface]
trait IBuildingConfig {
    fn set_building_general_config(ref world: IWorldDispatcher, base_cost_percent_increase: u16);
    fn set_building_config(
        ref world: IWorldDispatcher,
        building_category: BuildingCategory,
        building_resource_type: u8,
        cost_of_building: Span<(u8, u128)>
    );
}

#[dojo::interface]
trait IBuildingCategoryPopConfig {
    fn set_building_category_pop_config(
        ref world: IWorldDispatcher, building_category: BuildingCategory, population: u32, capacity: u32
    );
}

#[dojo::interface]
trait IPopulationConfig {
    fn set_population_config(ref world: IWorldDispatcher, base_population: u32);
}

#[dojo::interface]
trait IMercenariesConfig {
    fn set_mercenaries_config(ref world: IWorldDispatcher, troops: Troops, rewards: Span<(u8, u128)>);
}

#[dojo::interface]
trait IResourceBridgeConfig {
    fn set_resource_bridge_config(ref world: IWorldDispatcher, resource_bridge_config: ResourceBridgeConfig);
    fn set_resource_bridge_fee_split_config(
        ref world: IWorldDispatcher, resource_bridge_fee_split_config: ResourceBridgeFeeSplitConfig
    );
    fn set_resource_bridge_whitelist_config(
        ref world: IWorldDispatcher, resource_bridge_whitelist_config: ResourceBridgeWhitelistConfig
    );
}

#[dojo::interface]
trait ISettlementConfig {
    fn set_settlement_config(
        ref world: IWorldDispatcher,
        radius: u32,
        angle_scaled: u128,
        center: u32,
        min_distance: u32,
        max_distance: u32,
        min_scaling_factor_scaled: u128,
        min_angle_increase: u64,
        max_angle_increase: u64,
    );
}


#[dojo::contract]
mod config_systems {
    use eternum::alias::ID;

    use eternum::constants::{
        WORLD_CONFIG_ID, TRANSPORT_CONFIG_ID, COMBAT_CONFIG_ID, REALM_LEVELING_CONFIG_ID, HYPERSTRUCTURE_CONFIG_ID,
        REALM_FREE_MINT_CONFIG_ID, BUILDING_CONFIG_ID, BUILDING_CATEGORY_POPULATION_CONFIG_ID, POPULATION_CONFIG_ID
    };
    use eternum::models::bank::bank::{Bank};
    use eternum::models::buildings::{BuildingCategory};
    use eternum::models::combat::{Troops};

    use eternum::models::config::{
        CapacityConfig, SpeedConfig, WeightConfig, WorldConfig, LevelingConfig, RealmFreeMintConfig, MapConfig,
        TickConfig, ProductionConfig, BankConfig, TroopConfig, BuildingConfig, BuildingCategoryPopConfig,
        PopulationConfig, HyperstructureResourceConfig, HyperstructureConfig, StaminaConfig, StaminaRefillConfig,
        ResourceBridgeConfig, ResourceBridgeFeeSplitConfig, ResourceBridgeWhitelistConfig, BuildingGeneralConfig,
        MercenariesConfig, BattleConfig, TravelStaminaCostConfig, SettlementConfig, RealmLevelConfig,
        RealmMaxLevelConfig, TravelFoodCostConfig
    };
    use eternum::models::hyperstructure::SeasonCustomImpl;

    use eternum::models::position::{Position, PositionCustomTrait, Coord};
    use eternum::models::production::{ProductionInput, ProductionOutput};
    use eternum::models::resources::{ResourceCost, DetachedResource};


    fn assert_caller_is_admin(world: IWorldDispatcher) {
        let admin_address = get!(world, WORLD_CONFIG_ID, WorldConfig).admin_address;
        if admin_address != Zeroable::zero() {
            assert(starknet::get_caller_address() == admin_address, 'caller not admin');
        }
    }

    #[abi(embed_v0)]
    impl WorldConfigCustomImpl of super::IWorldConfig<ContractState> {
        fn set_world_config(
            ref world: IWorldDispatcher,
            admin_address: starknet::ContractAddress,
            realm_l2_contract: starknet::ContractAddress
        ) {
            assert_caller_is_admin(world);

            set!(world, (WorldConfig { config_id: WORLD_CONFIG_ID, admin_address, realm_l2_contract }));
        }
    }
    #[abi(embed_v0)]
    impl RealmFreeMintConfigCustomImpl of super::IRealmFreeMintConfig<ContractState> {
        fn set_mint_config(ref world: IWorldDispatcher, config_id: ID, resources: Span<(u8, u128)>) {
            assert_caller_is_admin(world);

            let detached_resource_id = world.uuid();
            let detached_resource_count = resources.len();
            let mut resources = resources;
            let mut index = 0;
            loop {
                match resources.pop_front() {
                    Option::Some((
                        resource_type, resource_amount
                    )) => {
                        let (resource_type, resource_amount) = (*resource_type, *resource_amount);
                        assert(resource_amount > 0, 'amount must not be 0');

                        set!(
                            world,
                            (
                                DetachedResource {
                                    entity_id: detached_resource_id,
                                    index,
                                    resource_type,
                                    resource_amount: resource_amount
                                },
                            )
                        );

                        index += 1;
                    },
                    Option::None => { break; }
                };
            };

            // we define the config indexes so we can have more than 1
            let config_index = REALM_FREE_MINT_CONFIG_ID + config_id.into();

            set!(
                world, (RealmFreeMintConfig { config_id: config_index, detached_resource_id, detached_resource_count })
            );
        }
    }
    #[abi(embed_v0)]
    impl MapConfigCustomImpl of super::IMapConfig<ContractState> {
        fn set_map_config(ref world: IWorldDispatcher, mut map_config: MapConfig) {
            assert_caller_is_admin(world);

            map_config.config_id = WORLD_CONFIG_ID;
            set!(world, (map_config));
        }
    }


    #[abi(embed_v0)]
    impl CapacityConfigCustomImpl of super::ICapacityConfig<ContractState> {
        fn set_capacity_config(ref world: IWorldDispatcher, capacity_config: CapacityConfig) {
            assert_caller_is_admin(world);

            set!(world, (capacity_config));
        }
    }

    #[abi(embed_v0)]
    impl TravelStaminaCostConfigImpl of super::ITravelStaminaCostConfig<ContractState> {
        fn set_travel_stamina_cost_config(ref world: IWorldDispatcher, travel_type: u8, cost: u16) {
            assert_caller_is_admin(world);

            set!(world, (TravelStaminaCostConfig { config_id: WORLD_CONFIG_ID, travel_type, cost }));
        }
    }

    #[abi(embed_v0)]
    impl WeightConfigCustomImpl of super::IWeightConfig<ContractState> {
        fn set_weight_config(ref world: IWorldDispatcher, entity_type: ID, weight_gram: u128) {
            assert_caller_is_admin(world);

            //note: if you change the weight of a resource e.g wood,
            //      it wont change the preexisting entities' weights
            set!(
                world,
                (WeightConfig { config_id: WORLD_CONFIG_ID, weight_config_id: entity_type, entity_type, weight_gram, })
            );
        }
    }

    #[abi(embed_v0)]
    impl BattleConfigCustomImpl of super::IBattleConfig<ContractState> {
        fn set_battle_config(ref world: IWorldDispatcher, mut battle_config: BattleConfig) {
            assert_caller_is_admin(world);

            battle_config.config_id = WORLD_CONFIG_ID;
            set!(world, (battle_config));
        }
    }

    #[abi(embed_v0)]
    impl TickConfigCustomImpl of super::ITickConfig<ContractState> {
        fn set_tick_config(ref world: IWorldDispatcher, tick_id: u8, tick_interval_in_seconds: u64) {
            assert_caller_is_admin(world);

            set!(world, (TickConfig { config_id: WORLD_CONFIG_ID, tick_id, tick_interval_in_seconds }));
        }
    }

    #[abi(embed_v0)]
    impl StaminaConfigCustomImpl of super::IStaminaConfig<ContractState> {
        fn set_stamina_config(ref world: IWorldDispatcher, unit_type: u8, max_stamina: u16) {
            assert_caller_is_admin(world);

            set!(world, (StaminaConfig { config_id: WORLD_CONFIG_ID, unit_type, max_stamina }));
        }
    }

    #[abi(embed_v0)]
    impl TravelFoodCostConfigCustomImpl of super::ITravelFoodCostConfig<ContractState> {
        fn set_travel_food_cost_config(ref world: IWorldDispatcher, mut travel_food_cost_config: TravelFoodCostConfig) {
            assert_caller_is_admin(world);

            travel_food_cost_config.config_id = WORLD_CONFIG_ID;
            set!(world, (travel_food_cost_config));
        }
    }

    #[abi(embed_v0)]
    impl StaminaRefillConfigCustomImpl of super::IStaminaRefillConfig<ContractState> {
        fn set_stamina_refill_config(ref world: IWorldDispatcher, amount: u16) {
            assert_caller_is_admin(world);

            set!(world, (StaminaRefillConfig { config_id: WORLD_CONFIG_ID, amount_per_tick: amount }));
        }
    }

    #[abi(embed_v0)]
    impl LevelingConfigCustomImpl of super::ILevelingConfig<ContractState> {
        fn set_leveling_config(
            ref world: IWorldDispatcher,
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
            assert_caller_is_admin(world);

            let resource_1_cost_id = world.uuid();
            let mut index = 0;
            loop {
                if index == resource_1_costs.len() {
                    break;
                }
                let (resource_type, resource_amount) = *resource_1_costs.at(index);
                set!(
                    world,
                    (ResourceCost { entity_id: resource_1_cost_id, index, resource_type, amount: resource_amount })
                );

                index += 1;
            };

            let resource_2_cost_id = world.uuid();
            let mut index = 0;
            loop {
                if index == resource_2_costs.len() {
                    break;
                }
                let (resource_type, resource_amount) = *resource_2_costs.at(index);
                set!(
                    world,
                    (ResourceCost { entity_id: resource_2_cost_id, index, resource_type, amount: resource_amount })
                );

                index += 1;
            };

            let resource_3_cost_id = world.uuid();
            let mut index = 0;
            loop {
                if index == resource_3_costs.len() {
                    break;
                }
                let (resource_type, resource_amount) = *resource_3_costs.at(index);
                set!(
                    world,
                    (ResourceCost { entity_id: resource_3_cost_id, index, resource_type, amount: resource_amount })
                );

                index += 1;
            };

            set!(
                world,
                (LevelingConfig {
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
                })
            );
        }
    }


    #[abi(embed_v0)]
    impl ProductionConfigCustomImpl of super::IProductionConfig<ContractState> {
        fn set_production_config(
            ref world: IWorldDispatcher, resource_type: u8, amount: u128, mut cost: Span<(u8, u128)>
        ) {
            assert_caller_is_admin(world);

            let mut resource_production_config: ProductionConfig = get!(world, resource_type, ProductionConfig);
            assert!(
                resource_production_config.amount.is_zero(),
                "Production config already set for {} resource",
                resource_type
            );

            resource_production_config.amount = amount;

            loop {
                match cost.pop_front() {
                    Option::Some((
                        input_resource_type, input_resource_amount
                    )) => {
                        // update output resource's production input/material
                        set!(
                            world,
                            (ProductionInput {
                                output_resource_type: resource_type,
                                index: resource_production_config.input_count.try_into().unwrap(),
                                input_resource_type: *input_resource_type,
                                input_resource_amount: *input_resource_amount
                            })
                        );

                        resource_production_config.input_count += 1;

                        // update input resource's production output
                        let mut input_resource_production_config: ProductionConfig = get!(
                            world, *input_resource_type, ProductionConfig
                        );

                        set!(
                            world,
                            (ProductionOutput {
                                input_resource_type: *input_resource_type,
                                index: input_resource_production_config.output_count.try_into().unwrap(),
                                output_resource_type: resource_type,
                            })
                        );

                        input_resource_production_config.output_count += 1;
                        set!(world, (input_resource_production_config));
                    },
                    Option::None => { break; }
                }
            };

            set!(world, (resource_production_config));
        }
    }


    #[abi(embed_v0)]
    impl TransportConfigCustomImpl of super::ITransportConfig<ContractState> {
        fn set_speed_config(ref world: IWorldDispatcher, entity_type: ID, sec_per_km: u16) {
            assert_caller_is_admin(world);

            set!(
                world,
                (SpeedConfig { config_id: WORLD_CONFIG_ID, speed_config_id: entity_type, entity_type, sec_per_km, })
            );
        }
    }


    #[abi(embed_v0)]
    impl HyperstructureConfigCustomImpl of super::IHyperstructureConfig<ContractState> {
        fn set_hyperstructure_config(
            ref world: IWorldDispatcher,
            resources_for_completion: Span<(u8, u128)>,
            time_between_shares_change: u64,
            points_per_cycle: u128,
            points_for_win: u128,
            points_on_completion: u128
        ) {
            assert_caller_is_admin(world);
            let mut i = 0;
            while (i < resources_for_completion.len()) {
                let (resource_type, amount_for_completion) = *resources_for_completion.at(i);

                set!(
                    world,
                    (
                        HyperstructureResourceConfig {
                            config_id: HYPERSTRUCTURE_CONFIG_ID, resource_type, amount_for_completion
                        },
                    )
                );
                i += 1;
            };
            set!(
                world,
                (HyperstructureConfig {
                    config_id: HYPERSTRUCTURE_CONFIG_ID,
                    time_between_shares_change,
                    points_per_cycle,
                    points_for_win,
                    points_on_completion
                })
            );
        }
    }


    #[abi(embed_v0)]
    impl BankConfigCustomImpl of super::IBankConfig<ContractState> {
        fn set_bank_config(ref world: IWorldDispatcher, lords_cost: u128, lp_fee_num: u128, lp_fee_denom: u128) {
            assert_caller_is_admin(world);

            set!(world, (BankConfig { config_id: WORLD_CONFIG_ID, lords_cost, lp_fee_num, lp_fee_denom }));
        }
    }

    #[abi(embed_v0)]
    impl TroopConfigCustomImpl of super::ITroopConfig<ContractState> {
        fn set_troop_config(ref world: IWorldDispatcher, mut troop_config: TroopConfig) {
            assert_caller_is_admin(world);

            troop_config.config_id = WORLD_CONFIG_ID;
            set!(world, (troop_config));
        }
    }

    #[abi(embed_v0)]
    impl BuildingCategoryPopulationConfigCustomImpl of super::IBuildingCategoryPopConfig<ContractState> {
        fn set_building_category_pop_config(
            ref world: IWorldDispatcher, building_category: BuildingCategory, population: u32, capacity: u32
        ) {
            assert_caller_is_admin(world);

            set!(
                world,
                BuildingCategoryPopConfig {
                    config_id: BUILDING_CATEGORY_POPULATION_CONFIG_ID, building_category, population, capacity
                }
            )
        }
    }

    #[abi(embed_v0)]
    impl PopulationConfigCustomImpl of super::IPopulationConfig<ContractState> {
        fn set_population_config(ref world: IWorldDispatcher, base_population: u32,) {
            assert_caller_is_admin(world);

            set!(world, PopulationConfig { config_id: POPULATION_CONFIG_ID, base_population })
        }
    }

    #[abi(embed_v0)]
    impl BuildingConfigCustomImpl of super::IBuildingConfig<ContractState> {
        fn set_building_general_config(ref world: IWorldDispatcher, base_cost_percent_increase: u16) {
            assert_caller_is_admin(world);

            set!(world, BuildingGeneralConfig { config_id: WORLD_CONFIG_ID, base_cost_percent_increase });
        }

        fn set_building_config(
            ref world: IWorldDispatcher,
            building_category: BuildingCategory,
            building_resource_type: u8,
            cost_of_building: Span<(u8, u128)>
        ) {
            assert_caller_is_admin(world);

            let resource_cost_id = world.uuid();
            let mut index = 0;
            loop {
                if index == cost_of_building.len() {
                    break;
                }
                let (resource_type, resource_amount) = *cost_of_building.at(index);
                set!(
                    world, (ResourceCost { entity_id: resource_cost_id, index, resource_type, amount: resource_amount })
                );

                index += 1;
            };
            set!(
                world,
                (BuildingConfig {
                    config_id: WORLD_CONFIG_ID,
                    category: building_category,
                    resource_type: building_resource_type,
                    resource_cost_id,
                    resource_cost_count: cost_of_building.len()
                })
            );
        }
    }

    #[abi(embed_v0)]
    impl IMercenariesConfig of super::IMercenariesConfig<ContractState> {
        fn set_mercenaries_config(ref world: IWorldDispatcher, troops: Troops, rewards: Span<(u8, u128)>) {
            assert_caller_is_admin(world);

            set!(world, (MercenariesConfig { config_id: WORLD_CONFIG_ID, troops, rewards }));
        }
    }

    #[abi(embed_v0)]
    impl IResourceBridgeConfig of super::IResourceBridgeConfig<ContractState> {
        fn set_resource_bridge_config(ref world: IWorldDispatcher, mut resource_bridge_config: ResourceBridgeConfig) {
            assert_caller_is_admin(world);

            resource_bridge_config.config_id = WORLD_CONFIG_ID;
            set!(world, (resource_bridge_config));
        }

        fn set_resource_bridge_fee_split_config(
            ref world: IWorldDispatcher, mut resource_bridge_fee_split_config: ResourceBridgeFeeSplitConfig
        ) {
            assert_caller_is_admin(world);

            resource_bridge_fee_split_config.config_id = WORLD_CONFIG_ID;
            set!(world, (resource_bridge_fee_split_config));
        }

        fn set_resource_bridge_whitelist_config(
            ref world: IWorldDispatcher, mut resource_bridge_whitelist_config: ResourceBridgeWhitelistConfig
        ) {
            assert_caller_is_admin(world);

            // note: if we are whitelisting a NEW resource type, we WILL need to
            // update several functions related to resources in `eternum::constants`
            // so the new resource type is recognized throughout the contract.

            assert!(resource_bridge_whitelist_config.resource_type > 0, "resource type should be non zero");
            assert!(
                resource_bridge_whitelist_config.resource_type <= 255,
                "the system only supports at most 255 resource types"
            );

            set!(world, (resource_bridge_whitelist_config));
        }
    }

    #[abi(embed_v0)]
    impl RealmLevelConfigCustomImpl of super::IRealmLevelConfig<ContractState> {
        fn set_realm_max_level_config(ref world: IWorldDispatcher, new_max_level: u8) {
            // ensure only admin can set this
            assert_caller_is_admin(world);

            set!(world, (RealmMaxLevelConfig { config_id: WORLD_CONFIG_ID, max_level: new_max_level }));
        }

        fn set_realm_level_config(ref world: IWorldDispatcher, level: u8, mut resources: Span<(u8, u128)>) {
            // ensure only admin can set this
            assert_caller_is_admin(world);

            let detached_resource_id = world.uuid();
            let detached_resource_count = resources.len();
            let mut index = 0;
            for (
                resource_type, resource_amount
            ) in resources {
                let (resource_type, resource_amount) = (*resource_type, *resource_amount);
                assert(resource_amount > 0, 'amount must not be 0');

                set!(
                    world,
                    (
                        DetachedResource {
                            entity_id: detached_resource_id, index, resource_type, resource_amount: resource_amount
                        },
                    )
                );

                index += 1;
            };

            set!(
                world,
                (RealmLevelConfig {
                    level,
                    required_resources_id: detached_resource_id.into(),
                    required_resource_count: detached_resource_count.try_into().unwrap()
                })
            );
        }
    }

    #[abi(embed_v0)]
    impl ISettlementConfig of super::ISettlementConfig<ContractState> {
        fn set_settlement_config(
            ref world: IWorldDispatcher,
            radius: u32,
            angle_scaled: u128,
            center: u32,
            min_distance: u32,
            max_distance: u32,
            min_scaling_factor_scaled: u128,
            min_angle_increase: u64,
            max_angle_increase: u64
        ) {
            assert_caller_is_admin(world);
            set!(
                world,
                (SettlementConfig {
                    config_id: WORLD_CONFIG_ID,
                    radius,
                    angle_scaled,
                    center,
                    min_distance,
                    max_distance,
                    min_scaling_factor_scaled,
                    min_angle_increase,
                    max_angle_increase,
                })
            );
        }
    }
}
