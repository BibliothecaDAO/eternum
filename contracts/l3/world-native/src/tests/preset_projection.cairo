// Current presets come from source; Herald replays historical launches under their recorded schema.
use snforge_std::fs::{FileTrait, read_txt};
use snforge_std::{interact_with_state, start_cheat_caller_address};
use starknet::ContractAddress;
use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess};
use crate::artificer::{IArtificerDispatcher, IArtificerDispatcherTrait};
use crate::bridge::{IBridgeDispatcher, IBridgeDispatcherTrait};
use crate::buildings::{IBuildingRulesDispatcher, IBuildingRulesDispatcherTrait};
use crate::camps::{ICampRulesDispatcher, ICampRulesDispatcherTrait};
use crate::expeditions::{IExpeditionRulesDispatcher, IExpeditionRulesDispatcherTrait};
use crate::exploration_rewards::{IExtractionDispatcher, IExtractionDispatcherTrait};
use crate::faith::{IFaithDispatcher, IFaithDispatcherTrait};
use crate::game::{IGameDispatcher, IGameDispatcherTrait, ISeasonLifecycleDispatcher, ISeasonLifecycleDispatcherTrait};
use crate::hyperstructures::{IHyperstructuresDispatcher, IHyperstructuresDispatcherTrait};
use crate::market::{IBankDispatcher, IBankDispatcherTrait};
use crate::mines::{IMineRulesDispatcher, IMineRulesDispatcherTrait};
use crate::production::{IProductionRulesDispatcher, IProductionRulesDispatcherTrait};
use crate::registrar::{
    IRegistrarDispatcher, IRegistrarDispatcherTrait, IRegistrarSafeDispatcher, IRegistrarSafeDispatcherTrait,
};
use crate::relics::{IRelicsDispatcher, IRelicsDispatcherTrait};
use crate::settlement::{ISettlementViewsDispatcher, ISettlementViewsDispatcherTrait};
use crate::spires::{ISpiresDispatcher, ISpiresDispatcherTrait};
use crate::trade::{ITradeDispatcher, ITradeDispatcherTrait};
use crate::upgrades::{IUpgradeRulesDispatcher, IUpgradeRulesDispatcherTrait};
use crate::village::{IVillagesDispatcher, IVillagesDispatcherTrait};
use crate::withdrawals::{IWithdrawalsDispatcher, IWithdrawalsDispatcherTrait};

#[derive(Drop, Serde, Debug, PartialEq)]
struct ObservedRow {
    model: felt252,
    keys: Span<felt252>,
    values: Span<felt252>,
}

fn row<T, +Serde<T>, +Drop<T>>(ref rows: Array<ObservedRow>, model: felt252, keys: Span<felt252>, value: T) {
    let mut values = array![];
    value.serialize(ref values);
    rows.append(ObservedRow { model, keys, values: values.span() });
}

pub fn current_definition(name: ByteArray) -> (u32, crate::presets::PresetDefinition) {
    let mut registration = read_txt(@FileTrait::new(format!("tests/fixtures/current-presets/{}-register.txt", name)))
        .span();
    let preset_id = Serde::deserialize(ref registration).unwrap();
    let definition = Serde::deserialize(ref registration).unwrap();
    assert!(registration.is_empty());
    (preset_id, definition)
}

pub fn frontier_discovery_rules() -> crate::expeditions::FrontierDiscoveryRules {
    let (_, definition) = current_definition("frontier");
    definition.economy.discovery.unwrap()
}

pub fn frontier_progression_rules() -> crate::progression::ArmyProgressionRules {
    let (_, definition) = current_definition("frontier");
    definition.economy.progression.unwrap()
}

fn launch(address: ContractAddress, name: ByteArray) -> u32 {
    let (preset_id, definition) = current_definition(name.clone());
    let registrar = IRegistrarDispatcher { contract_address: address };
    registrar.register_preset(preset_id, definition);
    let mut calldata = read_txt(@FileTrait::new(format!("tests/fixtures/current-presets/{}-create.txt", name))).span();
    let params = Serde::deserialize(ref calldata).unwrap();
    assert!(calldata.is_empty());
    registrar.create_game(params)
}

#[test]
fn current_blitz_launch_readers_match_herald_projection() {
    compare_current_launch("blitz");
}

#[test]
fn current_frontier_launch_readers_match_herald_projection() {
    compare_current_launch("frontier");
}

#[test]
fn current_eternum_optional_sections_and_map_match_herald_projection() {
    compare_current_launch("eternum");
}

fn compare_current_launch(name: ByteArray) {
    let d = super::registrar::setup();
    start_cheat_caller_address(d.games, super::authority());
    assert_eq!(launch(d.games, name.clone()), 1);
    compare(d.games, 1, name);
}

#[test]
#[feature("safe_dispatcher")]
fn current_frontier_rejects_a_reintroduced_supply_pool() {
    let d = super::registrar::setup();
    start_cheat_caller_address(d.games, super::authority());
    let mut registration = read_txt(@FileTrait::new("tests/fixtures/current-presets/frontier-register.txt")).span();
    let preset_id: u32 = Serde::deserialize(ref registration).unwrap();
    let mut definition: crate::presets::PresetDefinition = Serde::deserialize(ref registration).unwrap();
    assert!(registration.is_empty());
    assert!(definition.exploration.is_empty());
    definition
        .exploration =
            array![
                crate::exploration_rewards::ExplorationReward {
                    resource_type: crate::resources::ESSENCE, amount: 1, amount_max: 1, weight: 1,
                },
            ]
        .span();
    assert!(IRegistrarSafeDispatcher { contract_address: d.games }.register_preset(preset_id, definition).is_err());
    assert_eq!(IRegistrarDispatcher { contract_address: d.games }.preset_commitment(preset_id), 0);
}

#[test]
#[feature("safe_dispatcher")]
fn current_frontier_requires_complete_progression_rules() {
    let d = super::registrar::setup();
    start_cheat_caller_address(d.games, super::authority());
    for invalid in 0_u8..4 {
        let (preset_id, mut definition) = current_definition("frontier");
        let mut progression = definition.economy.progression.unwrap();
        if invalid == 1 {
            progression.reveal_xp = 0;
        } else if invalid == 2 {
            progression.clear_xp = 0;
        } else if invalid == 3 {
            progression.level_step_xp = 0;
        }
        definition.economy.progression = if invalid == 0 {
            None
        } else {
            Some(progression)
        };
        assert!(IRegistrarSafeDispatcher { contract_address: d.games }.register_preset(preset_id, definition).is_err());
        assert_eq!(IRegistrarDispatcher { contract_address: d.games }.preset_commitment(preset_id), 0);
    }
}

fn compare(address: ContractAddress, game_id: u32, name: ByteArray) {
    compare_rows(observe(address, game_id), name);
}

fn compare_rows(actual: Array<ObservedRow>, name: ByteArray) {
    let mut serialized = read_txt(@FileTrait::new(format!("tests/fixtures/current-presets/{}-rows.txt", name))).span();
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

fn observe(address: ContractAddress, game_id: u32) -> Array<ObservedRow> {
    let mut rows = array![];
    observe_game_rules(ref rows, address, game_id);
    observe_resources(ref rows, address, game_id);
    observe_structures(ref rows, address, game_id);
    observe_settlement(ref rows, address, game_id);
    observe_economy(ref rows, address, game_id);
    observe_rewards(ref rows, address, game_id);
    rows
}

fn observe_game_rules(ref rows: Array<ObservedRow>, address: ContractAddress, game_id: u32) {
    let key = array![game_id.into()].span();
    let game = IGameDispatcher { contract_address: address };
    let settlement_views = ISettlementViewsDispatcher { contract_address: address };
    row(ref rows, 'SliceRules', key, game.rules(game_id));
    row(ref rows, 'SettlementRules', key, settlement_views.settlement_rules(game_id));
}

fn observe_resources(ref rows: Array<ObservedRow>, address: ContractAddress, game_id: u32) {
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

fn observe_structures(ref rows: Array<ObservedRow>, address: ContractAddress, game_id: u32) {
    let key = array![game_id.into()].span();
    let building_rules = IBuildingRulesDispatcher { contract_address: address };
    let camp_rules = ICampRulesDispatcher { contract_address: address };
    let faith = IFaithDispatcher { contract_address: address };
    let upgrade_rules = IUpgradeRulesDispatcher { contract_address: address };
    for category in 1_u8..41 {
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
        for node in 0..crate::research::NODE_COUNT {
            row(
                ref rows,
                'ResearchNode',
                array![game_id.into(), node.into()].span(),
                interact_with_state(address, || crate::logic::research::node(game_id, node)),
            );
        }
        for category in array![1_u8, 2, 28, 37] {
            for tier in 2_u8..4 {
                row(
                    ref rows,
                    'BuildingTierRule',
                    array![game_id.into(), category.into(), tier.into()].span(),
                    interact_with_state(address, || crate::logic::research::tier_rule(game_id, category, tier)),
                );
            }
        }
    }
    row(ref rows, 'CampResources', key, camp_rules.camp_resources(game_id));
    row(ref rows, 'FaithRules', key, faith.faith_rules(game_id));
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

fn observe_settlement(ref rows: Array<ObservedRow>, address: ContractAddress, game_id: u32) {
    let key = array![game_id.into()].span();
    let settlement_views = ISettlementViewsDispatcher { contract_address: address };
    let villages = IVillagesDispatcher { contract_address: address };
    let expedition_rules = IExpeditionRulesDispatcher { contract_address: address };
    let spires = ISpiresDispatcher { contract_address: address };
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

fn observe_economy(ref rows: Array<ObservedRow>, address: ContractAddress, game_id: u32) {
    let key = array![game_id.into()].span();
    let trade = ITradeDispatcher { contract_address: address };
    let bank = IBankDispatcher { contract_address: address };
    let hyperstructures = IHyperstructuresDispatcher { contract_address: address };
    let relics = IRelicsDispatcher { contract_address: address };
    let artificer = IArtificerDispatcher { contract_address: address };
    let bridge = IBridgeDispatcher { contract_address: address };
    let withdrawals = IWithdrawalsDispatcher { contract_address: address };
    row(ref rows, 'TradeRules', key, trade.trade_rules(game_id));
    row(ref rows, 'BankRules', key, bank.bank_rules(game_id));
    row(ref rows, 'HyperstructureRules', key, hyperstructures.hyperstructure_rules(game_id));
    row(ref rows, 'RelicRules', key, relics.relic_rules(game_id));
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
                    withdrawals.resource_token(crate::market::MarketKey { game_id, resource_type }),
                );
            }
        }
    }
}

fn observe_rewards(ref rows: Array<ObservedRow>, address: ContractAddress, game_id: u32) {
    let key = array![game_id.into()].span();
    let extraction = IExtractionDispatcher { contract_address: address };
    let season_lifecycle = ISeasonLifecycleDispatcher { contract_address: address };
    row(ref rows, 'ExtractionRewards', key, extraction.extraction_rewards(game_id));
    row(ref rows, 'SeasonWinThreshold', key, season_lifecycle.season_win_threshold(game_id));
}

#[test]
#[feature("safe_dispatcher")]
fn current_frontier_requires_discovery_and_chest_rules_and_refuses_sequential_odds() {
    let d = super::registrar::setup();
    start_cheat_caller_address(d.games, super::authority());
    for invalid in 0_u8..3 {
        let (preset_id, mut definition) = current_definition("frontier");
        if invalid == 0 {
            definition.economy.discovery = None;
        } else if invalid == 1 {
            definition.economy.chests = None;
        } else {
            definition.rules.map_config.camp_win_probability = 4;
        }
        assert!(IRegistrarSafeDispatcher { contract_address: d.games }.register_preset(preset_id, definition).is_err());
        assert_eq!(IRegistrarDispatcher { contract_address: d.games }.preset_commitment(preset_id), 0);
    }
}
