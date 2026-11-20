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
    );
    write_economy(preset, commitment, definition.economy);
}

// Resource tables are owned by Production; registration remains one atomic transaction.
pub fn store_resources(commitment: felt252, resources: crate::presets::ResourcePreset) {
    crate::logic::release::assert_authority();
    let preset = crate::state::write().presets.entry(commitment);
    write_resources(preset, resources.resources);
    write_production(preset, resources.production);
    write_mines(preset, resources.mine_kinds, resources.surface_mines);
}

pub fn store_structures(commitment: felt252, structures: crate::presets::StructurePreset) {
    crate::logic::release::assert_authority();
    write_structures(crate::state::write().presets.entry(commitment), structures);
}

fn record_exists(preset: PresetWrite) -> bool {
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
    write_upgrades(preset, structures.upgrade_limits, structures.upgrades);
}

pub fn store_settlement(commitment: felt252, settlement: crate::presets::SettlementPreset) {
    crate::logic::release::assert_authority();
    assert_release_settlement(settlement);
    crate::state::write().presets.entry(commitment).aspects.write(!settlement.order_aspects.is_empty());
}

fn assert_release_settlement(settlement: crate::presets::SettlementPreset) {
    assert!(
        settlement.mode == crate::settlement::SettlementMode::Single
            && settlement.spacing == crate::logic::settlement::spacing(),
        "settlement is not the release's",
    );
    assert!(
        settlement.order_aspects.is_empty()
            || settlement.order_aspects == crate::balance::settlement::ORDER_ASPECTS.span(),
        "Aspects are not the release's",
    );
    assert!(settlement.realms == crate::logic::settlement::grants(), "realm grants are not the release's");
    assert!(settlement.villages == crate::logic::village::rules(), "villages are not the release's");
    assert!(settlement.spires.is_none(), "the release places no spires");
}

fn write_economy(preset: PresetWrite, commitment: felt252, economy: crate::presets::EconomyPreset) {
    write_deep(preset, economy.deep);
    preset.race_rules.write(economy.race);
    if let Some(withdrawals) = economy.withdrawals {
        let classes = crate::state::read().releases.read(crate::state::read().current_release.read()).classes;
        crate::presets::IPresetWithdrawalsDispatcherTrait::store_withdrawal_preset(
            crate::presets::IPresetWithdrawalsLibraryDispatcher { class_hash: classes.production },
            commitment,
            withdrawals,
        );
    }
}

fn write_deep(preset: PresetWrite, rules: Option<crate::deep::DeepRules>) {
    let Some(rules) = rules else {
        return;
    };
    preset.deep_rules.write(Some(crate::deep::settings(rules)));
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
        assert!(board.troop_store_deploys != 0, "zero troop store");
        assert!(
            board.settlement_resource_cap > 0
                && board.city_resource_cap > 0
                && board.kingdom_resource_cap > 0
                && board.empire_resource_cap > 0,
            "zero resource store",
        );
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
    for row in crate::research::ROWS.span() {
        expected += crate::research::max_tier(*row).into();
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
