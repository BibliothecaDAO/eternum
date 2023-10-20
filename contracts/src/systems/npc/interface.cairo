#[starknet::interface]
trait INpc<TContractState> {
    fn spawnNpc(self: @TContractState, realm_id: felt252);
}

