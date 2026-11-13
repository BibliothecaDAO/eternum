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
    pub research: Span<crate::research::ResearchPriceConfig>,
    pub buildings: Span<crate::buildings::BuildingRuleConfig>,
    pub camps: crate::camps::CampRules,
    pub faith: crate::faith::FaithRules,
    pub upgrade_limits: crate::upgrades::UpgradeLimits,
    pub upgrades: Span<crate::upgrades::UpgradeRecipe>,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct SettlementPreset {
    pub order_aspects: Span<u8>,
    pub starting_armies: u8,
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
    pub quests: Option<crate::quests::QuestRules>,
    pub banes: Option<crate::banes::BaneRules>,
    pub race: Option<crate::race::RaceRules>,
    pub deep: Option<crate::deep::DeepRules>,
    pub labor: Option<crate::entry::LaborRules>,
    pub trade: crate::trade::TradeRules,
    pub banks: crate::market::BankRules,
    pub hyperstructures: crate::hyperstructures::HyperstructureRules,
    pub relics: Span<crate::relics::RelicRule>,
    pub chests: Option<crate::relics::ChestRules>,
    pub progression: Option<crate::progression::ArmyProgressionRules>,
    pub discovery: Option<crate::expeditions::FrontierDiscoveryRules>,
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
    let rules = preset.rules;
    if let Some(banes) = preset.economy.banes {
        assert!(preset.economy.quests.is_some(), "banes require quests");
        crate::banes::validate(banes);
        for relic in preset.economy.relics {
            assert!(
                Into::<u16, u32>::into(*relic.rate_bps) * Into::<u16, u32>::into(banes.stamina_percent) % 100 == 0,
                "bane boost rate loses precision",
            );
        }
    }
    if let Some(quests) = preset.economy.quests {
        crate::quests::validate(quests);
        assert!(
            rules.day_unit_seconds != 0 && !preset.settlement.order_aspects.is_empty(),
            "quests require Aspect expeditions",
        );
    }
    crate::aspects::validate(preset.settlement.order_aspects);
    if preset.settlement.starting_armies != 0 {
        assert!(
            rules.entry_rule == crate::rules::ENTRY_OPEN && rules.day_unit_seconds != 0,
            "starting armies require open expeditions",
        );
        assert!(
            preset.settlement.starting_armies <= 6
                && Into::<u8, u16>::into(preset.settlement.starting_armies) <= rules
                    .troop_limit_config
                    .settlement_armies,
            "starting armies exceed deployment slots",
        );
    }
    assert!(
        preset.settlement.order_aspects.is_empty()
            || (rules.entry_rule == crate::rules::ENTRY_OPEN && rules.day_unit_seconds != 0),
        "Aspects require open expeditions",
    );
    assert!(
        (preset.economy.labor.is_some() || preset.economy.quests.is_some()) == (rules.day_unit_seconds != 0),
        "home rewards require expeditions",
    );
    assert!(!(preset.economy.labor.is_some() && preset.economy.quests.is_some()), "choose one home reward rule");
    if let Some(race) = preset.economy.race {
        crate::race::validate(race);
        assert!(rules.day_unit_seconds != 0 && preset.economy.chests.is_none(), "race requires days without LORDS");
        assert!(preset.season_win_points == 0, "race cannot use victory points");
    }
    if let Some(deep) = preset.economy.deep {
        assert!(rules.day_unit_seconds != 0, "Deep needs expedition days");
        crate::deep::validate(deep, preset.settlement.spacing);
    }
    if let Some(labor) = preset.economy.labor {
        assert!(labor.amount != 0, "zero daily labor grant");
        assert!(labor.golden_amount != 0, "zero golden labor grant");
        let _ = labor.amount * crate::rules::RESOURCE_PRECISION;
        let _ = labor.campaign_essence * crate::rules::RESOURCE_PRECISION;
        let _ = labor.golden_amount * crate::rules::RESOURCE_PRECISION;
        let _ = labor.golden_essence * crate::rules::RESOURCE_PRECISION;
    }
    if let Some(chests) = preset.economy.chests {
        assert!(
            chests.claim_window_seconds > crate::days::FRONTIER_REPORT_GRACE_SECONDS,
            "LORDS claim window needs reporting grace",
        );
    }
    assert!(preset.economy.chests.is_none() || rules.day_unit_seconds != 0, "chest rules require expedition");
    assert!(preset.economy.discovery.is_some() == (rules.day_unit_seconds != 0), "discovery requires expedition");
    if let Some(discovery) = preset.economy.discovery {
        crate::discovery::validate_frontier(discovery);
        if let Some(race) = preset.economy.race {
            assert!(
                crate::discovery::maximum_race_chance(discovery, race.clear_mist_percent) <= 10000,
                "Triumph and boon discovery odds exceed 100 percent",
            );
        }
        assert!(
            rules.map_config.camp_win_probability == 0 && rules.map_config.shards_mines_win_probability == 0,
            "expedition uses categorical odds",
        );
    }
    assert!(preset.economy.progression.is_some() == (rules.day_unit_seconds != 0), "progression requires expedition");
    if let Some(progression) = preset.economy.progression {
        let _ = progression.reveal_xp + 3 * progression.reveal_xp_per_depth;
        assert!(
            progression.reveal_xp != 0
                && progression.common_xp > 0
                && progression.uncommon_xp > progression.common_xp
                && progression.rare_xp > progression.uncommon_xp
                && progression.epic_xp > progression.rare_xp
                && progression.legendary_xp > progression.epic_xp,
            "invalid progression thresholds",
        );
    }
    assert!(
        rules.day_unit_seconds == 0 || rules.troop_limit_config.t1_tier_strength == 1,
        "expedition troops must have strength one",
    );
    assert!(rules.tick_config.armies_tick_in_seconds != 0, "zero army tick");
    let tick_seconds = rules.tick_config.armies_tick_in_seconds;
    assert!(tick_seconds <= 0x100000000 / crate::math::PercentageValueImpl::_100(), "stamina remainder overflow");
    // Relic rules are ordered from FIRST_RELIC (39): only indices 0 and 1 (IDs 39/40) regenerate stamina.
    for index in 0..core::cmp::min(preset.economy.relics.len(), 2) {
        let seconds = Into::<u8, u64>::into(*preset.economy.relics.at(index).uses) * tick_seconds;
        assert!(seconds <= 0xffff, "stamina boost duration overflow");
    }
    assert!(
        Into::<u32, u64>::into(rules.day_unit_seconds) % rules.tick_config.armies_tick_in_seconds == 0,
        "day unit is not whole ticks",
    );
    if rules.bitcoin_mine_config.enabled {
        assert!(rules.tick_config.bitcoin_phase_in_seconds != 0, "zero Bitcoin phase duration");
        assert!(rules.bitcoin_mine_config.prize_per_phase != 0, "zero Bitcoin prize");
    }
    assert!(rules.bitcoin_mine_config.owner_cut_bps <= 10000, "invalid Bitcoin owner cut");

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

    assert!(troops.light_guard_lower_bound <= troops.light_guard_upper_bound, "invalid light guard bounds");
    assert!(troops.heavy_guard_lower_bound <= troops.heavy_guard_upper_bound, "invalid heavy guard bounds");
    if crate::rules::rule_enabled(preset.rules, crate::rules::DISCOVER_CAMPS)
        && map.camp_win_probability != 0
        && preset.rules.day_unit_seconds == 0 {
        assert!(preset.structures.camps.labor_rate > 0, "zero camp labor rate");
    }
}

pub fn commitment(preset: PresetDefinition) -> felt252 {
    let mut values = array!['NATIVE_PRESET', 1];
    preset.serialize(ref values);
    core::poseidon::poseidon_hash_span(values.span())
}

#[starknet::interface]
pub trait IPresetResources<T> {
    fn store_resource_preset(
        ref self: T,
        commitment: felt252,
        resources: ResourcePreset,
        exploration: Span<crate::exploration_rewards::ExplorationReward>,
        mode_rules: u32,
    );
}

#[starknet::interface]
pub trait IPresetStructures<T> {
    fn store_structure_preset(ref self: T, commitment: felt252, structures: StructurePreset);
}

#[starknet::interface]
pub trait IPresetRelics<T> {
    fn store_relic_preset(
        ref self: T,
        commitment: felt252,
        rules: Span<crate::relics::RelicRule>,
        chests: Option<crate::relics::ChestRules>,
        mode_rules: u32,
        day_unit_seconds: u32,
    );
}

#[starknet::interface]
pub trait IPresetWithdrawals<T> {
    fn store_withdrawal_preset(ref self: T, commitment: felt252, withdrawals: WithdrawalPreset);
}

#[starknet::interface]
pub trait IPresetSettlement<T> {
    fn store_settlement_preset(
        ref self: T,
        commitment: felt252,
        settlement: SettlementPreset,
        entry_rule: u8,
        mode_rules: u32,
        day_unit_seconds: u32,
    );
}
