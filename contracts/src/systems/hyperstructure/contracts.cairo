#[dojo::contract]
mod hyperstructure_systems {
    use eternum::alias::ID;
    use eternum::models::hyperstructure::HyperStructure;
    use eternum::models::resources::{Resource, ResourceCost};
    use eternum::models::owner::Owner;
    use eternum::models::position::{Coord, Position};

    use eternum::systems::hyperstructure::interface::IHyperstructureSystems;


    #[external(v0)]
    impl HyperstructureSystemsImpl of IHyperstructureSystems<ContractState> {

        /// Initializes a hyperstructure.
        ///
        /// This initializes a hyperstructure after it has been created 
        /// by an admin (see config_systems for how it is created). It first 
        /// ensures that the caller has the appropriate amount of resources
        /// to initialize the hyperstructure. Then it burns the resources
        /// from the caller and sets the hyperstructure as initialized, as
        /// well as adding it to the map by setting its position.
        ///
        /// # Arguments
        ///
        /// * `entity_id` - The entity id of the hyperstructure.
        /// * `hyperstructure_id` - The hyperstructure id.
        ///
        fn initialize(self: @ContractState, world: IWorldDispatcher, entity_id:ID, hyperstructure_id: ID) {   
            
            // todo@credence: use entity_id to check that realm is in order

            let entity_owner = get!(world, entity_id, Owner);
            assert(entity_owner.address == starknet::get_caller_address(), 'not owner of entity');


            let hyperstructure = get!(world, hyperstructure_id, HyperStructure);
            assert(hyperstructure.hyperstructure_type != 0, 'hyperstructure does not exist');
            assert(hyperstructure.initialized_at == 0, 'already initialized');

            let entity_position = get!(world, entity_id, Position);
            let entity_coord: Coord = entity_position.into();
            assert(entity_coord.x == hyperstructure.coord_x, 'wrong position');
            assert(entity_coord.y == hyperstructure.coord_y, 'wrong position');


            let mut index = 0;
            loop {
                if index == hyperstructure.initialization_resource_count {
                    break;
                }

                // burn initialization resources from entity

                let initialization_resource 
                    = get!(world, (hyperstructure.initialization_resource_id, index), ResourceCost);
                let entity_resource 
                    = get!(world, (entity_id, initialization_resource.resource_type), Resource);
                assert(entity_resource.balance >= initialization_resource.amount, 'not enough resources');
                set!(world, (
                    Resource { 
                        entity_id, 
                        resource_type: initialization_resource.resource_type, 
                        balance: entity_resource.balance - initialization_resource.amount
                    }
                ));

                index += 1;
            };

            // set hyperstructure as initialized
            // and add hyperstructure to the map

            set!(world, (
                HyperStructure {
                    entity_id: hyperstructure.entity_id,
                    hyperstructure_type: hyperstructure.hyperstructure_type,
                    initialization_resource_id: hyperstructure.initialization_resource_id,
                    initialization_resource_count: hyperstructure.initialization_resource_count,
                    construction_resource_id: hyperstructure.construction_resource_id,
                    construction_resource_count: hyperstructure.construction_resource_count,
                    initialized_at: starknet::get_block_timestamp(),
                    completed_at: hyperstructure.completed_at,
                    coord_x: hyperstructure.coord_x,
                    coord_y: hyperstructure.coord_y
                },
                Position {
                    entity_id: hyperstructure_id,
                    x: hyperstructure.coord_x,
                    y: hyperstructure.coord_y
                }
            ));

        }


        /// Completes a hyperstructure.
        ///
        /// it ensures that the caller has the appropriate amount of resources
        /// to complete the hyperstructure. Then it burns the resources
        /// from the caller and sets the hyperstructure as completed.
        ///
        /// # Arguments
        ///
        /// * `hyperstructure_id` - The hyperstructure id.
        ///
        fn complete(self: @ContractState, world: IWorldDispatcher, hyperstructure_id: ID) {
    
            let hyperstructure = get!(world, hyperstructure_id, HyperStructure);
            assert(hyperstructure.initialized_at != 0 , 'hyperstructure not initialized');
            assert(hyperstructure.completed_at == 0 , 'hyperstructure completed');

            let mut index = 0;
            loop {
                if index == hyperstructure.construction_resource_count {
                    break;
                }

                let construction_resource_cost = get!(world, (hyperstructure.construction_resource_id, index), ResourceCost);
                let hyperstructure_resource = get!(world, (hyperstructure_id, construction_resource_cost.resource_type), Resource);
                assert(hyperstructure_resource.balance >= construction_resource_cost.amount, 'not enough resources');
                
                index += 1;
            };

            set!(world, (
                HyperStructure {
                    entity_id: hyperstructure.entity_id,
                    hyperstructure_type: hyperstructure.hyperstructure_type,
                    initialization_resource_id: hyperstructure.initialization_resource_id,
                    initialization_resource_count: hyperstructure.initialization_resource_count,
                    construction_resource_id: hyperstructure.construction_resource_id,
                    construction_resource_count: hyperstructure.construction_resource_count,
                    initialized_at: hyperstructure.initialized_at,
                    completed_at: starknet::get_block_timestamp(),
                    coord_x: hyperstructure.coord_x,
                    coord_y: hyperstructure.coord_y
                }
            ));
        }  
    }
}