#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ResourcePreset {
    pub resources: Span<crate::resources::ResourceRule>,
    pub production: Span<crate::production::RecipeConfig>,
    pub mine_kinds: Span<crate::mines::MineKindEntry>,
    pub surface_mines: Span<crate::mines::MineWeight>,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct StructurePreset {
    pub board: Option<crate::buildings::BoardRules>,
    pub buildings: Span<crate::buildings::BuildingRuleConfig>,
    pub camps: Span<crate::resources::ResourceAmount>,
    pub faith: crate::faith::FaithRules,
    pub upgrade_limits: crate::upgrades::UpgradeLimits,
    pub upgrades: Span<crate::upgrades::UpgradeRecipe>,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct SettlementPreset {
    pub mode: crate::settlement::SettlementMode,
    pub spacing: u32,
    pub depths: Span<crate::expeditions::DepthRules>,
    pub realms: crate::settlement::RealmGrants,
    pub villages: crate::village::VillageRules,
    pub spires: Option<crate::spires::SpireLayout>,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct WithdrawalPreset {
    pub deposits: crate::bridge::DepositRules,
    pub rules: crate::withdrawals::WithdrawalRules,
    pub tokens: Span<crate::withdrawals::ResourceToken>,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct EconomyPreset {
    pub trade: crate::trade::TradeRules,
    pub banks: crate::market::BankRules,
    pub hyperstructures: crate::hyperstructures::HyperstructureRules,
    pub relics: Span<crate::relics::RelicRule>,
    pub chests: Option<crate::relics::ChestRules>,
    pub research_cost: u128,
    pub withdrawals: Option<WithdrawalPreset>,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct PresetDefinition {
    pub rules: crate::rules::SliceRules,
    pub resources: ResourcePreset,
    pub structures: StructurePreset,
    pub settlement: SettlementPreset,
    pub economy: EconomyPreset,
    pub exploration: Span<crate::exploration_rewards::ExplorationReward>,
    pub season_win_points: u128,
}

pub fn validate(preset: PresetDefinition) {
    let map = preset.rules.map_config;
    assert!(
        map.shards_mines_win_probability == 0 || !preset.resources.surface_mines.is_empty(), "empty enabled mine pool",
    );
    let troops = preset.rules.troop_limit_config;
    assert!(
        troops.settlement_guard_slots <= 4
            && troops.city_guard_slots <= 4
            && troops.kingdom_guard_slots <= 4
            && troops.empire_guard_slots <= 4,
        "invalid guard slot limit",
    );

    assert!(troops.mercenaries_troop_lower_bound < troops.mercenaries_troop_upper_bound, "invalid mercenary bounds");
    if crate::rules::rule_enabled(preset.rules, crate::rules::DISCOVER_CAMPS)
        && map.camp_win_probability != 0
        && !crate::rules::rule_enabled(preset.rules, crate::rules::HOME_CAMP_REWARDS) {
        let mut labor_rate = None;
        for rule in preset.resources.resources {
            if *rule.resource_type == 23 {
                labor_rate = Some(*rule.village_rate);
            }
        }
        assert!(labor_rate.expect('missing village labor rule') > 0, "zero camp labor rate");
    }
}

pub fn commitment(preset: PresetDefinition) -> felt252 {
    let mut values = array!['NATIVE_PRESET', 1];
    preset.serialize(ref values);
    core::poseidon::poseidon_hash_span(values.span())
}
