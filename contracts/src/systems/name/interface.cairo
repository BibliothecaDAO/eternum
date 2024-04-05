use dojo::world::IWorldDispatcher;

#[dojo::interface]
trait INameSystems {
    fn set_address_name(name: felt252);
}
