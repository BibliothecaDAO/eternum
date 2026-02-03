use crate::alias::ID;

#[starknet::interface]
pub trait IArtificerSystems<TContractState> {
    fn burn_research_for_relic(ref self: TContractState, structure_id: ID);
}

#[dojo::contract]
pub mod artificer_systems {
    use dojo::event::EventStorage;
    use dojo::world::WorldStorage;
    use starknet::ContractAddress;
    use crate::alias::ID;
    use crate::constants::{
        DEFAULT_NS, RELICS_RESOURCE_END_ID, RELICS_RESOURCE_START_ID, RESOURCE_PRECISION, ResourceTypes, relic_level,
    };
    use crate::models::config::{ArtificerConfig, SeasonConfigImpl, WorldConfigUtilImpl};
    use crate::models::owner::OwnerAddressTrait;
    use crate::models::resource::resource::{
        ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
    use crate::models::structure::{StructureBase, StructureBaseStoreImpl, StructureCategory, StructureOwnerStoreImpl};
    use crate::system_libraries::rng_library::{IRNGlibraryDispatcherTrait, rng_library};

    #[derive(Copy, Drop, Serde)]
    #[dojo::event(historical: false)]
    pub struct BurnResearchForRelicEvent {
        #[key]
        pub structure_id: ID,
        pub relic_type: u8,
        pub timestamp: u64,
    }

    #[abi(embed_v0)]
    impl ArtificerSystemsImpl of super::IArtificerSystems<ContractState> {
        fn burn_research_for_relic(ref self: ContractState, structure_id: ID) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // Ensure structure is a realm or village
            let structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, structure_id);
            assert!(
                structure_base.category == StructureCategory::Realm.into()
                    || structure_base.category == StructureCategory::Village.into(),
                "structure is not a realm or village",
            );

            // Ensure caller owns the structure
            let structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, structure_id);
            structure_owner.assert_caller_owner();

            // Get config and burn research
            let artificer_config: ArtificerConfig = WorldConfigUtilImpl::get_member(
                world, selector!("artificer_config"),
            );
            let research_cost = artificer_config.research_cost_for_relic * RESOURCE_PRECISION;
            let mut structure_weight = WeightStoreImpl::retrieve(ref world, structure_id);
            let research_weight_grams = ResourceWeightImpl::grams(ref world, ResourceTypes::RESEARCH);
            let mut research = SingleResourceStoreImpl::retrieve(
                ref world, structure_id, ResourceTypes::RESEARCH, ref structure_weight, research_weight_grams, true,
            );
            research.spend(research_cost, ref structure_weight, research_weight_grams);
            research.store(ref world);
            structure_weight.store(ref world, structure_id);

            // Select random relic using existing chest drop weights
            let (relic_ids, chances) = InternalImpl::_relic_chances(RELICS_RESOURCE_START_ID, RELICS_RESOURCE_END_ID);
            let rng_library_dispatcher = rng_library::get_dispatcher(@world);
            let vrf_seed: u256 = rng_library_dispatcher.get_random_number(structure_owner, world);
            let chosen_relics: Span<u8> = rng_library_dispatcher
                .get_weighted_choice_u8(relic_ids, chances, 1, true, vrf_seed);
            let relic_type: u8 = *chosen_relics.at(0);

            // Grant relic to structure
            let mut structure_weight = WeightStoreImpl::retrieve(ref world, structure_id);
            let relic_weight_grams = ResourceWeightImpl::grams(ref world, relic_type);
            let mut relic = SingleResourceStoreImpl::retrieve(
                ref world, structure_id, relic_type, ref structure_weight, relic_weight_grams, true,
            );
            relic.add(RESOURCE_PRECISION, ref structure_weight, relic_weight_grams);
            relic.store(ref world);
            structure_weight.store(ref world, structure_id);

            // Emit event
            world
                .emit_event(
                    @BurnResearchForRelicEvent { structure_id, relic_type, timestamp: starknet::get_block_timestamp() },
                );
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Returns relic IDs and their drop chances (matching chest drop system)
        fn _relic_chances(relic_start_id: u8, relic_end_id: u8) -> (Span<u8>, Span<u128>) {
            let mut chances = array![];
            let mut relic_ids = array![];
            for relic_id in relic_start_id..relic_end_id + 1 {
                relic_ids.append(relic_id);
                if relic_id == ResourceTypes::RELIC_E18 {
                    chances.append(200);
                } else if relic_id == ResourceTypes::RELIC_E15 {
                    chances.append(0); // LaborProductionRelic1
                } else if relic_id == ResourceTypes::RELIC_E16 {
                    chances.append(0); // LaborProductionRelic2
                } else if relic_id == ResourceTypes::RELIC_E17 {
                    chances.append(600);
                } else if relic_level(relic_id) == 2 {
                    chances.append(400);
                } else if relic_level(relic_id) == 1 {
                    chances.append(750);
                } else {
                    panic!("Eternum: Invalid relic id for chance calculation");
                }
            }
            (relic_ids.span(), chances.span())
        }
    }
}
