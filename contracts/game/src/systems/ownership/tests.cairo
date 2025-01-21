use dojo::model::{ModelStorage, ModelValueStorage, ModelStorageTest};
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use dojo::world::{WorldStorage, WorldStorageTrait};
use dojo_cairo_test::{spawn_test_world, NamespaceDef, TestResource, ContractDefTrait};
use s1_eternum::alias::ID;
use s1_eternum::constants::{WORLD_CONFIG_ID};
use s1_eternum::models::owner::Owner;
use s1_eternum::models::position::{Coord};
use s1_eternum::models::season::Season;
use s1_eternum::systems::ownership::contracts::ownership_systems;
use s1_eternum::systems::ownership::contracts::{IOwnershipSystemsDispatcher, IOwnershipSystemsDispatcherTrait};

use s1_eternum::utils::testing::{world::spawn_eternum, systems::deploy_system};
use starknet::ContractAddress;
use starknet::contract_address_const;

const OWNER_ENTITY_ID: ID = 199999;
const FIRST_OWNER: felt252 = 'first_owner';
const SECOND_OWNER: felt252 = 'second_owner';


fn setup() -> (WorldStorage, ContractAddress, Owner) {
    let mut world = spawn_eternum();

    let ownership_systems_address = deploy_system(ref world, "ownership_systems");

    // set initial owner
    let owner = Owner { entity_id: OWNER_ENTITY_ID, address: contract_address_const::<FIRST_OWNER>() };
    world.write_model_test(@owner);

    // set initial season
    let season = Season { config_id: WORLD_CONFIG_ID, is_over: false, start_at: 0, ended_at: 0 };
    world.write_model_test(@season);

    (world, ownership_systems_address, owner)
}


#[test]
fn test_ownership_systems_set_owner() {
    let (mut world, ownership_systems_address, _owner) = setup();

    starknet::testing::set_contract_address(contract_address_const::<FIRST_OWNER>());
    let ownership_systems_dispatcher = IOwnershipSystemsDispatcher { contract_address: ownership_systems_address };
    ownership_systems_dispatcher.transfer_ownership(OWNER_ENTITY_ID, contract_address_const::<SECOND_OWNER>());

    let new_owner: Owner = world.read_model(OWNER_ENTITY_ID);
    assert_eq!(new_owner.address, contract_address_const::<SECOND_OWNER>());
}


#[test]
#[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
fn test_ownership_systems_set_owner_caller_not_current_owner() {
    let (_world, ownership_systems_address, _owner) = setup();

    starknet::testing::set_contract_address(contract_address_const::<SECOND_OWNER>());
    let ownership_systems_dispatcher = IOwnershipSystemsDispatcher { contract_address: ownership_systems_address };
    ownership_systems_dispatcher.transfer_ownership(OWNER_ENTITY_ID, contract_address_const::<SECOND_OWNER>());
}
