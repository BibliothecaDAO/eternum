use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess};
use crate::progression::{ArmyProgress, ArmyProgressionRules, XpAward};
use crate::troops::ExplorerKey;

pub fn rules(game_id: u32) -> Option<ArmyProgressionRules> {
    crate::logic::preset_record::for_game(game_id).progression_rules.read()
}

#[inline(never)]
pub fn read(key: ExplorerKey) -> Option<ArmyProgress> {
    crate::state::read().troops.progress.read((key.game_id, key.explorer_id))
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
    crate::state::write().troops.progress.write((key.game_id, key.explorer_id), Some(progress));
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
    crate::state::write().troops.progress.write((key.game_id, key.explorer_id), None);
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
    let amount = match award {
        XpAward::Reveal(coord) => {
            let depth: u32 = crate::logic::expeditions::depth_at(key.game_id, coord).into();
            rules.reveal_xp + depth * rules.reveal_xp_per_depth
        },
        XpAward::Clear(amount) => amount,
    };
    let before = progress;
    crate::progression::earn_xp(ref progress, rules, amount);
    let mut earned = 0_u32;
    for rank in 1_u8..6 {
        earned += crate::progression::points(progress, rank) - crate::progression::points(before, rank);
    }
    record_earned_points(key, earned);
    write(key, progress);
}

pub fn grant_point(key: ExplorerKey, rank: u8) {
    let mut progress = require(key);
    crate::progression::earn_point(ref progress, rank);
    record_earned_points(key, 1);
    write(key, progress);
}

fn record_earned_points(key: ExplorerKey, earned: u32) {
    if earned == 0 || !crate::logic::quests::enabled(key.game_id) {
        return;
    }
    let explorer = crate::logic::troops::explorer(key).expect('missing progressing army');
    crate::logic::quests::record(
        crate::resources::ResourceKey { game_id: key.game_id, entity_id: explorer.owner },
        crate::quests::VETERANS,
        earned.into(),
        starknet::get_block_timestamp(),
    );
}
