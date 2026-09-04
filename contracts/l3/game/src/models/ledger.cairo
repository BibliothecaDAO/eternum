use core::num::traits::Zero;
use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use starknet::ContractAddress;
use crate::constants::WORLD_CONFIG_ID;
use crate::models::config::ChainConfig;

pub const CASH_REGISTRATION: u8 = 0;
pub const SEASON_PASS_REGISTRATION: u8 = 1;
pub const VILLAGE_PASS_REGISTRATION: u8 = 2;

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
    pub pass_kind: u8,
    pub registered: bool,
}

#[generate_trait]
pub impl LedgerRegistrationImpl of LedgerRegistrationTrait {
    /// The value plane exists on this chain only when a ledger operator is configured to
    /// relay paid mainnet registrations. Without one, entry is open and results belong to
    /// the player; `dev_mode_on` only relaxes the clock.
    fn entry_requires_ledger(world: WorldStorage) -> bool {
        let chain_config: ChainConfig = world.read_model(WORLD_CONFIG_ID);
        chain_config.ledger_operator_address.is_non_zero()
    }

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

    fn for_season_account(world: WorldStorage, game_id: u32, account: ContractAddress) -> LedgerRegistration {
        let registration = Self::for_account(world, game_id, account);
        registration.assert_season();
        registration
    }

    fn for_village_account(
        world: WorldStorage, game_id: u32, account: ContractAddress, village_pass_token_id: u16,
    ) -> LedgerRegistration {
        let registration = Self::for_account(world, game_id, account);
        registration.assert_village(village_pass_token_id);
        registration
    }

    fn assert_season(self: LedgerRegistration) {
        assert!(self.pass_kind == SEASON_PASS_REGISTRATION, "Eternum: season pass registration is required");
    }

    fn assert_village(self: LedgerRegistration, village_pass_token_id: u16) {
        assert!(self.pass_kind == VILLAGE_PASS_REGISTRATION, "Eternum: village pass registration is required");
        assert!(self.realm_id == village_pass_token_id.into(), "Eternum: village pass id mismatch");
    }
}
