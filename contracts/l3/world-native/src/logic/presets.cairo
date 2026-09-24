use games_storage::release::LogicClasses;
use starknet::ClassHash;
use crate::presets::{EconomyPreset, PresetDefinition, ResourcePreset, SettlementPreset, StructurePreset};
use crate::resources::{IResourceOperationsDispatcherTrait, IResourceOperationsLibraryDispatcher};

pub fn initialize_game(
    classes: LogicClasses, game_id: u32, preset: PresetDefinition, settlement_rules: crate::settlement::SettlementRules,
) {
    configure_resources(classes, game_id, preset.resources);
    configure_structures(classes, game_id, preset.structures);
    configure_settlement(classes.settlement, game_id, preset.settlement, settlement_rules);
    configure_economy(classes, game_id, preset.economy);
    crate::game::ISeasonLifecycleDispatcherTrait::configure_season_win(
        crate::game::ISeasonLifecycleLibraryDispatcher { class_hash: classes.season },
        game_id,
        preset.season_win_points,
    );
    initialize_map(classes, game_id, preset.rules.mode_rules, preset.exploration, preset.settlement.spires);
}

#[inline(always)]
fn configure_resources(classes: LogicClasses, game_id: u32, preset: ResourcePreset) {
    IResourceOperationsLibraryDispatcher { class_hash: classes.resources }
        .configure_resources(game_id, preset.resources);
    crate::production::IProductionRulesDispatcherTrait::configure_production(
        crate::production::IProductionRulesLibraryDispatcher { class_hash: classes.production },
        game_id,
        preset.production,
    );
    crate::mines::IMineRulesDispatcherTrait::configure_mines(
        crate::mines::IMineRulesLibraryDispatcher { class_hash: classes.production },
        game_id,
        preset.mine_kinds,
        preset.surface_mines,
    );
}
#[inline(always)]
fn configure_structures(classes: LogicClasses, game_id: u32, preset: StructurePreset) {
    crate::buildings::IBuildingRulesDispatcherTrait::configure_buildings(
        crate::buildings::IBuildingRulesLibraryDispatcher { class_hash: classes.construction },
        game_id,
        preset.buildings,
        preset.board,
    );
    crate::camps::ICampRulesDispatcherTrait::configure_camps(
        crate::camps::ICampRulesLibraryDispatcher { class_hash: classes.structures }, game_id, preset.camps,
    );
    crate::faith::IFaithDispatcherTrait::configure_faith(
        crate::faith::IFaithLibraryDispatcher { class_hash: classes.prizes }, game_id, preset.faith,
    );
    crate::upgrades::IUpgradeRulesDispatcherTrait::configure_upgrades(
        crate::upgrades::IUpgradeRulesLibraryDispatcher { class_hash: classes.settlement },
        game_id,
        preset.upgrade_limits,
        preset.upgrades,
    );
}
fn configure_settlement(
    address: ClassHash, game_id: u32, settlement: SettlementPreset, rules: crate::settlement::SettlementRules,
) {
    crate::settlement::ISettlementConfigurationDispatcherTrait::configure_settlement(
        crate::settlement::ISettlementConfigurationLibraryDispatcher { class_hash: address },
        game_id,
        rules,
        settlement.realms,
    );
    crate::village::IVillagesDispatcherTrait::configure_villages(
        crate::village::IVillagesLibraryDispatcher { class_hash: address }, game_id, settlement.villages,
    );
    crate::expeditions::IExpeditionRulesDispatcherTrait::configure_depths(
        crate::expeditions::IExpeditionRulesLibraryDispatcher { class_hash: address }, game_id, settlement.depths,
    );
}
#[inline(always)]
fn configure_economy(classes: LogicClasses, game_id: u32, preset: EconomyPreset) {
    let address = classes.economy;
    crate::trade::ITradeDispatcherTrait::configure_trade(
        crate::trade::ITradeLibraryDispatcher { class_hash: address }, game_id, preset.trade,
    );
    crate::market::IBankDispatcherTrait::configure_banks(
        crate::market::IBankLibraryDispatcher { class_hash: address }, game_id, preset.banks,
    );
    crate::hyperstructures::IHyperstructuresDispatcherTrait::configure_hyperstructures(
        crate::hyperstructures::IHyperstructuresLibraryDispatcher { class_hash: address },
        game_id,
        preset.hyperstructures,
    );
    crate::relics::IRelicsDispatcherTrait::configure_relics(
        crate::relics::IRelicsLibraryDispatcher { class_hash: classes.relics }, game_id, preset.relics, preset.chests,
    );
    crate::artificer::IArtificerDispatcherTrait::configure_artificer(
        crate::artificer::IArtificerLibraryDispatcher { class_hash: classes.relics }, game_id, preset.research_cost,
    );
    if let Some(withdrawals) = preset.withdrawals {
        crate::bridge::IBridgeDispatcherTrait::configure_deposits(
            crate::bridge::IBridgeLibraryDispatcher { class_hash: classes.bridge }, game_id, withdrawals.deposits,
        );
        crate::withdrawals::IWithdrawalsDispatcherTrait::configure_withdrawals(
            crate::withdrawals::IWithdrawalsLibraryDispatcher { class_hash: classes.bridge },
            game_id,
            withdrawals.rules,
            withdrawals.tokens,
        );
    }
}
fn initialize_map(
    classes: LogicClasses,
    game_id: u32,
    mode_rules: u32,
    exploration: Span<crate::exploration_rewards::ExplorationReward>,
    spires: Option<crate::spires::SpireLayout>,
) {
    crate::exploration_rewards::IExtractionDispatcherTrait::configure_extraction(
        crate::exploration_rewards::IExtractionLibraryDispatcher { class_hash: classes.map }, game_id, exploration,
    );
    if mode_rules & crate::rules::RESERVED_HYPERSTRUCTURES != 0 {
        crate::settlement::IBlitzReservationsDispatcherTrait::initialize_reservations(
            crate::settlement::IBlitzReservationsLibraryDispatcher { class_hash: classes.placement }, game_id,
        );
    }
    if mode_rules & crate::rules::SPIRES != 0 {
        crate::spires::ISpiresDispatcherTrait::initialize_spires(
            crate::spires::ISpiresLibraryDispatcher { class_hash: classes.placement },
            game_id,
            spires.expect('missing season spires'),
        );
    }
}
