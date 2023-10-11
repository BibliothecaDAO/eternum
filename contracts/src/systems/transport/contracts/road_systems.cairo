#[dojo::contract]
mod road_systems {
    use eternum::models::position::{Coord};
    use eternum::models::resources::Resource;
    use eternum::models::road::{Road, RoadImpl};
    use eternum::models::owner::Owner;
    use eternum::models::config::RoadConfig;

    use eternum::constants::ROAD_CONFIG_ID;

    use eternum::systems::transport::interface::road_systems_interface::{
        IRoadSystems
    };


    #[external(v0)]
    impl RoadSystemsImpl of IRoadSystems<ContractState> {

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
            self:@ContractState, world: IWorldDispatcher, 
            entity_id: u128, start_coord: Coord, end_coord: Coord, usage_count: usize
        ) {

            // assert that entity is owned by caller
            let entity_owner = get!(world, entity_id, Owner);
            assert(entity_owner.address == starknet::get_caller_address(), 'entity id not owned by caller');

            let road = RoadImpl::get(world, start_coord, end_coord);
            assert(road.usage_count == 0, 'road already exists');

            let road_config = get!(world, ROAD_CONFIG_ID, RoadConfig);
            let fee: u128 = road_config.fee_amount * usage_count.into();

            // ensure fee payment
            let entity_fee_resource = get!(world, (entity_id, road_config.fee_resource_type), Resource);
            assert(entity_fee_resource.balance >= fee, 'insufficient stone balance');
            
            set!(world, (
                Road {
                    start_coord_x: start_coord.x,
                    start_coord_y: start_coord.y,
                    end_coord_x: end_coord.x,
                    end_coord_y: end_coord.y,
                    usage_count
                },
                Resource {
                    entity_id: entity_fee_resource.entity_id,
                    resource_type: entity_fee_resource.resource_type,
                    balance: entity_fee_resource.balance -  fee
                }
            ));
        }

    }
}
