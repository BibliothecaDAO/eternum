use debug::PrintTrait;
use integer::{u64_wrapping_sub, u128_wrapping_sub};
use core::traits::Into;

const TWO_POW_2: u256 = 0x4;
const TWO_POW_4: u256 = 0x10;
const TWO_POW_8: u256 = 0x100;
const TWO_POW_12: u256 = 0x1000;
const TWO_POW_16: u256 = 0x10000;
const TWO_POW_20: u256 = 0x100000;
const TWO_POW_24: u256 = 0x1000000;

fn flip(source: u128) -> bool {
    let source_as_felt = source % 2;
    source_as_felt == 0
}

fn random_sex(source: u128) -> u8 {
    let random = flip(source);
    if random {
        0 // read as male
    } else {
        1 // read as female
    }
}

fn random_mood(block_number: u64) -> felt252 {
    let mut mood = 0;
    let mood_hunger: felt252 = (block_number % 10).into();
    let mood_happiness: felt252 = (u64_wrapping_sub(block_number, 3) % 10).into();
    let mood_beligerent: felt252 = (u64_wrapping_sub(block_number, 16) % 10).into();
    mood += mood_hunger;
    mood += mood_happiness * TWO_POW_8.try_into().unwrap();
    mood += mood_beligerent * TWO_POW_16.try_into().unwrap();
    mood
}

fn random_role(source: u128) -> u8 {
    let random = flip(source);
    if random {
        0 // read as Farmer
    } else {
        1 // read as Miner
    }
}

#[derive(Serde, Copy, Drop, Print)]
struct Characteristics {
    age: u8,
    hunger: u8,
    happiness: u8,
    belligerency: u8,
    role: u8,
    sex: u8,
}

fn random_characteristics(randomness: @Span<u128>) -> Characteristics {
    Characteristics {
        age: 1,
        hunger: (*randomness[1] % 10).try_into().unwrap(),
        happiness: (u128_wrapping_sub(*randomness[1], 3) % 10).try_into().unwrap(),
        belligerency: (u128_wrapping_sub(*randomness[1], 16) % 10).try_into().unwrap(),
        role: random_role(*randomness[0]),
        sex: random_sex(*randomness[2]),
    }
}

fn pack_characs(value: Characteristics) -> felt252 {
    (value.age.into()
        + (value.hunger.into() * TWO_POW_8)
        + (value.happiness.into() * TWO_POW_12)
        + (value.belligerency.into() * TWO_POW_16)
        + (value.role.into() * TWO_POW_20)
        + (value.sex.into() * TWO_POW_24))
        .try_into()
        .unwrap()
}

fn unpack_characs(value: felt252) -> Characteristics {
    let packed = value.into();
    let (packed, age) = integer::U256DivRem::div_rem(packed, TWO_POW_8.try_into().unwrap());
    let (packed, hunger) = integer::U256DivRem::div_rem(packed, TWO_POW_4.try_into().unwrap());
    let (packed, happiness) = integer::U256DivRem::div_rem(packed, TWO_POW_4.try_into().unwrap());
    let (packed, belligerency) = integer::U256DivRem::div_rem(
        packed, TWO_POW_4.try_into().unwrap()
    );
    let (packed, role) = integer::U256DivRem::div_rem(packed, TWO_POW_4.try_into().unwrap());
    let (packed, sex) = integer::U256DivRem::div_rem(packed, TWO_POW_2.try_into().unwrap());
    Characteristics {
        age: age.try_into().unwrap(),
        hunger: hunger.try_into().unwrap(),
        happiness: happiness.try_into().unwrap(),
        belligerency: belligerency.try_into().unwrap(),
        role: role.try_into().unwrap(),
        sex: sex.try_into().unwrap()
    }
}

#[derive(Model, Serde, Copy, Drop, Print)]
struct Npc {
    #[key]
    entity_id: felt252,
    realm_id: felt252,
    // Maybe we just pack 2-3-4-5 villagers inside one or two felt252, then we can just get the list of all villagers for one ressource type with get!(realm_id, ressource_type)
    // Characteristics uses a felt252 to pack data about an NPC: 
    // In the following MSB first: (sex is LSB)
    // age (8 bits), hunger (4 bits), happiness (4 bits), belligerency (4 bits), role (4 bits), sex (2 bits)
    characteristics: felt252,
}
