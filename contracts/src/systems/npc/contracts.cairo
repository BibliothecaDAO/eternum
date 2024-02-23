#[dojo::contract]
mod npc_systems {
    use starknet::{get_caller_address};
    use starknet::info::BlockInfo;

    use eternum::constants::NPC_CONFIG_ID;
    use eternum::models::realm::{Realm, RealmTrait};
    use eternum::models::npc::{Npc};
    use eternum::models::last_spawned::{LastSpawned, ShouldSpawnImpl};
    use eternum::systems::npc::utils::assert_ownership;
    use eternum::models::config::NpcConfig;
    use eternum::systems::npc::interface::INpc;

    use core::Into;

    #[derive(Drop, starknet::Event)]
    struct NpcSpawned {
        #[key]
        realm_id: u128,
        npc_id: u128,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        NpcSpawned: NpcSpawned,
    }

    #[generate_trait]
    impl InternalFunctions of InternalFunctionsTrait {
        fn change_characteristics(
            self: @ContractState,
            world: IWorldDispatcher,
            realm_id: u128,
            npc_id: u128,
            characteristics: felt252
        ) {
            assert_ownership(world, realm_id);

            let caller_address = get_caller_address();
            let old_npc = get!(world, npc_id, (Npc));
            // otherwise seeing this error on compilation
            // let __set_macro_value__ = Npc { entity_id: npc_id, realm_id, mood, role: old_role.sex, sex: old_sex.role};
            set!(
                world,
                (Npc {
                    entity_id: npc_id,
                    realm_id,
                    characteristics,
                    character_trait: old_npc.character_trait,
                    name: old_npc.name
                })
            );
        }
    }

    #[external(v0)]
    impl NpcImpl of INpc<ContractState> {
        fn spawn_npc(
            self: @ContractState,
            world: IWorldDispatcher,
            realm_id: u128,
            characteristics: felt252,
            character_trait: felt252,
            name: felt252
        ) -> u128 {
            // check that entity is a realm
            let realm = get!(world, realm_id, (Realm));
            assert(realm.realm_id != 0, 'not a realm');

            assert_ownership(world, realm_id);

            let last_spawned = get!(world, realm_id, (LastSpawned));

            let npc_config = get!(world, NPC_CONFIG_ID, (NpcConfig));

            let should_spawn = last_spawned.should_spawn(npc_config.spawn_delay);

            if should_spawn {
                let block: BlockInfo = starknet::get_block_info().unbox();
                let ts: u128 = starknet::get_block_timestamp().into();
                let mut randomness = array![ts, Into::<u64, u128>::into(block.block_number)];
                let entity_id: u128 = world.uuid().into();

                set!(world, (Npc { entity_id, realm_id, characteristics, character_trait, name, }));
                set!(world, (LastSpawned { realm_id, last_spawned_ts: ts }));
                emit!(world, NpcSpawned { realm_id, npc_id: entity_id });
                entity_id
            } else {
                0
            }
        }

        fn change_character_trait(
            self: @ContractState,
            world: IWorldDispatcher,
            realm_id: u128,
            npc_id: u128,
            character_trait: felt252,
        ) {
            assert_ownership(world, realm_id);

            let caller_address = get_caller_address();
            let old_npc = get!(world, npc_id, (Npc));
            set!(
                world,
                (Npc {
                    entity_id: npc_id,
                    realm_id,
                    characteristics: old_npc.characteristics,
                    character_trait,
                    name: old_npc.name
                })
            );
        }
    }
}
