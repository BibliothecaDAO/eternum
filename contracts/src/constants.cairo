use eternum::alias::ID;

// Config ID to fetch global configs
const WORLD_CONFIG_ID: u128 = 999999999999999999;
const BUILDING_CONFIG_ID: u128 = 999999999999999998;
// DISCUSS: these config IDs are used to query a global config for a set of systems (like labor systems)
// and are not linked to a specific entity_type, 
// e.g. LaborConfig holds a set of configuration values 
// that are used for all labor, regardless of the resource
// - base_labor_units
// - base_resources_per_cycle
const LABOR_CONFIG_ID: u128 = 999999999999999997;
const TRANSPORT_CONFIG_ID: u128 = 999999999999999996;
const ROAD_CONFIG_ID: u128 = 999999999999999995;

// 8 bits
const RESOURCE_IDS_PACKED_SIZE: usize = 8_usize;
const REALMS_DATA_PACKED_SIZE: usize = 8_usize;

// LORDS
const LORDS_ID: u128 = 999999999999999996;

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
    const SHEKELS: u8 = 253;
    const WHEAT: u8 = 254;
    const FISH: u8 = 255;
}

/// Get resource occurence probabilities
fn get_zipped_resource_probabilities() -> Span<(u128, u128)> {

    return array![
        (ResourceTypes::WOOD.into(), 8900),
        (ResourceTypes::STONE.into(), 1000),
        (ResourceTypes::COAL.into(), 200),
        (ResourceTypes::COPPER.into(), 100),
        (ResourceTypes::OBSIDIAN.into(), 100),
        (ResourceTypes::SILVER.into(), 100),
        (ResourceTypes::IRONWOOD.into(), 100),
        (ResourceTypes::COLD_IRON.into(), 100),
        (ResourceTypes::GOLD.into(), 100),
        (ResourceTypes::HARTWOOD.into(), 100),
        (ResourceTypes::DIAMONDS.into(), 100),
        (ResourceTypes::SAPPHIRE.into(), 100),
        (ResourceTypes::RUBY.into(), 100),
        (ResourceTypes::DEEP_CRYSTAL.into(), 100),
        (ResourceTypes::IGNIUM.into(), 100),
        (ResourceTypes::ETHEREAL_SILICA.into(), 100),
        (ResourceTypes::TRUE_ICE.into(), 100),
        (ResourceTypes::TWILIGHT_QUARTZ.into(), 44),
        (ResourceTypes::ALCHEMICAL_SILVER.into(), 100),
        (ResourceTypes::ADAMANTINE.into(), 100),
        (ResourceTypes::MITHRAL.into(), 100),
        (ResourceTypes::DRAGONHIDE.into(), 5),
        (ResourceTypes::DESERT_GLASS.into(), 100),
        (ResourceTypes::DIVINE_CLOTH.into(), 100),
        (ResourceTypes::CURIOUS_SPORE.into(), 100),
        (ResourceTypes::UNREFINED_ORE.into(), 100),
        (ResourceTypes::SUNKEN_SHEKEL.into(), 100),
        (ResourceTypes::DEMONHIDE.into(), 2),
        (ResourceTypes::SHEKELS.into(), 100),
        (ResourceTypes::WHEAT.into(), 1500),
        (ResourceTypes::FISH.into(), 800),
    ].span();   
}


fn get_unzipped_resource_probabilities() -> (Span<u128>, Span<u128>) {
    let zipped = get_zipped_resource_probabilities();
    let mut resource_types = array![];
    let mut probabilities = array![];
    let mut index = 0;
    loop {
        if index >= zipped.len() {
            break;
        }
        let (resource_type, probability) = *zipped.at(index);
        resource_types.append(resource_type);
        probabilities.append(probability);    
        index += 1;
    };

    return (resource_types.span(), probabilities.span());

}


// DISCUSS: instead of using constants for entity_type, store the entity_type in the storage
// DISCUSS: register each new entity_type to the system by creating an entity containing the config components
// Using FREE_TRANSPORT_ENTITY_TYPE I can look up the speed and capacity of that entity when creating it
const FREE_TRANSPORT_ENTITY_TYPE: u128 = 256;
const REALM_ENTITY_TYPE: u128 = 257;
const SOLDIER_ENTITY_TYPE: u128 = 256;


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
