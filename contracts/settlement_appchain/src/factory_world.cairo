#[starknet::contract]
pub mod FactoryWorldSpike {
    use settlement_protocol::appchain_spike_interfaces::IFactoryWorldSpike;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};

    #[storage]
    struct Storage {
        game_id: felt252,
    }

    #[constructor]
    fn constructor(ref self: ContractState, game_id: felt252) {
        assert!(game_id != 0, "ZERO_GAME_ID");
        self.game_id.write(game_id);
    }

    #[abi(embed_v0)]
    impl FactoryWorldImpl of IFactoryWorldSpike<ContractState> {
        fn game_id(self: @ContractState) -> felt252 {
            self.game_id.read()
        }
    }
}
