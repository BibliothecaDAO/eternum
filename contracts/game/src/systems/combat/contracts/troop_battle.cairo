use s1_eternum::alias::ID;
use s1_eternum::models::position::{Direction};
use s1_eternum::models::troop::GuardSlot;


#[starknet::interface]
pub trait ITroopBattleSystems<T> {
    fn attack_explorer_vs_explorer(
        ref self: T,
        aggressor_id: ID,
        defender_id: ID,
        defender_direction: Direction,
        steal_resources: Span<(u8, u128)>,
    );
    fn attack_explorer_vs_guard(ref self: T, explorer_id: ID, structure_id: ID, structure_direction: Direction);
    fn attack_guard_vs_explorer(
        ref self: T, structure_id: ID, structure_guard_slot: GuardSlot, explorer_id: ID, explorer_direction: Direction,
    );
}


#[dojo::contract]
pub mod troop_battle_systems {
    use core::num::traits::zero::Zero;
    use dojo::model::ModelStorage;
    use s1_eternum::alias::ID;
    use s1_eternum::constants::{DAYDREAMS_AGENT_ID, DEFAULT_NS};
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
    use s1_eternum::models::troop::{ExplorerTroops, GuardImpl, GuardSlot, GuardTroops, Troops, TroopsImpl, TroopsTrait};
    use s1_eternum::models::weight::Weight;
    use s1_eternum::systems::utils::{
        resource::{iResourceTransferImpl}, structure::iStructureImpl, troop::{iExplorerImpl, iGuardImpl, iTroopImpl},
    };
    use s1_eternum::utils::map::biomes::{Biome, get_biome};
    use s1_eternum::utils::random::{VRFImpl};
    use super::super::super::super::super::models::troop::GuardTrait;


    #[abi(embed_v0)]
    pub impl TroopBattleSystemsImpl of super::ITroopBattleSystems<ContractState> {
        fn attack_explorer_vs_explorer(
            ref self: ContractState,
            aggressor_id: ID,
            defender_id: ID,
            defender_direction: Direction,
            steal_resources: Span<(u8, u128)>,
        ) {
            let mut world = self.world(DEFAULT_NS());

            // ensure season is open
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // ensure caller owns aggressor
            let mut explorer_aggressor: ExplorerTroops = world.read_model(aggressor_id);
            explorer_aggressor.assert_caller_structure_or_agent_owner(ref world);

            // ensure caller does not own defender
            let mut explorer_defender: ExplorerTroops = world.read_model(defender_id);
            explorer_defender.assert_caller_not_structure_or_agent_owner(ref world);

            // ensure aggressor has troops
            assert!(explorer_aggressor.troops.count.is_non_zero(), "aggressor has no troops");

            // ensure defender has troops
            let mut explorer_defender: ExplorerTroops = world.read_model(defender_id);
            assert!(explorer_defender.troops.count.is_non_zero(), "defender has no troops");

            // ensure both explorers are adjacent to each other
            assert!(
                explorer_defender.coord == explorer_aggressor.coord.neighbor(defender_direction),
                "explorers are not adjacent",
            );

            // aggressor attacks defender
            let troop_damage_config: TroopDamageConfig = CombatConfigImpl::troop_damage_config(ref world);
            let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
            let tick = TickImpl::get_tick_config(ref world);
            let mut explorer_aggressor_troops: Troops = explorer_aggressor.troops;
            let mut explorer_defender_troops: Troops = explorer_defender.troops;
            let defender_biome: Biome = get_biome(explorer_defender.coord.x.into(), explorer_defender.coord.y.into());
            let explorer_aggressor_troop_count_before_attack = explorer_aggressor_troops.count;
            let explorer_defender_troop_count_before_attack = explorer_defender_troops.count;
            explorer_aggressor_troops
                .attack(
                    ref explorer_defender_troops,
                    defender_biome,
                    troop_stamina_config,
                    troop_damage_config,
                    tick.current(),
                );

            // update both explorers
            explorer_aggressor.troops = explorer_aggressor_troops;
            explorer_defender.troops = explorer_defender_troops;

            // update aggressor troop capacity
            iExplorerImpl::update_capacity(
                ref world,
                aggressor_id,
                explorer_aggressor_troop_count_before_attack - explorer_aggressor.troops.count,
                false,
            );

            // update defender troop capacity
            iExplorerImpl::update_capacity(
                ref world,
                defender_id,
                explorer_defender_troop_count_before_attack - explorer_defender.troops.count,
                false,
            );

            // save or delete explorer
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

            if explorer_defender_troops.count.is_zero() {
                // steal resources from defender if dead
                let mut explorer_aggressor_weight: Weight = WeightStoreImpl::retrieve(ref world, aggressor_id);
                let mut explorer_defender_weight: Weight = WeightStoreImpl::retrieve(ref world, defender_id);
                iResourceTransferImpl::troop_to_troop_instant(
                    ref world,
                    explorer_defender,
                    ref explorer_defender_weight,
                    explorer_aggressor,
                    ref explorer_aggressor_weight,
                    steal_resources,
                );
                explorer_aggressor_weight.store(ref world, aggressor_id);
                explorer_defender_weight.store(ref world, defender_id);

                // delete defender
                if explorer_defender.owner == DAYDREAMS_AGENT_ID {
                    iExplorerImpl::explorer_from_agent_delete(ref world, ref explorer_defender);
                } else {
                    let mut explorer_defender_owner_structure: StructureBase = StructureBaseStoreImpl::retrieve(
                        ref world, explorer_defender.owner,
                    );
                    let mut explorer_defender_structure_explorers_list: Array<ID> =
                        StructureTroopExplorerStoreImpl::retrieve(
                        ref world, explorer_defender.owner,
                    )
                        .into();
                    iExplorerImpl::explorer_from_structure_delete(
                        ref world,
                        ref explorer_defender,
                        explorer_defender_structure_explorers_list,
                        ref explorer_defender_owner_structure,
                        explorer_defender.owner,
                    );
                }
            } else {
                world.write_model(@explorer_defender);
            }
        }


        fn attack_explorer_vs_guard(
            ref self: ContractState, explorer_id: ID, structure_id: ID, structure_direction: Direction,
        ) {
            let mut world = self.world(DEFAULT_NS());

            // ensure season is open
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

            // get guard troops
            let mut guard_defender: GuardTroops = StructureTroopGuardStoreImpl::retrieve(ref world, structure_id);
            let guard_slot: Option<GuardSlot> = guard_defender
                .next_attack_slot(guarded_structure.troop_max_guard_count.into());

            // claim structure if there are no guard troops. it is tried again after the attack
            if guard_slot.is_none() {
                iStructureImpl::claim(ref world, ref guarded_structure, ref explorer_aggressor, structure_id);
                return;
            }

            // get guard troops
            let guard_slot: GuardSlot = guard_slot.unwrap();
            let (mut guard_troops, mut guard_destroyed_tick): (Troops, u32) = guard_defender.from_slot(guard_slot);
            assert!(guard_troops.count.is_non_zero(), "defender has no troops");

            // ensure explorer is adjacent to structure
            assert!(
                explorer_aggressor.coord.neighbor(structure_direction) == guarded_structure.coord(),
                "explorer is not adjacent to structure",
            );

            // aggressor attacks defender
            let mut explorer_aggressor_troops: Troops = explorer_aggressor.troops;
            let defender_biome: Biome = get_biome(
                guarded_structure.coord().x.into(), guarded_structure.coord().y.into(),
            );
            let troop_damage_config: TroopDamageConfig = CombatConfigImpl::troop_damage_config(ref world);
            let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
            let tick = TickImpl::get_tick_config(ref world);
            let explorer_aggressor_troop_count_before_attack = explorer_aggressor_troops.count;
            explorer_aggressor_troops
                .attack(ref guard_troops, defender_biome, troop_stamina_config, troop_damage_config, tick.current());

            // update explorer
            explorer_aggressor.troops = explorer_aggressor_troops;

            // update explorer troop capacity
            iExplorerImpl::update_capacity(
                ref world,
                explorer_id,
                explorer_aggressor_troop_count_before_attack - explorer_aggressor.troops.count,
                false,
            );

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

            // update structure guard
            if guard_troops.count.is_zero() {
                // delete guard
                iGuardImpl::delete(
                    ref world,
                    structure_id,
                    ref guarded_structure,
                    ref guard_defender,
                    ref guard_troops,
                    tick.current().try_into().unwrap(),
                    guard_slot,
                    tick.current(),
                );

                // try again to claim structure if there are no guard troops after the attack
                // and explorer is alive
                if explorer_aggressor.troops.count.is_non_zero() {
                    let guard_slot: Option<GuardSlot> = guard_defender
                        .next_attack_slot(guarded_structure.troop_max_guard_count.into());
                    if guard_slot.is_none() {
                        iStructureImpl::claim(ref world, ref guarded_structure, ref explorer_aggressor, structure_id);
                    }
                }
            } else {
                // update structure guard
                guard_defender.to_slot(guard_slot, guard_troops, guard_destroyed_tick.into());
                StructureTroopGuardStoreImpl::store(ref guard_defender, ref world, structure_id);
            }
        }


        fn attack_guard_vs_explorer(
            ref self: ContractState,
            structure_id: ID,
            structure_guard_slot: GuardSlot,
            explorer_id: ID,
            explorer_direction: Direction,
        ) {
            let mut world = self.world(DEFAULT_NS());
            // ensure season is open
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // ensure caller structure owns aggressor
            let structure_aggressor_owner: starknet::ContractAddress = StructureOwnerStoreImpl::retrieve(
                ref world, structure_id,
            );
            structure_aggressor_owner.assert_caller_owner();

            // ensure caller does not own defender
            let mut explorer_defender: ExplorerTroops = world.read_model(explorer_id);
            // let explorer_defender_owner: starknet::ContractAddress = StructureOwnerStoreImpl::retrieve(
            //     ref world, explorer_defender.owner,
            // );
            // explorer_defender_owner.assert_caller_not_owner();

            // ensure explorer has troops
            assert!(explorer_defender.troops.count.is_non_zero(), "defender has no troops");

            // ensure structure is allowed to use guard slot
            let mut structure_guards_aggressor: GuardTroops = StructureTroopGuardStoreImpl::retrieve(
                ref world, structure_id,
            );
            let mut structure_aggressor_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, structure_id);
            structure_guards_aggressor
                .assert_functional_slot(structure_guard_slot, structure_aggressor_base.troop_max_guard_count.into());

            // ensure guard slot is not dead
            let (mut structure_guard_aggressor_troops, mut structure_guard_destroyed_tick): (Troops, u32) =
                structure_guards_aggressor
                .from_slot(structure_guard_slot);
            assert!(structure_guard_aggressor_troops.count.is_non_zero(), "guard slot is dead");

            // ensure structure is not cloaked
            let tick = TickImpl::get_tick_config(ref world);
            let battle_config: BattleConfig = WorldConfigUtilImpl::get_member(world, selector!("battle_config"));
            assert!(
                StructureBaseImpl::is_not_cloaked(structure_aggressor_base, battle_config, tick),
                "your structure is cloaked from attacks, so you cannot attack as well",
            );

            // ensure structure is adjacent to explorer
            assert!(
                explorer_defender.coord == structure_aggressor_base.coord().neighbor(explorer_direction),
                "structure is not adjacent to explorer",
            );

            // aggressor attacks defender
            let defender_biome: Biome = get_biome(explorer_defender.coord.x.into(), explorer_defender.coord.y.into());
            let troop_damage_config: TroopDamageConfig = CombatConfigImpl::troop_damage_config(ref world);
            let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
            let mut explorer_defender_troops = explorer_defender.troops;
            let explorer_defender_troop_count_before_attack = explorer_defender_troops.count;
            structure_guard_aggressor_troops
                .attack(
                    ref explorer_defender_troops,
                    defender_biome,
                    troop_stamina_config,
                    troop_damage_config,
                    tick.current(),
                );

            // update explorer
            explorer_defender.troops = explorer_defender_troops;

            // update explorer troop capacity
            iExplorerImpl::update_capacity(
                ref world,
                explorer_id,
                explorer_defender_troop_count_before_attack - explorer_defender.troops.count,
                false,
            );

            if explorer_defender.troops.count.is_zero() {
                if explorer_defender.owner == DAYDREAMS_AGENT_ID {
                    iExplorerImpl::explorer_from_agent_delete(ref world, ref explorer_defender);
                } else {
                    let mut explorer_defender_owner_structure: StructureBase = StructureBaseStoreImpl::retrieve(
                        ref world, explorer_defender.owner,
                    );
                    let mut explorer_defender_structure_explorers_list: Array<ID> =
                        StructureTroopExplorerStoreImpl::retrieve(
                        ref world, explorer_defender.owner,
                    )
                        .into();
                    iExplorerImpl::explorer_from_structure_delete(
                        ref world,
                        ref explorer_defender,
                        explorer_defender_structure_explorers_list,
                        ref explorer_defender_owner_structure,
                        explorer_defender.owner,
                    );
                }
            } else {
                world.write_model(@explorer_defender);
            }

            // update structure guard
            if structure_guard_aggressor_troops.count.is_zero() {
                // delete guard
                iGuardImpl::delete(
                    ref world,
                    structure_id,
                    ref structure_aggressor_base,
                    ref structure_guards_aggressor,
                    ref structure_guard_aggressor_troops,
                    tick.current().try_into().unwrap(),
                    structure_guard_slot,
                    tick.current(),
                );

                // try to claim structure if there are no guard troops after the attack
                // and explorer is alive
                if explorer_defender.troops.count.is_non_zero() {
                    let guard_slot: Option<GuardSlot> = structure_guards_aggressor
                        .next_attack_slot(structure_aggressor_base.troop_max_guard_count.into());
                    if guard_slot.is_none() {
                        iStructureImpl::claim(
                            ref world, ref structure_aggressor_base, ref explorer_defender, structure_id,
                        );
                    }
                }
            } else {
                // update structure guard
                structure_guards_aggressor
                    .to_slot(
                        structure_guard_slot, structure_guard_aggressor_troops, structure_guard_destroyed_tick.into(),
                    );
                StructureTroopGuardStoreImpl::store(ref structure_guards_aggressor, ref world, structure_id);
            }
        }
    }
}
