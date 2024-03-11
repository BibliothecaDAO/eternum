use core::pedersen::pedersen;
use starknet::ContractAddress;

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::models::realm::{Realm, RealmTrait};
use eternum::models::owner::Owner;
use eternum::models::npc::Characteristics;


fn assert_ownership(world: IWorldDispatcher, realm_id: u128) {
    let player_id: ContractAddress = starknet::get_caller_address();
    let (realm, owner) = get!(world, realm_id, (Realm, Owner));
    assert(owner.address == player_id, 'Realm does not belong to player');
}


fn pedersen_hash_many(data: Span<felt252>) -> felt252 {
    if (data.len() == 0) {
        // pedersen hash of 0,0
        return 0x49ee3eba8c1600700ee1b87eb599f16716b0b1022947733551fde4050ca6804;
    }
    let mut current_hash: felt252 = pedersen(0, *data.at(0));
    let mut i: u32 = 1;

    loop {
        if (i == data.len()) {
            break;
        }
        current_hash = pedersen(current_hash, *data.at(i));
        i += 1;
    };
    pedersen(current_hash, data.len().into())
}

fn format_args_to_span(nonce: felt252, characs: Characteristics, character_trait: felt252, full_name: felt252) ->Span<felt252> {
    let mut arr = ArrayTrait::new();

    let age: felt252 = characs.age.into();
    let role: felt252 = characs.role.into();
    let sex: felt252 = characs.sex.into();

    arr.append(nonce);
    arr.append(age);
    arr.append(role);
    arr.append(sex);
    arr.append(character_trait);
    arr.append(full_name);

    return arr.span();
}
