use achievement::store::{Store, StoreTrait};
use dojo::event::EventStorage;
use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use s1_eternum::alias::ID;
use s1_eternum::models::position::{Direction};


#[starknet::interface]
trait ITroopBattleSystems<T> {
    fn attack_explorer_vs_explorer(ref self: T, aggressor_id: ID, defender_id: ID, defender_direction: Direction);
    fn attack_explorer_vs_guard(ref self: T, explorer_id: ID, structure_id: ID, structure_direction: Direction);
}


#[dojo::contract]
mod troop_battle_systems {
    use achievement::store::{Store, StoreTrait};
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;

    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait, WorldStorage, WorldStorageTrait};
    use s1_eternum::alias::ID;
    use s1_eternum::constants::{DEFAULT_NS, WORLD_CONFIG_ID};
    use s1_eternum::models::config::{CombatConfigImpl, TickImpl, TroopDamageConfig, TroopStaminaConfig};
    use s1_eternum::models::owner::{EntityOwnerTrait, OwnerTrait};
    use s1_eternum::models::position::{Coord, CoordTrait, Direction};
    use s1_eternum::models::season::SeasonImpl;
    use s1_eternum::models::structure::{Structure, StructureCategory, StructureTrait};
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
            explorer_aggressor.owner.assert_caller_owner(world);

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
                iExplorerImpl::explorer_delete(ref world, ref explorer_aggressor);
            } else {
                world.write_model(@explorer_aggressor);
            }

            if explorer_defender_troops.count.is_zero() {
                iExplorerImpl::explorer_delete(ref world, ref explorer_defender);
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
            explorer_aggressor.owner.assert_caller_owner(world);

            // ensure aggressor has troops
            assert!(explorer_aggressor.troops.count.is_non_zero(), "aggressor has no troops");

            // ensure structure guard has troops (?? what layer)
            let mut guarded_structure: Structure = world.read_model(structure_id);
            assert!(guarded_structure.category != StructureCategory::None, "defender is not a structure");

            // get guard troops
            let mut guard_defender: GuardTroops = guarded_structure.guards;
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
                explorer_aggressor.coord.neighbor(structure_direction) == guarded_structure.coord,
                "explorer is not adjacent to structure",
            );

            // aggressor attacks defender
            let mut explorer_aggressor_troops: Troops = explorer_aggressor.troops;
            let defender_biome: Biome = get_biome(guarded_structure.coord.x.into(), guarded_structure.coord.y.into());
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
            world.write_model(@guarded_structure);

            // update explorer
            explorer_aggressor.troops = explorer_aggressor_troops;
            if explorer_aggressor_troops.count.is_zero() {
                iExplorerImpl::explorer_delete(ref world, ref explorer_aggressor);
            } else {
                world.write_model(@explorer_aggressor);
            }
        }
    }
}
