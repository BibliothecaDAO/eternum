use eternum::alias::ID;


// Config ID to fetch global configs
const WORLD_CONFIG_ID: u128 = 999999999999999999;
const BUILDING_CONFIG_ID: u128 = 999999999999999998;
const TRANSPORT_CONFIG_ID: u128 = 999999999999999996;
const ROAD_CONFIG_ID: u128 = 999999999999999995;
const COMBAT_CONFIG_ID: u128 = 999999999999999994;
const REALM_LEVELING_CONFIG_ID: u128 = 999999999999999993;
const HYPERSTRUCTURE_LEVELING_CONFIG_ID: u128 = 999999999999999992;
const REALM_FREE_MINT_CONFIG_ID: u128 = 999999999999999991;
const POPULATION_CONFIG_ID: u128 = 999999999999999990;

// 8 bits
const RESOURCE_IDS_PACKED_SIZE: usize = 8_usize;
const REALMS_DATA_PACKED_SIZE: usize = 8_usize;

// leveling tiers
const HYPERSTRUCTURE_LEVELING_START_TIER: u64 = 0;
const REALM_LEVELING_START_TIER: u64 = 1;

// max realms per user
const MAX_REALMS_PER_ADDRESS: u8 = 5;

// base population
// TODO: Move to Onchain config
const BASE_POPULATION: u32 = 6;

// resource precision
const RESOURCE_PRECISION: u128 = 1_000;

// base storehouse capacity
// TODO: Move to Onchain config
const BASE_STOREHOUSE_CAPACITY: u128 = 10_000;

// loyalty config
// TODO: Move to Onchain config
const LOYALTY_TICK_INTERVAL: u64 = 7; // updates after x ticks
const LOYALTY_PER_TICK_INTERVAL: u64 = 1; // update by y after x ticks
const LOYALTY_MAX_VALUE: u64 = 100;

// pillage config
// TODO: Move to Onchain config
const MAX_PILLAGE_TRIAL_COUNT: u8 = 7;

mod ResourceTypes {
    const WOOD: u8 = 1;
    const STONE: u8 = 2;
    const COAL: u8 = 3;
    const COPPER: u8 = 4;
    const OBSIDIAN: u8 = 5;
    const SILVER: u8 = 6;
    const IRONWOOD: u8 = 7;
    const COLD_IRON: u8 = 8;
    const GOLD: u8 = 9;
    const HARTWOOD: u8 = 10;
    const DIAMONDS: u8 = 11;
    const SAPPHIRE: u8 = 12;
    const RUBY: u8 = 13;
    const DEEP_CRYSTAL: u8 = 14;
    const IGNIUM: u8 = 15;
    const ETHEREAL_SILICA: u8 = 16;
    const TRUE_ICE: u8 = 17;
    const TWILIGHT_QUARTZ: u8 = 18;
    const ALCHEMICAL_SILVER: u8 = 19;
    const ADAMANTINE: u8 = 20;
    const MITHRAL: u8 = 21;
    const DRAGONHIDE: u8 = 22;
    const DESERT_GLASS: u8 = 23;
    const DIVINE_CLOTH: u8 = 24;
    const CURIOUS_SPORE: u8 = 25;
    const UNREFINED_ORE: u8 = 26;
    const SUNKEN_SHEKEL: u8 = 27;
    const DEMONHIDE: u8 = 28;
    const EARTHEN_SHARD: u8 = 29;

    // TRANSPORT
    const DONKEY: u8 = 249;

    // TROOPS // @dev: troops are not resources, but they are stored in the same data structure
    const KNIGHT: u8 = 250;
    const CROSSBOWMAN: u8 = 251;
    const PALADIN: u8 = 252;

    const LORDS: u8 = 253;
    const WHEAT: u8 = 254;
    const FISH: u8 = 255;
// note: update _resource_type_to_position 
//  function is any new resources are added
}

fn resource_type_name(resource_type: u8) -> ByteArray {
    if resource_type == 1 {
        "WOOD"
    } else if resource_type == 2 {
        "STONE"
    } else if resource_type == 3 {
        "COAL"
    } else if resource_type == 4 {
        "COPPER"
    } else if resource_type == 5 {
        "OBSIDIAN"
    } else if resource_type == 6 {
        "SILVER"
    } else if resource_type == 7 {
        "IRONWOOD"
    } else if resource_type == 8 {
        "COLD IRON"
    } else if resource_type == 9 {
        "GOLD"
    } else if resource_type == 10 {
        "HARTWOOD"
    } else if resource_type == 11 {
        "DIAMONDS"
    } else if resource_type == 12 {
        "SAPPHIRE"
    } else if resource_type == 13 {
        "RUBY"
    } else if resource_type == 14 {
        "DEEP CRYSTAL"
    } else if resource_type == 15 {
        "IGNIUM"
    } else if resource_type == 16 {
        "ETHEREAL SILICA"
    } else if resource_type == 17 {
        "TRUE ICE"
    } else if resource_type == 18 {
        "TWILIGHT QUARTZ"
    } else if resource_type == 19 {
        "ALCHEMICAL SILVER"
    } else if resource_type == 20 {
        "ADAMANTINE"
    } else if resource_type == 21 {
        "MITHRAL"
    } else if resource_type == 22 {
        "DRAGONHIDE"
    } else if resource_type == 23 {
        "DESERT GLASS"
    } else if resource_type == 24 {
        "DIVINE CLOTH"
    } else if resource_type == 25 {
        "CURIOUS SPORE"
    } else if resource_type == 26 {
        "UNREFINED ORE"
    } else if resource_type == 27 {
        "SUNKEN SHEKEL"
    } else if resource_type == 28 {
        "DEMONHIDE"
    } else if resource_type == 249 {
        "DONKEY"
    } else if resource_type == 250 {
        "KNIGHT"
    } else if resource_type == 251 {
        "CROSSBOWMAN"
    } else if resource_type == 252 {
        "PALADIN"
    } else if resource_type == 253 {
        "LORDS"
    } else if resource_type == 254 {
        "WHEAT"
    } else if resource_type == 255 {
        "FISH"
    } else {
        format!("{} (unknown resource name)", resource_type)
    }
}


fn get_resources_for_pillage() -> Span<u8> {
    return array![
        ResourceTypes::WOOD,
        ResourceTypes::STONE,
        ResourceTypes::COAL,
        ResourceTypes::COPPER,
        ResourceTypes::OBSIDIAN,
        ResourceTypes::SILVER,
        ResourceTypes::IRONWOOD,
        ResourceTypes::COLD_IRON,
        ResourceTypes::GOLD,
        ResourceTypes::HARTWOOD,
        ResourceTypes::DIAMONDS,
        ResourceTypes::SAPPHIRE,
        ResourceTypes::RUBY,
        ResourceTypes::DEEP_CRYSTAL,
        ResourceTypes::IGNIUM,
        ResourceTypes::ETHEREAL_SILICA,
        ResourceTypes::TRUE_ICE,
        ResourceTypes::TWILIGHT_QUARTZ,
        ResourceTypes::ALCHEMICAL_SILVER,
        ResourceTypes::ADAMANTINE,
        ResourceTypes::MITHRAL,
        ResourceTypes::DRAGONHIDE,
        ResourceTypes::DESERT_GLASS,
        ResourceTypes::DIVINE_CLOTH,
        ResourceTypes::CURIOUS_SPORE,
        ResourceTypes::UNREFINED_ORE,
        ResourceTypes::SUNKEN_SHEKEL,
        ResourceTypes::DEMONHIDE,
        ResourceTypes::DONKEY,
        ResourceTypes::KNIGHT,
        ResourceTypes::CROSSBOWMAN,
        ResourceTypes::PALADIN,
        ResourceTypes::LORDS,
        ResourceTypes::WHEAT,
        ResourceTypes::FISH,
    ]
        .span();
}

fn get_resources_for_pillage_probs() -> Span<u128> {
    // 35 
    return array![
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1
    ]
        .span();
}


/// Get resource occurence probabilities
fn get_resource_probabilities() -> Span<(u8, u128)> {
    return array![
        (ResourceTypes::WOOD, 2018108),
        (ResourceTypes::STONE, 1585915),
        (ResourceTypes::COAL, 1542455),
        (ResourceTypes::COPPER, 1063581),
        (ResourceTypes::OBSIDIAN, 891750),
        (ResourceTypes::SILVER, 700604),
        (ResourceTypes::IRONWOOD, 474447),
        (ResourceTypes::COLD_IRON, 385111),
        (ResourceTypes::GOLD, 367807),
        (ResourceTypes::HARTWOOD, 239034),
        (ResourceTypes::DIAMONDS, 120724),
        (ResourceTypes::SAPPHIRE, 99396),
        (ResourceTypes::RUBY, 96177),
        (ResourceTypes::DEEP_CRYSTAL, 96177),
        (ResourceTypes::IGNIUM, 69215),
        (ResourceTypes::ETHEREAL_SILICA, 65191),
        (ResourceTypes::TRUE_ICE, 55936),
        (ResourceTypes::TWILIGHT_QUARTZ, 44668),
        (ResourceTypes::ALCHEMICAL_SILVER, 37425),
        (ResourceTypes::ADAMANTINE, 22133),
        (ResourceTypes::MITHRAL, 14889),
        (ResourceTypes::DRAGONHIDE, 9256),
        (ResourceTypes::EARTHEN_SHARD, 96177), // SHARDS
    ]
        .span();
}


fn split_resources_and_probs() -> (Span<u8>, Span<u128>) {
    let mut zipped = get_resource_probabilities();
    let mut resource_types = array![];
    let mut resource_probabilities = array![];
    loop {
        match zipped.pop_front() {
            Option::Some((
                resource_type, probability
            )) => {
                resource_types.append(*resource_type);
                resource_probabilities.append(*probability);
            },
            Option::None => { break; },
        }
    };

    return (resource_types.span(), resource_probabilities.span());
}


// DISCUSS: instead of using constants for entity_type, store the entity_type in the storage
// DISCUSS: register each new entity_type to the system by creating an entity containing the config components
// Using DONKEY_ENTITY_TYPE I can look up the speed and capacity of that entity when creating it
const DONKEY_ENTITY_TYPE: u128 = 256;
const REALM_ENTITY_TYPE: u128 = 257;
const ARMY_ENTITY_TYPE: u128 = 258;


// TODO: change to consts
enum BuildingTypes {
    HOUSE: u8,
    STORE_HOUSE: u8,
    GRANARY: u8,
    FARM: u8,
    FISHING_VILLAGE: u8,
    BARACKS: u8,
    MAGE_TOWER: u8,
    ARCHER_TOWER: u8,
    CASTLE: u8,
}

mod LevelIndex {
    const FOOD: u8 = 1;
    const RESOURCE: u8 = 2;
    const TRAVEL: u8 = 3;
    const COMBAT: u8 = 4;
}

mod ErrorMessages {
    // we can't use this because values are not "strings" but 'felts'
    // and we can only use string literals in assert! macro
    // 
    const NOT_OWNER: felt252 = 'Not Owner';
}
