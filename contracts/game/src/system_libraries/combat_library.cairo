use crate::models::config::{TroopDamageConfig, TroopStaminaConfig};
use crate::models::troop::{CombatContext, Troops};

#[starknet::interface]
pub trait ICombatLibrary<T> {
    fn troops_attack(
        self: @T,
        attacker: Troops,
        defender: Troops,
        context: CombatContext,
        troop_stamina_config: TroopStaminaConfig,
        troop_damage_config: TroopDamageConfig,
        current_tick: u64,
        current_tick_interval: u64,
    ) -> (Troops, Troops);
}

#[dojo::library]
mod combat_library {
    use dojo::world::{WorldStorage, WorldStorageTrait};
    use crate::models::config::{TroopDamageConfig, TroopStaminaConfig};
    use crate::models::troop::{CombatContext, Troops, TroopsTrait};

    #[abi(embed_v0)]
    pub impl CombatLibraryImpl of super::ICombatLibrary<ContractState> {
        fn troops_attack(
            self: @ContractState,
            attacker: Troops,
            defender: Troops,
            context: CombatContext,
            troop_stamina_config: TroopStaminaConfig,
            troop_damage_config: TroopDamageConfig,
            current_tick: u64,
            current_tick_interval: u64,
        ) -> (Troops, Troops) {
            let mut attacker_mut = attacker;
            let mut defender_mut = defender;
            attacker_mut
                .attack_with_context(
                    ref defender_mut,
                    context,
                    troop_stamina_config,
                    troop_damage_config,
                    current_tick,
                    current_tick_interval,
                );
            (attacker_mut, defender_mut)
        }
    }

    pub fn get_dispatcher(world: @WorldStorage) -> super::ICombatLibraryLibraryDispatcher {
        let (_, class_hash) = world.dns(@"combat_library_v0_1_12").expect('combat_library not found');
        super::ICombatLibraryLibraryDispatcher { class_hash }
    }
}
