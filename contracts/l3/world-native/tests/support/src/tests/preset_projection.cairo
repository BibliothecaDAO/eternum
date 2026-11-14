// Current presets come from source; Herald replays historical launches under their recorded schema.
pub use snforge_std::fs::{FileTrait, read_txt};
pub use snforge_std::{interact_with_state, start_cheat_caller_address};
pub use starknet::ContractAddress;
pub use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess};
pub use crate::artificer::{IArtificerDispatcher, IArtificerDispatcherTrait};
pub use crate::bridge::{IBridgeDispatcher, IBridgeDispatcherTrait};
pub use crate::buildings::{IBuildingRulesDispatcher, IBuildingRulesDispatcherTrait};
pub use crate::camps::{ICampRulesDispatcher, ICampRulesDispatcherTrait};
pub use crate::expeditions::{IExpeditionRulesDispatcher, IExpeditionRulesDispatcherTrait};
pub use crate::exploration_rewards::{IExtractionDispatcher, IExtractionDispatcherTrait};
pub use crate::game::{
    IGameDispatcher, IGameDispatcherTrait, ISeasonLifecycleDispatcher, ISeasonLifecycleDispatcherTrait,
};
pub use crate::hyperstructures::{IHyperstructuresDispatcher, IHyperstructuresDispatcherTrait};
pub use crate::mines::{IMineRulesDispatcher, IMineRulesDispatcherTrait};
pub use crate::production::{IProductionRulesDispatcher, IProductionRulesDispatcherTrait};
pub use crate::registrar::{
    IRegistrarDispatcher, IRegistrarDispatcherTrait, IRegistrarSafeDispatcher, IRegistrarSafeDispatcherTrait,
};
pub use crate::relics::{IRelicsDispatcher, IRelicsDispatcherTrait};
pub use crate::settlement::{ISettlementViewsDispatcher, ISettlementViewsDispatcherTrait};
pub use crate::spires::{ISpiresDispatcher, ISpiresDispatcherTrait};
pub use crate::upgrades::{IUpgradeRulesDispatcher, IUpgradeRulesDispatcherTrait};
pub use crate::village::{IVillagePassesDispatcher, IVillagePassesDispatcherTrait};
pub use crate::withdrawals::{IWithdrawalsDispatcher, IWithdrawalsDispatcherTrait};

#[derive(Drop, Serde, Debug, PartialEq)]
pub struct ObservedRow {
    pub model: felt252,
    pub keys: Span<felt252>,
    pub values: Span<felt252>,
}
pub fn row<T, +Serde<T>, +Drop<T>>(ref rows: Array<ObservedRow>, model: felt252, keys: Span<felt252>, value: T) {
    let mut values = array![];
    value.serialize(ref values);
    rows.append(ObservedRow { model, keys, values: values.span() });
}
pub fn current_definition(name: ByteArray) -> (u32, crate::presets::PresetDefinition) {
    let mut registration = read_txt(@FileTrait::new(format!("../fixtures/current-presets/{}-register.txt", name)))
        .span();
    let preset_id = Serde::deserialize(ref registration).unwrap();
    let definition = Serde::deserialize(ref registration).unwrap();
    assert!(registration.is_empty());
    (preset_id, definition)
}
pub fn retired_frontier_chest_rules() -> crate::relics::ChestRules {
    let (preset_id, definition) = current_definition("frontier-retired");
    assert_eq!(preset_id, 5);
    definition.economy.chests.expect('retired cash rules missing')
}
pub fn frontier_discovery_rules() -> crate::expeditions::FrontierDiscoveryRules {
    let (_, definition) = current_definition("frontier-check");
    definition.economy.discovery.unwrap()
}
pub fn frontier_progression_rules() -> crate::progression::ArmyProgressionRules {
    let (_, definition) = current_definition("frontier-check");
    definition.economy.progression.unwrap()
}
pub fn launch(address: ContractAddress, name: ByteArray) -> u32 {
    let (preset_id, definition) = current_definition(name.clone());
    let registrar = IRegistrarDispatcher { contract_address: address };
    registrar.register_preset(preset_id, definition);
    let mut calldata = read_txt(@FileTrait::new(format!("../fixtures/current-presets/{}-create.txt", name))).span();
    let params = Serde::deserialize(ref calldata).unwrap();
    assert!(calldata.is_empty());
    registrar.create_game(params)
}

#[feature("safe_dispatcher")]
pub fn assert_unfunded_cash_rules_refuse_registration() {
    let d = super::registrar::setup();
    start_cheat_caller_address(d.games, super::authority());
    let (preset_id, mut definition) = current_definition("frontier-check");
    definition
        .economy
        .chests =
            Some(
                crate::relics::ChestRules {
                    pool_bps: 7000,
                    top_n: 10,
                    price_ceiling: 0,
                    claim_window_seconds: 0,
                    shares: crate::relics::ChestTiers { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
                },
            );
    assert!(IRegistrarSafeDispatcher { contract_address: d.games }.register_preset(preset_id, definition).is_err());
    assert_eq!(IRegistrarDispatcher { contract_address: d.games }.preset_commitment(preset_id), 0);
}
pub fn compare_current_launch(name: ByteArray) {
    let d = super::registrar::setup();
    start_cheat_caller_address(d.games, super::authority());
    assert_eq!(launch(d.games, name.clone()), 1);
    compare(d.games, 1, name);
}
pub fn compare(address: ContractAddress, game_id: u32, name: ByteArray) {
    compare_rows(observe(address, game_id), name);
}
pub fn compare_rows(actual: Array<ObservedRow>, name: ByteArray) {
    let mut serialized = read_txt(@FileTrait::new(format!("../fixtures/current-presets/{}-rows.txt", name))).span();
    let expected: Array<ObservedRow> = Serde::deserialize(ref serialized).unwrap();
    assert!(serialized.is_empty());
    assert_eq!(actual.len(), expected.len());
    for observed in actual.span() {
        let mut matches = 0;
        for projected in expected.span() {
            if observed.model == projected.model && observed.keys == projected.keys {
                assert_eq!(observed.values, projected.values);
                matches += 1;
            }
        }
        assert_eq!(matches, 1, "projection needs exactly one matching row");
    }
}
pub fn observe(address: ContractAddress, game_id: u32) -> Array<ObservedRow> {
    let mut rows = array![];
    observe_game_rules(ref rows, address, game_id);
    observe_resources(ref rows, address, game_id);
    observe_structures(ref rows, address, game_id);
    observe_settlement(ref rows, address, game_id);
    observe_economy(ref rows, address, game_id);
    observe_rewards(ref rows, address, game_id);
    rows
}
pub fn observe_game_rules(ref rows: Array<ObservedRow>, address: ContractAddress, game_id: u32) {
    let key = array![game_id.into()].span();
    let game = IGameDispatcher { contract_address: address };
    let settlement_views = ISettlementViewsDispatcher { contract_address: address };
    row(ref rows, 'SliceRules', key, game.rules(game_id));
    row(ref rows, 'SettlementRules', key, settlement_views.settlement_rules(game_id));
}
pub fn observe_resources(ref rows: Array<ObservedRow>, address: ContractAddress, game_id: u32) {
    let key = array![game_id.into()].span();
    let production_rules = IProductionRulesDispatcher { contract_address: address };
    let mine_rules = IMineRulesDispatcher { contract_address: address };
    for resource_type in 1_u8..59 {
        let rule = interact_with_state(address, || crate::logic::resources::rule(game_id, resource_type));
        let resource_key = array![game_id.into(), resource_type.into()].span();
        row(ref rows, 'ResourceRule', resource_key, (rule.unit_weight, rule.realm_rate, rule.village_rate));
        row(
            ref rows,
            'ProductionRecipe',
            resource_key,
            production_rules.production_recipe(crate::production::RecipeKey { game_id, resource_type }),
        );
    }
    let kinds = interact_with_state(
        address,
        || {
            let preset = crate::logic::preset_record::for_game(game_id);
            let mut kinds = array![];
            for index in 0..preset.mine_kind_count.read() {
                kinds.append(preset.mine_kind_ids.read(index));
            }
            kinds
        },
    );
    for kind in kinds {
        row(
            ref rows,
            'MineKindConfig',
            array![game_id.into(), kind.into()].span(),
            mine_rules.mine_kind(crate::mines::MineKindKey { game_id, kind }),
        );
    }
    row(ref rows, 'MinePool', key, mine_rules.mine_pool(crate::mines::MinePoolKey { game_id }));
}
pub fn observe_structures(ref rows: Array<ObservedRow>, address: ContractAddress, game_id: u32) {
    let key = array![game_id.into()].span();
    let building_rules = IBuildingRulesDispatcher { contract_address: address };
    let camp_rules = ICampRulesDispatcher { contract_address: address };
    let upgrade_rules = IUpgradeRulesDispatcher { contract_address: address };
    for category in 1_u8..crate::buildings::BUILDING_CATEGORY_COUNT + 1 {
        row(
            ref rows,
            'BuildingRule',
            array![game_id.into(), category.into()].span(),
            building_rules.building_rule(crate::buildings::BuildingRuleKey { game_id, category }),
        );
    }
    if let Some(board) =
        interact_with_state(address, || crate::logic::construction::ConstructionLogic::observed_board_rules(game_id)) {
        row(ref rows, 'BoardRules', key, board);
        for research_row in 0..crate::research::ROW_COUNT {
            for tier in 1..crate::research::max_tier(research_row) + 1 {
                row(
                    ref rows,
                    'ResearchPrice',
                    array![game_id.into(), research_row.into(), tier.into()].span(),
                    interact_with_state(address, || crate::logic::research::price(game_id, research_row, tier)),
                );
            }
        }
    }
    row(ref rows, 'CampRules', key, camp_rules.camp_rules(game_id));
    let limits = upgrade_rules.upgrade_limits(game_id);
    row(ref rows, 'UpgradeLimits', key, limits);
    for level in 1..core::cmp::max(limits.realm_max, limits.village_max) + 1 {
        row(
            ref rows,
            'UpgradeRecipe',
            array![game_id.into(), level.into()].span(),
            upgrade_rules.upgrade_recipe(game_id, level),
        );
    }
}
pub fn observe_settlement(ref rows: Array<ObservedRow>, address: ContractAddress, game_id: u32) {
    let key = array![game_id.into()].span();
    let settlement_views = ISettlementViewsDispatcher { contract_address: address };
    let villages = IVillagePassesDispatcher { contract_address: address };
    let expedition_rules = IExpeditionRulesDispatcher { contract_address: address };
    let spires = ISpiresDispatcher { contract_address: address };
    if let Some(packed) = interact_with_state(address, || crate::logic::aspects::rules(game_id)) {
        let mut orders = array![];
        for order in 1_u8..17 {
            orders.append(crate::aspects::order_aspect(packed, order));
        }
        row(ref rows, 'AspectRules', key, orders.span());
    }
    row(ref rows, 'RealmGrants', key, settlement_views.realm_grants(game_id));
    row(ref rows, 'VillageRules', key, villages.village_rules(game_id));
    let depths = interact_with_state(address, || crate::logic::preset_record::for_game(game_id).depth_count.read());
    for depth in 0..depths {
        row(
            ref rows,
            'DepthRules',
            array![game_id.into(), depth.into()].span(),
            expedition_rules.depth_rules(game_id, depth.try_into().unwrap()),
        );
    }
    if let Some(layout) = spires.spire_layout(game_id) {
        row(ref rows, 'SpireLayout', key, layout);
    }
}
pub fn observe_economy(ref rows: Array<ObservedRow>, address: ContractAddress, game_id: u32) {
    let key = array![game_id.into()].span();
    let hyperstructures = IHyperstructuresDispatcher { contract_address: address };
    let relics = IRelicsDispatcher { contract_address: address };
    let artificer = IArtificerDispatcher { contract_address: address };
    let bridge = IBridgeDispatcher { contract_address: address };
    let withdrawals = IWithdrawalsDispatcher { contract_address: address };
    if let Some(deep) =
        interact_with_state(address, || crate::logic::preset_record::for_game(game_id).deep_rules.read()) {
        row(ref rows, 'DeepRules', key, deep);
    }
    row(ref rows, 'HyperstructureRules', key, hyperstructures.hyperstructure_rules(game_id));
    row(ref rows, 'RelicRules', key, relics.relic_rules(game_id));
    if let Some(labor) =
        interact_with_state(address, || crate::logic::preset_record::for_game(game_id).labor_rules.read()) {
        row(ref rows, 'LaborRules', key, labor);
    }
    if let Some(chests) = relics.chest_rules(game_id) {
        row(ref rows, 'ChestRules', key, chests);
    }
    if let Some(progression) = interact_with_state(address, || crate::logic::progression::rules(game_id)) {
        row(ref rows, 'ArmyProgressionRules', key, progression);
    }
    if let Some(discovery) =
        interact_with_state(address, || crate::logic::preset_record::for_game(game_id).discovery_rules.read()) {
        row(ref rows, 'FrontierDiscoveryRules', key, discovery);
    }
    row(ref rows, 'ArtificerCost', key, artificer.artificer_cost(game_id));
    let deposits = interact_with_state(address, || crate::logic::preset_record::for_game(game_id).deposit_rules.read());
    if deposits.is_some() {
        row(ref rows, 'DepositRules', key, bridge.deposit_rules(game_id));
        row(ref rows, 'WithdrawalRules', key, withdrawals.withdrawal_rules(game_id));
        for resource_type in 1_u8..59 {
            let token = interact_with_state(
                address, || crate::logic::preset_record::for_game(game_id).withdrawal_tokens.read(resource_type),
            );
            if token != 0.try_into().unwrap() {
                row(
                    ref rows,
                    'ResourceToken',
                    array![game_id.into(), resource_type.into()].span(),
                    withdrawals.resource_token(crate::withdrawals::ResourceTokenKey { game_id, resource_type }),
                );
            }
        }
    }
}
pub fn observe_rewards(ref rows: Array<ObservedRow>, address: ContractAddress, game_id: u32) {
    let key = array![game_id.into()].span();
    let extraction = IExtractionDispatcher { contract_address: address };
    let season_lifecycle = ISeasonLifecycleDispatcher { contract_address: address };
    row(ref rows, 'ExtractionRewards', key, extraction.extraction_rewards(game_id));
    row(ref rows, 'SeasonWinThreshold', key, season_lifecycle.season_win_threshold(game_id));
}

pub fn optional_race_rules() -> crate::race::RaceRules {
    crate::race::RaceRules {
        season_days: 50,
        glory_per_tick: 5,
        height_per_tick: 5,
        stage_height: 2000,
        clear_mist_percent: 200,
        second_wind_percent: 200,
        pale_moon_percent: 50,
        spoils_percent: 200,
        first: crate::troops::Coord { alt: false, x: 5, y: 5 },
        second: crate::troops::Coord { alt: false, x: 45, y: 5 },
        third: crate::troops::Coord { alt: false, x: 5, y: 45 },
        fourth: crate::troops::Coord { alt: false, x: 45, y: 45 },
    }
}
