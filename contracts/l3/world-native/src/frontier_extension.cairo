#[starknet::contract]
pub mod ReleaseMigration {
    use crate::approved_frontier_extension as approved;

    #[storage]
    struct Storage {}

    #[abi(embed_v0)]
    impl Migration of crate::logic::release::IReleaseMigration<ContractState> {
        fn migrate(ref self: ContractState, game_id: u32, previous_release: u32, release_id: u32) {
            crate::logic::release::assert_launcher();
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
            let rules = crate::logic::game::rules(game_id);
            assert!(rules.day_unit_seconds == approved::DAY_UNIT, "Frontier extension days differ");
            assert!(
                crate::logic::lords_budget::chest_rules(game_id).claim_window_seconds == approved::CLAIM_WINDOW,
                "Frontier extension claims differ",
            );
            assert!(approved::END > game.end_at, "Frontier extension must grow");
            crate::days::season_days(approved::END - game.start_main_at, rules.day_unit_seconds);
            let budget = crate::logic::lords_budget::budget(game_id).expect('Frontier pool missing');
            assert!(
                budget.pool == approved::POOL_LORDS && budget.pool_left <= budget.pool,
                "Frontier extension pool differs",
            );
            let day = crate::days::day_of(game, rules.day_unit_seconds, now);
            // A previous day's holds have expired, even if its budget row has not rolled yet.
            let reserved = if budget.day == day.index {
                budget.open
            } else {
                0
            };
            game.end_at = approved::END;
            let unlocked = crate::logic::lords_budget::unlocked(
                budget.pool,
                crate::logic::lords_budget::SeasonClock {
                    game, day_unit_seconds: rules.day_unit_seconds, tick: rules.tick_config.armies_tick_in_seconds,
                },
                day.index,
            );
            assert!(
                Into::<u128, u256>::into(budget.pool - budget.pool_left) + reserved.into() <= unlocked.into(),
                "Frontier extension exceeds unlock",
            );
            crate::logic::game::write_game(game_id, game);
        }
    }
}
