#[starknet::interface]
trait INpcSystems<TContractState> {
    fn spawn_npc(self: @TContractState, realm_entity_id: felt252) -> felt252;
}

