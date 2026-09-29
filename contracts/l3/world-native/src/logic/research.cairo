use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
use crate::research::{BuildingTierRule, NODE_COUNT, RealmKnowledge, ResearchEffect, ResearchNode, node_bit};
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

pub fn node(game_id: u32, id: u8) -> ResearchNode {
    assert!(id < NODE_COUNT, "invalid research node");
    crate::logic::preset_record::for_game(game_id).research_nodes.read(id).expect('missing research node')
}

pub fn building_tier(key: ResourceKey, category: u8) -> u8 {
    let learned = require(key).learned;
    let mut tier = 1;
    for id in 0..NODE_COUNT {
        let rule = node(key.game_id, id);
        if learned & node_bit(id) != 0 {
            if let ResearchEffect::BuildingTier((target, unlocked)) = rule.effect {
                if target == category {
                    tier = core::cmp::max(tier, unlocked);
                }
            }
        }
    }
    tier
}

pub fn has_effect(key: ResourceKey, effect: ResearchEffect) -> bool {
    let learned = require(key).learned;
    for id in 0..NODE_COUNT {
        let rule = node(key.game_id, id);
        if rule.effect == effect {
            return learned & node_bit(id) != 0;
        }
    }
    panic!("missing research effect")
}

pub fn tier_rule(game_id: u32, category: u8, tier: u8) -> BuildingTierRule {
    assert!(tier == 2 || tier == 3, "tier rule requires II or III");
    crate::logic::preset_record::for_game(game_id)
        .building_tiers
        .read((category, tier))
        .expect('missing building tier rule')
}
