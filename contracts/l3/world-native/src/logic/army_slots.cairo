use starknet::storage::{StorageMapReadAccess, StoragePathEntry, StoragePointerReadAccess};
use crate::stamina::StaminaSourceTrait;
use crate::troops::{
    ArmySlotAction, ArmySlotAllocation, ExplorerKey, ExplorerRecord, ExplorerTroops, IArmySlotStaminaDispatcherTrait,
    IArmySlotStaminaLibraryDispatcher, Stamina, StaminaSource, Troops,
};

fn dispatch(key: ExplorerKey, action: ArmySlotAction) -> StaminaSource {
    let state = crate::state::read();
    let release = state.game_releases.read(key.game_id);
    assert!(release != 0, "game has no release");
    IArmySlotStaminaLibraryDispatcher { class_hash: state.releases.entry(release).classes.relics.read() }
        .army_slot_stamina(key, action)
}

pub fn resolve(key: ExplorerKey, mut explorer: ExplorerTroops) -> ExplorerTroops {
    if let StaminaSource::Slot(_) = explorer.troops.stamina {
        explorer.troops.stamina = dispatch(key, ArmySlotAction::Resolve);
    }
    explorer
}

pub fn allocate(key: ExplorerKey, home: u32, epoch: u64, allowance: u8, initial: Stamina) -> StaminaSource {
    dispatch(key, ArmySlotAction::Allocate(ArmySlotAllocation { home, epoch, allowance, initial }))
}

pub fn persist(key: ExplorerKey, previous: ExplorerRecord, mut troops: Troops) -> Troops {
    if let StaminaSource::Slot(_) = previous.troops.stamina {
        troops.stamina = dispatch(key, ArmySlotAction::Persist(troops.stamina));
    } else {
        troops.stamina.inline();
    }
    troops
}

pub fn release(key: ExplorerKey, explorer: ExplorerTroops) {
    dispatch(key, ArmySlotAction::Release(explorer.troops.stamina));
}
