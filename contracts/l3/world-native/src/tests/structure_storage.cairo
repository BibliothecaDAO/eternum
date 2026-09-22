use starknet::storage_access::Store;
use crate::structures::{StructureBase, StructureBasePacking, StructureMetadata, StructureMetadataPacking};
use crate::troops::{Stamina, TroopBoosts, TroopBoostsPacking, TroopTier, TroopType, Troops, TroopsPacking};

#[test]
fn structure_base_storage_has_one_slot_and_preserves_boundaries() {
    assert!(Store::<StructureBase>::size() == 1);
    assert!(StructureBasePacking::pack(Default::default()) == 0);
    let maximum = StructureBase {
        troop_explorer_count: 0xffff,
        troop_max_guard_count: 0xff,
        troop_max_explorer_count: 0xffff,
        created_at: 0xffffffff,
        category: 0xff,
        coord_x: 0xffffffff,
        coord_y: 0xffffffff,
        level: 0xff,
        starting_troops_granted: true,
        alt: true,
    };
    let packed = 0xffffffffffffffff00000003ffffffffffffffffffffff00;
    assert!(StructureBasePacking::pack(maximum) == packed);
    assert!(StructureBasePacking::unpack(packed) == maximum);
}

#[test]
#[fuzzer(runs: 256)]
fn structure_base_storage_keeps_fields_independent(
    explorers: u16,
    guard_limit: u8,
    explorer_limit: u16,
    created_at: u32,
    category: u8,
    x: u32,
    y: u32,
    level: u8,
    granted: bool,
    alt: bool,
) {
    let original = StructureBase {
        troop_explorer_count: explorers,
        troop_max_guard_count: guard_limit,
        troop_max_explorer_count: explorer_limit,
        created_at,
        category,
        coord_x: x,
        coord_y: y,
        level,
        starting_troops_granted: granted,
        alt,
    };
    assert!(StructureBasePacking::unpack(StructureBasePacking::pack(original)) == original);
    let updated = StructureBase { starting_troops_granted: !granted, ..original };
    assert!(StructureBasePacking::unpack(StructureBasePacking::pack(updated)) == updated);
}

#[test]
fn troop_boost_storage_has_one_slot_and_preserves_boundaries() {
    assert!(Store::<TroopBoosts>::size() == 1);
    assert!(TroopBoostsPacking::pack(Default::default()) == 0);
    let maximum = TroopBoosts {
        incr_damage_dealt_percent_num: 0xffff,
        incr_damage_dealt_end_tick: 0xffffffff,
        decr_damage_gotten_percent_num: 0xffff,
        decr_damage_gotten_end_tick: 0xffffffff,
        incr_stamina_regen_percent_num: 0xffff,
        incr_stamina_regen_tick_count: 0xff,
        incr_explore_reward_percent_num: 0xffff,
        incr_explore_reward_end_tick: 0xffffffff,
    };
    let packed = 0xffffffffffff00ffffffffffffffffffffffffffffff;
    assert!(TroopBoostsPacking::pack(maximum) == packed);
    assert!(TroopBoostsPacking::unpack(packed) == maximum);
}

#[test]
#[fuzzer(runs: 256)]
fn troop_boost_storage_keeps_fields_independent(
    damage: u16,
    damage_end: u32,
    defense: u16,
    defense_end: u32,
    stamina: u16,
    stamina_ticks: u8,
    reward: u16,
    reward_end: u32,
) {
    let original = TroopBoosts {
        incr_damage_dealt_percent_num: damage,
        incr_damage_dealt_end_tick: damage_end,
        decr_damage_gotten_percent_num: defense,
        decr_damage_gotten_end_tick: defense_end,
        incr_stamina_regen_percent_num: stamina,
        incr_stamina_regen_tick_count: stamina_ticks,
        incr_explore_reward_percent_num: reward,
        incr_explore_reward_end_tick: reward_end,
    };
    assert!(TroopBoostsPacking::unpack(TroopBoostsPacking::pack(original)) == original);
}


#[test]
#[fuzzer(runs: 256)]
fn structure_metadata_storage_preserves_realm_and_village_identities(
    realm_id: u16, order: u8, has_wonder: bool, village_realm: u32, mine_kind: u8, attunement: u8,
) {
    let value = StructureMetadata { realm_id, order, has_wonder, village_realm, mine_kind, attunement };
    assert!(Store::<StructureMetadata>::size() == 1);
    assert!(StructureMetadataPacking::unpack(StructureMetadataPacking::pack(value)) == value);
}

#[test]
#[fuzzer(runs: 256)]
fn troop_storage_preserves_counts_stamina_and_combat(
    category: u8, tier: u8, count: u128, stamina: u64, updated_tick: u64, cooldown: u32,
) {
    let category = match category % 3 {
        0 => TroopType::Knight,
        1 => TroopType::Paladin,
        _ => TroopType::Crossbowman,
    };
    let tier = match tier % 3 {
        0 => TroopTier::T1,
        1 => TroopTier::T2,
        _ => TroopTier::T3,
    };
    let boosts = TroopBoosts {
        incr_damage_dealt_percent_num: 0xffff,
        incr_damage_dealt_end_tick: 0xffffffff,
        decr_damage_gotten_percent_num: 0xffff,
        decr_damage_gotten_end_tick: 0xffffffff,
        incr_stamina_regen_percent_num: 0xffff,
        incr_stamina_regen_tick_count: 0xff,
        incr_explore_reward_percent_num: 0xffff,
        incr_explore_reward_end_tick: 0xffffffff,
    };
    let value = Troops {
        category,
        tier,
        count,
        stamina: Stamina { amount: stamina, updated_tick },
        boosts,
        battle_cooldown_end: cooldown,
    };
    assert!(Store::<Troops>::size() == 4);
    assert!(TroopsPacking::unpack(TroopsPacking::pack(value)) == value);
}
