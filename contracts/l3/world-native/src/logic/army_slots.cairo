use starknet::storage::{StorageMapReadAccess, StoragePathEntry, StoragePointerReadAccess};
use crate::stamina::StaminaSourceTrait;
use crate::troops::{
    ArmySlotAction, ArmySlotAllocation, ExplorerKey, ExplorerRecord, ExplorerTroops, IArmySlotStaminaDispatcherTrait,
    IArmySlotStaminaLibraryDispatcher, ResolvedArmySlot, StaminaRefill, StaminaSource, Troops,
};

fn dispatch(key: ExplorerKey, action: ArmySlotAction) -> ResolvedArmySlot {
    let state = crate::state::read();
    let release = state.game_releases.read(key.game_id);
    assert!(release != 0, "game has no release");
    IArmySlotStaminaLibraryDispatcher { class_hash: state.releases.entry(release).classes.relics.read() }
        .army_slot_stamina(key, action)
}

pub fn resolve(key: ExplorerKey, mut explorer: ExplorerTroops, refill: Option<StaminaRefill>) -> ExplorerTroops {
    if let StaminaSource::Slot(_) = explorer.troops.stamina {
        let slot = dispatch(key, ArmySlotAction::Resolve(refill));
        explorer.troops.stamina = slot.stamina;
        explorer.troops.boosts.incr_damage_dealt_percent_num = slot.battle_bonus_percent;
        explorer.troops.boosts.incr_damage_dealt_end_at = 0;
    }
    explorer
}

pub fn allocate(key: ExplorerKey, allocation: ArmySlotAllocation) -> StaminaSource {
    dispatch(key, ArmySlotAction::Allocate(allocation)).stamina
}

pub fn persist(key: ExplorerKey, previous: ExplorerRecord, mut troops: Troops) -> Troops {
    if let StaminaSource::Slot(_) = previous.troops.stamina {
        troops.stamina = dispatch(key, ArmySlotAction::Persist(troops.stamina)).stamina;
        troops.boosts = Default::default();
    } else {
        troops.stamina.inline();
    }
    troops
}

pub fn release(key: ExplorerKey, explorer: ExplorerTroops) {
    dispatch(key, ArmySlotAction::Release(explorer.troops.stamina));
}

