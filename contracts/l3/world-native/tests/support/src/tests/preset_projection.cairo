// Current presets come from source; Herald replays historical launches under their recorded schema.
pub use snforge_std::fs::{FileTrait, read_txt};
pub use snforge_std::{interact_with_state, start_cheat_caller_address};
pub use starknet::ContractAddress;
pub use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess};
pub use crate::bridge::{IBridgeDispatcher, IBridgeDispatcherTrait};
pub use crate::buildings::{IBuildingRulesDispatcher, IBuildingRulesDispatcherTrait};
pub use crate::expeditions::{IExpeditionRulesDispatcher, IExpeditionRulesDispatcherTrait};
pub use crate::exploration_rewards::{IExtractionDispatcher, IExtractionDispatcherTrait};
pub use crate::game::{IGameDispatcher, IGameDispatcherTrait};
pub use crate::mines::{IMineRulesDispatcher, IMineRulesDispatcherTrait};
pub use crate::production::{IProductionRulesDispatcher, IProductionRulesDispatcherTrait};
pub use crate::registrar::{
    IRegistrarDispatcher, IRegistrarDispatcherTrait, IRegistrarSafeDispatcher, IRegistrarSafeDispatcherTrait,
};
pub use crate::settlement::{ISettlementViewsDispatcher, ISettlementViewsDispatcherTrait};
pub use crate::spires::{ISpiresDispatcher, ISpiresDispatcherTrait};
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

pub fn launch(address: ContractAddress, name: ByteArray) -> u32 {
    let (preset_id, definition) = current_definition(name.clone());
    let registrar = IRegistrarDispatcher { contract_address: address };
    registrar.register_preset(preset_id, definition);
    let mut calldata = read_txt(@FileTrait::new(format!("../fixtures/current-presets/{}-create.txt", name))).span();
    let params = Serde::deserialize(ref calldata).unwrap();
    assert!(calldata.is_empty());
    registrar.create_game(params)
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
        let rule = interact_with_state(address, || crate::logic::resources::rule(resource_type));
        let resource_key = array![game_id.into(), resource_type.into()].span();
        row(ref rows, 'ResourceRule', resource_key, (rule.unit_weight, rule.realm_rate, rule.village_rate));
        row(
            ref rows,
            'ProductionRecipe',
            resource_key,
            production_rules.production_recipe(crate::production::RecipeKey { game_id, resource_type }),
        );
    }
    let kinds: u8 = crate::balance::resources::MINE_KINDS.span().len().try_into().unwrap();
    for kind in 1..kinds + 1 {
        row(
            ref rows,
            'MineKindConfig',
            array![game_id.into(), kind.into()].span(),
            mine_rules.mine_kind(crate::mines::MineKindKey { game_id, kind }),
        );
    }
    row(ref rows, 'MinePool', key, crate::balance::resources::SURFACE_MINES.span());
}
pub fn observe_structures(ref rows: Array<ObservedRow>, address: ContractAddress, game_id: u32) {
    let key = array![game_id.into()].span();
    let building_rules = IBuildingRulesDispatcher { contract_address: address };
    for category in 1_u8..crate::buildings::BUILDING_CATEGORY_COUNT + 1 {
        row(
            ref rows,
            'BuildingRule',
            array![game_id.into(), category.into()].span(),
            building_rules.building_rule(crate::buildings::BuildingRuleKey { game_id, category }),
        );
    }
    row(ref rows, 'BoardRules', key, crate::balance::structures::BOARD);
    for row_ref in crate::research::ROWS.span() {
        let research_row = *row_ref;
        for tier in 1..crate::research::max_tier(research_row) + 1 {
            row(
                ref rows,
                'ResearchPrice',
                array![game_id.into(), research_row.into(), tier.into()].span(),
                crate::logic::research::price(research_row, tier),
            );
        }
    }
    row(
        ref rows,
        'CampRules',
        key,
        crate::camps::CampRules {
            resources: crate::balance::structures::CAMP_GRANTS.span(),
            labor_rate: crate::balance::structures::CAMP_LABOR_RATE,
        },
    );
    let limits = crate::logic::upgrades::limits();
    row(ref rows, 'UpgradeLimits', key, limits);
    for level in 1..core::cmp::max(limits.realm_max, limits.village_max) + 1 {
        row(
            ref rows,
            'UpgradeRecipe',
            array![game_id.into(), level.into()].span(),
            crate::logic::upgrades::recipe(level),
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
    for depth in 0..crate::balance::expeditions::DEPTH_RULES.span().len() {
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
    let bridge = IBridgeDispatcher { contract_address: address };
    let withdrawals = IWithdrawalsDispatcher { contract_address: address };
    if interact_with_state(address, || crate::logic::deep_sites::enabled(game_id)) {
        row(ref rows, 'DeepRules', key, interact_with_state(address, || observed_deep_rules()));
    }
    row(ref rows, 'QuestRules', key, interact_with_state(address, || observed_quest_rules()));
    row(ref rows, 'BaneRules', key, interact_with_state(address, || observed_bane_rules()));
    if let Some(race) = interact_with_state(address, || crate::logic::race::rules(game_id)) {
        row(ref rows, 'RaceRules', key, race);
    }
    row(ref rows, 'FrontierDiscoveryRules', key, crate::balance::expeditions::FRONTIER_DISCOVERY);
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
}

fn observed_quest_rules() -> crate::quests::QuestRules {
    let mut base_counts = array![];
    for kind in 0_u8..crate::quests::QUEST_COUNT {
        base_counts.append(crate::logic::banes::target(kind, 1).try_into().unwrap());
    }
    crate::quests::QuestRules {
        base_counts: base_counts.span(),
        labor: crate::balance::quests::LABOR_AMOUNT,
        essence: crate::balance::quests::ESSENCE_AMOUNT,
        bonus_percent: crate::balance::quests::BONUS_PERCENT,
    }
}

fn observed_deep_rules() -> crate::deep::DeepRules {
    let settings = crate::logic::deep_sites::rules();
    let mut rings = array![];
    for index in 0..settings.ring_count {
        rings.append(crate::logic::deep_sites::ring(index));
    }
    let mut beasts = array![];
    for kind in 0..crate::rules::DEEP_KIND_COUNT {
        beasts.append(crate::logic::deep_sites::beast(kind));
    }
    crate::deep::DeepRules {
        gate_distance: settings.gate_distance,
        rings: rings.span(),
        beasts: beasts.span(),
        loss_per_tick: settings.loss_per_tick,
        core_per_tick: settings.core_per_tick,
        mine_per_tick: settings.mine_per_tick,
        building_pay: settings.building_pay,
        altar_threshold: settings.altar_threshold,
    }
}

fn observed_bane_rules() -> crate::banes::BaneRules {
    let mut quest_counts = array![];
    for kind in crate::quests::STAND..crate::quests::CULL + 1 {
        for level in 1_u8..5 {
            quest_counts.append(crate::logic::banes::target(kind, level));
        }
    }
    crate::banes::BaneRules {
        chance_step: crate::balance::banes::CHANCE_STEP_PERCENT,
        quorum_percent: crate::balance::banes::QUORUM_PERCENT,
        beast_percent: crate::balance::banes::BEAST_PERCENT,
        stamina_percent: crate::balance::banes::STAMINA_PERCENT,
        production_percent: crate::balance::banes::PRODUCTION_PERCENT,
        quest_counts: quest_counts.span(),
    }
}
