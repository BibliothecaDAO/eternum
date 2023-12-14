use eternum::models::resources::{Resource, ResourceChest};
use eternum::models::owner::Owner;
use eternum::models::position::Position;

use eternum::systems::config::contracts::config_systems;
use eternum::systems::config::interface::{
    IRealmFreeMintConfigDispatcher, IRealmFreeMintConfigDispatcherTrait,
};

use eternum::systems::realm::contracts::realm_systems;
use eternum::systems::realm::interface::{
    IRealmSystemsDispatcher,
    IRealmSystemsDispatcherTrait,
};



use eternum::utils::testing::{spawn_eternum, deploy_system};

use eternum::constants::ResourceTypes;
use dojo::world::{ IWorldDispatcher, IWorldDispatcherTrait};

use starknet::contract_address_const;
use core::array::{ArrayTrait, SpanTrait};

const INITIAL_RESOURCE_1_TYPE: u8 = 1;
const INITIAL_RESOURCE_1_AMOUNT: u128 = 800;

const INITIAL_RESOURCE_2_TYPE: u8 = 2;
const INITIAL_RESOURCE_2_AMOUNT: u128 = 700;

fn setup() -> IWorldDispatcher {
    let world = spawn_eternum();

    let config_systems_address 
        = deploy_system(config_systems::TEST_CLASS_HASH);    

    // set initially minted resources
    let initial_resources = array![
        (INITIAL_RESOURCE_1_TYPE, INITIAL_RESOURCE_1_AMOUNT),
        (INITIAL_RESOURCE_2_TYPE, INITIAL_RESOURCE_2_AMOUNT)
    ];

    IRealmFreeMintConfigDispatcher {
        contract_address: config_systems_address
    }.set_mint_config(world, initial_resources.span());

    world
}

#[test]
#[available_gas(3000000000000)]
fn test_realm_create() {

    let world = setup();


     // create realm
    let realm_systems_address 
        = deploy_system(realm_systems::TEST_CLASS_HASH);
    let realm_systems_dispatcher = IRealmSystemsDispatcher {
        contract_address: realm_systems_address
    };

    let position = Position { x: 20, y: 30, entity_id: 1_u128};

    let realm_id = 1;
    let resource_types_packed = 1;
    let resource_types_count = 1;
    let cities = 6;
    let harbors = 5;
    let rivers = 5;
    let regions = 5;
    let wonder = 1;
    let order = 1;
    let order_hyperstructure_id = 999;

    let realm_entity_id = realm_systems_dispatcher.create(
        world, realm_id, starknet::get_contract_address(), // owner
        resource_types_packed, resource_types_count, cities,
        harbors, rivers, regions, wonder, order, order_hyperstructure_id, position.clone(),
    );


    let realm_initial_resource_1
        = get!(world, (realm_entity_id, INITIAL_RESOURCE_1_TYPE), Resource);
    assert(realm_initial_resource_1.balance == INITIAL_RESOURCE_1_AMOUNT, 'wrong mint 1 amount');

    let realm_initial_resource_2
        = get!(world, (realm_entity_id, INITIAL_RESOURCE_2_TYPE), Resource);
    assert(realm_initial_resource_2.balance == INITIAL_RESOURCE_2_AMOUNT, 'wrong mint 2 amount');
}