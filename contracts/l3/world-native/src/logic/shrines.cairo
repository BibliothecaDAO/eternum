use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
use crate::relics::ShrineReward;
use crate::resources::ResourceKey;
use crate::troops::ExplorerKey;

pub fn read(key: ResourceKey) -> Option<ShrineReward> {
    crate::state::read().structures.shrine_rewards.read((key.game_id, key.entity_id)).map(|rank| ShrineReward { rank })
}

pub fn discover(key: ResourceKey, depth: u8, seed: u256) {
    assert!(read(key).is_none(), "shrine reward already stored");
    let draw = crate::random::range(seed, 'shrine point', 10000).try_into().unwrap();
    let reward = ShrineReward { rank: crate::progression::shrine_point(depth, draw) };
    crate::state::write().structures.shrine_rewards.write((key.game_id, key.entity_id), Some(reward.rank));
    let mut keys = array![];
    let mut values = array![];
    key.serialize(ref keys);
    reward.serialize(ref values);
    crate::logic::map::MapState::emit(
        crate::logic::map::MapState::Event::RowSet(
            crate::events::RowSet { version: 1, model: 'ShrineReward', keys: keys.span(), values: values.span() },
        ),
    );
}

pub fn claim(key: ResourceKey, explorer: ExplorerKey) -> u8 {
    let reward = read(key).expect('missing shrine reward');
    crate::logic::progression::grant_point(explorer, reward.rank);
    crate::state::write().structures.shrine_rewards.write((key.game_id, key.entity_id), None);
    let mut keys = array![];
    key.serialize(ref keys);
    crate::logic::map::MapState::emit(
        crate::logic::map::MapState::Event::RowDeleted(
            crate::events::RowDeleted { version: 1, model: 'ShrineReward', keys: keys.span() },
        ),
    );
    reward.rank
}
