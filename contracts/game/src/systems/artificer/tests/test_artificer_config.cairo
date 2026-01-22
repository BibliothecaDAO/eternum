//! Artificer Config Tests (Phase 2)
//!
//! Tests for ArtificerConfig and RelicWeightList models.

#[cfg(test)]
mod tests {
    use dojo::model::{ModelStorage, ModelStorageTest};
    use crate::constants::RESOURCE_PRECISION;
    use crate::models::artificer::{ArtificerConfig, RelicWeightList, ARTIFICER_CONFIG_ID};
    use crate::utils::testing::snf_helpers::snf_spawn_world_minimal;

    // ========================================================================
    // ArtificerConfig Tests
    // ========================================================================

    #[test]
    fn test_artificer_config_can_be_stored_and_read() {
        let mut world = snf_spawn_world_minimal();
        let config = ArtificerConfig {
            config_id: ARTIFICER_CONFIG_ID,
            research_cost_per_relic: 50000 * RESOURCE_PRECISION,
            relic_weights_id: 1,
            relic_weights_count: 16,
        };
        world.write_model_test(@config);

        let read_config: ArtificerConfig = world.read_model(ARTIFICER_CONFIG_ID);
        assert!(read_config.research_cost_per_relic == 50000 * RESOURCE_PRECISION, "Config research cost mismatch");
        assert!(read_config.relic_weights_id == 1, "Config relic weights ID mismatch");
        assert!(read_config.relic_weights_count == 16, "Config relic weights count mismatch");
    }

    #[test]
    fn test_artificer_config_id_constant() {
        // Verify ARTIFICER_CONFIG_ID is a valid non-zero value
        assert!(ARTIFICER_CONFIG_ID != 0, "ARTIFICER_CONFIG_ID should be non-zero");
    }

    // ========================================================================
    // RelicWeightList Tests
    // ========================================================================

    #[test]
    fn test_relic_weight_list_can_store_single_entry() {
        let mut world = snf_spawn_world_minimal();
        let list_id: u32 = 1;
        let entry = RelicWeightList {
            list_id,
            index: 0,
            relic_resource_id: 39, // First relic
            weight: 100,
        };
        world.write_model_test(@entry);

        let read_entry: RelicWeightList = world.read_model((list_id, 0_u8));
        assert!(read_entry.relic_resource_id == 39, "Relic resource ID mismatch");
        assert!(read_entry.weight == 100, "Weight mismatch");
    }

    #[test]
    fn test_relic_weight_list_can_store_16_entries() {
        let mut world = snf_spawn_world_minimal();
        let list_id: u32 = 1;

        // Store 16 relic weights (relics are 39-54 for the first 16)
        let mut i: u8 = 0;
        loop {
            if i >= 16 {
                break;
            }
            let entry = RelicWeightList {
                list_id,
                index: i,
                relic_resource_id: 39 + i, // Relics start at 39
                weight: 100 + i.into(), // Varying weights
            };
            world.write_model_test(@entry);
            i += 1;
        };

        // Verify all 16 can be read correctly
        let mut j: u8 = 0;
        loop {
            if j >= 16 {
                break;
            }
            let read_entry: RelicWeightList = world.read_model((list_id, j));
            assert!(read_entry.relic_resource_id == 39 + j, "Relic ID mismatch at index");
            assert!(read_entry.weight == 100 + j.into(), "Weight mismatch at index");
            j += 1;
        };
    }

    #[test]
    fn test_relic_weight_list_composite_key() {
        let mut world = snf_spawn_world_minimal();

        // Test that different list_id/index combinations are independent
        let entry1 = RelicWeightList { list_id: 1, index: 0, relic_resource_id: 39, weight: 100 };
        let entry2 = RelicWeightList { list_id: 1, index: 1, relic_resource_id: 40, weight: 200 };
        let entry3 = RelicWeightList { list_id: 2, index: 0, relic_resource_id: 41, weight: 300 };

        world.write_model_test(@entry1);
        world.write_model_test(@entry2);
        world.write_model_test(@entry3);

        let read1: RelicWeightList = world.read_model((1_u32, 0_u8));
        let read2: RelicWeightList = world.read_model((1_u32, 1_u8));
        let read3: RelicWeightList = world.read_model((2_u32, 0_u8));

        assert!(read1.relic_resource_id == 39, "Entry 1 mismatch");
        assert!(read2.relic_resource_id == 40, "Entry 2 mismatch");
        assert!(read3.relic_resource_id == 41, "Entry 3 mismatch");
    }
}
