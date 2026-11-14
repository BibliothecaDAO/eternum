use crate::aspects::{order_aspect, pack};
use crate::banes::{BaneEffects, BaneWindow, required};
use crate::quests::{ClaimDailyQuest, reward};

#[test]
fn aspect_orders_pack_without_losing_the_first_or_last_order() {
    let orders = array![1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4];
    let packed = pack(orders.span()).unwrap();
    for index in 0_u32..16 {
        assert_eq!(order_aspect(packed, (index + 1).try_into().unwrap()), *orders.at(index));
    }
    assert_eq!(pack(array![].span()), None);
}

#[test]
#[should_panic(expected: ("Aspect needs four Orders",))]
fn an_aspect_cannot_take_another_aspects_order() {
    pack(array![1, 1, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4].span());
}

#[test]
fn quest_rewards_scale_by_level_and_only_labor_receives_its_bonus() {
    assert_eq!(reward(1000, 200, 100, 1), (1000, 200));
    assert_eq!(reward(1000, 200, 125, 2), (2500, 400));
    assert_eq!(reward(1000, 200, 125, 3), (5000, 800));
    assert_eq!(reward(1000, 200, 125, 4), (10000, 1600));
}

#[test]
fn bane_quorum_rounds_up_from_active_members() {
    assert_eq!(required(0, 25), 0);
    assert_eq!(required(1, 25), 1);
    assert_eq!(required(4, 25), 1);
    assert_eq!(required(5, 25), 2);
    assert_eq!(required(21, 25), 6);
    assert_eq!(required(0xffffffff, 100), 0xffffffff);
}

#[test]
fn claim_and_effect_consumers_share_the_published_wire_shapes() {
    let mut claim = array![];
    ClaimDailyQuest { home: 7, day: 3 }.serialize(ref claim);
    assert_eq!(claim.span(), array![7, 3].span());
    let mut effects = array![];
    BaneEffects {
        windows: array![BaneWindow { kind: 1, start: 10, end: 20 }].span(),
        beast_percent: 140,
        stamina_percent: 50,
        production_percent: 70,
    }
        .serialize(ref effects);
    assert_eq!(effects.span(), array![1, 1, 10, 20, 140, 50, 70].span());
}

#[test]
fn each_world_bane_names_its_shared_quest_kind() {
    assert_eq!(crate::banes::quest_kind(crate::banes::BLOOD_MOON), crate::quests::STAND);
    assert_eq!(crate::banes::quest_kind(crate::banes::MIST_TIDE), crate::quests::LIGHTS);
    assert_eq!(crate::banes::quest_kind(crate::banes::ASH_FALL), crate::quests::CULL);
}

#[test]
fn race_result_keeps_the_scheduled_end_beside_the_actual_finish() {
    let result = crate::race::RaceResult { winner: Some(2), ended_at: 42, scheduled_end_at: 100 };
    let mut encoded = array![];
    result.serialize(ref encoded);
    assert_eq!(encoded.span(), array![0, 2, 42, 100].span());
    let mut frame = encoded.span();
    assert_eq!(Serde::<crate::race::RaceResult>::deserialize(ref frame), Some(result));
    assert!(frame.is_empty());
}

#[test]
fn shared_deep_coordinates_keep_the_arrival_and_site_positions_in_one_region() {
    use crate::troops::Coord;
    assert_eq!(crate::deep::center(1024), Coord { alt: false, x: 512, y: 3584 });
    assert_eq!(crate::deep::arrival(1024), Coord { alt: false, x: 512, y: 3564 });
    assert_eq!(crate::deep::site_position(25, 35, 1024), Coord { alt: false, x: 512, y: 3594 });
    assert!(crate::deep::contains(Coord { alt: false, x: 487, y: 3559 }, 1024));
    assert!(crate::deep::contains(Coord { alt: false, x: 536, y: 3608 }, 1024));
    assert!(!crate::deep::contains(Coord { alt: false, x: 537, y: 3608 }, 1024));
    assert!(!crate::deep::contains(Coord { alt: true, x: 512, y: 3584 }, 1024));
}

#[test]
fn deep_troop_projection_stops_at_zero_and_never_drains_a_future_cursor() {
    assert_eq!(crate::deep::troops_after_ticks(1000, 10, 13, 200), 400);
    assert_eq!(crate::deep::troops_after_ticks(1000, 10, 15, 200), 0);
    assert_eq!(crate::deep::troops_after_ticks(1000, 10, 100, 200), 0);
    assert_eq!(crate::deep::troops_after_ticks(1000, 10, 9, 200), 1000);
}

#[test]
fn daily_quests_match_the_client_calendar_vector() {
    let expected = array![6_u8, 4, 0, 3, 1, 2, 5, 0, 2, 6, 3, 1, 4, 5, 4, 5, 2, 1, 3, 0, 6];
    for day in 0_u32..expected.len() {
        assert_eq!(crate::quests::daily_quest(5, day.into()), *expected.at(day));
    }
}

#[test]
fn every_week_has_every_quest_and_no_boundary_repeats() {
    for seed in 0_u32..10 {
        let mut previous = 255_u8;
        for week in 0_u64..8 {
            let mut seen = 0_u32;
            for index in 0_u64..7 {
                let quest = crate::quests::daily_quest(seed.into(), week * 7 + index);
                assert!(quest < crate::quests::QUEST_COUNT);
                assert!(quest != previous);
                let mut bit = 1_u32;
                for _ in 0..quest {
                    bit *= 2;
                }
                assert_eq!(seen & bit, 0);
                seen = seen | bit;
                previous = quest;
            }
            assert_eq!(seen, 127);
        }
    }
}
