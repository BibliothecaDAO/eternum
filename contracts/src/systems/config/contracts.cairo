#[dojo::contract]
mod config_systems {
    use eternum::alias::ID;

    use eternum::models::combat::TownWatch;
    use eternum::models::labor_auction::LaborAuction;
    use eternum::models::config::{
        LaborCostResources, LaborCostAmount, LaborConfig, CapacityConfig, RoadConfig, SpeedConfig,
        TravelConfig, WeightConfig, WorldConfig, SoldierConfig, HealthConfig, AttackConfig,
        DefenceConfig, CombatConfig, LevelingConfig, RealmFreeMintConfig, LaborBuildingsConfig,
        LaborBuildingCost, MapExploreConfig, TickConfig, ProductionConfig, BankConfig
    };

    use eternum::systems::config::interface::{
        IWorldConfig, IWeightConfig, ICapacityConfig, ILaborConfig, ITransportConfig,
        IHyperstructureConfig, ICombatConfig, ILevelingConfig, IBankConfig, IRealmFreeMintConfig,
        IBuildingsConfig, IMapConfig, ITickConfig, IProductionConfig
    };

    use eternum::constants::{
        WORLD_CONFIG_ID, LABOR_CONFIG_ID, TRANSPORT_CONFIG_ID, ROAD_CONFIG_ID, SOLDIER_ENTITY_TYPE,
        COMBAT_CONFIG_ID, REALM_LEVELING_CONFIG_ID, HYPERSTRUCTURE_LEVELING_CONFIG_ID,
        REALM_FREE_MINT_CONFIG_ID, BUILDING_CONFIG_ID
    };

    use eternum::models::hyperstructure::HyperStructure;
    use eternum::models::resources::{ResourceCost, DetachedResource};
    use eternum::models::position::{Position, PositionTrait, Coord};
    use eternum::models::production::{ProductionInput, ProductionOutput};
    use eternum::models::bank::bank::{Bank};
    use debug::PrintTrait;


    fn assert_caller_is_admin(world: IWorldDispatcher) {
        let admin_address = get!(world, WORLD_CONFIG_ID, WorldConfig).admin_address;
        if admin_address != Zeroable::zero() {
            assert(starknet::get_caller_address() == admin_address, 'caller not admin');
        }
    }

    #[abi(embed_v0)]
    impl WorldConfigImpl of IWorldConfig<ContractState> {
        fn set_world_config(
            world: IWorldDispatcher,
            admin_address: starknet::ContractAddress,
            realm_l2_contract: starknet::ContractAddress
        ) {
            assert_caller_is_admin(world);

            set!(
                world,
                (WorldConfig { config_id: WORLD_CONFIG_ID, admin_address, realm_l2_contract })
            );
        }
    }

    #[abi(embed_v0)]
    impl RealmFreeMintConfigImpl of IRealmFreeMintConfig<ContractState> {
        fn set_mint_config(world: IWorldDispatcher, resources: Span<(u8, u128)>) {
            assert_caller_is_admin(world);

            let detached_resource_id = world.uuid().into();
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

            set!(
                world,
                (RealmFreeMintConfig {
                    config_id: REALM_FREE_MINT_CONFIG_ID,
                    detached_resource_id,
                    detached_resource_count
                })
            );
        }
    }


    #[abi(embed_v0)]
    impl MapConfigImpl of IMapConfig<ContractState> {
        fn set_exploration_config(
            world: IWorldDispatcher,
            wheat_burn_amount: u128,
            fish_burn_amount: u128,
            reward_resource_amount: u128
        ) {
            assert_caller_is_admin(world);

            set!(
                world,
                (MapExploreConfig {
                    config_id: WORLD_CONFIG_ID,
                    wheat_burn_amount,
                    fish_burn_amount,
                    reward_resource_amount
                })
            );
        }
    }


    #[abi(embed_v0)]
    impl CapacityConfigImpl of ICapacityConfig<ContractState> {
        fn set_capacity_config(world: IWorldDispatcher, entity_type: u128, weight_gram: u128) {
            assert_caller_is_admin(world);

            set!(
                world,
                (CapacityConfig {
                    config_id: WORLD_CONFIG_ID,
                    carry_capacity_config_id: entity_type,
                    entity_type,
                    weight_gram,
                })
            );
        }
    }

    #[abi(embed_v0)]
    impl WeightConfigImpl of IWeightConfig<ContractState> {
        fn set_weight_config(world: IWorldDispatcher, entity_type: u128, weight_gram: u128) {
            assert_caller_is_admin(world);

            set!(
                world,
                (WeightConfig {
                    config_id: WORLD_CONFIG_ID,
                    weight_config_id: entity_type,
                    entity_type,
                    weight_gram,
                })
            );
        }
    }

    #[abi(embed_v0)]
    impl TickConfigImpl of ITickConfig<ContractState> {
        fn set_tick_config(
            world: IWorldDispatcher, max_moves_per_tick: u8, tick_interval_in_seconds: u64
        ) {
            assert_caller_is_admin(world);

            set!(
                world,
                (TickConfig {
                    config_id: WORLD_CONFIG_ID, max_moves_per_tick, tick_interval_in_seconds
                })
            );
        }
    }


    #[abi(embed_v0)]
    impl CombatConfigImpl of ICombatConfig<ContractState> {
        fn set_combat_config(
            world: IWorldDispatcher,
            config_id: u128,
            stealing_trial_count: u32,
            wheat_burn_per_soldier: u128,
            fish_burn_per_soldier: u128,
        ) {
            assert_caller_is_admin(world);

            set!(
                world,
                (CombatConfig {
                    config_id, stealing_trial_count, wheat_burn_per_soldier, fish_burn_per_soldier,
                })
            );
        }


        fn set_soldier_config(
            world: IWorldDispatcher,
            resource_costs: Span<(u8, u128)>,
            wheat_burn_per_soldier: u128,
            fish_burn_per_soldier: u128
        ) {
            assert_caller_is_admin(world);

            let resource_cost_id = world.uuid().into();
            let mut index = 0;
            loop {
                if index == resource_costs.len() {
                    break;
                }
                let (resource_type, resource_amount) = *resource_costs.at(index);
                set!(
                    world,
                    (ResourceCost {
                        entity_id: resource_cost_id, index, resource_type, amount: resource_amount
                    })
                );

                index += 1;
            };
            set!(
                world,
                (SoldierConfig {
                    config_id: SOLDIER_ENTITY_TYPE,
                    resource_cost_id,
                    resource_cost_count: resource_costs.len(),
                    wheat_burn_per_soldier,
                    fish_burn_per_soldier
                })
            );
        }

        fn set_health_config(
            world: IWorldDispatcher,
            entity_type: u128,
            resource_costs: Span<(u8, u128)>,
            max_value: u128
        ) {
            let resource_cost_id = world.uuid().into();
            let mut index = 0;
            loop {
                if index == resource_costs.len() {
                    break;
                }
                let (resource_type, resource_amount) = *resource_costs.at(index);
                set!(
                    world,
                    (ResourceCost {
                        entity_id: resource_cost_id, index, resource_type, amount: resource_amount
                    })
                );

                index += 1;
            };

            set!(
                world,
                (HealthConfig {
                    entity_type,
                    resource_cost_id,
                    resource_cost_count: resource_costs.len(),
                    max_value
                })
            );
        }

        fn set_attack_config(world: IWorldDispatcher, entity_type: u128, max_value: u128) {
            assert_caller_is_admin(world);

            set!(world, (AttackConfig { entity_type, max_value }));
        }


        fn set_defence_config(world: IWorldDispatcher, entity_type: u128, max_value: u128) {
            assert_caller_is_admin(world);

            set!(world, (DefenceConfig { entity_type, max_value }));
        }
    }

    #[abi(embed_v0)]
    impl LevelingConfigImpl of ILevelingConfig<ContractState> {
        fn set_leveling_config(
            world: IWorldDispatcher,
            config_id: u128,
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

            let resource_1_cost_id = world.uuid().into();
            let mut index = 0;
            loop {
                if index == resource_1_costs.len() {
                    break;
                }
                let (resource_type, resource_amount) = *resource_1_costs.at(index);
                set!(
                    world,
                    (ResourceCost {
                        entity_id: resource_1_cost_id, index, resource_type, amount: resource_amount
                    })
                );

                index += 1;
            };

            let resource_2_cost_id = world.uuid().into();
            let mut index = 0;
            loop {
                if index == resource_2_costs.len() {
                    break;
                }
                let (resource_type, resource_amount) = *resource_2_costs.at(index);
                set!(
                    world,
                    (ResourceCost {
                        entity_id: resource_2_cost_id, index, resource_type, amount: resource_amount
                    })
                );

                index += 1;
            };

            let resource_3_cost_id = world.uuid().into();
            let mut index = 0;
            loop {
                if index == resource_3_costs.len() {
                    break;
                }
                let (resource_type, resource_amount) = *resource_3_costs.at(index);
                set!(
                    world,
                    (ResourceCost {
                        entity_id: resource_3_cost_id, index, resource_type, amount: resource_amount
                    })
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
    impl LaborConfigImpl of ILaborConfig<ContractState> {
        fn set_labor_cost_resources(
            world: IWorldDispatcher,
            resource_type_labor: felt252,
            resource_types_packed: u128,
            resource_types_count: u8
        ) {
            assert_caller_is_admin(world);

            // set cost of creating labor for resource id 1 
            // to only resource id 1 cost
            set!(
                world,
                (LaborCostResources {
                    resource_type_labor, resource_types_packed, resource_types_count
                })
            );
        }


        fn set_labor_cost_amount(
            world: IWorldDispatcher,
            resource_type_labor: felt252,
            resource_type_cost: felt252,
            resource_type_value: u128
        ) {
            assert_caller_is_admin(world);

            set!(
                world,
                (LaborCostAmount {
                    resource_type_labor, resource_type_cost, value: resource_type_value
                })
            );
        }


        fn set_labor_config(
            world: IWorldDispatcher,
            base_labor_units: u64,
            base_resources_per_cycle: u128,
            base_food_per_cycle: u128
        ) {
            assert_caller_is_admin(world);

            // set labor config
            set!(
                world,
                (LaborConfig {
                    config_id: LABOR_CONFIG_ID,
                    base_labor_units,
                    base_resources_per_cycle,
                    base_food_per_cycle
                })
            );
        }


        fn set_labor_auction(
            world: IWorldDispatcher,
            decay_constant: u128,
            per_time_unit: u128,
            price_update_interval: u128
        ) {
            assert_caller_is_admin(world);

            let start_time = starknet::get_block_timestamp();

            let mut zone: u8 = 1;

            loop {
                if zone > 10 {
                    break;
                }

                set!(
                    world,
                    (LaborAuction {
                        zone,
                        decay_constant_mag: decay_constant,
                        decay_constant_sign: false,
                        per_time_unit,
                        start_time,
                        sold: 0,
                        price_update_interval,
                    })
                );

                zone += 1;
            };
        }
    }

#[abi(embed_v0)]
impl ProductionConfigImpl of IProductionConfig<ContractState> {
    fn set_production_config(
        world: IWorldDispatcher, 
        resource_type: u8,
        amount: u128,
        mut cost: Span<(u8, u128)>
    ) {
        assert_caller_is_admin(world);

        let mut resource_production_config : ProductionConfig
            = get!(world, resource_type, ProductionConfig);
        resource_production_config.amount = amount;
    
        loop {
            match cost.pop_front() {
                Option::Some((input_resource_type, input_resource_amount)) => {
                    // update output resource's production input/material
                    set!(world, (
                        ProductionInput {
                            output_resource_type: resource_type,
                            index: resource_production_config.input_count.try_into().unwrap(),
                            input_resource_type: *input_resource_type,
                            input_resource_amount: *input_resource_amount
                        }
                    ));

                    resource_production_config.input_count += 1;

                    // update input resource's production output
                    let mut input_resource_production_config : ProductionConfig
                        = get!(world, *input_resource_type, ProductionConfig);
                    
                    set!(world, (
                        ProductionOutput {
                            input_resource_type: *input_resource_type,
                            index: input_resource_production_config.output_count.try_into().unwrap(),
                            output_resource_type: resource_type,
                        }
                    ));

                    input_resource_production_config.output_count += 1;
                    set!(world, (input_resource_production_config));
                },
                Option::None => {break;}
            }
        };

        set!(world, (resource_production_config));
    }
}


    #[abi(embed_v0)]
    impl TransportConfigImpl of ITransportConfig<ContractState> {
        fn set_road_config(
            world: IWorldDispatcher, resource_costs: Span<(u8, u128)>, speed_up_by: u64
        ) {
            assert_caller_is_admin(world);

            let resource_cost_id = world.uuid().into();
            let mut index = 0;
            loop {
                if index == resource_costs.len() {
                    break;
                }
                let (resource_type, resource_amount) = *resource_costs.at(index);
                set!(
                    world,
                    (ResourceCost {
                        entity_id: resource_cost_id, index, resource_type, amount: resource_amount
                    })
                );

                index += 1;
            };

            set!(
                world,
                (RoadConfig {
                    config_id: ROAD_CONFIG_ID,
                    resource_cost_id,
                    resource_cost_count: resource_costs.len(),
                    speed_up_by
                })
            );
        }


        fn set_speed_config(world: IWorldDispatcher, entity_type: u128, sec_per_km: u16) {
            assert_caller_is_admin(world);

            set!(
                world,
                (SpeedConfig {
                    config_id: WORLD_CONFIG_ID,
                    speed_config_id: entity_type,
                    entity_type,
                    sec_per_km,
                })
            );
        }


        fn set_travel_config(world: IWorldDispatcher, free_transport_per_city: u128) {
            assert_caller_is_admin(world);

            set!(world, (TravelConfig { config_id: TRANSPORT_CONFIG_ID, free_transport_per_city }));
        }
    }


    #[abi(embed_v0)]
    impl HyperstructureConfigImpl of IHyperstructureConfig<ContractState> {
        fn create_hyperstructure(
            world: IWorldDispatcher,
            hyperstructure_type: u8,
            coord: Coord,
            completion_cost: Span<(u8, u128)>,
        ) -> ID {
            assert_caller_is_admin(world);

            let hyperstructure_id: ID = world.uuid().into();
            let hyperstructure_town_watch_id = world.uuid().into();

            let completion_cost_id: ID = world.uuid().into();
            let completion_resource_count = completion_cost.len();
            let mut completion_cost = completion_cost;
            let mut index = 0;
            loop {
                match completion_cost.pop_front() {
                    Option::Some((
                        resource_type, resource_amount
                    )) => {
                        assert(*resource_amount > 0, 'amount must not be 0');

                        set!(
                            world,
                            (ResourceCost {
                                entity_id: completion_cost_id,
                                index,
                                resource_type: *resource_type,
                                amount: *resource_amount
                            })
                        );

                        index += 1;
                    },
                    Option::None => { break; }
                };
            };

            set!(
                world,
                (
                    HyperStructure {
                        entity_id: hyperstructure_id,
                        hyperstructure_type,
                        controlling_order: 0,
                        completed: false,
                        completion_cost_id,
                        completion_resource_count
                    },
                    Position { entity_id: hyperstructure_id, x: coord.x, y: coord.y },
                    TownWatch {
                        entity_id: hyperstructure_id, town_watch_id: hyperstructure_town_watch_id,
                    },
                    Position { entity_id: hyperstructure_town_watch_id, x: coord.x, y: coord.y },
                )
            );

            hyperstructure_id
        }
    }


    #[abi(embed_v0)]
    impl BankConfigImpl of IBankConfig<ContractState> {
        fn create_bank(
            self: @ContractState, world: IWorldDispatcher, coord: Coord, owner_fee_scaled: u128,
        ) -> ID {
            let bank_entity_id: ID = world.uuid().into();

            set!(
                world,
                (
                    Bank { entity_id: bank_entity_id, owner_fee_scaled, exists: true },
                    Position { entity_id: bank_entity_id, x: coord.x, y: coord.y }
                )
            );
            bank_entity_id
        }


        fn set_bank_config(
            self: @ContractState, world: IWorldDispatcher, lords_cost: u128, lp_fee_scaled: u128
        ) {
            set!(world, (BankConfig { config_id: WORLD_CONFIG_ID, lords_cost, lp_fee_scaled, }));
        }
    }

    #[abi(embed_v0)]
    impl BuildingsConfigImpl of IBuildingsConfig<ContractState> {
        fn set_labor_buildings_config(
            world: IWorldDispatcher,
            level_multiplier: u128,
            level_discount_mag: u128,
            resources_category_1: u128,
            resources_category_1_count: u8,
            resources_category_2: u128,
            resources_category_2_count: u8,
            resources_category_3: u128,
            resources_category_3_count: u8,
            resources_category_4: u128,
            resources_category_4_count: u8,
            building_category_1_resource_costs: Span<(u8, u128)>,
            building_category_2_resource_costs: Span<(u8, u128)>,
            building_category_3_resource_costs: Span<(u8, u128)>,
            building_category_4_resource_costs: Span<(u8, u128)>,
        ) {
            assert_caller_is_admin(world);

            // set the resources in each category
            set!(
                world,
                (
                    LaborBuildingsConfig {
                        config_id: BUILDING_CONFIG_ID,
                        level_multiplier,
                        level_discount_mag,
                        resources_category_1,
                        resources_category_1_count,
                        resources_category_2,
                        resources_category_2_count,
                        resources_category_3,
                        resources_category_3_count,
                        resources_category_4,
                        resources_category_4_count,
                    },
                )
            );

            let mut building_costs = building_category_1_resource_costs;
            let labor_category = 1;
            let resource_cost_id: u128 = world.uuid().into();
            let mut index = 0;

            set!(
                world,
                LaborBuildingCost {
                    config_id: BUILDING_CONFIG_ID,
                    labor_category: labor_category,
                    resource_cost_id: resource_cost_id,
                    resource_cost_count: building_costs.len(),
                }
            );

            loop {
                match building_costs.pop_front() {
                    Option::Some((
                        resource_type, resource_amount
                    )) => {
                        let (resource_type, resource_amount) = (*resource_type, *resource_amount);

                        set!(
                            world,
                            (ResourceCost {
                                entity_id: resource_cost_id,
                                index,
                                resource_type,
                                amount: resource_amount
                            })
                        );
                        index += 1;
                    },
                    Option::None => { break; }
                }
            };

            let mut building_costs = building_category_2_resource_costs;
            let labor_category = 2;
            let resource_cost_id: u128 = world.uuid().into();
            let mut index = 0;

            set!(
                world,
                LaborBuildingCost {
                    config_id: BUILDING_CONFIG_ID,
                    labor_category: labor_category,
                    resource_cost_id: resource_cost_id,
                    resource_cost_count: building_costs.len(),
                }
            );

            loop {
                match building_costs.pop_front() {
                    Option::Some((
                        resource_type, resource_amount
                    )) => {
                        let (resource_type, resource_amount) = (*resource_type, *resource_amount);

                        set!(
                            world,
                            (ResourceCost {
                                entity_id: resource_cost_id,
                                index,
                                resource_type,
                                amount: resource_amount
                            })
                        );
                        index += 1;
                    },
                    Option::None => { break; }
                }
            };

            let mut building_costs = building_category_3_resource_costs;
            let labor_category = 3;
            let resource_cost_id: u128 = world.uuid().into();
            let mut index = 0;

            set!(
                world,
                LaborBuildingCost {
                    config_id: BUILDING_CONFIG_ID,
                    labor_category: labor_category,
                    resource_cost_id: resource_cost_id,
                    resource_cost_count: building_costs.len(),
                }
            );

            loop {
                match building_costs.pop_front() {
                    Option::Some((
                        resource_type, resource_amount
                    )) => {
                        let (resource_type, resource_amount) = (*resource_type, *resource_amount);

                        set!(
                            world,
                            (ResourceCost {
                                entity_id: resource_cost_id,
                                index,
                                resource_type,
                                amount: resource_amount
                            })
                        );
                        index += 1;
                    },
                    Option::None => { break; }
                }
            };

            let mut building_costs = building_category_4_resource_costs;
            let labor_category = 4;
            let resource_cost_id: u128 = world.uuid().into();
            let mut index = 0;

            set!(
                world,
                LaborBuildingCost {
                    config_id: BUILDING_CONFIG_ID,
                    labor_category: labor_category,
                    resource_cost_id: resource_cost_id,
                    resource_cost_count: building_costs.len(),
                }
            );

            loop {
                match building_costs.pop_front() {
                    Option::Some((
                        resource_type, resource_amount
                    )) => {
                        let (resource_type, resource_amount) = (*resource_type, *resource_amount);

                        set!(
                            world,
                            (ResourceCost {
                                entity_id: resource_cost_id,
                                index,
                                resource_type,
                                amount: resource_amount
                            })
                        );
                        index += 1;
                    },
                    Option::None => { break; }
                }
            };
        }
    }
}
