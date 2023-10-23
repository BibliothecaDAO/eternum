#[dojo::contract]
mod resource_systems {
    use eternum::alias::ID;
    use eternum::models::resources::{Resource, ResourceAllowance};
    use eternum::models::owner::Owner;
    use eternum::models::position::Position;
    use eternum::models::quantity::{Quantity, QuantityTrait};
    use eternum::models::capacity::Capacity;
    use eternum::models::config::WeightConfigImpl;

    use eternum::systems::resources::interface::IResourceSystems;

    use core::integer::BoundedInt;


    #[external(v0)]
    impl ResourceSystemsImpl of IResourceSystems<ContractState> {
        
        /// Approve an entity to spend resources.
        ///
        /// # Arguments
        ///
        /// * `entity_id` - The id of the entity approving the resources.
        /// * `approved_entity_id` - The id of the entity being approved.
        /// * `resources` - The resources to approve.  
        ///      
        fn approve(
            self: @ContractState, world: IWorldDispatcher, 
            entity_id: ID, approved_entity_id: ID, resources: Span<(u8, u128)>
        ) {
            
            assert(entity_id != approved_entity_id, 'self approval');
            assert(resources.len() != 0, 'no resource to approve');

            let entity_owner = get!(world, entity_id, Owner);
            assert(
                entity_owner.address == starknet::get_caller_address(), 
                    'not owner of entity id'
            );
            

            let mut resources = resources;
            loop {
                match resources.pop_front() {
                    Option::Some((resource_type, resource_amount)) => {
                        let (resource_type, resource_amount) = (*resource_type, *resource_amount);
                        set!(world, (
                            ResourceAllowance { 
                                owner_entity_id: entity_id,
                                approved_entity_id: approved_entity_id,
                                resource_type: resource_type,
                                amount: resource_amount
                            }
                        ));
                    },
                    Option::None(_) => {break;}
                };
            };
        }   

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

            InternalResourceSystemsImpl::transfer(
                world, sending_entity_id, receiving_entity_id, resources
            )
        }   




        /// Transfer approved resources from one entity to another.
        ///
        /// # Arguments
        ///
        /// * `approved_entity_id` - The id of the entity approved.
        /// * `owner_entity_id` - The id of the entity resource owner
        /// * `receiving_entity_id` - The id of the entity receiving resources.
        /// * `resources` - The resources to transfer.  
        ///      
        fn transfer_from(
            self: @ContractState, world: IWorldDispatcher, 
            approved_entity_id: ID, owner_entity_id: ID, 
            receiving_entity_id: ID, resources: Span<(u8, u128)>
        ) {
            
            assert(owner_entity_id != receiving_entity_id, 'transfer to owner');
            assert(resources.len() != 0, 'no resource to transfer');

            let approved_entity_owner = get!(world, approved_entity_id, Owner);
            assert(
                approved_entity_owner.address == starknet::get_caller_address(), 
                    'not owner of entity'
            );

            // update allowance
            let mut resources_clone = resources.clone();
            loop {
                match resources_clone.pop_front() {
                    Option::Some((resource_type, resource_amount)) => {
                        let (resource_type, resource_amount) = (*resource_type, *resource_amount);
                        let mut approved_allowance 
                            = get!(world, (owner_entity_id, approved_entity_id, resource_type), ResourceAllowance);
                        
                        assert(approved_allowance.amount >= resource_amount, 'insufficient approval');

                        if (approved_allowance.amount != BoundedInt::max()){ 
                            // spend allowance if they don't have infinite approval
                            approved_allowance.amount -= resource_amount;
                            set!(world, (approved_allowance));
                        }
                    },
                    Option::None(_) => {break;}
                };
            };


            InternalResourceSystemsImpl::transfer(
                world, owner_entity_id, receiving_entity_id, resources
            )
        }   
    }

    #[generate_trait]
    impl InternalResourceSystemsImpl of InternalResourceSystemsTrait {

        fn transfer(
            world: IWorldDispatcher, sending_entity_id: ID, 
            receiving_entity_id: ID, resources: Span<(u8, u128)>
        ) {

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