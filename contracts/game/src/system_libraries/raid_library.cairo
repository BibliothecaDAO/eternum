use crate::models::config::{TroopDamageConfig, TroopStaminaConfig};
use crate::models::troop::{GuardTroops, Troops};
use crate::utils::map::biomes::Biome;

#[derive(Copy, Drop, Serde)]
pub struct RaidResolution {
    pub explorer_troops: Troops,
    pub guard_troops: GuardTroops,
    pub destroyed_guard_count: u8,
    pub explorer_troops_lost: u128,
    pub sum_damage_to_explorer: u128,
    pub sum_damage_to_guards: u128,
    pub had_non_zero_guards: bool,
}

#[starknet::interface]
pub trait IRaidLibrary<T> {
    fn resolve_raid(
        self: @T,
        guard_troops: GuardTroops,
        explorer_troops: Troops,
        defender_biome: Biome,
        max_guard_count: u8,
        troop_stamina_config: TroopStaminaConfig,
        troop_damage_config: TroopDamageConfig,
        current_tick: u64,
        current_tick_interval: u64,
    ) -> RaidResolution;
}

#[dojo::library]
mod raid_library {
    use core::num::traits::Zero;
    use dojo::world::{WorldStorage, WorldStorageTrait};
    use crate::constants::RESOURCE_PRECISION;
    use crate::models::config::{TroopDamageConfig, TroopStaminaConfig};
    use crate::models::stamina::StaminaImpl;
    use crate::models::troop::{GuardImpl, GuardSlot, GuardTroops, Troops, TroopsImpl};
    use crate::utils::map::biomes::Biome;
    use crate::utils::math::PercentageValueImpl;
    use super::RaidResolution;

    #[abi(embed_v0)]
    pub impl RaidLibraryImpl of super::IRaidLibrary<ContractState> {
        fn resolve_raid(
            self: @ContractState,
            guard_troops: GuardTroops,
            explorer_troops: Troops,
            defender_biome: Biome,
            max_guard_count: u8,
            troop_stamina_config: TroopStaminaConfig,
            troop_damage_config: TroopDamageConfig,
            current_tick: u64,
            current_tick_interval: u64,
        ) -> RaidResolution {
            let mut guard_troops = guard_troops;
            let mut explorer_troops = explorer_troops;
            let non_zero_guard_slots = collect_non_zero_guard_slots(guard_troops, max_guard_count);
            if non_zero_guard_slots.len().is_zero() {
                return super::RaidResolution {
                    explorer_troops,
                    guard_troops,
                    destroyed_guard_count: 0,
                    explorer_troops_lost: 0,
                    sum_damage_to_explorer: 0,
                    sum_damage_to_guards: 0,
                    had_non_zero_guards: false,
                };
            }

            let mut individual_explorer_troops = explorer_troops;
            individual_explorer_troops.count = explorer_troops.count / non_zero_guard_slots.len().into();
            individual_explorer_troops.count -= individual_explorer_troops.count % RESOURCE_PRECISION;
            assert!(individual_explorer_troops.count >= RESOURCE_PRECISION, "not enough troops to pillage");

            let mut destroyed_guard_count: u8 = 0;
            let mut sum_damage_to_explorer: u128 = 0;
            let mut sum_damage_to_guards: u128 = 0;
            let mut max_explorer_stamina_loss: u64 = 0;
            let mut explorer_damage_received: u128 = 0;

            for i in 0..non_zero_guard_slots.len() {
                let slot = *non_zero_guard_slots.at(i);
                let (mut guard_slot_troops, guard_slot_destroyed_tick) = guard_troops.from_slot(slot);
                let (damage_to_guard, damage_to_explorer, explorer_stamina_loss, _guard_slot_stamina_loss) =
                    individual_explorer_troops
                    .damage(
                        ref guard_slot_troops,
                        defender_biome,
                        troop_stamina_config,
                        troop_damage_config,
                        current_tick,
                        current_tick_interval,
                    );

                if explorer_stamina_loss > max_explorer_stamina_loss {
                    max_explorer_stamina_loss = explorer_stamina_loss;
                }

                let applied_damage_to_guard = apply_raid_damage(
                    damage_to_guard, troop_damage_config.damage_raid_percent_num,
                );
                guard_slot_troops.count -= core::cmp::min(guard_slot_troops.count, applied_damage_to_guard);
                if guard_slot_troops.count.is_zero() {
                    guard_slot_troops.stamina.reset();
                    guard_troops.to_slot(slot, guard_slot_troops, current_tick);
                    destroyed_guard_count += 1;
                } else {
                    guard_troops.to_slot(slot, guard_slot_troops, guard_slot_destroyed_tick.into());
                }

                sum_damage_to_explorer += damage_to_explorer;
                sum_damage_to_guards += damage_to_guard;
                explorer_damage_received += core::cmp::min(damage_to_explorer, individual_explorer_troops.count);
            }

            let applied_damage_to_explorer = apply_raid_damage(
                explorer_damage_received, troop_damage_config.damage_raid_percent_num,
            );
            let explorer_troops_lost = core::cmp::min(explorer_troops.count, applied_damage_to_explorer);
            explorer_troops.count -= explorer_troops_lost;
            explorer_troops
                .stamina
                .spend(
                    ref explorer_troops.boosts,
                    explorer_troops.category,
                    explorer_troops.tier,
                    troop_stamina_config,
                    max_explorer_stamina_loss,
                    current_tick,
                    true,
                );

            super::RaidResolution {
                explorer_troops,
                guard_troops,
                destroyed_guard_count,
                explorer_troops_lost,
                sum_damage_to_explorer,
                sum_damage_to_guards,
                had_non_zero_guards: true,
            }
        }
    }

    pub fn get_dispatcher(world: @WorldStorage) -> super::IRaidLibraryLibraryDispatcher {
        let (_, class_hash) = world.dns(@"raid_library_v0_1_0").expect('raid_library not found');
        super::IRaidLibraryLibraryDispatcher { class_hash }
    }

    fn collect_non_zero_guard_slots(guard_troops: GuardTroops, max_guard_count: u8) -> Array<GuardSlot> {
        let mut guard_troops = guard_troops;
        let functional_guard_slots = guard_troops.functional_slots(max_guard_count.into());
        let mut non_zero_guard_slots = array![];
        for i in 0..functional_guard_slots.len() {
            let slot = *functional_guard_slots.at(i);
            let (guard_slot_troops, _) = guard_troops.from_slot(slot);
            if guard_slot_troops.count.is_non_zero() {
                non_zero_guard_slots.append(slot);
            }
        }
        non_zero_guard_slots
    }

    fn apply_raid_damage(damage: u128, damage_raid_percent_num: u16) -> u128 {
        let mut applied_damage = damage_raid_percent_num.into() * damage / PercentageValueImpl::_100().into();
        applied_damage += RESOURCE_PRECISION - (applied_damage % RESOURCE_PRECISION);
        applied_damage
    }
}
