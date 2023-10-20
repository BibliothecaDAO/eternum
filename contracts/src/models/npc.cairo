use integer::{u64_wrapping_sub};
use dojo::database::schema::{
    Enum, Member, Ty, Struct, SchemaIntrospection, serialize_member, serialize_member_type
};

// should do struct packing here
#[derive(Drop, Copy, Serde, Print, Introspect)]
struct Mood {
    hunger: u8,
    happiness: u8,
}

fn random_sex(block_number: u64) -> Sex {
    let random = block_number % 2;
    if (random == 0) {
        Sex::Male
    } else {
        Sex::Female
    }
}

fn random_mood(block_number: u64) -> Mood {
    Mood {
        hunger: (block_number % 10).try_into().unwrap(),
        happiness: (u64_wrapping_sub(block_number, 5) % 10).try_into().unwrap()
    }
}

#[derive(Copy, Drop, Serde, Introspect)]
enum Sex {
    Male,
    Female
}

#[derive(Model, Serde, Copy, Drop, Print)]
struct Npc {
    #[key]
    realm_id: felt252,
    #[key]
    entity_id: felt252,
	// Maybe we just pack 2-3-4-5 villagers inside one or two felt252, then we can just get the list of all villagers for one ressource type with get!(realm_id, ressource_type) 
	// #[key]
    // resource_type: u8,
    mood: Mood,
    sex: Sex,

}
