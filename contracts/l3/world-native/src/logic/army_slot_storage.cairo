use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
use crate::events::RowSet;
use crate::stamina::{StaminaSourceTrait, StaminaTrait};
use crate::troops::{
    ArmySlot, ArmySlotKey, ArmySlotRecord, Coord, ExplorerKey, ExplorerRecord, ExplorerRecordTrait, ExplorerTroops,
    Stamina, StaminaSource, Troops,
};

pub fn read(key: ArmySlotKey) -> Option<ArmySlot> {
    let record = crate::state::read().troops.slots.read((key.game_id, key.structure_id, key.epoch, key.slot));
    if record.initialized {
        Some(record.value)
    } else {
        None
    }
}

fn write(key: ArmySlotKey, value: ArmySlot) {
    crate::state::write()
        .troops
        .slots
        .write((key.game_id, key.structure_id, key.epoch, key.slot), ArmySlotRecord { initialized: true, value });
    let mut keys = array![];
    key.serialize(ref keys);
    let mut values = array![];
    value.serialize(ref values);
    crate::logic::troops::TroopState::emit(
        crate::logic::troops::TroopState::Event::RowSet(
            RowSet { version: 1, model: 'ArmySlot', keys: keys.span(), values: values.span() },
        ),
    );
}

fn key_for(key: ExplorerKey, home: u32, coord: Coord, slot: u8) -> ArmySlotKey {
    let game = crate::logic::game::game(key.game_id);
    let seconds = crate::logic::game::rules(key.game_id).epoch_seconds;
    assert!(seconds != 0 && !coord.alt, "slot outside expedition");
    let spacing = crate::logic::settlement::rules(key.game_id).spacing;
    let epoch = crate::expeditions::absolute_epoch(seconds, game.start_main_at)
        + Into::<u32, u64>::into(coord.y / spacing / 4);
    ArmySlotKey { game_id: key.game_id, structure_id: home, epoch, slot }
}

fn occupied(key: ArmySlotKey, explorer_id: u32) -> ArmySlot {
    let slot = read(key).expect('missing army slot');
    assert!(slot.explorer_id == explorer_id, "army slot occupant mismatch");
    slot
}

// Command arithmetic gets a transient bar; only persist writes it back, preserving the stored Slot tag.
pub fn resolve(key: ExplorerKey, mut explorer: ExplorerTroops, timestamp: Option<u64>) -> ExplorerTroops {
    if let StaminaSource::Slot(slot) = explorer.troops.stamina {
        let slot_key = key_for(key, explorer.owner, explorer.coord, slot);
        let mut stamina = occupied(slot_key, key.explorer_id).stamina;
        if let Some(timestamp) = timestamp {
            let progress = crate::logic::progression::require(key);
            let rules = crate::logic::game::rules(key.game_id);
            let maximum = crate::progression::stamina_max(
                progress, explorer.troops.category, rules.troop_stamina_config,
            );
            stamina
                .refill_to_max(
                    ref explorer.troops.boosts,
                    maximum,
                    rules.troop_stamina_config,
                    timestamp / rules.tick_config.armies_tick_in_seconds,
                );
            stamina.amount = core::cmp::min(stamina.amount, maximum);
        }
        explorer.troops.stamina = StaminaSource::Inline(stamina);
    }
    explorer
}

pub fn allocate(
    key: ExplorerKey, home: u32, epoch: u64, allowance: u8, initial: Stamina, maximum: u64,
) -> StaminaSource {
    for slot in 0..allowance {
        let slot_key = ArmySlotKey { game_id: key.game_id, structure_id: home, epoch, slot };
        let value = read(slot_key);
        if value.is_none() || value.unwrap().explorer_id == 0 {
            let stamina = match value {
                Some(value) => Stamina { amount: core::cmp::min(value.stamina.amount, maximum), ..value.stamina },
                None => initial,
            };
            write(slot_key, ArmySlot { explorer_id: key.explorer_id, stamina });
            return StaminaSource::Slot(slot);
        }
    }
    panic!("explorer limit reached")
}

pub fn persist(key: ExplorerKey, previous: ExplorerRecord, mut troops: Troops) -> Troops {
    if let StaminaSource::Slot(slot) = previous.troops.stamina {
        let coord = crate::logic::map::entity_coord(
            crate::resources::ResourceKey { game_id: key.game_id, entity_id: key.explorer_id },
        )
            .expect('missing explorer position');
        let slot_key = key_for(key, previous.owner, coord, slot);
        let mut value = occupied(slot_key, key.explorer_id);
        match troops.stamina {
            StaminaSource::Inline(stamina) => {
                value.stamina = stamina;
                write(slot_key, value);
            },
            StaminaSource::Slot(current) => assert!(current == slot, "army slot cannot change"),
        }
        troops.stamina = StaminaSource::Slot(slot);
    } else {
        troops.stamina.inline();
    }
    troops
}

pub fn release(key: ExplorerKey, explorer: ExplorerTroops) {
    let previous = crate::state::read().troops.explorers.read((key.game_id, key.explorer_id));
    if let StaminaSource::Slot(slot) = previous.troops.stamina {
        let slot_key = key_for(key, previous.owner, explorer.coord, slot);
        let mut value = occupied(slot_key, key.explorer_id);
        if let StaminaSource::Inline(stamina) = explorer.troops.stamina {
            value.stamina = stamina;
        }
        value.explorer_id = 0;
        write(slot_key, value);
    }
}

pub fn grant_logistics(
    key: ExplorerKey, mut explorer: ExplorerTroops, award: crate::troops::LogisticsStamina,
) -> StaminaSource {
    let previous = explorer.into_record();
    let mut stamina = award.stamina.inline();
    stamina.amount += Into::<u8, u64>::into(award.levels) * crate::rules::ATTRIBUTE_STAMINA.into();
    explorer.troops.stamina = StaminaSource::Inline(stamina);
    persist(key, previous, explorer.troops).stamina
}
