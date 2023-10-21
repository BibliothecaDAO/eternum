#[dojo::contract]
mod npc_systems {
    use eternum::models::owner::Owner;
    use eternum::models::realm::{Realm, RealmTrait};
    use eternum::models::npc::{Npc, random_mood, random_sex};
    use starknet::{info::BlockInfo, ContractAddress};
    use eternum::systems::npc::interface::INpcSystems;

    #[external(v0)]
    impl NpcSystemsImpl of INpcSystems<ContractState> {
        fn spawn_npc(self: @ContractState, realm_entity_id: felt252) -> felt252 {
			let world = self.world_dispatcher.read();

            // Check how much ressources the user has before creating a villager, start at 0 at the start
			let player_id: ContractAddress = starknet::get_caller_address();
			let (realm, owner) = get!(world, realm_entity_id, (Realm, Owner));
			assert(owner.address == player_id, 'Realm does not belong to player');

            let block: BlockInfo = starknet::get_block_info().unbox();
            let sex = random_sex(block.block_number);
            let mood = random_mood(block.block_number);
			let npc_entity_id: felt252 = world.uuid().into();
            set!(world, (Npc { entity_id: npc_entity_id, realm_entity_id, mood, sex }));
			return (npc_entity_id);
        }
    // trigger the mood changes based on when the user clicks on the harvest weat/fish
    }
}
