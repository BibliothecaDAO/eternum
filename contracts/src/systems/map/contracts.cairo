#[dojo::contract]
mod map_systems {
    use eternum::alias::ID;
    use eternum::models::resources::{Resource, ResourceCost, ResourceTrait, ResourceFoodImpl};
    use eternum::constants::ResourceTypes;
    use eternum::models::owner::{Owner};
    use eternum::models::hyperstructure::HyperStructure;
    use eternum::models::map::ExploredMap;
    use eternum::models::config::{LevelingConfig};
    use eternum::models::realm::{Realm};
    use eternum::models::level::{Level, LevelTrait};
    use eternum::models::config::MapExploreConfig;
    use eternum::systems::map::interface::IMapSystems;
    use eternum::utils::map::biomes::{Biome, get_biome};
    use eternum::utils::random;
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

        fn explore(
            self: @ContractState, world: IWorldDispatcher, 
            realm_entity_id: u128, col: u128, row: u128
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


            let mut explored_map: ExploredMap = get!(world, (col, row), ExploredMap);
            assert(explored_map.explored_at == 0, 'already explored');

            // set map position to explored

            explored_map.explored_by_id = realm_entity_id;
            explored_map.explored_at = starknet::get_block_timestamp();
            explored_map.biome = get_biome(col, row);
            explored_map.col = col;
            explored_map.row = row;

            set!(world, (explored_map));


            // burn food
            let explore_config: MapExploreConfig = get!(world, WORLD_CONFIG_ID, MapExploreConfig);
            ResourceFoodImpl::burn_food(
                world, realm_entity_id, 
                explore_config.wheat_burn_amount, explore_config.fish_burn_amount, check_balance: true
            );


            // mint one random resource
            let (resource_types, resources_probs) = split_resources_and_probs();
            let mint_resource_id: u8 = *random::choices(
                resource_types, resources_probs, 
                array![].span(), 1, true
            ).at(0);
            let mint_resource_amount: u128 = explore_config.random_mint_amount;

            let mut mint_resource 
                = get!(world, (realm_entity_id, mint_resource_id), Resource);
            mint_resource.add(world, mint_resource_amount);



            // emit explored event
            emit!(world,  MapExplored {
                    entity_id: realm_entity_id,
                    col,
                    row,
                    biome: explored_map.biome,
                    minted_resource_id: mint_resource_id,
                    minted_resource_amount: mint_resource_amount
                });
            

        }

    }


}
