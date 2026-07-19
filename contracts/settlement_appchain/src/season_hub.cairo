#[starknet::contract]
pub mod SeasonSettlementHubSpike {
    use settlement_protocol::appchain_spike_interfaces::{
        IFactoryWorldSpikeDispatcher, IFactoryWorldSpikeDispatcherTrait, IGameSettlementAdapterSpikeDispatcher,
        IGameSettlementAdapterSpikeDispatcherTrait, ISeasonSettlementHubSpike, RootStreamEntry,
    };
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_caller_address};

    #[storage]
    struct Storage {
        admin: ContractAddress,
        game_id_by_adapter: Map<ContractAddress, felt252>,
        world_by_adapter: Map<ContractAddress, ContractAddress>,
        adapter_by_game: Map<felt252, ContractAddress>,
        game_id_by_world: Map<ContractAddress, felt252>,
        next_nonce: u64,
        entries: Map<u64, RootStreamEntry>,
    }

    #[constructor]
    fn constructor(ref self: ContractState, admin: ContractAddress) {
        self.admin.write(admin);
    }

    #[abi(embed_v0)]
    impl SeasonSettlementHubImpl of ISeasonSettlementHubSpike<ContractState> {
        fn register_game(ref self: ContractState, game_id: felt252, world: ContractAddress, adapter: ContractAddress) {
            assert_admin(@self);
            assert_unregistered(@self, game_id, world, adapter);
            assert_adapter_binding(game_id, world, adapter);

            self.game_id_by_adapter.write(adapter, game_id);
            self.world_by_adapter.write(adapter, world);
            self.adapter_by_game.write(game_id, adapter);
            self.game_id_by_world.write(world, game_id);
        }

        fn append_claim(ref self: ContractState, amount: u128) -> u64 {
            let adapter = get_caller_address();
            let game_id = self.game_id_by_adapter.read(adapter);
            assert!(game_id != 0, "UNREGISTERED_ADAPTER");
            assert!(amount != 0, "ZERO_AMOUNT");

            let nonce = self.next_nonce.read();
            let world = self.world_by_adapter.read(adapter);
            self.entries.write(nonce, RootStreamEntry { nonce, game_id, world, adapter, amount });
            self.next_nonce.write(nonce + 1);
            nonce
        }

        fn stream_length(self: @ContractState) -> u64 {
            self.next_nonce.read()
        }

        fn get_entry(self: @ContractState, nonce: u64) -> Option<RootStreamEntry> {
            if nonce < self.next_nonce.read() {
                Option::Some(self.entries.read(nonce))
            } else {
                Option::None
            }
        }
    }

    fn assert_admin(self: @ContractState) {
        assert!(get_caller_address() == self.admin.read(), "ONLY_ADMIN");
    }

    fn assert_unregistered(self: @ContractState, game_id: felt252, world: ContractAddress, adapter: ContractAddress) {
        assert!(game_id != 0, "ZERO_GAME_ID");
        assert!(self.game_id_by_adapter.read(adapter) == 0, "ADAPTER_ALREADY_REGISTERED");
        assert!(self.game_id_by_world.read(world) == 0, "WORLD_ALREADY_REGISTERED");
        assert!(self.adapter_by_game.read(game_id) == zero_address(), "GAME_ALREADY_REGISTERED");
    }

    fn assert_adapter_binding(game_id: felt252, world: ContractAddress, adapter: ContractAddress) {
        let adapter = IGameSettlementAdapterSpikeDispatcher { contract_address: adapter };
        let world_contract = IFactoryWorldSpikeDispatcher { contract_address: world };
        assert!(adapter.game_id() == game_id, "ADAPTER_BINDING_MISMATCH");
        assert!(adapter.world() == world, "ADAPTER_BINDING_MISMATCH");
        assert!(world_contract.game_id() == game_id, "WORLD_BINDING_MISMATCH");
    }

    fn zero_address() -> ContractAddress {
        0.try_into().unwrap()
    }
}
