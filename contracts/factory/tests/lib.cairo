use core::num::traits::Zero;
use dojo::model::ModelStorage;
use dojo::world::{IWorldDispatcher, WorldStorage, WorldStorageTrait};
use dojo_snf_test::{
    ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait, spawn_test_world,
};
use fake_lib::{IFakeLibDispatcherTrait, IFakeLibLibraryDispatcher};
use fake_world::{IMyContractDispatcher, IMyContractDispatcherTrait, ModelA};
use snforge_std::{CheatSpan, DeclareResultTrait, cheat_caller_address, declare};
use world_factory::factory_models::{FactoryConfig, FactoryDeploymentCursor};
use world_factory::interface::{IWorldFactoryDispatcher, IWorldFactoryDispatcherTrait};
use world_factory::world_models::{WorldContract, WorldDeployed};

mod fake_lib;
mod fake_world;

/// Deploys the dojo world of the factory and returns a dispatcher for the IWorldFactory interface.
///
/// Returns a tuple of the factory dispatcher and the world storage.
fn deploy_factory() -> (IWorldFactoryDispatcher, WorldStorage) {
    let ndef = NamespaceDef {
        namespace: "wf",
        resources: [
            TestResource::Model("FactoryConfig"), TestResource::Model("FactoryDeploymentCursor"),
            TestResource::Model("FactoryConfigOwner"), TestResource::Model("WorldContract"),
            TestResource::Model("WorldDeployed"), TestResource::Contract("factory"),
        ]
            .span(),
    };

    let cdef = [
        ContractDefTrait::new(@"wf", @"factory")
            .with_writer_of([dojo::utils::bytearray_hash(@"wf")].span())
    ]
        .span();

    let mut world = spawn_test_world([ndef].span());
    world.sync_perms_and_inits(cdef);

    let (factory_addr, _) = world.dns(@"factory").unwrap();

    (IWorldFactoryDispatcher { contract_address: factory_addr }, world)
}

#[test]
fn test_factory_config() {
    let (factory, factory_world) = deploy_factory();

    let fake_world_resources = fake_world::declare_fake_world();

    let world_class_hash = declare("world").unwrap().contract_class().class_hash;

    let default_namespace: ByteArray = "ns";

    let factory_config = FactoryConfig {
        version: 1,
        max_actions: 5,
        world_class_hash: *world_class_hash,
        default_namespace,
        default_namespace_writer_all: true,
        contracts: fake_world_resources.contracts.clone(),
        models: fake_world_resources.models.clone(),
        events: fake_world_resources.events.clone(),
        libraries: fake_world_resources.libraries.clone(),
    };

    factory.set_config(factory_config);

    let config: FactoryConfig = factory_world.read_model(1);
    assert!(config.version == 1, "version should be 1");
    assert!(config.max_actions == 5);
    assert!(config.world_class_hash == *world_class_hash);
    assert!(config.default_namespace == "ns");
    assert!(config.default_namespace_writer_all == true);
    assert!(config.contracts.len() == fake_world_resources.contracts.len());
    assert!(config.models.len() == fake_world_resources.models.len());
    assert!(config.events.len() == fake_world_resources.events.len());
    assert!(config.libraries.len() == fake_world_resources.libraries.len());
}

#[test]
#[should_panic(expected: 'not config owner')]
fn test_factory_config_owner_only() {
    let (factory, _factory_world) = deploy_factory();

    let fake_world_resources = fake_world::declare_fake_world();

    let world_class_hash = declare("world").unwrap().contract_class().class_hash;

    let default_namespace: ByteArray = "ns";

    let factory_config = FactoryConfig {
        version: 1,
        max_actions: 5,
        world_class_hash: *world_class_hash,
        default_namespace,
        default_namespace_writer_all: true,
        contracts: fake_world_resources.contracts.clone(),
        models: fake_world_resources.models.clone(),
        events: fake_world_resources.events.clone(),
        libraries: fake_world_resources.libraries.clone(),
    };

    factory.set_config(factory_config.clone());

    cheat_caller_address(
        factory.contract_address, 'OTHER_CONTRACT'.try_into().unwrap(), CheatSpan::TargetCalls(1),
    );

    factory.set_config(factory_config);
}

#[test]
fn test_factory_deploy_and_confirm_cursor() {
    let (factory, factory_world) = deploy_factory();

    let fake_world_resources = fake_world::declare_fake_world();

    let world_class_hash = declare("world").unwrap().contract_class().class_hash;

    let default_namespace: ByteArray = "ns";

    let factory_config = FactoryConfig {
        version: 1,
        max_actions: 10,
        world_class_hash: *world_class_hash,
        default_namespace,
        default_namespace_writer_all: true,
        contracts: fake_world_resources.contracts.clone(),
        models: fake_world_resources.models.clone(),
        events: fake_world_resources.events.clone(),
        libraries: fake_world_resources.libraries.clone(),
    };

    factory.set_config(factory_config);

    factory.deploy('world_1', 1);

    let cursor: FactoryDeploymentCursor = factory_world.read_model((1, 'world_1'));
    assert!(cursor.completed == true);

    // Ensure the cursors are well separated even if the same config is used.
    let cursor: FactoryDeploymentCursor = factory_world.read_model((1, 'world_2'));
    assert!(cursor.completed == false);

    factory.deploy('world_2', 1);

    let cursor: FactoryDeploymentCursor = factory_world.read_model((1, 'world_2'));
    assert!(cursor.completed == true);
}

#[test]
fn test_factory_deploy_and_confirm_world_deployed() {
    let (factory, factory_world) = deploy_factory();

    let fake_world_resources = fake_world::declare_fake_world();

    let world_class_hash = declare("world").unwrap().contract_class().class_hash;

    let default_namespace: ByteArray = "ns";

    let factory_config = FactoryConfig {
        version: 1,
        max_actions: 10,
        world_class_hash: *world_class_hash,
        default_namespace,
        default_namespace_writer_all: true,
        contracts: fake_world_resources.contracts.clone(),
        models: fake_world_resources.models.clone(),
        events: fake_world_resources.events.clone(),
        libraries: fake_world_resources.libraries.clone(),
    };

    factory.set_config(factory_config);

    factory.deploy('world_1', 1);

    let world_deployed: WorldDeployed = factory_world.read_model('world_1');
    assert!(world_deployed.name == 'world_1');
    assert!(world_deployed.address.is_non_zero());
    assert!(world_deployed.block_number.is_non_zero());

    let fake_world_d = IWorldDispatcher { contract_address: world_deployed.address };
    let fake_world = WorldStorageTrait::new(fake_world_d, @"ns");

    let world_deployed: WorldDeployed = factory_world.read_model('world_2');
    assert!(world_deployed.name == 'world_2');
    assert!(world_deployed.address.is_zero());
    assert!(world_deployed.block_number.is_zero());

    let selector = dojo::utils::selector_from_names(@"ns", @"my_contract");
    let fake_contract: WorldContract = factory_world.read_model(('world_1', selector));
    assert!(fake_contract.name == 'world_1');
    assert!(fake_contract.contract_selector == selector);
    assert!(fake_contract.contract_address.is_non_zero());

    let my_contract = IMyContractDispatcher { contract_address: fake_contract.contract_address };

    my_contract.set_model_a(0xff, 0x123);
    let model_a: ModelA = fake_world.read_model(0xff);
    assert!(model_a.key == 0xff);
    assert!(model_a.value == 0x123);

    let (_, fake_lib_class_hash) = fake_world
        .dns(@"fake_library_v1_0_0")
        .expect('fake library not found');

    let fake_lib = IFakeLibLibraryDispatcher { class_hash: fake_lib_class_hash };
    let result = fake_lib.func_1();
    assert!(result == 42);
}
