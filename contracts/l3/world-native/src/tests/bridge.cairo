use snforge_std::{EventSpyTrait, EventsFilterTrait, start_cheat_caller_address, stop_cheat_caller_address};
use starknet::ContractAddress;
use crate::bridge::{
    Deposit, DepositRules, IBankWithdrawalSafeDispatcher, IBankWithdrawalSafeDispatcherTrait, IBridgeDispatcher,
    IBridgeDispatcherTrait, IBridgeSafeDispatcher, IBridgeSafeDispatcherTrait, Withdraw,
};
use crate::commands::Command;
use crate::resources::{IResourcesDispatcher, IResourcesDispatcherTrait, ResourceAmount, ResourceKey, ResourceSlot};
use crate::rules::RESOURCE_PRECISION;
use crate::structures::{IStructuresDispatcher, IStructuresDispatcherTrait, StructureRecord};
use super::fixtures::{ITokenFixtureDispatcher, ITokenFixtureDispatcherTrait};
use super::resource_commands::{
    assert_terminal_rejection, execute, execute_recorded_at, grant, set_fixture, setup_with_rules,
};

const TOKENS: u256 = 1000000000000000000000;
const STOCK: u128 = 1000 * RESOURCE_PRECISION;

fn deposit_rules(paused: bool) -> DepositRules {
    DepositRules { paused, realm_fee_bps: 500, velords_fee_bps: 100, season_fee_bps: 200, client_fee_bps: 300 }
}
fn setup(village: bool, paused: bool) -> (super::Deployment, ResourceKey, ResourceKey, ContractAddress) {
    let mut rules = super::recorded::rules();
    rules.mode_rules = super::recorded::ETERNUM_RULES;
    rules.command_mask = super::recorded::ETERNUM_COMMAND_MASK;
    rules.entry_rule = crate::rules::ENTRY_ENTITLEMENT;
    rules.speed_config.donkey_sec_per_km = 1;
    rules.tick_config.delivery_tick_in_seconds = 1;
    rules.capacity_config.donkey_capacity = 100;
    let (d, realm, target) = setup_with_rules(rules);
    let (token, _) = super::market::configure_wallet(d, paused);
    start_cheat_caller_address(d.peers.bridge, super::authority());
    IBridgeDispatcher { contract_address: d.peers.bridge }.configure_deposits(3, deposit_rules(paused));
    stop_cheat_caller_address(d.peers.bridge);
    if village {
        let structure = IStructuresDispatcher { contract_address: d.peers.structures }.structure(target).unwrap();
        set_fixture(
            d.peers.structures,
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
fn deposit(target: ResourceKey) -> Command {
    Command::DepositResource(
        Deposit {
            structure_id: target.entity_id,
            resource_type: 2,
            amount: TOKENS,
            client_fee_recipient: 0.try_into().unwrap(),
        },
    )
}
fn withdraw(target: ResourceKey, actor: ContractAddress) -> Command {
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
fn balance(d: super::Deployment, target: ResourceKey, resource_type: u8) -> u128 {
    IResourcesDispatcher { contract_address: d.peers.resources }
        .resource_balance(ResourceSlot { game_id: target.game_id, entity_id: target.entity_id, resource_type })
}
fn tokens(token: ContractAddress, actor: ContractAddress) -> u256 {
    crate::withdrawals::IResourceTokenDispatcherTrait::balance_of(
        crate::withdrawals::IResourceTokenDispatcher { contract_address: token }, actor,
    )
}
fn arrival(d: super::Deployment, target: ResourceKey, travel: u64) -> Span<ResourceAmount> {
    IResourcesDispatcher { contract_address: d.peers.resources }
        .resource_arrival(crate::arrivals::arrival_key(3, target.entity_id, 1, 40, travel))
        .resources
}
fn amount(value: u128) -> Span<ResourceAmount> {
    array![ResourceAmount { resource_type: 2, amount: value }].span()
}

#[test]
fn deposit_applies_retention_platform_fees_and_connected_realm_fee() {
    for village in array![false, true] {
        let (d, realm, target, token) = setup(village, false);
        assert!(execute_recorded_at(d, deposit(target), 40, 1000));
        assert_eq!(tokens(token, d.actor), 0);
        assert_eq!(tokens(token, 0x777.try_into().unwrap()), 10000000000000000000);
        assert_eq!(tokens(token, 0x888.try_into().unwrap()), 5000000000000000000);
        assert_eq!(balance(d, target, 2), STOCK);
        assert_eq!(arrival(d, target, 0), amount(if village {
            222500000000
        } else {
            235000000000
        }));
        if village {
            assert_eq!(arrival(d, realm, 0), amount(12500000000));
        } else {
            assert!(arrival(d, realm, 0).is_empty());
        }
    }
}

#[test]
fn withdrawal_charges_connected_realm_fee_once_and_keeps_donkeys_and_travel() {
    for village in array![false, true] {
        let (d, realm, target, token) = setup(village, false);
        assert!(execute_recorded_at(d, withdraw(target, d.actor), 40, 1000));
        assert_eq!(balance(d, target, 2), 0);
        assert_eq!(
            tokens(token, d.actor), TOKENS + if village {
                222500000000000000000
            } else {
                235000000000000000000
            },
        );
        assert_eq!(balance(d, target, 25), (if village {
            9
        } else {
            10
        }) * RESOURCE_PRECISION);
        if village {
            assert_eq!(arrival(d, realm, 10), amount(12500000000));
        } else {
            assert!(arrival(d, realm, 10).is_empty());
        }
    }
}

#[test]
fn connected_realms_current_owner_receives_both_fees_after_ownership_changes() {
    for withdrawal in array![false, true] {
        let (d, realm, target, _) = setup(true, false);
        let new_owner = 0x987.try_into().unwrap();
        let structure = IStructuresDispatcher { contract_address: d.peers.structures }.structure(realm).unwrap();
        set_fixture(
            d.peers.structures,
            selector!("structures"),
            array![3, realm.entity_id.into()].span(),
            StructureRecord {
                owner: new_owner,
                base: structure.base,
                resources_packed: structure.resources_packed,
                metadata: structure.metadata,
            },
        );
        let mut spy = snforge_std::spy_events();
        assert!(execute(d, if withdrawal {
            withdraw(target, d.actor)
        } else {
            deposit(target)
        }, 40));
        assert_eq!(arrival(d, realm, if withdrawal {
            10
        } else {
            0
        }), amount(12500000000));
        let mut fee_recorded = false;
        for (_, event) in spy.get_events().emitted_by(d.peers.bridge).events.span() {
            if *event.keys.at(1) == selector!("StoryEvent") {
                let mut keys = event.keys.span().slice(2, event.keys.len() - 2);
                let mut data = event.data.span();
                let story: crate::ownership::StoryEvent = starknet::Event::deserialize(ref keys, ref data).unwrap();
                if story.entity_id == Some(realm.entity_id) {
                    assert_eq!(story.owner, Some(new_owner));
                    fee_recorded = true;
                }
            }
        }
        assert!(fee_recorded);
    }
}

#[test]
fn rejected_bridge_actions_preserve_tokens_resources_and_arrivals() {
    for village in array![false, true] {
        let (d, realm, target, token) = setup(village, true);
        assert_terminal_rejection(d, deposit(target), 40);
        assert_terminal_rejection(d, withdraw(target, d.actor), 40);
        assert_eq!(tokens(token, d.actor), TOKENS);
        assert_eq!(balance(d, target, 2), STOCK);
        assert!(arrival(d, target, 0).is_empty());
        assert!(arrival(d, realm, 0).is_empty());
    }
    let (d, realm, target, token) = setup(true, false);
    ITokenFixtureDispatcher { contract_address: token }.set_failure(true);
    assert_terminal_rejection(d, deposit(target), 40);
    assert_terminal_rejection(d, withdraw(target, d.actor), 40);
    assert_eq!(tokens(token, d.actor), TOKENS);
    assert_eq!(balance(d, target, 2), STOCK);
    assert_eq!(balance(d, target, 25), 10 * RESOURCE_PRECISION);
    assert!(arrival(d, realm, 10).is_empty());
}

#[test]
#[feature("safe_dispatcher")]
fn bridge_rejects_forged_domain_callers_and_mutating_immutable_rules() {
    let (d, _, target, _) = setup(false, false);
    let bridge = IBridgeSafeDispatcher { contract_address: d.peers.bridge };
    start_cheat_caller_address(d.peers.bridge, d.actor);
    assert!(bridge.configure_deposits(2, deposit_rules(false)).is_err());
    assert!(
        bridge
            .deposit_resource(
                3,
                d.actor,
                Deposit {
                    structure_id: target.entity_id, resource_type: 2, amount: TOKENS, client_fee_recipient: d.actor,
                },
                super::context(),
            )
            .is_err(),
    );
    assert!(
        IBankWithdrawalSafeDispatcher { contract_address: d.peers.bridge }
            .withdraw_bank_resources(3, d.actor, target.entity_id, 2, STOCK, 40)
            .is_err(),
    );
    start_cheat_caller_address(d.peers.bridge, super::authority());
    assert!(bridge.configure_deposits(3, deposit_rules(false)).is_err());
    bridge.configure_deposits(2, deposit_rules(true)).unwrap();
    assert!(bridge.deposit_rules(2).unwrap().paused);
    assert!(!bridge.deposit_rules(3).unwrap().paused);
}

#[test]
fn missing_donkeys_reverts_the_withdrawal_burn_and_fee_arrival() {
    let (d, realm, target, token) = setup(true, false);
    assert!(
        execute(
            d,
            Command::BurnStructureResources(
                crate::resources::ResourceBurn {
                    entity_id: target.entity_id,
                    resources: array![ResourceAmount { resource_type: 25, amount: 10 * RESOURCE_PRECISION }].span(),
                },
            ),
            39,
        ),
    );
    assert_terminal_rejection(d, withdraw(target, d.actor), 40);
    assert_eq!(balance(d, target, 2), STOCK);
    assert_eq!(tokens(token, d.actor), TOKENS);
    assert!(arrival(d, realm, 10).is_empty());
}

#[test]
fn bridge_rejects_wrong_owner_category_unlisted_resource_and_closed_game() {
    let (d, _, target, token) = setup(false, false);
    for time in array![19_u64] {
        assert_terminal_rejection(d, deposit(target), time);
        assert_terminal_rejection(d, withdraw(target, d.actor), time);
    }
    assert_terminal_rejection(
        d,
        Command::DepositResource(
            Deposit { structure_id: target.entity_id, resource_type: 3, amount: TOKENS, client_fee_recipient: d.actor },
        ),
        40,
    );
    assert_terminal_rejection(
        d,
        Command::WithdrawResource(
            Withdraw {
                structure_id: target.entity_id,
                recipient: d.actor,
                resource_type: 3,
                amount: STOCK,
                client_fee_recipient: d.actor,
            },
        ),
        40,
    );
    let structure = IStructuresDispatcher { contract_address: d.peers.structures }.structure(target).unwrap();
    for (owner, category) in array![(0x987.try_into().unwrap(), 1_u8), (d.actor, 3_u8)] {
        set_fixture(
            d.peers.structures,
            selector!("structures"),
            array![3, target.entity_id.into()].span(),
            StructureRecord {
                owner,
                base: crate::structures::StructureBase { category, ..structure.base },
                resources_packed: structure.resources_packed,
                metadata: structure.metadata,
            },
        );
        assert_terminal_rejection(d, deposit(target), 40);
        assert_terminal_rejection(d, withdraw(target, d.actor), 40);
    }
    set_fixture(
        d.peers.structures,
        selector!("structures"),
        array![3, target.entity_id.into()].span(),
        StructureRecord {
            owner: structure.owner,
            base: structure.base,
            metadata: structure.metadata,
            resources_packed: structure.resources_packed,
        },
    );
    assert_terminal_rejection(d, deposit(target), 211);
    assert_terminal_rejection(d, withdraw(target, d.actor), 211);
    assert_eq!(tokens(token, d.actor), TOKENS);
    assert_eq!(balance(d, target, 2), STOCK);
    assert!(arrival(d, target, 0).is_empty());
}

#[test]
fn bridge_rejects_troop_deposits_to_villages_and_small_platform_fees() {
    let (d, _, target, token) = setup(true, false);
    set_fixture(d.peers.bridge, selector!("tokens"), array![3, 26].span(), token);
    assert_terminal_rejection(
        d,
        Command::DepositResource(
            Deposit {
                structure_id: target.entity_id, resource_type: 26, amount: TOKENS, client_fee_recipient: d.actor,
            },
        ),
        40,
    );
    assert_terminal_rejection(
        d,
        Command::DepositResource(
            Deposit { structure_id: target.entity_id, resource_type: 2, amount: 1, client_fee_recipient: d.actor },
        ),
        40,
    );
    assert_eq!(tokens(token, d.actor), TOKENS);
    assert!(arrival(d, target, 0).is_empty());
}
