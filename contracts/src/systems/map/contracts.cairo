use eternum::alias::ID;

#[dojo::interface]
trait IMapSystems {
    fn explore(ref world: IWorldDispatcher, unit_id: ID, direction: eternum::models::position::Direction);
}

#[dojo::contract]
mod map_systems {
    use core::num::traits::Bounded;
    use core::option::OptionTrait;
    use core::traits::Into;
    use eternum::alias::ID;
    use eternum::constants::{WORLD_CONFIG_ID, split_resources_and_probs, TravelTypes, ResourceTypes, ARMY_ENTITY_TYPE};
    use eternum::models::buildings::{BuildingCategory, Building, BuildingCustomImpl};
    use eternum::models::capacity::{CapacityCategory};
    use eternum::models::combat::{
        Health, HealthCustomTrait, Army, ArmyCustomTrait, Troops, TroopsImpl, TroopsTrait, Protector, Protectee
    };
    use eternum::models::config::{
        CapacityConfigCategory, MapExploreConfig, LevelingConfig, MercenariesConfig, TroopConfigCustomImpl
    };
    use eternum::models::level::{Level, LevelCustomTrait};
    use eternum::models::map::Tile;
    use eternum::models::movable::{Movable, ArrivalTime, MovableCustomTrait, ArrivalTimeCustomTrait};
    use eternum::models::owner::{Owner, EntityOwner, OwnerCustomTrait, EntityOwnerCustomTrait};
    use eternum::models::position::{Coord, CoordTrait, Direction, Position};
    use eternum::models::quantity::Quantity;
    use eternum::models::realm::{Realm};
    use eternum::models::resources::{
        Resource, ResourceCost, ResourceCustomTrait, ResourceFoodImpl, ResourceTransferLock
    };
    use eternum::models::stamina::StaminaCustomImpl;
    use eternum::models::structure::{Structure, StructureCategory, StructureCount, StructureCountCustomTrait};
    use eternum::systems::combat::contracts::combat_systems::{InternalCombatImpl};
    use eternum::systems::resources::contracts::resource_systems::{InternalResourceSystemsImpl};
    use eternum::systems::transport::contracts::travel_systems::travel_systems::{InternalTravelSystemsImpl};
    use eternum::utils::map::biomes::{Biome, get_biome};
    use eternum::utils::random;

    use starknet::ContractAddress;


    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    #[dojo::model]
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


    // @DEV TODO: We can generalise this more...
    #[abi(embed_v0)]
    impl MapSystemsImpl of super::IMapSystems<ContractState> {
        fn explore(ref world: IWorldDispatcher, unit_id: ID, direction: Direction) {
            // check that caller owns unit
            get!(world, unit_id, EntityOwner).assert_caller_owner(world);

            // ensure unit is alive
            get!(world, unit_id, Health).assert_alive("Army");

            // check that caller is owner of entityOwner
            let unit_entity_owner = get!(world, unit_id, EntityOwner);
            unit_entity_owner.assert_caller_owner(world);

            // ensure unit can move
            get!(world, unit_id, Movable).assert_moveable();

            // ensure unit is not in transit
            get!(world, unit_id, ArrivalTime).assert_not_travelling();

            StaminaCustomImpl::handle_stamina_costs(unit_id, TravelTypes::Explore, world);

            // explore coordinate, pay food and mint reward
            let exploration_reward = InternalMapSystemsImpl::pay_food_and_get_explore_reward(
                world, unit_entity_owner.entity_owner_id
            );

            InternalResourceSystemsImpl::transfer(world, 0, unit_id, exploration_reward, 0, false, false);

            let current_coord: Coord = get!(world, unit_id, Position).into();
            let next_coord = current_coord.neighbor(direction);
            InternalMapSystemsImpl::explore(world, unit_id, next_coord, exploration_reward);
            InternalMapSystemsImpl::discover_shards_mine(world, next_coord);

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
                    id: world.uuid(),
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

        fn pay_food_and_get_explore_reward(world: IWorldDispatcher, realm_entity_id: ID) -> Span<(u8, u128)> {
            let explore_config: MapExploreConfig = get!(world, WORLD_CONFIG_ID, MapExploreConfig);
            let mut wheat_pay_amount = explore_config.wheat_burn_amount;
            let mut fish_pay_amount = explore_config.fish_burn_amount;
            ResourceFoodImpl::pay(world, realm_entity_id, wheat_pay_amount, fish_pay_amount);

            let (resource_types, resources_probs) = split_resources_and_probs();
            let reward_resource_id: u8 = *random::choices(resource_types, resources_probs, array![].span(), 1, true)
                .at(0);
            let reward_resource_amount: u128 = explore_config.reward_resource_amount;
            array![(reward_resource_id, reward_resource_amount)].span()
        }

        fn discover_shards_mine(world: IWorldDispatcher, coord: Coord) -> bool {
            let exploration_config = get!(world, WORLD_CONFIG_ID, MapExploreConfig);

            let is_shards_mine: bool = *random::choices(
                array![true, false].span(),
                array![1000, exploration_config.shards_mines_fail_probability].span(),
                array![].span(),
                1,
                true
            )[0];

            if is_shards_mine {
                let mine_structure_entity_id = Self::create_shard_mine_structure(world, coord);

                Self::add_mercenaries_to_shard_mine(world, mine_structure_entity_id, coord);

                // create shards production building
                BuildingCustomImpl::create(
                    world,
                    mine_structure_entity_id,
                    BuildingCategory::Resource,
                    Option::Some(ResourceTypes::EARTHEN_SHARD),
                    BuildingCustomImpl::center(),
                );
            }
            is_shards_mine
        }

        fn create_shard_mine_structure(world: IWorldDispatcher, coord: Coord) -> ID {
            let entity_id: ID = world.uuid();
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

        fn add_mercenaries_to_shard_mine(world: IWorldDispatcher, mine_entity_id: ID, mine_coords: Coord) -> ID {
            let mercenaries_config = get!(world, WORLD_CONFIG_ID, MercenariesConfig);

            let troops = mercenaries_config.troops;

            let army_entity_id = InternalCombatImpl::create_defensive_army(
                world, mine_entity_id, starknet::contract_address_const::<0x0>()
            );

            InternalCombatImpl::add_troops_to_army(world, troops, army_entity_id);

            InternalResourceSystemsImpl::transfer(
                world, 0, mine_entity_id, mercenaries_config.rewards, 0, false, false
            );

            army_entity_id
        }
    }
}
