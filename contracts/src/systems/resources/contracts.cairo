#[dojo::contract]
mod resource_systems {
    use eternum::alias::ID;
    use eternum::models::resources::{Resource, ResourceAllowance};
    use eternum::models::owner::Owner;
    use eternum::models::position::{Position, Coord};
    use eternum::models::quantity::{Quantity, QuantityTrait};
    use eternum::models::capacity::Capacity;
    use eternum::models::config::{WeightConfig, WeightConfigImpl};
    use eternum::models::resources::{Burden, BurdenResource};
    use eternum::models::movable::{ArrivalTime};

    
    use eternum::constants::{WORLD_CONFIG_ID};

    use eternum::systems::resources::interface::{IResourceSystems, IBurdenSystems};

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

    #[external(v0)]
    impl BurdenSystemsImpl of IBurdenSystems<ContractState> {

        /// Bundle resources into a burden.
        fn bundle(
            self: @ContractState, world: IWorldDispatcher,
            entity_id: ID, resource_types: Span<u8>, resource_amounts: Span<u128>
        ) -> Burden {

            let entity_owner = get!(world, entity_id, Owner);
            assert(entity_owner.address == starknet::get_caller_address(), 
                        'caller not owner'
            );

            let entity_position = get!(world, entity_id, Position);
            
            InternalBurdenImpl::bundle(
                world, entity_id,entity_position.into(), 
                resource_types, resource_amounts
                )
        }

        /// Unbundle resources from a burden. (This'll also be used to claim orders)
        fn unbundle(self: @ContractState, world: IWorldDispatcher, entity_id: ID, burden_id: ID) {

            let entity_owner = get!(world, entity_id, Owner);
            assert(entity_owner.address == starknet::get_caller_address(), 
                        'not entity owner'
            );

            // ensure burden has arrived
            let mut burden = get!(world, burden_id, Burden);
            let burden_position = get!(world, burden_id, Position);
            let entity_position = get!(world, entity_id, Position);

            assert(burden_position.x == entity_position.x, 'burden position mismatch');
            assert(burden_position.y == entity_position.y, 'burden position mismatch');
            
            let burden_arrival_time = get!(world, burden_id, ArrivalTime);
            assert(
                burden_arrival_time.arrives_at <= starknet::get_block_timestamp(), 
                        'burden has not arrived'
            );

            InternalBurdenImpl::unbundle(world, entity_id, burden)
        }
    }



    #[generate_trait]
    impl InternalBurdenImpl of InternalBurdenTrait {

        fn bundle( 
                world: IWorldDispatcher, depositor_id: ID, coord: Coord,
                resource_types: Span<u8>, resource_amounts: Span<u128>
            ) -> Burden {

            assert(resource_types.len() == resource_amounts.len(), 'length not equal');
            
            let burden_id = world.uuid().into();

            // transfer resources to burden
            let mut index = 0;
            let mut resources_weight = 0;
            loop {
                if index == resource_types.len() {
                    break ();
                }
                let resource_type = *resource_types[index];
                let resource_amount = *resource_amounts[index];
                set!(world,(
                        BurdenResource {
                            burden_id,
                            index,
                            resource_type,
                            resource_amount
                        }
                ));

                if depositor_id != 0 {
                    // decrease balance of entity
                    let mut entity_resource = get!(world, (depositor_id, resource_type), Resource);
                    assert(entity_resource.balance >= resource_amount, 'balance too low');
                    
                    entity_resource.balance -= resource_amount;
                    set!(world,(entity_resource));
                }

                // update resources total weight
                let resource_type_weight 
                    = get!(world, (WORLD_CONFIG_ID, resource_type), WeightConfig);
                resources_weight += resource_type_weight.weight_gram * resource_amount;
                index += 1;
            };

            let burden 
                = Burden {
                    burden_id,
                    depositor_id: depositor_id,
                    resources_count: resource_types.len(),
                    resources_weight: resources_weight
                };

            set!(world,(burden));
                
            set!(world,(
                    Position {
                        entity_id: burden_id,
                        x: coord.x,
                        y: coord.y
                    }
                )
            );

            burden
        }



        fn unbundle(world: IWorldDispatcher, receiving_entity_id: ID, mut burden: Burden) {
            
            assert(burden.resources_count != 0, 'does not exist');
            assert(burden.depositor_id != 0, 'no deposit');

            // return resources to the entity
            let mut index = 0;
            loop {
                if index == burden.resources_count {
                    break ();
                };

                let burden_resource 
                    = get!(world, (burden.burden_id, index), BurdenResource);
                
                let mut entity_resource 
                    = get!(world, (receiving_entity_id, burden_resource.resource_type), Resource);

                entity_resource.balance += burden_resource.resource_amount;
                set!(world,( entity_resource ));

                index += 1;
            };

            // update burden
            burden.resources_count = 0;
            burden.resources_weight = 0;

            set!(world,(burden));

        }


        /// Deposit resources to an existing burden. 
        /// check trade_systems for usage
        fn make_deposit(world: IWorldDispatcher, entity_id: ID, mut burden: Burden) {
            
            assert(burden.resources_count != 0, 'does not exist');
            assert(burden.depositor_id == 0, 'burden has deposit');

            let entity_owner = get!(world, entity_id, Owner);
            assert(entity_owner.address == starknet::get_caller_address(), 
                        'caller not owner'
            );


            // deduct resources from the entity
            let mut index = 0;
            loop {
                if index == burden.resources_count {
                    break ();
                };

                let burden_resource 
                    = get!(world, (burden.burden_id, index), BurdenResource);
                
                let mut entity_resource 
                    = get!(world, (entity_id, burden_resource.resource_type), Resource);
                assert(
                    entity_resource.balance >= burden_resource.resource_amount, 
                        'not enough balance'
                );
                
                entity_resource.balance -= burden_resource.resource_amount;
                set!(world,( entity_resource));

                index += 1;
            };

            // update burden
            burden.depositor_id = entity_id;
            set!(world,(burden));

        }
    }
}