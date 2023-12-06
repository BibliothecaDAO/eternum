use dojo::world::IWorldDispatcher;
use starknet::ContractAddress;
#[starknet::interface]
trait IGuildSystems<TContractState> {
    fn create_guild(
        self: @TContractState, 
        world: IWorldDispatcher, 
        guild_id: ContractAddress
    );
}