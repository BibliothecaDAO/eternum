use starknet::{ClassHash, ContractAddress};
use crate::factory_models::{FactoryConfigContractData, FactoryConfigLibraryData};

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
    /// * `max_actions` - Max actions performed in this `create_game` transaction.
    /// * `factory_config_version` - The version of the factory configuration set using the
    /// `set_config` entrypoint.
    fn create_game(
        ref self: T,
        game_name: felt252,
        max_actions: u64,
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
    /// * `world_class_hash` - Class hash for world deployment.
    /// * `default_namespace` - Default namespace used for registration.
    /// * `default_namespace_writer_all` - Whether to grant namespace writer to all contracts.
    fn set_factory_config(
        ref self: T,
        version: felt252,
        world_class_hash: ClassHash,
        default_namespace: ByteArray,
        default_namespace_writer_all: bool,
    );

    /// Sets the contracts list for a config version.
    ///
    /// # Arguments
    ///
    /// * `version` - The configuration version key.
    /// * `contracts` - Full contracts list.
    fn set_factory_config_contracts(
        ref self: T, version: felt252, contracts: Array<FactoryConfigContractData>,
    );

    /// Sets the models list for a config version.
    ///
    /// # Arguments
    ///
    /// * `version` - The configuration version key.
    /// * `models` - Full models list.
    fn set_factory_config_models(ref self: T, version: felt252, models: Array<ClassHash>);

    /// Sets the events list for a config version.
    ///
    /// # Arguments
    ///
    /// * `version` - The configuration version key.
    /// * `events` - Full events list.
    fn set_factory_config_events(ref self: T, version: felt252, events: Array<ClassHash>);

    /// Sets the libraries list for a config version.
    ///
    /// # Arguments
    ///
    /// * `version` - The configuration version key.
    /// * `libraries` - Full libraries list.
    fn set_factory_config_libraries(
        ref self: T, version: felt252, libraries: Array<FactoryConfigLibraryData>,
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
