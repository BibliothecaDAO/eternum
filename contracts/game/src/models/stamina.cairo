use s1_eternum::alias::ID;
use s1_eternum::models::config::{CombatConfig};
use s1_eternum::models::troop::TroopType;

#[derive(IntrospectPacked, Copy, Drop, Serde)]
pub struct Stamina {
    amount: u64,
    updated_tick: u64,
}

#[generate_trait]
impl StaminaImpl of StaminaTrait {


    #[inline(always)]
    fn reset(ref self: Stamina, current_tick: u64) {
        self.amount = 0;
        self.updated_tick = current_tick;
    }

    #[inline(always)]
    fn refill(ref self: Stamina, troop_type: TroopType, config: CombatConfig, current_tick: u64) {
        if (self.updated_tick == current_tick) {return;}

        if (self.updated_tick.is_zero()) {
            // initialize stamina
            self.amount = config.stamina_initial;
            self.updated_tick = current_tick;
        } else {
            // refill stamina
            let num_ticks_passed: u64 = current_tick - self.updated_tick;
            let additional_stamina: u64 = num_ticks_passed * config.stamina_gain_per_tick.into();
            self.amount = core::cmp::min(self.amount + additional_stamina, Self::max(troop_type, config));
            self.updated_tick = current_tick;
        }
    }

    #[inline(always)]
    fn spend(ref self: Stamina, troop_type: TroopType, config: CombatConfig, amount: u64, current_tick: u64) {
        self.refill(troop_type, config, current_tick);
        self.amount -= amount;
    }

    #[inline(always)]
    fn max(troop_type: TroopType, config: CombatConfig) -> u64 {
        match troop_type {
            TroopType::Knight => config.stamina_knight_max.into(),
            TroopType::Paladin => config.stamina_paladin_max.into(),
            TroopType::Crossbowman => config.stamina_crossbowman_max.into(),
        }
    }
}
