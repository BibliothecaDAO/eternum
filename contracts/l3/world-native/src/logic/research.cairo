use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
use crate::research::{RealmKnowledge, ResearchPrice};
use crate::resources::ResourceKey;

pub fn knowledge(key: ResourceKey) -> Option<RealmKnowledge> {
    crate::state::read()
        .buildings
        .knowledge
        .read((key.game_id, key.entity_id))
        .map(|learned| RealmKnowledge { learned })
}

pub fn require(key: ResourceKey) -> RealmKnowledge {
    knowledge(key).expect('missing realm knowledge')
}

// A realm without a board has nothing to research, and nothing it learns changes its buildings or armies.
pub fn learned(key: ResourceKey) -> u64 {
    knowledge(key).map(|value| value.learned).unwrap_or(0)
}

pub fn write(key: ResourceKey, value: RealmKnowledge) {
    crate::state::write().buildings.knowledge.write((key.game_id, key.entity_id), Some(value.learned));
    let event = crate::logic::structures::StructureState::Event::RowSet(
        crate::events::RowSet {
            version: 1,
            model: 'RealmKnowledge',
            keys: array![key.game_id.into(), key.entity_id.into()].span(),
            values: array![value.learned.into()].span(),
        },
    );
    crate::logic::structures::StructureState::emit(event);
}

pub fn price(game_id: u32, row: u8, tier: u8) -> ResearchPrice {
    crate::logic::preset_record::for_game(game_id).research_prices.read((row, tier)).expect('missing research price')
}
