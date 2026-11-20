#[starknet::contract]
pub mod RaidLogic {
    use crate::events::RowSet;
    use crate::logic::release::ReleaseState;
    use crate::troops::Coord;

    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    impl LifeInternal = ReleaseState::InternalImpl<ContractState>;
    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[substorage(v0)]
        release: ReleaseState::Storage,
        #[flat]
        data: crate::state::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        ReleaseEvent: ReleaseState::Event,
        BattleEvent: crate::troops::BattleEvent,
        OwnershipRow: crate::events::RowSet,
        RowSet: RowSet,
        MapEvent: crate::logic::map::MapState::Event,
    }
    #[abi(embed_v0)]
    impl RelicMap of crate::relics::IRelicMap<ContractState> {
        fn reveal_relic_tiles(
            ref self: ContractState,
            key: crate::troops::ExplorerKey,
            coord: Coord,
            count: u8,
            game_context: crate::commands::ActionContext,
        ) {
            crate::logic::army_relics::reveal_tiles(key, coord, count, game_context)
        }
    }
}
