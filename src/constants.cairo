// Config ID to fetch world config
const WORLD_CONFIG_ID: felt252 = 999999999999999999;
const BUILDING_CONFIG_ID: felt252 = 999999999999999998;
const LABOR_CONFIG_ID: felt252 = 999999999999999997;

// 8 bits
const RESOURCE_IDS_PACKED_SIZE: usize = 8_usize;
const REALMS_DATA_PACKED_SIZE: usize = 8_usize;

// prime 
const PRIME: felt252 = 3618502788666131213697322783095070105623107215331596699973092056135872020480;

// had to trasnform to u128 because when converting u8 to felt252 with into(), 
// was getting a withdraw_gas missing error
mod ResourceIds {
    const WOOD: u8 = 0;
    const STONE: u8 = 1;
    const COAL: u8 = 2;
    const COPPER: u8 = 3;
    const OBSIDIAN: u8 = 4;
    const SILVER: u8 = 5;
    const IRONWOOD: u8 = 6;
    const COLD_IRON: u8 = 7;
    const GOLD: u8 = 8;
    const HARTWOOD: u8 = 9;
    const DIAMONDS: u8 = 10;
    const SAPPHIRE: u8 = 11;
    const RUBY: u8 = 12;
    const DEEP_CRYSTAL: u8 = 13;
    const IGNIUM: u8 = 14;
    const ETHEREAL_SILICA: u8 = 15;
    const TRUE_ICE: u8 = 16;
    const TWILIGHT_QUARTZ: u8 = 17;
    const ALCHEMICAL_SILVER: u8 = 18;
    const ADAMANTINE: u8 = 19;
    const MITHRAL: u8 = 20;
    const DRAGONHIDE: u8 = 21;
    const DESERT_GLASS: u8 = 22;
    const DIVINE_CLOTH: u8 = 23;
    const CURIOUS_SPORE: u8 = 24;
    const UNREFINED_ORE: u8 = 25;
    const SUNKEN_SHEKEL: u8 = 26;
    const DEMONHIDE: u8 = 27;
    const WHEAT: u8 = 254;
    const FISH: u8 = 255;
}


enum BuildingIds {
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
