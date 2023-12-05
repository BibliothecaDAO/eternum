use dojo::world::IWorldDispatcher;
#[starknet::interface]
trait IGuildSystems<TContractState> {
    fn create_guild(
        self: @TContractState, 
        world: IWorldDispatcher, 
        guild_id: felt252
    );
}