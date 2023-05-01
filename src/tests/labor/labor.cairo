use eternum::tests::executor::Executor;
use eternum::tests::world::World;
use eternum::components::labor::LaborComponent;
use eternum::components::realm::RealmComponent;
use eternum::components::config::LaborConfComponent;
use eternum::components::config::LaborCVComponent;
use eternum::components::config::LaborCRComponent;
use eternum::components::resources::ResourceComponent;
use eternum::components::resources::VaultComponent;
use eternum::systems::labor::BuildLaborSystem;
use eternum::systems::labor::HarvestLaborSystem;
use eternum::components::realm::Realm;
use eternum::constants::LABOR_CONFIG_ID;
use eternum::components::config::LaborConf;
use eternum::components::config::LaborCR;
use eternum::components::config::LaborCV;


use core::traits::Into;
use core::result::ResultTrait;
use array::ArrayTrait;
use option::OptionTrait;
use traits::TryInto;
use debug::PrintTrait;

use starknet::syscalls::deploy_syscall;
use starknet::class_hash::Felt252TryIntoClassHash;
use starknet::ClassHash;

use dojo_core::interfaces::IExecutorDispatcher;
use dojo_core::interfaces::IExecutorDispatcherTrait;
use dojo_core::interfaces::IWorldDispatcher;
use dojo_core::interfaces::IWorldDispatcherTrait;
use dojo_core::storage::query::Query;

#[system]
mod CreateLaborConf {
    use traits::Into;
    use eternum::constants::LABOR_CONFIG_ID;
    use eternum::components::config::LaborConf;
    use eternum::components::config::LaborCR;
    use eternum::components::config::LaborCV;

    use debug::PrintTrait;
    fn execute() {
        // set labor config
        commands::<LaborConf>::set_entity(
            LABOR_CONFIG_ID.into(),
            (LaborConf {
                base_labor_units: 7200,
                vault_percentage: 250,
                base_resources_per_cycle: 21000000000000000000
            })
        );
        // set cost of creating labor for resource id 1 to only resource id 1 cost
        commands::<LaborCR>::set_entity(
            1.into(),
            (LaborCR {
                id: 1,
                resource_ids_packed_low: 1,
                resource_ids_packed_high: 0,
                resource_ids_count: 1,
            })
        ); // set value of resource id 1 for resource id 1 creation to 1000
        commands::<LaborCV>::set_entity(
            (1, (1)).into(), (LaborCV { id: 1, resource_id: 1, value: 1000 })
        ); // set value of resource id 2 for resource id 1 creation to 1000
        commands::<LaborCV>::set_entity(
            (1, (2)).into(), (LaborCV { id: 1, resource_id: 2, value: 1000 })
        );
    }
}

// // miniting function, only for testing 
#[system]
mod MintResources {
    use traits::Into;
    use array::ArrayTrait;
    use eternum::components::resources::Resource;
    #[external]
    fn execute(realm_id: felt252, resource_id: felt252, amount: u128) {
        let maybe_resource = commands::<Resource>::try_entity((realm_id, (resource_id)).into());
        let resource = match maybe_resource {
            Option::Some(resource) => resource,
            Option::None(_) => Resource { id: resource_id, balance: 0 },
        };

        commands::set_entity(
            (realm_id, (resource_id)).into(),
            (Resource { id: resource_id, balance: resource.balance + amount,  }, )
        );
    }
}

#[system]
mod CreateRealm {
    use eternum::components::realm::Realm;
    use traits::Into;
    use debug::PrintTrait;

    fn execute(realm_id: felt252) {
        let owner = starknet::get_caller_address();
        commands::<Realm>::set_entity(
            realm_id.into(),
            (Realm {
                realm_id: realm_id, // OG Realm Id
                owner: owner,
                resource_ids_hash: 0, // hash of ids
                // packed resource ids of realm
                resource_ids_packed_low: 1,
                resource_ids_packed_high: 0,
                // resource_ids_packed: 0.into(), // bug in dojo with u256
                resource_ids_count: 1,
                cities: 1_u8,
                harbors: 1_u8,
                rivers: 1_u8,
                regions: 1_u8,
                // TODO: resources
                wonder: 1_u8, // TODO: maybe its own component?
                order: 1_u8, // TODO: use consts for orders, somewhere    
            })
        );
    }
}

#[test]
#[available_gas(30000000)]
fn test_build_labor_non_food() {
    // deploy executor
    let constructor_calldata = array::ArrayTrait::<felt252>::new();
    let (executor_address, _) = deploy_syscall(
        Executor::TEST_CLASS_HASH.try_into().unwrap(), 0, constructor_calldata.span(), false
    ).unwrap();

    // deploy world
    let mut world_constructor_calldata = array::ArrayTrait::<felt252>::new();
    world_constructor_calldata.append('World');
    world_constructor_calldata.append(executor_address.into());
    let (world_address, _) = deploy_syscall(
        World::TEST_CLASS_HASH.try_into().unwrap(), 0, world_constructor_calldata.span(), false
    ).unwrap();
    let world = IWorldDispatcher { contract_address: world_address };

    /// REGISTER COMPONENTS ///
    world.register_component(LaborComponent::TEST_CLASS_HASH.try_into().unwrap());
    world.register_component(RealmComponent::TEST_CLASS_HASH.try_into().unwrap());
    world.register_component(LaborConfComponent::TEST_CLASS_HASH.try_into().unwrap());
    world.register_component(LaborCVComponent::TEST_CLASS_HASH.try_into().unwrap());
    world.register_component(LaborCRComponent::TEST_CLASS_HASH.try_into().unwrap());
    world.register_component(ResourceComponent::TEST_CLASS_HASH.try_into().unwrap());

    /// REGISTER SYSTEMS ///
    world.register_system(BuildLaborSystem::TEST_CLASS_HASH.try_into().unwrap());
    world.register_system(CreateRealmSystem::TEST_CLASS_HASH.try_into().unwrap());
    world.register_system(CreateLaborConfSystem::TEST_CLASS_HASH.try_into().unwrap());
    world.register_system(MintResourcesSystem::TEST_CLASS_HASH.try_into().unwrap());

    /// CREATE ENTITIES ///
    // set realm entity
    let mut create_realm_calldata = array::ArrayTrait::<felt252>::new();
    create_realm_calldata.append(1);
    world.execute('CreateRealm'.into(), create_realm_calldata.span());
    // set labor configuration entity
    let create_labor_conf_calldata = array::ArrayTrait::<felt252>::new();
    world.execute('CreateLaborConf'.into(), create_labor_conf_calldata.span());
    // mint some resources
    let mut mint_resources_calldata = array::ArrayTrait::<felt252>::new();

    // mint 100000 resource id 1 for realm id 1;
    mint_resources_calldata.append(1);
    mint_resources_calldata.append(1);
    mint_resources_calldata.append(100000);
    world.execute('MintResources'.into(), mint_resources_calldata.span());

    // set block timestamp in order to harvest labor
    // initial ts = 0
    starknet::testing::set_block_timestamp(10000);

    // call build labor system
    let mut build_labor_calldata = array::ArrayTrait::<felt252>::new();
    build_labor_calldata.append(1);
    build_labor_calldata.append(1);
    build_labor_calldata.append(20);
    // multiplier
    build_labor_calldata.append(1);
    world.execute('BuildLabor'.into(), build_labor_calldata.span());

    // assert resource is right amount
    let resource = world.entity('Resource'.into(), (1, (1)).into(), 0_u8, 0_usize);
    assert(*resource[0] == 1, 'failed resource id');
    assert(*resource[1] == 80000, 'failed resource amount');

    // assert labor is right amount
    let labor = world.entity('Labor'.into(), (1, (1)).into(), 0_u8, 0_usize);
    // timestamp + labor_per_unit * labor_units
    assert(*labor[0] == 10000 + 7200 * 20, 'labor balance is wrong');
    assert(*labor[1] == 10000, 'labor last harvest is wrong');
    assert(*labor[2] == 1, 'multiplier is wrong');
}

#[test]
#[available_gas(30000000)]
fn test_harvest_labor_non_food() {
    let constructor_calldata = array::ArrayTrait::<felt252>::new();
    let (executor_address, _) = deploy_syscall(
        Executor::TEST_CLASS_HASH.try_into().unwrap(), 0, constructor_calldata.span(), false
    ).unwrap();

    // deploy world
    let mut world_constructor_calldata = array::ArrayTrait::<felt252>::new();
    world_constructor_calldata.append('World');
    world_constructor_calldata.append(executor_address.into());
    let (world_address, _) = deploy_syscall(
        World::TEST_CLASS_HASH.try_into().unwrap(), 0, world_constructor_calldata.span(), false
    ).unwrap();
    let world = IWorldDispatcher { contract_address: world_address };

    /// REGISTER COMPONENTS ///
    world.register_component(LaborComponent::TEST_CLASS_HASH.try_into().unwrap());
    world.register_component(RealmComponent::TEST_CLASS_HASH.try_into().unwrap());
    world.register_component(LaborConfComponent::TEST_CLASS_HASH.try_into().unwrap());
    world.register_component(LaborCVComponent::TEST_CLASS_HASH.try_into().unwrap());
    world.register_component(LaborCRComponent::TEST_CLASS_HASH.try_into().unwrap());
    world.register_component(ResourceComponent::TEST_CLASS_HASH.try_into().unwrap());
    world.register_component(VaultComponent::TEST_CLASS_HASH.try_into().unwrap());

    /// REGISTER SYSTEMS ///
    world.register_system(BuildLaborSystem::TEST_CLASS_HASH.try_into().unwrap());
    world.register_system(HarvestLaborSystem::TEST_CLASS_HASH.try_into().unwrap());
    world.register_system(CreateRealmSystem::TEST_CLASS_HASH.try_into().unwrap());
    world.register_system(CreateLaborConfSystem::TEST_CLASS_HASH.try_into().unwrap());
    world.register_system(MintResourcesSystem::TEST_CLASS_HASH.try_into().unwrap());

    /// CREATE ENTITIES ///
    // set realm entity
    let mut create_realm_calldata = array::ArrayTrait::<felt252>::new();
    create_realm_calldata.append(1);
    world.execute('CreateRealm'.into(), create_realm_calldata.span());
    // set labor configuration entity
    let create_labor_conf_calldata = array::ArrayTrait::<felt252>::new();
    world.execute('CreateLaborConf'.into(), create_labor_conf_calldata.span());
    // mint some resources
    let mut mint_resources_calldata = array::ArrayTrait::<felt252>::new();

    // mint 100000 resource id 1 for realm id 1;
    mint_resources_calldata.append(1);
    mint_resources_calldata.append(1);
    mint_resources_calldata.append(100000);
    world.execute('MintResources'.into(), mint_resources_calldata.span());

    // set block timestamp in order to harvest labor
    // initial ts = 0
    starknet::testing::set_block_timestamp(1000);

    // call build labor system
    let mut build_labor_calldata = array::ArrayTrait::<felt252>::new();
    build_labor_calldata.append(1);
    build_labor_calldata.append(1);
    build_labor_calldata.append(20);
    // multiplier
    build_labor_calldata.append(1);
    world.execute('BuildLabor'.into(), build_labor_calldata.span());

    // set block timestamp in order to harvest labor
    // initial ts = 0
    starknet::testing::set_block_timestamp(40000);

    // call build labor system
    let mut harvest_labor_calldata = array::ArrayTrait::<felt252>::new();
    // realm_id
    harvest_labor_calldata.append(1);
    // resource_id
    harvest_labor_calldata.append(1);
    world.execute('HarvestLabor'.into(), harvest_labor_calldata.span());

    // get labor after harvest 
    let labor_after_harvest = world.entity('Labor'.into(), (1, (1)).into(), 0_u8, 0_usize);
    // labor after harvest = current labor balance + rest from division by 72000
    assert(*labor_after_harvest[0] == 145000 + 3000, 'wrong labor balance');
    assert(*labor_after_harvest[1] == 40000, 'wrong last harvest');

    let last_harvest = 1000_u128;
    let current_ts = 40000_u128;
    let labor_per_unit = 7200_u128;
    let base_resources_per_cycle = 21000000000000000000_u128;
    let vault_percentage = 250; // on base 1000
    let resource_balance_before_harvest = 80000_u128;

    // because current_ts < balance
    let generated_labor = current_ts - last_harvest;

    // generated units
    let mut generated_units = generated_labor / labor_per_unit;
    // vault units
    let vault_units = generated_units * vault_percentage / 1000;
    generated_units -= vault_units;

    let generated_resources = generated_units * base_resources_per_cycle;

    // verify resource is right amount
    let resource = world.entity('Resource'.into(), (1, (1)).into(), 0_u8, 0_usize);
    assert(
        *resource[1] == (resource_balance_before_harvest + generated_resources).into(),
        'failed resource amount'
    );

    // verify vault balance 
    let vault = world.entity('Vault'.into(), (1, (1)).into(), 0_u8, 0_usize);
    assert(*vault[0] == 1, 'failed vault balance');
}
