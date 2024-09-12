use dojo::world::IWorldDispatcher;
use eternum::{alias::ID, models::config::{CapacityConfig, CapacityConfigCategory}, constants::RESOURCE_PRECISION};

#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct CapacityCategory {
    #[key]
    entity_id: ID,
    category: CapacityConfigCategory,
}


#[generate_trait]
impl CapacityCategoryCustomImpl of CapacityCategoryCustomTrait {
    fn assert_exists_and_get(world: IWorldDispatcher, entity_id: ID) -> CapacityCategory {
        let capacity_category = get!(world, entity_id, CapacityCategory);
        assert!(
            capacity_category.category != CapacityConfigCategory::None,
            "capacity category does not exist for entity {}",
            entity_id
        );
        return capacity_category;
    }
}
