use core::traits::Into;

const TWO_POW_2: u256 = 0x4;
const TWO_POW_8: u256 = 0x100;
const TWO_POW_16: u256 = 0x10000;

#[derive(Serde, Copy, Drop, Print)]
struct Characteristics {
    age: u8,
    role: u8,
    sex: u8,
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

#[derive(Model, Serde, Copy, Drop, Print)]
struct Npc {
    #[key]
    entity_id: u128,
    realm_entity_id: u128,
    characteristics: felt252,
    character_trait: felt252,
    full_name: felt252,
}
