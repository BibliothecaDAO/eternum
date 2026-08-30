use core::num::traits::Zero;
use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use starknet::ContractAddress;
use crate::constants::WORLD_CONFIG_ID;
use crate::models::config::ChainConfig;

#[starknet::interface]
pub trait IPlayerRegistry<TState> {
    fn owner_of(self: @TState, account: ContractAddress) -> ContractAddress;
}

#[derive(Copy, Drop, Serde, Introspect)]
#[dojo::model]
pub struct LedgerRegistration {
    #[key]
    pub game_id: u32,
    #[key]
    pub owner: ContractAddress,
    pub realm_id: u256,
    pub metadata: (felt252, felt252, felt252),
    pub registered: bool,
}

#[generate_trait]
pub impl LedgerRegistrationImpl of LedgerRegistrationTrait {
    fn owner_for_account(world: WorldStorage, account: ContractAddress) -> ContractAddress {
        let chain_config: ChainConfig = world.read_model(WORLD_CONFIG_ID);
        assert!(chain_config.player_registry_address.is_non_zero(), "Eternum: player registry is not configured");
        let owner = IPlayerRegistryDispatcher { contract_address: chain_config.player_registry_address }
            .owner_of(account);
        assert!(owner.is_non_zero(), "Eternum: gameplay account is not bound");
        owner
    }

    fn for_account(world: WorldStorage, game_id: u32, account: ContractAddress) -> LedgerRegistration {
        let owner = Self::owner_for_account(world, account);
        let registration: LedgerRegistration = world.read_model((game_id, owner));
        assert!(registration.registered, "Eternum: ledger registration is required");
        registration
    }
}
