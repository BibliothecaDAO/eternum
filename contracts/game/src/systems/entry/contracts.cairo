use starknet::ContractAddress;

#[starknet::interface]
pub trait IEntrySystems<TState> {
    fn register_from_l2(
        ref self: TState, game_id: u32, owner: ContractAddress, realm_id: u256, metadata: (felt252, felt252, felt252),
    );
}

#[dojo::contract]
pub mod entry_systems {
    use core::num::traits::Zero;
    use dojo::model::ModelStorage;
    use dojo::world::WorldStorage;
    use starknet::ContractAddress;
    use crate::constants::{DEFAULT_NS, WORLD_CONFIG_ID};
    use crate::models::config::ChainConfig;
    use crate::models::ledger::LedgerRegistration;
    use super::IEntrySystems;

    #[abi(embed_v0)]
    impl EntrySystemsImpl of IEntrySystems<ContractState> {
        fn register_from_l2(
            ref self: ContractState,
            game_id: u32,
            owner: ContractAddress,
            realm_id: u256,
            metadata: (felt252, felt252, felt252),
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let chain_config: ChainConfig = world.read_model(WORLD_CONFIG_ID);
            assert!(
                starknet::get_caller_address() == chain_config.ledger_operator_address,
                "Eternum: caller is not the ledger operator",
            );
            assert!(game_id != 0, "Eternum: game id 0 is reserved");
            assert!(owner.is_non_zero(), "Eternum: ledger owner is zero");

            let existing: LedgerRegistration = world.read_model((game_id, owner));
            if existing.registered {
                assert!(
                    existing.realm_id == realm_id && existing.metadata == metadata,
                    "Eternum: conflicting ledger registration",
                );
                return;
            }

            world.write_model(@LedgerRegistration { game_id, owner, realm_id, metadata, registered: true });
        }
    }
}
