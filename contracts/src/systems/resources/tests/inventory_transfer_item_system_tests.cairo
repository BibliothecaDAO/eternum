mod inventory_transfer_system_tests {
    use eternum::models::resources::{Resource, ResourceChest};
    use eternum::models::owner::Owner;
    use eternum::models::weight::Weight;
    use eternum::models::movable::ArrivalTime;
    use eternum::models::inventory::Inventory;
    use eternum::models::position::Position;
    use eternum::models::capacity::Capacity;
    use eternum::models::metadata::ForeignKey;


    use eternum::constants::ResourceTypes;
    use eternum::systems::config::contracts::config_systems;
    use eternum::systems::config::interface::{
        IWeightConfigDispatcher, IWeightConfigDispatcherTrait,
    };

    use eternum::systems::resources::contracts::resource_systems;
    use eternum::systems::resources::interface::{
        IInventorySystemsDispatcher, 
        IInventorySystemsDispatcherTrait
    };

    use eternum::systems::resources::contracts::resource_systems::{
        InternalInventorySystemsImpl, 
        InternalResourceChestSystemsImpl
    };



    use eternum::utils::testing::{spawn_eternum, deploy_system};

    use dojo::world::{ IWorldDispatcher, IWorldDispatcherTrait};
    use starknet::contract_address_const;

    use core::traits::Into;

    use debug::PrintTrait;


    fn setup() -> (IWorldDispatcher, u128, u128, u128, IInventorySystemsDispatcher) {
        let world = spawn_eternum();

        let config_systems_address 
        = deploy_system(config_systems::TEST_CLASS_HASH);    

        // set weight configuration for stone
        IWeightConfigDispatcher {
            contract_address: config_systems_address
        }.set_weight_config(world, ResourceTypes::STONE.into(), 200); 
        

        // set weight configuration for gold
        IWeightConfigDispatcher {
            contract_address: config_systems_address
        }.set_weight_config(world, ResourceTypes::GOLD.into(), 200); 


        let resource_systems_address 
            = deploy_system(resource_systems::TEST_CLASS_HASH);

        let inventory_systems_dispatcher = IInventorySystemsDispatcher {
            contract_address: resource_systems_address
        };

        let donor_id = 10;
        let donor_transport_id = 11;

        // call world.uuid() so that the next generated id is not 0
       
        world.uuid();

        set!(world, (
            Inventory {
                entity_id: donor_transport_id, 
                items_key: world.uuid().into(), 
                items_count: 0
            }, 
            Capacity {
                entity_id: donor_transport_id,
                weight_gram: 80000000
            }
        ));
        
        set!(world, (Owner { entity_id: donor_id, address: contract_address_const::<'donor'>()}));
        set!(world, (Owner { entity_id: donor_transport_id, address: contract_address_const::<'donor'>()}));

        set!(world, (Resource { entity_id: donor_id, resource_type: ResourceTypes::STONE, balance: 5000 }));
        set!(world, (Resource { entity_id: donor_id, resource_type: ResourceTypes::GOLD, balance: 5000 }));


        let chest 
            = InternalResourceChestSystemsImpl::create_and_fill(
                world, 
                donor_id,
                array![
                    (ResourceTypes::STONE, 1000), 
                    (ResourceTypes::GOLD, 1000), 
                ].span()
            );


        InternalInventorySystemsImpl::add(
            world, 
            donor_transport_id, 
            chest.entity_id
        );
        

        (world, chest.entity_id, donor_id, donor_transport_id, inventory_systems_dispatcher)
    }




    #[test]
    #[available_gas(30000000000000)]
    fn test_inventory_transfer_item() {

        let (world, chest_id, donor_id, donor_transport_id, inventory_systems_dispatcher) 
            = setup();


        starknet::testing::set_contract_address(
            contract_address_const::<'donor'>()
        );

        let receiver_id = 700;
        inventory_systems_dispatcher
            .transfer_item(world, donor_transport_id, 0, receiver_id );
              

        // check receiver balance
        let receiver_stone_resource 
            = get!(world, (receiver_id, ResourceTypes::STONE), Resource );
        let receiver_gold_resource
            = get!(world, (receiver_id, ResourceTypes::GOLD), Resource );

        assert(receiver_stone_resource.balance == 1000, 'stone balance mismatch');
        assert(receiver_gold_resource.balance == 1000, 'gold balance mismatch');

        // check chest resource count
        let chest = get!(world, chest_id, ResourceChest);
        assert(chest.resources_count == 0, 'wrong chest resource count');

        // check chest weight
        let chest_weight = get!(world, chest_id, Weight);
        assert(chest_weight.value == 0, 'wrong chest weight');


        // check donor transport inventory
        let donor_transport_inventory 
            = get!(world, donor_transport_id, Inventory);
        assert(donor_transport_inventory.items_count == 0, 'wrong donor transport inventory');

        // check that chest inventory foreign key is deleted
        let inventory_foreign_key 
            = InternalInventorySystemsImpl::get_foreign_key(
                donor_transport_inventory, 0
                );
        let inventory_foreign_key 
            = get!(world, inventory_foreign_key, ForeignKey);
        assert(inventory_foreign_key.entity_id == 0, 'wrong foreign key');
        

        // check donor transport weight
        let donor_transport_weight 
            = get!(world, donor_transport_id, Weight);
        assert(donor_transport_weight.value == 0, 'wrong weight after');

    }


        #[test]
    #[available_gas(30000000000000)]
    fn test_inventory_transfer_item_to_self() {

        let (world, chest_id, donor_id, donor_transport_id, inventory_systems_dispatcher) 
            = setup();


        starknet::testing::set_contract_address(
            contract_address_const::<'donor'>()
        );

        let receiver_id = donor_transport_id;
        inventory_systems_dispatcher
            .transfer_item(world, donor_transport_id, 0, receiver_id );
              

        // check receiver balance
        let receiver_stone_resource 
            = get!(world, (receiver_id, ResourceTypes::STONE), Resource );
        let receiver_gold_resource
            = get!(world, (receiver_id, ResourceTypes::GOLD), Resource );

        assert(receiver_stone_resource.balance == 1000, 'stone balance mismatch');
        assert(receiver_gold_resource.balance == 1000, 'gold balance mismatch');

        // check chest resource count
        let chest = get!(world, chest_id, ResourceChest);
        assert(chest.resources_count == 0, 'wrong chest resource count');

        // check chest weight
        let chest_weight = get!(world, chest_id, Weight);
        assert(chest_weight.value == 0, 'wrong chest weight');


        // check donor transport inventory
        let donor_transport_inventory 
            = get!(world, donor_transport_id, Inventory);
        assert(donor_transport_inventory.items_count == 0, 'wrong donor transport inventory');

        // check that chest inventory foreign key is deleted
        let inventory_foreign_key 
            = InternalInventorySystemsImpl::get_foreign_key(
                donor_transport_inventory, 0
                );
        let inventory_foreign_key 
            = get!(world, inventory_foreign_key, ForeignKey);
        assert(inventory_foreign_key.entity_id == 0, 'wrong foreign key');
        

        // check donor transport weight did not 
        // change because it was a self transfer
        let donor_transport_weight 
            = get!(world, donor_transport_id, Weight);
        assert(donor_transport_weight.value != 0, 'wrong weight after');

    }








    #[test]
    #[available_gas(30000000000000)]
    #[should_panic(expected: ('not caravan owner','ENTRYPOINT_FAILED' ))]
    fn test_inventory_transfer_item_not_transport_owner() {

        let (world, chest_id, donor_id, donor_transport_id, inventory_systems_dispatcher) 
            = setup();

        // set caller to arbitrary address
        starknet::testing::set_contract_address(
            contract_address_const::<'unknown'>()
        );

        let receiver_id = 700;
        inventory_systems_dispatcher
            .transfer_item(world, donor_transport_id, 0, receiver_id );


    }


    #[test]
    #[available_gas(30000000000000)]
    #[should_panic(expected: ('mismatched positions','ENTRYPOINT_FAILED' ))]
    fn test_inventory_transfer_item_wrong_position() {

        let (world, chest_id, donor_id, donor_transport_id, inventory_systems_dispatcher) 
            = setup();

        // receiver is not in the same position as donor transport
        let receiver_id = 700; 
        set!(world, (
            Position {
                entity_id: donor_transport_id, 
                x: 1, 
                y: 1
            }, 
            Position {
                entity_id: receiver_id, 
                x: 2, 
                y: 2
            }
        ));

        starknet::testing::set_contract_address(
            contract_address_const::<'donor'>()
        );

        inventory_systems_dispatcher
            .transfer_item(world, donor_transport_id, 0, receiver_id );

    }


    
    #[test]
    #[available_gas(30000000000000)]
    #[should_panic(expected: ('transport has not arrived','ENTRYPOINT_FAILED' ))]
    fn test_inventory_transfer_item_wrong_arrival_time() {

        let (world, chest_id, donor_id, donor_transport_id, inventory_systems_dispatcher) 
            = setup();

        // receiver is not in the same position as donor transport
        let receiver_id = 700; 
        set!(world, (
            ArrivalTime {
                entity_id: donor_transport_id, 
                arrives_at: starknet::get_block_timestamp() + 1000
            }
        ));

        starknet::testing::set_contract_address(
            contract_address_const::<'donor'>()
        );

        inventory_systems_dispatcher
            .transfer_item(world, donor_transport_id, 0, receiver_id );

    }


    #[test]
    #[available_gas(30000000000000)]
    #[should_panic(expected: ('inventory is empty','ENTRYPOINT_FAILED' ))]
    fn test_inventory_transfer_item_from_empty_inventory() {

        let (world, chest_id, donor_id, donor_transport_id, inventory_systems_dispatcher) 
            = setup();
        starknet::testing::set_contract_address(
            contract_address_const::<'donor'>()
        );

        let receiver_id = 700;

        // inventory_transfer_item twice
        inventory_systems_dispatcher
            .transfer_item(world, donor_transport_id, 0, receiver_id );

        inventory_systems_dispatcher
            .transfer_item(world, donor_transport_id, 0, receiver_id );

    }

}