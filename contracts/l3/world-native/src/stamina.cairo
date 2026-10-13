use core::num::traits::Zero;
use crate::math::PercentageValueImpl;
use crate::rules::TroopStaminaConfig;
use crate::troops::{Stamina, StaminaSource, TroopBoosts, TroopTier, TroopType};
#[generate_trait]
pub impl StaminaImpl of StaminaTrait {
    fn reset(ref self: Stamina) {
        self = Stamina { amount: 0, settled_at: 0, remainder: 0 };
    }

    fn grant_initial_amount(ref self: Stamina, troop_stamina_config: TroopStaminaConfig, timestamp: u64) {
        self.amount = troop_stamina_config.stamina_initial.into();
        self = Stamina { amount: self.amount, settled_at: timestamp.try_into().unwrap(), remainder: 0 };
    }

    fn revert_initial_amount(ref self: Stamina, troop_stamina_config: TroopStaminaConfig, timestamp: u64) {
        if self.amount > troop_stamina_config.stamina_initial.into() {
            self.grant_initial_amount(troop_stamina_config, timestamp);
        }
    }

    fn refill(
        ref self: Stamina,
        ref troop_boosts: TroopBoosts,
        troop_type: TroopType,
        troop_tier: TroopTier,
        troop_stamina_config: TroopStaminaConfig,
        tick_seconds: u64,
        timestamp: u64,
    ) {
        self
            .refill_to_max(
                ref troop_boosts,
                Self::max(troop_type, troop_tier, troop_stamina_config),
                troop_stamina_config,
                tick_seconds,
                timestamp,
            );
    }

    fn refill_to_max(
        ref self: Stamina,
        ref troop_boosts: TroopBoosts,
        maximum: u64,
        troop_stamina_config: TroopStaminaConfig,
        tick_seconds: u64,
        timestamp: u64,
    ) {
        let now: u32 = timestamp.try_into().unwrap();
        // Slot resolution already used the army's Logistics maximum at this second.
        if now == self.settled_at {
            return;
        }
        if self.settled_at.is_zero() {
            self.amount = troop_stamina_config.stamina_initial.into();
            self.remainder = 0;
        } else {
            let elapsed: u64 = (now - self.settled_at).into();
            let boosted = core::cmp::min(elapsed, troop_boosts.incr_stamina_regen_seconds_left.into());
            let denominator = tick_seconds * PercentageValueImpl::_100();
            let gain: u64 = troop_stamina_config.stamina_gain_per_tick.into();
            // Below the cap, partitioning a time span never changes its gain or remainder,
            // including across boost activation and expiry. The same denominator carries both rates.
            let numerator = Into::<u32, u64>::into(self.remainder)
                + gain
                    * (elapsed * PercentageValueImpl::_100()
                        + boosted * Into::<u16, u64>::into(troop_boosts.incr_stamina_regen_percent_num));
            self.amount += numerator / denominator;
            self.remainder = (numerator % denominator).try_into().unwrap();
            troop_boosts.incr_stamina_regen_seconds_left -= boosted.try_into().unwrap();
        }
        self.amount = core::cmp::min(self.amount, maximum);
        if self.amount == maximum {
            self.remainder = 0;
        }
        self.settled_at = now;
    }

    fn spend(
        ref self: Stamina,
        ref troop_boosts: TroopBoosts,
        troop_type: TroopType,
        troop_tier: TroopTier,
        troop_stamina_config: TroopStaminaConfig,
        amount: u64,
        tick_seconds: u64,
        timestamp: u64,
        throw_error: bool,
    ) {
        // reduce stamina
        self.refill(ref troop_boosts, troop_type, troop_tier, troop_stamina_config, tick_seconds, timestamp);
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

    /// Adds stamina up to `maximum`, the army's own: nothing fills past it.
    fn add(
        ref self: Stamina,
        ref troop_boosts: TroopBoosts,
        maximum: u64,
        troop_stamina_config: TroopStaminaConfig,
        amount: u64,
        tick_seconds: u64,
        timestamp: u64,
    ) {
        self.refill_to_max(ref troop_boosts, maximum, troop_stamina_config, tick_seconds, timestamp);
        self.amount = core::cmp::min(self.amount + amount, maximum);
        self.clamp(maximum);
    }

    /// Cap refills and inherited bars without retaining credit above their maximum.
    fn clamp(ref self: Stamina, maximum: u64) {
        self.amount = core::cmp::min(self.amount, maximum);
        if self.amount == maximum {
            self.remainder = 0;
        }
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

#[generate_trait]
pub impl StaminaSourceImpl of StaminaSourceTrait {
    fn inline(self: StaminaSource) -> Stamina {
        match self {
            StaminaSource::Inline(bar) => bar,
            StaminaSource::Slot(_) => panic!("resolve army slot before arithmetic"),
        }
    }
    fn set_amount(ref self: StaminaSource, amount: u64) {
        self = StaminaSource::Inline(Stamina { amount, ..self.inline() });
    }
    fn set_settled_at(ref self: StaminaSource, timestamp: u64) {
        self =
            StaminaSource::Inline(
                Stamina { amount: self.inline().amount, settled_at: timestamp.try_into().unwrap(), remainder: 0 },
            );
    }
    fn reset(ref self: StaminaSource) {
        let mut bar = self.inline();
        bar.reset();
        self = StaminaSource::Inline(bar);
    }
    fn grant_initial_amount(ref self: StaminaSource, troop_stamina_config: TroopStaminaConfig, timestamp: u64) {
        let mut bar = self.inline();
        bar.grant_initial_amount(troop_stamina_config, timestamp);
        self = StaminaSource::Inline(bar);
    }
    fn revert_initial_amount(ref self: StaminaSource, troop_stamina_config: TroopStaminaConfig, timestamp: u64) {
        let mut bar = self.inline();
        bar.revert_initial_amount(troop_stamina_config, timestamp);
        self = StaminaSource::Inline(bar);
    }
    fn refill(
        ref self: StaminaSource,
        ref troop_boosts: TroopBoosts,
        troop_type: TroopType,
        troop_tier: TroopTier,
        troop_stamina_config: TroopStaminaConfig,
        tick_seconds: u64,
        timestamp: u64,
    ) {
        let mut bar = self.inline();
        bar.refill(ref troop_boosts, troop_type, troop_tier, troop_stamina_config, tick_seconds, timestamp);
        self = StaminaSource::Inline(bar);
    }
    fn spend(
        ref self: StaminaSource,
        ref troop_boosts: TroopBoosts,
        troop_type: TroopType,
        troop_tier: TroopTier,
        troop_stamina_config: TroopStaminaConfig,
        amount: u64,
        tick_seconds: u64,
        timestamp: u64,
        throw_error: bool,
    ) {
        let mut bar = self.inline();
        bar
            .spend(
                ref troop_boosts,
                troop_type,
                troop_tier,
                troop_stamina_config,
                amount,
                tick_seconds,
                timestamp,
                throw_error,
            );
        self = StaminaSource::Inline(bar);
    }
    fn add(
        ref self: StaminaSource,
        ref troop_boosts: TroopBoosts,
        maximum: u64,
        troop_stamina_config: TroopStaminaConfig,
        amount: u64,
        tick_seconds: u64,
        timestamp: u64,
    ) {
        let mut bar = self.inline();
        bar.add(ref troop_boosts, maximum, troop_stamina_config, amount, tick_seconds, timestamp);
        self = StaminaSource::Inline(bar);
    }
}
