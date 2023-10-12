#[dojo::contract]
mod resource_systems {
    use eternum::alias::ID;
    use eternum::models::resources::Resource;
    use eternum::models::owner::Owner;
    use eternum::models::position::Position;
    use eternum::models::quantity::{Quantity, QuantityTrait};
    use eternum::models::capacity::Capacity;
    use eternum::models::config::WeightConfigImpl;

    use eternum::systems::resources::interface::IResourceSystems;

    #[external(v0)]
    impl ResourceSystemsImpl of IResourceSystems<ContractState> {
        /// Transfer resources from one entity to another.
        ///
        /// # Arguments
        ///
        /// * `sending_entity_id` - The id of the entity sending the resources.
        /// * `receiving_entity_id` - The id of the entity receiving the resources.
        /// * `resources` - The resources to transfer.  
        ///      
        fn transfer(
            self: @ContractState, world: IWorldDispatcher, sending_entity_id: ID, 
            receiving_entity_id: ID, resources: Span<(u8, u128)>
        ) {
            
            assert(sending_entity_id != receiving_entity_id, 'transfer to self');
            assert(resources.len() != 0, 'no resource to transfer');

            let sending_entity_owner = get!(world, sending_entity_id, Owner);
            assert(
                sending_entity_owner.address == starknet::get_caller_address(), 
                    'not owner of entity id'
            );
            
            // compare positions
            let sending_entity_position = get!(world, sending_entity_id, Position);
            let receiving_entity_position = get!(world, receiving_entity_id, Position);

            assert(receiving_entity_position.x !=  0, 'entity position mismatch');
            assert(receiving_entity_position.y != 0, 'entity position mismatch');

            assert(receiving_entity_position.x == sending_entity_position.x, 'entity position mismatch');
            assert(receiving_entity_position.y == sending_entity_position.y, 'entity position mismatch');
        
            // // get receiving entity's total capacity
            let receiving_entity_capacity = get!(world, receiving_entity_id, Capacity);
            let mut receiving_entity_total_capacity = 0;
            if receiving_entity_capacity.weight_gram != 0 {
                let receiving_entity_quantity = get!(world, receiving_entity_id, Quantity );
                receiving_entity_total_capacity = receiving_entity_capacity.weight_gram * receiving_entity_quantity.get_value();
            }


            let mut total_weight = 0;
            let mut resources = resources;
            loop {
                match resources.pop_front() {
                    Option::Some((resource_type, resource_amount)) => {
                        let (resource_type, resource_amount) = (*resource_type, *resource_amount);
                        assert(resource_amount != 0, 'resource transfer amount is 0');

                        let sending_entity_resource = get!(world, (sending_entity_id, resource_type) , Resource);  
                        assert(sending_entity_resource.balance >= resource_amount, 'insufficient balance');

                        let receiving_entity_resource = get!(world, (receiving_entity_id, resource_type) , Resource);
                        set!(world, (
                            Resource { 
                                entity_id: sending_entity_id, 
                                resource_type: resource_type, 
                                balance: sending_entity_resource.balance - resource_amount
                            },
                            Resource { 
                                entity_id: receiving_entity_id, 
                                resource_type: resource_type, 
                                balance: receiving_entity_resource.balance + resource_amount
                            }
                        ));
                        
                        total_weight += WeightConfigImpl::get_weight(
                            world, resource_type, resource_amount
                        );
                    },
                    Option::None(_) => {break;}
                };
            };

            // ensure receiving entity has adequate capacity
            if receiving_entity_total_capacity != 0 {
                assert(
                    receiving_entity_total_capacity >= total_weight, 
                        'capacity not enough'
                );
            }
        }   
    }
}