use starknet::storage::StorageMapWriteAccess;
use crate::progression::{ArmyProgress, ArmyProgressionRules, Attribute, BuyTier, ProgressPacking, ScoutingKind};
use crate::resources::IResourceOperationsDispatcherTrait;
use crate::stamina::{StaminaSourceTrait, StaminaTrait};
use crate::tests::state::{ResourceObservationTrait, TroopObservationTrait};

fn rules() -> ArmyProgressionRules {
    ArmyProgressionRules {
        reveal_xp: 2, fixed_xp: 200, uncommon_xp: 100, rare_xp: 200, epic_xp: 400, legendary_xp: 800,
    }
}
fn buy(attribute: Attribute) -> BuyTier {
    BuyTier { explorer_id: 7, attribute, kind: None }
}
fn scout(kind: ScoutingKind) -> BuyTier {
    BuyTier { explorer_id: 7, attribute: Attribute::Scouting, kind: Some(kind) }
}

#[test]
fn each_tier_costs_its_price_and_a_legendary_attribute_cannot_be_bought_further() {
    let mut progress = ArmyProgress { xp: 1600, ..crate::progression::initial() };
    for (tier, price) in array![(2_u8, 100_u32), (3, 200), (4, 400), (5, 800)] {
        let bought = crate::progression::buy_tier(ref progress, rules(), buy(Attribute::Battle));
        assert_eq!(bought.tier, tier);
        assert_eq!(bought.price, price);
    }
    assert_eq!(progress, ArmyProgress { xp: 100, battle: 5, ..crate::progression::initial() });
    // Any attribute may be bought while the XP lasts; nothing is rolled.
    crate::progression::buy_tier(ref progress, rules(), scout(ScoutingKind::Camp));
    assert_eq!(
        progress, ArmyProgress { xp: 0, battle: 5, scouting: 2, scouting_kinds: 1, ..crate::progression::initial() },
    );
}

#[test]
fn each_scouting_tier_raises_the_kind_chosen_for_it_by_its_relative_increment() {
    let mut progress = ArmyProgress { xp: 1500, ..crate::progression::initial() };
    assert_eq!(crate::progression::scouting_bonus(progress), (0, 0, 0));
    for kind in array![ScoutingKind::Rift, ScoutingKind::Camp, ScoutingKind::Rift, ScoutingKind::Rift] {
        crate::progression::buy_tier(ref progress, rules(), scout(kind));
    }
    // Uncommon, epic and legendary on rifts (+10%, +30%, +40%); rare on camps (+20%).
    assert_eq!(crate::progression::scouting_bonus(progress), (2000, 8000, 0));
    let mut all_rifts = ArmyProgress { xp: 1500, ..crate::progression::initial() };
    for _ in 0_u8..4 {
        crate::progression::buy_tier(ref all_rifts, rules(), scout(ScoutingKind::Rift));
    }
    assert_eq!(crate::progression::scouting_bonus(all_rifts), (0, 10000, 0));
}

#[test]
fn every_scouting_tier_may_raise_stragglers_once_they_exist() {
    let mut progress = ArmyProgress { xp: 1500, ..crate::progression::initial() };
    for _ in 0_u8..4 {
        crate::progression::buy_tier(ref progress, rules(), scout(ScoutingKind::Stragglers));
    }
    assert_eq!(crate::progression::scouting_bonus(progress), (0, 0, 10000));
}

#[test]
#[should_panic(expected: 'Scouting needs a kind')]
fn a_scouting_tier_needs_a_kind() {
    let mut progress = ArmyProgress { xp: 100, ..crate::progression::initial() };
    crate::progression::buy_tier(ref progress, rules(), buy(Attribute::Scouting));
}

#[test]
#[should_panic(expected: "only Scouting takes a kind")]
fn only_a_scouting_tier_takes_a_kind() {
    let mut progress = ArmyProgress { xp: 100, ..crate::progression::initial() };
    crate::progression::buy_tier(
        ref progress, rules(), BuyTier { explorer_id: 7, attribute: Attribute::Battle, kind: Some(ScoutingKind::Camp) },
    );
}

#[test]
#[should_panic(expected: "attribute is legendary")]
fn a_legendary_attribute_refuses_another_tier() {
    let mut progress = ArmyProgress { xp: 10000, logistics: 5, ..crate::progression::initial() };
    crate::progression::buy_tier(ref progress, rules(), buy(Attribute::Logistics));
}

#[test]
#[should_panic(expected: "not enough XP")]
fn a_tier_is_refused_without_its_price() {
    let mut progress = ArmyProgress { xp: 199, battle: 2, ..crate::progression::initial() };
    crate::progression::buy_tier(ref progress, rules(), buy(Attribute::Battle));
}

#[test]
fn a_clear_pays_two_and_a_half_times_the_root_of_the_guard_strength() {
    let troops = crate::rules::RESOURCE_PRECISION;
    for (strength, xp) in array![(430_u128, 51_u32), (1300, 90), (3000, 136), (25000, 395), (49500, 556)] {
        assert_eq!(crate::progression::clear_xp(strength * troops), xp);
    }
}

#[test]
#[fuzzer(runs: 64)]
fn packed_progress_round_trips_every_tier_and_the_full_xp_range(xp: u32, a: u8, b: u8, c: u8, d: u8, kinds: u8) {
    let progress = ArmyProgress {
        xp, battle: a % 5 + 1, logistics: b % 5 + 1, scouting: c % 5 + 1, scouting_kinds: kinds, homecoming: d % 5 + 1,
    };
    assert_eq!(ProgressPacking::unpack(ProgressPacking::pack(progress)), progress);
}

fn read_progress(d: super::Deployment, key: crate::troops::ExplorerKey) -> ArmyProgress {
    snforge_std::interact_with_state(d.games, || crate::logic::progression::require(key))
}
fn write_progress(d: super::Deployment, key: crate::troops::ExplorerKey, progress: ArmyProgress) {
    snforge_std::interact_with_state(d.games, || crate::logic::progression::write(key, progress));
}
fn execute_buy(d: super::Deployment, key: crate::troops::ExplorerKey, attribute: Attribute) -> bool {
    super::resource_commands::execute_in_game(
        d,
        key.game_id,
        crate::commands::Command::BuyTier(BuyTier { explorer_id: key.explorer_id, attribute, kind: None }),
        360,
    )
}
fn bar(d: super::Deployment, key: crate::troops::ExplorerKey, game_id: u32) -> u64 {
    snforge_std::interact_with_state(
        d.games,
        || {
            let context = crate::commands::load_context(
                game_id, crate::commands::ActionContext { raw_root: 123, timestamp: 360 },
            );
            crate::logic::troops::active_explorer(key, 360, context).troops.stamina.inline().amount
        },
    )
}

#[test]
fn reveals_clears_shrines_and_relic_chests_pay_their_xp() {
    let d = super::registrar::setup();
    let (game_id, _, category) = super::registrar::expedition_home(d);
    let (key, _) = super::registrar::expedition_armies(d, game_id, category);
    snforge_std::interact_with_state(
        d.games,
        || {
            crate::logic::progression::award_xp(key, crate::progression::XpAward::Reveal);
            crate::logic::progression::award_xp(
                key, crate::progression::XpAward::Clear(1300 * crate::rules::RESOURCE_PRECISION),
            );
            crate::logic::progression::grant_fixed_xp(key);
        },
    );
    assert_eq!(read_progress(d, key).xp, 2 + 90 + 200);
}

#[test]
fn buying_a_tier_charges_its_price_raises_one_tier_and_refills_thirty_stamina() {
    let d = super::registrar::setup();
    let (game_id, preset, category) = super::registrar::expedition_home(d);
    let (key, _) = super::registrar::expedition_armies(d, game_id, category);
    let tick = 360 / preset.rules.tick_config.armies_tick_in_seconds;
    write_progress(d, key, ArmyProgress { xp: 250, ..crate::progression::initial() });
    set_bar(d, key, 0, tick);
    assert!(execute_buy(d, key, Attribute::Battle));
    assert_eq!(read_progress(d, key), ArmyProgress { xp: 150, battle: 2, ..crate::progression::initial() });
    assert_eq!(bar(d, key, game_id), 30);
    // 150 XP buys no rare tier: the command is refused and nothing moves.
    assert!(!execute_buy(d, key, Attribute::Battle));
    assert_eq!(read_progress(d, key), ArmyProgress { xp: 150, battle: 2, ..crate::progression::initial() });
    assert_eq!(bar(d, key, game_id), 30);
}

#[test]
fn a_logistics_tier_raises_the_maximum_and_the_bar_takes_only_the_purchase_refill() {
    let d = super::registrar::setup();
    let (game_id, preset, category) = super::registrar::expedition_home(d);
    let (key, _) = super::registrar::expedition_armies(d, game_id, category);
    let rules = preset.rules.troop_stamina_config;
    let tick = 360 / preset.rules.tick_config.armies_tick_in_seconds;
    let base = crate::progression::stamina_max(crate::progression::initial(), crate::troops::TroopType::Knight, rules);
    // A full bar rises only as far as the new maximum; a low one takes the 30 a purchase refills.
    for (amount, after) in array![(base, base + 20), (40, 70)] {
        write_progress(d, key, ArmyProgress { xp: 100, ..crate::progression::initial() });
        set_bar(d, key, amount, tick);
        assert!(execute_buy(d, key, Attribute::Logistics));
        assert_eq!(bar(d, key, game_id), after);
        assert_eq!(
            crate::progression::stamina_max(read_progress(d, key), crate::troops::TroopType::Knight, rules), base + 20,
        );
    }
}

/// Sets the slot army's bar to `amount` at the current tick, through the troop write every action uses.
fn set_bar(d: super::Deployment, key: crate::troops::ExplorerKey, amount: u64, tick: u64) {
    snforge_std::interact_with_state(
        d.games,
        || {
            let mut troops = crate::logic::troops::explorer(key).unwrap().troops;
            troops.stamina = crate::troops::Stamina { amount, updated_tick: tick }.into();
            crate::logic::troops::TroopState::update_troops(key, troops);
        },
    );
}

/// The damage a slot army resolved at `battle` deals to a fixed defender, as Combat computes it.
fn damage_at_battle(
    d: super::Deployment, key: crate::troops::ExplorerKey, battle: u8, rules: crate::rules::SliceRules,
) -> u128 {
    snforge_std::interact_with_state(
        d.games, || crate::logic::progression::write(key, ArmyProgress { battle, ..crate::progression::initial() }),
    );
    let attacker = super::state::GameState { contract_address: d.games }.resolved_explorer(key).unwrap().troops;
    let tick = 360 / rules.tick_config.armies_tick_in_seconds;
    let stamina: crate::troops::StaminaSource = crate::troops::Stamina { amount: 150, updated_tick: tick }.into();
    let mut attacker = crate::troops::Troops { count: 1000 * crate::rules::RESOURCE_PRECISION, stamina, ..attacker };
    let mut defender = crate::troops::Troops {
        count: 1_000_000 * crate::rules::RESOURCE_PRECISION,
        battle_cooldown_end: 0,
        boosts: Default::default(),
        ..attacker,
    };
    let context = crate::combat::CombatContext {
        timestamp: 360,
        attacker_roll: 0,
        defender_roll: 0,
        attacker_biome: crate::biome::Biome::Grassland,
        defender_biome: crate::biome::Biome::Grassland,
        attack_distance: 1,
        attacker_is_structure_guard: false,
        defender_is_structure_guard: false,
    };
    let (dealt, _, _, _) = crate::combat::TroopsTrait::damage_with_context(
        ref attacker, ref defender, context, rules.troop_stamina_config, rules.troop_damage_config, tick, 0,
    );
    dealt
}

#[test]
fn battle_tiers_multiply_damage_by_the_ruled_table() {
    let d = super::registrar::setup();
    let (game_id, preset, category) = super::registrar::expedition_home(d);
    let (key, _) = super::registrar::expedition_armies(d, game_id, category);
    let common = damage_at_battle(d, key, 1, preset.rules);
    assert!(common > 0);
    // Uncommon to legendary: x1.1, x1.3, x1.6, x2.0, to Combat's rounding of losses to whole troops.
    let troop = crate::rules::RESOURCE_PRECISION;
    for (tier, tenths) in array![(2_u8, 11_u128), (3, 13), (4, 16), (5, 20)] {
        let dealt = damage_at_battle(d, key, tier, preset.rules);
        assert!(
            dealt * 10 >= common * tenths - 10 * troop && dealt * 10 <= common * tenths + 10 * troop,
            "Battle tier {} deals {} against {}",
            tier,
            dealt,
            common,
        );
    }
}

#[test]
fn logistics_tiers_set_the_maximum_stamina_by_the_ruled_table() {
    let (_, frontier) = super::preset_projection::current_definition("frontier");
    let rules = frontier.rules.troop_stamina_config;
    for (logistics, maximum) in array![(1_u8, 150_u64), (2, 170), (3, 200), (4, 240), (5, 300)] {
        let progress = ArmyProgress { logistics, ..crate::progression::initial() };
        assert_eq!(crate::progression::stamina_max(progress, crate::troops::TroopType::Knight, rules), maximum);
    }
}

#[test]
fn added_stamina_stops_at_the_armys_own_maximum() {
    let (_, frontier) = super::preset_projection::current_definition("frontier");
    let rules = frontier.rules.troop_stamina_config;
    let maximum = crate::progression::stamina_max(
        ArmyProgress { logistics: 3, ..crate::progression::initial() }, crate::troops::TroopType::Knight, rules,
    );
    assert_eq!(maximum, 200);
    let mut boosts: crate::troops::TroopBoosts = Default::default();
    // Past the troop's base of 150, up to the army's own 200, and never beyond it.
    let mut bar = crate::troops::Stamina { amount: 140, updated_tick: 5 };
    bar.add(ref boosts, maximum, rules, 25, 5);
    assert_eq!(bar.amount, 165);
    bar.add(ref boosts, maximum, rules, 50, 5);
    assert_eq!(bar.amount, 200);
}

#[test]
fn an_armys_own_maximum_reads_its_logistics_tier_and_a_troops_without_progress() {
    let d = super::registrar::setup();
    let (game_id, preset, category) = super::registrar::expedition_home(d);
    let (key, _) = super::registrar::expedition_armies(d, game_id, category);
    let rules = preset.rules.troop_stamina_config;
    write_progress(d, key, ArmyProgress { logistics: 3, ..crate::progression::initial() });
    let (troops, own, other) = snforge_std::interact_with_state(
        d.games,
        || {
            let troops = crate::logic::troops::explorer(key).unwrap().troops;
            let other = crate::troops::ExplorerKey { game_id, explorer_id: 9999 };
            (
                troops,
                crate::logic::progression::own_stamina_max(key, troops, rules),
                crate::logic::progression::own_stamina_max(other, troops, rules),
            )
        },
    );
    assert_eq!(own, crate::stamina::StaminaImpl::max(troops.category, crate::troops::TroopTier::T1, rules) + 50);
    assert_eq!(other, crate::stamina::StaminaImpl::max(troops.category, troops.tier, rules));
}

#[test]
fn homecoming_returns_each_expired_armys_own_share_of_its_survivors() {
    let d = super::registrar::setup();
    let (game_id, _, category) = super::registrar::expedition_home(d);
    let (first, second) = super::registrar::expedition_armies(d, game_id, category);
    let troop = crate::rules::RESOURCE_PRECISION;
    let stock = snforge_std::interact_with_state(
        d.games,
        || {
            // An unlimited store isolates the share from capacity clipping.
            crate::state::write()
                .resources
                .weights
                .write(
                    (game_id, 1), crate::resources::Weight { capacity: 0xffffffffffffffffffffffffffffffff, weight: 0 },
                );
            // The first army ends the day 10,000 strong at epic Homecoming, the second 1,000 strong at rare.
            for (key, count, homecoming) in array![(first, 10_000_u128, 4_u8), (second, 1_000, 3)] {
                let mut troops = crate::logic::troops::explorer(key).unwrap().troops;
                troops.count = count * troop;
                crate::logic::troops::TroopState::update_troops(key, troops);
                crate::logic::progression::write(key, ArmyProgress { homecoming, ..crate::progression::initial() });
            }
            let troops = crate::logic::troops::explorer(first).unwrap().troops;
            crate::troops::stock_resource(troops.category, troops.tier)
        },
    );
    let resources = crate::resources::IResourceOperationsDispatcher { contract_address: d.games };
    let slot = crate::resources::ResourceSlot { game_id, entity_id: 1, resource_type: stock };
    let before = resources.resource_balance(slot);
    let tomorrow = super::registrar::day_start(d, game_id, 1);
    // The next day's first deploy removes yesterday's armies: 18% of 10,000 and 9% of 1,000 come home.
    assert!(
        super::resource_commands::execute_in_game(d, game_id, super::registrar::muster_command(category, 0), tomorrow),
    );
    let troops = super::state::GameState { contract_address: d.games };
    assert!(troops.explorer(first).is_none() && troops.explorer(second).is_none());
    assert_eq!(resources.resource_balance(slot), before + 1800 * troop + 90 * troop - troop);
}

#[test]
fn homecoming_returns_whole_troops_and_nothing_at_common() {
    for (count, homecoming, returned) in array![(10_000_u128, 1_u8, 0_u128), (99, 4, 17), (33, 2, 0), (34, 2, 1)] {
        let share: u128 = crate::rules::homecoming_bps(homecoming).into();
        assert_eq!(count * share / 10000, returned);
    }
    assert_eq!(crate::rules::homecoming_bps(5), 3000);
}

fn deploy(d: super::Deployment, game_id: u32, category: u8, direction: u8) -> crate::troops::ExplorerKey {
    let home = crate::resources::ResourceKey { game_id, entity_id: 1 };
    let command = crate::commands::Command::CreateExplorer(
        crate::commands::CreateExplorer {
            structure_id: 1, category, tier: 0, amount: 3 * crate::rules::RESOURCE_PRECISION, direction,
        },
    );
    assert!(super::resource_commands::execute_in_game(d, game_id, command, 351));
    let armies = crate::tests::state::StructureObservationTrait::home_armies(
        crate::structures::IStructureOperationsDispatcher { contract_address: d.games }, home,
    );
    crate::troops::ExplorerKey { game_id, explorer_id: *armies.at(armies.len() - 1) }
}

#[test]
fn training_starts_only_later_armies_at_their_realms_tiers_and_full_at_their_logistics_maximum() {
    let d = super::registrar::setup();
    let (game_id, preset, category) = super::registrar::expedition_home(d);
    let home = crate::resources::ResourceKey { game_id, entity_id: 1 };
    snforge_std::start_cheat_caller_address(d.games, d.games);
    crate::resources::IResourceOperationsDispatcher { contract_address: d.games }
        .grant_resource(
            home,
            26,
            1000 * crate::rules::RESOURCE_PRECISION,
            351,
            crate::commands::resource_context(
                crate::commands::ExecutionContext { timestamp: 351, ..crate::tests::context(d.games, game_id) },
            ),
        );
    snforge_std::stop_cheat_caller_address(d.games);
    let untrained = deploy(d, game_id, category, 0);
    assert_eq!(read_progress(d, untrained), crate::progression::initial());

    // War hall rare, Supply yard uncommon, Hearth epic; the Scouts' lodge untrained.
    let mut learned = 0;
    for (row, tiers) in array![
        (crate::research::ROW_WAR_HALL, 2_u8), (crate::research::ROW_SUPPLY_YARD, 1), (crate::research::ROW_HEARTH, 3),
    ] {
        for _ in 0..tiers {
            learned = crate::research::learn(learned, row, 0);
        }
    }
    let learned = learned;
    snforge_std::interact_with_state(
        d.games, || crate::logic::research::write(home, crate::research::RealmKnowledge { learned }),
    );
    let trained = deploy(d, game_id, category, 1);
    let progress = read_progress(d, trained);
    assert_eq!(
        (progress.battle, progress.logistics, progress.scouting, progress.homecoming, progress.xp), (3, 2, 1, 4, 0),
    );
    // Training changes no army already deployed.
    assert_eq!(read_progress(d, untrained), crate::progression::initial());
    let troops = super::state::GameState { contract_address: d.games }.resolved_explorer(trained).unwrap().troops;
    assert_eq!(
        troops.stamina.inline().amount,
        crate::progression::stamina_max(progress, troops.category, preset.rules.troop_stamina_config),
    );
    assert_eq!(
        troops.stamina.inline().amount,
        crate::stamina::StaminaImpl::max(
            troops.category, crate::troops::TroopTier::T1, preset.rules.troop_stamina_config,
        )
            + crate::rules::logistics_stamina(2).into(),
    );
}

#[test]
fn trained_scouting_carries_every_choice_from_the_lodge() {
    let mut learned = 0;
    for kind in array![
        crate::research::KIND_RIFTS, crate::research::KIND_CAMPS, crate::research::KIND_STRAGGLERS,
        crate::research::KIND_RIFTS,
    ] {
        learned = crate::research::learn(learned, crate::research::ROW_SCOUTS_LODGE, kind);
    }
    let progress = crate::progression::trained(learned);
    assert_eq!(progress.scouting, 5);
    assert_eq!(progress.scouting_kinds, 2 + 4 + 3 * 16 + 2 * 64);
    assert_eq!(progress.xp, 0);
}
