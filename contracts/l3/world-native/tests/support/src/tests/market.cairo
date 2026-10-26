pub use snforge_std::{
    EventSpyTrait, EventsFilterTrait, spy_events, start_cheat_block_timestamp_global, start_cheat_caller_address,
    stop_cheat_caller_address,
};
pub use crate::commands::{Command, ExecutionContext};
pub use crate::game::IGameDispatcherTrait;
pub use crate::market::{
    AddLiquidity, BankPlacement, BankRules, IBankDispatcher, IBankDispatcherTrait, IBankSafeDispatcher,
    IBankSafeDispatcherTrait, LiquidityKey, Market, MarketKey, RemoveLiquidity, Swap,
};
pub use crate::registrar::IRegistrarSafeDispatcherTrait;
pub use crate::resources::{IResourceOperationsDispatcher, ResourceAmount, ResourceKey, ResourceSlot};
pub use crate::rules::RESOURCE_PRECISION;
pub use crate::tests::state::{MapObservationTrait, ResourceObservationTrait};
pub use crate::troops::Coord;
pub use super::resource_commands::{assert_terminal_rejection, execute, grant};
pub const BANK: u64 = 0xfffffffe;
pub const STOCK: u128 = 100000 * RESOURCE_PRECISION;
pub fn banks() -> Span<BankPlacement> {
    let mut banks = array![];
    for index in 0_u32..6 {
        banks.append(BankPlacement { name: 'Bank', coord: Coord { alt: false, x: 2000100 + 10 * index, y: 2000000 } });
    }
    banks.span()
}
pub fn market_preset() -> crate::presets::PresetDefinition {
    let mut rules = super::play_fixture::rules();
    rules.mode_rules = super::play_fixture::ETERNUM_RULES;
    rules.command_mask = super::play_fixture::ETERNUM_COMMAND_MASK;
    rules.entry_rule = crate::rules::ENTRY_ENTITLEMENT;
    rules.speed_config.donkey_sec_per_km = 1;
    rules.speed_config.donkey_sec_per_km_troops = 2;
    rules.tick_config.delivery_tick_in_seconds = 1;
    rules.capacity_config.donkey_capacity = 100;
    let mut preset = super::resource_commands::fixture_preset(rules);
    preset.economy.banks = BankRules { lp_fee_num: 3, lp_fee_denom: 1000, owner_fee_num: 1, owner_fee_denom: 100 };
    preset.economy.trade = crate::trade::TradeRules { max_count: 7 };
    preset
}
pub fn setup() -> (super::Deployment, ResourceKey, ResourceKey) {
    let deployment = super::setup_with_domains(true, "StructuresLogic", "TroopsLogic");
    setup_market(deployment, market_preset())
}
pub fn setup_with_wallet(
    paused: bool,
) -> (super::Deployment, ResourceKey, ResourceKey, starknet::ContractAddress, starknet::ContractAddress) {
    let deployment = super::setup_with_domains(true, "StructuresLogic", "TroopsLogic");
    let (withdrawals, resource, lords) = wallet_preset(deployment, paused);
    let mut preset = market_preset();
    preset.economy.withdrawals = Some(withdrawals);
    let (deployment, source, other) = setup_market(deployment, preset);
    (deployment, source, other, resource, lords)
}
pub fn setup_market(
    deployment: super::Deployment, preset: crate::presets::PresetDefinition,
) -> (super::Deployment, ResourceKey, ResourceKey) {
    let (deployment, source, other) = super::resource_commands::setup_in_deployment(deployment, preset);
    let bank = IBankDispatcher { contract_address: deployment.games };
    start_cheat_block_timestamp_global(30);
    start_cheat_caller_address(deployment.games, deployment.games);
    bank
        .create_banks(
            3,
            super::authority(),
            banks(),
            crate::commands::action_context(ExecutionContext { timestamp: 30, ..super::context(deployment.games, 3) }),
        );
    stop_cheat_caller_address(deployment.games);
    for key in array![source, other] {
        for resource in array![2, 26, 37, 25] {
            grant(deployment, key, resource, STOCK);
        }
    }
    (deployment, source, other)
}
pub fn add(source: ResourceKey, lords_amount: u128, resource_amount: u128) -> Command {
    Command::AddBankLiquidity(
        AddLiquidity { bank_id: BANK, structure_id: source.entity_id, resource_type: 2, lords_amount, resource_amount },
    )
}
pub fn remove(destination: u64, shares: u128) -> Command {
    Command::RemoveBankLiquidity(RemoveLiquidity { bank_id: BANK, structure_id: destination, resource_type: 2, shares })
}
pub fn view(deployment: super::Deployment) -> IBankDispatcher {
    IBankDispatcher { contract_address: deployment.games }
}
pub fn balance(deployment: super::Deployment, entity: u64, resource_type: u8) -> u128 {
    IResourceOperationsDispatcher { contract_address: deployment.games }
        .resource_balance(ResourceSlot { game_id: 3, entity_id: entity, resource_type })
}
pub fn arrival(deployment: super::Deployment, entity: u64, time: u64, travel: u64) -> Span<ResourceAmount> {
    IResourceOperationsDispatcher { contract_address: deployment.games }
        .resource_arrival(crate::arrivals::arrival_key(3, entity, 1, time, travel))
        .resources
}
pub fn lp(deployment: super::Deployment) -> u128 {
    view(deployment).liquidity(LiquidityKey { game_id: 3, owner: deployment.actor, resource_type: 2 })
}
pub fn market(deployment: super::Deployment) -> Market {
    view(deployment).market(MarketKey { game_id: 3, resource_type: 2 })
}
pub fn wallet_preset(
    deployment: super::Deployment, paused: bool,
) -> (crate::presets::WithdrawalPreset, starknet::ContractAddress, starknet::ContractAddress) {
    let (resource, _) = super::deploy("BankTokenFixture", @array![deployment.games.into()]);
    let (lords, _) = super::deploy("BankTokenFixture", @array![deployment.games.into()]);
    let mut retention = array![];
    for (troop_percent, resource_percent) in array![(0, 25), (25, 50), (50, 70), (70, 85), (85, 95), (95, 95)] {
        retention.append(crate::withdrawals::Retention { troop_percent, resource_percent });
    }
    let preset = crate::presets::WithdrawalPreset {
        deposits: crate::bridge::DepositRules {
            paused, realm_fee_bps: 0, velords_fee_bps: 0, season_fee_bps: 0, client_fee_bps: 0,
        },
        rules: crate::withdrawals::WithdrawalRules {
            paused,
            bank_fee_bps: 500,
            velords_fee_bps: 100,
            season_fee_bps: 200,
            client_fee_bps: 300,
            velords_recipient: 0x777.try_into().unwrap(),
            season_recipient: 0x888.try_into().unwrap(),
            retention: retention.span(),
        },
        tokens: array![
            crate::withdrawals::ResourceToken { resource_type: 2, token: resource },
            crate::withdrawals::ResourceToken { resource_type: 37, token: lords },
        ]
            .span(),
    };
    (preset, resource, lords)
}
pub fn token_balance(token: starknet::ContractAddress, owner: starknet::ContractAddress) -> u256 {
    crate::withdrawals::IResourceTokenDispatcherTrait::balance_of(
        crate::withdrawals::IResourceTokenDispatcher { contract_address: token }, owner,
    )
}
pub fn assert_wallet_liquidity_withdrawal(funded: bool) {
    let (deployment, source, _, resource, lords) = setup_with_wallet(false);
    if funded {
        for token in array![resource, lords] {
            super::fixtures::ITokenFixtureDispatcherTrait::seed(
                super::fixtures::ITokenFixtureDispatcher { contract_address: token },
                deployment.games,
                1000000000000000000000000,
            );
        }
    }
    assert!(execute(deployment, add(source, 1000 * RESOURCE_PRECISION, 1000 * RESOURCE_PRECISION), 40));
    assert!(execute(deployment, remove(0, 1000 * RESOURCE_PRECISION), 50));
    assert_eq!(token_balance(resource, deployment.actor), 222500000000000000000);
    assert_eq!(token_balance(lords, deployment.actor), 890000000000000000000);
    assert_eq!(token_balance(resource, 0x777.try_into().unwrap()), 10000000000000000000);
    assert_eq!(token_balance(resource, 0x888.try_into().unwrap()), 5000000000000000000);
    assert_eq!(token_balance(lords, 0x777.try_into().unwrap()), 40000000000000000000);
    assert_eq!(token_balance(lords, 0x888.try_into().unwrap()), 20000000000000000000);
    assert_eq!(
        arrival(deployment, BANK, 50, 0),
        array![
            ResourceAmount { resource_type: 2, amount: 12500000000 },
            ResourceAmount { resource_type: 37, amount: 50000000000 },
        ]
            .span(),
    );
    assert_eq!(lp(deployment), 0);
    assert_eq!(market(deployment), Default::default());
}
