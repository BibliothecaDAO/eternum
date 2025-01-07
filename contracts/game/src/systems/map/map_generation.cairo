use s0_eternum::alias::ID;
use s0_eternum::models::owner::{Owner, EntityOwner, OwnerTrait, EntityOwnerTrait};
use s0_eternum::models::position::{Coord, CoordTrait, Direction, Position};

#[starknet::interface]
trait IMapGenerationSystems<T> {
    fn discover_shards_mine(ref self: T, unit_entity_owner: EntityOwner, coord: Coord) -> bool;
    fn add_mercenaries_to_structure(ref self: T, randomness: u256, structure_entity_id: ID) -> ID;
}


#[dojo::contract]
mod map_generation_systems {
    use achievement::store::{Store, StoreTrait};
    use core::num::traits::Bounded;
    use core::option::OptionTrait;
    use core::traits::Into;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

    use dojo::world::{WorldStorage, WorldStorageTrait};
    use s0_eternum::alias::ID;
    use s0_eternum::constants::{WORLD_CONFIG_ID, DEFAULT_NS, TravelTypes, ResourceTypes, ARMY_ENTITY_TYPE};
    use s0_eternum::models::buildings::{BuildingCategory, Building, BuildingImpl};
    use s0_eternum::models::capacity::{CapacityCategory};
    use s0_eternum::models::combat::{
        Health, HealthTrait, Army, ArmyTrait, Troops, TroopsImpl, TroopsTrait, Protector, Protectee
    };
    use s0_eternum::models::config::{
        ProductionConfig, CapacityConfigCategory, MapConfig, MapConfigImpl, MercenariesConfig, TroopConfigImpl,
        TickImpl, TickTrait, TravelStaminaCostConfig, TravelFoodCostConfig, TravelFoodCostConfigImpl, VRFConfigImpl
    };
    use s0_eternum::models::map::Tile;
    use s0_eternum::models::movable::{Movable, ArrivalTime, MovableTrait, ArrivalTimeTrait};
    use s0_eternum::models::owner::{Owner, EntityOwner, OwnerTrait, EntityOwnerTrait};
    use s0_eternum::models::position::{Coord, CoordTrait, Direction, Position};
    use s0_eternum::models::production::ProductionDeadline;
    use s0_eternum::models::quantity::Quantity;
    use s0_eternum::models::realm::{Realm};
    use s0_eternum::models::resources::{
        Resource, ResourceCost, ResourceTrait, ResourceFoodImpl, ResourceTransferLock, RESOURCE_PRECISION
    };

    use s0_eternum::models::season::SeasonImpl;
    use s0_eternum::models::stamina::StaminaImpl;
    use s0_eternum::models::structure::{Structure, StructureCategory, StructureCount, StructureCountTrait};
    use s0_eternum::systems::combat::contracts::troop_systems::troop_systems::{InternalTroopImpl};
    use s0_eternum::systems::resources::contracts::resource_systems::resource_systems::{InternalResourceSystemsImpl};
    use s0_eternum::systems::transport::contracts::travel_systems::travel_systems::{InternalTravelSystemsImpl};
    use s0_eternum::utils::map::biomes::{Biome, get_biome};
    use s0_eternum::utils::random::{VRFImpl};
    use s0_eternum::utils::random;
    use s0_eternum::utils::tasks::index::{Task, TaskTrait};

    use starknet::ContractAddress;

    #[derive(Copy, Drop, Serde)]
    #[dojo::event(historical: true)]
    struct MapExplored {
        #[key]
        entity_id: ID,
        #[key]
        col: u32,
        #[key]
        row: u32,
        #[key]
        id: ID,
        entity_owner_id: ID,
        biome: Biome,
        reward: Span<(u8, u128)>,
        timestamp: u64,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event(historical: true)]
    struct FragmentMineDiscovered {
        #[key]
        entity_owner_id: ID,
        #[key]
        mine_entity_id: ID,
        #[key]
        production_deadline_tick: u64,
        discovered_at: u64
    }


    #[abi(embed_v0)]
    impl MapGenerationSystemsImpl of super::IMapGenerationSystems<ContractState> {
        fn discover_shards_mine(ref self: ContractState, unit_entity_owner: EntityOwner, coord: Coord) -> bool {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            InternalMapGenerationSystemsImpl::assert_caller_authorized(ref world);
            InternalMapGenerationSystemsImpl::discover_shards_mine(ref world, unit_entity_owner, coord)
        }


        fn add_mercenaries_to_structure(ref self: ContractState, randomness: u256, structure_entity_id: ID) -> ID {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            InternalMapGenerationSystemsImpl::assert_caller_authorized(ref world);
            InternalMapGenerationSystemsImpl::add_mercenaries_to_structure(ref world, randomness, structure_entity_id)
        }
    }

    #[generate_trait]
    pub impl InternalMapGenerationSystemsImpl of InternalMapGenerationSystemsTrait {
        fn assert_caller_authorized(ref world: WorldStorage) {
            let caller_address = starknet::get_caller_address();
            let (dev_bank_systems_address, _) = world.dns(@"dev_bank_systems").unwrap();
            let (map_systems_address, _) = world.dns(@"map_systems").unwrap();

            if !(caller_address == dev_bank_systems_address) && !(caller_address == map_systems_address) {
                panic!("caller must be dev_bank_systems or map_systems");
            }
        }

        fn add_mercenaries_to_structure(ref world: WorldStorage, randomness: u256, structure_entity_id: ID) -> ID {
            let mercenaries_config: MercenariesConfig = world.read_model(WORLD_CONFIG_ID);

            let army_entity_id = InternalTroopImpl::create_defensive_army(ref world, structure_entity_id);

            let mut seed: u256 = randomness;

            let random_knights_amount: u64 = random::random(
                seed, 1, mercenaries_config.knights_upper_bound.into() - mercenaries_config.knights_lower_bound.into()
            )
                .try_into()
                .unwrap()
                + mercenaries_config.knights_lower_bound;
            let random_paladins_amount: u64 = random::random(
                seed, 2, mercenaries_config.paladins_upper_bound.into() - mercenaries_config.paladins_lower_bound.into()
            )
                .try_into()
                .unwrap()
                + mercenaries_config.paladins_lower_bound;
            let random_crossbowmen_amount: u64 = random::random(
                seed,
                3,
                mercenaries_config.crossbowmen_upper_bound.into() - mercenaries_config.crossbowmen_lower_bound.into()
            )
                .try_into()
                .unwrap()
                + mercenaries_config.crossbowmen_lower_bound;

            let mut troops = Troops {
                knight_count: random_knights_amount,
                paladin_count: random_paladins_amount,
                crossbowman_count: random_crossbowmen_amount
            };

            troops.normalize_counts();

            InternalTroopImpl::add_troops_to_army(ref world, troops, army_entity_id);

            army_entity_id
        }

        fn add_production_deadline(ref world: WorldStorage, randomness: u256, mine_entity_id: ID) -> u64 {
            let earthen_shard_production_config: ProductionConfig = world.read_model(ResourceTypes::EARTHEN_SHARD);

            let earthen_shard_production_amount_per_tick: u128 = earthen_shard_production_config.amount;
            let random_multiplier: u128 = *random::choices(
                array![1, 2, 3, 4, 5, 6, 7, 8, 9, 10].span(),
                array![1, 1, 1, 1, 1, 1, 1, 1, 1, 1].span(),
                array![].span(),
                1,
                true,
                randomness
            )[0];
            let min_production_amount: u128 = 100_000 * RESOURCE_PRECISION;
            let actual_production_amount: u128 = min_production_amount * random_multiplier;
            let num_ticks_to_full_production: u64 = (actual_production_amount
                / earthen_shard_production_amount_per_tick)
                .try_into()
                .unwrap();
            let tick = TickImpl::get_default_tick_config(ref world);
            let deadline_tick = tick.current() + num_ticks_to_full_production;

            world.write_model(@ProductionDeadline { entity_id: mine_entity_id, deadline_tick });
            deadline_tick
        }


        fn discover_shards_mine(ref world: WorldStorage, unit_entity_owner: EntityOwner, coord: Coord) -> bool {
            let exploration_config: MapConfig = world.read_model(WORLD_CONFIG_ID);

            let owner: Owner = world.read_model(unit_entity_owner.entity_owner_id);
            let vrf_provider: ContractAddress = VRFConfigImpl::get_provider_address(ref world);
            let vrf_seed: u256 = VRFImpl::seed(owner.address, vrf_provider);
            let is_shards_mine: bool = *random::choices(
                array![true, false].span(),
                array![1000, exploration_config.shards_mines_fail_probability].span(),
                array![].span(),
                1,
                true,
                vrf_seed
            )[0];

            if is_shards_mine {
                let mine_structure_entity_id = Self::create_shard_mine_structure(ref world, coord);

                Self::add_mercenaries_to_structure(ref world, vrf_seed, mine_structure_entity_id);

                let mercenaries_config: MercenariesConfig = world.read_model(WORLD_CONFIG_ID);
                InternalResourceSystemsImpl::transfer(
                    ref world, 0, mine_structure_entity_id, mercenaries_config.rewards, 0, false, false
                );

                let deadline = Self::add_production_deadline(ref world, vrf_seed, mine_structure_entity_id);

                // create shards production building
                BuildingImpl::create(
                    ref world,
                    mine_structure_entity_id,
                    BuildingCategory::Resource,
                    Option::Some(ResourceTypes::EARTHEN_SHARD),
                    BuildingImpl::center(),
                );

                world
                    .emit_event(
                        @FragmentMineDiscovered {
                            entity_owner_id: unit_entity_owner.entity_owner_id,
                            mine_entity_id: mine_structure_entity_id,
                            production_deadline_tick: deadline,
                            discovered_at: starknet::get_block_timestamp(),
                        }
                    );
            }
            is_shards_mine
        }

        fn create_shard_mine_structure(ref world: WorldStorage, coord: Coord) -> ID {
            let entity_id: ID = world.dispatcher.uuid();
            world.write_model(@EntityOwner { entity_id: entity_id, entity_owner_id: entity_id });
            world
                .write_model(
                    @Structure {
                        entity_id: entity_id,
                        category: StructureCategory::FragmentMine,
                        created_at: starknet::get_block_timestamp()
                    }
                );
            world.write_model(@StructureCount { coord: coord, count: 1 });
            world.write_model(@CapacityCategory { entity_id: entity_id, category: CapacityConfigCategory::Structure });
            world.write_model(@Position { entity_id: entity_id, x: coord.x, y: coord.y });

            entity_id
        }
    }
}
