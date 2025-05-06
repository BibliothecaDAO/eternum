use s1_eternum::models::config::{
    BattleConfig, CapacityConfig, HyperstructureConstructConfig, MapConfig, QuestConfig, ResourceBridgeConfig,
    ResourceBridgeFeeSplitConfig, ResourceBridgeWhitelistConfig, StructureCapacityConfig, TradeConfig,
    TroopDamageConfig, TroopLimitConfig, TroopStaminaConfig, VillageTokenConfig,
};
use s1_eternum::models::resource::production::building::BuildingCategory;

#[starknet::interface]
pub trait IWorldConfig<T> {
    fn set_world_config(ref self: T, admin_address: starknet::ContractAddress);
}
#[starknet::interface]
pub trait IMercenariesConfig<T> {
    fn set_mercenaries_name_config(ref self: T, name: felt252);
}

#[starknet::interface]
pub trait IWonderBonusConfig<T> {
    fn set_wonder_bonus_config(ref self: T, within_tile_distance: u8, bonus_percent_num: u128);
}

#[starknet::interface]
pub trait IAgentControllerConfig<T> {
    fn set_agent_config(
        ref self: T,
        agent_controller_address: starknet::ContractAddress,
        max_lifetime_count: u16,
        max_current_count: u16,
        min_spawn_lords_amount: u8,
        max_spawn_lords_amount: u8,
    );
}

#[starknet::interface]
pub trait IVillageTokenConfig<T> {
    fn set_village_token_config(ref self: T, village_token_config: VillageTokenConfig);
}

#[starknet::interface]
pub trait ISeasonConfig<T> {
    fn set_season_config(
        ref self: T,
        season_pass_address: starknet::ContractAddress,
        realms_address: starknet::ContractAddress,
        lords_address: starknet::ContractAddress,
        start_settling_at: u64,
        start_main_at: u64,
        end_grace_seconds: u32,
    );
}


#[starknet::interface]
pub trait IVRFConfig<T> {
    fn set_vrf_config(ref self: T, vrf_provider_address: starknet::ContractAddress);
}


#[starknet::interface]
pub trait IStartingResourcesConfig<T> {
    fn set_starting_resources_config(
        ref self: T, realm_starting_resources: Span<(u8, u128)>, village_starting_resources: Span<(u8, u128)>,
    );
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
    fn set_capacity_config(
        ref self: T, non_structure_capacity_config: CapacityConfig, structure_capacity_config: StructureCapacityConfig,
    );
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
        initialize_shards_amount: u128,
        construction_resources: Span<HyperstructureConstructConfig>,
        points_per_second: u128,
        points_for_win: u128,
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
pub trait IResourceFactoryConfig<T> {
    fn set_resource_factory_config(
        ref self: T,
        resource_type: u8,
        realm_output_per_second: u64,
        village_output_per_second: u64,
        labor_output_per_resource: u64,
        output_per_simple_input: u64,
        simple_input_list: Span<(u8, u128)>,
        output_per_complex_input: u64,
        complex_input_list: Span<(u8, u128)>,
    );
}


#[starknet::interface]
pub trait IBuildingConfig<T> {
    fn set_building_config(ref self: T, base_population: u32, base_cost_percent_increase: u16);
    fn set_building_category_config(
        ref self: T,
        building_category: BuildingCategory,
        complex_building_cost: Span<(u8, u128)>,
        simple_building_cost: Span<(u8, u128)>,
        population_cost: u8,
        capacity_grant: u8,
    );
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
    fn set_settlement_config(ref self: T, center: u32, base_distance: u32, subsequent_distance: u32);
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

#[starknet::interface]
pub trait IQuestConfig<T> {
    fn set_quest_config(ref self: T, quest_config: QuestConfig);
}

#[dojo::contract]
pub mod config_systems {
    use core::num::traits::zero::Zero;

    use dojo::model::ModelStorage;
    use dojo::world::WorldStorage;
    use dojo::world::{IWorldDispatcherTrait};

    use s1_eternum::constants::DEFAULT_NS;

    use s1_eternum::constants::{WORLD_CONFIG_ID};
    use s1_eternum::models::agent::AgentConfig;

    use s1_eternum::models::config::{
        AgentControllerConfig, BankConfig, BattleConfig, BuildingCategoryConfig, BuildingConfig, CapacityConfig,
        HyperstructureConfig, HyperstructureConstructConfig, HyperstructureCostConfig, MapConfig, QuestConfig,
        ResourceBridgeConfig, ResourceBridgeFeeSplitConfig, ResourceBridgeWhitelistConfig, ResourceFactoryConfig,
        ResourceRevBridgeWhtelistConfig, SeasonAddressesConfig, SeasonConfig, SettlementConfig, SpeedConfig,
        StartingResourcesConfig, StructureCapacityConfig, StructureLevelConfig, StructureMaxLevelConfig, TickConfig,
        TradeConfig, TroopDamageConfig, TroopLimitConfig, TroopStaminaConfig, VillageTokenConfig, WeightConfig,
        WonderProductionBonusConfig, WorldConfig, WorldConfigUtilImpl,
    };
    use s1_eternum::models::name::AddressName;
    use s1_eternum::models::resource::production::building::{BuildingCategory};
    use s1_eternum::models::resource::resource::{ResourceList};
    use s1_eternum::utils::achievements::index::AchievementTrait;

    // Constuctor

    fn dojo_init(self: @ContractState) {
        // [Event] Emit all Trophy events
        let mut world: WorldStorage = self.world(DEFAULT_NS());
        AchievementTrait::declare_all(world);
    }

    pub fn check_caller_is_admin(world: WorldStorage) -> bool {
        // ENSURE
        // 1. ADMIN ADDRESS IS SET (IT MUST NEVER BE THE ZERO ADDRESS)
        // 2. CALLER IS ADMIN
        let mut admin_address = WorldConfigUtilImpl::get_member(world, selector!("admin_address"));
        return starknet::get_caller_address() == admin_address;
    }

    pub fn assert_caller_is_admin(world: WorldStorage) {
        assert!(check_caller_is_admin(world), "caller not admin");
    }

    #[abi(embed_v0)]
    impl AgentControllerConfigImpl of super::IAgentControllerConfig<ContractState> {
        fn set_agent_config(
            ref self: ContractState,
            agent_controller_address: starknet::ContractAddress,
            max_lifetime_count: u16,
            max_current_count: u16,
            min_spawn_lords_amount: u8,
            max_spawn_lords_amount: u8,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            // set agent controller config
            let mut agent_controller_config = AgentControllerConfig { address: agent_controller_address };
            WorldConfigUtilImpl::set_member(ref world, selector!("agent_controller_config"), agent_controller_config);

            // set agent count config
            let agent_config = AgentConfig {
                id: WORLD_CONFIG_ID,
                max_lifetime_count,
                max_current_count,
                min_spawn_lords_amount,
                max_spawn_lords_amount,
            };
            world.write_model(@agent_config);
        }
    }

    #[abi(embed_v0)]
    impl VillageTokenConfigImpl of super::IVillageTokenConfig<ContractState> {
        fn set_village_token_config(ref self: ContractState, village_token_config: VillageTokenConfig) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            WorldConfigUtilImpl::set_member(ref world, selector!("village_pass_config"), village_token_config);
        }
    }


    #[abi(embed_v0)]
    impl WonderBonusConfigImpl of super::IWonderBonusConfig<ContractState> {
        fn set_wonder_bonus_config(ref self: ContractState, within_tile_distance: u8, bonus_percent_num: u128) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            let mut wonder_bonus_config = WonderProductionBonusConfig { within_tile_distance, bonus_percent_num };

            WorldConfigUtilImpl::set_member(
                ref world, selector!("wonder_production_bonus_config"), wonder_bonus_config,
            );
        }
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
    impl MercenariesConfigImpl of super::IMercenariesConfig<ContractState> {
        fn set_mercenaries_name_config(ref self: ContractState, name: felt252) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            // assert that name not set
            let mut address_name: AddressName = world.read_model(starknet::contract_address_const::<0>());
            address_name.name = name;
            world.write_model(@address_name);
        }
    }


    #[abi(embed_v0)]
    impl SeasonConfigImpl of super::ISeasonConfig<ContractState> {
        fn set_season_config(
            ref self: ContractState,
            season_pass_address: starknet::ContractAddress,
            realms_address: starknet::ContractAddress,
            lords_address: starknet::ContractAddress,
            start_settling_at: u64,
            start_main_at: u64,
            end_grace_seconds: u32,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            WorldConfigUtilImpl::set_member(
                ref world,
                selector!("season_addresses_config"),
                SeasonAddressesConfig { season_pass_address, realms_address, lords_address },
            );

            let mut season_config: SeasonConfig = WorldConfigUtilImpl::get_member(world, selector!("season_config"));
            if season_config.end_at.is_zero() {
                assert!(start_settling_at < start_main_at, "start_settling_at must be before start_main_at");
                season_config.start_settling_at = start_settling_at;
                season_config.start_main_at = start_main_at;
                season_config.end_grace_seconds = end_grace_seconds;
                WorldConfigUtilImpl::set_member(ref world, selector!("season_config"), season_config);
            }
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
    impl StartingResourcesConfigImpl of super::IStartingResourcesConfig<ContractState> {
        fn set_starting_resources_config(
            ref self: ContractState,
            realm_starting_resources: Span<(u8, u128)>,
            village_starting_resources: Span<(u8, u128)>,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            // add realm starting resources
            let realm_resources_list_id = world.dispatcher.uuid();
            for i in 0..realm_starting_resources.len() {
                let (resource_type, resource_amount) = *realm_starting_resources.at(i);
                world
                    .write_model(
                        @ResourceList {
                            entity_id: realm_resources_list_id, index: i, resource_type, amount: resource_amount,
                        },
                    );
            };
            let realm_starting_resources = StartingResourcesConfig {
                resources_list_id: realm_resources_list_id,
                resources_list_count: realm_starting_resources.len().try_into().unwrap(),
            };
            WorldConfigUtilImpl::set_member(
                ref world, selector!("realm_start_resources_config"), realm_starting_resources,
            );

            // add village starting resources
            let village_resources_list_id = world.dispatcher.uuid();
            for i in 0..village_starting_resources.len() {
                let (resource_type, resource_amount) = *village_starting_resources.at(i);
                world
                    .write_model(
                        @ResourceList {
                            entity_id: village_resources_list_id, index: i, resource_type, amount: resource_amount,
                        },
                    );
            };
            let village_starting_resources = StartingResourcesConfig {
                resources_list_id: village_resources_list_id,
                resources_list_count: village_starting_resources.len().try_into().unwrap(),
            };
            WorldConfigUtilImpl::set_member(
                ref world, selector!("village_start_resources_config"), village_starting_resources,
            );
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
        fn set_capacity_config(
            ref self: ContractState,
            non_structure_capacity_config: CapacityConfig,
            structure_capacity_config: StructureCapacityConfig,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            WorldConfigUtilImpl::set_member(ref world, selector!("capacity_config"), non_structure_capacity_config);
            WorldConfigUtilImpl::set_member(
                ref world, selector!("structure_capacity_config"), structure_capacity_config,
            );
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
    impl ResourceFactoryConfigImpl of super::IResourceFactoryConfig<ContractState> {
        fn set_resource_factory_config(
            ref self: ContractState,
            resource_type: u8,
            realm_output_per_second: u64,
            village_output_per_second: u64,
            labor_output_per_resource: u64,
            output_per_simple_input: u64,
            simple_input_list: Span<(u8, u128)>,
            output_per_complex_input: u64,
            complex_input_list: Span<(u8, u128)>,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            // save cost of converting labor into resource
            let simple_input_list_id = world.dispatcher.uuid();
            for i in 0..simple_input_list.len() {
                let (resource_type, resource_amount) = *simple_input_list.at(i);
                world
                    .write_model(
                        @ResourceList {
                            entity_id: simple_input_list_id, index: i, resource_type, amount: resource_amount,
                        },
                    );
            };

            // save cost of converting resource into labor
            let complex_input_list_id = world.dispatcher.uuid();
            for i in 0..complex_input_list.len() {
                let (resource_type, resource_amount) = *complex_input_list.at(i);
                world
                    .write_model(
                        @ResourceList {
                            entity_id: complex_input_list_id, index: i, resource_type, amount: resource_amount,
                        },
                    );
            };
            // save production config
            let mut resource_factory_config: ResourceFactoryConfig = Default::default();
            resource_factory_config.resource_type = resource_type;
            resource_factory_config.realm_output_per_second = realm_output_per_second;
            resource_factory_config.village_output_per_second = village_output_per_second;

            resource_factory_config.labor_output_per_resource = labor_output_per_resource;

            resource_factory_config.output_per_simple_input = output_per_simple_input;
            resource_factory_config.simple_input_list_id = simple_input_list_id;
            resource_factory_config.simple_input_list_count = simple_input_list.len().try_into().unwrap();

            resource_factory_config.output_per_complex_input = output_per_complex_input;
            resource_factory_config.complex_input_list_id = complex_input_list_id;
            resource_factory_config.complex_input_list_count = complex_input_list.len().try_into().unwrap();

            world.write_model(@resource_factory_config);
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
            initialize_shards_amount: u128,
            mut construction_resources: Span<HyperstructureConstructConfig>,
            points_per_second: u128,
            points_for_win: u128,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            // save resources needed for construction
            let mut construction_resources_ids = array![];
            for construction_resource in construction_resources {
                assert!(construction_resource.min_amount.is_non_zero(), "zero min amount");
                assert!(construction_resource.max_amount.is_non_zero(), "zero max amount");
                assert!(construction_resource.max_amount >= construction_resource.min_amount, "max less than min");
                construction_resources_ids.append(*construction_resource.resource_type);
                world.write_model(@(*construction_resource));
            };

            // save general hyperstructure config
            let hyperstructure_config = HyperstructureConfig {
                initialize_shards_amount, points_per_second, points_for_win,
            };
            WorldConfigUtilImpl::set_member(ref world, selector!("hyperstructure_config"), hyperstructure_config);

            // save hyperstructure construction cost resource types
            let hyperstructure_cost_config = HyperstructureCostConfig {
                construction_resources_ids: construction_resources_ids.span(),
            };
            WorldConfigUtilImpl::set_member(
                ref world, selector!("hyperstructure_cost_config"), hyperstructure_cost_config,
            );
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
    impl BuildingConfigImpl of super::IBuildingConfig<ContractState> {
        fn set_building_config(ref self: ContractState, base_population: u32, base_cost_percent_increase: u16) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            WorldConfigUtilImpl::set_member(
                ref world, selector!("building_config"), BuildingConfig { base_population, base_cost_percent_increase },
            );
        }

        fn set_building_category_config(
            ref self: ContractState,
            building_category: BuildingCategory,
            complex_building_cost: Span<(u8, u128)>,
            simple_building_cost: Span<(u8, u128)>,
            population_cost: u8,
            capacity_grant: u8,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            // set building cost when using complex
            let complex_building_cost_id = world.dispatcher.uuid();
            let mut index = 0;
            loop {
                if index == complex_building_cost.len() {
                    break;
                }
                let (resource_type, resource_amount) = *complex_building_cost.at(index);
                world
                    .write_model(
                        @ResourceList {
                            entity_id: complex_building_cost_id, index, resource_type, amount: resource_amount,
                        },
                    );

                index += 1;
            };

            // set building cost when using non complex
            let simple_building_cost_id = world.dispatcher.uuid();
            let mut index = 0;
            loop {
                if index == simple_building_cost.len() {
                    break;
                }
                let (resource_type, resource_amount) = *simple_building_cost.at(index);
                world
                    .write_model(
                        @ResourceList {
                            entity_id: simple_building_cost_id, index, resource_type, amount: resource_amount,
                        },
                    );
                index += 1;
            };

            world
                .write_model(
                    @BuildingCategoryConfig {
                        category: building_category.into(),
                        complex_erection_cost_id: complex_building_cost_id,
                        complex_erection_cost_count: complex_building_cost.len().try_into().unwrap(),
                        simple_erection_cost_id: simple_building_cost_id,
                        simple_erection_cost_count: simple_building_cost.len().try_into().unwrap(),
                        population_cost,
                        capacity_grant,
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

            // reverse whitelist config
            let mut resource_bridge_whitelist_reverse_config = ResourceRevBridgeWhtelistConfig {
                resource_type: resource_bridge_whitelist_config.resource_type,
                token: resource_bridge_whitelist_config.token,
            };
            world.write_model(@resource_bridge_whitelist_reverse_config);
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
        fn set_settlement_config(ref self: ContractState, center: u32, base_distance: u32, subsequent_distance: u32) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            WorldConfigUtilImpl::set_member(
                ref world,
                selector!("settlement_config"),
                SettlementConfig { center, base_distance, subsequent_distance },
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

    #[abi(embed_v0)]
    impl IQuestConfig of super::IQuestConfig<ContractState> {
        fn set_quest_config(ref self: ContractState, quest_config: QuestConfig) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            WorldConfigUtilImpl::set_member(ref world, selector!("quest_config"), quest_config);
        }
    }
}
