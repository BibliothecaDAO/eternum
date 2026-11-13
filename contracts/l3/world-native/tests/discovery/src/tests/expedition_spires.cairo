use world_native::spires::{ExpeditionSpire, ExpeditionSpireKey};
use world_native::troops::Coord;

const HERE: Coord = Coord { alt: false, x: 50, y: 50 };

#[test]
fn locked_lore_disabled_discovery_and_the_deep_do_not_advance_spire_odds() {
    let key = ExpeditionSpireKey { game_id: 1, structure_id: 17, epoch: 0, depth: 0 };
    let learned = world_native::research::learn(0, world_native::research::ROW_DEPTH, 0);
    let enabled = world_native::rules::DISCOVER_SPIRES;
    for (candidate, knowledge, mode_rules) in array![
        (key, 0_u64, enabled), (key, learned, 0_u32), (ExpeditionSpireKey { depth: 3, ..key }, learned, enabled),
    ] {
        assert!(!world_native::logic::spires::discover_on_reveal(candidate, HERE, knowledge, mode_rules, seed_for(0)));
        assert!(world_native::logic::spires::read(candidate).is_none());
    }
}
#[test]
fn each_reveal_adds_one_tenth_and_the_tenth_cannot_miss() {
    // Exercise every bucket of the draw, not a statistical sample.
    for draw in 0_u128..10 {
        let seed = seed_for(draw);
        for previous_reveals in 0_u8..10 {
            let result = world_native::spires::discover(
                ExpeditionSpire { reveals: previous_reveals, location: None }, HERE, seed,
            );
            assert_eq!(result.reveals, previous_reveals + 1);
            assert_eq!(result.location, if draw < (previous_reveals + 1).into() {
                Some(HERE)
            } else {
                None
            });
        }
    }
}

#[test]
fn a_found_spire_is_not_rerolled_or_counted_again() {
    let found = ExpeditionSpire { reveals: 4, location: Some(HERE) };
    assert_eq!(world_native::spires::discover(found, Coord { x: 51, ..HERE }, 0), found);
}

#[test]
fn reveals_share_one_spire_only_within_the_same_home_day_and_layer() {
    let key = ExpeditionSpireKey { game_id: 1, structure_id: 17, epoch: 2, depth: 0 };
    let seed = seed_for(9);
    for reveal in 1_u8..11 {
        assert_eq!(world_native::logic::spires::discover(key, HERE, seed), reveal == 10);
        assert_eq!(world_native::logic::spires::read(key).unwrap().reveals, reveal);
    }
    assert!(!world_native::logic::spires::discover(key, Coord { x: 51, ..HERE }, 0));
    assert_eq!(world_native::logic::spires::read(key).unwrap().location, Some(HERE));
    for other in array![
        ExpeditionSpireKey { game_id: 2, ..key }, ExpeditionSpireKey { structure_id: 18, ..key },
        ExpeditionSpireKey { epoch: 3, ..key }, ExpeditionSpireKey { depth: 1, ..key },
    ] {
        assert!(world_native::logic::spires::read(other).is_none());
        assert!(!world_native::logic::spires::discover(other, HERE, seed));
        assert_eq!(world_native::logic::spires::read(other).unwrap(), ExpeditionSpire { reveals: 1, location: None });
    }
}

#[test]
#[should_panic(expected: ('spire has not been found',))]
fn lore_without_a_discovered_spire_cannot_descend() {
    world_native::logic::spires::descent_origin(
        ExpeditionSpireKey { game_id: 1, structure_id: 17, epoch: 0, depth: 0 }, HERE, 1,
    );
}

#[test]
#[should_panic(expected: "spire leads one layer down")]
fn a_spire_never_skips_a_layer() {
    world_native::logic::spires::descent_origin(
        ExpeditionSpireKey { game_id: 1, structure_id: 17, epoch: 0, depth: 0 }, HERE, 2,
    );
}

#[test]
#[should_panic(expected: "army must be at its realm's spire")]
fn a_discovered_spire_cannot_be_used_from_far_away() {
    let key = ExpeditionSpireKey { game_id: 1, structure_id: 17, epoch: 0, depth: 0 };
    assert!(world_native::logic::spires::discover(key, HERE, seed_for(0)));
    world_native::logic::spires::descent_origin(key, Coord { x: 52, ..HERE }, 1);
}

#[test]
#[should_panic(expected: "spires require an upper layer")]
fn the_deep_has_no_spire_roll() {
    world_native::logic::spires::discover(
        ExpeditionSpireKey { game_id: 1, structure_id: 17, epoch: 0, depth: 3 }, HERE, 0,
    );
}

fn seed_for(draw: u128) -> u256 {
    for value in 0_u32..1000 {
        let seed: u256 = value.into();
        if world_native::random::range(seed, 0x5350495245, 10) == draw {
            return seed;
        }
    }
    panic!("missing spire draw bucket")
}
