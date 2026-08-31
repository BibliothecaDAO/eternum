//! MMR-specific hooks for factory deployment.

use dojo::model::ModelStorage;
use starknet::ContractAddress;
use crate::constants::MMR_SYSTEMS_SELECTOR;
use crate::mmr_models::MMRRegistration;

#[generate_trait]
pub impl FactoryMmrImpl of FactoryMmrTrait {
    /// Registers the deployed contract as an MMR registration when selector matches.
    ///
    /// No-op for non-MMR selectors.
    fn on_contract_registered(
        ref factory_world: dojo::world::WorldStorage,
        selector: felt252,
        contract_address: ContractAddress,
        version: felt252,
    ) {
        if selector == MMR_SYSTEMS_SELECTOR {
            factory_world.write_model(@MMRRegistration { address: contract_address, version });
        }
    }
}
