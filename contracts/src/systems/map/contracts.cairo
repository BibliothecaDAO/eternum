use eternum::alias::ID;

#[starknet::interface]
trait IMapSystems {
    fn explore(ref world: IWorldDispatcher, unit_id: ID, direction: eternum::models::position::Direction);
}

#[dojo::contract]
mod map_systems {
    use core::num::traits::Bounded;
    use core::option::OptionTrait;
    use core::traits::Into;
    use eternum::alias::ID;
    use eternum::constants::{WORLD_CONFIG_ID, TravelTypes, ResourceTypes, ARMY_ENTITY_TYPE};
    use eternum::models::buildings::{BuildingCategory, Building, BuildingCustomImpl};
    use eternum::models::capacity::{CapacityCategory};
    use eternum::models::combat::{
        Health, HealthCustomTrait, Army, ArmyCustomTrait, Troops, TroopsImpl, TroopsTrait, Protector, Protectee
    };
    use eternum::models::config::{
        ProductionConfig, CapacityConfigCategory, MapConfig, MapConfigImpl, MercenariesConfig, TroopConfigCustomImpl,
        TickImpl, TickTrait, TravelStaminaCostConfig, TravelFoodCostConfig, TravelFoodCostConfigImpl
    };
    use eternum::models::map::Tile;
    use eternum::models::movable::{Movable, ArrivalTime, MovableCustomTrait, ArrivalTimeCustomTrait};
    use eternum::models::owner::{Owner, EntityOwner, OwnerCustomTrait, EntityOwnerCustomTrait};
    use eternum::models::position::{Coord, CoordTrait, Direction, Position};
    use eternum::models::production::ProductionDeadline;
    use eternum::models::quantity::Quantity;
    use eternum::models::realm::{Realm};
    use eternum::models::resources::{
        Resource, ResourceCost, ResourceCustomTrait, ResourceFoodImpl, ResourceTransferLock, RESOURCE_PRECISION
    };

    use eternum::models::season::SeasonImpl;
    use eternum::models::stamina::StaminaCustomImpl;
    use eternum::models::structure::{Structure, StructureCategory, StructureCount, StructureCountCustomTrait};
    use eternum::systems::combat::contracts::troop_systems::troop_systems::{InternalTroopImpl};
    use eternum::systems::resources::contracts::resource_systems::resource_systems::{InternalResourceSystemsImpl};
    use eternum::systems::transport::contracts::travel_systems::travel_systems::{InternalTravelSystemsImpl};
    use eternum::utils::map::biomes::{Biome, get_biome};
    use eternum::utils::random;

    use starknet::ContractAddress;


    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
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
    #[dojo::event]
    struct FragmentMineDiscovered {
        #[key]
        entity_owner_id: ID,
        #[key]
        mine_entity_id: ID,
        #[key]
        production_deadline_tick: u64,
        discovered_at: u64
    }

    // @DEV TODO: We can generalise this more...
    #[abi(embed_v0)]
    impl MapSystemsImpl of super::IMapSystems<ContractState> {
        fn explore(ref world: IWorldDispatcher, unit_id: ID, direction: Direction) {
            SeasonImpl::assert_season_is_not_over(world);

            // check that caller owns unit
            get!(world, unit_id, EntityOwner).assert_caller_owner(world);

            // ensure unit is alive
            get!(world, unit_id, Health).assert_alive("Army");

            // check that caller is owner of entityOwner
            let unit_entity_owner = get!(world, unit_id, EntityOwner);
            unit_entity_owner.assert_caller_owner(world);

            let unit_quantity = get!(world, unit_id, Quantity);
            assert(unit_quantity.value.is_non_zero(), 'unit quantity is zero');

            // ensure unit can move
            get!(world, unit_id, Movable).assert_moveable();

            // ensure unit is not in transit
            get!(world, unit_id, ArrivalTime).assert_not_travelling();

            let stamina_cost = get!(world, (WORLD_CONFIG_ID, TravelTypes::EXPLORE), TravelStaminaCostConfig).cost;
            StaminaCustomImpl::handle_stamina_costs(unit_id, stamina_cost, world);

            let army = get!(world, unit_id, Army);

            // explore coordinate, pay food and mint reward
            TravelFoodCostConfigImpl::pay_exploration_cost(world, unit_entity_owner, army.troops);
            let exploration_reward = MapConfigImpl::random_reward(world);

            InternalResourceSystemsImpl::transfer(world, 0, unit_id, exploration_reward, 0, false, false);

            let current_coord: Coord = get!(world, unit_id, Position).into();
            let next_coord = current_coord.neighbor(direction);
            InternalMapSystemsImpl::explore(world, unit_id, next_coord, exploration_reward);
            InternalMapSystemsImpl::discover_shards_mine(world, unit_entity_owner, next_coord);

            // travel to explored tile location
            InternalTravelSystemsImpl::travel_hex(world, unit_id, current_coord, array![direction].span());
        }
    }


    #[generate_trait]
    pub impl InternalMapSystemsImpl of InternalMapSystemsTrait {
        fn explore(world: IWorldDispatcher, entity_id: ID, coord: Coord, reward: Span<(u8, u128)>) -> Tile {
            let mut tile: Tile = get!(world, (coord.x, coord.y), Tile);
            assert(tile.explored_at == 0, 'already explored');

            // set tile as explored
            tile.explored_by_id = entity_id;
            tile.explored_at = starknet::get_block_timestamp();
            tile.biome = get_biome(coord.x.into(), coord.y.into());
            set!(world, (tile));

            // emit explored event
            let entity_owned_by = get!(world, entity_id, EntityOwner);

            emit!(
                world,
                (MapExplored {
                    id: world.dispatcher.uuid(),
                    entity_id: entity_id,
                    entity_owner_id: entity_owned_by.entity_owner_id,
                    col: tile.col,
                    row: tile.row,
                    biome: tile.biome,
                    reward,
                    timestamp: starknet::get_block_timestamp()
                })
            );

            tile
        }

        fn discover_shards_mine(world: IWorldDispatcher, unit_entity_owner: EntityOwner, coord: Coord) -> bool {
            let exploration_config = get!(world, WORLD_CONFIG_ID, MapConfig);

            let is_shards_mine: bool = *random::choices(
                array![true, false].span(),
                array![1000, exploration_config.shards_mines_fail_probability].span(),
                array![].span(),
                1,
                true
            )[0];

            if is_shards_mine {
                let mine_structure_entity_id = Self::create_shard_mine_structure(world, coord);

                Self::add_mercenaries_to_structure(world, mine_structure_entity_id);

                let mercenaries_config = get!(world, WORLD_CONFIG_ID, MercenariesConfig);
                InternalResourceSystemsImpl::transfer(
                    world, 0, mine_structure_entity_id, mercenaries_config.rewards, 0, false, false
                );

                let deadline = Self::add_production_deadline(world, mine_structure_entity_id);

                // create shards production building
                BuildingCustomImpl::create(
                    world,
                    mine_structure_entity_id,
                    BuildingCategory::Resource,
                    Option::Some(ResourceTypes::EARTHEN_SHARD),
                    BuildingCustomImpl::center(),
                );

                emit!(
                    world,
                    FragmentMineDiscovered {
                        entity_owner_id: unit_entity_owner.entity_owner_id,
                        mine_entity_id: mine_structure_entity_id,
                        production_deadline_tick: deadline,
                        discovered_at: starknet::get_block_timestamp(),
                    }
                );
            }
            is_shards_mine
        }

        fn create_shard_mine_structure(world: IWorldDispatcher, coord: Coord) -> ID {
            let entity_id: ID = world.dispatcher.uuid();
            set!(
                world,
                (
                    EntityOwner { entity_id: entity_id, entity_owner_id: entity_id },
                    Structure {
                        entity_id: entity_id,
                        category: StructureCategory::FragmentMine,
                        created_at: starknet::get_block_timestamp()
                    },
                    StructureCount { coord: coord, count: 1 },
                    CapacityCategory { entity_id: entity_id, category: CapacityConfigCategory::Structure },
                    Position { entity_id: entity_id, x: coord.x, y: coord.y },
                )
            );
            entity_id
        }

        fn add_production_deadline(world: IWorldDispatcher, mine_entity_id: ID) -> u64 {
            let earthen_shard_production_config: ProductionConfig = get!(
                world, ResourceTypes::EARTHEN_SHARD, ProductionConfig
            );
            let earthen_shard_production_amount_per_tick: u128 = earthen_shard_production_config.amount;

            let random_multiplier: u128 = *random::choices(
                array![1, 2, 3, 4, 5, 6, 7, 8, 9, 10].span(),
                array![1, 1, 1, 1, 1, 1, 1, 1, 1, 1].span(),
                array![].span(),
                1,
                true
            )[0];
            let min_production_amount: u128 = 100_000 * RESOURCE_PRECISION;
            let actual_production_amount: u128 = min_production_amount * random_multiplier;
            let num_ticks_to_full_production: u64 = (actual_production_amount
                / earthen_shard_production_amount_per_tick)
                .try_into()
                .unwrap();
            let tick = TickImpl::get_default_tick_config(ref world);
            let deadline_tick = tick.current() + num_ticks_to_full_production;

            set!(world, (ProductionDeadline { entity_id: mine_entity_id, deadline_tick }));
            deadline_tick
        }

        fn add_mercenaries_to_structure(world: IWorldDispatcher, structure_entity_id: ID) -> ID {
            let mercenaries_config = get!(world, WORLD_CONFIG_ID, MercenariesConfig);

            let army_entity_id = InternalTroopImpl::create_defensive_army(
                world, structure_entity_id, starknet::contract_address_const::<0x0>()
            );

            let tx_info = starknet::get_tx_info();
            let salt_one: u256 = tx_info.transaction_hash.into();
            let salt_two: u256 = starknet::get_block_timestamp().into();
            let salt_three: u256 = tx_info.nonce.into();

            let random_knights_amount: u64 = random::random(
                salt_one.low,
                mercenaries_config.knights_upper_bound.into() - mercenaries_config.knights_lower_bound.into()
            )
                .try_into()
                .unwrap()
                + mercenaries_config.knights_lower_bound;
            let random_paladins_amount: u64 = random::random(
                salt_two.low,
                mercenaries_config.paladins_upper_bound.into() - mercenaries_config.paladins_lower_bound.into()
            )
                .try_into()
                .unwrap()
                + mercenaries_config.paladins_lower_bound;
            let random_crossbowmen_amount: u64 = random::random(
                salt_three.low,
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

            InternalTroopImpl::add_troops_to_army(world, troops, army_entity_id);

            army_entity_id
        }
    }
}
