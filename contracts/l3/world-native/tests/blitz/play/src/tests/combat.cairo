pub use world_test_support::tests::combat_formula::{context, damage_config, stamina_config, test_troops};
pub use world_test_support::tests::troop_management::*;
use crate::biome::Biome;
use crate::combat::CombatContext;
use super::fixture::{RAISED_AT, REALM_COORD, RESTED_AT, blitz_realm, raise, rival_realm_at, step_east};
use super::resource_commands::{assert_executes, grant};

const WEST: u8 = 3;
const UNITS: u128 = 100;

fn army(d: super::Deployment, game_id: u32, id: u64) -> ExplorerTroops {
    GameState { contract_address: d.games }.explorer(ExplorerKey { game_id, explorer_id: id }).unwrap()
}

fn face_off(category: TroopType, rival_at: u32) -> (super::Deployment, ResourceKey, u64, u64) {
    let (d, home) = blitz_realm();
    let mine = raise(d, d.actor, home, category, 0, UNITS, 0);
    let (rival, realm) = rival_realm_at(d, home, step_east(REALM_COORD, rival_at));
    let theirs = raise(d, rival, realm, TroopType::Knight, 0, UNITS, WEST);
    (d, home, mine, theirs)
}

fn battle(attacker: u64, defender: u64) -> Command {
    Command::Battle(
        crate::combat_actions::AttackExplorer {
            attacker_id: attacker, defender_id: defender, steal_resources: array![].span(),
        },
    )
}

fn stormed(context: CombatContext, attacker: TroopType, defender: TroopType) -> (u128, u128) {
    let mut alpha = test_troops(attacker, TroopTier::T1, 1000, 100);
    let mut bravo = test_troops(defender, TroopTier::T1, 1000, 100);
    let (dealt, taken, _, _) = alpha.damage_with_context(ref bravo, context, stamina_config(), damage_config(), 60, 60);
    (dealt, taken)
}

fn assert_ratio(scaled: u128, base: u128, numerator: u128, denominator: u128) {
    let expected = base * numerator / denominator;
    let gap = if scaled > expected {
        scaled - expected
    } else {
        expected - scaled
    };
    assert!(gap <= 2 * RESOURCE_PRECISION, "{} is not {}/{} of {}", scaled, numerator, denominator, base);
}

#[test]
fn a_crossbow_army_strikes_an_army_two_tiles_away_and_takes_no_damage_back() {
    let (d, home, mine, theirs) = face_off(TroopType::Crossbowman, 4);
    assert_eq!(army(d, home.game_id, theirs).coord, step_east(REALM_COORD, 3));
    assert_executes(d, home.game_id, battle(mine, theirs), RESTED_AT);
    assert_eq!(army(d, home.game_id, mine).troops.count, UNITS * RESOURCE_PRECISION);
    assert!(army(d, home.game_id, theirs).troops.count < UNITS * RESOURCE_PRECISION);
}

#[test]
fn armies_side_by_side_outside_any_deep_both_lose_troops() {
    let (d, home, mine, theirs) = face_off(TroopType::Knight, 3);
    assert_eq!(army(d, home.game_id, theirs).coord, step_east(REALM_COORD, 2));
    assert_executes(d, home.game_id, battle(mine, theirs), RESTED_AT);
    assert!(army(d, home.game_id, mine).troops.count < UNITS * RESOURCE_PRECISION);
    assert!(army(d, home.game_id, theirs).troops.count < UNITS * RESOURCE_PRECISION);
}

#[test]
fn a_crossbow_guard_strikes_a_rival_army_two_tiles_from_its_realm() {
    let (d, home) = blitz_realm();
    let crossbows = crate::troops::troop_resource(TroopType::Crossbowman, 0);
    grant(d, home, crossbows, UNITS * RESOURCE_PRECISION);
    let guard = GuardSlot { structure_id: home.entity_id, slot: 0 };
    let recruit = RecruitGuard {
        guard, category: TroopType::Crossbowman, tier: TroopTier::T1, amount: UNITS * RESOURCE_PRECISION,
    };
    assert_executes(d, home.game_id, Command::ManageTroops(ManageTroops::RecruitGuard(recruit)), RAISED_AT);
    let (rival, realm) = rival_realm_at(d, home, step_east(REALM_COORD, 3));
    let theirs = raise(d, rival, realm, TroopType::Knight, 0, UNITS, WEST);
    let strike = Command::GuardAttack(crate::combat_actions::GuardAttack { guard, explorer_id: theirs });
    assert_executes(d, home.game_id, strike, RESTED_AT);
    let garrison = IGuardsDispatcher { contract_address: d.games }
        .guard(GuardKey { game_id: home.game_id, structure_id: home.entity_id, slot: 0 });
    assert_eq!(garrison.troops.count, UNITS * RESOURCE_PRECISION);
    assert!(army(d, home.game_id, theirs).troops.count < UNITS * RESOURCE_PRECISION);
}

#[test]
fn a_knight_storming_a_structure_guard_deals_more_than_against_an_army() {
    let melee = CombatContext { attack_distance: 1, ..context(Biome::Grassland) };
    let (open, _) = stormed(melee, TroopType::Knight, TroopType::Paladin);
    let (assault, _) = stormed(
        CombatContext { defender_is_structure_guard: true, ..melee }, TroopType::Knight, TroopType::Paladin,
    );
    assert_ratio(assault, open, 115, 100);
}

#[test]
fn a_ranged_crossbow_takes_no_damage_back_and_hits_a_guard_less_than_an_army() {
    let ranged = CombatContext { attack_distance: 2, ..context(Biome::Grassland) };
    let (open, open_back) = stormed(ranged, TroopType::Crossbowman, TroopType::Paladin);
    let (walls, walls_back) = stormed(
        CombatContext { defender_is_structure_guard: true, ..ranged }, TroopType::Crossbowman, TroopType::Paladin,
    );
    assert_eq!((open_back, walls_back), (0, 0));
    assert_ratio(walls, open, 30, 70);
}

#[test]
fn a_defender_short_of_stamina_strikes_back_weaker() {
    let melee = CombatContext { attack_distance: 1, ..context(Biome::Grassland) };
    let (_, rested) = stormed(melee, TroopType::Knight, TroopType::Knight);
    let mut alpha = test_troops(TroopType::Knight, TroopTier::T1, 1000, 100);
    let mut tired = test_troops(TroopType::Knight, TroopTier::T1, 1000, 10);
    let (_, weary, _, _) = alpha.damage_with_context(ref tired, melee, stamina_config(), damage_config(), 60, 60);
    assert_ratio(weary, rested, 70, 100);
}
