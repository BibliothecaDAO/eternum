//! Artificer Models
//!
//! Configuration models for the Artificer building system:
//! - ArtificerConfig: Global config for research cost and relic weights
//! - RelicWeightList: Weighted probabilities for relic crafting

use crate::alias::ID;

/// Singleton config ID for ArtificerConfig
pub const ARTIFICER_CONFIG_ID: felt252 = 'artificer_config';

/// Global configuration for the Artificer system
#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct ArtificerConfig {
    #[key]
    pub config_id: felt252,
    /// Amount of Research required to craft one relic (in RESOURCE_PRECISION units)
    pub research_cost_per_relic: u128,
    /// ID of the RelicWeightList entries for weighted relic selection
    pub relic_weights_id: ID,
    /// Number of relic entries in the weight list (should be 16 for all active relics)
    pub relic_weights_count: u8,
}

/// Individual entry in a relic weight list for weighted random selection
#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct RelicWeightList {
    #[key]
    pub list_id: ID,
    #[key]
    pub index: u8,
    /// The resource ID of this relic (39-56 range)
    pub relic_resource_id: u8,
    /// Selection weight for this relic (higher = more likely)
    pub weight: u128,
}
