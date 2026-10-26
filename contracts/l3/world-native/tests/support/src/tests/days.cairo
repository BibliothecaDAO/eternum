pub use core::num::traits::Pow;
pub use crate::days::{Day, bag_lengths, day_of, order_lengths, season_days};
pub use crate::game::GameRegistry;
pub const UNIT: u32 = 14400;
pub const START: u64 = 1_800_000_000;
pub fn season(seed: felt252) -> GameRegistry {
    GameRegistry {
        name: 'frontier',
        preset_id: 5,
        settled: false,
        ready: true,
        dev_mode_on: false,
        start_settling_at: START,
        start_main_at: START,
        end_at: START + 21 * 20 * UNIT.into(),
        end_grace_seconds: 0,
        seed,
    }
}
pub fn unpack(mut lengths: u64) -> Span<u64> {
    let mut days = array![];
    for _day in 0..5_u8 {
        days.append(lengths % 8);
        lengths /= 8;
    }
    assert_eq!(lengths, 0);
    days.span()
}
pub fn assert_whole_bag(days: Span<u64>) {
    let mut seen: u64 = 0;
    for length in days {
        assert!(*length >= 2 && *length <= 6, "day length outside the bag");
        seen = seen | 2_u64.pow((*length).try_into().unwrap());
    }
    // Each length once: the five bits 2..6 set, so the bag lasts 20 units.
    assert_eq!(seen, 0b1111100);
    assert!(*days[0] != 2, "a bag opens with the short day");
}
