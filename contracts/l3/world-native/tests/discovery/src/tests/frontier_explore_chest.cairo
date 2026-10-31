pub use world_test_support::tests::frontier_explore_chest::*;


#[test]
fn a_recorded_roll_of_zero_hits_and_one_is_already_a_miss() {
    assert_eq!(crate::discovery::FRONTIER_CHEST_FIND_BPS, 1);
    let mut hit = HIT_ROOT;
    let seed = crate::random::game_root(ref hit, 1);
    assert_eq!(crate::random::range(seed, 0x46524f4e544945525f4348455354, 10000), 0);
    assert!(crate::discovery::frontier_chest(seed));
    let mut miss = MISS_ROOT;
    let seed = crate::random::game_root(ref miss, 1);
    assert_eq!(crate::random::range(seed, 0x46524f4e544945525f4348455354, 10000), 1);
    assert!(!crate::discovery::frontier_chest(seed));
}

#[test]
fn explore_reserves_the_rolled_share_and_open_pays_home_once_without_relics_or_terrain_loss() {
    let (d, game_id, key) = super::registrar::setup_frontier_chests();
    assert_eq!(game_id, 1);
    let army = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
    let coord = destination(d, key);
    let before = lords(d, game_id, army.owner);
    let rolled = expected(d, game_id, coord, HIT_ROOT);
    explore(d, key, HIT_ROOT, 360);
    assert_eq!(GameState { contract_address: d.games }.resolved_explorer(key).unwrap().coord, army.coord);
    let (chest_key, chest) = found(d, key, coord);
    let relics = IRelicsDispatcher { contract_address: d.games };
    let budget = relics.lords_budget(game_id).unwrap();
    assert_eq!(chest, rolled);
    assert_eq!((budget.open, budget.pool_left), (chest.amount, budget.pool));
    assert!(
        snforge_std::interact_with_state(
            d.games, || crate::state::read().relics.relic_chests.read((game_id, chest_key.entity_id)),
        )
            .is_none(),
    );
    let terrain = map(d).tile(tile_key(game_id, coord)).unwrap().data;
    assert!(terrain / crate::map::BIOME_SCALE % crate::map::BYTE_RANGE != 0);
    let mut spy = snforge_std::spy_events();
    assert!(open(d, key, coord, 361));
    assert_eq!(lords(d, game_id, army.owner) - before, chest.amount * RESOURCE_PRECISION);
    assert_eq!(lords(d, game_id, key.explorer_id), 0);
    assert!(map(d).occupancy(tile_key(game_id, coord)).is_none());
    assert_eq!(map(d).tile(tile_key(game_id, coord)).unwrap().data, terrain);
    let paid = relics.lords_budget(game_id).unwrap();
    assert_eq!((paid.pool_left, paid.open), (budget.pool - chest.amount, 0));
    assert!(!open(d, key, coord, 362));
    assert_eq!(relics.lords_budget(game_id), Some(paid));
    assert_eq!(lords(d, game_id, army.owner) - before, chest.amount * RESOURCE_PRECISION);
    let mut openings = 0;
    for (_, event) in spy.get_events().emitted_by(d.games).events.span() {
        if *event.keys.at(0) != selector!("StoryEvent") {
            continue;
        }
        let mut keys = event.keys.span().slice(1, event.keys.len() - 1);
        let mut data = event.data.span();
        let story: crate::ownership::StoryEvent = starknet::Event::deserialize(ref keys, ref data).unwrap();
        match story.story {
            crate::ownership::Story::RewardChestOpened(reward) => {
                openings += 1;
                assert_eq!(reward.amount, chest.amount);
                assert_eq!(
                    (reward.explorer_id, reward.structure_id, reward.coord), (key.explorer_id, army.owner, coord),
                );
            },
            crate::ownership::Story::RelicChestOpened(_) => panic!("a LORDS chest yielded relics"),
            _ => {},
        }
    }
    assert_eq!(openings, 1);
}

#[test]
fn the_same_roll_on_known_terrain_or_a_miss_never_places_a_chest() {
    for known in array![false, true] {
        let (d, game_id, key) = super::registrar::setup_frontier_chests();
        let coord = destination(d, key);
        if known {
            map(d).reveal(tile_key(game_id, coord), 2);
        }
        explore(d, key, if known {
            HIT_ROOT
        } else {
            EMPTY_ROOT
        }, 360);
        let terrain = map(d).tile(tile_key(game_id, coord)).unwrap().data;
        assert!(terrain / crate::map::BIOME_SCALE % crate::map::BYTE_RANGE != 0);
        if known {
            assert_eq!(GameState { contract_address: d.games }.resolved_explorer(key).unwrap().coord, coord);
        }
        let occupied = map(d).occupancy(tile_key(game_id, coord));
        if let Some(occupied) = occupied {
            assert!(occupied.category != crate::taxonomy::CHEST_OCCUPIER);
        }
        assert_eq!(IRelicsDispatcher { contract_address: d.games }.lords_budget(game_id).unwrap().open, 0);
    }
}

#[test]
fn no_pool_or_a_fully_reserved_pool_does_not_create_an_unfunded_chest() {
    for funded in array![false, true] {
        let (d, game_id, key) = if funded {
            super::registrar::setup_frontier_chests()
        } else {
            super::registrar::setup_unfunded_frontier_chests()
        };
        let held = if funded {
            snforge_std::interact_with_state(
                d.games,
                || {
                    let context = crate::commands::ExecutionContext {
                        timestamp: 360, ..super::context(d.games, game_id),
                    };
                    let budget = crate::logic::lords_budget::budget(game_id).unwrap();
                    let clock = crate::logic::lords_budget::SeasonClock {
                        game: context.game.unbox(), day_unit_seconds: context.rules.unbox().day_unit_seconds, tick: 60,
                    };
                    let amount = crate::logic::lords_budget::available(budget, clock);
                    assert!(
                        crate::logic::lords_budget::try_reserve(
                            game_id, SiteChest { tier: 0, amount, reservation_day: budget.day }, context,
                        ),
                    );
                    amount
                },
            )
        } else {
            0
        };
        let coord = destination(d, key);
        explore(d, key, HIT_ROOT, 360);
        if let Some(occupied) = map(d).occupancy(tile_key(game_id, coord)) {
            assert!(occupied.category != crate::taxonomy::CHEST_OCCUPIER);
        }
        assert_eq!(IRelicsDispatcher { contract_address: d.games }.lords_budget(game_id).unwrap().open, held);
    }
}

#[test]
fn the_frozen_daily_price_is_shared_and_a_previous_ruin_and_floor_do_not_block_the_drop() {
    let (d, game_id, key) = super::registrar::setup_frontier_chests();
    let coord = destination(d, key);
    snforge_std::interact_with_state(
        d.games,
        || {
            let budget = crate::logic::lords_budget::budget(game_id).unwrap();
            crate::state::write()
                .relics
                .rollover_budget
                .write(game_id, Some(crate::relics::LordsBudget { price: 7, ..budget }));
            let day = crate::expeditions::region_day(coord, 1024);
            crate::state::write().map_rules.ruin_cleared.write((game_id, 1, day), true);
            crate::state::write().map_rules.empty_reveals.write((game_id, 1, day), Some(7));
        },
    );
    explore(d, key, HIT_ROOT, 360);
    let (_, chest) = found(d, key, coord);
    assert_eq!(chest, expected(d, game_id, coord, HIT_ROOT));
    let army = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
    let before = lords(d, game_id, army.owner);
    assert!(open(d, key, coord, 361));
    assert_eq!(lords(d, game_id, army.owner) - before, chest.amount * RESOURCE_PRECISION);
}

#[test]
fn a_nonadjacent_army_cannot_consume_the_reservation_and_rollover_cannot_pay_an_old_hold() {
    let (d, game_id, key) = super::registrar::setup_frontier_chests();
    let coord = destination(d, key);
    explore(d, key, HIT_ROOT, 360);
    let (chest_key, chest) = found(d, key, coord);
    let (other, _) = super::deploy_player(2, super::GUARDIAN);
    assert!(
        !play(
            d.games,
            TestAction {
                game_id,
                actor: other,
                command: Command::OpenRelicChest(OpenChest { explorer_id: key.explorer_id, coord }),
            },
            1,
            361,
        ),
    );
    let mut army = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
    army.coord = neighbor(army.coord, 3);
    super::resource_commands::set_explorer_fixture(d.games, key, army);
    assert!(!open(d, key, coord, 361));
    assert!(map(d).occupancy(tile_key(game_id, coord)).is_some());
    army.coord = neighbor(coord, 3);
    army.troops.count = 0;
    super::resource_commands::set_explorer_fixture(d.games, key, army);
    assert!(!open(d, key, coord, 361));
    assert!(map(d).occupancy(tile_key(game_id, coord)).is_some());
    let before = lords(d, game_id, army.owner);
    snforge_std::interact_with_state(
        d.games,
        || {
            let context = crate::commands::ExecutionContext { timestamp: 360, ..super::context(d.games, game_id) };
            let next = crate::days::day_of(context.game.unbox(), context.rules.unbox().day_unit_seconds, 360).end;
            let context = crate::commands::ExecutionContext { timestamp: next, ..context };
            let fresh = crate::logic::lords_budget::candidate(
                game_id, crate::logic::expeditions::depth_rules_at(game_id, coord).chest, 123, context,
            );
            assert!(crate::logic::lords_budget::try_reserve(game_id, fresh, context));
            let reserved = crate::logic::lords_budget::budget(game_id);
            let reward = crate::logic::lords_budget::pay(chest_key, context);
            assert_eq!(reward.amount, 0);
            assert_eq!(crate::logic::lords_budget::budget(game_id), reserved);
        },
    );
    assert_eq!(lords(d, game_id, army.owner), before);
    assert_eq!(IRelicsDispatcher { contract_address: d.games }.site_chest(chest_key), Some(chest));
}

#[test]
fn explored_chests_use_each_layers_odds_and_reserve_the_rolled_amount() {
    for depth in 0_u8..4 {
        let (d, game_id, key) = super::registrar::setup_frontier_chests();
        world_test_support::tests::progression::place_army_at_depth(d, key, depth);
        let coord = destination(d, key);
        let rolled = expected(d, game_id, coord, HIT_ROOT);
        explore(d, key, HIT_ROOT, 360);
        let (_, chest) = found(d, key, coord);
        assert_eq!(chest, rolled);
        assert!(chest.tier >= depth);
        let budget = IRelicsDispatcher { contract_address: d.games }.lords_budget(game_id).unwrap();
        assert_eq!(budget.open, chest.amount);
    }
}
