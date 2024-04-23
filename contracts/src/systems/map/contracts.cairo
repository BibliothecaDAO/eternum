#[dojo::interface]
trait IMapSystems {
    fn explore(unit_id: u128, direction: eternum::models::position::Direction);
}

#[dojo::contract]
mod map_systems {
    use core::traits::Into;
    use eternum::alias::ID;
    use eternum::constants::ResourceTypes;
    use eternum::constants::{WORLD_CONFIG_ID, split_resources_and_probs};
    use eternum::models::combatV2::{Healthv2, Healthv2Trait};
    use eternum::models::config::{MapExploreConfig, LevelingConfig};
    use eternum::models::hyperstructure::HyperStructure;
    use eternum::models::inventory::Inventory;
    use eternum::models::level::{Level, LevelTrait};
    use eternum::models::map::Tile;
    use eternum::models::movable::{Movable, ArrivalTime, MovableTrait, ArrivalTimeTrait};
    use eternum::models::owner::{Owner, EntityOwner, OwnerTrait};
    use eternum::models::position::{Coord, CoordTrait, Direction, Position};
    use eternum::models::quantity::Quantity;
    use eternum::models::realm::{Realm};
    use eternum::models::resources::{Resource, ResourceCost, ResourceTrait, ResourceFoodImpl};
    use eternum::models::tick::{TickMove, TickMoveTrait};
    use eternum::systems::resources::contracts::resource_systems::{InternalResourceSystemsImpl};
    use eternum::systems::transport::contracts::travel_systems::travel_systems::{
        InternalTravelSystemsImpl
    };
    use eternum::utils::map::biomes::{Biome, get_biome};
    use eternum::utils::random;

    use starknet::ContractAddress;


    #[derive(Drop, starknet::Event)]
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

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        MapExplored: MapExplored,
    }


    // @DEV TODO: We can generalise this more...
    #[abi(embed_v0)]
    impl MapSystemsImpl of super::IMapSystems<ContractState> {
        fn explore(world: IWorldDispatcher, unit_id: u128, direction: Direction) {
            // check that caller owns unit
            get!(world, unit_id, Owner).assert_caller_owner();

            // ensure unit is alive
            get!(world, unit_id, Healthv2).assert_alive();

            // check that entity owner is a realm
            // TODO: Do we need this?
            let unit_entity_owner = get!(world, unit_id, EntityOwner);
            let unit_realm = get!(world, unit_entity_owner.entity_owner_id, Realm);
            assert(unit_realm.realm_id != 0, 'not owned by realm');

            // ensure unit can move
            get!(world, unit_id, Movable).assert_moveable();

            // ensure unit is not in transit
            get!(world, unit_id, ArrivalTime).assert_not_travelling();

            // // check that unit isn't carrying anything
            // let unit_inventory = get!(world, unit_id, Inventory);
            // assert(unit_inventory.items_count == 0, 'unit inventory not empty');

            // explore coordinate, pay food and mint reward
            let exploration_reward = InternalMapSystemsImpl::pay_food_and_get_explore_reward(
                world, unit_entity_owner.entity_owner_id
            );
            InternalResourceSystemsImpl::transfer(world, 0, unit_id, exploration_reward);

            let current_coord: Coord = get!(world, unit_id, Position).into();
            let next_coord = current_coord.neighbor(direction);
            InternalMapSystemsImpl::explore(world, unit_id, next_coord, exploration_reward);

            // travel to explored tile location 
            InternalTravelSystemsImpl::travel_hex(
                world, unit_id, current_coord, array![direction].span()
            );

            // max out the army's movement for that tick so 
            // they can no longer travel during tick
            let mut tick_move: TickMove = get!(world, unit_id, TickMove);
            tick_move.max_out(world);
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
                (
                    Event::MapExplored(
                        MapExplored {
                            entity_id: entity_id,
                            entity_owner_id: entity_owned_by.entity_owner_id,
                            col: tile.col,
                            row: tile.row,
                            biome: tile.biome,
                            reward
                        }
                    ),
                )
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
    }
}
