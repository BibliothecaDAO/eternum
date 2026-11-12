use crate::army_relics::{ArmyRelic, ArmyRelics, RelicKind, decode, encode, receive, slot};

#[test]
fn all_twenty_five_relics_round_trip_without_an_empty_code() {
    for kind in 0_u8..5 {
        for rank in 1_u8..6 {
            let relic = ArmyRelic { kind: crate::army_relics::kind_at(kind), rank };
            assert_eq!(encode(relic), kind * 5 + rank);
            assert_eq!(decode(encode(relic)), relic);
        }
    }
}

#[test]
fn three_slots_fill_and_the_fourth_replaces_only_the_chosen_slot() {
    let mut loadout: ArmyRelics = Default::default();
    for index in 0_u8..3 {
        receive(ref loadout, decode(index + 1), None);
    }
    receive(ref loadout, ArmyRelic { kind: RelicKind::Tome, rank: 5 }, Some(1));
    assert_eq!(loadout, ArmyRelics { first: Some(decode(1)), second: Some(decode(25)), third: Some(decode(3)) });
}

#[test]
#[should_panic(expected: "choose a relic to replace")]
fn a_full_loadout_needs_a_replacement_choice() {
    let mut loadout: ArmyRelics = Default::default();
    for index in 0_u8..4 {
        receive(ref loadout, decode(index + 1), None);
    }
}

#[test]
fn effects_expire_and_add_to_battle_without_stacking_the_same_kind() {
    let key = crate::troops::ExplorerKey { game_id: 1, explorer_id: 7 };
    let site = crate::resources::ResourceKey { game_id: 1, entity_id: 9 };
    crate::logic::army_relics::store_ruin(site, ArmyRelic { kind: RelicKind::Blade, rank: 3 });
    crate::logic::army_relics::award(key, site, None);
    crate::logic::army_relics::activate(key, 0, 3, 100);
    let mut boosts: crate::troops::TroopBoosts = Default::default();
    boosts.incr_damage_dealt_percent_num = 2000;
    crate::logic::army_relics::combat_boosts(key, ref boosts, 5499);
    assert_eq!(boosts.incr_damage_dealt_percent_num, 5000);
    assert_eq!(crate::logic::army_relics::bonus(key, RelicKind::Blade, 5500), 0);
    crate::logic::army_relics::store_ruin(site, decode(1));
    crate::logic::army_relics::award(key, site, None);
    crate::logic::army_relics::activate(key, 0, 1, 101);
    assert_eq!(crate::logic::army_relics::bonus(key, RelicKind::Blade, 102), 1000);
    crate::logic::army_relics::destroy(key);
    assert_eq!(crate::logic::army_relics::read(key), Default::default());
    assert_eq!(crate::logic::army_relics::bonus(key, RelicKind::Blade, 102), 0);
}

#[test]
fn plunder_doubles_only_labor_and_essence_at_legendary() {
    let key = crate::troops::ExplorerKey { game_id: 1, explorer_id: 7 };
    let site = crate::resources::ResourceKey { game_id: 1, entity_id: 9 };
    crate::logic::army_relics::store_ruin(site, ArmyRelic { kind: RelicKind::Plunder, rank: 5 });
    crate::logic::army_relics::award(key, site, None);
    crate::logic::army_relics::activate(key, 0, 15, 100);
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
    assert_eq!(slot(crate::logic::army_relics::read(key), 0), None);
}
