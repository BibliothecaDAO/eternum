use starknet::storage::{StorageMapReadAccess, StoragePathEntry, StoragePointerReadAccess};
use crate::quests::IQuestProgressDispatcherTrait;
use crate::resources::ResourceKey;

pub fn record(home: ResourceKey, kind: u8, amount: u128, timestamp: u64) {
    if amount == 0 {
        return;
    }
    let state = crate::state::read();
    let release = state.game_releases.read(home.game_id);
    assert!(release != 0, "game has no release");
    crate::quests::IQuestProgressLibraryDispatcher { class_hash: state.releases.entry(release).classes.bridge.read() }
        .record_quest_progress(home, kind, amount, timestamp);
}

pub fn revealed(home: ResourceKey, count: u128, timestamp: u64) {
    record(home, crate::quests::REVEALS, count, timestamp);
    record(home, crate::quests::LIGHTS, count, timestamp);
}

pub fn discovered(home: ResourceKey, result: crate::discovery::Discovery, timestamp: u64) {
    if result == crate::discovery::Discovery::None {
        return;
    }
    record(home, crate::quests::FINDS, 1, timestamp);
    if let crate::discovery::Discovery::Ruin(_) = result {
        record(home, crate::quests::RELICS, 1, timestamp);
    }
}

pub fn guarded_site_cleared(home: ResourceKey, guard_count: u128, timestamp: u64) {
    record(home, crate::quests::STAND, 1, timestamp);
    record(home, crate::quests::CULL, guard_count / crate::rules::RESOURCE_PRECISION, timestamp);
}

pub fn cleared(home: ResourceKey, category: u8, guard_count: u128, timestamp: u64) {
    guarded_site_cleared(home, guard_count, timestamp);
    let quest = if category == crate::taxonomy::BEASTS_CATEGORY {
        Some(crate::quests::HUNT)
    } else if category == crate::taxonomy::CAMP_CATEGORY {
        Some(crate::quests::CAMPS)
    } else if category == crate::taxonomy::RIFT_CATEGORY {
        Some(crate::quests::RIFTS)
    } else {
        None
    };
    if let Some(kind) = quest {
        record(home, kind, 1, timestamp);
    }
}
