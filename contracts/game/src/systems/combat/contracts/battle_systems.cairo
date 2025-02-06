// use achievement::store::{Store, StoreTrait};
// use dojo::event::EventStorage;
// use dojo::model::ModelStorage;
// use dojo::world::WorldStorage;
// use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
// use s1_eternum::alias::ID;
// use s1_eternum::models::config::{TroopConfig, TroopConfigImpl, TroopConfigTrait};


// use s1_eternum::models::movable::{Movable, MovableTrait};
// use s1_eternum::models::quantity::{Quantity};
// use s1_eternum::models::{
//     combat::{
//         Army, ArmyTrait, TroopsImpl, TroopsTrait, Health, HealthImpl, HealthTrait, BattleImpl, BattleTrait, Protector,
//         Protectee, ProtecteeTrait, BattleHealthTrait, BattleEscrowImpl,
//     },
// };
// use s1_eternum::models::{combat::{Troops, Battle, BattleSide}};
// use s1_eternum::utils::tasks::index::{Task, TaskTrait};


// #[starknet::interface]
// trait IBattleSystems<T> {
//     fn attack_explorer_vs_explorer(ref self: T, aggressor_id: ID, defender_id: ID, defender_direction: Direction);
//     fn attack_explorer_vs_guard(ref self: T, explorer_id: ID, structure_id: ID, structure_direction: Direction);
//     fn attack_guard_vs_explorer(ref self: T, structure_id: ID, explorer_id: ID, explorer_direction: Direction);
// }


// #[dojo::contract]
// mod battle_systems {
//     use achievement::store::{Store, StoreTrait};
//     use dojo::event::EventStorage;
//     use dojo::model::ModelStorage;

//     use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait, WorldStorage, WorldStorageTrait};
//     use s1_eternum::alias::ID;



//     #[generate_trait]
//     impl InternalBattleImpl of InternalBattleTrait {
//         fn attack(ref self: ContractState, A: Troops, B: Troops) {}
//         fn delete_dead(ref self: ContractState, explorer_id: ID) {}
//     }

//     #[abi(embed_v0)]
//     impl BattleSystemsImpl of IBattleSystems<ContractState> {
//         fn attack_explorer_vs_explorer(
//             ref self: ContractState, 
//             aggressor_id: ID, 
//             defender_id: ID, 
//             defender_direction: Direction
//         ) {
//             let mut world = self.world(DEFAULT_NS());
//             SeasonImpl::assert_season_is_not_over(world);

//             // ensure caller owns aggressor
//             let explorer_aggressor: ExplorerTroops = world.read_model(aggressor_id);
//             assert!(explorer_aggressor.owner.is_caller_owner(world), "caller does not own aggressor");

//             // ensure aggressor has troops
//             assert!(explorer_aggressor.troops.health.is_non_zero(), "aggressor has no troops");

//             // ensure defender has troops
//             let explorer_defender: ExplorerTroops = world.read_model(defender_id);
//             assert!(explorer_defender.troops.health.is_non_zero(), "defender has no troops");

//             // ensure both explorers are adjacent to each other
//             assert!(
//                 explorer_aggressor.coord.neighbour(defender_direction) == explorer_defender.coord, 
//                     "explorers are not adjacent"
//             );

//             // ensure both explorers have troops
//             assert!(explorer_defender.troops.health.is_zero(), "defender has troops");

//             // aggressor attacks defender
//             let explorer_aggressor_troops: Troops = explorer_aggressor.troops;
//             let explorer_defender_troops: Troops = explorer_defender.troops;
//             explorer_aggressor_troops.attack(explorer_defender_troops);

//             // update both explorers
//             explorer_aggressor.troops = explorer_aggressor_troops;
//             explorer_defender.troops = explorer_defender_troops;
//             world.write_model(@explorer_aggressor);
//             world.write_model(@explorer_defender);

//             // todo: delete explorer if either dies or both die..ie delete troop and occupied
//         }


//         fn attack_explorer_vs_guard(
//             ref self: ContractState, 
//             explorer_id: ID, 
//             structure_id: ID, 
//             structure_direction: Direction
//         ) {
//             let mut world = self.world(DEFAULT_NS());
//             SeasonImpl::assert_season_is_not_over(world);

//             // ensure caller owns aggressor
//             let explorer_aggressor: ExplorerTroops = world.read_model(explorer_id);
//             assert!(explorer_aggressor.owner.is_caller_owner(world), "caller does not own aggressor");

//             // ensure aggressor has troops
//             assert!(explorer_aggressor.troops.health.is_non_zero(), "aggressor has no troops");

//             // ensure structure guard has troops (?? what layer)
//             let guard_defender: GuardTroops = world.read_model(structure_id);
//             let guard_troops: Troops = guard_defender.get_current_slot();
//             assert!(guard_troops.health.is_non_zero(), "defender has no troops");

//             // ensure explorer is adjacent to structure
//             let guarded_structure: Structure = world.read_model(structure_id);
//             assert!(
//                 explorer_aggressor.coord.neighbour(structure_direction) == guarded_structure.coord, 
//                     "explorer is not adjacent to structure"
//             );


//             // aggressor attacks defender
//             let explorer_aggressor_troops: Troops = explorer_aggressor.troops;
//             explorer_aggressor_troops.attack(guard_troops);

//             // update explorer
//             explorer_aggressor.troops = explorer_aggressor_troops;
//             world.write_model(@explorer_aggressor);

//             guard_defender.set_current_slot(guard_troops);
//             // if slot is defeated, update defeated_at and defeated_slot

//             world.write_model(@explorer_defender);


//             // todo: emit full event
//             // todo: claim if defeated
            
//             // // [Achievement] Claim either a realm, bank or fragment mine
//             // match structure.category {
//             //     StructureCategory::Realm => {
//             //         let player_id: felt252 = claimer.into();
//             //         let task_id: felt252 = Task::Conqueror.identifier();
//             //         let mut store = StoreTrait::new(world);
//             //         store.progress(player_id, task_id, 1, starknet::get_block_timestamp());
//             //     },
//             //     StructureCategory::Bank => {
//             //         let player_id: felt252 = claimer.into();
//             //         let task_id: felt252 = Task::Ruler.identifier();
//             //         let mut store = StoreTrait::new(world);
//             //         store.progress(player_id, task_id, 1, starknet::get_block_timestamp());
//             //     },
//             //     StructureCategory::FragmentMine => {
//             //         let player_id: felt252 = claimer.into();
//             //         let task_id: felt252 = Task::Claimer.identifier();
//             //         let mut store = StoreTrait::new(world);
//             //         store.progress(player_id, task_id, 1, starknet::get_block_timestamp());
//             //     },
//             //     _ => {},
//             // }


//             // todo: delete explorer if either dies or both die..ie delete troop and occupied

//         }


//         fn attack_guard_vs_explorer(
//             ref self: ContractState, 
//             structure_id: ID, 
//             explorer_id: ID, 
//             explorer_direction: Direction
//         ) {
//             let mut world = self.world(DEFAULT_NS());
//             SeasonImpl::assert_season_is_not_over(world);

//             // ensure caller owns aggressor
//             let guard_aggressor: GuardTroops = world.read_model(structure_id);
//             assert!(guard_aggressor.owner.is_caller_owner(world), "caller does not own aggressor");

//             // ensure aggressor has troops
//             assert!(guard_aggressor.troops.health.is_non_zero(), "aggressor has no troops");

//             // ensure structure guard has troops (?? what layer)
//             let explorer_defender: ExplorerTroops = world.read_model(explorer_id);
//             assert!(explorer_defender.troops.health.is_non_zero(), "defender has no troops");

//             // ensure explorer is adjacent to structure
//             let guarded_structure: Structure = world.read_model(structure_id);
//             assert!(
//                 explorer_defender.coord.neighbour(explorer_direction) == guarded_structure.coord, 
//                 "explorer is not adjacent to structure"
//             );


//             // aggressor attacks defender
//             let mut guard_aggressor_troops: Troops = guard_aggressor.get_current_slot();
//             guard_aggressor_troops.attack(explorer_defender.troops);

//             // update guard
//             guard_aggressor.set_current_slot(guard_aggressor_troops);
//             // if slot is defeated, update defeated_at and defeated_slot
//             world.write_model(@guard_aggressor);


//             // update explorer
//             explorer_defender.troops = explorer_defender_troops;
//             world.write_model(@explorer_defender);

//             // todo: delete explorer if either dies or both die

//         }
//     }
// }
