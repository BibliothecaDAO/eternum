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
    use eternum::constants::WORLD_CONFIG_ID;


    use starknet::ContractAddress;

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
        }

    }


}
