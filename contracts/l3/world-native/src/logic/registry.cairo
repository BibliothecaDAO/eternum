#[starknet::contract]
pub mod RegistryLogic {
    #[cfg(test)]
    use crate::game::GameRegistry;
    use crate::logic::registrar::RegistrarState;
    use crate::logic::release::ReleaseState;
    #[cfg(test)]
    use crate::rules::SliceRules;
    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    component!(path: RegistrarState, storage: registrar, event: RegistrarEvent);
    #[abi(embed_v0)]
    impl Registrar = RegistrarState::RegistrarImpl<ContractState>;
    impl RegistrarInternal = RegistrarState::InternalImpl<ContractState>;
    impl LifeInternal = ReleaseState::InternalImpl<ContractState>;
    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[substorage(v0)]
        release: ReleaseState::Storage,
        #[substorage(v0)]
        registrar: RegistrarState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        GameEvent: crate::logic::game::Event,
        ReleaseEvent: ReleaseState::Event,
        RegistrarEvent: RegistrarState::Event,
    }
    #[cfg(test)]
    #[abi(embed_v0)]
    impl Games of crate::game::IGame<ContractState> {
        fn write_game(ref self: ContractState, game_id: u32, game: GameRegistry) {
            crate::logic::game::game(game_id);
            crate::logic::game::write_game(game_id, game);
        }


        fn game(self: @ContractState, game_id: u32) -> GameRegistry {
            crate::logic::game::game(game_id)
        }
        fn rules(self: @ContractState, game_id: u32) -> SliceRules {
            crate::logic::game::rules(game_id)
        }
        fn start_blitz(ref self: ContractState, game_id: u32, timestamp: u64) {
            assert!(
                crate::logic::game::rules(game_id).entry_rule == crate::rules::ENTRY_ROSTER, "fixed roster required",
            );
            let mut game = crate::logic::game::game(game_id);
            assert!(!game.ready, "roster already ready");
            let duration = game.end_at - game.start_main_at;
            game.start_main_at = core::cmp::max(game.start_main_at, timestamp);
            game.end_at = game.start_main_at + duration;
            game.ready = true;
            crate::logic::game::write_game(game_id, game);
        }
    }
}
