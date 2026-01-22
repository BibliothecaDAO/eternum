//! Artificer Foundation Tests (Phase 1)
//!
//! Tests for RESEARCH resource type and Artificer building category constants.

#[cfg(test)]
mod tests {
    use crate::constants::{ResourceTypes, resource_type_name};
    use crate::models::resource::production::building::BuildingCategory;

    // ========================================================================
    // Resource Type Tests
    // ========================================================================

    #[test]
    fn test_research_resource_type_exists() {
        // RESEARCH should be defined as ID 57 (after relics which end at 56)
        assert!(ResourceTypes::RESEARCH == 57, "Research should be ID 57");
    }

    #[test]
    fn test_research_resource_name() {
        // resource_type_name should return "RESEARCH" for ID 57
        let name = resource_type_name(57);
        assert!(name == "RESEARCH", "Resource name should be RESEARCH");
    }

    // ========================================================================
    // Building Category Tests
    // ========================================================================

    #[test]
    fn test_artificer_building_category_exists() {
        // Artificer building category should be defined as ID 40
        let category: u8 = BuildingCategory::Artificer.into();
        assert!(category == 40, "Artificer should be category 40");
    }

    #[test]
    fn test_artificer_building_category_from_u8() {
        // Converting 40 to BuildingCategory should give Artificer
        let category: BuildingCategory = 40_u8.into();
        assert!(category == BuildingCategory::Artificer, "40 should convert to Artificer");
    }

    #[test]
    fn test_artificer_building_category_roundtrip() {
        // Verify roundtrip conversion: Artificer -> u8 -> Artificer
        let category = BuildingCategory::Artificer;
        let as_u8: u8 = category.into();
        let back: BuildingCategory = as_u8.into();
        assert!(back == BuildingCategory::Artificer, "Roundtrip should preserve Artificer");
    }
}
