use s1_eternum::alias::ID;
use s1_eternum::models::position::{Coord};

#[derive(Copy, Drop, Serde)]
pub enum RelicRecipientTypeParam {
    Explorer,
    StructureProduction,
    StructureGuard,
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
    use dojo::world::WorldStorage;
    use s1_eternum::alias::ID;
    use s1_eternum::constants::RESOURCE_PRECISION;
    use s1_eternum::constants::{DEFAULT_NS};
    use s1_eternum::models::config::MapConfig;
    use s1_eternum::models::config::{
        CombatConfigImpl, SeasonConfig, SeasonConfigImpl, TickImpl, TroopStaminaConfig, WorldConfigUtilImpl,
    };
    use s1_eternum::models::map::{Tile, TileImpl, TileOccupier};
    use s1_eternum::models::owner::OwnerAddressTrait;
    use s1_eternum::models::position::{Coord, TravelTrait};
    use s1_eternum::models::relic::RELIC_EFFECT;
    use s1_eternum::models::relic::{RelicEffectImpl};
    use s1_eternum::models::resource::production::production::{ProductionBoostBonus};
    use s1_eternum::models::resource::resource::{
        ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, TroopResourceImpl, WeightStoreImpl,
    };
    use s1_eternum::models::stamina::{StaminaImpl};
    use s1_eternum::models::structure::{
        StructureBase, StructureBaseStoreImpl, StructureOwnerStoreImpl, StructureTroopGuardStoreImpl,
    };
    use s1_eternum::models::troop::{ExplorerTroops, GuardImpl, GuardTroops};
    use s1_eternum::models::weight::Weight;
    use s1_eternum::systems::utils::map::IMapImpl;
    use s1_eternum::systems::utils::relic::iRelicChestResourceFactoryImpl;
    use s1_eternum::systems::utils::{
        resource::{iResourceTransferImpl}, structure::{iStructureImpl}, troop::{iExplorerImpl, iGuardImpl, iTroopImpl},
    };
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
            let season_config: SeasonConfig = SeasonConfigImpl::get(world);
            season_config.assert_started_and_not_over();

            // ensure caller owns entity
            let current_tick: u32 = TickImpl::get_tick_interval(ref world).current().try_into().unwrap();
            match recipient_type {
                RelicRecipientTypeParam::Explorer => {
                    // ensure caller owns explorer
                    let mut explorer: ExplorerTroops = world.read_model(entity_id);
                    explorer.assert_caller_structure_or_agent_owner(ref world);

                    // apply relic effect
                    let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
                    InternalImpl::explorer_boost(
                        ref world, ref explorer, relic_resource_id, current_tick, troop_stamina_config,
                    );
                },
                RelicRecipientTypeParam::StructureGuard => {
                    // ensure caller owns structure
                    StructureOwnerStoreImpl::retrieve(ref world, entity_id).assert_caller_owner();

                    // apply relic effect
                    let mut structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, entity_id);
                    let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
                    InternalImpl::structure_guard_boost(
                        ref world, entity_id, ref structure_base, relic_resource_id, current_tick, troop_stamina_config,
                    );
                },
                RelicRecipientTypeParam::StructureProduction => {
                    // ensure caller owns structure
                    StructureOwnerStoreImpl::retrieve(ref world, entity_id).assert_caller_owner();

                    // apply relic effect
                    InternalImpl::structure_production_boost(ref world, entity_id, relic_resource_id, current_tick);
                },
            };

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

    #[generate_trait]
    pub impl InternalImpl of InternalTrait {
        fn explorer_boost(
            ref world: WorldStorage,
            ref explorer: ExplorerTroops,
            relic_resource_id: u8,
            current_tick: u32,
            troop_stamina_config: TroopStaminaConfig,
        ) {
            // refill stamina
            explorer
                .troops
                .stamina
                .refill(
                    ref explorer.troops.boosts,
                    explorer.troops.category,
                    explorer.troops.tier,
                    troop_stamina_config,
                    current_tick.into(),
                );

            let (rate, duration, usage_left) = RelicEffectImpl::get_relic_effect(relic_resource_id);
            if relic_resource_id == RELIC_EFFECT::EXPLORER_INCREASE_STAMINA_REGENERATION_50P_3D
                || relic_resource_id == RELIC_EFFECT::EXPLORER_INCREASE_STAMINA_REGENERATION_100P_3D {
                explorer.troops.boosts.incr_stamina_regen_percent_num = rate;
                explorer.troops.boosts.incr_stamina_regen_tick_count = usage_left;
            } else if relic_resource_id == RELIC_EFFECT::EXPLORER_INCREASE_ATTACK_DAMAGE_20P_3D
                || relic_resource_id == RELIC_EFFECT::EXPLORER_INCREASE_ATTACK_DAMAGE_40P_3D {
                explorer.troops.boosts.incr_damage_dealt_percent_num = rate;
                explorer.troops.boosts.incr_damage_dealt_end_tick = current_tick + duration;
            } else if relic_resource_id == RELIC_EFFECT::EXPLORER_REDUCE_ENEMY_ATTACK_DAMAGE_20P_3D
                || relic_resource_id == RELIC_EFFECT::EXPLORER_REDUCE_ENEMY_ATTACK_DAMAGE_40P_3D {
                explorer.troops.boosts.decr_damage_gotten_percent_num = rate;
                explorer.troops.boosts.decr_damage_gotten_end_tick = current_tick + duration;
            } else if relic_resource_id == RELIC_EFFECT::EXPLORER_DOUBLE_EXPLORE_REWARD
                || relic_resource_id == RELIC_EFFECT::EXPLORER_TRIPLE_EXPLORE_REWARD {
                explorer.troops.boosts.incr_explore_reward_percent_num = rate;
                explorer.troops.boosts.incr_explore_reward_end_tick = current_tick + duration;
            } else if relic_resource_id == RELIC_EFFECT::EXPLORER_INSTANTLY_EXPLORE_ONE_TILE_RADIUS
                || relic_resource_id == RELIC_EFFECT::EXPLORER_INSTANTLY_EXPLORE_TWO_TILE_RADIUS {
                IMapImpl::explore_ring(ref world, explorer.coord, usage_left.into());
            } else {
                panic!("Eternum: invalid relic resource id for explorer");
            }

            world.write_model(@explorer);
        }

        fn structure_guard_boost(
            ref world: WorldStorage,
            structure_id: ID,
            ref structure_base: StructureBase,
            relic_resource_id: u8,
            current_tick: u32,
            troop_stamina_config: TroopStaminaConfig,
        ) {
            // ensure relic resource id is valid
            assert!(
                relic_resource_id == RELIC_EFFECT::STRUCTURE_GUARD_REDUCE_ENEMY_ATTACK_DAMAGE_15P_6D
                    || relic_resource_id == RELIC_EFFECT::STRUCTURE_GUARD_REDUCE_ENEMY_ATTACK_DAMAGE_30P_6D,
                "Eternum: invalid relic resource id for structure guard",
            );

            let (rate, duration, _usage_left) = RelicEffectImpl::get_relic_effect(relic_resource_id);
            let mut guards: GuardTroops = StructureTroopGuardStoreImpl::retrieve(ref world, structure_id);

            let structure_operational_slots = guards.functional_slots(structure_base.troop_max_guard_count.into());
            for i in 0..structure_operational_slots.len() {
                let slot = *structure_operational_slots.at(i);
                let (mut slot_troops, troop_destroyed_tick) = guards.from_slot(slot);

                // refill stamina
                slot_troops
                    .stamina
                    .refill(
                        ref slot_troops.boosts,
                        slot_troops.category,
                        slot_troops.tier,
                        troop_stamina_config,
                        current_tick.into(),
                    );

                // apply relic effect
                slot_troops.boosts.decr_damage_gotten_percent_num = rate;
                slot_troops.boosts.decr_damage_gotten_end_tick = current_tick + duration;
                guards.to_slot(slot, slot_troops, troop_destroyed_tick.into());
            };

            StructureTroopGuardStoreImpl::store(ref guards, ref world, structure_id);
        }

        fn structure_production_boost(
            ref world: WorldStorage, structure_id: ID, relic_resource_id: u8, current_tick: u32,
        ) {
            let (rate, duration, _usage_left) = RelicEffectImpl::get_relic_effect(relic_resource_id);
            let mut production_boost_bonus: ProductionBoostBonus = world.read_model(structure_id);
            if relic_resource_id == RELIC_EFFECT::STRUCTURE_RESOURCE_PRODUCTION_INCREASE_20P_3D
                || relic_resource_id == RELIC_EFFECT::STRUCTURE_RESOURCE_PRODUCTION_INCREASE_40P_3D {
                production_boost_bonus.incr_resource_rate_percent_num = rate;
                production_boost_bonus.incr_resource_rate_end_tick = current_tick + duration;
            } else if relic_resource_id == RELIC_EFFECT::STRUCTURE_LABOR_PRODUCTION_INCREASE_20P_6D
                || relic_resource_id == RELIC_EFFECT::STRUCTURE_LABOR_PRODUCTION_INCREASE_20P_12D {
                production_boost_bonus.incr_labor_rate_percent_num = rate;
                production_boost_bonus.incr_labor_rate_end_tick = current_tick + duration;
            } else if relic_resource_id == RELIC_EFFECT::STRUCTURE_TROOP_PRODUCTION_INCREASE_20P_6D
                || relic_resource_id == RELIC_EFFECT::STRUCTURE_TROOP_PRODUCTION_INCREASE_20P_12D {
                production_boost_bonus.incr_troop_rate_percent_num = rate;
                production_boost_bonus.incr_troop_rate_end_tick = current_tick + duration;
            } else {
                panic!("Eternum: invalid relic resource id for structure production");
            }

            world.write_model(@production_boost_bonus);
        }
    }
}
