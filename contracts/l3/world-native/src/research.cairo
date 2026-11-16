use crate::resources::ResourceKey;

// Two-sided rows store two independent three-bit counts. Scouts retains its ordered kind choices; other rows
// store their tier. This next-season layout is part of the release schema, not a migration of existing knowledge.
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct RealmKnowledge {
    pub learned: u64,
}

// The rows of the castle's tree. A building row climbs from 0 to Legendary V for every building of its type; the
// castle rows unlock shrines, wells and the three depths.
pub const ROW_FARM: u8 = 0;
pub const ROW_WORKSHOP: u8 = 1;
pub const ROW_HUT: u8 = 3;
pub const ROW_SUPPLY_YARD: u8 = 5;
pub const ROW_SHRINE: u8 = 8;
pub const ROW_WELL: u8 = 9;
pub const ROW_DEPTH: u8 = 10;

// Farm and Workshop tiers make more (Fields, Tools) or store more (Granary, Storeroom).
pub const CHOICE_MAKE: u8 = 0;
pub const CHOICE_STORE: u8 = 1;
// The kind each Scouts' lodge tier finds more of.



// Building categories with a row; the four training buildings are unique on a realm board.
pub const HUT: u8 = 1;
pub const WORKSHOP: u8 = 25;
pub const BARRACKS: u8 = 28;
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

// Buys the next tier of a row. `choice` picks the tier's side on Farm and Workshop rows and the kind on the
// Scouts' lodge row; every other row takes 0.
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct Research {
    pub structure_id: u64,
    pub row: u8,
    pub choice: u8,
}

pub fn row_category(row: u8) -> u8 {
    match row {
        ROW_FARM => FARM,
        ROW_WORKSHOP => WORKSHOP,
        ROW_HUT => HUT,
        ROW_SUPPLY_YARD => SUPPLY_YARD,
        ROW_SHRINE | ROW_WELL | ROW_DEPTH => 0,
        _ => panic!("invalid research row"),
    }
}

pub fn is_training(category: u8) -> bool { category == SUPPLY_YARD }

pub const ROWS: [u8; 7] = [ROW_FARM, ROW_WORKSHOP, ROW_HUT, ROW_SUPPLY_YARD, ROW_SHRINE, ROW_WELL, ROW_DEPTH];

pub fn max_tier(row: u8) -> u8 {
    match row {
        ROW_FARM | ROW_WORKSHOP | ROW_HUT | ROW_SUPPLY_YARD => 5,
        ROW_SHRINE | ROW_WELL => 1,
        ROW_DEPTH => 3,
        _ => panic!("invalid research row"),
    }
}

// How many sides a row's choice has: two for Farm and Workshop, three kinds for the Scouts' lodge.
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
        3 => (0x200000, 8),
        5 => (0x8000000, 8),
        8 => (0x400000000000, 2),
        9 => (0x800000000000, 2),
        10 => (0x1000000000000, 4),
        _ => panic!("invalid research row"),
    }
}

// Where a row's choices sit: the first tier's scale and the field size of one choice. Later tiers follow in order.


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

// The choice made at a tier, from 1 (Common) up to the row's tier.


// The upgrades bought on one side; Scouts still counts its ordered kind selections.
pub fn picks(learned: u64, row: u8, side: u8) -> u8 {
    assert!(side < choice_count(row), "invalid research choice");
    if independent_sides(row) {
        let (scale, _) = tier_slot(row);
        let scale = if side == 0 { scale } else { scale * 8 };
        (learned / scale % 8).try_into().unwrap()
    } else { tier(learned, row) }
}

// The Fields or Tools picks of a building type; a type without a make-or-store row has none.
pub fn make_picks(learned: u64, category: u8) -> u8 {
    if category == FARM {
        picks(learned, ROW_FARM, CHOICE_MAKE)
    } else if category == WORKSHOP {
        picks(learned, ROW_WORKSHOP, CHOICE_MAKE)
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

// Adds one upgrade to the chosen side, or the next shared tier for Scouts and single-sided rows.
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
