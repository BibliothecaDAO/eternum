use dojo::world::IWorldDispatcher;

#[starknet::interface]
trait INpc<TContractState> {
        fn spawn_npc(self: @TContractState, world: IWorldDispatcher, realm_id: u128, characteristics: felt252, character_trait: felt252, name: felt252) -> u128;
        fn change_character_trait(
            self: @TContractState,
            world: IWorldDispatcher,
            realm_id: u128,
            npc_id: u128,
            character_trait: felt252,
        );
}
