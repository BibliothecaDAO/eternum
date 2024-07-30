#[dojo::interface]
trait IMapSystems {
    fn explore(
        ref world: IWorldDispatcher, unit_id: u128, direction: eternum::models::position::Direction
    );
}

#[dojo::contract]
mod map_systems {
    use core::integer::BoundedInt;
    use core::option::OptionTrait;
    use core::traits::Into;
    use eternum::alias::ID;
    use eternum::constants::{
        WORLD_CONFIG_ID, split_resources_and_probs, TravelTypes, ResourceTypes, ARMY_ENTITY_TYPE
    };
    use eternum::models::buildings::{BuildingCategory, Building, BuildingImpl};
    use eternum::models::capacity::Capacity;
    use eternum::models::combat::{
        Health, HealthTrait, Army, ArmyTrait, Troops, TroopsImpl, TroopsTrait, Protector, Protectee
    };
    use eternum::models::config::{
        MapExploreConfig, LevelingConfig, MercenariesConfig, TroopConfigImpl, CapacityConfig,
        CapacityConfigImpl
    };
    use eternum::models::level::{Level, LevelTrait};
    use eternum::models::map::Tile;
    use eternum::models::movable::{Movable, ArrivalTime, MovableTrait, ArrivalTimeTrait};
    use eternum::models::owner::{Owner, EntityOwner, OwnerTrait, EntityOwnerTrait};
    use eternum::models::position::{Coord, CoordTrait, Direction, Position};
    use eternum::models::quantity::Quantity;
    use eternum::models::realm::{Realm};
    use eternum::models::resources::{
        Resource, ResourceCost, ResourceTrait, ResourceFoodImpl, ResourceTransferLock
    };
    use eternum::models::stamina::StaminaImpl;
    use eternum::models::structure::{
        Structure, StructureCategory, StructureCount, StructureCountTrait
    };
    use eternum::systems::combat::contracts::combat_systems::{InternalCombatImpl};
    use eternum::systems::resources::contracts::resource_systems::{InternalResourceSystemsImpl};
    use eternum::systems::transport::contracts::travel_systems::travel_systems::{
        InternalTravelSystemsImpl
    };
    use eternum::utils::map::biomes::{Biome, get_biome};
    use eternum::utils::random;

    use starknet::ContractAddress;


    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    struct MapExplored {
        #[key]
        entity_id: u128,
        entity_owner_id: u128,
        #[key]
        col: u128,
        #[key]
        row: u128,
        biome: Biome,
        reward: Span<(u8, u128)>
    }


    // @DEV TODO: We can generalise this more...
    #[abi(embed_v0)]
    impl MapSystemsImpl of super::IMapSystems<ContractState> {
        fn explore(ref world: IWorldDispatcher, unit_id: u128, direction: Direction) {
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

            StaminaImpl::handle_stamina_costs(unit_id, TravelTypes::Explore, world);

            // explore coordinate, pay food and mint reward
            let exploration_reward = InternalMapSystemsImpl::pay_food_and_get_explore_reward(
                world, unit_entity_owner.entity_owner_id
            );

            InternalResourceSystemsImpl::transfer(
                world, 0, unit_id, exploration_reward, 0, false, false
            );

            let current_coord: Coord = get!(world, unit_id, Position).into();
            let next_coord = current_coord.neighbor(direction);
            InternalMapSystemsImpl::explore(world, unit_id, next_coord, exploration_reward);
            InternalMapSystemsImpl::discover_shards_mine(world, next_coord);

            // travel to explored tile location 
            InternalTravelSystemsImpl::travel_hex(
                world, unit_id, current_coord, array![direction].span()
            );
        }
    }


    #[generate_trait]
    impl InternalMapSystemsImpl of InternalMapSystemsTrait {
        fn explore(
            world: IWorldDispatcher, entity_id: u128, coord: Coord, reward: Span<(u8, u128)>
        ) -> Tile {
            let mut tile: Tile = get!(world, (coord.x, coord.y), Tile);
            assert(tile.explored_at == 0, 'already explored');

            // set tile as explored
            tile.explored_by_id = entity_id;
            tile.explored_at = starknet::get_block_timestamp();
            tile.biome = get_biome(coord.x, coord.y);
            tile.col = coord.x;
            tile.row = coord.y;

            set!(world, (tile));

            // emit explored event
            let entity_owned_by = get!(world, entity_id, EntityOwner);

            emit!(
                world,
                (MapExplored {
                    entity_id: entity_id,
                    entity_owner_id: entity_owned_by.entity_owner_id,
                    col: tile.col,
                    row: tile.row,
                    biome: tile.biome,
                    reward
                })
            );

            tile
        }

        fn pay_food_and_get_explore_reward(
            world: IWorldDispatcher, realm_entity_id: u128
        ) -> Span<(u8, u128)> {
            let explore_config: MapExploreConfig = get!(world, WORLD_CONFIG_ID, MapExploreConfig);
            let mut wheat_pay_amount = explore_config.wheat_burn_amount;
            let mut fish_pay_amount = explore_config.fish_burn_amount;
            ResourceFoodImpl::pay(world, realm_entity_id, wheat_pay_amount, fish_pay_amount);

            let (resource_types, resources_probs) = split_resources_and_probs();
            let reward_resource_id: u8 = *random::choices(
                resource_types, resources_probs, array![].span(), 1, true
            )
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
                BuildingImpl::create(
                    world,
                    mine_structure_entity_id,
                    BuildingCategory::Resource,
                    Option::Some(ResourceTypes::EARTHEN_SHARD),
                    BuildingImpl::center(),
                );
            }
            is_shards_mine
        }

        fn create_shard_mine_structure(world: IWorldDispatcher, coord: Coord) -> u128 {
            let entity_id: u128 = world.uuid().into();
            set!(
                world,
                (
                    EntityOwner { entity_id: entity_id, entity_owner_id: entity_id },
                    Structure { entity_id: entity_id, category: StructureCategory::FragmentMine },
                    StructureCount { coord: coord, count: 1 },
                    Position { entity_id: entity_id, x: coord.x, y: coord.y },
                )
            );
            entity_id
        }

        fn add_mercenaries_to_shard_mine(
            world: IWorldDispatcher, mine_entity_id: u128, mine_coords: Coord
        ) -> u128 {
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
