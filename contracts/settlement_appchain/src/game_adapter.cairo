#[starknet::contract]
pub mod GameSettlementAdapterSpike {
    use settlement_protocol::appchain_spike_interfaces::{
        IGameSettlementAdapterSpike, ISeasonSettlementHubSpikeDispatcher, ISeasonSettlementHubSpikeDispatcherTrait,
    };
    use starknet::ContractAddress;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};

    #[storage]
    struct Storage {
        hub: ContractAddress,
        game_id: felt252,
        world: ContractAddress,
    }

    #[constructor]
    fn constructor(ref self: ContractState, hub: ContractAddress, game_id: felt252, world: ContractAddress) {
        assert!(game_id != 0, "ZERO_GAME_ID");
        self.hub.write(hub);
        self.game_id.write(game_id);
        self.world.write(world);
    }

    #[abi(embed_v0)]
    impl GameSettlementAdapterImpl of IGameSettlementAdapterSpike<ContractState> {
        fn append_claim(ref self: ContractState, amount: u128) -> u64 {
            ISeasonSettlementHubSpikeDispatcher { contract_address: self.hub.read() }.append_claim(amount)
        }

        fn game_id(self: @ContractState) -> felt252 {
            self.game_id.read()
        }

        fn world(self: @ContractState) -> ContractAddress {
            self.world.read()
        }
    }
}
