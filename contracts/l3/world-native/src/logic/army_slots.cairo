use starknet::storage::{StorageMapReadAccess, StoragePathEntry, StoragePointerReadAccess};
use crate::stamina::StaminaSourceTrait;
use crate::troops::{
    ArmySlotAction, ArmySlotAllocation, ExplorerKey, ExplorerRecord, ExplorerTroops, IArmySlotStaminaDispatcherTrait,
    IArmySlotStaminaLibraryDispatcher, ResolvedArmySlot, Stamina, StaminaSource, Troops,
};

fn dispatch(key: ExplorerKey, action: ArmySlotAction) -> ResolvedArmySlot {
    let state = crate::state::read();
    let release = state.game_releases.read(key.game_id);
    assert!(release != 0, "game has no release");
    IArmySlotStaminaLibraryDispatcher { class_hash: state.releases.entry(release).classes.relics.read() }
        .army_slot_stamina(key, action)
}

pub fn resolve(key: ExplorerKey, mut explorer: ExplorerTroops, timestamp: Option<u64>) -> ExplorerTroops {
    if let StaminaSource::Slot(_) = explorer.troops.stamina {
        let slot = dispatch(key, ArmySlotAction::Resolve(timestamp));
        explorer.troops.stamina = slot.stamina;
        explorer.troops.boosts.incr_damage_dealt_percent_num = slot.battle_bonus_percent;
        explorer.troops.boosts.incr_damage_dealt_end_tick = 0;
    }
    explorer
}

pub fn allocate(
    key: ExplorerKey, home: u32, epoch: u64, allowance: u8, initial: Stamina, maximum: u64,
) -> StaminaSource {
    dispatch(key, ArmySlotAction::Allocate(ArmySlotAllocation { home, epoch, allowance, initial, maximum })).stamina
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

pub fn grant_logistics(key: ExplorerKey, stamina: StaminaSource, levels: u8) {
    dispatch(key, ArmySlotAction::GrantLogistics(crate::troops::LogisticsStamina { stamina, levels }));
}
