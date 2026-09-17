use crate::biome::Biome;
use crate::combat::{CombatContext, TroopsTrait};
use crate::guards::Guard;
use crate::rules::{RESOURCE_PRECISION, SliceRules};
use crate::stamina::StaminaTrait;
use crate::troops::Troops;

#[derive(Copy, Drop, Serde)]
pub struct RaidResolution {
    pub explorer: Troops,
    pub guards: Span<Guard>,
    pub damage_to_explorer: u128,
    pub damage_to_guards: u128,
    pub guarded: bool,
}

pub fn resolve(
    mut explorer: Troops, guards: Span<Guard>, biome: Biome, rules: SliceRules, timestamp: u64,
) -> RaidResolution {
    assert!(guards.len() <= 4, "invalid guard slots");
    let mut count = 0_u128;
    for guard in guards {
        if *guard.troops.count != 0 {
            count += 1;
        }
    }
    if count == 0 {
        return RaidResolution { explorer, guards, damage_to_explorer: 0, damage_to_guards: 0, guarded: false };
    }
    let tick = timestamp / rules.tick_config.armies_tick_in_seconds;
    let mut portion = explorer;
    portion.count = explorer.count / count;
    portion.count -= portion.count % RESOURCE_PRECISION;
    assert!(portion.count >= RESOURCE_PRECISION, "not enough troops to pillage");
    let context = CombatContext {
        timestamp,
        attacker_roll: 0,
        defender_roll: 0,
        attacker_biome: biome,
        defender_biome: biome,
        attack_distance: 1,
        attacker_is_structure_guard: false,
        defender_is_structure_guard: false,
    };
    let mut updated = array![];
    let mut damage_to_explorer = 0;
    let mut damage_to_guards = 0;
    let mut received = 0;
    let mut stamina_loss = 0;
    for guard in guards {
        let mut guard = *guard;
        if guard.troops.count != 0 {
            // Shares attack simultaneously; one share's cooldown cannot block another.
            let mut attacking_portion = portion;
            let (guard_damage, explorer_damage, loss, _) = attacking_portion
                .damage_with_context(
                    ref guard.troops,
                    context,
                    rules.troop_stamina_config,
                    rules.troop_damage_config,
                    tick,
                    rules.tick_config.armies_tick_in_seconds,
                );
            stamina_loss = core::cmp::max(stamina_loss, loss);
            let damage = raid_damage(guard_damage, rules.troop_damage_config.damage_raid_percent_num);
            guard.troops.count -= core::cmp::min(guard.troops.count, damage);
            if guard.troops.count == 0 {
                guard.troops.stamina.reset();
                guard.destroyed_tick = tick.try_into().unwrap();
            }
            damage_to_explorer += explorer_damage;
            damage_to_guards += guard_damage;
            received += core::cmp::min(explorer_damage, portion.count);
        }
        updated.append(guard);
    }
    explorer
        .count -=
            core::cmp::min(explorer.count, raid_damage(received, rules.troop_damage_config.damage_raid_percent_num));
    explorer
        .stamina
        .spend(
            ref explorer.boosts, explorer.category, explorer.tier, rules.troop_stamina_config, stamina_loss, tick, true,
        );
    RaidResolution { explorer, guards: updated.span(), damage_to_explorer, damage_to_guards, guarded: true }
}

pub fn raid_damage(damage: u128, percent: u16) -> u128 {
    let scaled = Into::<u16, u128>::into(percent) * damage / 10000;
    // The raid rule rounds to the next whole troop, including exact multiples.
    scaled + RESOURCE_PRECISION - scaled % RESOURCE_PRECISION
}

pub fn success(result: RaidResolution, seed: u256, timestamp: u64) -> bool {
    if !result.guarded || result.damage_to_guards > result.damage_to_explorer * 2 {
        return true;
    }
    if result.damage_to_explorer > result.damage_to_guards * 2 {
        return false;
    }
    crate::random::range(seed, timestamp.into() + 18, result.damage_to_guards + result.damage_to_explorer) < result
        .damage_to_guards
}
