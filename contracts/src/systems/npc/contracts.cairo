#[dojo::contract]
mod actions {
    // use eternum::models::owner::Owner;
    // use eternum::models::realm::{Realm, RealmTrait};
    use eternum::models::npc::{Npc, random_mood, random_sex};
    use starknet::info::BlockInfo;
    use eternum::systems::npc::interface::INpc;

    #[derive(Drop, starknet::Event)]
    struct NpcSpawned {
        npc: Npc,
    }

    #[derive(Drop, starknet::Event)]
    struct NpcKilled {
        npc: Npc,
    }

    // declaring custom event struct
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        NpcSpawned: NpcSpawned,
        NpcKilled: NpcKilled
    }

    #[external(v0)]
    impl NpcImpl of INpc<ContractState> {
        fn spawnNpc(self: @ContractState, realm_id: felt252) {
            // Check how much ressources the user has before creating a villager, start at 0 at the start
            // Check if the caller_address is the owner_of the realm 
            let world = self.world_dispatcher.read();

            // Uncomment when added to the Realms repo
            // let (realm, owner) = get!(world, realm_id, (Realm, Owner));
            let block: BlockInfo = starknet::get_block_info().unbox();
            let sex = random_sex(block.block_number);
            let mood = random_mood(block.block_number);
            set!(world, (Npc { entity_id: world.uuid().into(), realm_id: realm_id, mood, sex }))
        }
    // trigger the mood changes based on when the user clicks on the harvest weat/fish
    }
}
