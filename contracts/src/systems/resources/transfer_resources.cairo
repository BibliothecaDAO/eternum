#[system]
mod TransferResources {
    use eternum::alias::ID;
    use eternum::models::resources::Resource;
    use eternum::models::owner::Owner;
    use eternum::models::position::Position;
    use eternum::models::quantity::{Quantity, QuantityTrait};
    use eternum::models::capacity::Capacity;
    use eternum::models::config::WeightConfigImpl;

    use dojo::world::Context;

    use core::traits::Into;
    use core::array::SpanTrait;

    fn execute(ctx: Context, sending_entity_id: ID, receiving_entity_id: ID, mut resources: Span<(u8, u128)>) {
        
        assert(sending_entity_id != receiving_entity_id, 'transfer to self');
        assert(resources.len() != 0, 'no resource to transfer');

        let sending_entity_owner = get!(ctx.world, sending_entity_id, Owner);
        assert(sending_entity_owner.address == ctx.origin, 'not owner of entity id');
        
        // compare positions
        let sending_entity_position = get!(ctx.world, sending_entity_id, Position);
        let receiving_entity_position = get!(ctx.world, receiving_entity_id, Position);

        assert(receiving_entity_position.x !=  0, 'entity position mismatch');
        assert(receiving_entity_position.y != 0, 'entity position mismatch');

        assert(receiving_entity_position.x == sending_entity_position.x, 'entity position mismatch');
        assert(receiving_entity_position.y == sending_entity_position.y, 'entity position mismatch');
       
        // get receiving entity's total capacity
        let receiving_entity_capacity = get!(ctx.world, receiving_entity_id, Capacity);
        let mut receiving_entity_total_capacity = 0;
        if receiving_entity_capacity.weight_gram != 0 {
            let receiving_entity_quantity = get!(ctx.world, receiving_entity_id, Quantity );
            receiving_entity_total_capacity = receiving_entity_capacity.weight_gram * receiving_entity_quantity.get_value();
        }


        let mut total_weight = 0;
        loop {
            match resources.pop_front() {
                Option::Some((resource_type, resource_amount)) => {
                    let (resource_type, resource_amount) = (*resource_type, *resource_amount);
                    assert(resource_amount != 0, 'resource transfer amount is 0');

                    let sending_entity_resource = get!(ctx.world, (sending_entity_id, resource_type) , Resource);  
                    assert(sending_entity_resource.balance >= resource_amount, 'insufficient balance');

                    let receiving_entity_resource = get!(ctx.world, (receiving_entity_id, resource_type) , Resource);
                    set!(ctx.world, (
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
                        ctx.world, resource_type, resource_amount
                    );
                },
                Option::None(_) => {break;}
            };
        };

        // ensure receiving entity has adequate capacity
        if receiving_entity_total_capacity != 0 {
            assert(receiving_entity_total_capacity >= total_weight, 'capacity not enough');
        }
    }   
}


#[cfg(test)]
mod tests {
    use eternum::models::resources::Resource;
    use eternum::models::owner::Owner;
    use eternum::models::position::Position;    
    use eternum::models::capacity::Capacity;    
    use eternum::models::quantity::Quantity;
    use eternum::models::config::WeightConfig;

    use eternum::constants::ResourceTypes;
    use eternum::constants::WORLD_CONFIG_ID;


    use eternum::utils::testing::spawn_eternum;

    use dojo::world::{ IWorldDispatcher, IWorldDispatcherTrait};
    use starknet::contract_address_const;

    use core::traits::Into;
    use core::serde::Serde;


    #[test]
    #[available_gas(30000000000000)]
    fn test_transfer_to_entity() {
        
        let world = spawn_eternum();
        // call as executor
        starknet::testing::set_contract_address(world.executor());
        
        
        let sending_entity_id = 11_u64;
        let sending_entity_position = Position { 
            x: 100_000, 
            y: 200_000, 
            entity_id: sending_entity_id.into()
        };

        set!(world, (sending_entity_position));
        set!(world, (
            Owner { 
                address: contract_address_const::<'sending_entity'>(), 
                entity_id: sending_entity_id.into()
            },
            Resource {
                entity_id: sending_entity_id.into(),
                resource_type: ResourceTypes::STONE,
                balance: 1000
            },
            Resource {
                entity_id: sending_entity_id.into(),
                resource_type: ResourceTypes::WOOD,
                balance: 1000
            }
        ));


        let receiving_entity_id = 12_u64;
        let receiving_entity_position = Position { 
            x: 100_000, 
            y: 200_000, 
            entity_id: receiving_entity_id.into()
        };
        set!(world, (receiving_entity_position));
        set!(world, (            
            Resource {
                entity_id: receiving_entity_id.into(),
                resource_type: ResourceTypes::STONE,
                balance: 1000
            },
            Resource {
                entity_id: receiving_entity_id.into(),
                resource_type: ResourceTypes::WOOD,
                balance: 1000
            }
        ));
        
        
        // transfer resources
        starknet::testing::set_contract_address(contract_address_const::<'sending_entity'>());

        let mut calldata = array![];
        Serde::serialize(@sending_entity_id, ref calldata);
        Serde::serialize(@receiving_entity_id, ref calldata);
        Serde::serialize(@array![
            (ResourceTypes::STONE, 400),
            (ResourceTypes::WOOD, 700),
        ].span(), ref calldata);
        world.execute('TransferResources', calldata);

        
        // verify resource balances
        let sending_entity_resource_stone = get!(world, (sending_entity_id, ResourceTypes::STONE), Resource);
        let sending_entity_resource_wood = get!(world, (sending_entity_id, ResourceTypes::WOOD), Resource);
        assert(sending_entity_resource_stone.balance == 600, 'stone balance mismatch');
        assert(sending_entity_resource_wood.balance == 300, 'wood balance mismatch');

        let receiving_entity_resource_stone = get!(world, (receiving_entity_id, ResourceTypes::STONE), Resource);
        let receiving_entity_resource_wood = get!(world, (receiving_entity_id, ResourceTypes::WOOD), Resource);
        assert(receiving_entity_resource_stone.balance == 1400, 'stone balance mismatch');
        assert(receiving_entity_resource_wood.balance == 1700, 'wood balance mismatch');
    }





    #[test]
    #[available_gas(30000000000000)]
    #[should_panic(expected: ('capacity not enough','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED' ))]
    fn test_not_enough_capacity() {
        
        let world = spawn_eternum();
        // call as executor
        starknet::testing::set_contract_address(world.executor());

        
        let sending_entity_id = 11_u64;
        let sending_entity_position = Position { 
            x: 100_000, 
            y: 200_000, 
            entity_id: sending_entity_id.into()
        };

        set!(world, (sending_entity_position));
        set!(world, (
            Owner { 
                address: contract_address_const::<'sending_entity'>(), 
                entity_id: sending_entity_id.into()
            },
            Resource {
                entity_id: sending_entity_id.into(),
                resource_type: ResourceTypes::STONE,
                balance: 1000
            },
            Resource {
                entity_id: sending_entity_id.into(),
                resource_type: ResourceTypes::WOOD,
                balance: 1000
            }
        ));


        let receiving_entity_id = 12_u64;
        let receiving_entity_position = Position { 
            x: 100_000, 
            y: 200_000, 
            entity_id: receiving_entity_id.into()
        };
        set!(world, (receiving_entity_position));
        set!(world, (            
            Resource {
                entity_id: receiving_entity_id.into(),
                resource_type: ResourceTypes::STONE,
                balance: 1000
            },
            Resource {
                entity_id: receiving_entity_id.into(),
                resource_type: ResourceTypes::WOOD,
                balance: 1000
            }
        ));


        // set receiving entity capacity, and weight config 
        set!(world, (
            Capacity { 
                entity_id: receiving_entity_id.into(), 
                weight_gram: 10_000 
            },
            WeightConfig {
                config_id: WORLD_CONFIG_ID,
                weight_config_id: ResourceTypes::STONE.into(),
                entity_type: ResourceTypes::STONE.into(),
                weight_gram: 10
            },
            WeightConfig {
                config_id: WORLD_CONFIG_ID,
                weight_config_id: ResourceTypes::WOOD.into(),
                entity_type: ResourceTypes::WOOD.into(),
                weight_gram: 10
            }
        ));
        
        
        // transfer resources 
        starknet::testing::set_contract_address(contract_address_const::<'sending_entity'>());

        let mut calldata = array![];
        Serde::serialize(@sending_entity_id, ref calldata);
        Serde::serialize(@receiving_entity_id, ref calldata);
        Serde::serialize(@array![
            (ResourceTypes::STONE, 400),
            (ResourceTypes::WOOD, 700),
        ].span(), ref calldata);

        // should fail because total capacity 
        // is 10,000 and total weight is 11,000
        world.execute('TransferResources', calldata);
    }





    #[test]
    #[available_gas(30000000000000)]
    #[should_panic(expected: ('not owner of entity id','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED' ))]
    fn test_not_owner() {
            
        let world = spawn_eternum();
            
        // transfer resources 
        starknet::testing::set_contract_address(contract_address_const::<'unknown'>());

        let mut calldata = array![];
        Serde::serialize(@1, ref calldata);
        Serde::serialize(@2, ref calldata);
        Serde::serialize(@array![
            (ResourceTypes::STONE, 400),
            (ResourceTypes::WOOD, 700),
        ].span(), ref calldata);

        // should fail because total capacity 
        // is 10,000 and total weight is 11,000
        world.execute('TransferResources', calldata);
    }




    #[test]
    #[available_gas(30000000000000)]
    #[should_panic(expected: ('entity position mismatch','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED' ))]
    fn test_entity_position_mismatch() {
         let world = spawn_eternum();
        // call as executor
        starknet::testing::set_contract_address(world.executor());
        
        
        let sending_entity_id = 11_u64;
        let sending_entity_position = Position { 
            x: 900_000, 
            y: 800_000, 
            entity_id: sending_entity_id.into()
        };

        set!(world, (sending_entity_position));
        set!(world, (
            Owner { 
                address: contract_address_const::<'sending_entity'>(), 
                entity_id: sending_entity_id.into()
            }
        ));


        let receiving_entity_id = 12_u64;
        let receiving_entity_position = Position { 
            x: 500_000, 
            y: 600_000, 
            entity_id: receiving_entity_id.into()
        };
        set!(world, (receiving_entity_position));
        
        
        // transfer resources
        starknet::testing::set_contract_address(contract_address_const::<'sending_entity'>());

        let mut calldata = array![];
        Serde::serialize(@sending_entity_id, ref calldata);
        Serde::serialize(@receiving_entity_id, ref calldata);
        Serde::serialize(@array![
            (ResourceTypes::STONE, 400),
            (ResourceTypes::WOOD, 700),
        ].span(), ref calldata);
        world.execute('TransferResources', calldata);
        
    }





    #[test]
    #[available_gas(30000000000000)]
    #[should_panic(expected: ('resource transfer amount is 0','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED' ))]
    fn test_zero_transfer_amount() {
        
        let world = spawn_eternum();
        // call as executor
        starknet::testing::set_contract_address(world.executor());

        
        let sending_entity_id = 11_u64;
        let sending_entity_position = Position { 
            x: 100_000, 
            y: 200_000, 
            entity_id: sending_entity_id.into()
        };

        set!(world, (sending_entity_position));
        set!(world, (
            Owner { 
                address: contract_address_const::<'sending_entity'>(), 
                entity_id: sending_entity_id.into()
            },
            Resource {
                entity_id: sending_entity_id.into(),
                resource_type: ResourceTypes::STONE,
                balance: 1000
            },
            Resource {
                entity_id: sending_entity_id.into(),
                resource_type: ResourceTypes::WOOD,
                balance: 1000
            }
        ));


        let receiving_entity_id = 12_u64;
        let receiving_entity_position = Position { 
            x: 100_000, 
            y: 200_000, 
            entity_id: receiving_entity_id.into()
        };
        set!(world, (receiving_entity_position));
        set!(world, (            
            Resource {
                entity_id: receiving_entity_id.into(),
                resource_type: ResourceTypes::STONE,
                balance: 1000
            },
            Resource {
                entity_id: receiving_entity_id.into(),
                resource_type: ResourceTypes::WOOD,
                balance: 1000
            }
        ));
        
        
        // transfer resources 
        starknet::testing::set_contract_address(contract_address_const::<'sending_entity'>());

        let mut calldata = array![];
        Serde::serialize(@sending_entity_id, ref calldata);
        Serde::serialize(@receiving_entity_id, ref calldata);
        Serde::serialize(@array![
            (ResourceTypes::STONE, 0),
            (ResourceTypes::WOOD, 700),
        ].span(), ref calldata);

        world.execute('TransferResources', calldata);
    }





    #[test]
    #[available_gas(30000000000000)]
    #[should_panic(expected: ('insufficient balance','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED' ))]
    fn test_insufficient_balance() {
        
        let world = spawn_eternum();
        // call as executor
        starknet::testing::set_contract_address(world.executor());

        
        let sending_entity_id = 11_u64;
        let sending_entity_position = Position { 
            x: 100_000, 
            y: 200_000, 
            entity_id: sending_entity_id.into()
        };

        set!(world, (sending_entity_position));
        set!(world, (
            Owner { 
                address: contract_address_const::<'sending_entity'>(), 
                entity_id: sending_entity_id.into()
            },
            Resource {
                entity_id: sending_entity_id.into(),
                resource_type: ResourceTypes::STONE,
                balance: 1000
            },
            Resource {
                entity_id: sending_entity_id.into(),
                resource_type: ResourceTypes::WOOD,
                balance: 1000
            }
        ));


        let receiving_entity_id = 12_u64;
        let receiving_entity_position = Position { 
            x: 100_000, 
            y: 200_000, 
            entity_id: receiving_entity_id.into()
        };
        set!(world, (receiving_entity_position));
        set!(world, (            
            Resource {
                entity_id: receiving_entity_id.into(),
                resource_type: ResourceTypes::STONE,
                balance: 1000
            },
            Resource {
                entity_id: receiving_entity_id.into(),
                resource_type: ResourceTypes::WOOD,
                balance: 1000
            }
        ));
        
        
        // transfer resources 
        starknet::testing::set_contract_address(contract_address_const::<'sending_entity'>());

        let mut calldata = array![];
        Serde::serialize(@sending_entity_id, ref calldata);
        Serde::serialize(@receiving_entity_id, ref calldata);
        Serde::serialize(@array![
            (ResourceTypes::STONE, 7700), // more than balance
            (ResourceTypes::WOOD, 700),
        ].span(), ref calldata);

        world.execute('TransferResources', calldata);
    }



    
}