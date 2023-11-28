use dojo::world::IWorldDispatcher;

#[starknet::interface]
trait INameSystems<TContractState> {
    fn set_address_name(self: @TContractState, world: IWorldDispatcher, name: felt252);
}
