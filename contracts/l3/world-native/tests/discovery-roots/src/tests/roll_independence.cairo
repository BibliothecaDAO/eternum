pub use world_test_support::tests::roll_independence::*;

const NO_GAME: u32 = 99;
const FRESH_WORLD_ROOTS: u64 = 2;

#[test_case(name: "route_00_roots_00_07", 0, 0)]
#[test_case(name: "route_00_roots_08_15", 0, 8)]
#[test_case(name: "route_00_roots_16_23", 0, 16)]
#[test_case(name: "route_00_roots_24_31", 0, 24)]
#[test_case(name: "route_01_roots_00_07", 1, 0)]
#[test_case(name: "route_01_roots_08_15", 1, 8)]
#[test_case(name: "route_01_roots_16_23", 1, 16)]
#[test_case(name: "route_01_roots_24_31", 1, 24)]
#[test_case(name: "route_02_roots_00_07", 2, 0)]
#[test_case(name: "route_02_roots_08_15", 2, 8)]
#[test_case(name: "route_02_roots_16_23", 2, 16)]
#[test_case(name: "route_02_roots_24_31", 2, 24)]
#[test_case(name: "route_03_roots_00_07", 3, 0)]
#[test_case(name: "route_03_roots_08_15", 3, 8)]
#[test_case(name: "route_03_roots_16_23", 3, 16)]
#[test_case(name: "route_03_roots_24_31", 3, 24)]
#[test_case(name: "route_04_roots_00_07", 4, 0)]
#[test_case(name: "route_04_roots_08_15", 4, 8)]
#[test_case(name: "route_04_roots_16_23", 4, 16)]
#[test_case(name: "route_04_roots_24_31", 4, 24)]
#[test_case(name: "route_05_roots_00_07", 5, 0)]
#[test_case(name: "route_05_roots_08_15", 5, 8)]
#[test_case(name: "route_05_roots_16_23", 5, 16)]
#[test_case(name: "route_05_roots_24_31", 5, 24)]
#[test_case(name: "route_06_roots_00_07", 6, 0)]
#[test_case(name: "route_06_roots_08_15", 6, 8)]
#[test_case(name: "route_06_roots_16_23", 6, 16)]
#[test_case(name: "route_06_roots_24_31", 6, 24)]
#[test_case(name: "route_07_roots_00_07", 7, 0)]
#[test_case(name: "route_07_roots_08_15", 7, 8)]
#[test_case(name: "route_07_roots_16_23", 7, 16)]
#[test_case(name: "route_07_roots_24_31", 7, 24)]
#[test_case(name: "route_08_roots_00_07", 8, 0)]
#[test_case(name: "route_08_roots_08_15", 8, 8)]
#[test_case(name: "route_08_roots_16_23", 8, 16)]
#[test_case(name: "route_08_roots_24_31", 8, 24)]
#[test_case(name: "route_09_roots_00_07", 9, 0)]
#[test_case(name: "route_09_roots_08_15", 9, 8)]
#[test_case(name: "route_09_roots_16_23", 9, 16)]
#[test_case(name: "route_09_roots_24_31", 9, 24)]
#[test_case(name: "route_10_roots_00_07", 10, 0)]
#[test_case(name: "route_10_roots_08_15", 10, 8)]
#[test_case(name: "route_10_roots_16_23", 10, 16)]
#[test_case(name: "route_10_roots_24_31", 10, 24)]
#[test_case(name: "route_11_roots_00_07", 11, 0)]
#[test_case(name: "route_11_roots_08_15", 11, 8)]
#[test_case(name: "route_11_roots_16_23", 11, 16)]
#[test_case(name: "route_11_roots_24_31", 11, 24)]
#[test_case(name: "route_12_roots_00_07", 12, 0)]
#[test_case(name: "route_12_roots_08_15", 12, 8)]
#[test_case(name: "route_12_roots_16_23", 12, 16)]
#[test_case(name: "route_12_roots_24_31", 12, 24)]
#[test_case(name: "route_13_roots_00_07", 13, 0)]
#[test_case(name: "route_13_roots_08_15", 13, 8)]
#[test_case(name: "route_13_roots_16_23", 13, 16)]
#[test_case(name: "route_13_roots_24_31", 13, 24)]
#[test_case(name: "route_14_roots_00_07", 14, 0)]
#[test_case(name: "route_14_roots_08_15", 14, 8)]
#[test_case(name: "route_14_roots_16_23", 14, 16)]
#[test_case(name: "route_14_roots_24_31", 14, 24)]
#[test_case(name: "route_15_roots_00_07", 15, 0)]
#[test_case(name: "route_15_roots_08_15", 15, 8)]
#[test_case(name: "route_15_roots_16_23", 15, 16)]
#[test_case(name: "route_15_roots_24_31", 15, 24)]
#[test_case(name: "route_16_roots_00_07", 16, 0)]
#[test_case(name: "route_16_roots_08_15", 16, 8)]
#[test_case(name: "route_16_roots_16_23", 16, 16)]
#[test_case(name: "route_16_roots_24_31", 16, 24)]
#[test_case(name: "route_17_roots_00_07", 17, 0)]
#[test_case(name: "route_17_roots_08_15", 17, 8)]
#[test_case(name: "route_17_roots_16_23", 17, 16)]
#[test_case(name: "route_17_roots_24_31", 17, 24)]
#[test_case(name: "route_18_roots_00_07", 18, 0)]
#[test_case(name: "route_18_roots_08_15", 18, 8)]
#[test_case(name: "route_18_roots_16_23", 18, 16)]
#[test_case(name: "route_18_roots_24_31", 18, 24)]
#[test_case(name: "route_19_roots_00_07", 19, 0)]
#[test_case(name: "route_19_roots_08_15", 19, 8)]
#[test_case(name: "route_19_roots_16_23", 19, 16)]
#[test_case(name: "route_19_roots_24_31", 19, 24)]
#[test_case(name: "route_20_roots_00_07", 20, 0)]
#[test_case(name: "route_20_roots_08_15", 20, 8)]
#[test_case(name: "route_20_roots_16_23", 20, 16)]
#[test_case(name: "route_20_roots_24_31", 20, 24)]
#[test_case(name: "route_21_roots_00_07", 21, 0)]
#[test_case(name: "route_21_roots_08_15", 21, 8)]
#[test_case(name: "route_21_roots_16_23", 21, 16)]
#[test_case(name: "route_21_roots_24_31", 21, 24)]
#[test_case(name: "route_22_roots_00_07", 22, 0)]
#[test_case(name: "route_22_roots_08_15", 22, 8)]
#[test_case(name: "route_22_roots_16_23", 22, 16)]
#[test_case(name: "route_22_roots_24_31", 22, 24)]
#[test_case(name: "route_23_roots_00_07", 23, 0)]
#[test_case(name: "route_23_roots_08_15", 23, 8)]
#[test_case(name: "route_23_roots_16_23", 23, 16)]
#[test_case(name: "route_23_roots_24_31", 23, 24)]
#[test_case(name: "route_24_roots_00_07", 24, 0)]
#[test_case(name: "route_24_roots_08_15", 24, 8)]
#[test_case(name: "route_24_roots_16_23", 24, 16)]
#[test_case(name: "route_24_roots_24_31", 24, 24)]
#[test_case(name: "route_25_roots_00_07", 25, 0)]
#[test_case(name: "route_25_roots_08_15", 25, 8)]
#[test_case(name: "route_25_roots_16_23", 25, 16)]
#[test_case(name: "route_25_roots_24_31", 25, 24)]
#[test_case(name: "route_26_roots_00_07", 26, 0)]
#[test_case(name: "route_26_roots_08_15", 26, 8)]
#[test_case(name: "route_26_roots_16_23", 26, 16)]
#[test_case(name: "route_26_roots_24_31", 26, 24)]
#[test_case(name: "route_27_roots_00_07", 27, 0)]
#[test_case(name: "route_27_roots_08_15", 27, 8)]
#[test_case(name: "route_27_roots_16_23", 27, 16)]
#[test_case(name: "route_27_roots_24_31", 27, 24)]
#[test_case(name: "route_28_roots_00_07", 28, 0)]
#[test_case(name: "route_28_roots_08_15", 28, 8)]
#[test_case(name: "route_28_roots_16_23", 28, 16)]
#[test_case(name: "route_28_roots_24_31", 28, 24)]
#[test_case(name: "route_29_roots_00_07", 29, 0)]
#[test_case(name: "route_29_roots_08_15", 29, 8)]
#[test_case(name: "route_29_roots_16_23", 29, 16)]
#[test_case(name: "route_29_roots_24_31", 29, 24)]
#[test_case(name: "route_30_roots_00_07", 30, 0)]
#[test_case(name: "route_30_roots_08_15", 30, 8)]
#[test_case(name: "route_30_roots_16_23", 30, 16)]
#[test_case(name: "route_30_roots_24_31", 30, 24)]
#[test_case(name: "route_31_roots_00_07", 31, 0)]
#[test_case(name: "route_31_roots_08_15", 31, 8)]
#[test_case(name: "route_31_roots_16_23", 31, 16)]
#[test_case(name: "route_31_roots_24_31", 31, 24)]
#[test_case(name: "route_32_roots_00_07", 32, 0)]
#[test_case(name: "route_32_roots_08_15", 32, 8)]
#[test_case(name: "route_32_roots_16_23", 32, 16)]
#[test_case(name: "route_32_roots_24_31", 32, 24)]
#[test_case(name: "route_33_roots_00_07", 33, 0)]
#[test_case(name: "route_33_roots_08_15", 33, 8)]
#[test_case(name: "route_33_roots_16_23", 33, 16)]
#[test_case(name: "route_33_roots_24_31", 33, 24)]
#[test_case(name: "route_34_roots_00_07", 34, 0)]
#[test_case(name: "route_34_roots_08_15", 34, 8)]
#[test_case(name: "route_34_roots_16_23", 34, 16)]
#[test_case(name: "route_34_roots_24_31", 34, 24)]
#[test_case(name: "route_35_roots_00_07", 35, 0)]
#[test_case(name: "route_35_roots_08_15", 35, 8)]
#[test_case(name: "route_35_roots_16_23", 35, 16)]
#[test_case(name: "route_35_roots_24_31", 35, 24)]
#[test_case(name: "route_36_roots_00_07", 36, 0)]
#[test_case(name: "route_36_roots_08_15", 36, 8)]
#[test_case(name: "route_36_roots_16_23", 36, 16)]
#[test_case(name: "route_36_roots_24_31", 36, 24)]
#[test_case(name: "route_37_roots_00_07", 37, 0)]
#[test_case(name: "route_37_roots_08_15", 37, 8)]
#[test_case(name: "route_37_roots_16_23", 37, 16)]
#[test_case(name: "route_37_roots_24_31", 37, 24)]
#[test_case(name: "route_38_roots_00_07", 38, 0)]
#[test_case(name: "route_38_roots_08_15", 38, 8)]
#[test_case(name: "route_38_roots_16_23", 38, 16)]
#[test_case(name: "route_38_roots_24_31", 38, 24)]
#[test_case(name: "route_39_roots_00_07", 39, 0)]
#[test_case(name: "route_39_roots_08_15", 39, 8)]
#[test_case(name: "route_39_roots_16_23", 39, 16)]
#[test_case(name: "route_39_roots_24_31", 39, 24)]
#[feature("safe_dispatcher")]
fn all_typed_entry_refusals_are_root_independent(index: u32, start: u64) {
    let commands = typed_commands();
    assert_eq!(commands.len(), routes());
    let command = *commands.at(index);
    assert_route(command, index);
    let mut expected = None;
    assert!(start + 8 <= ROOTS);
    let d = fresh_world();
    for sample in 0_u64..9 {
        let root = if sample == 0 {
            0
        } else {
            start + sample - 1
        };
        let before = play_fixture::gameplay_snapshot(d.games);
        let release = play_fixture::pins(d.games, 1);
        play_fixture::caller(d.games, d.actor, play_fixture::FIXTURE_START);
        let mut spy = snforge_std::spy_events();
        let error = IPlayFixtureSafeDispatcher { contract_address: d.games }
            .play_with_root(NO_GAME, release, play_fixture::encode(command), root.into())
            .unwrap_err();
        if let Some(previous) = expected {
            assert_eq!(error.span(), previous);
        }
        expected = Some(error.span());
        assert_eq!(play_fixture::gameplay_snapshot(d.games), before);
        assert!(spy.get_events().emitted_by(d.games).events.is_empty());
    }
}

#[test_case(name: "route_00_roots_00_07", 0, 0)]
#[test_case(name: "route_00_roots_08_15", 0, 8)]
#[test_case(name: "route_00_roots_16_23", 0, 16)]
#[test_case(name: "route_00_roots_24_31", 0, 24)]
#[test_case(name: "route_01_roots_00_07", 1, 0)]
#[test_case(name: "route_01_roots_08_15", 1, 8)]
#[test_case(name: "route_01_roots_16_23", 1, 16)]
#[test_case(name: "route_01_roots_24_31", 1, 24)]
#[test_case(name: "route_02_roots_00_07", 2, 0)]
#[test_case(name: "route_02_roots_08_15", 2, 8)]
#[test_case(name: "route_02_roots_16_23", 2, 16)]
#[test_case(name: "route_02_roots_24_31", 2, 24)]
#[test_case(name: "route_03_roots_00_07", 3, 0)]
#[test_case(name: "route_03_roots_08_15", 3, 8)]
#[test_case(name: "route_03_roots_16_23", 3, 16)]
#[test_case(name: "route_03_roots_24_31", 3, 24)]
#[test_case(name: "route_04_roots_00_07", 4, 0)]
#[test_case(name: "route_04_roots_08_15", 4, 8)]
#[test_case(name: "route_04_roots_16_23", 4, 16)]
#[test_case(name: "route_04_roots_24_31", 4, 24)]
#[test_case(name: "route_05_roots_00_07", 5, 0)]
#[test_case(name: "route_05_roots_08_15", 5, 8)]
#[test_case(name: "route_05_roots_16_23", 5, 16)]
#[test_case(name: "route_05_roots_24_31", 5, 24)]
#[test_case(name: "route_06_roots_00_07", 6, 0)]
#[test_case(name: "route_06_roots_08_15", 6, 8)]
#[test_case(name: "route_06_roots_16_23", 6, 16)]
#[test_case(name: "route_06_roots_24_31", 6, 24)]
#[test_case(name: "route_07_roots_00_07", 7, 0)]
#[test_case(name: "route_07_roots_08_15", 7, 8)]
#[test_case(name: "route_07_roots_16_23", 7, 16)]
#[test_case(name: "route_07_roots_24_31", 7, 24)]
#[test_case(name: "route_08_roots_00_07", 8, 0)]
#[test_case(name: "route_08_roots_08_15", 8, 8)]
#[test_case(name: "route_08_roots_16_23", 8, 16)]
#[test_case(name: "route_08_roots_24_31", 8, 24)]
#[test_case(name: "route_09_roots_00_07", 9, 0)]
#[test_case(name: "route_09_roots_08_15", 9, 8)]
#[test_case(name: "route_09_roots_16_23", 9, 16)]
#[test_case(name: "route_09_roots_24_31", 9, 24)]
#[test_case(name: "route_10_roots_00_07", 10, 0)]
#[test_case(name: "route_10_roots_08_15", 10, 8)]
#[test_case(name: "route_10_roots_16_23", 10, 16)]
#[test_case(name: "route_10_roots_24_31", 10, 24)]
#[test_case(name: "route_11_roots_00_07", 11, 0)]
#[test_case(name: "route_11_roots_08_15", 11, 8)]
#[test_case(name: "route_11_roots_16_23", 11, 16)]
#[test_case(name: "route_11_roots_24_31", 11, 24)]
#[test_case(name: "route_12_roots_00_07", 12, 0)]
#[test_case(name: "route_12_roots_08_15", 12, 8)]
#[test_case(name: "route_12_roots_16_23", 12, 16)]
#[test_case(name: "route_12_roots_24_31", 12, 24)]
#[test_case(name: "route_13_roots_00_07", 13, 0)]
#[test_case(name: "route_13_roots_08_15", 13, 8)]
#[test_case(name: "route_13_roots_16_23", 13, 16)]
#[test_case(name: "route_13_roots_24_31", 13, 24)]
#[test_case(name: "route_14_roots_00_07", 14, 0)]
#[test_case(name: "route_14_roots_08_15", 14, 8)]
#[test_case(name: "route_14_roots_16_23", 14, 16)]
#[test_case(name: "route_14_roots_24_31", 14, 24)]
#[test_case(name: "route_15_roots_00_07", 15, 0)]
#[test_case(name: "route_15_roots_08_15", 15, 8)]
#[test_case(name: "route_15_roots_16_23", 15, 16)]
#[test_case(name: "route_15_roots_24_31", 15, 24)]
#[test_case(name: "route_16_roots_00_07", 16, 0)]
#[test_case(name: "route_16_roots_08_15", 16, 8)]
#[test_case(name: "route_16_roots_16_23", 16, 16)]
#[test_case(name: "route_16_roots_24_31", 16, 24)]
#[test_case(name: "route_17_roots_00_07", 17, 0)]
#[test_case(name: "route_17_roots_08_15", 17, 8)]
#[test_case(name: "route_17_roots_16_23", 17, 16)]
#[test_case(name: "route_17_roots_24_31", 17, 24)]
#[test_case(name: "route_18_roots_00_07", 18, 0)]
#[test_case(name: "route_18_roots_08_15", 18, 8)]
#[test_case(name: "route_18_roots_16_23", 18, 16)]
#[test_case(name: "route_18_roots_24_31", 18, 24)]
#[test_case(name: "route_19_roots_00_07", 19, 0)]
#[test_case(name: "route_19_roots_08_15", 19, 8)]
#[test_case(name: "route_19_roots_16_23", 19, 16)]
#[test_case(name: "route_19_roots_24_31", 19, 24)]
#[test_case(name: "route_20_roots_00_07", 20, 0)]
#[test_case(name: "route_20_roots_08_15", 20, 8)]
#[test_case(name: "route_20_roots_16_23", 20, 16)]
#[test_case(name: "route_20_roots_24_31", 20, 24)]
#[test_case(name: "route_21_roots_00_07", 21, 0)]
#[test_case(name: "route_21_roots_08_15", 21, 8)]
#[test_case(name: "route_21_roots_16_23", 21, 16)]
#[test_case(name: "route_21_roots_24_31", 21, 24)]
#[test_case(name: "route_22_roots_00_07", 22, 0)]
#[test_case(name: "route_22_roots_08_15", 22, 8)]
#[test_case(name: "route_22_roots_16_23", 22, 16)]
#[test_case(name: "route_22_roots_24_31", 22, 24)]
#[test_case(name: "route_23_roots_00_07", 23, 0)]
#[test_case(name: "route_23_roots_08_15", 23, 8)]
#[test_case(name: "route_23_roots_16_23", 23, 16)]
#[test_case(name: "route_23_roots_24_31", 23, 24)]
#[test_case(name: "route_24_roots_00_07", 24, 0)]
#[test_case(name: "route_24_roots_08_15", 24, 8)]
#[test_case(name: "route_24_roots_16_23", 24, 16)]
#[test_case(name: "route_24_roots_24_31", 24, 24)]
#[test_case(name: "route_25_roots_00_07", 25, 0)]
#[test_case(name: "route_25_roots_08_15", 25, 8)]
#[test_case(name: "route_25_roots_16_23", 25, 16)]
#[test_case(name: "route_25_roots_24_31", 25, 24)]
#[test_case(name: "route_26_roots_00_07", 26, 0)]
#[test_case(name: "route_26_roots_08_15", 26, 8)]
#[test_case(name: "route_26_roots_16_23", 26, 16)]
#[test_case(name: "route_26_roots_24_31", 26, 24)]
#[test_case(name: "route_27_roots_00_07", 27, 0)]
#[test_case(name: "route_27_roots_08_15", 27, 8)]
#[test_case(name: "route_27_roots_16_23", 27, 16)]
#[test_case(name: "route_27_roots_24_31", 27, 24)]
#[test_case(name: "route_28_roots_00_07", 28, 0)]
#[test_case(name: "route_28_roots_08_15", 28, 8)]
#[test_case(name: "route_28_roots_16_23", 28, 16)]
#[test_case(name: "route_28_roots_24_31", 28, 24)]
#[test_case(name: "route_29_roots_00_07", 29, 0)]
#[test_case(name: "route_29_roots_08_15", 29, 8)]
#[test_case(name: "route_29_roots_16_23", 29, 16)]
#[test_case(name: "route_29_roots_24_31", 29, 24)]
#[test_case(name: "route_30_roots_00_07", 30, 0)]
#[test_case(name: "route_30_roots_08_15", 30, 8)]
#[test_case(name: "route_30_roots_16_23", 30, 16)]
#[test_case(name: "route_30_roots_24_31", 30, 24)]
#[test_case(name: "route_31_roots_00_07", 31, 0)]
#[test_case(name: "route_31_roots_08_15", 31, 8)]
#[test_case(name: "route_31_roots_16_23", 31, 16)]
#[test_case(name: "route_31_roots_24_31", 31, 24)]
#[test_case(name: "route_32_roots_00_07", 32, 0)]
#[test_case(name: "route_32_roots_08_15", 32, 8)]
#[test_case(name: "route_32_roots_16_23", 32, 16)]
#[test_case(name: "route_32_roots_24_31", 32, 24)]
#[test_case(name: "route_33_roots_00_07", 33, 0)]
#[test_case(name: "route_33_roots_08_15", 33, 8)]
#[test_case(name: "route_33_roots_16_23", 33, 16)]
#[test_case(name: "route_33_roots_24_31", 33, 24)]
#[test_case(name: "route_34_roots_00_07", 34, 0)]
#[test_case(name: "route_34_roots_08_15", 34, 8)]
#[test_case(name: "route_34_roots_16_23", 34, 16)]
#[test_case(name: "route_34_roots_24_31", 34, 24)]
#[test_case(name: "route_35_roots_00_07", 35, 0)]
#[test_case(name: "route_35_roots_08_15", 35, 8)]
#[test_case(name: "route_35_roots_16_23", 35, 16)]
#[test_case(name: "route_35_roots_24_31", 35, 24)]
#[test_case(name: "route_36_roots_00_07", 36, 0)]
#[test_case(name: "route_36_roots_08_15", 36, 8)]
#[test_case(name: "route_36_roots_16_23", 36, 16)]
#[test_case(name: "route_36_roots_24_31", 36, 24)]
#[test_case(name: "route_37_roots_00_07", 37, 0)]
#[test_case(name: "route_37_roots_08_15", 37, 8)]
#[test_case(name: "route_37_roots_16_23", 37, 16)]
#[test_case(name: "route_37_roots_24_31", 37, 24)]
#[test_case(name: "route_38_roots_00_07", 38, 0)]
#[test_case(name: "route_38_roots_08_15", 38, 8)]
#[test_case(name: "route_38_roots_16_23", 38, 16)]
#[test_case(name: "route_38_roots_24_31", 38, 24)]
#[test_case(name: "route_39_roots_00_07", 39, 0)]
#[test_case(name: "route_39_roots_08_15", 39, 8)]
#[test_case(name: "route_39_roots_16_23", 39, 16)]
#[test_case(name: "route_39_roots_24_31", 39, 24)]
fn all_real_domain_verdicts_are_root_independent(index: u32, start: u64) {
    let commands = typed_commands();
    assert_eq!(commands.len(), routes());
    let command = *commands.at(index);
    assert_route(command, index);
    assert!(start + 8 <= ROOTS);
    let d = fresh_world();
    let action = TestAction { game_id: 1, actor: d.actor, command };
    let expected = verdict(d.games, action, 0, play_fixture::FIXTURE_START);
    assert_ne!(expected, Verdict::Applied, "route {} applies, so its roots need fresh worlds", index);
    let refused = match @expected {
        Verdict::Refused(_) => true,
        _ => false,
    };
    assert_eq!(refused, !release_enables(index), "route {}", index);
    let settled = play_fixture::gameplay_snapshot(d.games);
    for root in start..start + 8 {
        assert_eq!(
            verdict(d.games, action, root.into(), play_fixture::FIXTURE_START),
            expected,
            "route {} root {}",
            index,
            root,
        );
        assert_eq!(play_fixture::gameplay_snapshot(d.games), settled);
    }
}

#[test_case(name: "case_0_roots_00_01", 0, 0)]
#[test_case(name: "case_0_roots_02_03", 0, 2)]
#[test_case(name: "case_0_roots_04_05", 0, 4)]
#[test_case(name: "case_0_roots_06_07", 0, 6)]
#[test_case(name: "case_0_roots_08_09", 0, 8)]
#[test_case(name: "case_0_roots_10_11", 0, 10)]
#[test_case(name: "case_0_roots_12_13", 0, 12)]
#[test_case(name: "case_0_roots_14_15", 0, 14)]
#[test_case(name: "case_0_roots_16_17", 0, 16)]
#[test_case(name: "case_0_roots_18_19", 0, 18)]
#[test_case(name: "case_0_roots_20_21", 0, 20)]
#[test_case(name: "case_0_roots_22_23", 0, 22)]
#[test_case(name: "case_0_roots_24_25", 0, 24)]
#[test_case(name: "case_0_roots_26_27", 0, 26)]
#[test_case(name: "case_0_roots_28_29", 0, 28)]
#[test_case(name: "case_0_roots_30_31", 0, 30)]
#[test_case(name: "case_1_roots_00_01", 1, 0)]
#[test_case(name: "case_1_roots_02_03", 1, 2)]
#[test_case(name: "case_1_roots_04_05", 1, 4)]
#[test_case(name: "case_1_roots_06_07", 1, 6)]
#[test_case(name: "case_1_roots_08_09", 1, 8)]
#[test_case(name: "case_1_roots_10_11", 1, 10)]
#[test_case(name: "case_1_roots_12_13", 1, 12)]
#[test_case(name: "case_1_roots_14_15", 1, 14)]
#[test_case(name: "case_1_roots_16_17", 1, 16)]
#[test_case(name: "case_1_roots_18_19", 1, 18)]
#[test_case(name: "case_1_roots_20_21", 1, 20)]
#[test_case(name: "case_1_roots_22_23", 1, 22)]
#[test_case(name: "case_1_roots_24_25", 1, 24)]
#[test_case(name: "case_1_roots_26_27", 1, 26)]
#[test_case(name: "case_1_roots_28_29", 1, 28)]
#[test_case(name: "case_1_roots_30_31", 1, 30)]
#[test_case(name: "case_2_roots_00_01", 2, 0)]
#[test_case(name: "case_2_roots_02_03", 2, 2)]
#[test_case(name: "case_2_roots_04_05", 2, 4)]
#[test_case(name: "case_2_roots_06_07", 2, 6)]
#[test_case(name: "case_2_roots_08_09", 2, 8)]
#[test_case(name: "case_2_roots_10_11", 2, 10)]
#[test_case(name: "case_2_roots_12_13", 2, 12)]
#[test_case(name: "case_2_roots_14_15", 2, 14)]
#[test_case(name: "case_2_roots_16_17", 2, 16)]
#[test_case(name: "case_2_roots_18_19", 2, 18)]
#[test_case(name: "case_2_roots_20_21", 2, 20)]
#[test_case(name: "case_2_roots_22_23", 2, 22)]
#[test_case(name: "case_2_roots_24_25", 2, 24)]
#[test_case(name: "case_2_roots_26_27", 2, 26)]
#[test_case(name: "case_2_roots_28_29", 2, 28)]
#[test_case(name: "case_2_roots_30_31", 2, 30)]
#[test_case(name: "case_3_roots_00_01", 3, 0)]
#[test_case(name: "case_3_roots_02_03", 3, 2)]
#[test_case(name: "case_3_roots_04_05", 3, 4)]
#[test_case(name: "case_3_roots_06_07", 3, 6)]
#[test_case(name: "case_3_roots_08_09", 3, 8)]
#[test_case(name: "case_3_roots_10_11", 3, 10)]
#[test_case(name: "case_3_roots_12_13", 3, 12)]
#[test_case(name: "case_3_roots_14_15", 3, 14)]
#[test_case(name: "case_3_roots_16_17", 3, 16)]
#[test_case(name: "case_3_roots_18_19", 3, 18)]
#[test_case(name: "case_3_roots_20_21", 3, 20)]
#[test_case(name: "case_3_roots_22_23", 3, 22)]
#[test_case(name: "case_3_roots_24_25", 3, 24)]
#[test_case(name: "case_3_roots_26_27", 3, 26)]
#[test_case(name: "case_3_roots_28_29", 3, 28)]
#[test_case(name: "case_3_roots_30_31", 3, 30)]
fn successful_real_draw_paths_stay_applied_across_32_roots(case: u8, start: u64) {
    assert!(start + FRESH_WORLD_ROOTS <= ROOTS);
    for root in start..start + FRESH_WORLD_ROOTS {
        let (d, action, timestamp) = draw_case(case);
        assert_eq!(verdict(d.games, action, root.into(), timestamp), Verdict::Applied, "case {} root {}", case, root);
    }
}

#[test_case(name: "battle_missing_0_full_0_roots_00_01", false, false, 0)]
#[test_case(name: "battle_missing_0_full_0_roots_02_03", false, false, 2)]
#[test_case(name: "battle_missing_0_full_0_roots_04_05", false, false, 4)]
#[test_case(name: "battle_missing_0_full_0_roots_06_07", false, false, 6)]
#[test_case(name: "battle_missing_0_full_0_roots_08_09", false, false, 8)]
#[test_case(name: "battle_missing_0_full_0_roots_10_11", false, false, 10)]
#[test_case(name: "battle_missing_0_full_0_roots_12_13", false, false, 12)]
#[test_case(name: "battle_missing_0_full_0_roots_14_15", false, false, 14)]
#[test_case(name: "battle_missing_0_full_0_roots_16_17", false, false, 16)]
#[test_case(name: "battle_missing_0_full_0_roots_18_19", false, false, 18)]
#[test_case(name: "battle_missing_0_full_0_roots_20_21", false, false, 20)]
#[test_case(name: "battle_missing_0_full_0_roots_22_23", false, false, 22)]
#[test_case(name: "battle_missing_0_full_0_roots_24_25", false, false, 24)]
#[test_case(name: "battle_missing_0_full_0_roots_26_27", false, false, 26)]
#[test_case(name: "battle_missing_0_full_0_roots_28_29", false, false, 28)]
#[test_case(name: "battle_missing_0_full_0_roots_30_31", false, false, 30)]
#[test_case(name: "battle_missing_0_full_1_roots_00_01", false, true, 0)]
#[test_case(name: "battle_missing_0_full_1_roots_02_03", false, true, 2)]
#[test_case(name: "battle_missing_0_full_1_roots_04_05", false, true, 4)]
#[test_case(name: "battle_missing_0_full_1_roots_06_07", false, true, 6)]
#[test_case(name: "battle_missing_0_full_1_roots_08_09", false, true, 8)]
#[test_case(name: "battle_missing_0_full_1_roots_10_11", false, true, 10)]
#[test_case(name: "battle_missing_0_full_1_roots_12_13", false, true, 12)]
#[test_case(name: "battle_missing_0_full_1_roots_14_15", false, true, 14)]
#[test_case(name: "battle_missing_0_full_1_roots_16_17", false, true, 16)]
#[test_case(name: "battle_missing_0_full_1_roots_18_19", false, true, 18)]
#[test_case(name: "battle_missing_0_full_1_roots_20_21", false, true, 20)]
#[test_case(name: "battle_missing_0_full_1_roots_22_23", false, true, 22)]
#[test_case(name: "battle_missing_0_full_1_roots_24_25", false, true, 24)]
#[test_case(name: "battle_missing_0_full_1_roots_26_27", false, true, 26)]
#[test_case(name: "battle_missing_0_full_1_roots_28_29", false, true, 28)]
#[test_case(name: "battle_missing_0_full_1_roots_30_31", false, true, 30)]
#[test_case(name: "battle_missing_1_full_0_roots_00_01", true, false, 0)]
#[test_case(name: "battle_missing_1_full_0_roots_02_03", true, false, 2)]
#[test_case(name: "battle_missing_1_full_0_roots_04_05", true, false, 4)]
#[test_case(name: "battle_missing_1_full_0_roots_06_07", true, false, 6)]
#[test_case(name: "battle_missing_1_full_0_roots_08_09", true, false, 8)]
#[test_case(name: "battle_missing_1_full_0_roots_10_11", true, false, 10)]
#[test_case(name: "battle_missing_1_full_0_roots_12_13", true, false, 12)]
#[test_case(name: "battle_missing_1_full_0_roots_14_15", true, false, 14)]
#[test_case(name: "battle_missing_1_full_0_roots_16_17", true, false, 16)]
#[test_case(name: "battle_missing_1_full_0_roots_18_19", true, false, 18)]
#[test_case(name: "battle_missing_1_full_0_roots_20_21", true, false, 20)]
#[test_case(name: "battle_missing_1_full_0_roots_22_23", true, false, 22)]
#[test_case(name: "battle_missing_1_full_0_roots_24_25", true, false, 24)]
#[test_case(name: "battle_missing_1_full_0_roots_26_27", true, false, 26)]
#[test_case(name: "battle_missing_1_full_0_roots_28_29", true, false, 28)]
#[test_case(name: "battle_missing_1_full_0_roots_30_31", true, false, 30)]
#[test_case(name: "battle_missing_1_full_1_roots_00_01", true, true, 0)]
#[test_case(name: "battle_missing_1_full_1_roots_02_03", true, true, 2)]
#[test_case(name: "battle_missing_1_full_1_roots_04_05", true, true, 4)]
#[test_case(name: "battle_missing_1_full_1_roots_06_07", true, true, 6)]
#[test_case(name: "battle_missing_1_full_1_roots_08_09", true, true, 8)]
#[test_case(name: "battle_missing_1_full_1_roots_10_11", true, true, 10)]
#[test_case(name: "battle_missing_1_full_1_roots_12_13", true, true, 12)]
#[test_case(name: "battle_missing_1_full_1_roots_14_15", true, true, 14)]
#[test_case(name: "battle_missing_1_full_1_roots_16_17", true, true, 16)]
#[test_case(name: "battle_missing_1_full_1_roots_18_19", true, true, 18)]
#[test_case(name: "battle_missing_1_full_1_roots_20_21", true, true, 20)]
#[test_case(name: "battle_missing_1_full_1_roots_22_23", true, true, 22)]
#[test_case(name: "battle_missing_1_full_1_roots_24_25", true, true, 24)]
#[test_case(name: "battle_missing_1_full_1_roots_26_27", true, true, 26)]
#[test_case(name: "battle_missing_1_full_1_roots_28_29", true, true, 28)]
#[test_case(name: "battle_missing_1_full_1_roots_30_31", true, true, 30)]
fn real_battle_loot_verdicts_do_not_select_a_roll(insufficient: bool, full: bool, start: u64) {
    assert!(start + FRESH_WORLD_ROOTS <= ROOTS);
    for root in start..start + FRESH_WORLD_ROOTS {
        let (d, action) = live_loot_case(insufficient, full);
        let before = play_fixture::gameplay_snapshot(d.games);
        let applied = play_fixture::play(d.games, action, root.into(), play_fixture::FIXTURE_START);
        assert_eq!(applied, !insufficient, "missing {} full {} root {}", insufficient, full, root);
        if !applied {
            assert_eq!(play_fixture::gameplay_snapshot(d.games), before);
        }
    }
}

#[test_case(name: "capacity_full_roots_00_01", 0, 0)]
#[test_case(name: "capacity_full_roots_02_03", 0, 2)]
#[test_case(name: "capacity_full_roots_04_05", 0, 4)]
#[test_case(name: "capacity_full_roots_06_07", 0, 6)]
#[test_case(name: "capacity_full_roots_08_09", 0, 8)]
#[test_case(name: "capacity_full_roots_10_11", 0, 10)]
#[test_case(name: "capacity_full_roots_12_13", 0, 12)]
#[test_case(name: "capacity_full_roots_14_15", 0, 14)]
#[test_case(name: "capacity_full_roots_16_17", 0, 16)]
#[test_case(name: "capacity_full_roots_18_19", 0, 18)]
#[test_case(name: "capacity_full_roots_20_21", 0, 20)]
#[test_case(name: "capacity_full_roots_22_23", 0, 22)]
#[test_case(name: "capacity_full_roots_24_25", 0, 24)]
#[test_case(name: "capacity_full_roots_26_27", 0, 26)]
#[test_case(name: "capacity_full_roots_28_29", 0, 28)]
#[test_case(name: "capacity_full_roots_30_31", 0, 30)]
#[test_case(name: "capacity_fractional_roots_00_01", crate::rules::RESOURCE_PRECISION - 1, 0)]
#[test_case(name: "capacity_fractional_roots_02_03", crate::rules::RESOURCE_PRECISION - 1, 2)]
#[test_case(name: "capacity_fractional_roots_04_05", crate::rules::RESOURCE_PRECISION - 1, 4)]
#[test_case(name: "capacity_fractional_roots_06_07", crate::rules::RESOURCE_PRECISION - 1, 6)]
#[test_case(name: "capacity_fractional_roots_08_09", crate::rules::RESOURCE_PRECISION - 1, 8)]
#[test_case(name: "capacity_fractional_roots_10_11", crate::rules::RESOURCE_PRECISION - 1, 10)]
#[test_case(name: "capacity_fractional_roots_12_13", crate::rules::RESOURCE_PRECISION - 1, 12)]
#[test_case(name: "capacity_fractional_roots_14_15", crate::rules::RESOURCE_PRECISION - 1, 14)]
#[test_case(name: "capacity_fractional_roots_16_17", crate::rules::RESOURCE_PRECISION - 1, 16)]
#[test_case(name: "capacity_fractional_roots_18_19", crate::rules::RESOURCE_PRECISION - 1, 18)]
#[test_case(name: "capacity_fractional_roots_20_21", crate::rules::RESOURCE_PRECISION - 1, 20)]
#[test_case(name: "capacity_fractional_roots_22_23", crate::rules::RESOURCE_PRECISION - 1, 22)]
#[test_case(name: "capacity_fractional_roots_24_25", crate::rules::RESOURCE_PRECISION - 1, 24)]
#[test_case(name: "capacity_fractional_roots_26_27", crate::rules::RESOURCE_PRECISION - 1, 26)]
#[test_case(name: "capacity_fractional_roots_28_29", crate::rules::RESOURCE_PRECISION - 1, 28)]
#[test_case(name: "capacity_fractional_roots_30_31", crate::rules::RESOURCE_PRECISION - 1, 30)]
fn real_movement_reward_stays_applied_at_full_and_fractional_stores(capacity: u128, start: u64) {
    assert!(start + FRESH_WORLD_ROOTS <= ROOTS);
    for root in start..start + FRESH_WORLD_ROOTS {
        let (d, action, timestamp) = explorer_case(true);
        snforge_std::interact_with_state(
            d.games,
            || {
                let explorer = crate::logic::troops::explorer(
                    crate::troops::ExplorerKey {
                        game_id: action.game_id,
                        explorer_id: match action.command {
                            Command::Explore(value) => value.explorer_id,
                            _ => panic!("explore fixture required"),
                        },
                    },
                )
                    .unwrap();
                let key = crate::resources::ResourceKey { game_id: action.game_id, entity_id: explorer.owner };
                let mut weight = 0;
                for resource_type in 1_u8..59 {
                    weight += crate::logic::resources::balance(key, resource_type)
                        * crate::logic::resources::rule(resource_type).unit_weight;
                }
                // The fixture normally has unlimited capacity and does not track weight. Reconstruct it before
                // switching to finite stores so spending real wheat and fish cannot underflow the held weight.
                crate::state::write()
                    .resources
                    .weights
                    .write(
                        (action.game_id, explorer.owner),
                        crate::resources::Weight { capacity: weight + capacity, weight },
                    );
            },
        );
        assert!(play_fixture::play(d.games, action, root.into(), timestamp), "capacity {} root {}", capacity, root);
    }
}
