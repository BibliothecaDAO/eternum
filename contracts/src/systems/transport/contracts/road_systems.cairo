#[dojo::interface]
trait IRoadSystems {
    fn create(
        entity_id: eternum::alias::ID,
        start_coord: eternum::models::position::Coord,
        end_coord: eternum::models::position::Coord,
        usage_count: usize
    );
}

#[dojo::contract]
mod road_systems {
    use eternum::constants::ROAD_CONFIG_ID;
    use eternum::models::config::RoadConfig;
    use eternum::models::owner::Owner;
    use eternum::models::position::{Coord};
    use eternum::models::resources::{Resource, ResourceImpl, ResourceCost};
    use eternum::models::road::{Road, RoadImpl};

    #[abi(embed_v0)]
    impl RoadSystemsImpl of super::IRoadSystems<ContractState> {
        /// Create a road between two coordinates on the map.
        ///
        /// Note: when you creat a road from A -> B, 
        ///       you also automatically create a road from B -> A. 
        ///
        /// # Arguments
        ///
        /// * `entity_id` - The id of the entity creating the road.
        /// * `start_coord` - The starting coordinate of the road.
        /// * `end_coord` - The ending coordinate of the road.
        /// * `usage_count` - The number of times the road can be used.
        fn create(
            world: IWorldDispatcher,
            entity_id: u128,
            start_coord: Coord,
            end_coord: Coord,
            usage_count: usize
        ) {
            // assert that entity is owned by caller
            let entity_owner = get!(world, entity_id, Owner);
            assert(
                entity_owner.address == starknet::get_caller_address(),
                'entity id not owned by caller'
            );

            let road = RoadImpl::get(world, start_coord, end_coord);
            assert(road.usage_count == 0, 'road already exists');

            let road_config = get!(world, ROAD_CONFIG_ID, RoadConfig);
            let mut index = 0;
            loop {
                if index == road_config.resource_cost_count {
                    break;
                }

                let resource_cost = get!(
                    world, (road_config.resource_cost_id, index), ResourceCost
                );
                let mut realm_resource = ResourceImpl::get(
                    world, (entity_id, resource_cost.resource_type)
                );

                assert(
                    realm_resource.balance >= resource_cost.amount * usage_count.into(),
                    'insufficient resources'
                );

                realm_resource.balance -= resource_cost.amount * usage_count.into();
                set!(world, (realm_resource));

                index += 1;
            };

            set!(
                world,
                (
                    Road {
                        start_coord_x: start_coord.x,
                        start_coord_y: start_coord.y,
                        end_coord_x: end_coord.x,
                        end_coord_y: end_coord.y,
                        usage_count
                    },
                )
            );
        }
    }
}
