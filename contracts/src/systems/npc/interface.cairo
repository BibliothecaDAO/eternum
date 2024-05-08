use dojo::world::IWorldDispatcher;

#[dojo::interface]
trait INpc<TContractState> {
    fn spawn_npc(
        realm_entity_id: u128,
        characteristics: felt252,
        character_trait: felt252,
        full_name: felt252,
        signature: Span<felt252>
    ) -> u128;
    fn npc_travel(npc_entity_id: u128, to_realm_entity_id: u128);
    fn welcome_npc(npc_entity_id: u128, into_realm_entity_id: u128);
    fn kick_out_npc(npc_entity_id: u128);
}
