use core::num::traits::Zero;
use crate::math::PercentageImpl;
use crate::rules::TroopStaminaConfig;
use crate::troops::{Stamina, StaminaSource, TroopBoosts, TroopTier, TroopType};
#[generate_trait]
pub impl StaminaImpl of StaminaTrait {
    fn reset(ref self: Stamina) {
        self.amount = 0;
        self.updated_tick = 0;
    }

    fn grant_initial_amount(ref self: Stamina, troop_stamina_config: TroopStaminaConfig, current_tick: u64) {
        self.amount = troop_stamina_config.stamina_initial.into();
        self.updated_tick = current_tick;
    }

    fn revert_initial_amount(ref self: Stamina, troop_stamina_config: TroopStaminaConfig, current_tick: u64) {
        if self.amount > troop_stamina_config.stamina_initial.into() {
            self.grant_initial_amount(troop_stamina_config, current_tick);
        }
    }


    fn refill(
        ref self: Stamina,
        ref troop_boosts: TroopBoosts,
        troop_type: TroopType,
        troop_tier: TroopTier,
        troop_stamina_config: TroopStaminaConfig,
        current_tick: u64,
    ) {
        self
            .refill_to_max(
                ref troop_boosts,
                Self::max(troop_type, troop_tier, troop_stamina_config),
                troop_stamina_config,
                current_tick,
            );
    }

    fn refill_to_max(
        ref self: Stamina,
        ref troop_boosts: TroopBoosts,
        maximum: u64,
        troop_stamina_config: TroopStaminaConfig,
        current_tick: u64,
    ) {
        if (self.updated_tick == current_tick) {
            return;
        }

        if (self.updated_tick.is_zero()) {
            // initialize stamina
            self.grant_initial_amount(troop_stamina_config, current_tick);
        } else {
            // regular stamina gain
            let mut regular_gain_per_tick = troop_stamina_config.stamina_gain_per_tick.into();
            let regular_num_ticks_passed = current_tick - self.updated_tick;
            let regular_stamina_gain = regular_num_ticks_passed * regular_gain_per_tick;

            // additional stamina from boost
            let boost_gain_per_tick = PercentageImpl::get(
                regular_gain_per_tick, troop_boosts.incr_stamina_regen_percent_num.into(),
            );
            let boost_num_ticks_passed = core::cmp::min(
                current_tick - self.updated_tick, troop_boosts.incr_stamina_regen_tick_count.into(),
            );
            let boost_stamina_gain = boost_num_ticks_passed * boost_gain_per_tick.try_into().unwrap();
            let total_stamina_gain = regular_stamina_gain + boost_stamina_gain;

            // reduce boost tick duration
            troop_boosts.incr_stamina_regen_tick_count -= boost_num_ticks_passed.try_into().unwrap();

            // refill stamina
            self.amount = core::cmp::min(self.amount + total_stamina_gain, maximum);
            self.updated_tick = current_tick;
        }
    }

    fn spend(
        ref self: Stamina,
        ref troop_boosts: TroopBoosts,
        troop_type: TroopType,
        troop_tier: TroopTier,
        troop_stamina_config: TroopStaminaConfig,
        amount: u64,
        current_tick: u64,
        throw_error: bool,
    ) {
        // reduce stamina
        self.refill(ref troop_boosts, troop_type, troop_tier, troop_stamina_config, current_tick);
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
        ref troop_boosts: TroopBoosts,
        troop_type: TroopType,
        troop_tier: TroopTier,
        troop_stamina_config: TroopStaminaConfig,
        amount: u64,
        current_tick: u64,
    ) {
        // increase stamina, limited to max of troop type stamina
        self.refill(ref troop_boosts, troop_type, troop_tier, troop_stamina_config, current_tick);
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
    fn set_updated_tick(ref self: StaminaSource, updated_tick: u64) {
        self = StaminaSource::Inline(Stamina { updated_tick, ..self.inline() });
    }
    fn reset(ref self: StaminaSource) {
        let mut bar = self.inline();
        bar.reset();
        self = StaminaSource::Inline(bar);
    }
    fn grant_initial_amount(ref self: StaminaSource, troop_stamina_config: TroopStaminaConfig, current_tick: u64) {
        let mut bar = self.inline();
        bar.grant_initial_amount(troop_stamina_config, current_tick);
        self = StaminaSource::Inline(bar);
    }
    fn revert_initial_amount(ref self: StaminaSource, troop_stamina_config: TroopStaminaConfig, current_tick: u64) {
        let mut bar = self.inline();
        bar.revert_initial_amount(troop_stamina_config, current_tick);
        self = StaminaSource::Inline(bar);
    }
    fn refill(
        ref self: StaminaSource,
        ref troop_boosts: TroopBoosts,
        troop_type: TroopType,
        troop_tier: TroopTier,
        troop_stamina_config: TroopStaminaConfig,
        current_tick: u64,
    ) {
        let mut bar = self.inline();
        bar.refill(ref troop_boosts, troop_type, troop_tier, troop_stamina_config, current_tick);
        self = StaminaSource::Inline(bar);
    }
    fn spend(
        ref self: StaminaSource,
        ref troop_boosts: TroopBoosts,
        troop_type: TroopType,
        troop_tier: TroopTier,
        troop_stamina_config: TroopStaminaConfig,
        amount: u64,
        current_tick: u64,
        throw_error: bool,
    ) {
        let mut bar = self.inline();
        bar.spend(ref troop_boosts, troop_type, troop_tier, troop_stamina_config, amount, current_tick, throw_error);
        self = StaminaSource::Inline(bar);
    }
    fn add(
        ref self: StaminaSource,
        ref troop_boosts: TroopBoosts,
        troop_type: TroopType,
        troop_tier: TroopTier,
        troop_stamina_config: TroopStaminaConfig,
        amount: u64,
        current_tick: u64,
    ) {
        let mut bar = self.inline();
        bar.add(ref troop_boosts, troop_type, troop_tier, troop_stamina_config, amount, current_tick);
        self = StaminaSource::Inline(bar);
    }
}
