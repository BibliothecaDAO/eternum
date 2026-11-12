use crate::deep::DeepShare;
use crate::race::{RaceRules, height_after, split_payment};
use crate::troops::Coord;

fn rules() -> RaceRules {
    RaceRules {
        season_days: 50,
        glory_per_tick: 5,
        height_per_tick: 5,
        stage_height: 2000,
        clear_mist_percent: 200,
        second_wind_percent: 200,
        pale_moon_percent: 50,
        spoils_percent: 200,
        first: Coord { alt: false, x: 10, y: 10 },
        second: Coord { alt: false, x: 40, y: 10 },
        third: Coord { alt: false, x: 10, y: 40 },
        fourth: Coord { alt: false, x: 40, y: 40 },
    }
}

#[test]
fn glory_is_split_by_troops_and_preserves_every_fractional_unit() {
    let amount = 5 * crate::rules::RESOURCE_PRECISION;
    let shares = array![DeepShare { home: 30, troops: 1000 }, DeepShare { home: 10, troops: 3000 }].span();
    assert_eq!(split_payment(amount, shares), array![amount / 4, 3 * amount / 4].span());
    let thirds = array![
        DeepShare { home: 30, troops: 1 }, DeepShare { home: 10, troops: 1 }, DeepShare { home: 20, troops: 1 },
    ]
        .span();
    let paid = split_payment(amount, thirds);
    assert_eq!(paid, array![amount / 3, amount / 3 + 1, amount / 3 + 1].span());
    assert_eq!(*paid.at(0) + *paid.at(1) + *paid.at(2), amount);
    assert_eq!(split_payment(0, thirds), array![0, 0, 0].span());
}

#[test]
fn remainder_follows_home_identity_instead_of_guard_slot_order() {
    let first = array![DeepShare { home: 9, troops: 1 }, DeepShare { home: 3, troops: 1 }].span();
    let second = array![DeepShare { home: 3, troops: 1 }, DeepShare { home: 9, troops: 1 }].span();
    assert_eq!(split_payment(5, first), array![2, 3].span());
    assert_eq!(split_payment(5, second), array![3, 2].span());
}

#[test]
#[should_panic(expected: "duplicate reward home")]
fn one_home_cannot_receive_two_guard_shares() {
    split_payment(5, array![DeepShare { home: 9, troops: 1 }, DeepShare { home: 9, troops: 1 }].span());
}

#[test]
fn a_team_bane_stops_height_and_the_finish_never_overflows() {
    crate::race::validate(rules());
    assert_eq!(height_after(rules(), 1995, false), 2000);
    assert_eq!(height_after(rules(), 1995, true), 1995);
    assert_eq!(height_after(rules(), 9995, false), 10000);
    assert_eq!(height_after(rules(), 10000, false), 10000);
}

#[test]
#[should_panic(expected: "duplicate hyperstructure position")]
fn each_aspect_needs_its_own_fixed_hyperstructure() {
    crate::race::validate(RaceRules { second: rules().first, ..rules() });
}
