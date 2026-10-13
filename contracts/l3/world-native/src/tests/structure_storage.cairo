use crate::structures::{StructureBase, StructureBasePacking, StructureMetadata, StructureMetadataPacking};
use crate::troops::{Stamina, TroopBoosts, TroopBoostsPacking, TroopTier, TroopType, Troops, TroopsPacking};

#[test]
fn structure_base_storage_round_trips_empty_and_maximum_values() {
    assert_eq!(StructureBasePacking::unpack(StructureBasePacking::pack(Default::default())), Default::default());
    let maximum = StructureBase {
        troop_max_guard_count: 0xff,
        troop_max_explorer_count: 0xffff,
        created_at: 0xffffffff,
        category: 0xff,
        level: 0xff,
        starting_troops_granted: true,
    };
    assert_eq!(StructureBasePacking::unpack(StructureBasePacking::pack(maximum)), maximum);
}

#[test]
#[fuzzer(runs: 256)]
fn structure_base_storage_keeps_fields_independent(
    guard_limit: u8, explorer_limit: u16, created_at: u32, category: u8, level: u8, granted: bool,
) {
    let original = StructureBase {
        troop_max_guard_count: guard_limit,
        troop_max_explorer_count: explorer_limit,
        created_at,
        category,
        level,
        starting_troops_granted: granted,
    };
    assert!(StructureBasePacking::unpack(StructureBasePacking::pack(original)) == original);
    let updated = StructureBase { starting_troops_granted: !granted, ..original };
    assert!(StructureBasePacking::unpack(StructureBasePacking::pack(updated)) == updated);
}

#[test]
fn troop_boost_storage_round_trips_empty_and_maximum_values() {
    assert_eq!(TroopBoostsPacking::unpack(TroopBoostsPacking::pack(Default::default())), Default::default());
    let maximum = TroopBoosts {
        incr_damage_dealt_percent_num: 0xffff,
        incr_damage_dealt_end_at: 0xffffffff,
        decr_damage_gotten_percent_num: 0xffff,
        decr_damage_gotten_end_at: 0xffffffff,
        incr_stamina_regen_percent_num: 0xffff,
        incr_stamina_regen_seconds_left: 0xffff,
        incr_explore_reward_percent_num: 0xffff,
        incr_explore_reward_end_at: 0xffffffff,
    };
    assert_eq!(TroopBoostsPacking::unpack(TroopBoostsPacking::pack(maximum)), maximum);
}

#[test]
#[fuzzer(runs: 256)]
fn troop_boost_storage_keeps_fields_independent(
    damage: u16,
    damage_end: u32,
    defense: u16,
    defense_end: u32,
    stamina: u16,
    stamina_seconds: u16,
    reward: u16,
    reward_end: u32,
) {
    let original = TroopBoosts {
        incr_damage_dealt_percent_num: damage,
        incr_damage_dealt_end_at: damage_end,
        decr_damage_gotten_percent_num: defense,
        decr_damage_gotten_end_at: defense_end,
        incr_stamina_regen_percent_num: stamina,
        incr_stamina_regen_seconds_left: stamina_seconds,
        incr_explore_reward_percent_num: reward,
        incr_explore_reward_end_at: reward_end,
    };
    assert!(TroopBoostsPacking::unpack(TroopBoostsPacking::pack(original)) == original);
}

#[test]
#[fuzzer(runs: 256)]
fn structure_metadata_storage_preserves_realm_and_village_identities(
    realm_id: u16, order: u8, has_wonder: bool, village_realm: u64, mine_kind: u8, deepest_depth: u8,
) {
    let value = StructureMetadata { realm_id, order, has_wonder, village_realm, mine_kind, deepest_depth };
    assert!(StructureMetadataPacking::unpack(StructureMetadataPacking::pack(value)) == value);
}

#[test]
#[fuzzer(runs: 256)]
fn troop_storage_preserves_counts_stamina_and_combat(
    category: u8, tier: u8, count: u128, stamina: u64, settled_at: u32, remainder: u32, cooldown: u32,
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
        incr_damage_dealt_end_at: 0xffffffff,
        decr_damage_gotten_percent_num: 0xffff,
        decr_damage_gotten_end_at: 0xffffffff,
        incr_stamina_regen_percent_num: 0xffff,
        incr_stamina_regen_seconds_left: 0xffff,
        incr_explore_reward_percent_num: 0xffff,
        incr_explore_reward_end_at: 0xffffffff,
    };
    let value = Troops {
        category,
        tier,
        count,
        stamina: Stamina { amount: stamina, settled_at, remainder }.into(),
        boosts,
        battle_cooldown_end: cooldown,
    };
    assert!(TroopsPacking::unpack(TroopsPacking::pack(value)) == value);
    let bar = Stamina { amount: stamina, settled_at, remainder };
    assert_eq!(crate::troops::StaminaPacking::unpack(crate::troops::StaminaPacking::pack(bar)), bar);
}

#[test]
fn slot_stamina_packing_preserves_every_slot_and_the_full_inline_bar() {
    for slot in 0_u16..256 {
        let value = Troops {
            stamina: crate::troops::StaminaSource::Slot(slot.try_into().unwrap()), ..Default::default(),
        };
        assert_eq!(TroopsPacking::unpack(TroopsPacking::pack(value)), value);
    }
    let value = Troops {
        stamina: Stamina { amount: 0xffffffffffffffff, settled_at: 0xffffffff, remainder: 0xffffffff }.into(),
        ..Default::default(),
    };
    assert_eq!(TroopsPacking::unpack(TroopsPacking::pack(value)), value);
}
