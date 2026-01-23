//! Artificer System Contracts
//!
//! Handles Research production and Relic crafting.
//!
//! Research Production:
//! - Burns Food + Essence + LORDS to produce Research
//! - Requires at least one Artificer building on a Realm
//! - Uses ResourceFactoryConfig for input/output amounts
//!
//! Relic Crafting:
//! - Burns Research to receive a random relic
//! - Uses VRF for weighted random selection
//! - Configured via ArtificerConfig for cost and weights

use crate::alias::ID;
use crate::systems::artificer::interface::IArtificerSystems;

#[dojo::contract]
mod artificer_systems {
    use core::num::traits::zero::Zero;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::{IWorldDispatcherTrait, WorldStorage};
    use starknet::ContractAddress;
    use crate::alias::ID;
    use crate::constants::{DEFAULT_NS, RESOURCE_PRECISION, ResourceTypes};
    use crate::models::artificer::{ArtificerConfig, RelicWeightList, ARTIFICER_CONFIG_ID};
    use crate::models::config::SeasonConfigImpl;
    use crate::models::events::{RelicCraftedStory, Story, StoryEvent};
    use crate::models::owner::OwnerAddressTrait;
    use crate::models::resource::production::building::{
        BuildingCategory, StructureBuildings, StructureBuildingCategoryCountTrait,
    };
    use crate::models::resource::production::production::ProductionStrategyImpl;
    use crate::models::resource::resource::{
        ResourceWeightImpl, SingleResourceStoreImpl, SingleResourceTrait, WeightStoreImpl,
    };
    use crate::models::structure::{
        StructureBase, StructureBaseStoreImpl, StructureCategory, StructureOwnerStoreImpl,
    };
    use crate::models::weight::Weight;
    use crate::system_libraries::rng_library::{IRNGlibraryDispatcherTrait, rng_library};

    // ========================================================================
    // Constants
    // ========================================================================

    /// Error messages
    mod Errors {
        pub const NO_ARTIFICER_BUILDING: felt252 = 'No Artificer building';
        pub const NOT_A_REALM: felt252 = 'Structure is not a Realm';
        pub const ZERO_CYCLES: felt252 = 'Zero production cycles';
        pub const INSUFFICIENT_RESEARCH: felt252 = 'Insufficient Research';
        pub const NO_ARTIFICER_CONFIG: felt252 = 'Artificer config not set';
        pub const NO_RELIC_WEIGHTS: felt252 = 'Relic weights not configured';
    }

    // ========================================================================
    // Contract Implementation
    // ========================================================================

    #[abi(embed_v0)]
    impl ArtificerSystemsImpl of super::IArtificerSystems<ContractState> {
        /// Produce Research by burning input resources.
        ///
        /// Uses the existing burn_resource_for_resource_production pattern from
        /// ProductionStrategyImpl, with an additional check for Artificer building.
        fn produce_research(ref self: ContractState, structure_id: ID, cycles: u128) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());

            // Ensure season is active
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // Ensure caller owns the structure
            let structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, structure_id);
            structure_owner.assert_caller_owner();

            // Ensure structure is a Realm (not Village)
            let structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, structure_id);
            assert!(structure_base.category == StructureCategory::Realm.into(), "{}", Errors::NOT_A_REALM);

            // Ensure structure has at least one Artificer building
            let structure_buildings: StructureBuildings = world.read_model(structure_id);
            let artificer_count = structure_buildings.building_count(BuildingCategory::Artificer);
            assert!(artificer_count > 0, "{}", Errors::NO_ARTIFICER_BUILDING);

            // Ensure non-zero cycles
            assert!(cycles.is_non_zero(), "{}", Errors::ZERO_CYCLES);

            // Produce Research using the standard burn pattern
            // This will:
            // 1. Read ResourceFactoryConfig for RESEARCH
            // 2. Burn the configured input resources (Food, Essence, LORDS)
            // 3. Add produced Research to output_amount_left
            ProductionStrategyImpl::burn_resource_for_resource_production(
                ref world, structure_id, ResourceTypes::RESEARCH, cycles,
            );
        }

        /// Craft a random relic by burning Research.
        ///
        /// Uses VRF for weighted random selection from configured relics.
        fn craft_relic(ref self: ContractState, structure_id: ID) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());

            // Ensure season is active
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // Ensure caller owns the structure
            let structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, structure_id);
            structure_owner.assert_caller_owner();

            // Ensure structure is a Realm (not Village)
            let structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, structure_id);
            assert!(structure_base.category == StructureCategory::Realm.into(), "{}", Errors::NOT_A_REALM);

            // Ensure structure has at least one Artificer building
            let structure_buildings: StructureBuildings = world.read_model(structure_id);
            let artificer_count = structure_buildings.building_count(BuildingCategory::Artificer);
            assert!(artificer_count > 0, "{}", Errors::NO_ARTIFICER_BUILDING);

            // Load Artificer config
            let config: ArtificerConfig = world.read_model(ARTIFICER_CONFIG_ID);
            assert!(config.research_cost_per_relic.is_non_zero(), "{}", Errors::NO_ARTIFICER_CONFIG);
            assert!(config.relic_weights_count.is_non_zero(), "{}", Errors::NO_RELIC_WEIGHTS);

            // Spend Research
            let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, structure_id);
            let research_weight_grams: u128 = ResourceWeightImpl::grams(ref world, ResourceTypes::RESEARCH);
            let mut research_resource = SingleResourceStoreImpl::retrieve(
                ref world,
                structure_id,
                ResourceTypes::RESEARCH,
                ref structure_weight,
                research_weight_grams,
                true,
            );

            // Verify sufficient Research
            assert!(
                research_resource.balance >= config.research_cost_per_relic, "{}", Errors::INSUFFICIENT_RESEARCH,
            );

            // Spend the Research
            research_resource.spend(config.research_cost_per_relic, ref structure_weight, research_weight_grams);
            research_resource.store(ref world);

            // Build relic IDs and weights arrays from config
            let mut relic_ids: Array<u8> = array![];
            let mut weights: Array<u128> = array![];

            let mut i: u8 = 0;
            loop {
                if i >= config.relic_weights_count {
                    break;
                }
                let entry: RelicWeightList = world.read_model((config.relic_weights_id, i));
                relic_ids.append(entry.relic_resource_id);
                weights.append(entry.weight);
                i += 1;
            };

            // Get VRF seed for randomness
            let caller = starknet::get_caller_address();
            let rng_library_dispatcher = rng_library::get_dispatcher(@world);
            let vrf_seed: u256 = rng_library_dispatcher.get_random_number(caller, world);

            // Select random relic using weighted choice
            let chosen_relics: Span<u8> = rng_library_dispatcher
                .get_weighted_choice_u8(relic_ids.span(), weights.span(), 1, false, vrf_seed);

            // Grant the selected relic to the structure
            let relic_id: u8 = *chosen_relics.at(0);
            let relic_weight_grams: u128 = ResourceWeightImpl::grams(ref world, relic_id);
            let mut relic_resource = SingleResourceStoreImpl::retrieve(
                ref world, structure_id, relic_id, ref structure_weight, relic_weight_grams, true,
            );
            relic_resource.add(1 * RESOURCE_PRECISION, ref structure_weight, relic_weight_grams);
            relic_resource.store(ref world);

            // Update structure weight
            structure_weight.store(ref world, structure_id);

            // Emit event
            world
                .emit_event(
                    @StoryEvent {
                        id: world.dispatcher.uuid(),
                        owner: Option::Some(structure_owner),
                        entity_id: Option::Some(structure_id),
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: Story::RelicCraftedStory(
                            RelicCraftedStory {
                                relic_id,
                                research_cost: config.research_cost_per_relic,
                            },
                        ),
                        timestamp: starknet::get_block_timestamp(),
                    },
                );
        }
    }
}
