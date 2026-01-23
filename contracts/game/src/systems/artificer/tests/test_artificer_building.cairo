//! Artificer Building Tests (Phase 3)
//!
//! Tests for realm-only building restriction on Artificer.

#[cfg(test)]
mod tests {
    use crate::models::resource::production::building::{BuildingCategory, BuildingProductionTrait};

    // ========================================================================
    // Realm-Only Building Category Tests
    // ========================================================================

    #[test]
    fn test_artificer_is_realm_only() {
        // Artificer should NOT be allowed for all realms and villages
        // (meaning it requires special handling - realm only)
        let building = create_mock_building(BuildingCategory::Artificer);
        assert!(!building.allowed_for_all_realms_and_villages(), "Artificer should not be allowed for all");
        assert!(building.is_realm_only(), "Artificer should be realm-only");
    }

    #[test]
    fn test_workers_hut_is_not_realm_only() {
        let building = create_mock_building(BuildingCategory::WorkersHut);
        assert!(building.allowed_for_all_realms_and_villages(), "WorkersHut should be allowed for all");
        assert!(!building.is_realm_only(), "WorkersHut should not be realm-only");
    }

    #[test]
    fn test_resource_stone_is_not_realm_only() {
        // Resource buildings have their own logic (structure must produce the resource)
        let building = create_mock_building(BuildingCategory::ResourceStone);
        assert!(!building.allowed_for_all_realms_and_villages(), "ResourceStone requires structure to produce it");
        assert!(!building.is_realm_only(), "ResourceStone should not be realm-only");
    }

    #[test]
    fn test_artificer_is_not_passive_resource_producer() {
        let building = create_mock_building(BuildingCategory::Artificer);
        assert!(!building.is_resource_producer(), "Artificer should not passively produce resources");
    }

    #[test]
    fn test_resource_building_is_resource_producer() {
        let building = create_mock_building(BuildingCategory::ResourceStone);
        assert!(building.is_resource_producer(), "ResourceStone should be a passive resource producer");
    }

    // ========================================================================
    // Helper Functions
    // ========================================================================

    use crate::models::resource::production::building::Building;

    fn create_mock_building(category: BuildingCategory) -> Building {
        Building {
            outer_col: 0,
            outer_row: 0,
            inner_col: 0,
            inner_row: 0,
            category: category.into(),
            bonus_percent: 0,
            entity_id: 1,
            outer_entity_id: 1,
            paused: false,
        }
    }
}
