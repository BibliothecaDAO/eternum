use s1_eternum::alias::ID;
use s1_eternum::models::position::{Direction};
#[starknet::interface]
pub trait ITroopRaidSystems<T> {
    fn raid_explorer_vs_guard(
        ref self: T,
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
    use s1_eternum::alias::ID;
    use s1_eternum::constants::{DAYDREAMS_AGENT_ID, DEFAULT_NS, RESOURCE_PRECISION};
    use s1_eternum::models::config::{
        BattleConfig, CombatConfigImpl, SeasonConfig, SeasonConfigImpl, TickImpl, TroopDamageConfig, TroopStaminaConfig,
        WorldConfigUtilImpl,
    };
    use s1_eternum::models::owner::{OwnerAddressTrait};
    use s1_eternum::models::position::{CoordTrait, Direction};
    use s1_eternum::models::resource::resource::{
        ResourceWeightImpl, SingleResourceStoreImpl, TroopResourceImpl, WeightStoreImpl,
    };
    use s1_eternum::models::stamina::{StaminaImpl};
    use s1_eternum::models::structure::{
        StructureBase, StructureBaseImpl, StructureBaseStoreImpl, StructureCategory, StructureOwnerStoreImpl,
        StructureTroopExplorerStoreImpl, StructureTroopGuardStoreImpl,
    };
    use s1_eternum::models::troop::{ExplorerTroops, GuardImpl, GuardTroops, TroopsImpl, TroopsTrait};
    use s1_eternum::models::weight::Weight;
    use s1_eternum::systems::utils::{
        resource::{iResourceTransferImpl}, structure::iStructureImpl,
        troop::{TroopRaidOutcome, iExplorerImpl, iGuardImpl, iTroopImpl},
    };
    use s1_eternum::utils::achievements::index::{AchievementTrait, Tasks};
    use s1_eternum::utils::map::biomes::{Biome, get_biome};
    use s1_eternum::utils::math::{PercentageValueImpl};
    use s1_eternum::utils::random::{VRFImpl};
    use super::super::super::super::super::models::structure::StructureBaseTrait;

    use super::super::super::super::super::models::troop::GuardTrait;


    #[derive(Copy, Drop, Serde)]
    #[dojo::event(historical: false)]
    pub struct ExplorerRaidEvent {
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
            explorer_id: ID,
            structure_id: ID,
            structure_direction: Direction,
            steal_resources: Span<(u8, u128)>,
        ) {
            let mut world = self.world(DEFAULT_NS());
            let season_config: SeasonConfig = SeasonConfigImpl::get(world);
            season_config.assert_started_and_not_over();

            // ensure caller owns aggressor
            let mut explorer_aggressor: ExplorerTroops = world.read_model(explorer_id);
            explorer_aggressor.assert_caller_structure_or_agent_owner(ref world);

            // ensure caller does not own defender
            let mut guarded_structure_owner: starknet::ContractAddress = StructureOwnerStoreImpl::retrieve(
                ref world, structure_id,
            );
            guarded_structure_owner.assert_caller_not_owner();

            // ensure aggressor has troops
            assert!(explorer_aggressor.troops.count.is_non_zero(), "aggressor has no troops");

            // ensure structure id is for a structure
            let mut guarded_structure: StructureBase = StructureBaseStoreImpl::retrieve(ref world, structure_id);
            assert!(guarded_structure.category != StructureCategory::None.into(), "defender is not a structure");

            // ensure defender is not cloaked
            let tick = TickImpl::get_tick_config(ref world);
            let battle_config: BattleConfig = WorldConfigUtilImpl::get_member(world, selector!("battle_config"));
            guarded_structure.assert_not_cloaked(battle_config, tick, season_config);

            // ensure attacker is not cloaked
            if !explorer_aggressor.is_daydreams_agent() {
                let mut explorer_aggressor_structure: StructureBase = StructureBaseStoreImpl::retrieve(
                    ref world, explorer_aggressor.owner,
                );
                explorer_aggressor_structure.assert_not_cloaked(battle_config, tick, season_config);
            }

            // ensure explorer is adjacent to structure
            assert!(
                explorer_aggressor.coord.neighbor(structure_direction) == guarded_structure.coord(),
                "explorer is not adjacent to structure",
            );

            // get guard troops
            let mut guard_defender: GuardTroops = StructureTroopGuardStoreImpl::retrieve(ref world, structure_id);
            let mut explorer_aggressor_troops = explorer_aggressor.troops;
            let defender_biome: Biome = get_biome(
                guarded_structure.coord().x.into(), guarded_structure.coord().y.into(),
            );
            let troop_damage_config: TroopDamageConfig = CombatConfigImpl::troop_damage_config(ref world);
            let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
            let current_tick = tick.current();

            let mut sum_damage_to_explorer = 0;
            let mut sum_damage_to_guards = 0;
            let mut max_explorer_stamina_loss = 0;
            let structure_functional_guard_slots = guard_defender
                .functional_slots(guarded_structure.troop_max_guard_count.into());
            let mut structure_non_zero_guard_slots = array![];
            for i in 0..structure_functional_guard_slots.len() {
                let structure_functional_guard_slot = *structure_functional_guard_slots.at(i);
                let (mut guard_defender_troops, _) = guard_defender.from_slot(structure_functional_guard_slot);
                if guard_defender_troops.count.is_non_zero() {
                    structure_non_zero_guard_slots.append(structure_functional_guard_slot);
                }
            };

            if structure_non_zero_guard_slots.len().is_non_zero() {
                let mut structure_non_zero_guard_slots_damage_dealt = array![];
                let mut individual_explorer_aggressor_troops = explorer_aggressor_troops;
                individual_explorer_aggressor_troops.count = explorer_aggressor_troops.count
                    / structure_non_zero_guard_slots.len().into();
                individual_explorer_aggressor_troops
                    .count -= individual_explorer_aggressor_troops
                    .count % RESOURCE_PRECISION;
                assert!(
                    individual_explorer_aggressor_troops.count >= RESOURCE_PRECISION, "not enough troops to pillage",
                );

                for i in 0..structure_non_zero_guard_slots.len() {
                    let structure_non_zero_guard_slot = *structure_non_zero_guard_slots.at(i);
                    let (mut guard_defender_troops, guard_defender_troops_destroyed_tick) = guard_defender
                        .from_slot(structure_non_zero_guard_slot);
                    let (damage_dealt_to_guard, damage_dealt_to_explorer, explorer_stamina_loss) =
                        individual_explorer_aggressor_troops
                        .damage(
                            ref guard_defender_troops,
                            defender_biome,
                            troop_stamina_config,
                            troop_damage_config,
                            current_tick,
                        );

                    if explorer_stamina_loss > max_explorer_stamina_loss {
                        max_explorer_stamina_loss = explorer_stamina_loss;
                    }

                    // apply damage to guard slot
                    let mut guard_damage_applied = troop_damage_config.damage_raid_percent_num.into()
                        * damage_dealt_to_guard
                        / PercentageValueImpl::_100().into();
                    // add one and make sure it is precise
                    guard_damage_applied += RESOURCE_PRECISION - (guard_damage_applied % RESOURCE_PRECISION);
                    guard_defender_troops.count -= core::cmp::min(guard_defender_troops.count, guard_damage_applied);

                    // // deduct stamina spent
                    // guard_defender_troops
                    //     .stamina
                    //     .spend(
                    //         guard_defender_troops.category,
                    //         troop_stamina_config,
                    //         troop_stamina_config.stamina_attack_req.into(),
                    //         current_tick,
                    //         false,
                    //     );

                    // update structure guard
                    if guard_defender_troops.count.is_zero() {
                        // delete guard
                        iGuardImpl::delete(
                            ref world,
                            structure_id,
                            ref guarded_structure,
                            ref guard_defender,
                            ref guard_defender_troops,
                            current_tick.try_into().unwrap(),
                            *structure_non_zero_guard_slots.at(i),
                            current_tick,
                        );
                    } else {
                        // update structure guard
                        guard_defender
                            .to_slot(
                                *structure_non_zero_guard_slots.at(i),
                                guard_defender_troops,
                                guard_defender_troops_destroyed_tick.into(),
                            );
                        StructureTroopGuardStoreImpl::store(ref guard_defender, ref world, structure_id);
                    }

                    sum_damage_to_explorer += damage_dealt_to_explorer;
                    sum_damage_to_guards += damage_dealt_to_guard;

                    structure_non_zero_guard_slots_damage_dealt.append(damage_dealt_to_explorer);
                };

                // apply damage to explorer troops
                let mut explorer_damage_received = 0;
                for damage in structure_non_zero_guard_slots_damage_dealt {
                    // note: damage received by explorer is limited by number of troops
                    //       used to enter each battle
                    explorer_damage_received += core::cmp::min(damage, individual_explorer_aggressor_troops.count);
                };

                let mut explorer_damage_applied = troop_damage_config.damage_raid_percent_num.into()
                    * explorer_damage_received
                    / PercentageValueImpl::_100().into();
                // add one and make sure it is precise
                explorer_damage_applied += RESOURCE_PRECISION - (explorer_damage_applied % RESOURCE_PRECISION);
                let explorer_troops_lost = core::cmp::min(explorer_aggressor_troops.count, explorer_damage_applied);
                explorer_aggressor_troops.count -= explorer_troops_lost;
                // update explorer capacity
                iExplorerImpl::update_capacity(ref world, explorer_id, explorer_troops_lost, false);

                // deduct stamina spent by explorer
                explorer_aggressor_troops
                    .stamina
                    .spend(
                        explorer_aggressor_troops.category,
                        explorer_aggressor_troops.tier,
                        troop_stamina_config,
                        max_explorer_stamina_loss,
                        current_tick,
                        true,
                    );

                // update explorer
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
                            ref world, explorer_aggressor.owner,
                        );
                        let mut explorer_aggressor_structure_explorers_list: Array<ID> =
                            StructureTroopExplorerStoreImpl::retrieve(
                            ref world, explorer_aggressor.owner,
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
            if structure_non_zero_guard_slots.len().is_non_zero() {
                let raid_outcome = iTroopImpl::raid_outcome(sum_damage_to_guards, sum_damage_to_explorer);
                match raid_outcome {
                    TroopRaidOutcome::Success => { raid_success = true },
                    TroopRaidOutcome::Failure => { raid_success = false },
                    TroopRaidOutcome::Chance => {
                        let vrf_provider: starknet::ContractAddress = WorldConfigUtilImpl::get_member(
                            world, selector!("vrf_provider_address"),
                        );
                        let vrf_seed: u256 = VRFImpl::seed(starknet::get_caller_address(), vrf_provider);
                        raid_success = iTroopImpl::raid(sum_damage_to_guards, sum_damage_to_explorer, vrf_seed);
                    },
                }
            }

            // steal resources
            if raid_success {
                let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, structure_id);
                let mut explorer_weight: Weight = WeightStoreImpl::retrieve(ref world, explorer_id);
                iResourceTransferImpl::structure_to_troop_raid_instant(
                    ref world, structure_id, ref structure_weight, explorer_id, ref explorer_weight, steal_resources,
                );
                structure_weight.store(ref world, structure_id);
                explorer_weight.store(ref world, explorer_id);

                // grant raid achievement
                let explorer_structure_owner_address: starknet::ContractAddress = StructureOwnerStoreImpl::retrieve(
                    ref world, explorer_aggressor.owner,
                );
                AchievementTrait::progress(
                    world,
                    explorer_structure_owner_address.into(),
                    Tasks::SUCCESSFUL_RAID,
                    1,
                    starknet::get_block_timestamp(),
                );
            };

            world
                .emit_event(
                    @ExplorerRaidEvent {
                        explorer_id, structure_id, success: raid_success, timestamp: starknet::get_block_timestamp(),
                    },
                )
        }
    }
}
