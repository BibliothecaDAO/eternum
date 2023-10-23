use starknet::ContractAddress;
use dojo::database::schema::{
    Enum, Member, Ty, Struct, SchemaIntrospection, serialize_member, serialize_member_type
};

#[derive(Model, Copy, Drop, Serde)]
struct Map {
    #[key]
    token_id: u128,
    size: u8,
    environment: u8,
    structure: u8,
    legendary: u8,
    layout1: felt252,
    layout2: felt252,
    layout3: felt252,
    doors1: felt252,
    doors2: felt252,
    doors3: felt252,
    points1: felt252,
    points2: felt252,
    points3: felt252,
    affinity: felt252,
    dungeon_name1: felt252,
    dungeon_name2: felt252,
    dungeon_name3: felt252,
    dungeon_name4: felt252,
    dungeon_name5: felt252,
    owner: ContractAddress,
}
