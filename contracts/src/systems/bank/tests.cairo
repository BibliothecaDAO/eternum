
use eternum::models::bank::{BankAuction, BankAuctionTrait,BankSwapResourceCost};
use eternum::models::position::{Coord, Position};
use eternum::models::owner::Owner;
use eternum::models::weight::Weight;
use eternum::models::movable::ArrivalTime;
use eternum::models::inventory::Inventory;
use eternum::models::resources::{ResourceCost, Resource};

use eternum::systems::config::contracts::config_systems;
use eternum::systems::config::interface::{
    IBankConfigDispatcher, IBankConfigDispatcherTrait,
    IWeightConfigDispatcher, IWeightConfigDispatcherTrait,
};

use eternum::systems::bank::contracts::bank_systems;
use eternum::systems::bank::interface::{
    IBankSystemsDispatcher, 
    IBankSystemsDispatcherTrait
};

use eternum::utils::testing::{spawn_eternum, deploy_system};
use eternum::constants::ResourceTypes;

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

use starknet::contract_address_const;

const _0_1: u128 = 1844674407370955161; // 0.1


fn setup() -> (IWorldDispatcher, u128, u128, IBankSystemsDispatcher,) {
    let world = spawn_eternum();
    world.uuid(); // use first id

    let config_systems_address 
        = deploy_system(config_systems::TEST_CLASS_HASH);

    // set weight configuration for wheat
    IWeightConfigDispatcher {
        contract_address: config_systems_address
    }.set_weight_config(world, ResourceTypes::LORDS.into(), 2); 

    let bank_config_dispatcher = IBankConfigDispatcher {
        contract_address: config_systems_address
    };

    // create bank
    let bank_coord = Coord {x: 500200, y: 1};
    let bank_id = bank_config_dispatcher.create_bank(
        world,
        bank_coord,
        array![
            (
                // 1 shekel costs 5 wheat, 2 fish and 3 coal
                ResourceTypes::LORDS, 
                array![
                    (ResourceTypes::WHEAT, 5),
                    (ResourceTypes::FISH, 2),
                    (ResourceTypes::COAL, 3),
                ].span()
            ),

            (
            // lords cost 2 dragonhide
            ResourceTypes::LORDS, 
            array![
                (ResourceTypes::DRAGONHIDE, 2),
            ].span()
        ),
        ].span()
    );


    // create bank auction for lords
    let decay_constant: u128 = _0_1;
    let per_time_unit: u128 = 50;
    let price_update_interval: u128 = 10;
    bank_config_dispatcher.set_bank_auction(
        world,
        1,
        array![
            (ResourceTypes::LORDS, 0), // the one where lords cost fish, wheat and coal
            (ResourceTypes::LORDS, 1), // the one where lords cost dragonhide
        ].span(),
        decay_constant,
        per_time_unit,
        price_update_interval
    );


    // create caravan for swap

    
    let transport_id = 44;
    set!(world, (
        Owner {
            entity_id: transport_id,
            address: contract_address_const::<'transport'>()
        },
        Inventory {
            entity_id: transport_id,
            items_key: world.uuid().into(),
            items_count: 0
        },
        Position {
            entity_id: transport_id,
            x: bank_coord.x,
            y: bank_coord.y
        },
        Resource {
            entity_id: transport_id,
            resource_type: ResourceTypes::WHEAT,
            balance: 500
        },
        Resource {
            entity_id: transport_id,
            resource_type: ResourceTypes::FISH,
            balance: 500
        },
        Resource {
            entity_id: transport_id,
            resource_type: ResourceTypes::COAL,
            balance: 500
        },
        Resource {
            entity_id: transport_id,
            resource_type: ResourceTypes::DRAGONHIDE,
            balance: 500
        },
    ));


    let bank_systems_address 
        = deploy_system(bank_systems::TEST_CLASS_HASH);

    let bank_systems_dispatcher = IBankSystemsDispatcher {
        contract_address: bank_systems_address
    };

    (world, bank_id, transport_id, bank_systems_dispatcher)


    
}


#[test]
fn test_bank_swap_for_wheat_fish_and_coal() {
    let (world, bank_id, transport_id, bank_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(
        contract_address_const::<'transport'>()
    );

    let lords_bought = 80;

    let initial_transport_weight = get!(world, transport_id, Weight);

    bank_systems_dispatcher.swap(
        world, bank_id, 0, transport_id, 
        ResourceTypes::LORDS, lords_bought
    );

    let after_transport_weight = get!(world, transport_id, Weight);
    assert!(after_transport_weight.value != initial_transport_weight.value, "wrong weight value");

    let transport_wheat_resource = get!(world, (transport_id, ResourceTypes::WHEAT), Resource);
    assert!(transport_wheat_resource.balance == 500 - 431, "wrong wheat balance");

    let transport_fish_resource = get!(world, (transport_id, ResourceTypes::FISH), Resource);
    assert!(transport_fish_resource.balance == 500 - 172, "wrong fish balance");

    let transport_coal_resource = get!(world, (transport_id, ResourceTypes::COAL), Resource);
    assert!(transport_coal_resource.balance == 500 - 258, "wrong coal balance");

    let bank_auction = get!(world, (bank_id, ResourceTypes::LORDS, 0), BankAuction);
    assert!(bank_auction.sold == lords_bought, "wrong auction sold");

    // ensure no excess shekel was minted
    let bank_shekel_resource = get!(world, (bank_id, ResourceTypes::LORDS), Resource);
    assert!(bank_shekel_resource.balance == 0, "wrong bank balance");

    // ensure item was added to transport's inventory
    let transport_inventory = get!(world, (transport_id), Inventory);
    assert!(transport_inventory.items_count == 1, "wrong inventory count");
}


#[test]
3000000000000)]
fn test_bank_swap_for_dragonhide() {
    let (world, bank_id, transport_id, bank_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(
        contract_address_const::<'transport'>()
    );

    let initial_transport_weight = get!(world, transport_id, Weight);


    let lords_bought = 80;

    bank_systems_dispatcher.swap(
        world, bank_id, 1, transport_id, 
        ResourceTypes::LORDS, lords_bought
    );

    let after_transport_weight = get!(world, transport_id, Weight);
    assert!(after_transport_weight.value != initial_transport_weight.value, "wrong weight value");

    let transport_dragonhide_resource = get!(world, (transport_id, ResourceTypes::DRAGONHIDE), Resource);
    assert!(transport_dragonhide_resource.balance == 500 - 172, "wrong fish balance");


    let bank_auction = get!(world, (bank_id, ResourceTypes::LORDS, 1), BankAuction);
    assert!(bank_auction.sold == lords_bought, "wrong auction sold");

    // ensure no excess shekel was minted
    let bank_shekel_resource = get!(world, (bank_id, ResourceTypes::LORDS), Resource);
    assert!(bank_shekel_resource.balance == 0, "wrong bank balance");

    // ensure item was added to transport's inventory
    let transport_inventory = get!(world, (transport_id), Inventory);
    assert!(transport_inventory.items_count == 1, "wrong inventory count");
}

#[test]
3000000000000)]
#[should_panic(expected: ('not caravan owner','ENTRYPOINT_FAILED' ))]
fn test_bank_swap__wrong_caller() {
    let (world, bank_id, transport_id, bank_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(
        contract_address_const::<'unknown_caller'>()
    );

    let lords_bought = 80;

    bank_systems_dispatcher.swap(
        world, bank_id, 0, transport_id, 
        ResourceTypes::LORDS, lords_bought
    );
}


#[test]
3000000000000)]
#[should_panic(expected: ('mismatched positions','ENTRYPOINT_FAILED' ))]
fn test_bank_swap__wrong_transport_position() {
    let (world, bank_id, transport_id, bank_systems_dispatcher) = setup();

    
    set!(world, (
        Position {
            entity_id: transport_id,
            x: 0,
            y: 0
        }
    ));

    starknet::testing::set_contract_address(
        contract_address_const::<'transport'>()
    );

    let lords_bought = 80;
    bank_systems_dispatcher.swap(
        world, bank_id, 0, transport_id, 
        ResourceTypes::LORDS, lords_bought
    );
}


#[test]
3000000000000)]
#[should_panic(expected: ('transport has not arrived','ENTRYPOINT_FAILED' ))]
fn test_bank_swap__wrong_transport_arrival_time() {
    let (world, bank_id, transport_id, bank_systems_dispatcher) = setup();

    
    set!(world, (
        ArrivalTime {
            entity_id: transport_id,
            arrives_at: 1
        }
    ));

    starknet::testing::set_contract_address(
        contract_address_const::<'transport'>()
    );

    let lords_bought = 80;
    bank_systems_dispatcher.swap(
        world, bank_id, 0, transport_id, 
        ResourceTypes::LORDS, lords_bought
    );
}

#[test]
3000000000000)]
#[should_panic(expected: ('auction not found','ENTRYPOINT_FAILED' ))]
fn test_bank_swap__no_auction() {
    let (world, bank_id, transport_id, bank_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(
        contract_address_const::<'transport'>()
    );

    let dragonhide_bought = 80;
    bank_systems_dispatcher.swap(
        world, bank_id, 0, transport_id, 
        ResourceTypes::DRAGONHIDE, dragonhide_bought
    );
}
