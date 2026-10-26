pub use snforge_std::{EventSpyTrait, EventsFilterTrait, start_cheat_caller_address, stop_cheat_caller_address};
pub use starknet::ContractAddress;
pub use crate::bridge::{Deposit, DepositRules, IBridgeSafeDispatcher, IBridgeSafeDispatcherTrait, Withdraw};
pub use crate::commands::Command;
pub use crate::game::IGameDispatcherTrait;
pub use crate::registrar::IRegistrarSafeDispatcherTrait;
pub use crate::resources::{IResourceOperationsDispatcher, ResourceAmount, ResourceKey, ResourceSlot};
pub use crate::rules::RESOURCE_PRECISION;
pub use crate::structures::{IStructureOperationsDispatcher, StructureRecord};
pub use crate::tests::state::{ResourceObservationTrait, StructureObservationTrait};
pub use super::fixtures::{ITokenFixtureDispatcher, ITokenFixtureDispatcherTrait};
pub use super::resource_commands::{assert_terminal_rejection, execute, grant, set_fixture};
pub const TOKENS: u256 = 1000000000000000000000;
pub const STOCK: u128 = 1000 * RESOURCE_PRECISION;
pub fn deposit_rules(paused: bool) -> DepositRules {
    DepositRules { paused, realm_fee_bps: 500, velords_fee_bps: 100, season_fee_bps: 200, client_fee_bps: 300 }
}
pub fn setup(village: bool, paused: bool) -> (super::Deployment, ResourceKey, ResourceKey, ContractAddress) {
    setup_with_platform_fees(village, paused, 100, 200, 300)
}
pub fn setup_with_platform_fees(
    village: bool, paused: bool, velords: u16, season: u16, client: u16,
) -> (super::Deployment, ResourceKey, ResourceKey, ContractAddress) {
    let mut rules = super::play_fixture::rules();
    rules.mode_rules = super::play_fixture::ETERNUM_RULES;
    rules.command_mask = super::play_fixture::ETERNUM_COMMAND_MASK;
    rules.entry_rule = crate::rules::ENTRY_ENTITLEMENT;
    rules.speed_config.donkey_sec_per_km = 1;
    rules.tick_config.delivery_tick_in_seconds = 1;
    rules.capacity_config.donkey_capacity = 100;
    let d = super::setup_with_domains(true, "StructuresLogic", "TroopsLogic");
    let (mut withdrawals, token, _) = super::market::wallet_preset(d, paused);
    withdrawals
        .deposits =
            DepositRules {
                velords_fee_bps: velords, season_fee_bps: season, client_fee_bps: client, ..deposit_rules(paused),
            };
    withdrawals.rules.velords_fee_bps = velords;
    withdrawals.rules.season_fee_bps = season;
    withdrawals.rules.client_fee_bps = client;
    let mut preset = super::resource_commands::fixture_preset(rules);
    preset.economy.withdrawals = Some(withdrawals);
    let (d, realm, target) = super::resource_commands::setup_in_deployment(d, preset);
    if village {
        let structure = IStructureOperationsDispatcher { contract_address: d.games }.structure(target).unwrap();
        set_fixture(
            d.games,
            selector!("structures"),
            selector!("structures"),
            array![3, target.entity_id.into()].span(),
            StructureRecord {
                owner: structure.owner,
                base: crate::structures::StructureBase { category: 5, ..structure.base },
                resources_packed: structure.resources_packed,
                metadata: crate::structures::StructureMetadata { village_realm: realm.entity_id, ..structure.metadata },
            },
        );
    }
    grant(d, target, 2, STOCK);
    grant(d, target, 25, 10 * RESOURCE_PRECISION);
    ITokenFixtureDispatcher { contract_address: token }.seed(d.actor, TOKENS);
    (d, realm, target, token)
}
pub fn deposit(target: ResourceKey) -> Command {
    Command::DepositResource(
        Deposit {
            structure_id: target.entity_id,
            resource_type: 2,
            amount: TOKENS,
            client_fee_recipient: 0.try_into().unwrap(),
        },
    )
}
pub fn withdraw(target: ResourceKey, actor: ContractAddress) -> Command {
    Command::WithdrawResource(
        Withdraw {
            structure_id: target.entity_id,
            recipient: actor,
            resource_type: 2,
            amount: STOCK,
            client_fee_recipient: 0.try_into().unwrap(),
        },
    )
}
pub fn balance(d: super::Deployment, target: ResourceKey, resource_type: u8) -> u128 {
    IResourceOperationsDispatcher { contract_address: d.games }
        .resource_balance(ResourceSlot { game_id: target.game_id, entity_id: target.entity_id, resource_type })
}
pub fn tokens(token: ContractAddress, actor: ContractAddress) -> u256 {
    crate::withdrawals::IResourceTokenDispatcherTrait::balance_of(
        crate::withdrawals::IResourceTokenDispatcher { contract_address: token }, actor,
    )
}
pub fn arrival(d: super::Deployment, target: ResourceKey, travel: u64) -> Span<ResourceAmount> {
    IResourceOperationsDispatcher { contract_address: d.games }
        .resource_arrival(crate::arrivals::arrival_key(3, target.entity_id, 1, 40, travel))
        .resources
}
pub fn amount(value: u128) -> Span<ResourceAmount> {
    array![ResourceAmount { resource_type: 2, amount: value }].span()
}
