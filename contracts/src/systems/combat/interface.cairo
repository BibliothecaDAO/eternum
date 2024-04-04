use eternum::alias::ID;
use eternum::models::combat::Duty;

use dojo::world::IWorldDispatcher;

#[dojo::interface]
trait ISoldierSystems {
    fn create_soldiers(realm_entity_id: u128, quantity: u128) -> ID;

    fn detach_soldiers(unit_id: u128, detached_quantity: u128) -> ID;

    fn merge_soldiers(merge_into_unit_id: u128, units: Span<(ID, u128)>);

    fn heal_soldiers(unit_id: ID, health_amount: u128);
}

#[dojo::interface]
trait ICombatSystems {
    fn attack(attacker_ids: Span<u128>, target_entity_id: u128);

    fn steal(attacker_id: u128, target_entity_id: u128);
}
