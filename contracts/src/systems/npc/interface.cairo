use dojo::world::IWorldDispatcher;
use eternum::models::npc::Mood;

#[starknet::interface]
trait INpc<TContractState> {
    fn spawn_npc(self: @TContractState, world: IWorldDispatcher, realm_entity_id: felt252) -> felt252;
    fn change_mood(self: @TContractState, world: IWorldDispatcher, realm_entity_id: felt252, npc_id: felt252, mood: Mood);
}
