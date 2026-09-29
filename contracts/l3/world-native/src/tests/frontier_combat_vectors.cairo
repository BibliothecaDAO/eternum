use core::dict::Felt252DictTrait;
use snforge_std::fs::{FileTrait, read_txt};
use crate::combat::{CombatContext, TroopsTrait};
use crate::rules::{TroopDamageConfig, TroopStaminaConfig};
use crate::stamina::StaminaSourceTrait;
use crate::troops::{Stamina, TroopBoosts, TroopTier, TroopType, Troops};

#[derive(Copy, Drop, Serde)]
struct Side {
    category: TroopType,
    tier: TroopTier,
    count: u128,
    stamina: u64,
    updated_tick: u64,
    damage_bonus_percent: u16,
}

#[derive(Copy, Drop, Serde)]
struct Exchange {
    id: u32,
    alt: bool,
    biome: u8,
    attack_distance: u8,
    timestamp: u64,
    current_tick: u64,
    attacker_is_structure_guard: bool,
    defender_is_structure_guard: bool,
    attacker: Side,
    defender: Side,
    expected: Outcome,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
struct Outcome {
    attacker_loss: u128,
    defender_loss: u128,
    attacker_stamina_after: u64,
    defender_stamina_after: u64,
}

#[test]
fn frontier_combat_matches_two_hundred_shared_exchanges() {
    check_vectors(false);
}

// Run explicitly on the box; the recording script merges these contract results into the shared input file.
#[test]
#[ignore]
fn record_frontier_combat_exchanges() {
    check_vectors(true);
}

fn check_vectors(record: bool) {
    let input = read_txt(@FileTrait::new("tests/fixtures/frontier-combat-v1.txt"));
    let mut fields = input.span();
    let version: u32 = Serde::deserialize(ref fields).unwrap();
    let count: u32 = Serde::deserialize(ref fields).unwrap();
    assert_eq!(version, 1);
    assert_eq!(count, 200);
    let damage: TroopDamageConfig = Serde::deserialize(ref fields).unwrap();
    let stamina: TroopStaminaConfig = Serde::deserialize(ref fields).unwrap();
    let tick_interval: u64 = Serde::deserialize(ref fields).unwrap();
    let mut surface = None;
    let mut coverage: core::dict::Felt252Dict<bool> = Default::default();
    for id in 0..count {
        let exchange: Exchange = Serde::deserialize(ref fields).unwrap();
        assert_eq!(exchange.id, id);
        assert_eq!(exchange.alt, id % 2 == 1);
        let category: u8 = exchange.defender.category.into();
        let attacker_tier = tier_index(exchange.attacker.tier);
        let defender_tier = tier_index(exchange.defender.tier);
        let guard = if exchange.defender_is_structure_guard {
            1_u8
        } else {
            0
        };
        let key: felt252 = (category * 18 + guard * 9 + defender_tier * 3 + attacker_tier).into();
        coverage.insert(key, true);
        let actual = resolve_exchange(exchange, damage, stamina, tick_interval);
        if exchange.alt {
            assert_eq!(actual, surface.unwrap());
        } else {
            surface = Some(actual);
        }
        if record {
            println!(
                "FRONTIER_EXCHANGE {} {} {} {} {}",
                id,
                actual.attacker_loss,
                actual.defender_loss,
                actual.attacker_stamina_after,
                actual.defender_stamina_after,
            );
        } else {
            assert_eq!(actual, exchange.expected, "combat vector {} differs", id);
        }
    }
    for key in 0_u8..54 {
        assert!(coverage.get(key.into()), "missing category/tier/guard pairing");
    }
    assert!(fields.is_empty(), "trailing combat vector data");
}

fn resolve_exchange(
    exchange: Exchange, damage: TroopDamageConfig, stamina: TroopStaminaConfig, tick_interval: u64,
) -> Outcome {
    let mut attacker = troops(exchange.attacker, exchange.current_tick);
    let mut defender = troops(exchange.defender, exchange.current_tick);
    attacker
        .attack_with_context(
            ref defender,
            CombatContext {
                timestamp: exchange.timestamp,
                attacker_roll: 0,
                defender_roll: 0,
                attacker_biome: exchange.biome.into(),
                defender_biome: exchange.biome.into(),
                attack_distance: exchange.attack_distance.into(),
                attacker_is_structure_guard: exchange.attacker_is_structure_guard,
                defender_is_structure_guard: exchange.defender_is_structure_guard,
            },
            stamina,
            damage,
            exchange.current_tick,
            tick_interval.try_into().unwrap(),
        );
    Outcome {
        attacker_loss: exchange.attacker.count - attacker.count,
        defender_loss: exchange.defender.count - defender.count,
        attacker_stamina_after: attacker.stamina.inline().amount,
        defender_stamina_after: defender.stamina.inline().amount,
    }
}

fn troops(side: Side, tick: u64) -> Troops {
    assert!(side.damage_bonus_percent <= 40, "unexpected Battle level");
    Troops {
        category: side.category,
        tier: side.tier,
        count: side.count,
        stamina: Stamina { amount: side.stamina, updated_tick: side.updated_tick }.into(),
        boosts: TroopBoosts {
            incr_damage_dealt_percent_num: side.damage_bonus_percent * 100,
            incr_damage_dealt_end_tick: (tick + 1).try_into().unwrap(),
            decr_damage_gotten_percent_num: 0,
            decr_damage_gotten_end_tick: 0,
            incr_stamina_regen_percent_num: 0,
            incr_stamina_regen_tick_count: 0,
            incr_explore_reward_percent_num: 0,
            incr_explore_reward_end_tick: 0,
        },
        battle_cooldown_end: 0,
    }
}

fn tier_index(tier: TroopTier) -> u8 {
    match tier {
        TroopTier::T1 => 0,
        TroopTier::T2 => 1,
        TroopTier::T3 => 2,
    }
}
