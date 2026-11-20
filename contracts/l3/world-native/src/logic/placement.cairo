#[starknet::contract]
pub mod PlacementLogic {
    use crate::geometry::tile_key;
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
        fn validate_command(self: @ContractState, command: Span<felt252>) -> u32 {
            let (index, _, _) = crate::commands::validated_command(command).expect('INVALID_COMMAND');
            index
        }
        fn requires_oath_answer(self: @ContractState, game_id: u32, command: Span<felt252>) -> bool {
            let mut fields = command;
            let command = Serde::deserialize(ref fields).expect('INVALID_COMMAND');
            crate::logic::oath_commands::requires_answer(game_id, command)
        }
        fn assign_open_home(ref self: ContractState, game_id: u32, actor: starknet::ContractAddress) {
            crate::entity_ids::assign_open_home(game_id, actor);
        }
    }
    #[abi(embed_v0)]
    impl PresetSettlement of crate::presets::IPresetSettlement<ContractState> {
        fn store_settlement_preset(
            ref self: ContractState, commitment: felt252, settlement: crate::presets::SettlementPreset,
        ) {
            crate::logic::preset_record::store_settlement(commitment, settlement);
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
    impl SeasonPlacement of crate::realms::ISeasonPlacement<ContractState> {
        fn claim_season_settlement(
            ref self: ContractState, game_id: u32, settled_count: u16, seed: u256, center: Coord,
        ) -> Coord {
            let mut rules = crate::logic::settlement::rules(game_id);
            rules.registration_limit = 0xffff;
            for _ in 0..64_u32 {
                let coord = self.settlements.claim(game_id, center, rules, settled_count, seed);
                let occupied = crate::logic::map::occupancy(tile_key(game_id, coord)).is_some();
                if !occupied {
                    return coord;
                }
            }
            panic!("no vacant settlement in search limit")
        }
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
        fn claim_village(ref self: ContractState, game_id: u32, registered: u16, seed: u256, center: Coord) -> Coord {
            self.settlements.claim_village(game_id, center, crate::logic::settlement::rules(game_id), registered, seed)
        }
    }
}
