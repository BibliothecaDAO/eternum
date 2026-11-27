use snforge_std::fs::{FileTrait, read_txt};
use crate::army_relics::{ArmyRelic, ArmyRelics, RelicCollectOutcome, RelicKind, collect, decode, encode, rank_of};

#[test]
fn all_twenty_five_relics_round_trip_without_an_empty_code() {
    let cap = crate::rules::ATTRIBUTE_CAP;
    for kind in 0_u8..crate::army_relics::RELIC_KIND_COUNT {
        for rank in 1_u8..(cap + 1) {
            let relic = ArmyRelic { kind: crate::army_relics::kind_at(kind), rank };
            assert_eq!(encode(relic), kind * cap + rank);
            assert_eq!(decode(encode(relic)), relic);
        }
    }
}

#[test]
fn per_kind_slots_collect_merge_replace_and_discard_deterministically() {
    let data = read_txt(@FileTrait::new("../fixtures/relic-collect.txt"));
    let mut fields = data.span();
    let mut rows: u32 = 0;
    while !fields.is_empty() {
        let (previous, found, expected_result, outcome_code): (u8, u8, u8, u8) = Serde::deserialize(ref fields)
            .unwrap();
        let expected_outcome = match outcome_code {
            0 => RelicCollectOutcome::Collected,
            1 => RelicCollectOutcome::Replaced,
            2 => RelicCollectOutcome::Merged,
            _ => RelicCollectOutcome::Discarded,
        };
        let mut loadout: ArmyRelics = Default::default();
        crate::army_relics::set_rank(ref loadout, RelicKind::Antidote, previous);
        assert_eq!(
            collect(ref loadout, ArmyRelic { kind: RelicKind::Antidote, rank: found }),
            (previous, expected_result, expected_outcome),
        );
        assert_eq!(rank_of(loadout, RelicKind::Antidote), expected_result);
        rows += 1;
    }
    let cap: u32 = crate::rules::ATTRIBUTE_CAP.into();
    assert_eq!(rows, (cap + 1) * cap);
}

#[test]
fn antidote_scales_five_percent_per_rank_and_stacks_additively_with_vitriol() {
    let data = read_txt(@FileTrait::new("../fixtures/antidote-deep-loss.txt"));
    let mut fields = data.span();
    let mut rows: u32 = 0;
    while !fields.is_empty() {
        let (
            oaths, base, rank, troops, last_tick, expiry_tick, end_tick, expected_loss, expected_troops,
        ): (u16, u128, u8, u128, u64, u64, u64, u128, u128) =
            Serde::deserialize(
            ref fields,
        )
            .unwrap();
        assert_eq!(crate::army_relics::deep_loss_for_army(oaths, base, rank), expected_loss);
        assert_eq!(
            crate::army_relics::deep_troops_after_ticks(troops, oaths, base, rank, last_tick, expiry_tick, end_tick),
            expected_troops,
        );
        rows += 1;
    }
    assert_eq!(rows, 9);
}

#[test]
fn effects_expire_and_all_five_kinds_run_simultaneously() {
    let key = crate::troops::ExplorerKey { game_id: 1, explorer_id: 7 };
    let site = crate::resources::ResourceKey { game_id: 1, entity_id: 9 };
    for kind_id in 0_u8..5 {
        let kind = crate::army_relics::kind_at(kind_id);
        crate::logic::army_relics::store_ruin(site, ArmyRelic { kind, rank: 3 });
        crate::logic::army_relics::award(key, site, 100);
        crate::logic::army_relics::activate(key, kind, 3, 100, crate::balance::rules::RELIC_SECONDS_PER_RANK);
    }
    let mut boosts: crate::troops::TroopBoosts = Default::default();
    boosts.incr_damage_dealt_percent_num = 2000;
    crate::logic::army_relics::combat_boosts(key, ref boosts, 5499);
    assert_eq!(boosts.incr_damage_dealt_percent_num, 5000);
    assert_eq!(boosts.decr_damage_gotten_percent_num, 1500);
    assert_eq!(crate::logic::army_relics::bonus(key, RelicKind::Plunder, 5499), 6000);
    assert_eq!(crate::logic::army_relics::bonus(key, RelicKind::StaminaRegen, 5499), 6000);
    assert_eq!(crate::logic::army_relics::bonus(key, RelicKind::Antidote, 5499), 1500);
    assert_eq!(crate::logic::army_relics::bonus(key, RelicKind::Blade, 5500), 0);
    crate::logic::army_relics::store_ruin(site, decode(1));
    crate::logic::army_relics::award(key, site, 101);
    crate::logic::army_relics::activate(key, RelicKind::Blade, 1, 101, crate::balance::rules::RELIC_SECONDS_PER_RANK);
    assert_eq!(crate::logic::army_relics::bonus(key, RelicKind::Blade, 102), 1000);
    crate::logic::army_relics::destroy(key);
    assert_eq!(crate::logic::army_relics::read(key), Default::default());
    assert_eq!(crate::logic::army_relics::bonus(key, RelicKind::Blade, 102), 0);
    assert_eq!(crate::logic::army_relics::bonus(key, RelicKind::Antidote, 102), 0);
}

#[test]
fn plunder_doubles_only_labor_and_essence_at_legendary() {
    let key = crate::troops::ExplorerKey { game_id: 1, explorer_id: 7 };
    let site = crate::resources::ResourceKey { game_id: 1, entity_id: 9 };
    crate::logic::army_relics::store_ruin(site, ArmyRelic { kind: RelicKind::Plunder, rank: 5 });
    crate::logic::army_relics::award(key, site, 100);
    crate::logic::army_relics::activate(key, RelicKind::Plunder, 5, 100, crate::balance::rules::RELIC_SECONDS_PER_RANK);
    for resource_type in array![crate::resources::LABOR, crate::resources::ESSENCE, crate::resources::WHEAT] {
        let reward = crate::resources::ResourceAmount { resource_type, amount: 500 };
        assert_eq!(
            crate::logic::army_relics::site_reward(key, reward, 101).amount,
            if resource_type == crate::resources::WHEAT {
                500
            } else {
                1000
            },
        );
        assert_eq!(crate::logic::army_relics::site_reward(key, reward, 9100), reward);
    }
    assert_eq!(rank_of(crate::logic::army_relics::read(key), RelicKind::Plunder), 0);
}
