mod resource_systems_tests {
    use eternum::models::resources::Resource;
    use eternum::models::owner::Owner;
    use eternum::models::position::Position;    
    use eternum::models::capacity::Capacity;    
    use eternum::models::quantity::Quantity;
    use eternum::models::config::WeightConfig;

    use eternum::constants::ResourceTypes;
    use eternum::constants::WORLD_CONFIG_ID;

    use eternum::systems::resources::contracts::resource_systems;
    use eternum::systems::resources::interface::{
        IResourceSystemsDispatcher, 
        IResourceSystemsDispatcherTrait
    };


    use eternum::utils::testing::{spawn_eternum, deploy_system};

    use dojo::world::{ IWorldDispatcher, IWorldDispatcherTrait};
    use starknet::contract_address_const;

    use core::traits::Into;


    fn setup() -> (IWorldDispatcher, IResourceSystemsDispatcher) {
        let world = spawn_eternum();

        let resource_systems_address 
            = deploy_system(resource_systems::TEST_CLASS_HASH);

        let resource_systems_dispatcher = IResourceSystemsDispatcher {
            contract_address: resource_systems_address
        };

        (world, resource_systems_dispatcher)
    }



    #[test]
    #[available_gas(30000000000000)]
    fn test_transfer_to_entity() {

        let (world, resource_systems_dispatcher) = setup();
        
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

        resource_systems_dispatcher.transfer(
            world, 
            sending_entity_id.into(), 
            receiving_entity_id.into(), 
            array![
                (ResourceTypes::STONE, 400),
                (ResourceTypes::WOOD, 700),
            ].span()
        );


        
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
    #[should_panic(expected: ('capacity not enough','ENTRYPOINT_FAILED' ))]
    fn test_not_enough_capacity() {
        
        let (world, resource_systems_dispatcher) = setup();

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

       
        // should fail because total capacity 
        // is 10,000 and total weight is 11,000 
        resource_systems_dispatcher.transfer(
            world, 
            sending_entity_id.into(), 
            receiving_entity_id.into(), 
            array![
                (ResourceTypes::STONE, 400),
                (ResourceTypes::WOOD, 700),
            ].span()
        );


    }





    #[test]
    #[available_gas(30000000000000)]
    #[should_panic(expected: ('not owner of entity id','ENTRYPOINT_FAILED' ))]
    fn test_not_owner() {
            
        let (world, resource_systems_dispatcher) = setup();
            
        // transfer resources 
        starknet::testing::set_contract_address(contract_address_const::<'unknown'>());

        resource_systems_dispatcher.transfer(
            world, 
            1, 
            2, 
            array![
                (ResourceTypes::STONE, 400),
                (ResourceTypes::WOOD, 700),
            ].span()
        );
    }




    #[test]
    #[available_gas(30000000000000)]
    #[should_panic(expected: ('entity position mismatch','ENTRYPOINT_FAILED' ))]
    fn test_entity_position_mismatch() {
        let (world, resource_systems_dispatcher) = setup();

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

        resource_systems_dispatcher.transfer(
            world, 
            sending_entity_id.into(), 
            receiving_entity_id.into(), 
            array![
                (ResourceTypes::STONE, 400),
                (ResourceTypes::WOOD, 700),
            ].span()
        );
        
    }





    #[test]
    #[available_gas(30000000000000)]
    #[should_panic(expected: ('resource transfer amount is 0','ENTRYPOINT_FAILED' ))]
    fn test_zero_transfer_amount() {
        
        let (world, resource_systems_dispatcher) = setup();

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
        resource_systems_dispatcher.transfer(
            world, 
            sending_entity_id.into(), 
            receiving_entity_id.into(), 
            array![
                (ResourceTypes::STONE, 0),
                (ResourceTypes::WOOD, 700),
            ].span()
        );
    }





    #[test]
    #[available_gas(30000000000000)]
    #[should_panic(expected: ('insufficient balance','ENTRYPOINT_FAILED' ))]
    fn test_insufficient_balance() {
        
        let (world, resource_systems_dispatcher) = setup();

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

        resource_systems_dispatcher.transfer(
            world, 
            sending_entity_id.into(), 
            receiving_entity_id.into(), 
            array![
                (ResourceTypes::STONE, 7700), // more than balance
                (ResourceTypes::WOOD, 700),
            ].span()
        );

    }
    
}