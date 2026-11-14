use starknet::storage_access::StorePacking;
use crate::banes::{ASH_FALL, BaneWindow};
use crate::resources::{Production, ProductionPacking, SettledResource, UNLIMITED_OUTPUT, Weight, settle_windows};

fn producer() -> SettledResource {
    SettledResource {
        balance: 0,
        production: Production {
            building_count: 1,
            production_rate: 7,
            output_amount_left: UNLIMITED_OUTPUT,
            last_settled_at: 100,
            remainder: 0,
        },
        weight: Weight { capacity: UNLIMITED_OUTPUT, weight: 0 },
        limit: None,
    }
}

#[test]
fn production_fraction_survives_storage_and_preserves_legacy_packed_values() {
    let original = Production {
        building_count: 255,
        production_rate: 0xffffffffffffffff,
        output_amount_left: UNLIMITED_OUTPUT,
        last_settled_at: 0xffffffff,
        remainder: 99,
    };
    assert_eq!(ProductionPacking::unpack(ProductionPacking::pack(original)), original);
    let legacy = Production { remainder: 0, ..original };
    let packed = u256 {
        low: legacy.output_amount_left,
        high: Into::<u64, u128>::into(legacy.production_rate)
            + Into::<u32, u128>::into(legacy.last_settled_at) * 0x10000000000000000
            + Into::<u8, u128>::into(legacy.building_count) * 0x1000000000000000000000000,
    };
    assert_eq!(ProductionPacking::unpack(packed.try_into().unwrap()), legacy);
}

#[test]
fn production_partitioning_preserves_every_fraction_across_bane_edges() {
    let mut whole = producer();
    let windows = array![BaneWindow { kind: ASH_FALL, start: 103, end: 110 }];
    settle_windows(crate::resources::LABOR, ref whole, 0, 113, windows.span(), 50);
    assert_eq!(whole.balance, 66);
    assert_eq!(whole.production.remainder, 50);
    let mut pieces = producer();
    for now in 101_u32..114 {
        let start = core::cmp::max(now - 1, 103);
        let end = core::cmp::min(now, 110);
        let windows = if start < end {
            array![BaneWindow { kind: ASH_FALL, start: start.into(), end: end.into() }]
        } else {
            array![]
        };
        settle_windows(crate::resources::LABOR, ref pieces, 0, now, windows.span(), 50);
    }
    assert_eq!(pieces.balance, whole.balance);
    assert_eq!(pieces.production, whole.production);
    assert_eq!(pieces.weight, whole.weight);
}

#[test]
fn exhausted_output_and_full_stores_do_not_bank_fractional_production() {
    let window = array![BaneWindow { kind: ASH_FALL, start: 100, end: 101 }];
    for case in 0_u8..3 {
        let mut resource = producer();
        if case == 0 {
            resource.production.output_amount_left = 3;
        } else if case == 1 {
            resource.limit = Some(3);
        } else {
            resource.weight.capacity = 3;
        }
        settle_windows(crate::resources::LABOR, ref resource, 1, 101, window.span(), 50);
        assert_eq!(resource.balance, 3);
        assert_eq!(resource.production.remainder, 0);
        if case == 0 {
            assert_eq!(resource.production.output_amount_left, 0);
        } else if case == 2 {
            assert_eq!(resource.weight.weight, 3);
        }
    }
}


#[test]
fn a_full_weighted_inventory_preserves_weightless_output_fractions() {
    let mut resource = producer();
    resource.weight = Weight { capacity: 3, weight: 3 };
    for now in 101_u32..103 {
        let window = array![BaneWindow { kind: ASH_FALL, start: (now - 1).into(), end: now.into() }];
        settle_windows(crate::resources::LABOR, ref resource, 0, now, window.span(), 50);
        assert_eq!(resource.balance, if now == 101 {
            3
        } else {
            7
        });
        assert_eq!(resource.production.remainder, if now == 101 {
            50
        } else {
            0
        });
        assert_eq!(resource.weight, Weight { capacity: 3, weight: 3 });
    }
}
use snforge_std::fs::{FileTrait, read_txt};

#[derive(Drop, Serde)]
struct ProductionCase {
    rate: u64,
    start: u32,
    end: u32,
    carry: u8,
    percent: u16,
    windows: Span<crate::banes::BaneWindow>,
    amount: u128,
    remainder: u8,
}

#[test]
fn native_production_matches_the_shared_client_vectors() {
    let mut encoded = read_txt(@FileTrait::new("../fixtures/production-banes.txt")).span();
    let cases: Array<ProductionCase> = Serde::deserialize(ref encoded).unwrap();
    assert!(!cases.is_empty());
    assert!(encoded.is_empty());
    for case in cases {
        let mut resource = producer();
        resource.production.production_rate = case.rate;
        resource.production.last_settled_at = case.start;
        resource.production.remainder = case.carry;
        settle_windows(crate::resources::LABOR, ref resource, 0, case.end, case.windows, case.percent);
        assert_eq!(resource.balance, case.amount);
        assert_eq!(resource.production.remainder, case.remainder);
        assert_eq!(resource.production.last_settled_at, case.end);
    }
}
