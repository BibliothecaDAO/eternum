use core::num::traits::Zero;
use crate::math::PercentageValueImpl;
use crate::rules::TroopStaminaConfig;
use crate::troops::{Stamina, StaminaSource, TroopBoosts, TroopTier, TroopType};
// The wire clock stays in two fields until the ABI and schema are rebuilt together.
// All packing is confined here; arithmetic uses seconds and a single remainder.
#[derive(Copy, Drop, Debug, PartialEq)]
pub struct SettledStamina {
    pub amount: u64,
    pub settled_at: u32,
    pub remainder: u32,
}
pub impl StaminaClock of starknet::storage_access::StorePacking<SettledStamina, Stamina> {
    fn pack(bar: SettledStamina) -> Stamina {
        Stamina {
            amount: bar.amount,
            updated_tick: bar.settled_at.into() + Into::<u32, u64>::into(bar.remainder) * 0x100000000,
        }
    }
    fn unpack(bar: Stamina) -> SettledStamina {
        SettledStamina {
            amount: bar.amount,
            settled_at: (bar.updated_tick % 0x100000000).try_into().unwrap(),
            remainder: (bar.updated_tick / 0x100000000).try_into().unwrap(),
        }
    }
}

#[generate_trait]
pub impl StaminaImpl of StaminaTrait {
    fn reset(ref self: Stamina) {
        self = StaminaClock::pack(SettledStamina { amount: 0, settled_at: 0, remainder: 0 });
    }

    fn grant_initial_amount(ref self: Stamina, troop_stamina_config: TroopStaminaConfig, timestamp: u64) {
        self.amount = troop_stamina_config.stamina_initial.into();
        self = StaminaClock::pack(
            SettledStamina { amount: self.amount, settled_at: timestamp.try_into().unwrap(), remainder: 0 },
        );
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
        let mut bar = StaminaClock::unpack(self);
        let now: u32 = timestamp.try_into().unwrap();
        // Slot resolution already used the army's Logistics maximum at this second.
        if now == bar.settled_at {
            return;
        }
        if bar.settled_at.is_zero() {
            bar.amount = troop_stamina_config.stamina_initial.into();
            bar.remainder = 0;
        } else {
            let elapsed: u64 = (now - bar.settled_at).into();
            let boosted = core::cmp::min(elapsed, troop_boosts.incr_stamina_regen_tick_count.into());
            let denominator = tick_seconds * PercentageValueImpl::_100();
            let gain: u64 = troop_stamina_config.stamina_gain_per_tick.into();
            // Below the cap, partitioning a time span never changes its gain or remainder,
            // including across boost activation and expiry. The same denominator carries both rates.
            let numerator = Into::<u32, u64>::into(bar.remainder)
                + gain * (elapsed * PercentageValueImpl::_100()
                    + boosted * Into::<u16, u64>::into(troop_boosts.incr_stamina_regen_percent_num));
            bar.amount += numerator / denominator;
            bar.remainder = (numerator % denominator).try_into().unwrap();
            troop_boosts.incr_stamina_regen_tick_count -= boosted.try_into().unwrap();
        }
        bar.amount = core::cmp::min(bar.amount, maximum);
        if bar.amount == maximum {
            bar.remainder = 0;
        }
        bar.settled_at = now;
        self = StaminaClock::pack(bar);
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
        let mut bar = StaminaClock::unpack(self);
        bar.amount = core::cmp::min(bar.amount, maximum);
        if bar.amount == maximum {
            bar.remainder = 0;
        }
        self = StaminaClock::pack(bar);
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
        self = StaminaSource::Inline(
            StaminaClock::pack(
                SettledStamina { amount: self.inline().amount, settled_at: timestamp.try_into().unwrap(), remainder: 0 },
            ),
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
        bar.spend(
            ref troop_boosts, troop_type, troop_tier, troop_stamina_config, amount, tick_seconds, timestamp, throw_error,
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
