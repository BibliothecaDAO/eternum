use eternum::{
    models::{
        owner::{Owner, EntityOwner}, config::NpcConfig,
        last_spawned::{LastSpawned, ShouldSpawnImpl}, npc::{RealmRegistry}
    },
    constants::NPC_CONFIG_ID
};

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

#[dojo::contract]
mod npc_systems {
    use core::{Into, ecdsa::check_ecdsa_signature};
    use box::BoxTrait;

    use starknet::{get_caller_address, info::{BlockInfo, v2::ExecutionInfo, get_execution_info}};

    use super::{assert_is_allowed_to_spawn};

    use eternum::{
        models::{
            npc::{Npc, RealmRegistry}, position::{Position, PositionImpl, PositionIntoCoord, Coord},
            movable::{Movable, ArrivalTime}, owner::{Owner, EntityOwner},
            last_spawned::{LastSpawned, ShouldSpawnImpl}, config::{NpcConfig, SpeedConfig},
            realm::{Realm},
        },
        constants::{WORLD_CONFIG_ID, NPC_CONFIG_ID, NPC_ENTITY_TYPE},
        systems::{
            npc::{
                utils::{
                    assert_realm_existance_and_ownership, assert_realm_existance,
                    pedersen_hash_many, format_args_to_span, unpack_characs
                },
                interface::INpc
            },
            transport::contracts::travel_systems::travel_systems::InternalTravelSystemsImpl,
        }
    };

    use debug::PrintTrait;

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
            assert_realm_existance_and_ownership(world, realm_entity_id);

            assert(entity_id != 0, 'entity id is zero');

            let old_npc = get!(world, (entity_id), (Npc));
            assert(old_npc.entity_id != 0, 'npc doesnt exist');

            set!(
                world,
                (Npc {
                    entity_id,
                    current_realm_entity_id: old_npc.current_realm_entity_id,
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
            assert_realm_existance_and_ownership(world, realm_entity_id);

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

            assert_is_allowed_to_spawn(world, realm_entity_id);

            let entity_id: u128 = world.uuid().into();

            set!(
                world,
                (
                    Npc {
                        entity_id,
                        current_realm_entity_id: realm_entity_id,
                        characteristics,
                        character_trait,
                        full_name,
                    },
                )
            );

            let realm_position = get!(world, realm_entity_id, (Position));
            set!(
                world, (Position { entity_id: entity_id, x: realm_position.x, y: realm_position.y })
            );

            let speed = get!(world, (WORLD_CONFIG_ID, NPC_ENTITY_TYPE), SpeedConfig).sec_per_km;

            set!(
                world,
                (Movable {
                    entity_id: entity_id,
                    sec_per_km: speed,
                    blocked: false,
                    round_trip: false,
                    intermediate_coord_x: 0,
                    intermediate_coord_y: 0,
                })
            );

            set!(world, (Owner { entity_id: entity_id, address: starknet::get_caller_address() }));

            set!(world, (EntityOwner { entity_id: entity_id, entity_owner_id: realm_entity_id }));

            set!(
                world,
                (LastSpawned { realm_entity_id, last_spawned_ts: starknet::get_block_timestamp() })
            );

            let realm_registry = get!(world, realm_entity_id, (RealmRegistry));
            set!(
                world,
                RealmRegistry {
                    realm_entity_id: realm_registry.realm_entity_id,
                    num_resident_npcs: realm_registry.num_resident_npcs + 1,
                    num_native_npcs: realm_registry.num_native_npcs + 1
                }
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
            assert_realm_existance_and_ownership(world, realm_entity_id);
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
                    current_realm_entity_id: old_npc.current_realm_entity_id,
                    characteristics: old_npc.characteristics,
                    character_trait,
                    full_name: old_npc.full_name
                })
            );
        }

        fn npc_travel(
            self: @ContractState,
            world: IWorldDispatcher,
            npc_entity_id: u128,
            to_realm_entity_id: u128
        ) {
            assert(npc_entity_id != 0, 'npc_entity_id is 0');
            assert(to_realm_entity_id != 0, 'to_realm_entity_id is 0');

            assert_realm_existance(world, to_realm_entity_id);

            let npc_entity_owner = get!(world, npc_entity_id, (EntityOwner));
            let npc_original_realm = get!(world, npc_entity_owner.entity_owner_id, (Realm));
            assert_realm_existance_and_ownership(world, npc_original_realm.entity_id);

            let npc = get!(world, npc_entity_id, (Npc));
            assert(npc.full_name != 0, 'invalid npc_entity_id');

            let npc_movable = get!(world, npc_entity_id, (Movable));
            assert(npc_movable.blocked == false, 'npc is blocked');
            assert(npc_movable.sec_per_km != 0, 'speed of 0');

            let npc_arrival = get!(world, npc_entity_id, (ArrivalTime));
            assert(npc_arrival.arrives_at <= starknet::get_block_timestamp(), 'npc is traveling');

            let npc_position = get!(world, npc_entity_id, (Position));
            let to_position = get!(world, to_realm_entity_id, (Position));
            let to_coord: Coord = to_position.into();
            assert(npc_position.into() != to_coord, 'already in dest realm');

            InternalTravelSystemsImpl::travel(
                world, npc_entity_id, npc_movable, npc_position.into(), to_position.into()
            );
            if (npc.current_realm_entity_id != 0) {
                let current_realm_registry = get!(
                    world, npc.current_realm_entity_id, (RealmRegistry)
                );
                set!(
                    world,
                    RealmRegistry {
                        realm_entity_id: current_realm_registry.realm_entity_id,
                        num_resident_npcs: current_realm_registry.num_resident_npcs - 1,
                        num_native_npcs: current_realm_registry.num_native_npcs
                    }
                );
            }

            set!(
                world,
                Npc {
                    entity_id: npc.entity_id,
                    current_realm_entity_id: 0,
                    characteristics: npc.characteristics,
                    character_trait: npc.character_trait,
                    full_name: npc.full_name
                }
            );
        }

        fn welcome_npc(
            self: @ContractState,
            world: IWorldDispatcher,
            npc_entity_id: u128,
            into_realm_entity_id: u128,
        ) {
            assert(npc_entity_id != 0, 'npc_entity_id is 0');
            assert(into_realm_entity_id != 0, 'into_realm_entity_id is 0');

            assert_realm_existance_and_ownership(world, into_realm_entity_id);

            let npc = get!(world, npc_entity_id, (Npc));
            assert(npc.full_name != 0, 'invalid npc_entity_id');

            let npc_position = get!(world, npc_entity_id, (Position));
            let into_realm_position = get!(world, into_realm_entity_id, (Position));
            let into_realm_coord: Coord = into_realm_position.into();
            assert(npc_position.into() == into_realm_coord, 'npc not in into realm');

            let npc_arrival = get!(world, npc_entity_id, (ArrivalTime));
            assert(npc_arrival.arrives_at <= starknet::get_block_timestamp(), 'npc is traveling');

            assert(npc.current_realm_entity_id == 0, 'npc is not at the gates');

            let npc_config = get!(world, NPC_CONFIG_ID, (NpcConfig));
            let into_realm_registry = get!(world, into_realm_entity_id, RealmRegistry);
            assert(
                into_realm_registry.num_resident_npcs < npc_config.max_num_resident_npcs,
                'too many npcs'
            );

            set!(
                world,
                RealmRegistry {
                    realm_entity_id: into_realm_registry.realm_entity_id,
                    num_resident_npcs: into_realm_registry.num_resident_npcs + 1,
                    num_native_npcs: into_realm_registry.num_native_npcs,
                }
            );

            set!(
                world,
                Npc {
                    entity_id: npc.entity_id,
                    current_realm_entity_id: into_realm_entity_id,
                    characteristics: npc.characteristics,
                    character_trait: npc.character_trait,
                    full_name: npc.full_name
                }
            );
        }

        fn kick_out_npc(self: @ContractState, world: IWorldDispatcher, npc_entity_id: u128) {
            assert(npc_entity_id != 0, 'npc_entity_id is 0');

            let npc = get!(world, npc_entity_id, (Npc));
            assert(npc.full_name != 0, 'invalid npc_entity_id');

            assert(npc.current_realm_entity_id != 0, 'npc wasnt welcomed in any realm');
            assert_realm_existance_and_ownership(world, npc.current_realm_entity_id);

            let npc_arrival = get!(world, npc_entity_id, (ArrivalTime));
            assert(
                npc_arrival.arrives_at <= starknet::get_block_timestamp(), 'npc is still traveling'
            );

            let kicking_out_realm_registry = get!(
                world, npc.current_realm_entity_id, (RealmRegistry)
            );

            set!(
                world,
                RealmRegistry {
                    realm_entity_id: npc.current_realm_entity_id,
                    num_resident_npcs: kicking_out_realm_registry.num_resident_npcs - 1,
                    num_native_npcs: kicking_out_realm_registry.num_native_npcs
                }
            );

            set!(
                world,
                Npc {
                    entity_id: npc.entity_id,
                    current_realm_entity_id: 0,
                    characteristics: npc.characteristics,
                    character_trait: npc.character_trait,
                    full_name: npc.full_name
                }
            );
        }
    }
}

fn assert_is_allowed_to_spawn(world: IWorldDispatcher, realm_entity_id: u128) {
    let npc_config = get!(world, NPC_CONFIG_ID, (NpcConfig));
    let can_spawn_time_related = get!(world, realm_entity_id, (LastSpawned))
        .can_spawn(npc_config.spawn_delay);

    assert(can_spawn_time_related == true, 'too early to spawn');

    let realm_registry = get!(world, realm_entity_id, (RealmRegistry));

    assert(realm_registry.num_native_npcs < npc_config.max_num_native_npcs, 'max num npcs spawned');
    assert(
        realm_registry.num_resident_npcs < npc_config.max_num_resident_npcs,
        'already hosting max num npcs'
    );
}
