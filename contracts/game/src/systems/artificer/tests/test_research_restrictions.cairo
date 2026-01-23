//! Research Restrictions Tests (Phase 7)
//!
//! Tests that RESEARCH resource cannot be traded between structures.
//! Research is produced locally by the Artificer and consumed locally for relic crafting.

#[cfg(test)]
mod tests {
    use crate::constants::{is_resource_tradable, ResourceTypes};

    // ========================================================================
    // is_resource_tradable Tests
    // ========================================================================

    #[test]
    fn test_research_is_not_tradable() {
        // Research should NOT be tradable - it must be produced and consumed locally
        assert!(!is_resource_tradable(ResourceTypes::RESEARCH), "Research should NOT be tradable");
    }

    #[test]
    fn test_standard_resources_are_tradable() {
        // Standard resources should be tradable
        assert!(is_resource_tradable(ResourceTypes::WOOD), "Wood should be tradable");
        assert!(is_resource_tradable(ResourceTypes::STONE), "Stone should be tradable");
        assert!(is_resource_tradable(ResourceTypes::GOLD), "Gold should be tradable");
        assert!(is_resource_tradable(ResourceTypes::LORDS), "Lords should be tradable");
    }

    #[test]
    fn test_essence_is_tradable() {
        // Essence should be tradable (used in Research production)
        assert!(is_resource_tradable(ResourceTypes::ESSENCE), "Essence should be tradable");
    }

    #[test]
    fn test_relics_are_tradable() {
        // Relics should be tradable
        assert!(is_resource_tradable(39), "Relic 1 should be tradable");
        assert!(is_resource_tradable(54), "Relic 16 should be tradable");
    }

    // ========================================================================
    // Trade System Integration Notes
    // ========================================================================

    // Full integration tests for trading would require:
    // - Setting up two realms with owners
    // - Granting RESEARCH to one realm
    // - Attempting to create a trade order with RESEARCH
    // - Verifying the transaction reverts with "Resource not tradable"
    //
    // The is_resource_tradable function is called in trade_systems::create_order
    // which checks both maker_gives_resource_type and taker_pays_resource_type.
}
