use core::num::traits::Zero;
use dojo::model::ModelStorage;
use dojo::world::{IWorldDispatcher, WorldStorage, WorldStorageTrait};
use dojo_snf_test::{
    ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait, spawn_test_world,
};
use fake_lib::{IFakeLibDispatcherTrait, IFakeLibLibraryDispatcher};
use fake_world::{IMyContractDispatcher, IMyContractDispatcherTrait, ModelA};
use snforge_std::{CheatSpan, DeclareResultTrait, cheat_caller_address, declare};
use starknet::ClassHash;
use world_factory::factory_models::{
    FactoryConfig, FactoryConfigContract, FactoryConfigLibrary, FactoryDeploymentCursor,
};
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

fn set_factory_config_full(factory: IWorldFactoryDispatcher, config: FactoryConfig) {
    factory
        .set_factory_config(
            config.version,
            config.max_actions,
            config.world_class_hash,
            config.default_namespace.clone(),
            config.default_namespace_writer_all,
        );
    factory.set_factory_config_contracts(config.version, 0, config.contracts.clone());
    factory.set_factory_config_models(config.version, 0, config.models.clone());
    factory.set_factory_config_events(config.version, 0, config.events.clone());
    factory.set_factory_config_libraries(config.version, 0, config.libraries.clone());
}

fn set_factory_config_arrays_chunked(factory: IWorldFactoryDispatcher, config: FactoryConfig) {
    let mut first_contracts: Array<FactoryConfigContract> = array![];
    let mut second_contracts: Array<FactoryConfigContract> = array![];
    let mut contract_idx: usize = 0;
    for contract in config.contracts.span() {
        if contract_idx % 2_usize == 0 {
            first_contracts.append(*contract);
        } else {
            second_contracts.append(*contract);
        }
        contract_idx += 1;
    }

    let mut first_models: Array<ClassHash> = array![];
    let mut second_models: Array<ClassHash> = array![];
    let mut model_idx: usize = 0;
    for model in config.models.span() {
        if model_idx % 2_usize == 0 {
            first_models.append(*model);
        } else {
            second_models.append(*model);
        }
        model_idx += 1;
    }

    let mut first_events: Array<ClassHash> = array![];
    let mut second_events: Array<ClassHash> = array![];
    let mut event_idx: usize = 0;
    for event in config.events.span() {
        if event_idx % 2_usize == 0 {
            first_events.append(*event);
        } else {
            second_events.append(*event);
        }
        event_idx += 1;
    }

    let mut first_libraries: Array<FactoryConfigLibrary> = array![];
    let mut second_libraries: Array<FactoryConfigLibrary> = array![];
    let mut library_idx: usize = 0;
    for library in config.libraries.span() {
        if library_idx % 2_usize == 0 {
            first_libraries.append(library.clone());
        } else {
            second_libraries.append(library.clone());
        }
        library_idx += 1;
    }

    factory.set_factory_config_contracts(config.version, 0, first_contracts.clone());
    factory.set_factory_config_contracts(config.version, first_contracts.len(), second_contracts.clone());

    factory.set_factory_config_models(config.version, 0, first_models.clone());
    factory.set_factory_config_models(config.version, first_models.len(), second_models.clone());

    factory.set_factory_config_events(config.version, 0, first_events.clone());
    factory.set_factory_config_events(config.version, first_events.len(), second_events.clone());

    factory.set_factory_config_libraries(config.version, 0, first_libraries.clone());
    factory
        .set_factory_config_libraries(config.version, first_libraries.len(), second_libraries.clone());
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

    set_factory_config_full(factory, factory_config);

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

    set_factory_config_full(factory, factory_config.clone());

    cheat_caller_address(
        factory.contract_address, 'OTHER_CONTRACT'.try_into().unwrap(), CheatSpan::TargetCalls(1),
    );

    factory
        .set_factory_config(
            factory_config.version,
            factory_config.max_actions,
            factory_config.world_class_hash,
            factory_config.default_namespace.clone(),
            factory_config.default_namespace_writer_all,
        );
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

    set_factory_config_full(factory, factory_config);

    factory.create_game('world_1', 1, 0, 0);

    let cursor: FactoryDeploymentCursor = factory_world.read_model((1, 'world_1'));
    assert!(cursor.completed == true);

    // Ensure the cursors are well separated even if the same config is used.
    let cursor: FactoryDeploymentCursor = factory_world.read_model((1, 'world_2'));
    assert!(cursor.completed == false);

    factory.create_game('world_2', 1, 0, 0);

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

    set_factory_config_full(factory, factory_config);

    factory.create_game('world_1', 1, 0, 0);

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

#[test]
fn test_factory_config_arrays_chunked() {
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

    factory
        .set_factory_config(
            factory_config.version,
            factory_config.max_actions,
            factory_config.world_class_hash,
            factory_config.default_namespace.clone(),
            factory_config.default_namespace_writer_all,
        );

    set_factory_config_arrays_chunked(factory, factory_config.clone());

    let config: FactoryConfig = factory_world.read_model(1);
    assert!(config.contracts.len() == factory_config.contracts.len());
    assert!(config.models.len() == factory_config.models.len());
    assert!(config.events.len() == factory_config.events.len());
    assert!(config.libraries.len() == factory_config.libraries.len());
}

#[test]
#[should_panic(expected: 'invalid contracts start index')]
fn test_factory_config_contracts_chunk_start_index_validation() {
    let (factory, _factory_world) = deploy_factory();

    let world_class_hash = declare("world").unwrap().contract_class().class_hash;

    factory
        .set_factory_config(
            1,
            5,
            *world_class_hash,
            "ns",
            true,
        );

    let empty_contracts: Array<FactoryConfigContract> = array![];
    factory.set_factory_config_contracts(1, 1, empty_contracts);
}

#[test]
#[should_panic(expected: 'invalid models start index')]
fn test_factory_config_models_chunk_start_index_validation() {
    let (factory, _factory_world) = deploy_factory();

    let fake_world_resources = fake_world::declare_fake_world();
    let world_class_hash = declare("world").unwrap().contract_class().class_hash;

    factory
        .set_factory_config(
            1,
            5,
            *world_class_hash,
            "ns",
            true,
        );

    let mut chunk: Array<ClassHash> = array![];
    for model in fake_world_resources.models.span() {
        chunk.append(*model);
        break;
    }

    factory.set_factory_config_models(1, 1, chunk);
}

#[test]
#[should_panic(expected: 'invalid events start index')]
fn test_factory_config_events_chunk_start_index_validation() {
    let (factory, _factory_world) = deploy_factory();

    let world_class_hash = declare("world").unwrap().contract_class().class_hash;

    factory
        .set_factory_config(
            1,
            5,
            *world_class_hash,
            "ns",
            true,
        );

    let empty_events: Array<ClassHash> = array![];
    factory.set_factory_config_events(1, 1, empty_events);
}

#[test]
#[should_panic(expected: 'invalid libraries start index')]
fn test_factory_config_libraries_chunk_start_index_validation() {
    let (factory, _factory_world) = deploy_factory();

    let world_class_hash = declare("world").unwrap().contract_class().class_hash;

    factory
        .set_factory_config(
            1,
            5,
            *world_class_hash,
            "ns",
            true,
        );

    let empty_libraries: Array<FactoryConfigLibrary> = array![];
    factory.set_factory_config_libraries(1, 1, empty_libraries);
}
