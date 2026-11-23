#[starknet::contract]
pub mod PlacementLogic {
    use crate::logic::map::MapState;
    use crate::logic::release::ReleaseState;
    use crate::logic::settlement::SettlementPoolState;
    #[cfg(feature: "test_support")]
    use crate::settlement::SettlementPool;
    use crate::troops::Coord;
    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    component!(path: SettlementPoolState, storage: settlements, event: SettlementEvent);
    impl SettlementInternal = SettlementPoolState::InternalImpl<ContractState>;
    impl LifeInternal = ReleaseState::InternalImpl<ContractState>;

    #[abi(embed_v0)]
    impl CommandIngress of crate::commands::ICommandIngress<ContractState> {
        fn admit(ref self: ContractState, game_id: u32, actor: starknet::ContractAddress, command: Span<felt252>) {
            crate::commands::admit(game_id, actor, command);
        }
        fn requires_oath_answer(self: @ContractState, game_id: u32, command: Span<felt252>) -> bool {
            let mut fields = command;
            let command = Serde::deserialize(ref fields).expect('INVALID_COMMAND');
            crate::logic::oath_commands::requires_answer(game_id, command)
        }
    }
    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[flat]
        pub data: crate::state::Storage,
        #[substorage(v0)]
        release: ReleaseState::Storage,
        #[substorage(v0)]
        settlements: SettlementPoolState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        ReleaseEvent: ReleaseState::Event,
        MapEvent: MapState::Event,
        SettlementEvent: SettlementPoolState::Event,
        RowSet: crate::events::RowSet,
    }
    #[abi(embed_v0)]
    impl Settlements of crate::settlement::ISettlementPool<ContractState> {
        #[cfg(feature: "test_support")]
        fn settlement_pool(self: @ContractState, game_id: u32, center: Coord) -> SettlementPool {
            self.settlements.pool(game_id, center, crate::logic::settlement::rules(game_id))
        }
        #[cfg(feature: "test_support")]
        fn village_pool(self: @ContractState, game_id: u32, center: Coord) -> SettlementPool {
            self.settlements.village_pool(game_id, center, crate::logic::settlement::rules(game_id))
        }
        fn claim_village(ref self: ContractState, game_id: u32, seed: u256, center: Coord) -> Coord {
            self.settlements.claim_village(game_id, center, crate::logic::settlement::rules(game_id), seed)
        }
    }
}
