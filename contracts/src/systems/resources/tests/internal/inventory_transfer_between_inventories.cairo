mod internal_transfer_between_inventories_tests {
    use eternum::models::inventory::InventoryTrait;
    use core::option::OptionTrait;
    use core::traits::TryInto;
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
        IInventorySystemsDispatcher, IInventorySystemsDispatcherTrait
    };

    use eternum::systems::resources::contracts::resource_systems::{
        InternalInventorySystemsImpl, InternalResourceChestSystemsImpl
    };


    use eternum::utils::testing::{spawn_eternum, deploy_system};

    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
    use starknet::contract_address_const;

    use core::traits::Into;

    const ITEM_WEIGHT: u128 = 200;
    const PLAYER_CAPACITY: u128 = 1_200; // 6x ITEM_WEiGHT


    #[generate_trait]
    impl InventoryImplForTest of InventoryTraitForTest {
        fn add_test_item(ref self: Inventory, world: IWorldDispatcher, item_id: u128) {
            // next_item_fk.entity_id should always be 0
            let mut next_item_fk = self.next_item_fk(world);
            next_item_fk.entity_id = item_id;

            set!(world, (next_item_fk));

            // update inventory item count
            self.items_count += 1;
            set!(world, (self));

            let item_weight = Weight { entity_id: item_id, value: ITEM_WEIGHT };
            set!(world, (item_weight));

            let mut entity_weight: Weight = get!(world, self.entity_id, Weight);
            entity_weight.value += item_weight.value;
            set!(world, (entity_weight));
        }
    }


    fn player_inventories(world: IWorldDispatcher) -> (Inventory, Inventory) {
        let player_A_inventory = Inventory {
            entity_id: 'playera'.try_into().unwrap(),
            items_key: 'keyplayera'.try_into().unwrap(),
            items_count: 0,
        };

        let player_B_inventory = Inventory {
            entity_id: 'playerb'.try_into().unwrap(),
            items_key: 'keyplayerb'.try_into().unwrap(),
            items_count: 0,
        };

        set!(world, (player_A_inventory, player_B_inventory));

        // set players A and B capacity
        let player_A_capacity = Capacity {
            entity_id: player_A_inventory.entity_id, weight_gram: PLAYER_CAPACITY
        };

        let player_B_capacity = Capacity {
            entity_id: player_B_inventory.entity_id, weight_gram: PLAYER_CAPACITY
        };
        set!(world, (player_A_capacity, player_B_capacity));

        (player_A_inventory, player_B_inventory)
    }


    #[test]
    fn test_transfer_between_inventories_scenerio_1() {
        let world = spawn_eternum();

        let (mut player_A_inventory, mut player_B_inventory) = player_inventories(world);

        // add 4 items to player A inventory
        player_A_inventory.add_test_item(world, 'A0'.try_into().unwrap());
        player_A_inventory.add_test_item(world, 'A1'.try_into().unwrap());
        player_A_inventory.add_test_item(world, 'A2'.try_into().unwrap());
        player_A_inventory.add_test_item(world, 'A3'.try_into().unwrap());

        // add 1 item to player B inventory
        player_B_inventory.add_test_item(world, 'B0'.try_into().unwrap());

        // transfer the 2 middle items from player A to player B inventory
        // i.e indexes 1 and 2
        InternalInventorySystemsImpl::transfer_between_inventories(
            world, player_A_inventory, player_B_inventory, array![1, 2].span()
        );

        let player_A_inventory: Inventory = get!(world, player_A_inventory.entity_id, Inventory);
        let player_A_weight: Weight = get!(world, player_A_inventory.entity_id, Weight);
        assert_eq!(player_A_inventory.items_count, 2);
        assert_eq!(player_A_inventory.item_id(world, 0).into(), 'A0');
        assert_eq!(player_A_inventory.item_id(world, 1).into(), 'A3');
        assert_eq!(player_A_weight.value, ITEM_WEIGHT * player_A_inventory.items_count.into());

        let player_B_inventory: Inventory = get!(world, player_B_inventory.entity_id, Inventory);
        let player_B_weight: Weight = get!(world, player_B_inventory.entity_id, Weight);
        assert_eq!(player_B_inventory.items_count, 3);
        assert_eq!(player_B_inventory.item_id(world, 0).into(), 'B0');
        assert_eq!(player_B_inventory.item_id(world, 1).into(), 'A2');
        assert_eq!(player_B_inventory.item_id(world, 2).into(), 'A1');
        assert_eq!(player_B_weight.value, ITEM_WEIGHT * player_B_inventory.items_count.into());
    }


    #[test]
    fn test_transfer_between_inventories_scenerio_2() {
        let world = spawn_eternum();

        let (mut player_A_inventory, mut player_B_inventory) = player_inventories(world);

        // add 4 items to player A inventory
        player_A_inventory.add_test_item(world, 'A0'.try_into().unwrap());
        player_A_inventory.add_test_item(world, 'A1'.try_into().unwrap());
        player_A_inventory.add_test_item(world, 'A2'.try_into().unwrap());
        player_A_inventory.add_test_item(world, 'A3'.try_into().unwrap());

        // add 1 item to player B inventory
        player_B_inventory.add_test_item(world, 'B0'.try_into().unwrap());

        // transfer the first 3 items from player A to player B inventory
        // i.e indexes 0 and 1
        InternalInventorySystemsImpl::transfer_between_inventories(
            world, player_A_inventory, player_B_inventory, array![0, 1].span()
        );

        let player_A_inventory: Inventory = get!(world, player_A_inventory.entity_id, Inventory);
        let player_A_weight: Weight = get!(world, player_A_inventory.entity_id, Weight);
        assert_eq!(player_A_inventory.items_count, 2);
        assert_eq!(player_A_inventory.item_id(world, 0).into(), 'A2');
        assert_eq!(player_A_inventory.item_id(world, 1).into(), 'A3');
        assert_eq!(player_A_weight.value, ITEM_WEIGHT * player_A_inventory.items_count.into());

        let player_B_inventory: Inventory = get!(world, player_B_inventory.entity_id, Inventory);
        let player_B_weight: Weight = get!(world, player_B_inventory.entity_id, Weight);
        assert_eq!(player_B_inventory.items_count, 3);
        assert_eq!(player_B_inventory.item_id(world, 0).into(), 'B0');
        assert_eq!(player_B_inventory.item_id(world, 1).into(), 'A1');
        assert_eq!(player_B_inventory.item_id(world, 2).into(), 'A0');
        assert_eq!(player_B_weight.value, ITEM_WEIGHT * player_B_inventory.items_count.into());
    }


    #[test]
    fn test_transfer_between_inventories_scenerio_3() {
        let world = spawn_eternum();

        let (mut player_A_inventory, mut player_B_inventory) = player_inventories(world);

        // add 4 items to player A inventory
        player_A_inventory.add_test_item(world, 'A0'.try_into().unwrap());
        player_A_inventory.add_test_item(world, 'A1'.try_into().unwrap());
        player_A_inventory.add_test_item(world, 'A2'.try_into().unwrap());
        player_A_inventory.add_test_item(world, 'A3'.try_into().unwrap());

        // add 1 item to player B inventory
        player_B_inventory.add_test_item(world, 'B0'.try_into().unwrap());

        // transfer the all items from player A to player B inventory
        InternalInventorySystemsImpl::transfer_between_inventories(
            world, player_A_inventory, player_B_inventory, array![0, 1, 2, 3].span()
        );

        let player_A_inventory: Inventory = get!(world, player_A_inventory.entity_id, Inventory);
        let player_A_weight: Weight = get!(world, player_A_inventory.entity_id, Weight);
        assert_eq!(player_A_inventory.items_count, 0);
        assert_eq!(player_A_weight.value, ITEM_WEIGHT * player_A_inventory.items_count.into());

        let player_B_inventory: Inventory = get!(world, player_B_inventory.entity_id, Inventory);
        let player_B_weight: Weight = get!(world, player_B_inventory.entity_id, Weight);
        assert_eq!(player_B_inventory.items_count, 5);
        assert_eq!(player_B_inventory.item_id(world, 0).into(), 'B0');
        assert_eq!(player_B_inventory.item_id(world, 1).into(), 'A3');
        assert_eq!(player_B_inventory.item_id(world, 2).into(), 'A2');
        assert_eq!(player_B_inventory.item_id(world, 3).into(), 'A1');
        assert_eq!(player_B_inventory.item_id(world, 4).into(), 'A0');
        assert_eq!(player_B_weight.value, ITEM_WEIGHT * player_B_inventory.items_count.into());
    }


    #[test]
    fn test_transfer_between_inventories_scenerio_4() {
        let world = spawn_eternum();

        let (mut player_A_inventory, mut player_B_inventory) = player_inventories(world);

        // add 4 items to player A inventory
        player_A_inventory.add_test_item(world, 'A0'.try_into().unwrap());
        player_A_inventory.add_test_item(world, 'A1'.try_into().unwrap());
        player_A_inventory.add_test_item(world, 'A2'.try_into().unwrap());
        player_A_inventory.add_test_item(world, 'A3'.try_into().unwrap());

        // transfer the all items from player A to player B inventory
        // while player b has no item in initial inventory
        InternalInventorySystemsImpl::transfer_between_inventories(
            world, player_A_inventory, player_B_inventory, array![0, 1, 2, 3].span()
        );

        let player_A_inventory: Inventory = get!(world, player_A_inventory.entity_id, Inventory);
        let player_A_weight: Weight = get!(world, player_A_inventory.entity_id, Weight);
        assert_eq!(player_A_inventory.items_count, 0);
        assert_eq!(player_A_weight.value, ITEM_WEIGHT * player_A_inventory.items_count.into());

        let player_B_inventory: Inventory = get!(world, player_B_inventory.entity_id, Inventory);
        let player_B_weight: Weight = get!(world, player_B_inventory.entity_id, Weight);
        assert_eq!(player_B_inventory.items_count, 4);
        assert_eq!(player_B_inventory.item_id(world, 0).into(), 'A3');
        assert_eq!(player_B_inventory.item_id(world, 1).into(), 'A2');
        assert_eq!(player_B_inventory.item_id(world, 2).into(), 'A1');
        assert_eq!(player_B_inventory.item_id(world, 3).into(), 'A0');
        assert_eq!(player_B_weight.value, ITEM_WEIGHT * player_B_inventory.items_count.into());
    }


    #[test]
    fn test_transfer_between_inventories_indexes_only_up_to_capacity() {
        let world = spawn_eternum();

        let (mut player_A_inventory, mut player_B_inventory) = player_inventories(world);

        // try to transfer 8 items but only 6 will be transferred
        // brecause of capacity
        player_A_inventory.add_test_item(world, 'A0'.try_into().unwrap());
        player_A_inventory.add_test_item(world, 'A1'.try_into().unwrap());
        player_A_inventory.add_test_item(world, 'A2'.try_into().unwrap());
        player_A_inventory.add_test_item(world, 'A3'.try_into().unwrap());
        player_A_inventory.add_test_item(world, 'A4'.try_into().unwrap());
        player_A_inventory.add_test_item(world, 'A5'.try_into().unwrap());
        player_A_inventory.add_test_item(world, 'A6'.try_into().unwrap());
        player_A_inventory.add_test_item(world, 'A7'.try_into().unwrap());

        InternalInventorySystemsImpl::transfer_between_inventories(
            world, player_A_inventory, player_B_inventory, array![0, 1, 2, 3, 4, 5, 6, 7].span()
        );

        let player_B_inventory: Inventory = get!(world, player_B_inventory.entity_id, Inventory);
        let player_B_weight: Weight = get!(world, player_B_inventory.entity_id, Weight);
        assert_eq!(player_B_inventory.items_count, 6);
        assert_eq!(player_B_inventory.item_id(world, 0).into(), 'A7');
        assert_eq!(player_B_inventory.item_id(world, 1).into(), 'A6');
        assert_eq!(player_B_inventory.item_id(world, 2).into(), 'A5');
        assert_eq!(player_B_inventory.item_id(world, 3).into(), 'A4');
        assert_eq!(player_B_inventory.item_id(world, 4).into(), 'A3');
        assert_eq!(player_B_inventory.item_id(world, 5).into(), 'A2');
        assert_eq!(player_B_weight.value, ITEM_WEIGHT * player_B_inventory.items_count.into());
    }


    #[test]
    #[should_panic(expected: ('not ascending order',))]
    fn test_transfer_between_inventories_indexes_not_ascending() {
        let world = spawn_eternum();

        let (mut player_A_inventory, mut player_B_inventory) = player_inventories(world);

        // add 4 items to player A inventory
        player_A_inventory.add_test_item(world, 'A0'.try_into().unwrap());
        player_A_inventory.add_test_item(world, 'A1'.try_into().unwrap());
        player_A_inventory.add_test_item(world, 'A2'.try_into().unwrap());
        player_A_inventory.add_test_item(world, 'A3'.try_into().unwrap());

        // transfer the all items from player A to player B inventory
        // but put a set in descending order i.e use (0, 2, 1, 3) instead 
        // of (0 , 1, 2, 3)

        InternalInventorySystemsImpl::transfer_between_inventories(
            world, player_A_inventory, player_B_inventory, array![0, 2, 1, 3].span()
        );
    }
}
