use starknet::{ClassHash, ContractAddress};
use crate::factory_models::{FactoryConfigContract, FactoryConfigLibrary};

/// Interface for the world factory.
#[starknet::interface]
pub trait IWorldFactory<T> {
    /// Deploys a new world and returns its address.
    ///
    /// This entrypoint must be called multiple times until the deployment is completed.
    /// To know if the deployment is completed, you can check the `completed` field of the
    /// `FactoryDeploymentCursor` model, or expect a transaction to revert with the error
    /// `DEPLOYMENT_ALREADY_COMPLETED`.
    ///
    /// # Arguments
    ///
    /// * `name` - The name of the world.
    /// * `factory_config_version` - The version of the factory configuration set using the
    /// `set_config` entrypoint.
    fn create_game(
        ref self: T,
        game_name: felt252,
        factory_config_version: felt252,
        series_name: felt252,
        series_game_number: u16,
    );

    /// Sets the non-array configuration fields of the factory.
    ///
    /// This call must be done first. It records/validates the config owner,
    /// which is then used by the array-specific setters.
    ///
    /// # Arguments
    ///
    /// * `version` - The configuration version key.
    /// * `max_actions` - Max actions performed per `create_game` transaction.
    /// * `world_class_hash` - Class hash for world deployment.
    /// * `default_namespace` - Default namespace used for registration.
    /// * `default_namespace_writer_all` - Whether to grant namespace writer to all contracts.
    fn set_factory_config(
        ref self: T,
        version: felt252,
        max_actions: u64,
        world_class_hash: ClassHash,
        default_namespace: ByteArray,
        default_namespace_writer_all: bool,
    );

    /// Appends contract registration entries for a config version, starting at `start_index`.
    ///
    /// If `start_index` is 0, the contracts list is reset before appending.
    fn set_factory_config_contracts(
        ref self: T, version: felt252, start_index: usize, contracts: Array<FactoryConfigContract>,
    );

    /// Appends model registration entries for a config version, starting at `start_index`.
    ///
    /// If `start_index` is 0, the model list is reset before appending.
    fn set_factory_config_models(
        ref self: T, version: felt252, start_index: usize, models: Array<ClassHash>,
    );

    /// Appends event registration entries for a config version, starting at `start_index`.
    ///
    /// If `start_index` is 0, the events list is reset before appending.
    fn set_factory_config_events(
        ref self: T, version: felt252, start_index: usize, events: Array<ClassHash>,
    );

    /// Appends library registration entries for a config version, starting at `start_index`.
    ///
    /// If `start_index` is 0, the libraries list is reset before appending.
    fn set_factory_config_libraries(
        ref self: T, version: felt252, start_index: usize, libraries: Array<FactoryConfigLibrary>,
    );
}


/// Interface for the world factory.
#[starknet::interface]
pub trait IWorldFactorySeries<T> {
    fn set_series_config(ref self: T, name: felt252);

    fn get_series_game_data(self: @T, addr: ContractAddress) -> (felt252, u16);
    fn get_series_game_address_by_selector(
        self: @T, name: felt252, game_number: u16, selector: felt252,
    ) -> ContractAddress;
    fn get_series_game_address_by_class_hash(
        self: @T, name: felt252, game_number: u16, class_hash: ClassHash,
    ) -> ContractAddress;
    fn get_all_series_game_addresses_by_selector(
        self: @T, name: felt252, contract_selector: felt252,
    ) -> Array<ContractAddress>;
    fn get_all_series_game_addresses_by_class_hash(
        self: @T, name: felt252, class_hash: ClassHash,
    ) -> Array<ContractAddress>;
}

/// Interface for the world factory.
#[starknet::interface]
pub trait IWorldFactoryMMR<T> {
    fn get_factory_mmr_contract_version(self: @T, addr: ContractAddress) -> felt252;
}
