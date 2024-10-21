use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::alias::ID;
use eternum::constants::{WORLD_CONFIG_ID};
use eternum::models::owner::Owner;
use eternum::models::position::{Coord};
use eternum::models::season::Season;
use eternum::systems::ownership::contracts::ownership_systems;
use eternum::systems::ownership::contracts::{IOwnershipSystemsDispatcher, IOwnershipSystemsDispatcherTrait};

use eternum::utils::testing::{world::spawn_eternum_custom, systems::deploy_system, constants::ownership_systems_models};
use starknet::ContractAddress;
use starknet::contract_address_const;

const OWNER_ENTITY_ID: ID = 199999;
const FIRST_OWNER: felt252 = 'first_owner';
const SECOND_OWNER: felt252 = 'second_owner';


fn setup() -> (IWorldDispatcher, ContractAddress, Owner) {
    let world = spawn_eternum_custom(
        array![ownership_systems_models()],
        array![contract_address_const::<FIRST_OWNER>(), contract_address_const::<SECOND_OWNER>()].span()
    );

    let ownership_systems_address = deploy_system(world, ownership_systems::TEST_CLASS_HASH);

    // set initial owner
    let owner = Owner { entity_id: OWNER_ENTITY_ID, address: contract_address_const::<FIRST_OWNER>() };
    set!(world, (owner));

    // set initial season
    let season = Season { config_id: WORLD_CONFIG_ID, is_over: false };
    set!(world, (season));

    (world, ownership_systems_address, owner)
}


#[test]
fn test_set_owner() {
    let (world, ownership_systems_address, _owner) = setup();

    starknet::testing::set_contract_address(contract_address_const::<FIRST_OWNER>());
    let ownership_systems_dispatcher = IOwnershipSystemsDispatcher { contract_address: ownership_systems_address };
    ownership_systems_dispatcher.transfer_ownership(OWNER_ENTITY_ID, contract_address_const::<SECOND_OWNER>());

    let new_owner = get!(world, OWNER_ENTITY_ID, Owner);
    assert_eq!(new_owner.address, contract_address_const::<SECOND_OWNER>());
}
