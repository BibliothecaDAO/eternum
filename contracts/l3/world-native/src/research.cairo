use crate::resources::ResourceKey;

// Two-sided rows store independent three-bit counts; other rows store their tier.
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct RealmKnowledge {
    pub learned: u64,
}

// The rows of the castle's tree. A building row climbs from 0 to Legendary V for every building of its type; the
// castle rows unlock shrines, wells and the three depths.
pub const ROW_FARM: u8 = 0;
pub const ROW_WORKSHOP: u8 = 1;
pub const ROW_CONSCRIPTION: u8 = 2;
pub const ROW_HUT: u8 = 3;
pub const ROW_RATIONS: u8 = 4;
pub const ROW_SUPPLY_YARD: u8 = 5;
pub const ROW_KNIGHT_OATHS: u8 = 6;
pub const ROW_SCOUT_OATHS: u8 = 7;
pub const ROW_CROSSBOW_OATHS: u8 = 11;
pub const OATH_SLOTS_BASE: u8 = 1;
pub const OATH_SLOTS_MAX: u8 = 4;
pub const ROW_SHRINE: u8 = 8;
pub const ROW_WELL: u8 = 9;
pub const ROW_DEPTH: u8 = 10;

// Farm and Workshop tiers make more (Fields, Tools) or store more (Granary, Storeroom).
pub const CHOICE_MAKE: u8 = 0;
pub const CHOICE_STORE: u8 = 1;


// Building categories used by construction and research.
pub const HUT: u8 = 1;
pub const WORKSHOP: u8 = 25;
pub const BARRACKS: u8 = 28;
pub const RANGE: u8 = 31;
pub const RATIONS_DEPOT: u8 = 41;
pub const CONSCRIPTION_CAMP: u8 = 44;
pub const RANGE_LEVEL: u8 = 1;
pub const CONSCRIPTION_CAMP_LEVEL: u8 = 1;
pub const RATIONS_DEPOT_LEVEL: u8 = 2;
pub const FARM: u8 = 37;
pub const SUPPLY_YARD: u8 = 42;
pub const SCOUTS_LODGE: u8 = 43;
pub const SCOUTS_LODGE_LEVEL: u8 = 1;

// A tier's price at the castle. Building rows charge Essence and labor; castle rows charge Essence only.
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct ResearchPrice {
    pub essence: u128,
    pub labor: u128,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ResearchPriceConfig {
    pub row: u8,
    pub tier: u8,
    pub price: ResearchPrice,
}

// Buys the next tier. `choice` selects the Farm or Workshop side; every other row takes 0.
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct Research {
    pub structure_id: u64,
    pub row: u8,
    pub choice: u8,
}

pub fn row_category(row: u8) -> u8 {
    if row == ROW_FARM {
        FARM
    } else if row == ROW_WORKSHOP {
        WORKSHOP
    } else if row == ROW_CONSCRIPTION {
        CONSCRIPTION_CAMP
    } else if row == ROW_RATIONS {
        RATIONS_DEPOT
    } else if row == ROW_HUT {
        HUT
    } else if row == ROW_SUPPLY_YARD {
        SUPPLY_YARD
    } else if row == ROW_KNIGHT_OATHS {
        BARRACKS
    } else if row == ROW_SCOUT_OATHS {
        SCOUTS_LODGE
    } else if row == ROW_CROSSBOW_OATHS {
        RANGE
    } else if row == ROW_SHRINE || row == ROW_WELL || row == ROW_DEPTH {
        0
    } else {
        panic!("invalid research row")
    }
}

pub fn is_training(category: u8) -> bool {
    category == SUPPLY_YARD || category == CONSCRIPTION_CAMP || category == RATIONS_DEPOT
}

pub const ROWS: [u8; 12] = [
    ROW_FARM, ROW_WORKSHOP, ROW_CONSCRIPTION, ROW_HUT, ROW_RATIONS, ROW_SUPPLY_YARD, ROW_KNIGHT_OATHS, ROW_SCOUT_OATHS,
    ROW_CROSSBOW_OATHS, ROW_SHRINE, ROW_WELL, ROW_DEPTH,
];

pub fn is_oath_row(row: u8) -> bool {
    row == ROW_KNIGHT_OATHS || row == ROW_SCOUT_OATHS || row == ROW_CROSSBOW_OATHS
}

pub fn oath_slots(learned: u64, category: crate::troops::TroopType) -> u8 {
    let row = match category {
        crate::troops::TroopType::Knight => ROW_KNIGHT_OATHS,
        crate::troops::TroopType::Crossbowman => ROW_CROSSBOW_OATHS,
        crate::troops::TroopType::Paladin => ROW_SCOUT_OATHS,
    };
    OATH_SLOTS_BASE + tier(learned, row)
}

pub fn max_tier(row: u8) -> u8 {
    if row == ROW_FARM
        || row == ROW_WORKSHOP
        || row == ROW_HUT
        || row == ROW_SUPPLY_YARD
        || row == ROW_CONSCRIPTION
        || row == ROW_RATIONS {
        5
    } else if row == ROW_SHRINE || row == ROW_WELL {
        1
    } else if is_oath_row(row) {
        OATH_SLOTS_MAX - OATH_SLOTS_BASE
    } else if row == ROW_DEPTH {
        3
    } else {
        panic!("invalid research row")
    }
}

// Farm and Workshop have two independent sides.
pub fn choice_count(row: u8) -> u8 {
    match row {
        0 | 1 => 2,
        _ => 1,
    }
}

// Where a row's tier sits in `learned`: its scale and its field size.
fn tier_slot(row: u8) -> (u64, u64) {
    match row {
        0 => (0x1, 8),
        1 => (0x80, 8),
        2 => (0x4000, 8),
        3 => (0x200000, 8),
        4 => (0x1000000, 8),
        5 => (0x8000000, 8),
        6 => (0x40000000, 4),
        7 => (0x100000000, 4),
        11 => (0x400000000, 4),
        8 => (0x400000000000, 2),
        9 => (0x800000000000, 2),
        10 => (0x1000000000000, 4),
        _ => panic!("invalid research row"),
    }
}


pub fn independent_sides(row: u8) -> bool {
    row <= ROW_WORKSHOP
}

pub fn tier(learned: u64, row: u8) -> u8 {
    let (scale, size) = tier_slot(row);
    let first = (learned / scale % size).try_into().unwrap();
    if independent_sides(row) {
        let second = (learned / (scale * size) % size).try_into().unwrap();
        core::cmp::max(first, second)
    } else {
        first
    }
}


// The upgrades bought on one side.
pub fn picks(learned: u64, row: u8, side: u8) -> u8 {
    assert!(side < choice_count(row), "invalid research choice");
    if independent_sides(row) {
        let (scale, _) = tier_slot(row);
        let scale = if side == 0 {
            scale
        } else {
            scale * 8
        };
        (learned / scale % 8).try_into().unwrap()
    } else {
        tier(learned, row)
    }
}

// The Fields or Tools picks of a building type; a type without a make-or-store row has none.
pub fn make_picks(learned: u64, category: u8) -> u8 {
    if category == FARM {
        picks(learned, ROW_FARM, CHOICE_MAKE)
    } else if category == WORKSHOP {
        picks(learned, ROW_WORKSHOP, CHOICE_MAKE)
    } else if category == BARRACKS || category == RANGE || category == SCOUTS_LODGE {
        tier(learned, ROW_CONSCRIPTION)
    } else {
        0
    }
}

// Total purchases across a row, including independent economy sides.
pub fn purchases(learned: u64, row: u8) -> u8 {
    if independent_sides(row) {
        picks(learned, row, 0) + picks(learned, row, 1)
    } else {
        tier(learned, row)
    }
}

pub fn side_tier(learned: u64, row: u8, side: u8) -> u8 {
    if independent_sides(row) {
        picks(learned, row, side)
    } else {
        tier(learned, row)
    }
}

// Adds one upgrade to the chosen side.
pub fn learn(learned: u64, row: u8, side: u8) -> u64 {
    assert!(side < choice_count(row), "invalid research choice");

    let next = side_tier(learned, row, side) + 1;
    assert!(next <= max_tier(row), "research side is complete");
    let (scale, _) = tier_slot(row);
    if independent_sides(row) {
        return learned + if side == 0 {
            scale
        } else {
            scale * 8
        };
    }
    learned + scale
}

#[starknet::interface]
pub trait IResearch<T> {
    fn research(
        ref self: T,
        game_id: u32,
        actor: starknet::ContractAddress,
        command: Research,
        context: crate::commands::ActionContext,
    );
    fn realm_knowledge(self: @T, key: ResourceKey) -> Option<RealmKnowledge>;
    #[cfg(feature: "test_support")]
    fn research_price(self: @T, game_id: u32, row: u8, tier: u8) -> ResearchPrice;
}
