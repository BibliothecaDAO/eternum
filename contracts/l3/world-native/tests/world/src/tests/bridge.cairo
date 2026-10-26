pub use world_test_support::tests::bridge::*;


#[test]
fn deposit_applies_retention_platform_fees_and_connected_realm_fee() {
    for village in array![false, true] {
        let (d, realm, target, token) = setup(village, false);
        assert!(execute(d, deposit(target), 40));
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
        assert!(execute(d, withdraw(target, d.actor), 40));
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
        let structure = IStructureOperationsDispatcher { contract_address: d.games }.structure(realm).unwrap();
        set_fixture(
            d.games,
            selector!("structures"),
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
        for (_, event) in spy.get_events().emitted_by(d.games).events.span() {
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
fn bridge_configuration_requires_authority_and_is_immutable() {
    let (d, _, _, _) = setup(false, false);
    let bridge = IBridgeSafeDispatcher { contract_address: d.games };
    let (mut withdrawals, _, _) = super::market::wallet_preset(d, true);
    withdrawals.deposits = deposit_rules(true);
    let mut preset = super::resource_commands::fixture_preset(super::play_fixture::rules());
    preset.economy.withdrawals = Some(withdrawals);
    let registrar = crate::registrar::IRegistrarSafeDispatcher { contract_address: d.games };
    start_cheat_caller_address(d.games, d.actor);
    assert!(registrar.register_preset(20000, preset).is_err());
    start_cheat_caller_address(d.games, super::authority());
    let games = crate::game::IGameDispatcher { contract_address: d.games };
    assert!(registrar.register_preset(games.game(3).preset_id, preset).is_err());
    stop_cheat_caller_address(d.games);
    super::play_fixture::seed_game_with_preset(d.games, 4, games.game(3), preset);
    assert!(bridge.deposit_rules(4).unwrap().paused);
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
    let structure = IStructureOperationsDispatcher { contract_address: d.games }.structure(target).unwrap();
    for (owner, category) in array![(0x987.try_into().unwrap(), 1_u8), (d.actor, 3_u8)] {
        set_fixture(
            d.games,
            selector!("structures"),
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
        d.games,
        selector!("structures"),
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
    set_fixture(d.games, selector!("withdrawals"), selector!("tokens"), array![3, 26].span(), token);
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

#[test]
fn audit_regression_zero_platform_rates_allow_deposits_and_withdrawals() {
    for (velords, season, client) in array![(0_u16, 200_u16, 300_u16), (100, 0, 300), (100, 200, 0), (0, 0, 0)] {
        let net: u128 = 250000000000 * (10000_u128 - velords.into() - season.into() - client.into()) / 10000;
        for withdrawal in array![false, true] {
            let (d, _, target, token) = setup_with_platform_fees(false, false, velords, season, client);
            if withdrawal {
                assert!(execute(d, withdraw(target, d.actor), 40));
                assert_eq!(tokens(token, d.actor), TOKENS + net.into() * 1000000000);
                assert_eq!(balance(d, target, 2), 0);
            } else {
                assert!(execute(d, deposit(target), 40));
                assert_eq!(arrival(d, target, 0), amount(net));
                assert_eq!(tokens(token, d.actor), 0);
            }
        }
    }
}
