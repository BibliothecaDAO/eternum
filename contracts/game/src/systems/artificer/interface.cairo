//! Artificer System Interface
//!
//! Defines the interface for the Artificer system which handles:
//! - Research production (active conversion from Food + Essence + LORDS)
//! - Relic crafting (burn Research to receive random relic)

use crate::alias::ID;

#[starknet::interface]
pub trait IArtificerSystems<TContractState> {
    /// Produce Research by burning input resources.
    ///
    /// Requirements:
    /// - Caller must own the structure
    /// - Structure must be a Realm (not Village)
    /// - Structure must have at least one Artificer building
    /// - Structure must have sufficient input resources (Food, Essence, LORDS)
    ///
    /// The production costs are defined via ResourceFactoryConfig for RESEARCH:
    /// - complex_input_list_id points to ResourceList entries for costs
    /// - output_per_complex_input defines Research produced per cycle
    ///
    /// # Arguments
    /// * `structure_id` - The ID of the realm to produce Research for
    /// * `cycles` - Number of production cycles to execute
    fn produce_research(ref self: TContractState, structure_id: ID, cycles: u128);

    /// Craft a random relic by burning Research.
    ///
    /// Requirements:
    /// - Caller must own the structure
    /// - Structure must be a Realm (not Village)
    /// - Structure must have at least one Artificer building
    /// - Structure must have sufficient Research (defined in ArtificerConfig)
    ///
    /// Uses VRF for weighted random selection from 16 active relics.
    ///
    /// # Arguments
    /// * `structure_id` - The ID of the realm to craft relic for
    fn craft_relic(ref self: TContractState, structure_id: ID);
}
