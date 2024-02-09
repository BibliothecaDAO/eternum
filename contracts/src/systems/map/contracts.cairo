#[dojo::contract]
mod map_systems {
    use eternum::alias::ID;
    use eternum::models::resources::{Resource, ResourceCost, ResourceTrait, ResourceFoodImpl};
    use eternum::constants::ResourceTypes;
    use eternum::models::owner::{Owner};
    use eternum::models::hyperstructure::HyperStructure;
    use eternum::models::map::Tile;
    use eternum::models::config::{LevelingConfig};
    use eternum::models::realm::{Realm};
    use eternum::models::level::{Level, LevelTrait};
    use eternum::models::config::MapExploreConfig;
    use eternum::systems::map::interface::IMapSystems;
    use eternum::utils::map::biomes::{Biome, get_biome};
    use eternum::utils::random;
    use eternum::models::position::{Coord, CoordTrait, Direction};
    use eternum::constants::{WORLD_CONFIG_ID, split_resources_and_probs};

    use starknet::ContractAddress;


    #[derive(Drop, starknet::Event)]
    struct MapExplored {
        #[key]
        entity_id: u128,
        #[key]
        col: u128,
        #[key]
        row: u128,
        biome: Biome,
        minted_resource_id: u8,
        minted_resource_amount: u128
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        MapExplored: MapExplored,
    }


    #[external(v0)]
    impl MapSystemsImpl of IMapSystems<ContractState> {
        /// Allows a player explore a tile in any direction 
        /// from a tile they have previously explored
        ///
        /// The first tile that would be explored would be the one 
        /// their realm sits on and it would be explored once the realm is 
        /// created
        ///
        fn explore(
            self: @ContractState, world: IWorldDispatcher, 
            realm_entity_id: u128, from_coord: Coord, direction: Direction
        ) {

            // check that entity is a realm
            let realm: Realm = get!(world, realm_entity_id, Realm);
            assert(realm.realm_id != 0, 'not a realm');

            // check realm ownership
            let caller: ContractAddress = starknet::get_caller_address();
            let realm_owner = get!(world, realm_entity_id, Owner);
            assert(
                realm_owner.address == caller,
                    'not realm owner'
            );

            // ensure that the from_tile is owned by caller

            let from_tile: Tile 
                = get!(world, (from_coord.x, from_coord.y), Tile);
            assert(from_tile.explored_at != 0, 'not explored');
            assert(from_tile.explored_by_id == realm_entity_id, 'not explored by caller');

            // get reward resource id and amount

            let explore_config: MapExploreConfig = get!(world, WORLD_CONFIG_ID, MapExploreConfig);
            let (resource_types, resources_probs) = split_resources_and_probs();
            let reward_resource_id: u8 
                = *random::choices(resource_types, resources_probs, array![].span(), 1, true).at(0);
            let reward_resource_amount: u128 = explore_config.random_mint_amount;

            // explore tile

            InternalMapSystemsImpl::explore(
                world, realm_entity_id, from_coord.neighbor(direction),
                reward_resource_id, reward_resource_amount
            );


            // pay for exploration by burning food

            ResourceFoodImpl::burn_food(
                world, realm_entity_id, 
                explore_config.wheat_burn_amount, explore_config.fish_burn_amount, check_balance: true
            );
        }

    }


    #[generate_trait]
    impl InternalMapSystemsImpl of InternalMapSystemsTrait {
        
        fn explore(
            world: IWorldDispatcher, explorer_id: u128, coord: Coord,
            reward_resource_id: u8, reward_resource_amount: u128
        ) -> Tile {

            let mut tile: Tile
                 = get!(world, (coord.x, coord.y), Tile);
            assert(tile.explored_at == 0, 'already explored');

            // set tile as explored
            tile.explored_by_id = explorer_id;
            tile.explored_at = starknet::get_block_timestamp();
            tile.biome = get_biome(coord.x, coord.y);
            tile.col = coord.x;
            tile.row = coord.y;

            set!(world, (tile));


            // mint reward for exploration
            if reward_resource_amount > 0 {
                let mut explorer_reward_resource = get!(world, (explorer_id, reward_resource_id), Resource);
                explorer_reward_resource.add(world, reward_resource_amount);
            }

            // emit explored event
            emit!(world,  MapExplored {
                entity_id: explorer_id,
                col: tile.col,
                row: tile.row,
                biome: tile.biome,
                minted_resource_id: reward_resource_id,
                minted_resource_amount: reward_resource_amount
            });




            tile
        }
    }



}
