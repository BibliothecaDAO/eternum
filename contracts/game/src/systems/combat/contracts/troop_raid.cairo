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

    use dojo::model::ModelStorage;
    use s1_eternum::alias::ID;
    use s1_eternum::constants::{DAYDREAMS_AGENT_ID, DEFAULT_NS, RESOURCE_PRECISION};
    use s1_eternum::models::config::{
        BattleConfig, CombatConfigImpl, SeasonConfigImpl, TickImpl, TroopDamageConfig, TroopStaminaConfig,
        WorldConfigUtilImpl,
    };
    use s1_eternum::models::owner::{OwnerAddressTrait};
    use s1_eternum::models::position::{CoordTrait, Direction};
    use s1_eternum::models::resource::resource::{ResourceWeightImpl, SingleResourceStoreImpl, WeightStoreImpl};
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
    use s1_eternum::utils::map::biomes::{Biome, get_biome};
    use s1_eternum::utils::random::{VRFImpl};
    use super::super::super::super::super::models::troop::GuardTrait;


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
            SeasonConfigImpl::get(world).assert_started_and_not_over();

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

            // ensure structure is not cloaked
            let tick = TickImpl::get_tick_config(ref world);
            let battle_config: BattleConfig = WorldConfigUtilImpl::get_member(world, selector!("battle_config"));
            assert!(StructureBaseImpl::is_not_cloaked(guarded_structure, battle_config, tick), "structure is cloaked");

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
                    let (damage_dealt_to_guard, damage_dealt_to_explorer) = individual_explorer_aggressor_troops
                        .damage(
                            ref guard_defender_troops,
                            defender_biome,
                            troop_stamina_config,
                            troop_damage_config,
                            current_tick,
                        );

                    // apply damage to guard slot
                    guard_defender_troops.count -= core::cmp::min(guard_defender_troops.count, damage_dealt_to_guard);

                    // deduct stamina spent
                    guard_defender_troops
                        .stamina
                        .spend(
                            guard_defender_troops.category,
                            troop_stamina_config,
                            troop_stamina_config.stamina_attack_req.into(),
                            current_tick,
                            false,
                        );

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

                explorer_aggressor_troops
                    .count -= core::cmp::min(explorer_aggressor_troops.count, explorer_damage_received);

                // deduct stamina spent by explorer
                explorer_aggressor_troops
                    .stamina
                    .spend(
                        explorer_aggressor_troops.category,
                        troop_stamina_config,
                        troop_stamina_config.stamina_attack_req.into(),
                        current_tick,
                        true,
                    );

                // update explorer
                explorer_aggressor.troops = explorer_aggressor_troops;
                if explorer_aggressor_troops.count.is_zero() {
                    if explorer_aggressor.owner == DAYDREAMS_AGENT_ID {
                        iExplorerImpl::explorer_from_agent_delete(ref world, ref explorer_aggressor);
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
                iResourceTransferImpl::structure_to_troop_instant(
                    ref world, structure_id, ref structure_weight, explorer_id, ref explorer_weight, steal_resources,
                );
                structure_weight.store(ref world, structure_id);
                explorer_weight.store(ref world, explorer_id);
            };
        }
    }
}
