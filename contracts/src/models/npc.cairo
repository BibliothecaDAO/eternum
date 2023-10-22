use debug::PrintTrait;
use dojo::database::schema::{
    serialize_member, serialize_member_type, Enum, Member, SchemaIntrospection, Struct, Ty,
};
use integer::u64_wrapping_sub;

const two_pow_8: felt252 = 256;
const two_pow_16: felt252 = 65536;

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
	  mood += mood_happiness * two_pow_8;
	  mood += mood_beligerent * two_pow_16;
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

#[derive(Model, Serde, Copy, Drop, Print)]
struct Npc {
    #[key]
    entity_id: felt252,
    realm_id: felt252,
    // Maybe we just pack 2-3-4-5 villagers inside one or two felt252, then we can just get the list of all villagers for one ressource type with get!(realm_id, ressource_type)
    // #[key]
    // resource_type: u8,
    // Should do struct packing in a felt252
    mood: felt252,
    // farmer or miner
    role: u8,
    sex: u8,
}
