#[dojo::contract]
mod npc_systems {
    
    use starknet::ContractAddress;
    use eternum::constants::NPC_CONFIG_ID;    
    use eternum::models::owner::Owner;
    use eternum::models::realm::{Realm, RealmTrait};
    use eternum::models::npc::{Npc, Sex, Mood, random_mood, random_sex};
    use eternum::models::last_spawned::{LastSpawned, ShouldSpawnImpl};
    use eternum::models::config::NpcConfig;
    use starknet::info::BlockInfo;

    use eternum::systems::npc::interface::INpc;
    use debug::PrintTrait;
    
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
    }

    #[external(v0)]
    impl NpcImpl of INpc<ContractState> {
        fn spawn_npc(self: @ContractState, world: IWorldDispatcher, realm_entity_id: felt252) -> felt252 {
            // Check how much ressources the user has before creating a villager, start at 0 at the start
			let player_id: ContractAddress = starknet::get_caller_address();
			let (realm, owner) = get!(world, realm_entity_id, (Realm, Owner));
			assert(owner.address == player_id, 'Realm does not belong to player');

            let last_spawned = get!(world, realm_entity_id, (LastSpawned));

            let npc_config = get!(world, NPC_CONFIG_ID, (NpcConfig));

            let should_spawn = last_spawned.should_spawn(npc_config.spawn_delay);

            if should_spawn {
                'hey'.print();
                let block: BlockInfo = starknet::get_block_info().unbox();
            
                let sex = random_sex(block.block_number);
                let mood = random_mood(block.block_number);
                let entity_id = world.uuid().into();
                
                set!(world, (Npc { entity_id, realm_entity_id, mood, sex }));
                 entity_id   
            } else {
                let last_spawned_ts: u128 = starknet::get_block_timestamp().into();
                set!(world, (LastSpawned {realm_entity_id, last_spawned_ts}));
                0
            }
        }
    // trigger the mood changes based on when the user clicks on the harvest weat/fish
    }
}
