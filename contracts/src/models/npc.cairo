use integer::{u64_wrapping_sub};
use dojo::database::schema::{
    Enum, Member, Ty, Struct, SchemaIntrospection, serialize_member, serialize_member_type
};
use debug::PrintTrait;

const two_pow_8: felt252 = 256;
const two_pow_16: felt252 = 65536;

fn random_sex(block_number: u64) -> Sex {
    let random = block_number % 2;
    if (random == 0) {
        Sex::Male
    } else {
        Sex::Female
    }
}

fn random_mood(block_number: u64) -> felt252 {
	let mut mood = 0;
	let mood_hunger: felt252 = (block_number % 10).into();
	let mood_happiness: felt252 = (u64_wrapping_sub(block_number, 3) % 10).into();
	let mood_beligerent: felt252 = (u64_wrapping_sub(block_number, 3) % 10).into();
	mood += mood_hunger;
	mood += mood_happiness * two_pow_8;
	mood += mood_beligerent * two_pow_16;
	mood
}

fn random_role(block_number: u64) -> Role {
    let random = block_number % 2;
    if (random == 0) {
        Role::Farmer
    } else {
        Role::Miner
    }
}

#[derive(Copy, Drop, Serde, Introspect, Print, PartialEq)]
enum Sex {
    Male,
    Female
}

#[derive(Copy, Drop, Serde, Introspect, Print, PartialEq)]
enum Role {
    Farmer,
    Miner,
}

impl SexPrint of PrintTrait<Sex> {
	fn print(self: Sex) {
		if (self == Sex::Male) {
			'male'.print();
		} else {
			'female'.print();
		}
	}
}

impl RolePrint of PrintTrait<Role> {
	fn print(self: Role) {
		if (self == Role::Farmer) {
			'farmer'.print();
		} else {
			'miner'.print();
		}
	}
}

#[derive(Model, Serde, Copy, Drop, Print)]
struct Npc {
    #[key]
    realm_entity_id: felt252,
    #[key]
    entity_id: felt252,
    // Maybe we just pack 2-3-4-5 villagers inside one or two felt252, then we can just get the list of all villagers for one ressource type with get!(realm_id, ressource_type) 
    // #[key]
    // resource_type: u8,
	// Should do struct packing in a felt252
	mood: felt252,
	// farmer or miner
	role: Role, 
    sex: Sex,
}
