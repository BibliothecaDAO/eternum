use snforge_std::fs::{FileTrait, read_txt};
use crate::deep::DeepShare;
use crate::race::split_payment;

#[test]
fn building_pay_matches_the_client_vectors_by_rings_open() {
    let data = read_txt(@FileTrait::new("../fixtures/deep-building-pay.txt"));
    let mut fields = data.span();
    while !fields.is_empty() {
        let (alone, pair, crowd, open, expected): (u32, u32, u32, u8, u32) = Serde::deserialize(ref fields).unwrap();
        assert_eq!(crate::deep::building_pay(crate::deep::DeepPay { alone, pair, crowd }, open), expected);
    }
}

#[test]
fn allies_garrison_a_foundation_and_an_altar_but_only_the_owner_a_core_or_a_mine_as_the_client_vectors_say() {
    let data = read_txt(@FileTrait::new("../fixtures/deep-ally-garrison.txt"));
    let mut fields = data.span();
    let mut kinds = 0;
    while !fields.is_empty() {
        let (kind, allies): (u8, bool) = Serde::deserialize(ref fields).unwrap();
        assert_eq!(kind, kinds);
        assert_eq!(crate::rules::deep_allies_garrison(kind), allies);
        kinds += 1;
    }
    assert_eq!(kinds, crate::rules::DEEP_KIND_COUNT);
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
fn slots_with_the_same_home_share_remainders_in_slot_order() {
    let shares = array![
        DeepShare { home: 30, troops: 1 }, DeepShare { home: 10, troops: 1 }, DeepShare { home: 10, troops: 1 },
    ]
        .span();
    assert_eq!(split_payment(1, shares), array![0, 1, 0].span());
    assert_eq!(split_payment(2, shares), array![0, 1, 1].span());
}

#[test]
fn remainder_follows_home_identity_instead_of_guard_slot_order() {
    let first = array![DeepShare { home: 9, troops: 1 }, DeepShare { home: 3, troops: 1 }].span();
    let second = array![DeepShare { home: 3, troops: 1 }, DeepShare { home: 9, troops: 1 }].span();
    assert_eq!(split_payment(5, first), array![2, 3].span());
    assert_eq!(split_payment(5, second), array![3, 2].span());
}
