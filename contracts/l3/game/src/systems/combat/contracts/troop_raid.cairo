use crate::alias::ID;
use crate::models::position::Direction;
#[starknet::interface]
pub trait ITroopRaidSystems<T> {
    fn raid_explorer_vs_guard(
        ref self: T,
        game_id: u32,
        explorer_id: ID,
        structure_id: ID,
        structure_direction: Direction,
        steal_resources: Span<(u8, u128)>,
    );
}


#[dojo::contract]
pub mod troop_raid_systems {
    use core::num::traits::zero::Zero;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use crate::alias::ID;
    use crate::constants::{DAYDREAMS_AGENT_ID, DEFAULT_NS};
    use crate::models::config::{
        BattleConfig, CombatConfigImpl, SeasonConfig, SeasonConfigImpl, TickImpl, TroopDamageConfig, TroopStaminaConfig,
        WorldConfigUtilImpl,
    };
    use crate::models::owner::OwnerAddressTrait;
    use crate::models::position::{Direction, TravelTrait};
    use crate::models::resource::resource::{
        ResourceWeightImpl, SingleResourceStoreImpl, TroopResourceImpl, WeightStoreImpl,
    };
    use crate::models::stamina::StaminaImpl;
    use crate::models::structure::{
        StructureBase, StructureBaseImpl, StructureBaseStoreImpl, StructureCategory, StructureOwnerStoreImpl,
        StructureTroopExplorerStoreImpl, StructureTroopGuardStoreImpl, VillageRaidImmunity,
    };
    use crate::models::troop::{ExplorerTroops, GuardTroops};
    use crate::models::weight::Weight;
    use crate::system_libraries::biome_library::{IBiomeLibraryDispatcherTrait, biome_library};
    use crate::system_libraries::raid_library::{IRaidLibraryDispatcherTrait, RaidResolution, raid_library};
    use crate::system_libraries::rng_library::{IRNGlibraryDispatcherTrait, rng_library};
    use crate::systems::utils::resource::iResourceTransferImpl;
    use crate::systems::utils::troop::{TroopRaidOutcome, iExplorerImpl, iTroopImpl};
    use crate::utils::achievements::index::{AchievementTrait, Tasks};
    use crate::utils::cartridge::vrf::Source;
    use crate::utils::map::biomes::Biome;
    use crate::utils::random::VRFImpl;
    use super::super::super::super::super::models::structure::StructureBaseTrait;

    #[derive(Copy, Drop, Serde)]
    #[dojo::event(historical: false)]
    pub struct ExplorerNewRaidEvent {
        #[key]
        pub game_id: u32,
        #[key]
        pub explorer_id: ID,
        #[key]
        pub structure_id: ID,
        #[key]
        pub explorer_owner_id: ID,
        pub success: bool,
        pub timestamp: u64,
    }


    #[derive(Copy, Drop, Serde)]
    #[dojo::event(historical: false)]
    pub struct ExplorerRaidEvent {
        #[key]
        pub game_id: u32,
        #[key]
        pub explorer_id: ID,
        #[key]
        pub structure_id: ID,
        pub success: bool,
        pub timestamp: u64,
    }

    #[abi(embed_v0)]
    pub impl TroopRaidSystemsImpl of super::ITroopRaidSystems<ContractState> {
        fn raid_explorer_vs_guard(
            ref self: ContractState,
            game_id: u32,
            explorer_id: ID,
            structure_id: ID,
            structure_direction: Direction,
            steal_resources: Span<(u8, u128)>,
        ) {
            let mut world = self.world(DEFAULT_NS());
            let season_config: SeasonConfig = SeasonConfigImpl::get(world, game_id);
            season_config.assert_started_and_not_over();

            let blitz_mode_on: bool = WorldConfigUtilImpl::get_member(world, game_id, selector!("blitz_mode_on"));
            assert!(!blitz_mode_on, "Eternum: no raid in blitz mode");

            // ensure caller owns aggressor
            let mut explorer_aggressor: ExplorerTroops = world.read_model((game_id, explorer_id));
            explorer_aggressor.assert_caller_structure_or_agent_owner(ref world);

            // ensure caller does not own defender
            let mut guarded_structure_owner: starknet::ContractAddress = StructureOwnerStoreImpl::retrieve(
                ref world, game_id, structure_id,
            );
            guarded_structure_owner.assert_caller_not_owner();

            // ensure aggressor has troops
            assert!(explorer_aggressor.troops.count.is_non_zero(), "aggressor has no troops");

            // ensure structure id is for a structure
            let mut guarded_structure: StructureBase = StructureBaseStoreImpl::retrieve(
                ref world, game_id, structure_id,
            );
            assert!(guarded_structure.category != StructureCategory::None.into(), "defender is not a structure");

            // ensure defender is not cloaked
            let tick = TickImpl::get_tick_interval(ref world, game_id);
            let battle_config: BattleConfig = WorldConfigUtilImpl::get_member(
                world, game_id, selector!("battle_config"),
            );
            guarded_structure.assert_not_cloaked(battle_config, tick, season_config);

            // ensure attacker is not cloaked
            if !explorer_aggressor.is_daydreams_agent() {
                let mut explorer_aggressor_structure: StructureBase = StructureBaseStoreImpl::retrieve(
                    ref world, game_id, explorer_aggressor.owner,
                );
                explorer_aggressor_structure.assert_not_cloaked(battle_config, tick, season_config);
            }

            // ensure explorer is adjacent to structure
            assert!(
                explorer_aggressor.coord.is_adjacent(guarded_structure.coord()),
                "explorer is not adjacent to structure",
            );

            // get guard troops
            let mut guard_defender: GuardTroops = StructureTroopGuardStoreImpl::retrieve(
                ref world, game_id, structure_id,
            );
            let mut explorer_aggressor_troops = explorer_aggressor.troops;
            let biome_library = biome_library::get_dispatcher(@world);
            let defender_biome: Biome = biome_library
                .get_biome(
                    world,
                    game_id,
                    guarded_structure.coord().alt,
                    guarded_structure.coord().x.into(),
                    guarded_structure.coord().y.into(),
                );
            let troop_damage_config: TroopDamageConfig = CombatConfigImpl::troop_damage_config(ref world, game_id);
            let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world, game_id);
            let current_tick = tick.current();
            let current_tick_interval = tick.interval();
            let raid_library = raid_library::get_dispatcher(@world);
            let raid_resolution: RaidResolution = raid_library
                .resolve_raid(
                    guard_defender,
                    explorer_aggressor_troops,
                    defender_biome,
                    guarded_structure.troop_max_guard_count,
                    troop_stamina_config,
                    troop_damage_config,
                    current_tick,
                    current_tick_interval,
                );
            guard_defender = raid_resolution.guard_troops;
            explorer_aggressor_troops = raid_resolution.explorer_troops;

            if raid_resolution.had_non_zero_guards {
                if raid_resolution.explorer_troops_lost.is_non_zero() {
                    iExplorerImpl::update_capacity(
                        ref world, game_id, explorer_id, raid_resolution.explorer_troops_lost, false,
                    );
                }

                StructureTroopGuardStoreImpl::store(ref guard_defender, ref world, game_id, structure_id);
                if raid_resolution.destroyed_guard_count.is_non_zero() {
                    guarded_structure.troop_guard_count -= raid_resolution.destroyed_guard_count.into();
                    StructureBaseStoreImpl::store(ref guarded_structure, ref world, game_id, structure_id);
                }

                explorer_aggressor.troops = explorer_aggressor_troops;
                if explorer_aggressor_troops.count.is_zero() {
                    if explorer_aggressor.owner == DAYDREAMS_AGENT_ID {
                        iExplorerImpl::explorer_from_agent_delete(ref world, ref explorer_aggressor);

                        // grant kill agent achievement
                        AchievementTrait::progress(
                            world,
                            guarded_structure_owner.into(),
                            Tasks::KILL_AGENT,
                            1,
                            starknet::get_block_timestamp(),
                        );
                    } else {
                        let mut explorer_aggressor_owner_structure: StructureBase = StructureBaseStoreImpl::retrieve(
                            ref world, game_id, explorer_aggressor.owner,
                        );
                        let mut explorer_aggressor_structure_explorers_list: Array<ID> =
                            StructureTroopExplorerStoreImpl::retrieve(
                            ref world, game_id, explorer_aggressor.owner,
                        )
                            .into();
                        iExplorerImpl::explorer_from_structure_delete(
                            ref world,
                            ref explorer_aggressor,
                            explorer_aggressor_structure_explorers_list,
                            ref explorer_aggressor_owner_structure,
                            explorer_aggressor.owner,
                        );
                    }
                } else {
                    world.write_model(@explorer_aggressor);
                }
            }

            let mut raid_success = true;
            if raid_resolution.had_non_zero_guards {
                let raid_outcome = iTroopImpl::raid_outcome(
                    raid_resolution.sum_damage_to_guards, raid_resolution.sum_damage_to_explorer,
                );
                match raid_outcome {
                    TroopRaidOutcome::Success => { raid_success = true },
                    TroopRaidOutcome::Failure => { raid_success = false },
                    TroopRaidOutcome::Chance => {
                        let rng_library_dispatcher = rng_library::get_dispatcher(@world);
                        let vrf_seed: u256 = rng_library_dispatcher
                            .get_random_number(game_id, Source::Nonce(starknet::get_caller_address()), world);
                        raid_success =
                            iTroopImpl::raid(
                                raid_resolution.sum_damage_to_guards,
                                raid_resolution.sum_damage_to_explorer,
                                vrf_seed,
                                world,
                            );
                    },
                }
            }

            // steal resources
            if raid_success {
                // check village raid resource immunity
                let is_village = guarded_structure.category == StructureCategory::Village.into();
                let troop_resources_only = if is_village {
                    let immunity: VillageRaidImmunity = world.read_model((game_id, structure_id));
                    if immunity.last_raided_at.is_non_zero() {
                        let immunity_end = immunity.last_raided_at + battle_config.village_raid_immunity_ticks.into();
                        current_tick < immunity_end
                    } else {
                        false
                    }
                } else {
                    false
                };

                let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, game_id, structure_id);
                let mut explorer_weight: Weight = WeightStoreImpl::retrieve(ref world, game_id, explorer_id);
                iResourceTransferImpl::structure_to_troop_raid_instant(
                    ref world,
                    game_id,
                    structure_id,
                    ref structure_weight,
                    explorer_id,
                    ref explorer_weight,
                    steal_resources,
                    troop_resources_only,
                );
                structure_weight.store(ref world, game_id, structure_id);
                explorer_weight.store(ref world, game_id, explorer_id);

                // update village raid immunity timestamp
                if is_village {
                    world
                        .write_model(
                            @VillageRaidImmunity { game_id, village_id: structure_id, last_raided_at: current_tick },
                        );
                }

                // grant raid achievement
                let explorer_structure_owner_address: starknet::ContractAddress = StructureOwnerStoreImpl::retrieve(
                    ref world, game_id, explorer_aggressor.owner,
                );
                AchievementTrait::progress(
                    world,
                    explorer_structure_owner_address.into(),
                    Tasks::SUCCESSFUL_RAID,
                    1,
                    starknet::get_block_timestamp(),
                );
            }

            world
                .emit_event(
                    @ExplorerRaidEvent {
                        game_id,
                        explorer_id,
                        structure_id,
                        success: raid_success,
                        timestamp: starknet::get_block_timestamp(),
                    },
                );

            world
                .emit_event(
                    @ExplorerNewRaidEvent {
                        game_id,
                        explorer_id,
                        structure_id,
                        explorer_owner_id: explorer_aggressor.owner,
                        success: raid_success,
                        timestamp: starknet::get_block_timestamp(),
                    },
                );
        }
    }
}
