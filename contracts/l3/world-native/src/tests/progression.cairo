use crate::progression::{
    ArmyProgress, ArmyProgressionRules, Attribute, AttributeOffer, ChooseAttribute, OfferSource, ProgressPacking,
};
use crate::stamina::StaminaSourceTrait;
use crate::tests::state::TroopObservationTrait;

fn rules() -> ArmyProgressionRules {
    super::preset_projection::frontier_progression_rules()
}
fn offer(id: u32) -> AttributeOffer {
    AttributeOffer {
        id,
        source: OfferSource::Level,
        amount: 1,
        choices: array![Attribute::Battle, Attribute::Logistics, Attribute::Scouting].span(),
    }
}
fn choose(progress: ArmyProgress) -> ChooseAttribute {
    let pending = progress.pending.unwrap();
    ChooseAttribute { explorer_id: 7, offer_id: pending.id, attribute: *pending.choices.at(0) }
}

#[test]
fn pending_pick_banks_two_thresholds_and_advances_only_after_each_choice() {
    let rules = rules();
    let mut progress = ArmyProgress { level: 2, xp: 7, pending: Some(offer(1)), ..crate::progression::initial() };
    let banked = rules.level_step_xp * (2 + 3);
    progress.xp += banked;
    assert!(!crate::progression::advance_level(ref progress, rules));
    assert_eq!(progress.level, 2);
    assert_eq!(progress.xp, banked + 7);
    assert_eq!(progress.pending, Some(offer(1)));

    let command = choose(progress);
    crate::progression::apply_choice(ref progress, command);
    assert!(crate::progression::advance_level(ref progress, rules));
    progress.pending = Some(offer(2));
    assert_eq!(progress.level, 3);
    assert_eq!(progress.xp, rules.level_step_xp * 3 + 7);
    assert!(!crate::progression::advance_level(ref progress, rules));

    let command = choose(progress);
    crate::progression::apply_choice(ref progress, command);
    assert!(crate::progression::advance_level(ref progress, rules));
    progress.pending = Some(offer(3));
    assert_eq!(progress.level, 4);
    assert_eq!(progress.xp, 7);
}

#[test]
fn threshold_is_inclusive_and_carries_the_remainder() {
    let rules = rules();
    let mut progress = ArmyProgress { xp: rules.level_step_xp - 1, ..crate::progression::initial() };
    assert!(!crate::progression::advance_level(ref progress, rules));
    progress.xp += 1;
    assert!(crate::progression::advance_level(ref progress, rules));
    assert_eq!(progress.level, 2);
    assert_eq!(progress.xp, 0);
}

#[test]
fn offers_are_unique_and_include_only_eligible_attributes() {
    for capped in 0_u8..5 {
        let progress = ArmyProgress {
            battle: if capped > 0 {
                5
            } else {
                1
            },
            logistics: if capped > 1 {
                5
            } else {
                1
            },
            scouting: if capped > 2 {
                5
            } else {
                1
            },
            support: if capped > 3 {
                5
            } else {
                1
            },
            ..crate::progression::initial(),
        };
        for seed in 0_u128..32 {
            let choices = crate::progression::draw_choices(progress, seed.into(), 77);
            assert_eq!(choices.len(), core::cmp::min(3, (4 - capped).into()));
            for i in 0..choices.len() {
                assert!(crate::progression::attribute_level(progress, *choices.at(i)) < 5);
                for j in 0..i {
                    assert!(*choices.at(i) != *choices.at(j));
                }
            }
        }
    }
}

#[test]
fn attribute_awards_cap_at_five_and_report_the_excess() {
    for amount in 1_u8..5 {
        let mut progress = ArmyProgress {
            battle: 4,
            pending: Some(AttributeOffer { amount, source: OfferSource::Relic, ..offer(1) }),
            ..crate::progression::initial(),
        };
        let command = choose(progress);
        let story = crate::progression::apply_choice(ref progress, command);
        assert_eq!(progress.battle, 5);
        assert_eq!(story.applied, 1);
        assert_eq!(story.lost, amount - 1);
        assert!(progress.pending.is_none());
    }
}

#[test]
#[should_panic(expected: ("stale attribute offer",))]
fn stale_offer_is_rejected() {
    let mut progress = ArmyProgress { pending: Some(offer(2)), ..crate::progression::initial() };
    crate::progression::apply_choice(
        ref progress, ChooseAttribute { explorer_id: 7, offer_id: 1, attribute: Attribute::Battle },
    );
}

#[test]
#[should_panic(expected: ('no pending attribute offer',))]
fn a_second_choice_is_rejected() {
    let mut progress = ArmyProgress { pending: Some(offer(1)), ..crate::progression::initial() };
    let command = choose(progress);
    crate::progression::apply_choice(ref progress, command);
    crate::progression::apply_choice(ref progress, command);
}

#[test]
fn packed_progress_round_trips_pending_and_full_integer_ranges() {
    for source in array![OfferSource::Level, OfferSource::Relic, OfferSource::Shrine] {
        for count in 0_u32..4 {
            let choices = array![Attribute::Support, Attribute::Battle, Attribute::Scouting];
            let progress = ArmyProgress {
                level: 65535,
                xp: 4294967295,
                battle: 1,
                logistics: 2,
                scouting: 3,
                support: 5,
                pending: Some(
                    AttributeOffer { id: 4294967295, source, amount: 4, choices: choices.span().slice(0, count) },
                ),
            };
            assert_eq!(ProgressPacking::unpack(ProgressPacking::pack(progress)), progress);
        }
    }
    let progress = crate::progression::initial();
    assert_eq!(ProgressPacking::unpack(ProgressPacking::pack(progress)), progress);
}

fn read_progress(d: super::Deployment, key: crate::troops::ExplorerKey) -> ArmyProgress {
    snforge_std::interact_with_state(d.games, || crate::logic::progression::require(key))
}
fn award(d: super::Deployment, key: crate::troops::ExplorerKey, kind: crate::progression::XpAward) {
    snforge_std::interact_with_state(
        d.games,
        || {
            let context = crate::commands::load_context(
                key.game_id, crate::commands::ActionContext { raw_root: 123, timestamp: 360 },
            );
            crate::logic::progression::award_xp(key, kind, context);
        },
    );
}
fn execute_choice(d: super::Deployment, key: crate::troops::ExplorerKey, offer: AttributeOffer) -> bool {
    super::resource_commands::execute_in_game(
        d,
        key.game_id,
        crate::commands::Command::ChooseAttribute(
            ChooseAttribute { explorer_id: key.explorer_id, offer_id: offer.id, attribute: *offer.choices.at(0) },
        ),
        360,
        360,
    )
}

#[test]
fn recorded_choices_release_banked_levels_and_reject_stale_offers() {
    let d = super::registrar::setup();
    let (game_id, _, category) = super::registrar::expedition_home(d);
    let (key, _) = super::registrar::expedition_armies(d, game_id, category);
    award(d, key, crate::progression::XpAward::Clear);
    let first = read_progress(d, key);
    assert_eq!(first.level, 2);
    assert_eq!(first.xp, 5);
    for _ in 0_u8..4 {
        award(d, key, crate::progression::XpAward::Clear);
    }
    let banked = read_progress(d, key);
    assert_eq!(banked.level, 2);
    assert_eq!(banked.xp, 105);
    assert_eq!(banked.pending, first.pending);
    assert!(execute_choice(d, key, first.pending.unwrap()));
    let second = read_progress(d, key);
    assert_eq!(second.level, 3);
    assert_eq!(second.xp, 65);
    assert!(second.pending.unwrap().id != first.pending.unwrap().id);
    assert!(!execute_choice(d, key, first.pending.unwrap()));
    assert_eq!(read_progress(d, key), second);
    assert!(execute_choice(d, key, second.pending.unwrap()));
    let third = read_progress(d, key);
    assert_eq!(third.level, 4);
    assert_eq!(third.xp, 5);
    assert!(third.pending.is_some());
}

#[test]
fn every_relic_quality_persists_its_attribute_amount_and_logistics_updates_the_slot() {
    let d = super::registrar::setup();
    let (game_id, preset, category) = super::registrar::expedition_home(d);
    let (key, _) = super::registrar::expedition_armies(d, game_id, category);
    for quality in 0_u8..4 {
        snforge_std::interact_with_state(
            d.games,
            || {
                crate::logic::progression::write(
                    key, ArmyProgress { battle: 5, scouting: 5, support: 5, ..crate::progression::initial() },
                );
                let context = crate::commands::load_context(
                    game_id, crate::commands::ActionContext { raw_root: 123, timestamp: 360 },
                );
                crate::logic::progression::grant_relic(key, quality, context);
            },
        );
        let offered = read_progress(d, key);
        let pending = offered.pending.unwrap();
        assert_eq!(pending.amount, quality + 1);
        assert_eq!(pending.source, OfferSource::Relic);
        assert_eq!(pending.choices, array![Attribute::Logistics].span());
        assert_eq!(read_progress(d, key), offered);
        let before = snforge_std::interact_with_state(
            d.games,
            || {
                let context = crate::commands::load_context(
                    game_id, crate::commands::ActionContext { raw_root: 123, timestamp: 360 },
                );
                crate::logic::troops::active_explorer(key, 360, context).troops
            },
        );
        assert!(execute_choice(d, key, pending));
        let progress = read_progress(d, key);
        assert_eq!(progress.logistics, quality + 2);
        let after = super::state::GameState { contract_address: d.games }.resolved_explorer(key).unwrap().troops;
        assert_eq!(
            after.stamina.inline().amount,
            before.stamina.inline().amount
                + Into::<u8, u64>::into(quality + 1) * crate::rules::ATTRIBUTE_STAMINA.into(),
        );
        assert_eq!(
            crate::progression::stamina_max(progress, after.category, preset.rules.troop_stamina_config),
            crate::stamina::StaminaImpl::max(
                after.category, crate::troops::TroopTier::T1, preset.rules.troop_stamina_config,
            )
                + Into::<u8, u64>::into(quality + 1) * crate::rules::ATTRIBUTE_STAMINA.into(),
        );
        assert!(!execute_choice(d, key, pending));
    }
    snforge_std::interact_with_state(
        d.games, || crate::logic::progression::write(key, ArmyProgress { battle: 3, ..crate::progression::initial() }),
    );
    let troops = super::state::GameState { contract_address: d.games }.resolved_explorer(key).unwrap().troops;
    assert_eq!(troops.boosts.incr_damage_dealt_percent_num, 20);
    assert_eq!(troops.boosts.incr_damage_dealt_end_tick, 0);
}
