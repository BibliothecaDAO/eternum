mod resource_chest_offload_system_tests {
    use eternum::models::resources::{Resource, ResourceChest};
    use eternum::models::owner::Owner;
    use eternum::models::weight::Weight;
    use eternum::models::movable::ArrivalTime;
    use eternum::models::inventory::Inventory;
    use eternum::models::position::Position;
    use eternum::models::metadata::ForeignKey;


    use eternum::constants::ResourceTypes;
    use eternum::systems::config::contracts::config_systems;
    use eternum::systems::config::interface::{
        IWeightConfigDispatcher, IWeightConfigDispatcherTrait,
    };

    use eternum::systems::resources::contracts::resource_systems;
    use eternum::systems::resources::interface::{
        IResourceChestSystemsDispatcher, 
        IResourceChestSystemsDispatcherTrait
    };

    use eternum::systems::resources::contracts::resource_systems::{
        InternalInventorySystemsImpl, 
        InternalResourceChestSystemsImpl
    };



    use eternum::utils::testing::{spawn_eternum, deploy_system};

    use dojo::world::{ IWorldDispatcher, IWorldDispatcherTrait};
    use starknet::contract_address_const;

    use core::traits::Into;


    fn setup() -> (IWorldDispatcher, u128, u128, u128, IResourceChestSystemsDispatcher) {
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

        let resource_chest_systems_dispatcher = IResourceChestSystemsDispatcher {
            contract_address: resource_systems_address
        };

        let donor_id = 10;
        let donor_transport_id = 11;

        set!(world, (
            Inventory {
                entity_id: donor_transport_id, 
                items_key: world.uuid().into(), 
                items_count: 0
            }, 
        ));

        set!(world, (Owner { entity_id: donor_id, address: contract_address_const::<'donor'>()}));
        set!(world, (Owner { entity_id: donor_transport_id, address: contract_address_const::<'donor'>()}));

        set!(world, (Resource { entity_id: donor_id, resource_type: ResourceTypes::STONE, balance: 5000 }));
        set!(world, (Resource { entity_id: donor_id, resource_type: ResourceTypes::GOLD, balance: 5000 }));


        let (chest, _) 
            = InternalResourceChestSystemsImpl::create(
                world, 
                array![ResourceTypes::STONE, ResourceTypes::GOLD].span(),
                array![1000, 1000].span()
            );

        InternalResourceChestSystemsImpl::fill(
            world, 
            chest.entity_id, 
            donor_id,
        );

        InternalInventorySystemsImpl::add(
            world, 
            donor_transport_id, 
            chest.entity_id
        );
        

        (world, chest.entity_id, donor_id, donor_transport_id, resource_chest_systems_dispatcher)
    }



    #[test]
    #[available_gas(30000000000000)]
    fn test_offload() {

        let (world, chest_id, donor_id, donor_transport_id, resource_chest_systems_dispatcher) 
            = setup();


        starknet::testing::set_contract_address(
            contract_address_const::<'donor'>()
        );

        let receiver_id = 700;
        resource_chest_systems_dispatcher
            .offload_chest(world, chest_id, 0, receiver_id, donor_transport_id);
              

        // check donor balance
        let donor_stone_resource 
            = get!(world, (donor_id, ResourceTypes::STONE), Resource );
        let donor_gold_resource 
            = get!(world, (donor_id,ResourceTypes::GOLD), Resource );
        assert(donor_stone_resource.balance == 4000, 'stone balance mismatch');
        assert(donor_gold_resource.balance == 4000, 'gold balance mismatch');


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
    #[should_panic(expected: ('not caravan owner','ENTRYPOINT_FAILED' ))]
    fn test_offload_not_transport_owner() {

        let (world, chest_id, donor_id, donor_transport_id, resource_chest_systems_dispatcher) 
            = setup();

        // set caller to arbitrary address
        starknet::testing::set_contract_address(
            contract_address_const::<'unknown'>()
        );

        let receiver_id = 700;
        resource_chest_systems_dispatcher
            .offload_chest(
                world, chest_id, 0, receiver_id, donor_transport_id
                );


    }


    #[test]
    #[available_gas(30000000000000)]
    #[should_panic(expected: ('mismatched positions','ENTRYPOINT_FAILED' ))]
    fn test_offload_wrong_position() {

        let (world, chest_id, donor_id, donor_transport_id, resource_chest_systems_dispatcher) 
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

        resource_chest_systems_dispatcher
            .offload_chest(
                world, chest_id, 0, receiver_id, donor_transport_id
                );
    }


    
    #[test]
    #[available_gas(30000000000000)]
    #[should_panic(expected: ('transport has not arrived','ENTRYPOINT_FAILED' ))]
    fn test_offload_wrong_arrival_time() {

        let (world, chest_id, donor_id, donor_transport_id, resource_chest_systems_dispatcher) 
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

        resource_chest_systems_dispatcher
            .offload_chest(
                world, chest_id, 0, receiver_id, donor_transport_id
                );
    }


    #[test]
    #[available_gas(30000000000000)]
    #[should_panic(expected: ('inventory is empty','ENTRYPOINT_FAILED' ))]
    fn test_offload_from_empty_inventory() {

        let (world, chest_id, donor_id, donor_transport_id, resource_chest_systems_dispatcher) 
            = setup();
        starknet::testing::set_contract_address(
            contract_address_const::<'donor'>()
        );

        let receiver_id = 700;

        // offload twice
        resource_chest_systems_dispatcher
            .offload_chest(
                world, chest_id, 0, receiver_id, donor_transport_id
                );
        resource_chest_systems_dispatcher
            .offload_chest(
                world, chest_id, 0, receiver_id, donor_transport_id
                );
    }

}