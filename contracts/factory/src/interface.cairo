use starknet::{ClassHash, ContractAddress, class_hash};
use crate::factory_models::FactoryConfig;

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

    /// Sets the configuration of the factory.
    ///
    /// TODO: currently `FactoryConfig` is a big model, where the 300 felts limit may be reached
    /// for very large worlds. This will need to be split into multiple models to not
    /// limit large worlds for using the factory.
    ///
    /// To ensure that once a config is set, only the writer of the config can edit it,
    /// the factory will check if the caller address is the writer of the config if it is
    /// already set (owner_address being non-zero).
    ///
    /// # Arguments
    ///
    /// * `config` - The configuration of the factory.
    fn set_factory_config(ref self: T, config: FactoryConfig);
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
