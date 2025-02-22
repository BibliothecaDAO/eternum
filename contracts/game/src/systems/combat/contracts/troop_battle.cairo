use s1_eternum::alias::ID;
use s1_eternum::models::position::{Direction};


#[starknet::interface]
trait ITroopBattleSystems<T> {
    fn attack_explorer_vs_explorer(ref self: T, aggressor_id: ID, defender_id: ID, defender_direction: Direction);
    fn attack_explorer_vs_guard(ref self: T, explorer_id: ID, structure_id: ID, structure_direction: Direction);
}


#[dojo::contract]
mod troop_battle_systems {
    use core::num::traits::zero::Zero;

    use dojo::model::ModelStorage;
    use s1_eternum::alias::ID;
    use s1_eternum::constants::DEFAULT_NS;
    use s1_eternum::models::config::{CombatConfigImpl, TickImpl, TroopDamageConfig, TroopStaminaConfig};
    use s1_eternum::models::owner::{OwnerAddressTrait};
    use s1_eternum::models::position::{CoordTrait, Direction};
    use s1_eternum::models::season::SeasonImpl;
    use s1_eternum::models::structure::{
        StructureBase, StructureBaseImpl, StructureBaseStoreImpl, StructureCategory, StructureTroopExplorerStoreImpl,
        StructureTroopGuardStoreImpl,
    };
    use s1_eternum::models::troop::{ExplorerTroops, GuardImpl, GuardSlot, GuardTroops, Troops, TroopsImpl, TroopsTrait};
    use s1_eternum::systems::utils::{troop::{iExplorerImpl, iTroopImpl}};
    use s1_eternum::utils::map::biomes::{Biome, get_biome};


    #[abi(embed_v0)]
    impl TroopBattleSystemsImpl of super::ITroopBattleSystems<ContractState> {
        fn attack_explorer_vs_explorer(
            ref self: ContractState, aggressor_id: ID, defender_id: ID, defender_direction: Direction,
        ) {
            let mut world = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // ensure caller owns aggressor
            let mut explorer_aggressor: ExplorerTroops = world.read_model(aggressor_id);
            let mut explorer_aggressor_owner_structure: StructureBase = StructureBaseStoreImpl::retrieve(
                ref world, explorer_aggressor.owner,
            );
            explorer_aggressor_owner_structure.owner.assert_caller_owner();

            // ensure aggressor has troops
            assert!(explorer_aggressor.troops.count.is_non_zero(), "aggressor has no troops");

            // ensure defender has troops
            let mut explorer_defender: ExplorerTroops = world.read_model(defender_id);
            assert!(explorer_defender.troops.count.is_non_zero(), "defender has no troops");

            // ensure both explorers are adjacent to each other
            assert!(
                explorer_aggressor.coord.neighbor(defender_direction) == explorer_defender.coord,
                "explorers are not adjacent",
            );

            // ensure both explorers have troops
            assert!(explorer_defender.troops.count.is_zero(), "defender has troops");

            // aggressor attacks defender
            let troop_damage_config: TroopDamageConfig = CombatConfigImpl::troop_damage_config(ref world);
            let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
            let tick = TickImpl::get_tick_config(ref world);
            let mut explorer_aggressor_troops: Troops = explorer_aggressor.troops;
            let mut explorer_defender_troops: Troops = explorer_defender.troops;
            let defender_biome: Biome = get_biome(explorer_defender.coord.x.into(), explorer_defender.coord.y.into());
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

            // save or delete explorer
            if explorer_aggressor_troops.count.is_zero() {
                let mut explorer_aggressor_structure_explorers_list: Array<ID> =
                    StructureTroopExplorerStoreImpl::retrieve(
                    ref world, explorer_aggressor.owner,
                )
                    .into();
                iExplorerImpl::explorer_delete(
                    ref world,
                    ref explorer_aggressor,
                    explorer_aggressor_structure_explorers_list,
                    ref explorer_aggressor_owner_structure,
                    explorer_aggressor.owner,
                );
            } else {
                world.write_model(@explorer_aggressor);
            }

            if explorer_defender_troops.count.is_zero() {
                let mut explorer_defender_owner_structure: StructureBase = StructureBaseStoreImpl::retrieve(
                    ref world, explorer_defender.owner,
                );
                let mut explorer_defender_structure_explorers_list: Array<ID> =
                    StructureTroopExplorerStoreImpl::retrieve(
                    ref world, explorer_defender.owner,
                )
                    .into();
                iExplorerImpl::explorer_delete(
                    ref world,
                    ref explorer_defender,
                    explorer_defender_structure_explorers_list,
                    ref explorer_defender_owner_structure,
                    explorer_defender.owner,
                );
            } else {
                world.write_model(@explorer_defender);
            }
        }


        fn attack_explorer_vs_guard(
            ref self: ContractState, explorer_id: ID, structure_id: ID, structure_direction: Direction,
        ) {
            let mut world = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // ensure caller owns aggressor
            let mut explorer_aggressor: ExplorerTroops = world.read_model(explorer_id);
            let mut explorer_aggressor_owner_structure: StructureBase = StructureBaseStoreImpl::retrieve(
                ref world, explorer_aggressor.owner,
            );
            explorer_aggressor_owner_structure.owner.assert_caller_owner();

            // ensure aggressor has troops
            assert!(explorer_aggressor.troops.count.is_non_zero(), "aggressor has no troops");

            // ensure structure guard has troops (?? what layer)
            let mut guarded_structure: StructureBase = StructureBaseStoreImpl::retrieve(ref world, structure_id);
            assert!(guarded_structure.category != StructureCategory::None.into(), "defender is not a structure");

            // get guard troops
            let mut guard_defender: GuardTroops = StructureTroopGuardStoreImpl::retrieve(ref world, structure_id);
            let guard_slot: Option<GuardSlot> = guard_defender.next_attack_slot();

            if guard_slot.is_none() {
                panic!("defender has no troops");
            }
            let guard_slot: GuardSlot = guard_slot.unwrap();

            // get guard troops
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
            explorer_aggressor_troops
                .attack(ref guard_troops, defender_biome, troop_stamina_config, troop_damage_config, tick.current());

            // if slot is defeated, update defeated_at and defeated_slot
            if guard_troops.count.is_zero() {
                guard_destroyed_tick = tick.current().try_into().unwrap();
            }

            // update guard
            guard_defender.to_slot(guard_slot, guard_troops, guard_destroyed_tick.try_into().unwrap());
            StructureTroopGuardStoreImpl::store(ref guard_defender, ref world, structure_id);

            // update explorer
            explorer_aggressor.troops = explorer_aggressor_troops;
            if explorer_aggressor_troops.count.is_zero() {
                let mut explorer_aggressor_owner_structure: StructureBase = StructureBaseStoreImpl::retrieve(
                    ref world, explorer_aggressor.owner,
                );
                let mut explorer_aggressor_structure_explorers_list: Array<ID> =
                    StructureTroopExplorerStoreImpl::retrieve(
                    ref world, explorer_aggressor.owner,
                )
                    .into();
                iExplorerImpl::explorer_delete(
                    ref world,
                    ref explorer_aggressor,
                    explorer_aggressor_structure_explorers_list,
                    ref explorer_aggressor_owner_structure,
                    explorer_aggressor.owner,
                );
            } else {
                world.write_model(@explorer_aggressor);
            }
        }
    }
}
