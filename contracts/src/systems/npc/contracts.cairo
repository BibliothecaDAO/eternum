#[dojo::contract]
mod npc_systems {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::info::BlockInfo;

    use eternum::constants::NPC_CONFIG_ID;
    use eternum::models::realm::{Realm, RealmTrait};
    use eternum::models::npc::{
        Npc, pack_characs, unpack_characs, random_role, random_sex, Characteristics,
        random_characteristics
    };
    use eternum::models::last_spawned::{LastSpawned, ShouldSpawnImpl};
    use eternum::systems::npc::utils::assert_ownership;
    use eternum::models::config::NpcConfig;
    use eternum::systems::npc::interface::INpc;

    use debug::PrintTrait;
    use core::Into;

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {}

    #[generate_trait]
    impl InternalFunctions of InternalFunctionsTrait {
        // trigger the mood changes based on when the user clicks on the harvest weat/fish
        fn change_characteristics(
            self: @ContractState,
            world: IWorldDispatcher,
            realm_id: felt252,
            npc_id: felt252,
            characteristics: felt252
        ) {
            assert_ownership(world, realm_id);

            let caller_address = get_caller_address();
            let old_npc = get!(world, (npc_id), (Npc));
            // otherwise seeing this error on compilation
            // let __set_macro_value__ = Npc { entity_id: npc_id, realm_id, mood, role: old_role.sex, sex: old_sex.role};
            set!(world, (Npc { entity_id: npc_id, realm_id, characteristics }));
        }
    }

    #[external(v0)]
    impl NpcImpl of INpc<ContractState> {
        fn spawn_npc(self: @ContractState, world: IWorldDispatcher, realm_id: felt252) -> felt252 {
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
                let uuid = world.uuid().into();
                let mut randomness = array![];
                randomness.append(ts);
                randomness.append(Into::<u64, u128>::into(block.block_number));
                randomness.append(Into::<u32, u128>::into(uuid));
                let characteristics = random_characteristics(@randomness.span());
                let entity_id: felt252 = uuid.into();

                set!(
                    world,
                    (Npc { entity_id, realm_id, characteristics: pack_characs(characteristics) })
                );
                set!(world, (LastSpawned { realm_id, last_spawned_ts: ts }));
                entity_id
            } else {
                0
            }
        }
    }
}
