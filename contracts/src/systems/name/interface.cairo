use dojo::world::IWorldDispatcher;

#[dojo::interface]
trait INameSystems {
    fn set_address_name(name: felt252);
    fn set_entity_name(entity_id: u128, name: felt252);
}
