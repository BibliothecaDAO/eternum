use starknet::storage::{
    Mutable, StorageMapReadAccess, StorageMapWriteAccess, StoragePath, StoragePathEntry, StoragePointerReadAccess,
    StoragePointerWriteAccess,
};
use crate::resources::{ResourceAmount, ResourceRule};

type PresetWrite = StoragePath<Mutable<crate::state::Preset>>;

pub fn store(commitment: felt252, definition: crate::presets::PresetDefinition) {
    let preset = crate::state::write().presets.entry(commitment);
    if record_exists(preset) {
        return;
    }
    preset.rules.write(definition.rules);
    let classes = crate::state::read().releases.read(crate::state::read().current_release.read()).classes;
    crate::presets::IPresetResourcesDispatcherTrait::store_resource_preset(
        crate::presets::IPresetResourcesLibraryDispatcher { class_hash: classes.production },
        commitment,
        definition.resources,
        definition.exploration,
        definition.rules.mode_rules,
    );
    crate::presets::IPresetStructuresDispatcherTrait::store_structure_preset(
        crate::presets::IPresetStructuresLibraryDispatcher { class_hash: classes.construction },
        commitment,
        definition.structures,
    );
    crate::presets::IPresetSettlementDispatcherTrait::store_settlement_preset(
        crate::presets::IPresetSettlementLibraryDispatcher { class_hash: classes.placement },
        commitment,
        definition.settlement,
        definition.rules.entry_rule,
        definition.rules.mode_rules,
        definition.rules.day_unit_seconds,
    );
    write_economy(preset, commitment, definition.rules, definition.economy);
    preset.season_win_points.write(definition.season_win_points);
}

// Resource tables are owned by Production; registration remains one atomic transaction.
pub fn store_resources(
    commitment: felt252,
    resources: crate::presets::ResourcePreset,
    exploration: Span<crate::exploration_rewards::ExplorationReward>,
    mode_rules: u32,
) {
    crate::logic::release::assert_authority();
    let preset = crate::state::write().presets.entry(commitment);
    write_resources(preset, resources.resources);
    write_production(preset, resources.production);
    write_mines(preset, resources.mine_kinds, resources.surface_mines);
    write_exploration(preset, mode_rules, exploration);
}

pub fn store_structures(commitment: felt252, structures: crate::presets::StructurePreset) {
    crate::logic::release::assert_authority();
    write_structures(crate::state::write().presets.entry(commitment), structures);
}

fn record_exists(preset: PresetWrite) -> bool {
    // Every validated preset has a nonzero army tick, including one without an exploration pool.
    // Registration is atomic: a failed write cannot leave this marker on a partial record.
    preset.rules.tick_config.armies_tick_in_seconds.read() != 0
}

pub fn for_game(game_id: u32) -> StoragePath<crate::state::Preset> {
    let state = crate::state::read();
    let preset_id = state.games.games.entry(game_id).preset_id.read();
    assert!(preset_id != 0, "game does not exist");
    let commitment = state.registrar.presets.read(preset_id);
    assert!(commitment != 0, "game has no preset");
    state.presets.entry(commitment)
}

fn write_structures(preset: PresetWrite, structures: crate::presets::StructurePreset) {
    write_buildings(preset, structures.buildings, structures.board);
    write_research(preset, structures);
    let camps = structures.camps;
    for index in 0..camps.resources.len() {
        let resource = *camps.resources.at(index);
        crate::resources::assert_resource(resource.resource_type);
        preset.camp_grants.write(index, resource);
    }
    preset.camp_resource_count.write(camps.resources.len());
    preset.camp_labor_rate.write(camps.labor_rate);
    assert!(structures.faith.owner_share_bps <= 10000, "invalid faith owner share");
    preset.faith_rules.write(structures.faith);
    write_upgrades(preset, structures.upgrade_limits, structures.upgrades);
}

pub fn store_settlement(
    commitment: felt252,
    settlement: crate::presets::SettlementPreset,
    entry_rule: u8,
    mode_rules: u32,
    day_unit_seconds: u32,
) {
    crate::logic::release::assert_authority();
    let preset = crate::state::write().presets.entry(commitment);
    preset
        .settlement_mode
        .write(
            if entry_rule == crate::rules::ENTRY_ROSTER {
                settlement.mode
            } else {
                crate::settlement::SettlementMode::Single
            },
        );
    preset.settlement_spacing.write(settlement.spacing);
    write_depths(preset, mode_rules, day_unit_seconds, settlement.depths);
    write_realm_grants(preset, settlement.realms);
    write_villages(preset, settlement.villages);
    preset.spires.write(settlement.spires);
}

fn write_economy(
    preset: PresetWrite, commitment: felt252, rules: crate::rules::SliceRules, economy: crate::presets::EconomyPreset,
) {
    preset.labor_rules.write(economy.labor);
    preset.trade_rules.write(economy.trade);
    write_banks(preset, economy.banks);
    write_hyperstructures(preset, rules, economy.hyperstructures);
    write_relics(preset, rules, economy.relics, economy.chests);
    preset.progression_rules.write(economy.progression);
    preset.discovery_rules.write(economy.discovery);
    preset.artificer_cost.write(economy.research_cost);
    if let Some(withdrawals) = economy.withdrawals {
        let classes = crate::state::read().releases.read(crate::state::read().current_release.read()).classes;
        crate::presets::IPresetWithdrawalsDispatcherTrait::store_withdrawal_preset(
            crate::presets::IPresetWithdrawalsLibraryDispatcher { class_hash: classes.bridge }, commitment, withdrawals,
        );
    }
}

fn write_resources(preset: PresetWrite, rules: Span<ResourceRule>) {
    assert!(rules.len() == 58, "incomplete resource rules");
    for index in 0_u32..58 {
        let rule = *rules.at(index);
        assert!(rule.resource_type.into() == index + 1, "resource rules must be ordered");
        preset
            .resource_rules
            .write(
                rule.resource_type,
                (
                    rule.unit_weight,
                    Into::<u64, u128>::into(rule.realm_rate)
                        + Into::<u64, u128>::into(rule.village_rate) * crate::resources::RESOURCE_RATE_SCALE,
                ),
            );
    }
}

fn write_production(preset: PresetWrite, recipes: Span<crate::production::RecipeConfig>) {
    assert!(recipes.len() == 58, "incomplete production recipes");
    let mut expected = 1_u8;
    for config in recipes {
        assert!(*config.resource_type == expected, "production recipes must be ordered");
        let recipe = *config.recipe;
        preset
            .production_terms
            .write(
                expected,
                crate::production::RecipeTerms {
                    simple_output: recipe.simple_output,
                    complex_output: recipe.complex_output,
                    simple_count: recipe.simple_inputs.len().try_into().unwrap(),
                    complex_count: recipe.complex_inputs.len().try_into().unwrap(),
                },
            );
        write_inputs(preset, expected, false, recipe.simple_inputs);
        write_inputs(preset, expected, true, recipe.complex_inputs);
        expected += 1;
    }
}

fn write_inputs(preset: PresetWrite, resource_type: u8, complex: bool, inputs: Span<ResourceAmount>) {
    let mut index = 0_u8;
    for input in inputs {
        assert!(*input.resource_type > 0 && *input.resource_type <= 58, "invalid recipe input");
        preset.production_inputs.write((resource_type, complex, index), *input);
        index += 1;
    }
}

fn write_mines(preset: PresetWrite, kinds: Span<crate::mines::MineKindEntry>, surface: Span<crate::mines::MineWeight>) {
    assert!(!kinds.is_empty() && kinds.len() <= 255, "invalid mine kind count");
    let mut previous = 0_u8;
    for index in 0..kinds.len() {
        let entry = *kinds.at(index);
        assert!(entry.kind > previous, "mine kinds must be ordered");
        previous = entry.kind;
        let config = entry.config;
        assert!(config.production_rate != 0, "zero mine production rate");
        assert!(config.cap_min != 0 && config.cap_steps != 0, "invalid mine cap bounds");
        assert!(
            crate::buildings::produced_resource(config.building_category) == config.resource_type,
            "mine building and resource differ",
        );
        assert!(config.resource_type != 0, "mine must produce a resource");
        let _ = config.cap_min * Into::<u32, u128>::into(config.cap_steps);
        preset.mine_kind_ids.write(index, entry.kind);
        preset.mine_kinds.write(entry.kind, config);
    }
    preset.mine_kind_count.write(kinds.len());
    let count: u8 = surface.len().try_into().expect('too many mine weights');
    previous = 0;
    for index in 0..count {
        let entry = *surface.at(index.into());
        assert!(entry.kind > previous, "mine weights must be ordered");
        previous = entry.kind;
        assert!(entry.weight != 0, "zero mine weight");
        assert!(preset.mine_kinds.read(entry.kind).production_rate != 0, "unknown pooled mine");
        preset.mine_weights.write(index, entry);
    }
    preset.mine_pool_count.write(count);
}

fn write_banks(preset: PresetWrite, rules: crate::market::BankRules) {
    assert!(
        rules.lp_fee_num < rules.lp_fee_denom
            && rules.owner_fee_num <= rules.owner_fee_denom
            && rules.owner_fee_denom != 0,
        "invalid bank fee ratio",
    );
    preset.bank_rules.write(rules);
}

fn write_buildings(
    preset: PresetWrite, rules: Span<crate::buildings::BuildingRuleConfig>, board: Option<crate::buildings::BoardRules>,
) {
    assert!(rules.len() == crate::buildings::BUILDING_CATEGORY_COUNT.into(), "incomplete building rules");
    let mut expected = 1_u8;
    for config in rules {
        assert!(*config.category == expected, "building rules must be ordered");
        let rule = *config.rule;
        preset
            .building_terms
            .write(
                expected,
                crate::buildings::BuildingTerms {
                    population_cost: rule.population_cost,
                    capacity_grant: rule.capacity_grant,
                    simple_count: rule.simple_cost.len().try_into().unwrap(),
                    complex_count: rule.complex_cost.len().try_into().unwrap(),
                },
            );
        write_building_costs(preset, expected, false, rule.simple_cost);
        write_building_costs(preset, expected, true, rule.complex_cost);
        expected += 1;
    }
    if let Some(board) = board {
        assert!(board.demolition_refund_bps <= 10000, "invalid demolition refund");
        assert!(board.workshop_rate != 0, "zero workshop rate");
        assert!(board.training_gate_tier <= 4, "invalid training gate tier");
        assert!(board.castle_store_deploys != 0, "zero castle store");
        preset.board_terms.write(Some(board));
    }
}

fn write_building_costs(preset: PresetWrite, category: u8, complex: bool, costs: Span<ResourceAmount>) {
    let mut index = 0_u8;
    for cost in costs {
        assert!(*cost.resource_type > 0 && *cost.resource_type <= 58, "invalid building cost resource");
        preset.building_costs.write((category, complex, index), *cost);
        index += 1;
    }
}

fn write_upgrades(
    preset: PresetWrite, limits: crate::upgrades::UpgradeLimits, recipes: Span<crate::upgrades::UpgradeRecipe>,
) {
    assert!(limits.realm_max <= 3 && limits.village_max <= 3, "unsupported troop limit level");
    assert!(recipes.len() == core::cmp::max(limits.realm_max, limits.village_max).into(), "incomplete upgrade recipes");
    preset.upgrade_limits.write(limits);
    let mut level = 1_u8;
    for recipe in recipes {
        preset.upgrade_cost_counts.write(level, recipe.costs.len());
        for index in 0..recipe.costs.len() {
            let cost = *recipe.costs.at(index);
            assert!(cost.resource_type > 0 && cost.resource_type <= 58, "invalid resource type");
            preset.upgrade_costs.write((level, index), cost);
        }
        level += 1;
    }
}

fn write_realm_grants(preset: PresetWrite, grants: crate::settlement::RealmGrants) {
    assert!(grants.starting_troops.len() == 17, "incomplete biome starting troops");
    for index in 0_u32..17 {
        preset.starting_troops.write((index + 1).try_into().unwrap(), *grants.starting_troops.at(index));
    }
    assert!(grants.realm_resources.len() <= 16, "realm resources exceed packed capacity");
    preset.realm_resource_count.write(grants.realm_resources.len().try_into().unwrap());
    for index in 0..grants.realm_resources.len() {
        let resource = *grants.realm_resources.at(index);
        assert!(resource >= 1 && resource <= 58, "invalid realm resource");
        preset.realm_resources.write(index.try_into().unwrap(), resource);
    }
    preset.realm_grant_count.write(grants.resources.len());
    for index in 0..grants.resources.len() {
        preset.realm_grants.write(index, *grants.resources.at(index));
    }
}

fn write_villages(preset: PresetWrite, rules: crate::village::VillageRules) {
    assert!(rules.resource_pool.len() == 22, "incomplete village resource pool");
    let mut total = 0_u128;
    let mut seen = 0_u32;
    for index in 0..22_u8 {
        let choice = *rules.resource_pool.at(index.into());
        assert!(
            choice.weight > 0 && choice.resource_type > 0 && choice.resource_type <= 22,
            "invalid village resource outcome",
        );
        let mut bit = 1_u32;
        for _ in 0..choice.resource_type {
            bit *= 2;
        }
        assert!((seen & bit) == 0, "duplicate village resource outcome");
        seen = seen | bit;
        total += choice.weight;
        preset.village_pool.write(index, choice);
    }
    assert!(total > 0, "empty village resource pool");
    preset.village_delay.write(rules.troop_delay_ticks);
    preset.village_grant_count.write(rules.resources.len());
    for index in 0..rules.resources.len() {
        preset.village_grants.write(index, *rules.resources.at(index));
    }
}

fn write_depths(
    preset: PresetWrite, mode_rules: u32, day_unit_seconds: u32, depths: Span<crate::expeditions::DepthRules>,
) {
    let enabled = mode_rules & crate::rules::DEPTH_CONTENTS != 0;
    assert!(depths.len() == if enabled {
        4
    } else {
        0
    }, "incomplete depth rules");
    assert!(!enabled || day_unit_seconds != 0, "depths require expedition regions");
    for index in 0..depths.len() {
        let value = *depths.at(index);
        let odds = value.chest;
        assert!(
            Into::<u16, u32>::into(odds.common)
                + odds.uncommon.into()
                + odds.rare.into()
                + odds.epic.into()
                + odds.legendary.into() == 10000,
            "chest tier odds must sum to 100 percent",
        );
        assert!(index != 0 || value.entry_stamina == 0, "surface needs no entry stamina");
        assert!(value.reveal_percent != 0 && value.reveal_percent <= 100, "invalid reveal percentage");
        assert!(
            value.site_guard_lower != 0 && value.site_guard_lower <= value.site_guard_upper, "invalid depth guards",
        );
        assert!(value.ruin_guard_lower != 0 && value.ruin_guard_lower <= value.ruin_guard_upper, "invalid ruin guards");
        assert!(value.guard_step != 0, "zero guard step");
        assert!(
            Into::<u16, u32>::into(value.site_guard_lower) % value.guard_step == 0
                && Into::<u16, u32>::into(value.site_guard_upper) % value.guard_step == 0
                && value.ruin_guard_lower % value.guard_step == 0
                && value.ruin_guard_upper % value.guard_step == 0,
            "guard bounds off grid",
        );
        preset.depth_rules.write(index.try_into().unwrap(), Some(value));
    }
    preset.depth_count.write(depths.len());
}

fn write_hyperstructures(
    preset: PresetWrite, game_rules: crate::rules::SliceRules, rules: crate::hyperstructures::HyperstructureRules,
) {
    assert!(
        !rules.resources.is_empty() || !crate::rules::rule_enabled(game_rules, crate::rules::DISCOVER_HYPERSTRUCTURES),
        "empty construction requirements",
    );
    for index in 0..rules.resources.len() {
        let cost = *rules.resources.at(index);
        assert!(cost.resource_type >= 1 && cost.resource_type <= 23, "invalid construction resource");
        assert!(cost.minimum != 0 && cost.minimum <= cost.maximum, "invalid construction range");
        for previous in 0..index {
            assert!(
                *rules.resources.at(previous).resource_type != cost.resource_type, "duplicate construction resource",
            );
        }
        preset.hyper_costs.write(index, cost);
    }
    preset.hyper_cost_count.write(rules.resources.len());
    preset.hyper_shards.write(rules.initialize_shards);
}

fn write_relics(
    preset: PresetWrite,
    game_rules: crate::rules::SliceRules,
    rules: Span<crate::relics::RelicRule>,
    chests: Option<crate::relics::ChestRules>,
) {
    if let Some(value) = chests {
        assert!(
            game_rules.day_unit_seconds != 0 && crate::rules::rule_enabled(game_rules, crate::rules::DEPTH_CONTENTS),
            "chest tables require depth rules",
        );
        assert!(value.pool != 0 && value.price_ceiling != 0 && value.estimate_days != 0, "empty chest rules");
        let shares = value.shares;
        assert!(
            shares.common != 0
                && shares.common <= shares.uncommon
                && shares.uncommon <= shares.rare
                && shares.rare <= shares.epic
                && shares.epic <= shares.legendary,
            "invalid chest shares",
        );
        assert!(rules.is_empty(), "ruin chests replace timed relics");
        preset.rollover_chest_rules.write(chests);
        return;
    }
    assert!(rules.len() == 18, "all eighteen relic rules required");
    let mut total: u128 = 0;
    for index in 0..18_u32 {
        let rule = *rules.at(index);
        total += rule.draw_weight;
        preset.relic_rules.write(crate::relics::FIRST_RELIC + index.try_into().unwrap(), rule);
    }
    assert!(total != 0, "empty relic discovery pool");
    assert!(*rules.at(6).uses == 1 && *rules.at(7).uses == 2, "invalid reveal radii");
    preset.rollover_chest_rules.write(chests);
}

fn write_exploration(
    preset: PresetWrite, mode_rules: u32, rewards: Span<crate::exploration_rewards::ExplorationReward>,
) {
    if mode_rules & crate::rules::REVEAL_SUPPLIES != 0 {
        assert!(mode_rules & crate::rules::DEPTH_CONTENTS != 0, "reveal yield requires depth rules");
        assert!(rewards.is_empty(), "reveal yield replaces supply pool");
        return;
    }
    assert!(!rewards.is_empty(), "empty exploration pool");
    let mut total: u128 = 0;
    for index in 0..rewards.len() {
        let reward = *rewards.at(index);
        assert!(reward.resource_type > 0 && reward.resource_type <= 58, "invalid reward resource");
        assert!(reward.amount <= reward.amount_max, "invalid exploration reward range");
        total += reward.weight;
        preset.exploration_rewards.write(index, reward);
    }
    assert!(total != 0, "empty exploration pool");
    preset.exploration_reward_count.write(rewards.len());
}

pub fn store_withdrawals(commitment: felt252, withdrawals: crate::presets::WithdrawalPreset) {
    crate::logic::release::assert_authority();
    let preset = crate::state::write().presets.entry(commitment);
    let deposits = withdrawals.deposits;
    let fees: u32 = deposits.realm_fee_bps.into()
        + deposits.velords_fee_bps.into()
        + deposits.season_fee_bps.into()
        + deposits.client_fee_bps.into();
    assert!(fees <= 10000, "deposit fees exceed amount");
    preset.deposit_rules.write(Some(deposits));
    let rules = withdrawals.rules;
    assert!(!rules.retention.is_empty(), "missing withdrawal retention table");
    assert!(
        rules.velords_recipient != 0.try_into().unwrap() && rules.season_recipient != 0.try_into().unwrap(),
        "missing withdrawal fee recipient",
    );
    let fees: u32 = rules.bank_fee_bps.into()
        + rules.velords_fee_bps.into()
        + rules.season_fee_bps.into()
        + rules.client_fee_bps.into();
    assert!(fees <= 10000, "withdrawal fees exceed amount");
    for index in 0..rules.retention.len() {
        let retention = *rules.retention.at(index);
        assert!(retention.troop_percent <= 100 && retention.resource_percent <= 100, "invalid withdrawal retention");
        preset.withdrawal_retention.write(index, retention);
    }
    preset
        .withdrawal_terms
        .write(
            crate::withdrawals::WithdrawalTerms {
                paused: rules.paused,
                bank_fee_bps: rules.bank_fee_bps,
                velords_fee_bps: rules.velords_fee_bps,
                season_fee_bps: rules.season_fee_bps,
                client_fee_bps: rules.client_fee_bps,
                velords_recipient: rules.velords_recipient,
                season_recipient: rules.season_recipient,
                retention_count: rules.retention.len(),
            },
        );
    for token in withdrawals.tokens {
        assert!(
            *token.resource_type > 0 && *token.resource_type <= 58 && *token.token != 0.try_into().unwrap(),
            "invalid resource token",
        );
        assert!(
            preset.withdrawal_tokens.read(*token.resource_type) == 0.try_into().unwrap(), "duplicate resource token",
        );
        preset.withdrawal_tokens.write(*token.resource_type, *token.token);
    }
}

fn write_research(preset: PresetWrite, structures: crate::presets::StructurePreset) {
    if structures.board.is_none() {
        assert!(structures.research.is_empty(), "research needs a board");
        return;
    }
    // Every row's tiers are priced exactly once, from the first tier above common to the row's last.
    let mut expected = 0_u32;
    for row in 0..crate::research::ROW_COUNT {
        expected += crate::research::max_tier(row).into();
    }
    assert!(structures.research.len() == expected, "incomplete research prices");
    for entry in structures.research {
        let key = (*entry.row, *entry.tier);
        assert!(*entry.tier > 0 && *entry.tier <= crate::research::max_tier(*entry.row), "invalid research tier");
        assert!(preset.research_prices.read(key).is_none(), "duplicate research price");
        assert!((*entry.price).essence != 0, "empty research price");
        preset.research_prices.write(key, Some(*entry.price));
    }
}
