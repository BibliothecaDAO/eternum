#[starknet::interface]
trait INpcSystems<TContractState> {
    fn spawn_npc(self: @TContractState, realm_id: felt252);
}

