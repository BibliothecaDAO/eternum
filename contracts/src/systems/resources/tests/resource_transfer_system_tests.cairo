mod resource_transfer_system_tests {
    use eternum::models::resources::{Resource, ResourceAllowance};
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
    use core::integer::BoundedInt;



    fn setup() -> (IWorldDispatcher, IResourceSystemsDispatcher) {
        let world = spawn_eternum();

        let resource_systems_address 
            = deploy_system(resource_systems::TEST_CLASS_HASH);

        let resource_systems_dispatcher = IResourceSystemsDispatcher {
            contract_address: resource_systems_address
        };

        

        (world, resource_systems_dispatcher)
    }


    fn make_owner_and_receiver(
        world: IWorldDispatcher, sender_entity_id: u64, receiver_entity_id: u64
    ) {
        starknet::testing::set_contract_address(world.executor());

        let sender_entity_position = Position { 
            x: 100_000, 
            y: 200_000, 
            entity_id: sender_entity_id.into()
        };

        set!(world, (sender_entity_position));
        set!(world, (
            Owner { 
                address: contract_address_const::<'owner_entity'>(), 
                entity_id: sender_entity_id.into()
            },
            Resource {
                entity_id: sender_entity_id.into(),
                resource_type: ResourceTypes::STONE,
                balance: 1000
            },
            Resource {
                entity_id: sender_entity_id.into(),
                resource_type: ResourceTypes::WOOD,
                balance: 1000
            }
        ));


        let receiver_entity_position = Position { 
            x: 100_000, 
            y: 200_000, 
            entity_id: receiver_entity_id.into()
        };
        set!(world, (receiver_entity_position));
        set!(world, (            
            Resource {
                entity_id: receiver_entity_id.into(),
                resource_type: ResourceTypes::STONE,
                balance: 1000
            },
            Resource {
                entity_id: receiver_entity_id.into(),
                resource_type: ResourceTypes::WOOD,
                balance: 1000
            }
        ));

    }


    ////////////////////////////
    // Test transfer
    ////////////////////////////

    #[test]
    #[available_gas(30000000000000)]
    fn test_transfer() {

        let (world, resource_systems_dispatcher) = setup();
        
        let sender_entity_id = 11_u64;
        let receiver_entity_id = 12_u64;
        make_owner_and_receiver(
            world, sender_entity_id, receiver_entity_id
        );
         
        // transfer resources
        starknet::testing::set_contract_address(contract_address_const::<'owner_entity'>());

        resource_systems_dispatcher.transfer(
            world, 
            sender_entity_id.into(), 
            receiver_entity_id.into(), 
            array![
                (ResourceTypes::STONE, 400),
                (ResourceTypes::WOOD, 700),
            ].span()
        );


        
        // verify resource balances
        let sender_entity_resource_stone = get!(world, (sender_entity_id, ResourceTypes::STONE), Resource);
        let sender_entity_resource_wood = get!(world, (sender_entity_id, ResourceTypes::WOOD), Resource);
        assert(sender_entity_resource_stone.balance == 600, 'stone balance mismatch');
        assert(sender_entity_resource_wood.balance == 300, 'wood balance mismatch');

        let receiver_entity_resource_stone = get!(world, (receiver_entity_id, ResourceTypes::STONE), Resource);
        let receiver_entity_resource_wood = get!(world, (receiver_entity_id, ResourceTypes::WOOD), Resource);
        assert(receiver_entity_resource_stone.balance == 1400, 'stone balance mismatch');
        assert(receiver_entity_resource_wood.balance == 1700, 'wood balance mismatch');
    }


    #[test]
    #[available_gas(30000000000000)]
    #[should_panic(expected: ('capacity not enough','ENTRYPOINT_FAILED' ))]
    fn test_transfer__not_enough_capacity() {
        
        let (world, resource_systems_dispatcher) = setup();

        let sender_entity_id = 11_u64;
        let receiver_entity_id = 12_u64;
        make_owner_and_receiver(
            world, sender_entity_id, receiver_entity_id
        );

        starknet::testing::set_contract_address(world.executor());

        // set receiving entity capacity, and weight config 
        set!(world, (
            Capacity { 
                entity_id: receiver_entity_id.into(), 
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
        starknet::testing::set_contract_address(contract_address_const::<'owner_entity'>());

       
        // should fail because total capacity 
        // is 10,000 and total weight is 11,000 
        resource_systems_dispatcher.transfer(
            world, 
            sender_entity_id.into(), 
            receiver_entity_id.into(), 
            array![
                (ResourceTypes::STONE, 400),
                (ResourceTypes::WOOD, 700),
            ].span()
        );


    }





    #[test]
    #[available_gas(30000000000000)]
    #[should_panic(expected: ('not owner of entity id','ENTRYPOINT_FAILED' ))]
    fn test_transfer__not_owner() {
            
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
    fn test_transfer__entity_position_mismatch() {
        let (world, resource_systems_dispatcher) = setup();

        // call as executor
        starknet::testing::set_contract_address(world.executor());
        
        
        let sender_entity_id = 11_u64;
        let sender_entity_position = Position { 
            x: 900_000, 
            y: 800_000, 
            entity_id: sender_entity_id.into()
        };

        set!(world, (sender_entity_position));
        set!(world, (
            Owner { 
                address: contract_address_const::<'owner_entity'>(), 
                entity_id: sender_entity_id.into()
            }
        ));


        let receiver_entity_id = 12_u64;
        let receiver_entity_position = Position { 
            x: 500_000, 
            y: 600_000, 
            entity_id: receiver_entity_id.into()
        };
        set!(world, (receiver_entity_position));
        
        
        // transfer resources
        starknet::testing::set_contract_address(contract_address_const::<'owner_entity'>());

        resource_systems_dispatcher.transfer(
            world, 
            sender_entity_id.into(), 
            receiver_entity_id.into(), 
            array![
                (ResourceTypes::STONE, 400),
                (ResourceTypes::WOOD, 700),
            ].span()
        );
        
    }





    #[test]
    #[available_gas(30000000000000)]
    #[should_panic(expected: ('resource transfer amount is 0','ENTRYPOINT_FAILED' ))]
    fn test_transfer__zero_transfer_amount() {
        
        let (world, resource_systems_dispatcher) = setup();
        
        let sender_entity_id = 11_u64;
        let receiver_entity_id = 12_u64;
        make_owner_and_receiver(
            world, sender_entity_id, receiver_entity_id
        );

        
        
        // transfer resources 
        starknet::testing::set_contract_address(contract_address_const::<'owner_entity'>());
        resource_systems_dispatcher.transfer(
            world, 
            sender_entity_id.into(), 
            receiver_entity_id.into(), 
            array![
                (ResourceTypes::STONE, 0),
                (ResourceTypes::WOOD, 700),
            ].span()
        );
    }





    #[test]
    #[available_gas(30000000000000)]
    #[should_panic(expected: ('insufficient balance','ENTRYPOINT_FAILED' ))]
    fn test_transfer__insufficient_balance() {
        
        let (world, resource_systems_dispatcher) = setup();
        
        let sender_entity_id = 11_u64;
        let receiver_entity_id = 12_u64;
        make_owner_and_receiver(
            world, sender_entity_id, receiver_entity_id
        );

        
        // transfer resources 
        starknet::testing::set_contract_address(contract_address_const::<'owner_entity'>());

        resource_systems_dispatcher.transfer(
            world, 
            sender_entity_id.into(), 
            receiver_entity_id.into(), 
            array![
                (ResourceTypes::STONE, 7700), // more than balance
                (ResourceTypes::WOOD, 700),
            ].span()
        );

    }



    ////////////////////////////
    // Test transfer_from
    ////////////////////////////




    #[test]
    #[available_gas(30000000000000)]
    fn test_transfer_from() {

        let (world, resource_systems_dispatcher) = setup();
                

        let owner_entity_id = 11_u64;
        let receiver_entity_id = 12_u64;
        make_owner_and_receiver(
            world, owner_entity_id, receiver_entity_id
        );

        let approved_entity_id = 13_u64;
        starknet::testing::set_contract_address(world.executor());
        set!(world, (
            Owner { 
                address: contract_address_const::<'approved_entity'>(), 
                entity_id: approved_entity_id.into()
            }
        ));


        // owner approves approved
        starknet::testing::set_contract_address(
            contract_address_const::<'owner_entity'>()
        );
        resource_systems_dispatcher.approve(
            world,
            owner_entity_id.into(),
            approved_entity_id.into(),
            array![
                (ResourceTypes::STONE, 600),
                (ResourceTypes::WOOD, 800),
            ].span()
        );
              
        // approved entity transfers resources
        starknet::testing::set_contract_address(
            contract_address_const::<'approved_entity'>()
        );
        

        resource_systems_dispatcher.transfer_from(
            world, 
            approved_entity_id.into(),
            owner_entity_id.into(), 
            receiver_entity_id.into(), 
            array![
                (ResourceTypes::STONE, 400),
                (ResourceTypes::WOOD, 700),
            ].span()
        );


        
        // check approval balance
        let approved_entity_stone_allowance 
            = get!(world, (owner_entity_id, approved_entity_id, ResourceTypes::STONE), ResourceAllowance );
        let approved_entity_wood_allowance 
            = get!(world, (owner_entity_id, approved_entity_id,ResourceTypes::WOOD), ResourceAllowance );
        assert(approved_entity_stone_allowance.amount == 200, 'stone allowance mismatch');
        assert(approved_entity_wood_allowance.amount == 100, 'wood allowance mismatch');

        // verify resource balances
        let owner_entity_resource_stone = get!(world, (owner_entity_id, ResourceTypes::STONE), Resource);
        let owner_entity_resource_wood = get!(world, (owner_entity_id, ResourceTypes::WOOD), Resource);
        assert(owner_entity_resource_stone.balance == 600, 'stone balance mismatch');
        assert(owner_entity_resource_wood.balance == 300, 'wood balance mismatch');

        let receiver_entity_resource_stone = get!(world, (receiver_entity_id, ResourceTypes::STONE), Resource);
        let receiver_entity_resource_wood = get!(world, (receiver_entity_id, ResourceTypes::WOOD), Resource);
        assert(receiver_entity_resource_stone.balance == 1400, 'stone balance mismatch');
        assert(receiver_entity_resource_wood.balance == 1700, 'wood balance mismatch');
    }


        #[test]
    #[available_gas(30000000000000)]
    fn test_transfer_from__with_infinite_approval() {

        let (world, resource_systems_dispatcher) = setup();
                

        let owner_entity_id = 11_u64;
        let receiver_entity_id = 12_u64;
        make_owner_and_receiver(
            world, owner_entity_id, receiver_entity_id
        );

        let approved_entity_id = 13_u64;
        starknet::testing::set_contract_address(world.executor());
        set!(world, (
            Owner { 
                address: contract_address_const::<'approved_entity'>(), 
                entity_id: approved_entity_id.into()
            }
        ));


        // owner approves approved
        starknet::testing::set_contract_address(
            contract_address_const::<'owner_entity'>()
        );
        resource_systems_dispatcher.approve(
            world,
            owner_entity_id.into(),
            approved_entity_id.into(),
            array![
                (ResourceTypes::STONE, BoundedInt::max()),
                (ResourceTypes::WOOD, BoundedInt::max()),
            ].span()
        );
              
        // approved entity transfers resources
        starknet::testing::set_contract_address(
            contract_address_const::<'approved_entity'>()
        );
        

        resource_systems_dispatcher.transfer_from(
            world, 
            approved_entity_id.into(),
            owner_entity_id.into(), 
            receiver_entity_id.into(), 
            array![
                (ResourceTypes::STONE, 400),
                (ResourceTypes::WOOD, 700),
            ].span()
        );


        
        // check approval balance
        let approved_entity_stone_allowance 
            = get!(world, (owner_entity_id, approved_entity_id, ResourceTypes::STONE), ResourceAllowance );
        let approved_entity_wood_allowance 
            = get!(world, (owner_entity_id, approved_entity_id,ResourceTypes::WOOD), ResourceAllowance );
        assert(approved_entity_stone_allowance.amount == BoundedInt::max(), 'stone allowance mismatch');
        assert(approved_entity_wood_allowance.amount == BoundedInt::max(), 'wood allowance mismatch');

        // verify resource balances
        let owner_entity_resource_stone = get!(world, (owner_entity_id, ResourceTypes::STONE), Resource);
        let owner_entity_resource_wood = get!(world, (owner_entity_id, ResourceTypes::WOOD), Resource);
        assert(owner_entity_resource_stone.balance == 600, 'stone balance mismatch');
        assert(owner_entity_resource_wood.balance == 300, 'wood balance mismatch');

        let receiver_entity_resource_stone = get!(world, (receiver_entity_id, ResourceTypes::STONE), Resource);
        let receiver_entity_resource_wood = get!(world, (receiver_entity_id, ResourceTypes::WOOD), Resource);
        assert(receiver_entity_resource_stone.balance == 1400, 'stone balance mismatch');
        assert(receiver_entity_resource_wood.balance == 1700, 'wood balance mismatch');
    }
    
}