use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess};
use crate::progression::{ArmyProgress, ArmyProgressionRules, XpAward};
use crate::troops::ExplorerKey;

pub fn rules(game_id: u32) -> Option<ArmyProgressionRules> {
    crate::logic::preset_record::for_game(game_id).progression_rules.read()
}

#[inline(never)]
pub fn read(key: ExplorerKey) -> Option<ArmyProgress> {
    let progress = crate::state::read().troops.progress.read((key.game_id, key.explorer_id));
    if progress.battle == 0 {
        None
    } else {
        Some(progress)
    }
}

#[inline(never)]
pub fn require(key: ExplorerKey) -> ArmyProgress {
    read(key).expect('missing army progress')
}

pub fn create(key: ExplorerKey, learned: u64) -> ArmyProgress {
    assert!(read(key).is_none(), "army progress already exists");
    rules(key.game_id).expect('missing progression rules');
    let progress = crate::progression::trained(learned);
    write(key, progress);
    progress
}

#[inline(never)]
pub fn write(key: ExplorerKey, progress: ArmyProgress) {
    crate::state::write().troops.progress.write((key.game_id, key.explorer_id), progress);
    let mut keys = array![];
    key.serialize(ref keys);
    let mut values = array![];
    progress.serialize(ref values);
    crate::logic::troops::TroopState::emit(
        crate::logic::troops::TroopState::Event::RowSet(
            crate::events::RowSet { version: 1, model: 'ArmyProgress', keys: keys.span(), values: values.span() },
        ),
    );
}

pub fn destroy(key: ExplorerKey) {
    require(key);
    crate::state::write()
        .troops
        .progress
        .write(
            (key.game_id, key.explorer_id),
            ArmyProgress { xp: 0, battle: 0, logistics: 0, scouting: 0, scouting_kinds: 0, homecoming: 0 },
        );
    let mut keys = array![];
    key.serialize(ref keys);
    crate::logic::troops::TroopState::emit(
        crate::logic::troops::TroopState::Event::RowDeleted(
            crate::events::RowDeleted { version: 1, model: 'ArmyProgress', keys: keys.span() },
        ),
    );
}

/// An army's own maximum stamina: its Logistics tier's for an expedition army, its troop's for any other.
pub fn own_stamina_max(
    key: ExplorerKey, troops: crate::troops::Troops, rules: crate::rules::TroopStaminaConfig,
) -> u64 {
    match read(key) {
        Some(progress) => crate::progression::stamina_max(progress, troops.category, rules),
        None => crate::stamina::StaminaImpl::max(troops.category, troops.tier, rules),
    }
}

pub fn award_xp(key: ExplorerKey, award: XpAward) {
    let rules = rules(key.game_id).expect('missing progression rules');
    let mut progress = require(key);
    progress.xp += match award {
        XpAward::Reveal => rules.reveal_xp,
        XpAward::Clear(strength) => crate::progression::clear_xp(strength),
    };
    write(key, progress);
}

/// A shrine's XP, and until relics leave chests a relic chest's: a fixed amount, whatever its quality.
pub fn grant_fixed_xp(key: ExplorerKey) {
    let mut progress = require(key);
    progress.xp += rules(key.game_id).expect('missing progression rules').fixed_xp;
    write(key, progress);
}
