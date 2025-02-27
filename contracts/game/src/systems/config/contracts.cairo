use s1_eternum::alias::ID;
use s1_eternum::models::config::{
    BattleConfig, CapacityConfig, LaborBurnPrStrategy, MapConfig, ResourceBridgeConfig, ResourceBridgeFeeSplitConfig,
    ResourceBridgeWhitelistConfig, TradeConfig, TroopDamageConfig, TroopLimitConfig, TroopStaminaConfig,
};
use s1_eternum::models::resource::production::building::BuildingCategory;

#[starknet::interface]
pub trait IWorldConfig<T> {
    fn set_world_config(ref self: T, admin_address: starknet::ContractAddress);
}


#[starknet::interface]
pub trait ISeasonConfig<T> {
    fn set_season_config(
        ref self: T,
        season_pass_address: starknet::ContractAddress,
        realms_address: starknet::ContractAddress,
        lords_address: starknet::ContractAddress,
        start_at: u64,
    );

    fn set_season_bridge_config(ref self: T, close_after_end_seconds: u64);
}


#[starknet::interface]
pub trait IVRFConfig<T> {
    fn set_vrf_config(ref self: T, vrf_provider_address: starknet::ContractAddress);
}


#[starknet::interface]
pub trait IQuestConfig<T> {
    fn set_quest_reward_config(ref self: T, quest_id: ID, resources: Span<(u8, u128)>);
}

#[starknet::interface]
pub trait IStructureLevelConfig<T> {
    fn set_structure_max_level_config(ref self: T, realm_max: u8, village_max: u8);
    fn set_structure_level_config(ref self: T, level: u8, resources: Span<(u8, u128)>);
}

#[starknet::interface]
pub trait IWeightConfig<T> {
    fn set_resource_weight_config(ref self: T, resource_type: u8, weight_gram: u128);
}

#[starknet::interface]
pub trait ICapacityConfig<T> {
    fn set_capacity_config(ref self: T, capacity_config: CapacityConfig);
}

#[starknet::interface]
pub trait ITradeConfig<T> {
    fn set_trade_config(ref self: T, trade_config: TradeConfig);
}


#[starknet::interface]
pub trait ITickConfig<T> {
    fn set_tick_config(ref self: T, armies_tick_in_seconds: u64);
}

#[starknet::interface]
pub trait IStaminaConfig<T> {
    fn set_stamina_config(ref self: T, unit_type: u8, max_stamina: u16);
}


#[starknet::interface]
pub trait ITransportConfig<T> {
    fn set_donkey_speed_config(ref self: T, sec_per_km: u16);
}

#[starknet::interface]
pub trait IHyperstructureConfig<T> {
    fn set_hyperstructure_config(
        ref self: T,
        resources_for_completion: Span<(u8, u128, u128)>,
        time_between_shares_change: u64,
        points_per_cycle: u128,
        points_for_win: u128,
        points_on_completion: u128,
    );
}

#[starknet::interface]
pub trait IBankConfig<T> {
    fn set_bank_config(ref self: T, lp_fee_num: u32, lp_fee_denom: u32, owner_fee_num: u32, owner_fee_denom: u32);
}


#[starknet::interface]
pub trait IMapConfig<T> {
    fn set_map_config(ref self: T, map_config: MapConfig);
}


#[starknet::interface]
pub trait IProductionConfig<T> {
    fn set_production_config(
        ref self: T,
        resource_type: u8,
        amount_per_building_per_tick: u128,
        labor_burn_strategy: LaborBurnPrStrategy,
        predefined_resource_burn_cost: Span<(u8, u128)>,
    );
}


#[starknet::interface]
pub trait IBuildingConfig<T> {
    fn set_building_general_config(ref self: T, base_cost_percent_increase: u16);
    fn set_building_config(
        ref self: T,
        building_category: BuildingCategory,
        building_resource_type: u8,
        cost_of_building: Span<(u8, u128)>,
    );
}

#[starknet::interface]
pub trait IBuildingCategoryPopConfig<T> {
    fn set_building_category_pop_config(
        ref self: T, building_category: BuildingCategory, population: u32, capacity: u32,
    );
}

#[starknet::interface]
pub trait IPopulationConfig<T> {
    fn set_population_config(ref self: T, base_population: u32);
}


#[starknet::interface]
pub trait IResourceBridgeConfig<T> {
    fn set_resource_bridge_config(ref self: T, resource_bridge_config: ResourceBridgeConfig);
    fn set_resource_bridge_fee_split_config(ref self: T, res_bridge_fee_split_config: ResourceBridgeFeeSplitConfig);
    fn set_resource_bridge_whitelist_config(
        ref self: T, resource_bridge_whitelist_config: ResourceBridgeWhitelistConfig,
    );
}

#[starknet::interface]
pub trait ISettlementConfig<T> {
    fn set_settlement_config(
        ref self: T,
        center: u32,
        base_distance: u32,
        min_first_layer_distance: u32,
        points_placed: u32,
        current_layer: u32,
        current_side: u32,
        current_point_on_side: u32,
    );
}

#[starknet::interface]
pub trait ITroopConfig<T> {
    fn set_troop_config(
        ref self: T,
        troop_damage_config: TroopDamageConfig,
        troop_stamina_config: TroopStaminaConfig,
        troop_limit_config: TroopLimitConfig,
    );
}

#[starknet::interface]
pub trait IBattleConfig<T> {
    fn set_battle_config(ref self: T, battle_config: BattleConfig);
}

#[dojo::contract]
pub mod config_systems {
    use achievement::components::achievable::AchievableComponent;
    use core::num::traits::zero::Zero;

    use dojo::model::ModelStorage;
    use dojo::world::WorldStorage;
    use dojo::world::{IWorldDispatcherTrait};

    use s1_eternum::alias::ID;
    use s1_eternum::constants::DEFAULT_NS;

    use s1_eternum::constants::{ResourceTypes, WORLD_CONFIG_ID};

    use s1_eternum::models::config::{
        BankConfig, BattleConfig, BuildingCategoryPopConfig, BuildingConfig, BuildingGeneralConfig, CapacityConfig,
        HyperstructureConfig, HyperstructureResourceConfig, LaborBurnPrStrategy, MapConfig,
        MultipleResourceBurnPrStrategy, PopulationConfig, ProductionConfig, QuestRewardConfig, ResourceBridgeConfig,
        ResourceBridgeFeeSplitConfig, ResourceBridgeWhitelistConfig, SeasonAddressesConfig, SeasonBridgeConfig,
        SettlementConfig, SpeedConfig, StructureLevelConfig, StructureMaxLevelConfig, TickConfig, TradeConfig,
        TroopDamageConfig, TroopLimitConfig, TroopStaminaConfig, WeightConfig, WorldConfig, WorldConfigUtilImpl,
    };

    use s1_eternum::models::resource::production::building::{BuildingCategory};
    use s1_eternum::models::resource::resource::{ResourceList};
    use s1_eternum::models::season::{Season};
    use s1_eternum::utils::trophies::index::{TROPHY_COUNT, Trophy, TrophyTrait};


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

    fn dojo_init(self: @ContractState) {
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


    pub fn assert_caller_is_admin(world: WorldStorage) {
        let mut world_config: WorldConfig = world.read_model(WORLD_CONFIG_ID);

        // ENSURE
        // 1. ADMIN ADDRESS IS SET (IT MUST NEVER BE THE ZERO ADDRESS)
        // 2. CALLER IS ADMIN
        let admin_address = world_config.admin_address;
        assert!(starknet::get_caller_address() == admin_address, "caller not admin");
    }

    #[abi(embed_v0)]
    impl WorldConfigImpl of super::IWorldConfig<ContractState> {
        fn set_world_config(ref self: ContractState, admin_address: starknet::ContractAddress) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            // ensure admin address can't be set to zero
            assert!(admin_address.is_non_zero(), "admin address must be non zero");

            // ensure admin address is not already set
            let mut world_config: WorldConfig = world.read_model(WORLD_CONFIG_ID);
            if world_config.admin_address.is_non_zero() {
                assert_caller_is_admin(world);
            }

            world_config.admin_address = admin_address;
            world.write_model(@world_config);
        }
    }


    #[abi(embed_v0)]
    impl SeasonConfigImpl of super::ISeasonConfig<ContractState> {
        fn set_season_config(
            ref self: ContractState,
            season_pass_address: starknet::ContractAddress,
            realms_address: starknet::ContractAddress,
            lords_address: starknet::ContractAddress,
            start_at: u64,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            WorldConfigUtilImpl::set_member(
                ref world,
                selector!("season_addresses_config"),
                SeasonAddressesConfig { season_pass_address, realms_address, lords_address },
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

            WorldConfigUtilImpl::set_member(
                ref world, selector!("season_bridge_config"), SeasonBridgeConfig { close_after_end_seconds },
            );
        }
    }

    #[abi(embed_v0)]
    impl VRFConfigImpl of super::IVRFConfig<ContractState> {
        fn set_vrf_config(ref self: ContractState, vrf_provider_address: starknet::ContractAddress) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            WorldConfigUtilImpl::set_member(ref world, selector!("vrf_provider_address"), vrf_provider_address);
        }
    }

    #[abi(embed_v0)]
    impl QuestConfigImpl of super::IQuestConfig<ContractState> {
        fn set_quest_reward_config(ref self: ContractState, quest_id: ID, resources: Span<(u8, u128)>) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            // ensure quest id is greater than 0
            assert!(quest_id.is_non_zero(), "quest id must be greater than 0");

            let resource_list_id = world.dispatcher.uuid();
            let resource_list_count = resources.len();
            let mut resources = resources;
            let mut index = 0;
            loop {
                match resources.pop_front() {
                    Option::Some((
                        resource_type, resource_amount,
                    )) => {
                        let (resource_type, resource_amount) = (*resource_type, *resource_amount);
                        // ensure lords can't be minted
                        assert!(resource_type != ResourceTypes::LORDS, "lords can't be minted as part of quest");
                        assert(resource_amount > 0, 'amount must not be 0');

                        world
                            .write_model(
                                @ResourceList {
                                    entity_id: resource_list_id, index, resource_type, amount: resource_amount,
                                },
                            );

                        index += 1;
                    },
                    Option::None => { break; },
                };
            };

            world.write_model(@QuestRewardConfig { quest_id, resource_list_id, resource_list_count });
        }
    }


    #[abi(embed_v0)]
    impl MapConfigImpl of super::IMapConfig<ContractState> {
        fn set_map_config(ref self: ContractState, mut map_config: MapConfig) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            WorldConfigUtilImpl::set_member(ref world, selector!("map_config"), map_config);
        }
    }


    #[abi(embed_v0)]
    impl CapacityConfigImpl of super::ICapacityConfig<ContractState> {
        fn set_capacity_config(ref self: ContractState, capacity_config: CapacityConfig) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            WorldConfigUtilImpl::set_member(ref world, selector!("capacity_config"), capacity_config);
        }
    }


    #[abi(embed_v0)]
    impl WeightConfigImpl of super::IWeightConfig<ContractState> {
        fn set_resource_weight_config(ref self: ContractState, resource_type: u8, weight_gram: u128) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            world.write_model(@WeightConfig { resource_type, weight_gram });
        }
    }


    #[abi(embed_v0)]
    impl TickConfigImpl of super::ITickConfig<ContractState> {
        fn set_tick_config(ref self: ContractState, armies_tick_in_seconds: u64) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);
            let mut tick_config: TickConfig = WorldConfigUtilImpl::get_member(world, selector!("tick_config"));
            tick_config.armies_tick_in_seconds = armies_tick_in_seconds;
            WorldConfigUtilImpl::set_member(ref world, selector!("tick_config"), tick_config);
        }
    }


    #[abi(embed_v0)]
    impl ProductionConfigImpl of super::IProductionConfig<ContractState> {
        fn set_production_config(
            ref self: ContractState,
            resource_type: u8,
            amount_per_building_per_tick: u128,
            labor_burn_strategy: LaborBurnPrStrategy,
            predefined_resource_burn_cost: Span<(u8, u128)>,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            // save multiple resource burn cost
            let predefined_resource_burn_cost_id = world.dispatcher.uuid();
            for i in 0..predefined_resource_burn_cost.len() {
                let (resource_type, resource_amount) = *predefined_resource_burn_cost.at(i);
                world
                    .write_model(
                        @ResourceList {
                            entity_id: predefined_resource_burn_cost_id,
                            index: i,
                            resource_type,
                            amount: resource_amount,
                        },
                    );
            };

            // save production config
            let mut resource_production_config: ProductionConfig = world.read_model(resource_type);
            resource_production_config.amount_per_building_per_tick = amount_per_building_per_tick;
            resource_production_config.labor_burn_strategy = labor_burn_strategy;
            resource_production_config
                .multiple_resource_burn_strategy =
                    MultipleResourceBurnPrStrategy {
                        required_resources_id: predefined_resource_burn_cost_id,
                        required_resources_count: predefined_resource_burn_cost.len().try_into().unwrap(),
                    };
            world.write_model(@resource_production_config);
        }
    }

    #[abi(embed_v0)]
    impl TransportConfigImpl of super::ITransportConfig<ContractState> {
        fn set_donkey_speed_config(ref self: ContractState, sec_per_km: u16) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            let mut speed_config: SpeedConfig = SpeedConfig { donkey_sec_per_km: sec_per_km };
            WorldConfigUtilImpl::set_member(ref world, selector!("speed_config"), speed_config);
        }
    }

    #[abi(embed_v0)]
    impl BattleConfigImpl of super::IBattleConfig<ContractState> {
        fn set_battle_config(ref self: ContractState, battle_config: BattleConfig) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            WorldConfigUtilImpl::set_member(ref world, selector!("battle_config"), battle_config);
        }
    }

    #[abi(embed_v0)]
    impl HyperstructureConfigImpl of super::IHyperstructureConfig<ContractState> {
        fn set_hyperstructure_config(
            ref self: ContractState,
            mut resources_for_completion: Span<(u8, u128, u128)>,
            time_between_shares_change: u64,
            points_per_cycle: u128,
            points_for_win: u128,
            points_on_completion: u128,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            // save general hyperstructure config
            let hyperstructure_config = HyperstructureConfig {
                time_between_shares_change, points_per_cycle, points_for_win, points_on_completion,
            };
            WorldConfigUtilImpl::set_member(ref world, selector!("hyperstructure_config"), hyperstructure_config);

            // save resources needed for completion
            for resource in resources_for_completion {
                let (resource_tier, min_amount, max_amount) = (*resource);
                world.write_model(@HyperstructureResourceConfig { resource_tier, min_amount, max_amount });
            }
        }
    }


    #[abi(embed_v0)]
    impl BankConfigImpl of super::IBankConfig<ContractState> {
        fn set_bank_config(
            ref self: ContractState, lp_fee_num: u32, lp_fee_denom: u32, owner_fee_num: u32, owner_fee_denom: u32,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            let mut bank_config: BankConfig = WorldConfigUtilImpl::get_member(world, selector!("bank_config"));
            bank_config.lp_fee_num = lp_fee_num;
            bank_config.lp_fee_denom = lp_fee_denom;
            bank_config.owner_fee_num = owner_fee_num;
            bank_config.owner_fee_denom = owner_fee_denom;
            WorldConfigUtilImpl::set_member(ref world, selector!("bank_config"), bank_config);
        }
    }

    #[abi(embed_v0)]
    impl BuildingCategoryPopulationConfigImpl of super::IBuildingCategoryPopConfig<ContractState> {
        fn set_building_category_pop_config(
            ref self: ContractState, building_category: BuildingCategory, population: u32, capacity: u32,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            world.write_model(@BuildingCategoryPopConfig { building_category, population, capacity })
        }
    }

    #[abi(embed_v0)]
    impl TroopConfigImpl of super::ITroopConfig<ContractState> {
        fn set_troop_config(
            ref self: ContractState,
            mut troop_damage_config: TroopDamageConfig,
            mut troop_stamina_config: TroopStaminaConfig,
            mut troop_limit_config: TroopLimitConfig,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            WorldConfigUtilImpl::set_member(ref world, selector!("troop_limit_config"), troop_limit_config);
            WorldConfigUtilImpl::set_member(ref world, selector!("troop_stamina_config"), troop_stamina_config);
            WorldConfigUtilImpl::set_member(ref world, selector!("troop_damage_config"), troop_damage_config);
        }
    }


    #[abi(embed_v0)]
    impl PopulationConfigImpl of super::IPopulationConfig<ContractState> {
        fn set_population_config(ref self: ContractState, base_population: u32) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            WorldConfigUtilImpl::set_member(
                ref world, selector!("population_config"), PopulationConfig { base_population },
            );
        }
    }

    #[abi(embed_v0)]
    impl BuildingConfigImpl of super::IBuildingConfig<ContractState> {
        fn set_building_general_config(ref self: ContractState, base_cost_percent_increase: u16) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            WorldConfigUtilImpl::set_member(
                ref world, selector!("building_general_config"), BuildingGeneralConfig { base_cost_percent_increase },
            );
        }

        fn set_building_config(
            ref self: ContractState,
            building_category: BuildingCategory,
            building_resource_type: u8,
            cost_of_building: Span<(u8, u128)>,
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
                        @ResourceList { entity_id: resource_cost_id, index, resource_type, amount: resource_amount },
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
                        resource_cost_count: cost_of_building.len(),
                    },
                );
        }
    }


    #[abi(embed_v0)]
    impl IResourceBridgeConfig of super::IResourceBridgeConfig<ContractState> {
        fn set_resource_bridge_config(ref self: ContractState, mut resource_bridge_config: ResourceBridgeConfig) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            WorldConfigUtilImpl::set_member(ref world, selector!("resource_bridge_config"), resource_bridge_config);
        }

        fn set_resource_bridge_fee_split_config(
            ref self: ContractState, mut res_bridge_fee_split_config: ResourceBridgeFeeSplitConfig,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            WorldConfigUtilImpl::set_member(
                ref world, selector!("res_bridge_fee_split_config"), res_bridge_fee_split_config,
            );
        }

        fn set_resource_bridge_whitelist_config(
            ref self: ContractState, mut resource_bridge_whitelist_config: ResourceBridgeWhitelistConfig,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            // note: if we are whitelisting a NEW resource type, we WILL need to
            // update several functions related to resources in `s1_eternum::constants`
            // so the new resource type is recognized throughout the contract.

            assert!(resource_bridge_whitelist_config.resource_type > 0, "resource type should be non zero");
            assert!(
                resource_bridge_whitelist_config.resource_type <= 255,
                "the system only supports at most 255 resource types",
            );

            world.write_model(@resource_bridge_whitelist_config);
        }
    }

    #[abi(embed_v0)]
    impl StructureLevelConfigImpl of super::IStructureLevelConfig<ContractState> {
        fn set_structure_max_level_config(ref self: ContractState, realm_max: u8, village_max: u8) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            WorldConfigUtilImpl::set_member(
                ref world, selector!("structure_max_level_config"), StructureMaxLevelConfig { realm_max, village_max },
            );
        }

        fn set_structure_level_config(ref self: ContractState, level: u8, mut resources: Span<(u8, u128)>) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            let resource_list_id = world.dispatcher.uuid();
            let resource_list_count = resources.len();
            let mut index = 0;
            for (resource_type, resource_amount) in resources {
                let (resource_type, resource_amount) = (*resource_type, *resource_amount);
                assert(resource_amount > 0, 'amount must not be 0');

                world
                    .write_model(
                        @ResourceList { entity_id: resource_list_id, index, resource_type, amount: resource_amount },
                    );

                index += 1;
            };

            world
                .write_model(
                    @StructureLevelConfig {
                        level,
                        required_resources_id: resource_list_id.into(),
                        required_resource_count: resource_list_count.try_into().unwrap(),
                    },
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
            current_point_on_side: u32,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            WorldConfigUtilImpl::set_member(
                ref world,
                selector!("settlement_config"),
                SettlementConfig {
                    center,
                    base_distance,
                    min_first_layer_distance,
                    points_placed,
                    current_layer,
                    current_side,
                    current_point_on_side,
                },
            );
        }
    }

    #[abi(embed_v0)]
    impl ITradeConfig of super::ITradeConfig<ContractState> {
        fn set_trade_config(ref self: ContractState, trade_config: TradeConfig) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            WorldConfigUtilImpl::set_member(ref world, selector!("trade_config"), trade_config);
        }
    }
}
