use starknet::{ClassHash, ContractAddress};

/// Cursor to track resumable deployment progress.
///
/// The goal here is to allow the factory to deploy huge worlds in
/// multiple transactions, with an internal management of the deployment.
///
/// Having the `version` and the `name` as keys allows to have multiple deployments
/// of the same version for different worlds, deployed concurrently.
#[dojo::model]
pub struct FactoryDeploymentCursor {
    /// The version of the factory configuration used during the deployment.
    #[key]
    pub version: felt252,
    /// The name of the deployed world.
    #[key]
    pub name: felt252,
    /// The address of the deployed world.
    pub world_address: Option<ContractAddress>,
    /// Factory config revision captured at deployment start.
    ///
    /// Resume calls must match this revision, otherwise deployment aborts.
    pub config_revision: u64,
    /// The cursor for contract setup (registration + permissions).
    pub contract_cursor: u64,
    /// The cursor for the libraries, counting the number of libraries registered.
    pub library_cursor: u64,
    /// The cursor for the models, counting the number of models registered.
    pub model_cursor: u64,
    /// The cursor for the events, counting the number of events registered.
    pub event_cursor: u64,
    /// The total number of actions performed during the deployment.
    ///
    /// Contract init progress is derived from this value once
    /// contracts/libraries/models/events registration phases complete.
    pub total_actions: u64,
    /// Whether the deployment is completed.
    pub completed: bool,
}

/// Configuration for a contract to be registered.
///
/// It is important to note that by default, the factory
/// will give the writer permission to all contracts on the default namespace.
#[derive(Serde, Copy, Debug, Introspect, DojoStore, Drop)]
pub struct FactoryConfigContractData {
    /// The selector of the contract.
    pub selector: felt252,
    /// The class hash of the contract (must be declared before).
    pub class_hash: ClassHash,
    /// The init arguments of the contract.
    pub init_args: Span<felt252>,
}

/// Configuration for a library to be registered.
#[derive(Serde, Clone, Debug, Introspect, DojoStore, Drop)]
pub struct FactoryConfigLibraryData {
    /// The class hash of the library (must be declared before).
    pub class_hash: ClassHash,
    /// The name of the library.
    pub name: ByteArray,
    /// The version of the library.
    pub version: ByteArray,
}

/// Contract entry at a given index for a factory config version.
#[dojo::model]
pub struct FactoryConfigContract {
    /// The version of the factory configuration.
    #[key]
    pub version: felt252,
    /// The index of the contract in the config list.
    #[key]
    pub index: u64,
    /// The selector of the contract.
    pub selector: felt252,
    /// The class hash of the contract.
    pub class_hash: ClassHash,
    /// The init arguments of the contract.
    pub init_args: Span<felt252>,
}

/// Model class hash entry at a given index for a factory config version.
#[dojo::model]
pub struct FactoryConfigModel {
    /// The version of the factory configuration.
    #[key]
    pub version: felt252,
    /// The index of the model in the config list.
    #[key]
    pub index: u64,
    /// The model class hash.
    pub class_hash: ClassHash,
}

/// Event class hash entry at a given index for a factory config version.
#[dojo::model]
pub struct FactoryConfigEvent {
    /// The version of the factory configuration.
    #[key]
    pub version: felt252,
    /// The index of the event in the config list.
    #[key]
    pub index: u64,
    /// The event class hash.
    pub class_hash: ClassHash,
}

/// Library entry at a given index for a factory config version.
#[dojo::model]
pub struct FactoryConfigLibrary {
    /// The version of the factory configuration.
    #[key]
    pub version: felt252,
    /// The index of the library in the config list.
    #[key]
    pub index: u64,
    /// The class hash of the library.
    pub class_hash: ClassHash,
    /// The library name.
    pub name: ByteArray,
    /// The library version.
    pub library_version: ByteArray,
}

/// Configuration for the factory that will be used to deploy a world.
#[derive(Clone)]
#[dojo::model]
pub struct FactoryConfig {
    /// The version of the factory configuration.
    #[key]
    pub version: felt252,
    /// The class hash of the world contract to deploy (must be declared before).
    pub world_class_hash: ClassHash,
    /// The default namespace to use for the world.
    pub default_namespace: ByteArray,
    /// If the factory should give the writer permission to all contracts on the default namespace.
    /// It is recommended to use true if you don't want to specify the writer permission for each
    /// contract when they all need to write to models.
    pub default_namespace_writer_all: bool,
    /// Owner of this factory config version.
    pub owner: ContractAddress,
    /// Monotonic revision of this config.
    ///
    /// Incremented on every `set_factory_config*` call.
    pub revision: u64,
    /// Number of configured contracts in index dictionary storage.
    pub contracts_len: u64,
    /// Number of configured models in index dictionary storage.
    pub models_len: u64,
    /// Number of configured events in index dictionary storage.
    pub events_len: u64,
    /// Number of configured libraries in index dictionary storage.
    pub libraries_len: u64,
}
