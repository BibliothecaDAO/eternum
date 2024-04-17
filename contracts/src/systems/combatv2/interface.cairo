use dojo::world::IWorldDispatcher;

use eternum::models::buildings::BuildingCategory;
use eternum::models::position::{Coord, Position, Direction};
use eternum::models::{combatV2::{Fighters}};

#[dojo::interface]
trait ICombatv2Contract<TContractState> {
    fn create_army(entity_id: u128, fighters: Fighters);
    fn merge_army(army_entity_id_a: u128, army_entity_id_b: u128,);
    fn start_battle(army_entity_id: u128, defending_entity_id: u128);
    fn end_battle(battle_entity_id: u128, army_entity_id: u128 );
}

