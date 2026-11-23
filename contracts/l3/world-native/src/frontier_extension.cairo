#[starknet::contract]
pub mod ReleaseMigration {
    #[storage]
    struct Storage {}

    fn initialize_scheduled_end(game_id: u32) {
        let mut game = crate::logic::game::game(game_id);
        if game.scheduled_end_at == 0 && game.end_at != 0 {
            game.scheduled_end_at = game.end_at;
            crate::logic::game::write_game(game_id, game);
        }
    }

    #[abi(embed_v0)]
    impl Migration of crate::logic::release::IReleaseMigration<ContractState> {
        fn migrate(ref self: ContractState, game_id: u32, previous_release: u32, release_id: u32) {
            crate::logic::release::assert_launcher();
            initialize_scheduled_end(game_id);
        }
    }
}
