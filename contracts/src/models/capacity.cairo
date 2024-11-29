use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use s0_eternum::{alias::ID, models::config::{CapacityConfig, CapacityConfigCategory}, constants::RESOURCE_PRECISION};

#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct CapacityCategory {
    #[key]
    entity_id: ID,
    category: CapacityConfigCategory,
}


#[generate_trait]
impl CapacityCategoryCustomImpl of CapacityCategoryCustomTrait {
    fn assert_exists_and_get(ref world: WorldStorage, entity_id: ID) -> CapacityCategory {
        let capacity_category: CapacityCategory = world.read_model(entity_id);
        assert!(
            capacity_category.category != CapacityConfigCategory::None,
            "capacity category does not exist for entity {}",
            entity_id
        );
        return capacity_category;
    }
}
