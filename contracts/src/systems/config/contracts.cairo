use dojo::world::IWorldDispatcher;
use eternum::alias::ID;
use eternum::models::buildings::BuildingCategory;
use eternum::models::combat::{Troops};
use eternum::models::config::{TroopConfig, MercenariesConfig};
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
trait IWeightConfig {
    fn set_weight_config(ref world: IWorldDispatcher, entity_type: ID, weight_gram: u128);
}

#[dojo::interface]
trait ICapacityConfig {
    fn set_capacity_config(ref world: IWorldDispatcher, entity_type: ID, weight_gram: u128);
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
trait ITransportConfig {
    fn set_road_config(ref world: IWorldDispatcher, resource_costs: Span<(u8, u128)>, speed_up_by: u64);
    fn set_speed_config(ref world: IWorldDispatcher, entity_type: ID, sec_per_km: u16);
}

#[dojo::interface]
trait IHyperstructureConfig {
    fn set_hyperstructure_config(ref world: IWorldDispatcher, resources_for_completion: Span<(u8, u128)>);
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
    fn set_exploration_config(
        ref world: IWorldDispatcher,
        wheat_burn_amount: u128,
        fish_burn_amount: u128,
        reward_resource_amount: u128,
        shards_mines_fail_probability: u128
    );
}


#[dojo::interface]
trait IProductionConfig {
    fn set_production_config(ref world: IWorldDispatcher, resource_type: u8, amount: u128, cost: Span<(u8, u128)>);
}

#[dojo::interface]
trait ITroopConfig {
    fn set_troop_config(ref world: IWorldDispatcher, troop_config: TroopConfig);
}

#[dojo::interface]
trait IBuildingConfig {
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


#[dojo::contract]
mod config_systems {
    use eternum::alias::ID;

    use eternum::constants::{
        WORLD_CONFIG_ID, TRANSPORT_CONFIG_ID, ROAD_CONFIG_ID, COMBAT_CONFIG_ID, REALM_LEVELING_CONFIG_ID,
        HYPERSTRUCTURE_CONFIG_ID, REALM_FREE_MINT_CONFIG_ID, BUILDING_CONFIG_ID, BUILDING_CATEGORY_POPULATION_CONFIG_ID,
        POPULATION_CONFIG_ID
    };
    use eternum::models::bank::bank::{Bank};
    use eternum::models::buildings::{BuildingCategory};
    use eternum::models::combat::{Troops};

    use eternum::models::config::{
        CapacityConfig, RoadConfig, SpeedConfig, WeightConfig, WorldConfig, LevelingConfig, RealmFreeMintConfig,
        MapExploreConfig, TickConfig, ProductionConfig, BankConfig, TroopConfig, BuildingConfig,
        BuildingCategoryPopConfig, PopulationConfig, HyperstructureResourceConfig, StaminaConfig, MercenariesConfig
    };

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
        fn set_exploration_config(
            ref world: IWorldDispatcher,
            wheat_burn_amount: u128,
            fish_burn_amount: u128,
            reward_resource_amount: u128,
            // weight of fail
            // the higher, the less likely to find a mine
            // weight of sucess = 1000
            // ex: if set to 5000
            shards_mines_fail_probability: u128,
        ) {
            assert_caller_is_admin(world);

            set!(
                world,
                (MapExploreConfig {
                    config_id: WORLD_CONFIG_ID,
                    wheat_burn_amount,
                    fish_burn_amount,
                    reward_resource_amount,
                    shards_mines_fail_probability
                })
            );
        }
    }


    #[abi(embed_v0)]
    impl CapacityConfigCustomImpl of super::ICapacityConfig<ContractState> {
        fn set_capacity_config(ref world: IWorldDispatcher, entity_type: ID, weight_gram: u128) {
            assert_caller_is_admin(world);

            set!(
                world,
                (CapacityConfig {
                    config_id: WORLD_CONFIG_ID, carry_capacity_config_id: entity_type, entity_type, weight_gram,
                })
            );
        }
    }

    #[abi(embed_v0)]
    impl WeightConfigCustomImpl of super::IWeightConfig<ContractState> {
        fn set_weight_config(ref world: IWorldDispatcher, entity_type: ID, weight_gram: u128) {
            assert_caller_is_admin(world);

            set!(
                world,
                (WeightConfig { config_id: WORLD_CONFIG_ID, weight_config_id: entity_type, entity_type, weight_gram, })
            );
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
        fn set_road_config(ref world: IWorldDispatcher, resource_costs: Span<(u8, u128)>, speed_up_by: u64) {
            assert_caller_is_admin(world);

            let resource_cost_id = world.uuid();
            let mut index = 0;
            loop {
                if index == resource_costs.len() {
                    break;
                }
                let (resource_type, resource_amount) = *resource_costs.at(index);
                set!(
                    world, (ResourceCost { entity_id: resource_cost_id, index, resource_type, amount: resource_amount })
                );

                index += 1;
            };

            set!(
                world,
                (RoadConfig {
                    config_id: ROAD_CONFIG_ID, resource_cost_id, resource_cost_count: resource_costs.len(), speed_up_by
                })
            );
        }


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
        fn set_hyperstructure_config(ref world: IWorldDispatcher, resources_for_completion: Span<(u8, u128)>) {
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
}
