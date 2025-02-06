use alexandria_data_structures::array_ext::ArrayTraitExt;
use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use s1_eternum::alias::ID;
use s1_eternum::{
    models::{combat::Army, config::{StaminaConfig, StaminaRefillConfig, TickConfig, TickImpl}},
    constants::{ResourceTypes, TravelTypes, WORLD_CONFIG_ID}
};

#[derive(IntrospectPacked, Copy, Drop, Serde)]
pub struct Stamina {
    amount: u64,
    updated_tick: u64,
}

#[generate_trait]
impl StaminaImpl of StaminaTrait {

    #[inline(always)]
    fn refill(ref self: Stamina, ref world: WorldStorage, troop_type: TroopType, config: CombatConfig, current_tick: u64) {
        self._refill(ref world, troop_type, config, current_tick);
    }

    #[inline(always)]
    fn spend(ref self: Stamina, amount: u64, ref world: WorldStorage, current_tick: u64) {
        self._refill(ref world, current_tick);
        self.amount -= amount;
        world.write_model(@self);
    }

    #[inline(always)]
    fn drain(ref self: Stamina, ref world: WorldStorage, current_tick: u64) {
        self.spend(self.amount, ref world, current_tick);
    }


    #[inline(always)]
    fn _refill(ref self: Stamina, ref world: WorldStorage, troop_type: TroopType, config: CombatConfig, current_tick: u64) {
        if (self.updated_tick == current_tick) {return;}

        let num_ticks_passed: u64 = current_tick - self.updated_tick;
        let additional_stamina: u64 = num_ticks_passed * config.stamina_gain_per_tick.into();
        self.amount = core::cmp::min(self.amount + additional_stamina, self.max(troop_type, config));
        self.updated_tick = current_tick;
        world.write_model(@self);
    }

    #[inline(always)]
    fn _max(troop_type: TroopType, config: CombatConfig) -> u64 {
        match troop_type {
            TroopType::Knight => config.stamina_max_for_knight.into(),
            TroopType::Paladin => config.stamina_max_for_paladin.into(),
            TroopType::Crossbowman => config.stamina_max_for_crossbowman.into(),
        }
    }
}
