use eternum::{
    models::{
        owner::{Owner, EntityOwner}, config::NpcConfig,
        last_spawned::{LastSpawned, ShouldSpawnImpl}, npc::{Npcs}
    },
    systems::npc::constants::MAX_NUM_NPCS, constants::NPC_CONFIG_ID
};

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

#[dojo::contract]
mod npc_systems {
    use core::{Into, ecdsa::check_ecdsa_signature};
    use box::BoxTrait;

    use starknet::{get_caller_address, info::{BlockInfo, v2::ExecutionInfo, get_execution_info}};

    use super::{assert_is_allowed_to_spawn, set_npc_to_free_slot};

    use eternum::{
        models::{
            npc::{Npc, Npcs}, position::Position, movable::Movable, owner::{Owner, EntityOwner},
            last_spawned::{LastSpawned, ShouldSpawnImpl}, config::NpcConfig
        },
        constants::NPC_CONFIG_ID,
        systems::npc::{
            utils::{
                assert_existance_and_ownership, pedersen_hash_many, format_args_to_span,
                unpack_characs
            },
            interface::INpc
        }
    };


    #[derive(Drop, starknet::Event)]
    struct NpcSpawned {
        #[key]
        realm_entity_id: u128,
        entity_id: u128,
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
            realm_entity_id: u128,
            entity_id: u128,
            characteristics: felt252
        ) {
            assert_existance_and_ownership(world, realm_entity_id);

            assert(entity_id != 0, 'entity id is zero');

            let old_npc = get!(world, (entity_id), (Npc));
            assert(old_npc.entity_id != 0, 'npc doesnt exist');

            set!(
                world,
                (Npc {
                    entity_id,
                    characteristics,
                    character_trait: old_npc.character_trait,
                    full_name: old_npc.full_name
                })
            );
        }
    }

    #[external(v0)]
    impl NpcImpl of INpc<ContractState> {
        fn spawn_npc(
            self: @ContractState,
            world: IWorldDispatcher,
            realm_entity_id: u128,
            characteristics: felt252,
            character_trait: felt252,
            full_name: felt252,
            signature: Span<felt252>
        ) -> u128 {
            assert_existance_and_ownership(world, realm_entity_id);

            let npc_config = get!(world, NPC_CONFIG_ID, (NpcConfig));

            let hash = pedersen_hash_many(
                format_args_to_span(
                    get_execution_info().unbox().tx_info.unbox().nonce,
                    unpack_characs(characteristics),
                    character_trait,
                    full_name
                )
            );

            assert(
                check_ecdsa_signature(hash, npc_config.pub_key, *signature.at(0), *signature.at(1)),
                'Invalid signature'
            );

            let npcs = get!(world, realm_entity_id, (Npcs));

            assert_is_allowed_to_spawn(world, realm_entity_id, npcs.num_npcs);

            let entity_id: u128 = world.uuid().into();

            set!(world, (Npc { entity_id, characteristics, character_trait, full_name, },));

            let realm_position = get!(world, realm_entity_id, (Position));
            set!(
                world, (Position { entity_id: entity_id, x: realm_position.x, y: realm_position.y })
            );

            // our travel flow calls their travel function which asserts
            // that caller is owner, so we need this contract to be owner of every NPC
            set!(
                world, (Owner { entity_id: entity_id, address: starknet::get_contract_address() })
            );

            set!(world, (EntityOwner { entity_id: entity_id, entity_owner_id: realm_entity_id }));

            set_npc_to_free_slot(world, npcs, entity_id);

            set!(
                world,
                (LastSpawned { realm_entity_id, last_spawned_ts: starknet::get_block_timestamp() })
            );
            emit!(world, NpcSpawned { realm_entity_id, entity_id });

            entity_id
        }

        fn change_character_trait(
            self: @ContractState,
            world: IWorldDispatcher,
            realm_entity_id: u128,
            entity_id: u128,
            character_trait: felt252,
        ) {
            assert_existance_and_ownership(world, realm_entity_id);
            assert(entity_id != 0, 'npc inexistant');

            let caller_address = get_caller_address();
            let old_npc = get!(world, entity_id, (Npc));

            let entity_owner = get!(world, (entity_id), (EntityOwner));
            assert(entity_owner.entity_owner_id == realm_entity_id, 'not owner of NPC');

            assert(old_npc.entity_id != 0, 'npc doesnt exist');

            set!(
                world,
                (Npc {
                    entity_id,
                    characteristics: old_npc.characteristics,
                    character_trait,
                    full_name: old_npc.full_name
                })
            );
        }
    }
}

fn assert_is_allowed_to_spawn(world: IWorldDispatcher, realm_entity_id: u128, npcs_num: u8) {
    let last_spawned = get!(world, realm_entity_id, (LastSpawned));

    let npc_config = get!(world, NPC_CONFIG_ID, (NpcConfig));

    let can_spawn = last_spawned.can_spawn(npc_config.spawn_delay);

    assert(can_spawn == true, 'too early to spawn');

    assert(npcs_num < MAX_NUM_NPCS, 'max num npcs reached');
}

fn set_npc_to_free_slot(world: IWorldDispatcher, npcs: Npcs, entity_id: u128) {
    let num_npcs = npcs.num_npcs + 1;
    if (npcs.npc_0 == 0) {
        set!(
            world,
            Npcs {
                realm_entity_id: npcs.realm_entity_id,
                num_npcs,
                npc_0: entity_id,
                npc_1: npcs.npc_1,
                npc_2: npcs.npc_2,
                npc_3: npcs.npc_3,
                npc_4: npcs.npc_4,
            }
        );
    } else if (npcs.npc_1 == 0) {
        set!(
            world,
            Npcs {
                realm_entity_id: npcs.realm_entity_id,
                num_npcs,
                npc_0: npcs.npc_0,
                npc_1: entity_id,
                npc_2: npcs.npc_2,
                npc_3: npcs.npc_3,
                npc_4: npcs.npc_4,
            }
        );
    } else if (npcs.npc_2 == 0) {
        set!(
            world,
            Npcs {
                realm_entity_id: npcs.realm_entity_id,
                num_npcs,
                npc_0: npcs.npc_0,
                npc_1: npcs.npc_1,
                npc_2: entity_id,
                npc_3: npcs.npc_3,
                npc_4: npcs.npc_4,
            }
        );
    } else if (npcs.npc_3 == 0) {
        set!(
            world,
            Npcs {
                realm_entity_id: npcs.realm_entity_id,
                num_npcs,
                npc_0: npcs.npc_0,
                npc_1: npcs.npc_1,
                npc_2: npcs.npc_2,
                npc_3: entity_id,
                npc_4: npcs.npc_4,
            }
        );
    } else if (npcs.npc_4 == 0) {
        set!(
            world,
            Npcs {
                realm_entity_id: npcs.realm_entity_id,
                num_npcs,
                npc_0: npcs.npc_0,
                npc_1: npcs.npc_1,
                npc_2: npcs.npc_2,
                npc_3: npcs.npc_3,
                npc_4: entity_id,
            }
        );
    }
}
