use crate::banes::{ASH_FALL, BaneWindow, MIST_TIDE};
use crate::resources::{Production, SettledResource, Weight, settle_windows};

#[test]
fn production_splits_at_start_and_early_end_and_carries_fractional_output() {
    let mut resource = SettledResource {
        balance: 0,
        production: Production {
            building_count: 1, production_rate: 7, last_settled_at: 40, output_amount_left: 10000, remainder: 0,
        },
        weight: Weight { capacity: 10000, weight: 0 },
        limit: None,
    };
    let window = BaneWindow { kind: ASH_FALL, start: 50, end: 71 };
    let mut once = resource;
    settle_windows(23, ref once, 1, 80, array![window].span(), 50);
    assert_eq!(once.balance, 206);
    assert_eq!(once.production.remainder, 50);
    settle_windows(23, ref resource, 1, 51, array![BaneWindow { end: 51, ..window }].span(), 50);
    assert_eq!(resource.balance, 73);
    assert_eq!(resource.production.remainder, 50);
    settle_windows(23, ref resource, 1, 80, array![BaneWindow { start: 51, ..window }].span(), 50);
    assert_eq!(resource.balance, once.balance);
    assert_eq!(resource.production, once.production);
    assert_eq!(resource.weight, once.weight);
}

#[test]
fn stamina_splits_at_start_and_early_end_with_the_client_remainder() {
    let config = world_test_support::tests::stamina::rules(20);
    let initial = crate::troops::Stamina { amount: 0, settled_at: 100, remainder: 0 };
    let window = BaneWindow { kind: MIST_TIDE, start: 110, end: 131 };
    let mut once = initial;
    let mut boosts = Default::default();
    crate::stamina::refill_windows(ref once, ref boosts, 120, config, 60, 160, array![window].span(), 100, 50);
    assert_eq!(once.amount, 16);
    assert_eq!(once.remainder, 300000);
    let mut repeated = initial;
    for now in 101_u64..161 {
        let start = core::cmp::max(now - 1, window.start);
        let end = core::cmp::min(now, window.end);
        let windows = if start < end {
            array![BaneWindow { start, end, ..window }].span()
        } else {
            array![].span()
        };
        crate::stamina::refill_windows(ref repeated, ref boosts, 120, config, 60, now, windows, 100, 50);
    }
    assert_eq!(repeated, once);
}
