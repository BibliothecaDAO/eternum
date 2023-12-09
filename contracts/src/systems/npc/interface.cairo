use dojo::world::IWorldDispatcher;

#[starknet::interface]
trait INpc<TContractState> {
    fn spawn_npc(self: @TContractState, world: IWorldDispatcher, realm_id: felt252) -> felt252;
}
