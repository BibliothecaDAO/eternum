pub use world_test_support::tests::explore_rewards::*;
use crate::registrar::IRegistrarSafeDispatcherTrait;

#[test]
fn a_spire_pays_a_thousand_essence_with_only_an_active_exploration_relic_bonus() {
    let reward = spire_reward(Default::default(), 40);
    assert_eq!(reward.resource_type, ESSENCE);
    assert_eq!(reward.amount, 1000 * RESOURCE_PRECISION);
    let boosts = crate::troops::TroopBoosts {
        incr_explore_reward_percent_num: 5000, incr_explore_reward_end_at: 100, ..Default::default(),
    };
    assert_eq!(spire_reward(boosts, 99).amount, 1500 * RESOURCE_PRECISION);
    assert_eq!(spire_reward(boosts, 100).amount, 1000 * RESOURCE_PRECISION);
}

#[test]
fn a_spire_root_finds_a_spire_before_a_camp() {
    let config = super::camps::rules(true).map_config;
    assert_eq!(surface(config, explore_seed(SPIRE_ROOT), DISCOVER_CAMPS), Discovery::Spire);
    assert_eq!(surface(config, explore_seed(NO_SPIRE_ROOT), DISCOVER_CAMPS), Discovery::Camp);
}

#[test]
fn about_one_reveal_in_two_hundred_finds_a_spire() {
    let mut config = super::camps::rules(true).map_config;
    config.camp_win_probability = 0;
    config.camp_fail_probability = 1;
    let mut spires: u128 = 0;
    for sample in 0_u64..10000 {
        if surface(config, 0x5350495245 + sample.into(), 0) == Discovery::Spire {
            spires += 1;
        }
    }
    // The expected 50 has a standard deviation of about 7 over 10000 draws.
    assert!(spires >= SPIRE_FIND_BPS - 21 && spires <= SPIRE_FIND_BPS + 21, "spire rate outside 0.5 +/- 0.21 percent");
    println!("10000 reveals: {} spires", spires);
}

#[test]
fn a_blitz_explore_on_a_spire_root_raises_a_dormant_spire_and_pays_its_finder_once() {
    let (d, home, explorer) = blitz_army();
    let troops = GameState { contract_address: d.games };
    let origin = troops.explorer(explorer).unwrap().coord;
    let mut spy = snforge_std::spy_events();
    assert!(explore(d, explorer, SPIRE_ROOT));
    let spire = neighbor(origin, 0);
    let occupancy = IMapLogicDispatcher { contract_address: d.games }.occupancy(tile_key(3, spire)).unwrap();
    assert_eq!(occupancy.category, crate::taxonomy::DORMANT_SPIRE_OCCUPIER);
    assert!(!occupancy.is_structure);
    assert_eq!(troops.explorer(explorer).unwrap().coord, origin);
    let grant = ExtractedReward {
        explorer_id: explorer.explorer_id,
        receiver: home.entity_id,
        coord: spire,
        resource_type: ESSENCE,
        amount: 1000 * RESOURCE_PRECISION,
    };
    assert_eq!(spire_stories(ref spy, d), array![grant]);
}

#[test]
fn a_dormant_spire_opens_no_portal_and_lets_no_army_onto_its_tile() {
    let (d, _, explorer) = blitz_army();
    assert!(explore(d, explorer, SPIRE_ROOT));
    let id = explorer.explorer_id;
    let mut spy = snforge_std::spy_events();
    assert_eq!(
        rejected_reason(d, Command::ToggleAlternate(ToggleAlternate { explorer_id: id, spire_direction: 0 })),
        "explorer must be adjacent to spire",
    );
    assert_eq!(
        rejected_reason(d, Command::Move(Move { explorer_id: id, directions: array![0].span() })),
        "movement tile occupied",
    );
    assert_eq!(rejected_reason(d, Command::Explore(Explore { explorer_id: id, direction: 0 })), "destination occupied");
    assert_eq!(spire_stories(ref spy, d), array![]);
}
