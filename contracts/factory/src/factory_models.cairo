use starknet::{ClassHash, ContractAddress};

/// Cursor to track the deployment of contracts, models, and events.
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
    /// The cursor for the contracts, counting the number of contracts registered.
    pub contract_cursor: u64,
    /// The cursor for the libraries, counting the number of libraries registered.
    pub library_cursor: u64,
    /// The cursor for the models, counting the number of models registered.
    pub model_cursor: u64,
    /// The cursor for the events, counting the number of events registered.
    pub event_cursor: u64,
    /// The cursor for the permissions, counting the number of permissions granted.
    pub permission_cursor: u64,
    /// The cursor for the dojo init, counting the number of dojo init calls.
    pub init_cursor: u64,
    /// The total number of actions performed during the deployment.
    pub total_actions: u64,
    /// Whether the deployment is completed.
    pub completed: bool,
}

/// Configuration for a contract to be registered.
///
/// It is important to note that by default, the factory
/// will give the writer permission to all contracts on the default namespace.
#[derive(Serde, Copy, Debug, Introspect, DojoStore, Drop)]
pub struct FactoryConfigContract {
    /// The selector of the contract.
    pub selector: felt252,
    /// The class hash of the contract (must be declared before).
    pub class_hash: ClassHash,
    /// The init arguments of the contract.
    pub init_args: Span<felt252>,
    /// The resources on which the contract must be granted writer permission.
    pub writer_of_resources: Span<felt252>,
    /// The resources on which the contract must be granted owner permission.
    pub owner_of_resources: Span<felt252>,
}

/// Configuration for a library to be registered.
#[derive(Serde, Clone, Debug, Introspect, DojoStore, Drop)]
pub struct FactoryConfigLibrary {
    /// The class hash of the library (must be declared before).
    pub class_hash: ClassHash,
    /// The name of the library.
    pub name: ByteArray,
    /// The version of the library.
    pub version: ByteArray,
}

/// Configuration for the factory that will be used to deploy a world.
#[derive(Clone)]
#[dojo::model]
pub struct FactoryConfig {
    /// The version of the factory configuration.
    #[key]
    pub version: felt252,
    /// The maximum number of actions to perform during the deployment.
    /// Currently, a good value for reasonable projects is 20.
    pub max_actions: u64,
    /// The class hash of the world contract to deploy (must be declared before).
    pub world_class_hash: ClassHash,
    /// The default namespace to use for the world.
    pub default_namespace: ByteArray,
    /// If the factory should give the writer permission to all contracts on the default namespace.
    /// It is recommended to use true if you don't want to specify the writer permission for each
    /// contract when they all need to write to models.
    pub default_namespace_writer_all: bool,
    /// Contracts to be registered (and must be declared before).
    /// (selector, class_hash, init_args)
    pub contracts: Array<FactoryConfigContract>,
    /// Models to be registered.
    pub models: Array<ClassHash>,
    /// Events to be registered.
    pub events: Array<ClassHash>,
    /// Libraries to be registered.
    pub libraries: Array<FactoryConfigLibrary>,
}

/// Configuration for the factory that will be used to deploy a world.
#[dojo::model]
pub struct FactoryConfigOwner {
    /// The version of the factory configuration.
    #[key]
    pub version: felt252,
    /// The address of the owner of the config.
    ///
    /// This is used to ensure that only the owner of the config can edit it.
    pub contract_address: ContractAddress,
}
