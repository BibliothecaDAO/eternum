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

#[cfg(feature: "blitz")]
pub fn ration_discount(_key: ResourceKey, _per_troops: u128) -> u128 {
    0
}

#[cfg(not(feature: "blitz"))]
#[inline(always)]
pub fn ration_discount(key: ResourceKey, per_troops: u128) -> u128 {
    let rations: u128 = crate::research::tier(learned(key), crate::research::ROW_RATIONS).into();
    crate::logic::buildings::board().ration_step * rations * per_troops
}

#[cfg(feature: "blitz")]
pub fn price(row: u8, tier: u8) -> ResearchPrice {
    panic!("Blitz has no research")
}

#[cfg(not(feature: "blitz"))]
pub fn price(row: u8, tier: u8) -> ResearchPrice {
    assert!(tier > 0 && tier <= crate::research::max_tier(row), "invalid research tier");
    let mut first = 0_u32;
    for earlier in crate::research::ROWS.span() {
        if *earlier < row {
            first += crate::research::max_tier(*earlier).into();
        }
    }
    let prices = crate::balance::structures::RESEARCH_PRICES.span();
    *prices.at(first + tier.into() - 1)
}
