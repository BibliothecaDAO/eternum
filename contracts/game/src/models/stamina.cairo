use core::num::traits::zero::Zero;
use s1_eternum::models::config::{TroopStaminaConfig};
use s1_eternum::models::troop::{TroopTier, TroopType};

#[derive(Introspect, Copy, Drop, Serde, Default)]
pub struct Stamina {
    pub amount: u64,
    pub updated_tick: u64,
}

#[generate_trait]
pub impl StaminaImpl of StaminaTrait {
    fn reset(ref self: Stamina, current_tick: u64) {
        self.amount = 0;
        self.updated_tick = 0;
    }

    fn refill(
        ref self: Stamina,
        troop_type: TroopType,
        troop_tier: TroopTier,
        troop_stamina_config: TroopStaminaConfig,
        current_tick: u64,
    ) {
        if (self.updated_tick == current_tick) {
            return;
        }

        if (self.updated_tick.is_zero()) {
            // initialize stamina
            self.amount = troop_stamina_config.stamina_initial.into();
            self.updated_tick = current_tick;
        } else {
            // refill stamina
            let num_ticks_passed: u64 = current_tick - self.updated_tick;
            let additional_stamina: u64 = num_ticks_passed * troop_stamina_config.stamina_gain_per_tick.into();
            self
                .amount =
                    core::cmp::min(
                        self.amount + additional_stamina, Self::max(troop_type, troop_tier, troop_stamina_config),
                    );
            self.updated_tick = current_tick;
        }
    }

    fn spend(
        ref self: Stamina,
        troop_type: TroopType,
        troop_tier: TroopTier,
        troop_stamina_config: TroopStaminaConfig,
        amount: u64,
        current_tick: u64,
        throw_error: bool,
    ) {
        // reduce stamina
        self.refill(troop_type, troop_tier, troop_stamina_config, current_tick);
        if amount > self.amount {
            if throw_error {
                panic!("insufficient stamina, you need: {}, and have: {}", amount, self.amount);
            } else {
                self.amount = 0;
            }
        } else {
            self.amount -= amount;
        }
    }

    fn add(
        ref self: Stamina,
        troop_type: TroopType,
        troop_tier: TroopTier,
        troop_stamina_config: TroopStaminaConfig,
        amount: u64,
        current_tick: u64,
    ) {
        // increase stamina, limited to max of troop type stamina
        self.refill(troop_type, troop_tier, troop_stamina_config, current_tick);
        self.amount = core::cmp::min(self.amount + amount, Self::max(troop_type, troop_tier, troop_stamina_config));
    }


    fn max(troop_type: TroopType, troop_tier: TroopTier, troop_stamina_config: TroopStaminaConfig) -> u64 {
        let initial_max = match troop_type {
            TroopType::Knight => troop_stamina_config.stamina_knight_max.into(),
            TroopType::Paladin => troop_stamina_config.stamina_paladin_max.into(),
            TroopType::Crossbowman => troop_stamina_config.stamina_crossbowman_max.into(),
        };

        match troop_tier {
            TroopTier::T1 => initial_max,
            TroopTier::T2 => initial_max + 20,
            TroopTier::T3 => initial_max + 40,
        }
    }
}
