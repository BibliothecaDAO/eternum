use core::option::OptionTrait;

use core::traits::Into;

use debug::PrintTrait;

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::alias::ID;
use eternum::constants::{ResourceTypes, get_resources_without_earthenshards};
use eternum::models::hyperstructure::{Progress, Contribution};
use eternum::models::level::Level;
use eternum::models::owner::Owner;
use eternum::models::position::Position;
use eternum::models::resources::Resource;
use eternum::models::structure::{Structure, StructureCount, StructureCountCustomTrait, StructureCategory};

use eternum::systems::config::contracts::{
    config_systems, config_systems::HyperstructureConfigCustomImpl, IHyperstructureConfigDispatcher,
    IHyperstructureConfig, IHyperstructureConfigDispatcherTrait
};

use eternum::systems::hyperstructure::contracts::{
    hyperstructure_systems, IHyperstructureSystems, IHyperstructureSystemsDispatcher,
    IHyperstructureSystemsDispatcherTrait
};

use eternum::utils::testing::{
    world::spawn_eternum, systems::{deploy_system, deploy_realm_systems, deploy_hyperstructure_systems},
    general::{spawn_realm, get_default_realm_pos, spawn_hyperstructure, get_default_hyperstructure_coord},
    config::{set_capacity_config, set_settlement_config}
};

use starknet::contract_address_const;

const TEST_AMOUNT: u128 = 1_000_000;
const TIME_BETWEEN_SHARES_CHANGE: u64 = 1000;

fn setup() -> (IWorldDispatcher, ID, IHyperstructureSystemsDispatcher) {
    let world = spawn_eternum();
    let config_systems_address = deploy_system(world, config_systems::TEST_CLASS_HASH);
    set_capacity_config(config_systems_address);
    set_settlement_config(config_systems_address);

    let realm_systems_dispatcher = deploy_realm_systems(world);
    let hyperstructure_systems_dispatcher = deploy_hyperstructure_systems(world);

    starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
    starknet::testing::set_contract_address(contract_address_const::<'player1'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());

    let realm_entity_id = spawn_realm(world, realm_systems_dispatcher, get_default_realm_pos());

    let hyperstructure_config_dispatcher = IHyperstructureConfigDispatcher { contract_address: config_systems_address };

    set!(
        world,
        (Resource { entity_id: realm_entity_id, resource_type: ResourceTypes::EARTHEN_SHARD, balance: TEST_AMOUNT, },)
    );

    let resources_without_earthenshards = get_resources_without_earthenshards();
    let mut i = 0;
    let mut resources_for_completion = array![(ResourceTypes::EARTHEN_SHARD, TEST_AMOUNT)];
    while (i < resources_without_earthenshards.len()) {
        let resource_type = *resources_without_earthenshards.at(i);

        resources_for_completion.append((resource_type, TEST_AMOUNT));

        set!(world, (Resource { entity_id: realm_entity_id, resource_type, balance: TEST_AMOUNT, },));

        i += 1;
    };

    hyperstructure_config_dispatcher
        .set_hyperstructure_config(resources_for_completion.span(), TIME_BETWEEN_SHARES_CHANGE);

    (world, realm_entity_id, hyperstructure_systems_dispatcher)
}

#[test]
#[available_gas(3000000000000)]
fn test_create_hyperstructure() {
    let (world, realm_entity_id, hyperstructure_systems_dispatcher) = setup();

    starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
    starknet::testing::set_contract_address(contract_address_const::<'player1'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());

    let hyperstructure_entity_id = spawn_hyperstructure(
        world, hyperstructure_systems_dispatcher, realm_entity_id, get_default_hyperstructure_coord()
    );

    let structure = get!(world, hyperstructure_entity_id, Structure);
    assert(structure.category == StructureCategory::Hyperstructure, 'invalid category for structure');

    let structure_count = get!(world, get_default_hyperstructure_coord(), StructureCount);
    assert(structure_count.count == 1, 'invalid structure count');

    let hyperstructure_position = get!(world, hyperstructure_entity_id, Position);
    assert(hyperstructure_position.x == 0 && hyperstructure_position.y == 0, 'invalid position for hs');

    let hyperstructure_owner = get!(world, hyperstructure_entity_id, Owner);
    assert(hyperstructure_owner.address.try_into().unwrap() == 'player1', 'Not correct owner of hs');

    let progress = get!(world, (hyperstructure_entity_id, ResourceTypes::EARTHEN_SHARD), Progress);
    assert(progress.amount == TEST_AMOUNT, 'Invalid progress');

    let contribution = get!(
        world,
        (hyperstructure_entity_id, contract_address_const::<'player1'>(), ResourceTypes::EARTHEN_SHARD),
        Contribution
    );
    assert(contribution.amount == TEST_AMOUNT, 'Invalid contribution amount');
    assert(contribution.player_address == contract_address_const::<'player1'>(), 'invalid contribution address');
    assert(contribution.resource_type == ResourceTypes::EARTHEN_SHARD, 'invalid contribution resource');
}


#[test]
#[available_gas(3000000000000)]
#[should_panic(
    expected: (
        "not enough resources, Resource (entity id: 1, resource type: EARTHEN SHARD, balance: 0). deduction: 1000000",
        'ENTRYPOINT_FAILED'
    )
)]
fn test_create_hyperstructure_not_enough_eartenshards() {
    let (world, realm_entity_id, hyperstructure_systems_dispatcher) = setup();

    starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
    starknet::testing::set_contract_address(contract_address_const::<'player1'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());

    set!(world, (Resource { entity_id: realm_entity_id, resource_type: ResourceTypes::EARTHEN_SHARD, balance: 0, },));

    spawn_hyperstructure(world, hyperstructure_systems_dispatcher, realm_entity_id, get_default_hyperstructure_coord());
}

#[test]
#[available_gas(3000000000000)]
fn test_contribute_one_resource() {
    let (world, realm_entity_id, hyperstructure_systems_dispatcher) = setup();
    let contribution_amount = 100_000;

    starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
    starknet::testing::set_contract_address(contract_address_const::<'player1'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());

    let hyperstructure_entity_id = spawn_hyperstructure(
        world, hyperstructure_systems_dispatcher, realm_entity_id, get_default_hyperstructure_coord()
    );

    let contributions = array![(ResourceTypes::WOOD, contribution_amount),].span();
    hyperstructure_systems_dispatcher
        .contribute_to_construction(hyperstructure_entity_id, realm_entity_id, contributions);

    let wood_contribution = get!(
        world, (hyperstructure_entity_id, contract_address_const::<'player1'>(), ResourceTypes::WOOD), Contribution
    );
    assert(wood_contribution.amount == contribution_amount, 'invalid contribution amount');

    let wood_progress = get!(world, (hyperstructure_entity_id, ResourceTypes::WOOD), Progress);
    assert(wood_progress.amount == contribution_amount, 'invalid wood progress');

    hyperstructure_systems_dispatcher
        .contribute_to_construction(hyperstructure_entity_id, realm_entity_id, contributions);
    let wood_contribution = get!(
        world, (hyperstructure_entity_id, contract_address_const::<'player1'>(), ResourceTypes::WOOD), Contribution
    );
    assert(wood_contribution.amount == contribution_amount * 2, 'invalid contribution amount');

    let wood_progress = get!(world, (hyperstructure_entity_id, ResourceTypes::WOOD), Progress);
    assert(wood_progress.amount == contribution_amount * 2, 'invalid wood progress');
}

#[test]
#[available_gas(3000000000000)]
fn test_contribute_two_resources() {
    let (world, realm_entity_id, hyperstructure_systems_dispatcher) = setup();
    let wood_contribution_amount = 100_000;
    let stone_contribution_amount = 200_000;

    starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
    starknet::testing::set_contract_address(contract_address_const::<'player1'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());

    let hyperstructure_entity_id = spawn_hyperstructure(
        world, hyperstructure_systems_dispatcher, realm_entity_id, get_default_hyperstructure_coord()
    );

    let contributions = array![
        (ResourceTypes::WOOD, wood_contribution_amount), (ResourceTypes::STONE, stone_contribution_amount)
    ]
        .span();

    hyperstructure_systems_dispatcher
        .contribute_to_construction(hyperstructure_entity_id, realm_entity_id, contributions);

    let wood_contribution = get!(
        world, (hyperstructure_entity_id, contract_address_const::<'player1'>(), ResourceTypes::WOOD), Contribution
    );
    assert(wood_contribution.amount == wood_contribution_amount, 'invalid contribution amount');

    let wood_progress = get!(world, (hyperstructure_entity_id, ResourceTypes::WOOD), Progress);
    assert(wood_progress.amount == wood_contribution_amount, 'invalid wood progress');

    let stone_contribution = get!(
        world, (hyperstructure_entity_id, contract_address_const::<'player1'>(), ResourceTypes::STONE), Contribution
    );
    assert(stone_contribution.amount == stone_contribution_amount, 'invalid contribution amount');

    let wood_progress = get!(world, (hyperstructure_entity_id, ResourceTypes::STONE), Progress);
    assert(wood_progress.amount == stone_contribution_amount, 'invalid wood progress');

    // contribute a second time
    hyperstructure_systems_dispatcher
        .contribute_to_construction(hyperstructure_entity_id, realm_entity_id, contributions);

    let wood_contribution = get!(
        world, (hyperstructure_entity_id, contract_address_const::<'player1'>(), ResourceTypes::WOOD), Contribution
    );
    assert(wood_contribution.amount == wood_contribution_amount * 2, 'invalid contribution amount');

    let wood_progress = get!(world, (hyperstructure_entity_id, ResourceTypes::WOOD), Progress);
    assert(wood_progress.amount == wood_contribution_amount * 2, 'invalid wood progress');

    let stone_contribution = get!(
        world, (hyperstructure_entity_id, contract_address_const::<'player1'>(), ResourceTypes::STONE), Contribution
    );
    assert(stone_contribution.amount == stone_contribution_amount * 2, 'invalid contribution amount');

    let wood_progress = get!(world, (hyperstructure_entity_id, ResourceTypes::STONE), Progress);
    assert(wood_progress.amount == stone_contribution_amount * 2, 'invalid wood progress');
}
// TODO: @loaf - this test is not working
// #[test]
// #[available_gas(3000000000000)]
// fn test_finish_hyperstructure() {
//     let (world, realm_entity_id, hyperstructure_systems_dispatcher) = setup();

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());

//     let hyperstructure_entity_id = spawn_hyperstructure(
//         world, hyperstructure_systems_dispatcher, realm_entity_id,
//         get_default_hyperstructure_coord()
//     );

//     let resources_without_earthenshards = get_resources_without_earthenshards();
//     let mut i = 0;
//     let mut contributions = array![];
//     while (i < resources_without_earthenshards.len()) {
//         let resource_type = *resources_without_earthenshards.at(i);
//         contributions.append((resource_type, TEST_AMOUNT));
//         i += 1;
//     };

//     hyperstructure_systems_dispatcher
//         .contribute_to_construction(hyperstructure_entity_id, realm_entity_id,
//         contributions.span());

//     let hyperstructure_finished_selector =
//     0x10e79c3a2a9908c09d1b27bc9528744056ed39d0391b08fc6d21b482e4dbab;

//     let mut found = false;
//     loop {
//         let mut event_option = starknet::testing::pop_log_raw(world.contract_address);
//         match event_option {
//             Option::Some(val) => {
//                 let (mut keys, mut data) = val;

//                 let event_selector = *keys.at(0);
//                 if (event_selector != hyperstructure_finished_selector) {
//                     continue;
//                 }

//                 found = true;

//                 let event_hyperstructure_entity_id = (*data.at(0));
//                 let timestamp = (*data.at(1));

//                 assert(event_hyperstructure_entity_id == hyperstructure_entity_id.into(), 'wrong
//                 entity_id');
//                 assert(timestamp == 0, 'wrong timestamp');

//                 break;
//             },
//             Option::None => { break; },
//         }
//     };
//     assert(found == true, 'HyperstructureFinished missing');
// }


