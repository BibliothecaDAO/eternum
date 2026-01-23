//! Research Production Tests (Phase 4)
//!
//! Tests for produce_research() functionality in the Artificer system.
//! Note: Full integration tests require world setup which is covered in later phases.
//! These tests verify the core logic and error conditions.

#[cfg(test)]
mod tests {
    use crate::constants::{RESOURCE_PRECISION, ResourceTypes};
    use crate::models::artificer::{ArtificerConfig, ARTIFICER_CONFIG_ID};
    use crate::models::resource::production::building::{
        BuildingCategory, StructureBuildings, StructureBuildingCategoryCountTrait,
    };

    // ========================================================================
    // Artificer Building Count Tests
    // ========================================================================

    #[test]
    fn test_artificer_building_count_starts_at_zero() {
        // Verify a new structure has zero Artificer buildings
        let structure_buildings = StructureBuildings {
            entity_id: 1,
            packed_counts_1: 0,
            packed_counts_2: 0,
            packed_counts_3: 0,
            population: Default::default(),
        };

        let count = structure_buildings.building_count(BuildingCategory::Artificer);
        assert!(count == 0, "Initial Artificer count should be 0");
    }

    #[test]
    fn test_artificer_building_count_can_be_updated() {
        // Verify Artificer building count can be incremented
        let mut structure_buildings = StructureBuildings {
            entity_id: 1,
            packed_counts_1: 0,
            packed_counts_2: 0,
            packed_counts_3: 0,
            population: Default::default(),
        };

        // Update count to 1
        structure_buildings.update_building_count(BuildingCategory::Artificer, 1);
        let count = structure_buildings.building_count(BuildingCategory::Artificer);
        assert!(count == 1, "Artificer count should be 1 after update");

        // Update count to 5
        structure_buildings.update_building_count(BuildingCategory::Artificer, 5);
        let count = structure_buildings.building_count(BuildingCategory::Artificer);
        assert!(count == 5, "Artificer count should be 5 after second update");
    }

    #[test]
    fn test_artificer_building_count_independent_of_other_buildings() {
        // Verify Artificer count doesn't affect other building counts
        let mut structure_buildings = StructureBuildings {
            entity_id: 1,
            packed_counts_1: 0,
            packed_counts_2: 0,
            packed_counts_3: 0,
            population: Default::default(),
        };

        // Set both Artificer and WorkersHut counts
        structure_buildings.update_building_count(BuildingCategory::Artificer, 3);
        structure_buildings.update_building_count(BuildingCategory::WorkersHut, 7);

        // Verify both are independent
        let artificer_count = structure_buildings.building_count(BuildingCategory::Artificer);
        let workers_count = structure_buildings.building_count(BuildingCategory::WorkersHut);

        assert!(artificer_count == 3, "Artificer count should be 3");
        assert!(workers_count == 7, "WorkersHut count should be 7");
    }

    // ========================================================================
    // Research Production Config Tests
    // ========================================================================

    #[test]
    fn test_research_resource_type_constant() {
        // Verify RESEARCH constant is accessible for production config
        assert!(ResourceTypes::RESEARCH == 57, "RESEARCH should be resource type 57");
    }

    #[test]
    fn test_artificer_config_id_is_valid() {
        // Verify the config ID constant is usable
        assert!(ARTIFICER_CONFIG_ID != 0, "ARTIFICER_CONFIG_ID should be non-zero");
    }

    // ========================================================================
    // Production Logic Tests (Unit Tests)
    // ========================================================================

    // Note: Full integration tests for produce_research() require:
    // - A world with configured ResourceFactoryConfig for RESEARCH
    // - A realm with at least one Artificer building
    // - Sufficient input resources (Food, Essence, LORDS)
    //
    // These tests will be added as part of the full system integration in Phase 6.
    // For now, we verify the building count logic works correctly which is the
    // prerequisite for the produce_research() check.
}
