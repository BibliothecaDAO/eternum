pub use crate::expeditions::{ExpeditionSite, site_reward};
pub use crate::exploration_rewards::reveal_reward;
pub use crate::resources::{ESSENCE, LABOR};
pub use crate::rules::RESOURCE_PRECISION;
pub use crate::taxonomy::{BEASTS_CATEGORY, RIFT_CATEGORY, RUIN_CATEGORY};
pub use crate::troops::{TroopTier, Troops};
pub fn create_site_structure(key: crate::resources::ResourceKey, category: u8) {
    crate::logic::structures::StructureState::create(
        key,
        crate::structures::StructureRecord {
            owner: 0.try_into().unwrap(),
            base: crate::structures::StructureBase { category, ..Default::default() },
            resources_packed: 0,
            metadata: Default::default(),
        },
    );
}
