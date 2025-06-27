use s1_eternum::alias::ID;
use s1_eternum::models::position::{Coord};

#[derive(Copy, Drop, Serde)]
pub enum RelicRecipientTypeParam {
    Explorer,
    Structure,
}

#[starknet::interface]
pub trait IRelicSystems<T> {
    fn open_chest(ref self: T, explorer_id: ID, chest_coord: Coord);
    fn apply_relic(ref self: T, entity_id: ID, relic_resource_id: u8, recipient_type: RelicRecipientTypeParam);
}


#[dojo::contract]
pub mod relic_systems {
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use s1_eternum::alias::ID;
    use s1_eternum::constants::RESOURCE_PRECISION;
    use s1_eternum::constants::{DEFAULT_NS};
    use s1_eternum::models::config::MapConfig;
    use s1_eternum::models::config::{CombatConfigImpl, SeasonConfig, SeasonConfigImpl, TickImpl, WorldConfigUtilImpl};
    use s1_eternum::models::map::{Tile, TileImpl, TileOccupier};
    use s1_eternum::models::owner::OwnerAddressTrait;
    use s1_eternum::models::position::{Coord, TravelTrait};
    use s1_eternum::models::relic::{RelicEffectObjectImpl, RelicEffectStoreImpl};
    use s1_eternum::models::resource::resource::{
        ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, TroopResourceImpl, WeightStoreImpl,
    };
    use s1_eternum::models::stamina::{StaminaImpl};
    use s1_eternum::models::structure::StructureOwnerStoreImpl;
    use s1_eternum::models::troop::{ExplorerTroops};
    use s1_eternum::models::weight::Weight;
    use s1_eternum::systems::utils::map::IMapImpl;
    use s1_eternum::systems::utils::relic::iRelicChestResourceFactoryImpl;
    use s1_eternum::systems::utils::{
        resource::{iResourceTransferImpl}, structure::iStructureImpl, troop::{iExplorerImpl, iGuardImpl, iTroopImpl},
    };
    use s1_eternum::utils::math::{PercentageValueImpl};
    use s1_eternum::utils::random::{VRFImpl};
    use super::RelicRecipientTypeParam;


    #[derive(Copy, Drop, Serde)]
    #[dojo::event(historical: false)]
    pub struct OpenRelicChestEvent {
        #[key]
        pub explorer_id: ID,
        #[key]
        pub chest_coord: Coord,
        pub relics: Span<u8>,
        pub timestamp: u64,
    }


    #[abi(embed_v0)]
    pub impl RelicSystemsImpl of super::IRelicSystems<ContractState> {
        fn open_chest(ref self: ContractState, explorer_id: ID, chest_coord: Coord) {
            let mut world = self.world(DEFAULT_NS());
            let season_config: SeasonConfig = SeasonConfigImpl::get(world);
            season_config.assert_started_and_not_over();

            // ensure caller owns aggressor
            let mut explorer: ExplorerTroops = world.read_model(explorer_id);
            explorer.assert_caller_structure_or_agent_owner(ref world);

            // ensure explorer is adjacent to chest tile
            assert!(explorer.coord.is_adjacent(chest_coord), "explorer is not adjacent to chest");

            // ensure the tile specified is occupied by a chest
            let mut chest_tile: Tile = world.read_model((chest_coord.x, chest_coord.y));
            assert!(chest_tile.occupied(), "tile is not occupied");
            assert!(chest_tile.occupier_type == TileOccupier::Chest.into(), "Eternum: No chest found at coord");

            // remove the chest from the tile
            IMapImpl::unoccupy(ref world, ref chest_tile);

            // grant relics to the army
            let mut explorer_weight: Weight = WeightStoreImpl::retrieve(ref world, explorer_id);
            let map_config: MapConfig = WorldConfigUtilImpl::get_member(world, selector!("map_config"));
            let vrf_provider: starknet::ContractAddress = WorldConfigUtilImpl::get_member(
                world, selector!("vrf_provider_address"),
            );
            let vrf_seed: u256 = VRFImpl::seed(starknet::get_caller_address(), vrf_provider);
            let relics: Span<u8> = iRelicChestResourceFactoryImpl::grant_relics(
                ref world, explorer_id, ref explorer_weight, map_config, vrf_seed,
            );

            world
                .emit_event(
                    @OpenRelicChestEvent {
                        explorer_id, chest_coord, relics, timestamp: starknet::get_block_timestamp(),
                    },
                );
        }

        fn apply_relic(
            ref self: ContractState, entity_id: ID, relic_resource_id: u8, recipient_type: RelicRecipientTypeParam,
        ) {
            let mut world = self.world(DEFAULT_NS());
            // ensure caller owns entity
            match recipient_type {
                RelicRecipientTypeParam::Explorer => {
                    let mut explorer: ExplorerTroops = world.read_model(entity_id);
                    explorer.assert_caller_structure_or_agent_owner(ref world);
                },
                RelicRecipientTypeParam::Structure => {
                    StructureOwnerStoreImpl::retrieve(ref world, entity_id).assert_caller_owner();
                },
            };

            // create relic effect instance
            let current_tick: u32 = TickImpl::get_tick_config(ref world).current().try_into().unwrap();
            let relic_effect = RelicEffectObjectImpl::create_relic_effect(entity_id, relic_resource_id, current_tick);
            relic_effect.store(ref world, current_tick);

            // spend the relic resource
            let mut entity_weight: Weight = WeightStoreImpl::retrieve(ref world, entity_id);
            let relic_resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, relic_resource_id);
            let mut relic_resource = SingleResourceStoreImpl::retrieve(
                ref world, entity_id, relic_resource_id, ref entity_weight, relic_resource_weight_grams, true,
            );
            relic_resource.spend(1 * RESOURCE_PRECISION, ref entity_weight, relic_resource_weight_grams);
            relic_resource.store(ref world);
        }
    }
}
