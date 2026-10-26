pub use crate::progression::ArmyProgress;
pub use crate::rules::RESOURCE_PRECISION;
pub use crate::tests::state::{GameState, TroopObservationTrait};
pub use crate::troops::{ArmySlotKey, ExplorerKey, StaminaSource};
pub use super::registrar::{day_start, expedition_armies, expedition_home, setup, transfer};
pub use super::resource_commands::execute_in_game;
pub fn progress(d: super::Deployment, key: ExplorerKey) -> Option<ArmyProgress> {
    snforge_std::interact_with_state(d.games, || crate::logic::progression::read(key))
}
pub fn write_progress(d: super::Deployment, key: ExplorerKey, value: ArmyProgress) {
    snforge_std::interact_with_state(d.games, || crate::logic::progression::write(key, value));
}
pub fn slot(d: super::Deployment, key: ExplorerKey, index: u8) -> crate::troops::ArmySlot {
    slot_at_home(d, key, 1, index)
}
pub fn slot_at_home(d: super::Deployment, key: ExplorerKey, home: u64, index: u8) -> crate::troops::ArmySlot {
    snforge_std::interact_with_state(
        d.games,
        || crate::logic::army_slot_storage::read(
            ArmySlotKey { game_id: key.game_id, structure_id: home, epoch: 0, slot: index },
        )
            .unwrap(),
    )
}
pub fn timers(d: super::Deployment, key: ExplorerKey, amount: u64, cooldown: u32) {
    let mut army = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
    army.troops.stamina = crate::troops::Stamina { amount, settled_at: 360, remainder: 0 }.into();
    army.troops.battle_cooldown_end = cooldown;
    super::resource_commands::set_explorer_fixture(d.games, key, army);
}
