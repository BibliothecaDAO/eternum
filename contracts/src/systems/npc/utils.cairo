use core::pedersen::pedersen;
use starknet::ContractAddress;

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

use eternum::models::{owner::Owner, realm::{Realm, RealmTrait}, npc::{Characteristics}};

const TWO_POW_2: u256 = 0x4;
const TWO_POW_8: u256 = 0x100;
const TWO_POW_16: u256 = 0x10000;

fn assert_existance_and_ownership(world: IWorldDispatcher, realm_entity_id: u128) {
    let (realm, owner) = get!(world, realm_entity_id, (Realm, Owner));
    let player_address: ContractAddress = starknet::get_caller_address();
    assert(realm.realm_id != 0, 'not a realm');
    assert(owner.address == player_address, 'Realm does not belong to player');
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

fn format_args_to_span(
    nonce: felt252, characs: Characteristics, character_trait: felt252, full_name: felt252
) -> Span<felt252> {
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

fn pack_characs(value: Characteristics) -> felt252 {
    (value.age.into() + (value.role.into() * TWO_POW_8) + (value.sex.into() * TWO_POW_16))
        .try_into()
        .unwrap()
}

fn unpack_characs(value: felt252) -> Characteristics {
    let packed = value.into();
    let (packed, age) = integer::U256DivRem::div_rem(packed, TWO_POW_8.try_into().unwrap());
    let (packed, role) = integer::U256DivRem::div_rem(packed, TWO_POW_8.try_into().unwrap());
    let (packed, sex) = integer::U256DivRem::div_rem(packed, TWO_POW_2.try_into().unwrap());
    Characteristics {
        age: age.try_into().unwrap(), role: role.try_into().unwrap(), sex: sex.try_into().unwrap()
    }
}
