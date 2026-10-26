pub use crate::rules::TroopStaminaConfig;
pub use crate::stamina::{StaminaSourceTrait, StaminaTrait};
pub use crate::troops::{Stamina, TroopBoosts};
pub fn rules(gain: u16) -> TroopStaminaConfig {
    TroopStaminaConfig {
        stamina_gain_per_tick: gain, stamina_initial: 35, ..super::play_fixture::rules().troop_stamina_config,
    }
}
pub fn bar(amount: u64) -> Stamina {
    Stamina { amount, settled_at: 101, remainder: 0 }
}
