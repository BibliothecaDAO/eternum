mod resource_transfer_system_tests {
    use eternum::models::resources::{Resource, ResourceAllowance};
    use eternum::models::owner::Owner;
    use eternum::models::position::Position;    
    use eternum::models::capacity::Capacity;    
    use eternum::models::inventory::Inventory;    
    use eternum::models::quantity::Quantity;
    use eternum::models::config::WeightConfig;
    use eternum::models::metadata::ForeignKey;

    use eternum::constants::ResourceTypes;
    use eternum::constants::WORLD_CONFIG_ID;

    use eternum::systems::resources::contracts::resource_systems;
    use eternum::systems::resources::interface::{
        IResourceSystemsDispatcher, 
        IResourceSystemsDispatcherTrait
    };

    use eternum::systems::config::contracts::config_systems;
    use eternum::systems::config::interface::{
        IWeightConfigDispatcher, IWeightConfigDispatcherTrait,
    };
    use eternum::systems::resources::contracts::resource_systems::{
        InternalInventorySystemsImpl 
    };

    use eternum::utils::testing::{spawn_eternum, deploy_system};

    use dojo::world::{ IWorldDispatcher, IWorldDispatcherTrait};
    use starknet::contract_address_const;

    use core::traits::Into;
    use core::integer::BoundedInt;



    fn setup() -> (IWorldDispatcher, IResourceSystemsDispatcher) {
        let world = spawn_eternum();

        let config_systems_address 
            = deploy_system(config_systems::TEST_CLASS_HASH);    

        // set weight configuration for stone
        IWeightConfigDispatcher {
            contract_address: config_systems_address
        }.set_weight_config(ResourceTypes::STONE.into(), 200); 
        

        // set weight configuration for gold
        IWeightConfigDispatcher {
            contract_address: config_systems_address
        }.set_weight_config(ResourceTypes::WOOD.into(), 200); 


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

        // call world.uuid() to ensure next id isn't 0
        world.uuid();

        set!(world, (            
            Inventory {
                entity_id: receiver_entity_id.into(),
                items_key: world.uuid().into(),
                items_count: 0,
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
            sender_entity_id.into(), 
            receiver_entity_id.into(), 
            array![
                (ResourceTypes::STONE, 400),
                (ResourceTypes::WOOD, 700),
            ].span()
        );


        
        // verify sender's resource balances
        let sender_entity_resource_stone = get!(world, (sender_entity_id, ResourceTypes::STONE), Resource);
        let sender_entity_resource_wood = get!(world, (sender_entity_id, ResourceTypes::WOOD), Resource);
        assert(sender_entity_resource_stone.balance == 600, 'stone balance mismatch');
        assert(sender_entity_resource_wood.balance == 300, 'wood balance mismatch');


        // check that items were added to receiver's inventory
        let receiver_inventory 
            = get!(world, receiver_entity_id, Inventory);
        assert(receiver_inventory.items_count == 1, 'wrong inventory item count');

        let received_item_foreign_key 
            = InternalInventorySystemsImpl::get_foreign_key(
                receiver_inventory, 0
                );

        let received_item_foreign_key 
            = get!(world, received_item_foreign_key, ForeignKey);
        assert(received_item_foreign_key.entity_id != 0, 'wrong foreign key');


    }


    #[test]
    #[available_gas(30000000000000)]
    #[should_panic(expected: ('not enough capacity','ENTRYPOINT_FAILED' ))]
    fn test_transfer__not_enough_capacity() {
        
        let (world, resource_systems_dispatcher) = setup();

        let sender_entity_id = 11_u64;
        let receiver_entity_id = 12_u64;
        make_owner_and_receiver(
            world, sender_entity_id, receiver_entity_id
        );

        

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
            
        let (_, resource_systems_dispatcher) = setup();
            
        // transfer resources 
        starknet::testing::set_contract_address(contract_address_const::<'unknown'>());

        resource_systems_dispatcher.transfer(
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
    #[should_panic(expected: ('mismatched positions','ENTRYPOINT_FAILED' ))]
    fn test_transfer__entity_position_mismatch() {
        let (world, resource_systems_dispatcher) = setup();

        // call as executor
        
        
        
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

        // verify sender's resource balances
        let owner_entity_resource_stone = get!(world, (owner_entity_id, ResourceTypes::STONE), Resource);
        let owner_entity_resource_wood = get!(world, (owner_entity_id, ResourceTypes::WOOD), Resource);
        assert(owner_entity_resource_stone.balance == 600, 'stone balance mismatch');
        assert(owner_entity_resource_wood.balance == 300, 'wood balance mismatch');

        // check that items were added to receiver's inventory
        let receiver_inventory 
            = get!(world, receiver_entity_id, Inventory);
        assert(receiver_inventory.items_count == 1, 'wrong inventory item count');

        let received_item_foreign_key 
            = InternalInventorySystemsImpl::get_foreign_key(
                receiver_inventory, 0
                );

        let received_item_foreign_key 
            = get!(world, received_item_foreign_key, ForeignKey);
        assert(received_item_foreign_key.entity_id != 0, 'wrong foreign key');
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

        // verify owner's resource balances
        let owner_entity_resource_stone = get!(world, (owner_entity_id, ResourceTypes::STONE), Resource);
        let owner_entity_resource_wood = get!(world, (owner_entity_id, ResourceTypes::WOOD), Resource);
        assert(owner_entity_resource_stone.balance == 600, 'stone balance mismatch');
        assert(owner_entity_resource_wood.balance == 300, 'wood balance mismatch');



        // check that items were added to receiver's inventory
        let receiver_inventory 
            = get!(world, receiver_entity_id, Inventory);
        assert(receiver_inventory.items_count == 1, 'wrong inventory item count');

        let received_item_foreign_key 
            = InternalInventorySystemsImpl::get_foreign_key(
                receiver_inventory, 0
                );

        let received_item_foreign_key 
            = get!(world, received_item_foreign_key, ForeignKey);
        assert(received_item_foreign_key.entity_id != 0, 'wrong foreign key');
    }
    
}