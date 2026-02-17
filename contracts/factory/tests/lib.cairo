use core::array::ArrayTrait;
use core::num::traits::Zero;
use dojo::model::ModelStorage;
use dojo::world::{IWorldDispatcher, WorldStorage, WorldStorageTrait};
use dojo_snf_test::{
    ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait, spawn_test_world,
};
use fake_lib::{IFakeLibDispatcherTrait, IFakeLibLibraryDispatcher};
use fake_world::{IMyContractDispatcher, IMyContractDispatcherTrait, ModelA};
use snforge_std::{CheatSpan, DeclareResultTrait, cheat_caller_address, declare};
use world_factory::constants::MMR_SYSTEMS_SELECTOR;
use world_factory::factory_mmr::FactoryMmrImpl;
use world_factory::factory_models::{
    FactoryConfig, FactoryConfigContract, FactoryConfigLibrary, FactoryDeploymentCursor,
};
use world_factory::factory_sync::FactoryConfigSyncImpl;
use world_factory::interface::{
    IWorldFactoryDispatcher, IWorldFactoryDispatcherTrait, IWorldFactoryMMRDispatcher,
    IWorldFactoryMMRDispatcherTrait, IWorldFactorySeriesDispatcher,
    IWorldFactorySeriesDispatcherTrait,
};
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
            TestResource::Model("FactoryConfigContract"), TestResource::Model("FactoryConfigModel"),
            TestResource::Model("FactoryConfigEvent"), TestResource::Model("FactoryConfigLibrary"),
            TestResource::Model("Series"), TestResource::Model("SeriesContract"),
            TestResource::Model("SeriesContractBySelector"), TestResource::Model("SeriesGame"),
            TestResource::Model("MMRRegistration"), TestResource::Model("WorldContract"),
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

fn set_factory_config_full(
    factory: IWorldFactoryDispatcher,
    config: FactoryConfig,
    fake_world_resources: @fake_world::FakeWorldResources,
) {
    factory
        .set_factory_config(
            config.version,
            config.world_class_hash,
            config.default_namespace.clone(),
            config.default_namespace_writer_all,
        );
    factory.set_factory_config_contracts(config.version, fake_world_resources.contracts.clone());
    factory.set_factory_config_models(config.version, fake_world_resources.models.clone());
    factory.set_factory_config_events(config.version, fake_world_resources.events.clone());
    factory.set_factory_config_libraries(config.version, fake_world_resources.libraries.clone());
}

#[test]
fn test_factory_config() {
    let (factory, factory_world) = deploy_factory();

    let fake_world_resources = fake_world::declare_fake_world();

    let world_class_hash = declare("world").unwrap().contract_class().class_hash;

    let default_namespace: ByteArray = "ns";

    let factory_config = FactoryConfig {
        version: 1,
        world_class_hash: *world_class_hash,
        default_namespace,
        default_namespace_writer_all: true,
        owner: Zero::zero(),
        revision: 0,
        contracts_len: 0,
        models_len: 0,
        events_len: 0,
        libraries_len: 0,
    };

    set_factory_config_full(factory, factory_config, @fake_world_resources);

    let config: FactoryConfig = factory_world.read_model(1);
    assert!(config.version == 1, "version should be 1");
    assert!(config.world_class_hash == *world_class_hash);
    assert!(config.default_namespace == "ns");
    assert!(config.default_namespace_writer_all == true);
    assert!(config.owner.is_non_zero());
    assert!(config.contracts_len == 1);
    assert!(config.models_len == 1);
    assert!(config.events_len == 0);
    assert!(config.libraries_len == 1);
    assert!(config.revision == 5);

    let contract_idx_0: FactoryConfigContract = factory_world.read_model((1, 0));
    assert!(contract_idx_0.selector == selector_from_tag!("ns-my_contract"));

    let library_idx_0: FactoryConfigLibrary = factory_world.read_model((1, 0));
    assert!(library_idx_0.name == "fake_library");
    assert!(library_idx_0.library_version == "1_0_0");
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
        world_class_hash: *world_class_hash,
        default_namespace,
        default_namespace_writer_all: true,
        owner: Zero::zero(),
        revision: 0,
        contracts_len: 0,
        models_len: 0,
        events_len: 0,
        libraries_len: 0,
    };

    set_factory_config_full(factory, factory_config.clone(), @fake_world_resources);

    cheat_caller_address(
        factory.contract_address, 'OTHER_CONTRACT'.try_into().unwrap(), CheatSpan::TargetCalls(1),
    );

    factory
        .set_factory_config(
            factory_config.version,
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
        world_class_hash: *world_class_hash,
        default_namespace,
        default_namespace_writer_all: true,
        owner: Zero::zero(),
        revision: 0,
        contracts_len: 0,
        models_len: 0,
        events_len: 0,
        libraries_len: 0,
    };

    set_factory_config_full(factory, factory_config, @fake_world_resources);

    factory.create_game('world_1', 10, 1, 0, 0);

    let cursor: FactoryDeploymentCursor = factory_world.read_model((1, 'world_1'));
    assert!(cursor.completed == true);

    // Ensure the cursors are well separated even if the same config is used.
    let cursor: FactoryDeploymentCursor = factory_world.read_model((1, 'world_2'));
    assert!(cursor.completed == false);

    factory.create_game('world_2', 10, 1, 0, 0);

    let cursor: FactoryDeploymentCursor = factory_world.read_model((1, 'world_2'));
    assert!(cursor.completed == true);
}

#[test]
fn test_factory_create_game_progression_consistent() {
    let (factory, factory_world) = deploy_factory();

    let fake_world_resources = fake_world::declare_fake_world();
    let world_class_hash = declare("world").unwrap().contract_class().class_hash;

    let factory_config = FactoryConfig {
        version: 1,
        world_class_hash: *world_class_hash,
        default_namespace: "ns",
        default_namespace_writer_all: true,
        owner: Zero::zero(),
        revision: 0,
        contracts_len: 0,
        models_len: 0,
        events_len: 0,
        libraries_len: 0,
    };
    set_factory_config_full(factory, factory_config, @fake_world_resources);

    let mut rounds: u8 = 0;
    loop {
        assert!(rounds < 20_u8);

        let legacy_before: FactoryDeploymentCursor = factory_world.read_model((1, 'world_legacy'));
        if !legacy_before.completed {
            factory.create_game('world_legacy', 1, 1, 0, 0);
        }

        let two_before: FactoryDeploymentCursor = factory_world.read_model((1, 'world_two'));
        if !two_before.completed {
            factory.create_game('world_two', 1, 1, 0, 0);
        }

        let legacy_after: FactoryDeploymentCursor = factory_world.read_model((1, 'world_legacy'));
        let two_after: FactoryDeploymentCursor = factory_world.read_model((1, 'world_two'));

        assert!(legacy_after.contract_cursor == two_after.contract_cursor);
        assert!(legacy_after.library_cursor == two_after.library_cursor);
        assert!(legacy_after.model_cursor == two_after.model_cursor);
        assert!(legacy_after.event_cursor == two_after.event_cursor);
        assert!(legacy_after.total_actions == two_after.total_actions);
        assert!(legacy_after.completed == two_after.completed);

        let legacy_has_world = if let Some(_world_address) = legacy_after.world_address {
            true
        } else {
            false
        };
        let two_has_world = if let Some(_world_address) = two_after.world_address {
            true
        } else {
            false
        };
        assert!(legacy_has_world == two_has_world);

        if legacy_after.completed && two_after.completed {
            break;
        }

        rounds += 1;
    }

    let legacy_world: WorldDeployed = factory_world.read_model('world_legacy');
    let two_world: WorldDeployed = factory_world.read_model('world_two');
    assert!(legacy_world.address.is_non_zero());
    assert!(two_world.address.is_non_zero());

    let selector = dojo::utils::selector_from_names(@"ns", @"my_contract");
    let legacy_contract: WorldContract = factory_world.read_model(('world_legacy', selector));
    let two_contract: WorldContract = factory_world.read_model(('world_two', selector));
    assert!(legacy_contract.contract_address.is_non_zero());
    assert!(two_contract.contract_address.is_non_zero());

    let legacy_world_d = IWorldDispatcher { contract_address: legacy_world.address };
    let legacy_world_storage = WorldStorageTrait::new(legacy_world_d, @"ns");
    let two_world_d = IWorldDispatcher { contract_address: two_world.address };
    let two_world_storage = WorldStorageTrait::new(two_world_d, @"ns");

    let legacy_my_contract = IMyContractDispatcher {
        contract_address: legacy_contract.contract_address,
    };
    legacy_my_contract.set_model_a(0xA1, 0x111);
    let legacy_model: ModelA = legacy_world_storage.read_model(0xA1);
    assert!(legacy_model.value == 0x111);

    let two_my_contract = IMyContractDispatcher { contract_address: two_contract.contract_address };
    two_my_contract.set_model_a(0xA2, 0x222);
    let two_model: ModelA = two_world_storage.read_model(0xA2);
    assert!(two_model.value == 0x222);

    let (_, legacy_lib_class_hash) = legacy_world_storage
        .dns(@"fake_library_v1_0_0")
        .expect('fake library not found');
    let (_, two_lib_class_hash) = two_world_storage
        .dns(@"fake_library_v1_0_0")
        .expect('fake library not found');
    let legacy_lib = IFakeLibLibraryDispatcher { class_hash: legacy_lib_class_hash };
    let two_lib = IFakeLibLibraryDispatcher { class_hash: two_lib_class_hash };
    assert!(legacy_lib.func_1() == 42);
    assert!(two_lib.func_1() == 42);
}

#[test]
fn test_create_game_init_runs_after_model_registration() {
    let (factory, factory_world) = deploy_factory();

    let fake_world_resources = fake_world::declare_fake_world_with_init_writer();
    let world_class_hash = declare("world").unwrap().contract_class().class_hash;

    let factory_config = FactoryConfig {
        version: 1,
        world_class_hash: *world_class_hash,
        default_namespace: "ns",
        default_namespace_writer_all: true,
        owner: Zero::zero(),
        revision: 0,
        contracts_len: 0,
        models_len: 0,
        events_len: 0,
        libraries_len: 0,
    };
    set_factory_config_full(factory, factory_config, @fake_world_resources);

    // This call must not panic: init writes ModelA and depends on model registration first.
    factory.create_game('world_init_order', 10, 1, 0, 0);

    let world_deployed: WorldDeployed = factory_world.read_model('world_init_order');
    let deployed_world_d = IWorldDispatcher { contract_address: world_deployed.address };
    let deployed_world = WorldStorageTrait::new(deployed_world_d, @"ns");

    let init_model: ModelA = deployed_world.read_model(fake_world::INIT_MODEL_KEY);
    assert!(init_model.key == fake_world::INIT_MODEL_KEY);
    assert!(init_model.value == fake_world::INIT_MODEL_VALUE);
}

#[test]
#[should_panic(
    expected: "Resource `3558734213153825816343901818342339798954499484694493807285426724467092997144` is registered but not as model",
)]
fn test_create_game_init_runs_before_model_registration() {
    let (factory, mut factory_world) = deploy_factory();

    let fake_world_resources = fake_world::declare_fake_world_with_init_writer();
    let world_class_hash = declare("world").unwrap().contract_class().class_hash;

    let factory_config = FactoryConfig {
        version: 1,
        world_class_hash: *world_class_hash,
        default_namespace: "ns",
        default_namespace_writer_all: true,
        owner: Zero::zero(),
        revision: 0,
        contracts_len: 0,
        models_len: 0,
        events_len: 0,
        libraries_len: 0,
    };
    set_factory_config_full(factory, factory_config, @fake_world_resources);

    // Create resumable state after contract registration but before model registration.
    factory.create_game('world_bad_order', 1, 1, 0, 0);
    let mut cursor: FactoryDeploymentCursor = factory_world.read_model((1, 'world_bad_order'));
    let deployed_world = if let Some(world_address) = cursor.world_address {
        IWorldDispatcher { contract_address: world_address }
    } else {
        panic!("expected world to be deployed");
    };
    cheat_caller_address(
        deployed_world.contract_address, factory.contract_address, CheatSpan::TargetCalls(1),
    );

    // Calling init now reproduces the old sequencing bug (init before model registration).
    let _ = FactoryConfigSyncImpl::sync_contract_inits(
        1, 1, 0, 1, 0, ref factory_world, deployed_world, ref cursor, 10,
    );
}

#[test]
#[should_panic(expected: 'config changed during deploy')]
fn test_create_game_reverts_if_config_changes_mid_deployment() {
    let (factory, mut factory_world) = deploy_factory();

    let fake_world_resources = fake_world::declare_fake_world();
    let world_class_hash = declare("world").unwrap().contract_class().class_hash;

    let factory_config = FactoryConfig {
        version: 1,
        world_class_hash: *world_class_hash,
        default_namespace: "ns",
        default_namespace_writer_all: true,
        owner: Zero::zero(),
        revision: 0,
        contracts_len: 0,
        models_len: 0,
        events_len: 0,
        libraries_len: 0,
    };
    set_factory_config_full(factory, factory_config, @fake_world_resources);

    // Start a resumable deployment.
    factory.create_game('world_mutating_config', 1, 1, 0, 0);
    let cursor: FactoryDeploymentCursor = factory_world.read_model((1, 'world_mutating_config'));
    assert!(cursor.completed == false, "cursor should not be completed");

    // Mutate the config version while deployment is in progress.
    factory.set_factory_config_events(1, fake_world_resources.events.clone());

    // Resume must fail because cursor revision no longer matches config revision.
    factory.create_game('world_mutating_config', 1, 1, 0, 0);
}

#[test]
#[should_panic(expected: 'max actions must be > 0')]
fn test_create_game_zero_max_actions_reverts() {
    let (factory, _factory_world) = deploy_factory();

    let fake_world_resources = fake_world::declare_fake_world();
    let world_class_hash = declare("world").unwrap().contract_class().class_hash;

    let factory_config = FactoryConfig {
        version: 1,
        world_class_hash: *world_class_hash,
        default_namespace: "ns",
        default_namespace_writer_all: true,
        owner: Zero::zero(),
        revision: 0,
        contracts_len: 0,
        models_len: 0,
        events_len: 0,
        libraries_len: 0,
    };
    set_factory_config_full(factory, factory_config, @fake_world_resources);

    factory.create_game('world_zero_budget', 0, 1, 0, 0);
}

#[test]
#[should_panic(expected: 'deployment already completed')]
fn test_create_game_deployment_already_completed() {
    let (factory, _factory_world) = deploy_factory();

    let fake_world_resources = fake_world::declare_fake_world();
    let world_class_hash = declare("world").unwrap().contract_class().class_hash;

    let factory_config = FactoryConfig {
        version: 1,
        world_class_hash: *world_class_hash,
        default_namespace: "ns",
        default_namespace_writer_all: true,
        owner: Zero::zero(),
        revision: 0,
        contracts_len: 0,
        models_len: 0,
        events_len: 0,
        libraries_len: 0,
    };
    set_factory_config_full(factory, factory_config, @fake_world_resources);

    factory.create_game('world_1', 10, 1, 0, 0);
    factory.create_game('world_1', 10, 1, 0, 0);
}

#[test]
fn test_factory_deploy_and_confirm_world_deployed() {
    let (factory, factory_world) = deploy_factory();

    let fake_world_resources = fake_world::declare_fake_world();

    let world_class_hash = declare("world").unwrap().contract_class().class_hash;

    let default_namespace: ByteArray = "ns";

    let factory_config = FactoryConfig {
        version: 1,
        world_class_hash: *world_class_hash,
        default_namespace,
        default_namespace_writer_all: true,
        owner: Zero::zero(),
        revision: 0,
        contracts_len: 0,
        models_len: 0,
        events_len: 0,
        libraries_len: 0,
    };

    set_factory_config_full(factory, factory_config, @fake_world_resources);

    factory.create_game('world_1', 10, 1, 0, 0);

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
fn test_factory_series_interfaces() {
    let (factory, factory_world) = deploy_factory();
    let series_factory = IWorldFactorySeriesDispatcher {
        contract_address: factory.contract_address,
    };

    let fake_world_resources = fake_world::declare_fake_world();
    let world_class_hash = declare("world").unwrap().contract_class().class_hash;

    let factory_config = FactoryConfig {
        version: 1,
        world_class_hash: *world_class_hash,
        default_namespace: "ns",
        default_namespace_writer_all: true,
        owner: Zero::zero(),
        revision: 0,
        contracts_len: 0,
        models_len: 0,
        events_len: 0,
        libraries_len: 0,
    };
    set_factory_config_full(factory, factory_config, @fake_world_resources);

    series_factory.set_series_config('series_alpha');
    factory.create_game('series_world_1', 10, 1, 'series_alpha', 1);
    factory.create_game('series_world_2', 10, 1, 'series_alpha', 2);

    let config_contract: FactoryConfigContract = factory_world.read_model((1, 0));
    let selector = config_contract.selector;
    let class_hash = config_contract.class_hash;

    let world_1_contract: WorldContract = factory_world.read_model(('series_world_1', selector));
    let world_2_contract: WorldContract = factory_world.read_model(('series_world_2', selector));

    assert!(
        series_factory
            .get_series_game_address_by_selector('series_alpha', 1, selector) == world_1_contract
            .contract_address,
    );
    assert!(
        series_factory
            .get_series_game_address_by_selector('series_alpha', 2, selector) == world_2_contract
            .contract_address,
    );

    assert!(
        series_factory
            .get_series_game_address_by_class_hash(
                'series_alpha', 1, class_hash,
            ) == world_1_contract
            .contract_address,
    );
    assert!(
        series_factory
            .get_series_game_address_by_class_hash(
                'series_alpha', 2, class_hash,
            ) == world_2_contract
            .contract_address,
    );

    let (series_name, game_number) = series_factory
        .get_series_game_data(world_2_contract.contract_address);
    assert!(series_name == 'series_alpha');
    assert!(game_number == 2);

    let all_by_selector = series_factory
        .get_all_series_game_addresses_by_selector('series_alpha', selector);
    assert!(all_by_selector.len() == 2);
    assert!(*all_by_selector.at(0) == world_1_contract.contract_address);
    assert!(*all_by_selector.at(1) == world_2_contract.contract_address);

    let all_by_class_hash = series_factory
        .get_all_series_game_addresses_by_class_hash('series_alpha', class_hash);
    assert!(all_by_class_hash.len() == 2);
    assert!(*all_by_class_hash.at(0) == world_1_contract.contract_address);
    assert!(*all_by_class_hash.at(1) == world_2_contract.contract_address);
}

#[test]
fn test_factory_mmr_registration_interface() {
    let (factory, mut factory_world) = deploy_factory();
    let mmr_factory = IWorldFactoryMMRDispatcher { contract_address: factory.contract_address };

    let registered_contract = factory.contract_address;
    FactoryMmrImpl::on_contract_registered(
        ref factory_world, MMR_SYSTEMS_SELECTOR, registered_contract, 7,
    );

    let mmr_version = mmr_factory.get_factory_mmr_contract_version(registered_contract);
    assert!(mmr_version == 7);
}
