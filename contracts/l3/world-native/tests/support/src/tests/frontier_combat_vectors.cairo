pub use core::dict::Felt252DictTrait;
pub use snforge_std::fs::{FileTrait, read_txt};
pub use crate::combat::{CombatContext, TroopsTrait};
pub use crate::rules::{TroopDamageConfig, TroopStaminaConfig};
pub use crate::stamina::StaminaSourceTrait;
pub use crate::troops::{Stamina, TroopBoosts, TroopTier, TroopType, Troops};

#[derive(Copy, Drop, Serde)]
pub struct Side {
    pub category: TroopType,
    pub tier: TroopTier,
    pub count: u128,
    pub stamina: u64,
    pub fixture_tick: u64,
    pub damage_bonus_percent: u16,
}

#[derive(Copy, Drop, Serde)]
pub struct Exchange {
    pub id: u32,
    pub alt: bool,
    pub biome: u8,
    pub attack_distance: u8,
    pub timestamp: u64,
    pub current_tick: u64,
    pub attacker_is_structure_guard: bool,
    pub defender_is_structure_guard: bool,
    pub attacker: Side,
    pub defender: Side,
    pub expected: Outcome,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct Outcome {
    pub attacker_loss: u128,
    pub defender_loss: u128,
    pub attacker_stamina_after: u64,
    pub defender_stamina_after: u64,
}
pub fn check_vectors(record: bool) {
    let input = read_txt(@FileTrait::new("../fixtures/frontier-combat-v1.txt"));
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
pub fn resolve_exchange(
    exchange: Exchange, damage: TroopDamageConfig, stamina: TroopStaminaConfig, tick_interval: u64,
) -> Outcome {
    let mut attacker = troops(exchange.attacker, exchange.current_tick, tick_interval);
    let mut defender = troops(exchange.defender, exchange.current_tick, tick_interval);
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
            tick_interval,
            tick_interval.try_into().unwrap(),
        );
    Outcome {
        attacker_loss: exchange.attacker.count - attacker.count,
        defender_loss: exchange.defender.count - defender.count,
        attacker_stamina_after: attacker.stamina.inline().amount,
        defender_stamina_after: defender.stamina.inline().amount,
    }
}
pub fn troops(side: Side, tick: u64, tick_seconds: u64) -> Troops {
    // The archived vector input records a tick index; convert it to a settled second.
    assert!(side.damage_bonus_percent <= 40, "unexpected Battle level");
    Troops {
        category: side.category,
        tier: side.tier,
        count: side.count,
        stamina: Stamina {
            amount: side.stamina, settled_at: (side.fixture_tick * tick_seconds).try_into().unwrap(), remainder: 0,
        }
            .into(),
        boosts: TroopBoosts {
            incr_damage_dealt_percent_num: side.damage_bonus_percent * 100,
            incr_damage_dealt_end_at: ((tick + 1) * tick_seconds).try_into().unwrap(),
            decr_damage_gotten_percent_num: 0,
            decr_damage_gotten_end_at: 0,
            incr_stamina_regen_percent_num: 0,
            incr_stamina_regen_seconds_left: 0,
            incr_explore_reward_percent_num: 0,
            incr_explore_reward_end_at: 0,
        },
        battle_cooldown_end: 0,
    }
}
pub fn tier_index(tier: TroopTier) -> u8 {
    match tier {
        TroopTier::T1 => 0,
        TroopTier::T2 => 1,
        TroopTier::T3 => 2,
    }
}
