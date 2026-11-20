#[starknet::contract]
pub mod ReleaseMigration {
    use core::num::traits::WideMul;
    use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess};
    use crate::approved_frontier_extension as approved;

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
            if release_id != approved::RELEASE {
                return;
            }
            assert!(previous_release + 1 == approved::RELEASE, "wrong extension release");
            if starknet::get_tx_info().unbox().chain_id != approved::CHAIN_ID || game_id != approved::GAME_ID {
                return;
            }
            let mut game = crate::logic::game::game(game_id);
            assert!(
                game.name == approved::NAME
                    && game.preset_id == approved::PRESET_ID
                    && game.start_main_at == approved::START
                    && game.start_settling_at == approved::START
                    && game.seed == approved::SEED
                    && !game.dev_mode_on
                    && game.end_grace_seconds == 0,
                "Frontier extension identity differs",
            );
            if game.end_at == approved::END {
                return;
            }
            assert!(game.end_at == approved::OLD_END, "Frontier extension end differs");
            let now = starknet::get_block_timestamp();
            assert!(
                game.ready && !game.settled && now >= game.start_main_at && now < game.end_at,
                "Frontier extension not live",
            );
            let preset = crate::logic::preset_record::for_game(game_id);
            let day_unit = preset.rules.day_unit_seconds.read();
            let tick = preset.rules.tick_config.armies_tick_in_seconds.read();
            assert!(day_unit == approved::DAY_UNIT, "Frontier extension days differ");
            assert!(
                preset
                    .rollover_chest_rules
                    .read()
                    .expect('missing chest rules')
                    .claim_window_seconds == approved::CLAIM_WINDOW,
                "Frontier extension claims differ",
            );
            assert!(approved::END > game.end_at, "Frontier extension must grow");
            assert!(approved::END % tick == 0, "season does not end on a tick");
            let budget = crate::state::read().relics.rollover_budget.read(game_id).expect('Frontier pool missing');
            assert!(
                budget.pool == approved::POOL_LORDS && budget.pool_left <= budget.pool,
                "Frontier extension pool differs",
            );
            let day = crate::days::day_of(game, day_unit, now);
            // A previous day's holds have expired, even if its budget row has not rolled yet.
            let reserved = if budget.day == day.index {
                budget.open
            } else {
                0
            };
            game.end_at = approved::END;
            game.scheduled_end_at = approved::END;
            let extended_day = crate::days::day_of(game, day_unit, day.start);
            let elapsed: u128 = (extended_day.end - game.start_main_at).into();
            let unlocked: u128 = (budget.pool.wide_mul(elapsed) / (game.end_at - game.start_main_at).into())
                .try_into()
                .unwrap();
            assert!(
                Into::<u128, u256>::into(budget.pool - budget.pool_left) + reserved.into() <= unlocked.into(),
                "Frontier extension exceeds unlock",
            );
            crate::logic::game::write_game(game_id, game);
        }
    }
}
