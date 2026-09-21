use crate::lifecycle::Peers;
use crate::resources::{IResourcesDispatcher, IResourcesDispatcherTrait};

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ResourcePreset {
    pub resources: Span<crate::resources::ResourceRule>,
    pub production: Span<crate::production::RecipeConfig>,
    pub mine_kinds: Span<crate::mines::MineKindEntry>,
    pub surface_mines: Span<crate::mines::MineWeight>,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct StructurePreset {
    pub buildings: Span<crate::buildings::BuildingRuleConfig>,
    pub camps: Span<crate::resources::ResourceAmount>,
    pub faith: crate::faith::FaithRules,
    pub upgrade_limits: crate::upgrades::UpgradeLimits,
    pub upgrades: Span<crate::upgrades::UpgradeRecipe>,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct SettlementPreset {
    pub reward_profile: u8,
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
    assert!(troops.mercenaries_troop_lower_bound < troops.mercenaries_troop_upper_bound, "invalid mercenary bounds");
    if crate::rules::is_blitz(preset.rules) && map.camp_win_probability != 0 {
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

pub fn initialize_game(
    peers: Peers, game_id: u32, preset: PresetDefinition, params: crate::registrar::CreateGameParams,
) {
    configure_resources(peers.resources, game_id, preset.resources);
    configure_structures(peers, game_id, preset.structures);
    configure_settlement(peers.settlement, game_id, preset, params);
    configure_economy(peers, game_id, preset.economy);
    configure_season(peers, game_id, preset);
    initialize_map(peers.map, game_id, preset);
}

fn configure_resources(address: ContractAddress, game_id: u32, preset: ResourcePreset) {
    IResourcesDispatcher { contract_address: address }.configure_resources(game_id, preset.resources);
    crate::production::IProductionRulesDispatcherTrait::configure_production(
        crate::production::IProductionRulesDispatcher { contract_address: address }, game_id, preset.production,
    );
    crate::mines::IMineRulesDispatcherTrait::configure_mines(
        crate::mines::IMineRulesDispatcher { contract_address: address },
        game_id,
        preset.mine_kinds,
        preset.surface_mines,
    );
}
fn configure_structures(peers: Peers, game_id: u32, preset: StructurePreset) {
    crate::buildings::IBuildingRulesDispatcherTrait::configure_buildings(
        crate::buildings::IBuildingRulesDispatcher { contract_address: peers.structures }, game_id, preset.buildings,
    );
    crate::camps::ICampRulesDispatcherTrait::configure_camps(
        crate::camps::ICampRulesDispatcher { contract_address: peers.structures }, game_id, preset.camps,
    );
    crate::faith::IFaithDispatcherTrait::configure_faith(
        crate::faith::IFaithDispatcher { contract_address: peers.prizes }, game_id, preset.faith,
    );
    crate::upgrades::IUpgradeRulesDispatcherTrait::configure_upgrades(
        crate::upgrades::IUpgradeRulesDispatcher { contract_address: peers.registry },
        game_id,
        preset.upgrade_limits,
        preset.upgrades,
    );
}
fn configure_settlement(
    address: ContractAddress, game_id: u32, preset: PresetDefinition, params: crate::registrar::CreateGameParams,
) {
    let settlement = preset.settlement;
    let rules = crate::settlement::SettlementRules {
        registration_start: params.registration_start,
        registration_limit: params.roster.len().try_into().unwrap(),
        mode: if crate::rules::is_blitz(preset.rules) {
            params.mode
        } else {
            crate::settlement::SettlementMode::Single
        },
        reward_profile: settlement.reward_profile,
    };
    crate::settlement::ISettlementConfigurationDispatcherTrait::configure_settlement(
        crate::settlement::ISettlementConfigurationDispatcher { contract_address: address },
        game_id,
        rules,
        settlement.realms,
    );
    crate::village::IVillagesDispatcherTrait::configure_villages(
        crate::village::IVillagesDispatcher { contract_address: address }, game_id, settlement.villages,
    );
}
fn configure_economy(peers: Peers, game_id: u32, preset: EconomyPreset) {
    let address = peers.economy;
    crate::trade::ITradeDispatcherTrait::configure_trade(
        crate::trade::ITradeDispatcher { contract_address: address }, game_id, preset.trade,
    );
    crate::market::IBankDispatcherTrait::configure_banks(
        crate::market::IBankDispatcher { contract_address: address }, game_id, preset.banks,
    );
    crate::hyperstructures::IHyperstructuresDispatcherTrait::configure_hyperstructures(
        crate::hyperstructures::IHyperstructuresDispatcher { contract_address: address },
        game_id,
        preset.hyperstructures,
    );
    crate::relics::IRelicsDispatcherTrait::configure_relics(
        crate::relics::IRelicsDispatcher { contract_address: address }, game_id, preset.relics,
    );
    crate::artificer::IArtificerDispatcherTrait::configure_artificer(
        crate::artificer::IArtificerDispatcher { contract_address: address }, game_id, preset.research_cost,
    );
    if let Some(withdrawals) = preset.withdrawals {
        crate::bridge::IBridgeDispatcherTrait::configure_deposits(
            crate::bridge::IBridgeDispatcher { contract_address: peers.bridge }, game_id, withdrawals.deposits,
        );
        crate::withdrawals::IWithdrawalsDispatcherTrait::configure_withdrawals(
            crate::withdrawals::IWithdrawalsDispatcher { contract_address: peers.bridge },
            game_id,
            withdrawals.rules,
            withdrawals.tokens,
        );
    }
}
fn configure_season(peers: Peers, game_id: u32, preset: PresetDefinition) {
    crate::game::ISeasonLifecycleDispatcherTrait::configure_season_win(
        crate::game::ISeasonLifecycleDispatcher { contract_address: peers.season }, game_id, preset.season_win_points,
    );
}
fn initialize_map(address: ContractAddress, game_id: u32, preset: PresetDefinition) {
    crate::exploration_rewards::IExtractionDispatcherTrait::configure_extraction(
        crate::exploration_rewards::IExtractionDispatcher { contract_address: address }, game_id, preset.exploration,
    );
    if crate::rules::is_blitz(preset.rules) {
        crate::settlement::IBlitzReservationsDispatcherTrait::initialize_reservations(
            crate::settlement::IBlitzReservationsDispatcher { contract_address: address }, game_id,
        );
    } else {
        crate::spires::ISpiresDispatcherTrait::initialize_spires(
            crate::spires::ISpiresDispatcher { contract_address: address },
            game_id,
            preset.settlement.spires.expect('missing season spires'),
        );
    }
}
use starknet::ContractAddress;
