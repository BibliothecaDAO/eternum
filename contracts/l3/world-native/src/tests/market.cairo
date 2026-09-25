use snforge_std::{
    EventSpyTrait, EventsFilterTrait, spy_events, start_cheat_block_timestamp_global, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use crate::commands::{Command, ExecutionContext};
use crate::game::IGameDispatcherTrait;
use crate::market::{
    AddLiquidity, BankPlacement, BankRules, IBankDispatcher, IBankDispatcherTrait, IBankSafeDispatcher,
    IBankSafeDispatcherTrait, LiquidityKey, Market, MarketKey, RemoveLiquidity, Swap,
};
use crate::registrar::IRegistrarSafeDispatcherTrait;
use crate::resources::{IResourceOperationsDispatcher, ResourceAmount, ResourceKey, ResourceSlot};
use crate::rules::RESOURCE_PRECISION;
use crate::tests::state::ResourceObservationTrait;
use crate::troops::Coord;
use super::resource_commands::{assert_terminal_rejection, execute, execute_recorded_at, grant};

const BANK: u32 = 0xfffffffe;
const STOCK: u128 = 100000 * RESOURCE_PRECISION;
fn banks() -> Span<BankPlacement> {
    let mut banks = array![];
    for index in 0_u32..6 {
        banks.append(BankPlacement { name: 'Bank', coord: Coord { alt: false, x: 2000100 + 10 * index, y: 2000000 } });
    }
    banks.span()
}
fn market_preset() -> crate::presets::PresetDefinition {
    let mut rules = super::recorded::rules();
    rules.mode_rules = super::recorded::ETERNUM_RULES;
    rules.command_mask = super::recorded::ETERNUM_COMMAND_MASK;
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
fn setup() -> (super::Deployment, ResourceKey, ResourceKey) {
    let deployment = super::setup_with_domains(true, "StructuresLogic", "TroopsLogic");
    setup_market(deployment, market_preset())
}
fn setup_with_wallet(
    paused: bool,
) -> (super::Deployment, ResourceKey, ResourceKey, starknet::ContractAddress, starknet::ContractAddress) {
    let deployment = super::setup_with_domains(true, "StructuresLogic", "TroopsLogic");
    let (withdrawals, resource, lords) = wallet_preset(deployment, paused);
    let mut preset = market_preset();
    preset.economy.withdrawals = Some(withdrawals);
    let (deployment, source, other) = setup_market(deployment, preset);
    (deployment, source, other, resource, lords)
}
fn setup_market(
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
            crate::tests::story_cursor(),
        );
    stop_cheat_caller_address(deployment.games);
    for key in array![source, other] {
        for resource in array![2, 26, 37, 25] {
            grant(deployment, key, resource, STOCK);
        }
    }
    (deployment, source, other)
}
fn add(source: ResourceKey, lords_amount: u128, resource_amount: u128) -> Command {
    Command::AddBankLiquidity(
        AddLiquidity { bank_id: BANK, structure_id: source.entity_id, resource_type: 2, lords_amount, resource_amount },
    )
}
fn remove(destination: u32, shares: u128) -> Command {
    Command::RemoveBankLiquidity(RemoveLiquidity { bank_id: BANK, structure_id: destination, resource_type: 2, shares })
}
fn view(deployment: super::Deployment) -> IBankDispatcher {
    IBankDispatcher { contract_address: deployment.games }
}
fn balance(deployment: super::Deployment, entity: u32, resource_type: u8) -> u128 {
    IResourceOperationsDispatcher { contract_address: deployment.games }
        .resource_balance(ResourceSlot { game_id: 3, entity_id: entity, resource_type })
}
fn arrival(deployment: super::Deployment, entity: u32, time: u64, travel: u64) -> Span<ResourceAmount> {
    IResourceOperationsDispatcher { contract_address: deployment.games }
        .resource_arrival(crate::arrivals::arrival_key(3, entity, 1, time, travel))
        .resources
}
fn lp(deployment: super::Deployment) -> u128 {
    view(deployment).liquidity(LiquidityKey { game_id: 3, owner: deployment.actor, resource_type: 2 })
}
fn market(deployment: super::Deployment) -> Market {
    view(deployment).market(MarketKey { game_id: 3, resource_type: 2 })
}

#[test]
fn regional_banks_have_pinned_ids_guards_names_and_biome_only_surroundings() {
    let (deployment, _, _) = setup();
    let structures = crate::structures::IStructureOperationsDispatcher { contract_address: deployment.games };
    let guards = crate::guards::IGuardsDispatcher { contract_address: deployment.games };
    let tiles = crate::map::IMapLogicDispatcher { contract_address: deployment.games };
    for index in 0_u32..6 {
        let id = BANK - index;
        let key = ResourceKey { game_id: 3, entity_id: id };
        let structure = crate::tests::state::StructureObservationTrait::structure(structures, key).unwrap();
        assert_eq!(structure.owner, super::authority());
        assert_eq!(structure.base.category, 3);
        assert_eq!(structure.base.level, 3);
        assert_eq!(view(deployment).bank_name(key), 'Bank');
        let coord = crate::tests::state::StructureObservationTrait::position(structures, key).unwrap();
        for direction in 0_u8..6 {
            let neighbor = crate::geometry::neighbor(coord, direction);
            let tile = crate::tests::state::MapObservationTrait::tile(tiles, crate::geometry::tile_key(3, neighbor))
                .unwrap();
            assert_eq!(tile.data % 0x20000000000, 0);
        }
        for slot in 0_u8..3 {
            let guard = crate::guards::IGuardsDispatcherTrait::guard(
                guards, crate::guards::GuardKey { game_id: 3, structure_id: id, slot },
            );
            assert!(guard.troops.count > 0);
            assert_eq!(guard.troops.tier, crate::troops::TroopTier::T2);
        }
        assert_eq!(
            crate::guards::IGuardsDispatcherTrait::guard(
                guards, crate::guards::GuardKey { game_id: 3, structure_id: id, slot: 3 },
            ),
            Default::default(),
        );
    }
    assert_eq!(
        crate::game::IPointsDispatcherTrait::player_points(
            crate::game::IPointsDispatcher { contract_address: deployment.games }, 3, super::authority(),
        ),
        0,
    );
}

#[test]
fn liquidity_uses_the_reserve_ratio_and_player_shares_across_structures() {
    let (deployment, source, other) = setup();
    assert!(execute(deployment, add(source, 1000 * RESOURCE_PRECISION, 2000 * RESOURCE_PRECISION), 40));
    assert_eq!(
        market(deployment),
        Market {
            lords: 1000 * RESOURCE_PRECISION, resource: 2000 * RESOURCE_PRECISION, shares: 1000 * RESOURCE_PRECISION,
        },
    );
    assert!(execute(deployment, add(other, 500 * RESOURCE_PRECISION, 2000 * RESOURCE_PRECISION), 41));
    assert_eq!(lp(deployment), 1500 * RESOURCE_PRECISION);
    assert_eq!(balance(deployment, other.entity_id, 2), STOCK - 1000 * RESOURCE_PRECISION);
    assert!(execute(deployment, add(other, 1000 * RESOURCE_PRECISION, 200 * RESOURCE_PRECISION), 42));
    assert_eq!(lp(deployment), 1600 * RESOURCE_PRECISION);
    assert_eq!(market(deployment).resource, 3200 * RESOURCE_PRECISION);
    assert!(execute(deployment, remove(source.entity_id, 1600 * RESOURCE_PRECISION), 200));
    assert_eq!(lp(deployment), 0);
    assert_eq!(market(deployment), Default::default());
    assert_eq!(
        arrival(deployment, source.entity_id, 200, 200),
        array![
            ResourceAmount { resource_type: 37, amount: 1600 * RESOURCE_PRECISION },
            ResourceAmount { resource_type: 2, amount: 3200 * RESOURCE_PRECISION },
        ]
            .span(),
    );
}

#[test]
fn swaps_charge_pinned_lp_and_owner_fees_and_deliver_after_round_trip() {
    let (deployment, source, other) = setup();
    assert!(execute(deployment, add(source, 10000 * RESOURCE_PRECISION, 20000 * RESOURCE_PRECISION), 40));
    let amount = 100 * RESOURCE_PRECISION;
    let cost = crate::market::output_price(10000 * RESOURCE_PRECISION, 20000 * RESOURCE_PRECISION, amount, 3, 1000);
    let fee = cost / 100;
    let buy = Swap { bank_id: BANK, structure_id: other.entity_id, resource_type: 2, amount };
    assert!(execute(deployment, Command::BuyFromBank(buy), 50));
    assert_eq!(balance(deployment, other.entity_id, 37), STOCK - cost - fee);
    assert_eq!(balance(deployment, BANK, 37), fee);
    assert_eq!(market(deployment).lords, 10000 * RESOURCE_PRECISION + cost);
    assert_eq!(
        arrival(deployment, other.entity_id, 50, 180), array![ResourceAmount { resource_type: 2, amount }].span(),
    );
    let before = market(deployment);
    let gross = crate::market::input_price(before.resource, before.lords, amount, 3, 1000);
    let fee2 = gross / 100;
    assert!(execute(deployment, Command::SellToBank(buy), 51));
    assert_eq!(balance(deployment, other.entity_id, 2), STOCK - amount);
    assert_eq!(balance(deployment, BANK, 37), fee + fee2);
    assert_eq!(
        arrival(deployment, other.entity_id, 51, 180),
        array![ResourceAmount { resource_type: 37, amount: gross - fee2 }].span(),
    );
    assert_eq!(lp(deployment), 10000 * RESOURCE_PRECISION);
}

#[test]
fn rejected_market_actions_preserve_reserves_shares_and_balances() {
    let (deployment, source, other) = setup();
    assert!(execute(deployment, add(source, 1000 * RESOURCE_PRECISION, 2000 * RESOURCE_PRECISION), 40));
    let before = market(deployment);
    let buy = Swap { bank_id: BANK, structure_id: other.entity_id, resource_type: 2, amount: before.resource };
    for command in array![
        Command::BuyFromBank(buy), Command::SellToBank(Swap { amount: STOCK + 1, ..buy }),
        Command::BuyFromBank(Swap { bank_id: source.entity_id, amount: 1, ..buy }),
        Command::BuyFromBank(Swap { structure_id: BANK, amount: 1, ..buy }),
        remove(source.entity_id, before.shares + 1), add(source, 0, 1), add(source, 1, 0),
    ] {
        assert_terminal_rejection(deployment, command, 50);
        assert_eq!(market(deployment), before);
        assert_eq!(lp(deployment), before.shares);
        assert_eq!(balance(deployment, other.entity_id, 2), STOCK);
        assert_eq!(balance(deployment, other.entity_id, 37), STOCK);
    }
    assert_terminal_rejection(deployment, add(other, 1, 1), 200);
    assert_terminal_rejection(deployment, remove(source.entity_id, 1), 211);
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

fn token_balance(token: starknet::ContractAddress, owner: starknet::ContractAddress) -> u256 {
    crate::withdrawals::IResourceTokenDispatcherTrait::balance_of(
        crate::withdrawals::IResourceTokenDispatcher { contract_address: token }, owner,
    )
}
#[test]
fn wallet_liquidity_withdrawal_preserves_retention_fees_and_mints_when_unfunded() {
    assert_wallet_liquidity_withdrawal(false);
}
#[test]
fn wallet_liquidity_withdrawal_preserves_retention_fees_and_transfers_when_funded() {
    assert_wallet_liquidity_withdrawal(true);
}
fn assert_wallet_liquidity_withdrawal(funded: bool) {
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
    assert!(execute_recorded_at(deployment, remove(0, 1000 * RESOURCE_PRECISION), 50, 1000));
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
#[test]
fn wallet_token_failure_rolls_back_prior_token_payments_fees_and_shares() {
    let (deployment, source, _, resource, lords) = setup_with_wallet(false);
    assert!(execute(deployment, add(source, 1000 * RESOURCE_PRECISION, 1000 * RESOURCE_PRECISION), 40));
    super::fixtures::ITokenFixtureDispatcherTrait::set_failure(
        super::fixtures::ITokenFixtureDispatcher { contract_address: lords }, true,
    );
    assert_terminal_rejection(deployment, remove(0, 1000 * RESOURCE_PRECISION), 50);
    assert_eq!(lp(deployment), 1000 * RESOURCE_PRECISION);
    assert_eq!(market(deployment).lords, 1000 * RESOURCE_PRECISION);
    assert_eq!(token_balance(resource, deployment.actor), 0);
    assert_eq!(token_balance(resource, 0x777.try_into().unwrap()), 0);
    assert!(arrival(deployment, BANK, 50, 0).is_empty());
}
#[test]
fn paused_wallet_withdrawal_preserves_the_liquidity_position() {
    let (deployment, source, _, _, _) = setup_with_wallet(true);
    assert!(execute(deployment, add(source, 1000 * RESOURCE_PRECISION, 1000 * RESOURCE_PRECISION), 40));
    assert_terminal_rejection(deployment, remove(0, 1000 * RESOURCE_PRECISION), 50);
    assert_eq!(lp(deployment), 1000 * RESOURCE_PRECISION);
    assert!(execute(deployment, remove(source.entity_id, 1000 * RESOURCE_PRECISION), 50));
}
#[test]
#[feature("safe_dispatcher")]
fn bank_creation_and_configuration_reject_players_repeats_and_partial_batches() {
    let (deployment, _, _) = setup();
    let safe = IBankSafeDispatcher { contract_address: deployment.games };
    start_cheat_caller_address(deployment.games, deployment.actor);
    let context = ExecutionContext { timestamp: 30, ..super::context(deployment.games, 3) };
    assert!(
        safe
            .create_banks(
                3, super::authority(), banks(), crate::commands::action_context(context), crate::tests::story_cursor(),
            )
            .is_err(),
    );
    let registrar = crate::registrar::IRegistrarSafeDispatcher { contract_address: deployment.games };
    let mut preset = market_preset();
    preset.economy.banks = BankRules { lp_fee_num: 0, lp_fee_denom: 1, owner_fee_num: 0, owner_fee_denom: 1 };
    assert!(registrar.register_preset(20000, preset).is_err());
    start_cheat_caller_address(deployment.games, deployment.games);
    assert!(
        safe
            .create_banks(
                3, deployment.actor, banks(), crate::commands::action_context(context), crate::tests::story_cursor(),
            )
            .is_err(),
    );
    assert!(
        safe
            .create_banks(
                3,
                super::authority(),
                banks().slice(0, 5),
                crate::commands::action_context(context),
                crate::tests::story_cursor(),
            )
            .is_err(),
    );
    assert!(
        safe
            .create_banks(
                3, super::authority(), banks(), crate::commands::action_context(context), crate::tests::story_cursor(),
            )
            .is_err(),
    );
    start_cheat_caller_address(deployment.games, super::authority());
    let games = crate::game::IGameDispatcher { contract_address: deployment.games };
    assert!(registrar.register_preset(games.game(3).preset_id, preset).is_err());
    let mut invalid = preset;
    invalid.economy.banks.lp_fee_num = 1;
    assert!(registrar.register_preset(20000, invalid).is_err());
    assert!(registrar.register_preset(20000, preset).is_ok());
    stop_cheat_caller_address(deployment.games);
    super::recorded::seed_game_with_preset(deployment.games, 4, games.game(3), preset);
    assert_eq!(safe.bank_rules(4).unwrap().lp_fee_num, 0);
    assert_eq!(safe.bank_rules(3).unwrap().lp_fee_num, 3);
}

#[test]
fn villages_can_trade_regular_liquidity_but_cannot_add_or_remove_troop_liquidity() {
    let (deployment, source, village) = setup();
    let structures = crate::structures::IStructureOperationsDispatcher { contract_address: deployment.games };
    let record = crate::tests::state::StructureObservationTrait::structure(structures, village).unwrap();
    super::resource_commands::set_fixture(
        deployment.games,
        selector!("structures"),
        selector!("structures"),
        array![3, village.entity_id.into()].span(),
        crate::structures::StructureRecord {
            owner: record.owner,
            base: crate::structures::StructureBase { category: 5, ..record.base },
            resources_packed: record.resources_packed,
            metadata: record.metadata,
        },
    );
    let troop_deposit = AddLiquidity {
        bank_id: BANK,
        structure_id: village.entity_id,
        resource_type: 26,
        resource_amount: 1000 * RESOURCE_PRECISION,
        lords_amount: 1000 * RESOURCE_PRECISION,
    };
    assert_terminal_rejection(deployment, Command::AddBankLiquidity(troop_deposit), 40);
    assert!(
        execute(
            deployment, Command::AddBankLiquidity(AddLiquidity { structure_id: source.entity_id, ..troop_deposit }), 40,
        ),
    );
    assert_terminal_rejection(
        deployment,
        Command::RemoveBankLiquidity(
            RemoveLiquidity {
                bank_id: BANK, structure_id: village.entity_id, resource_type: 26, shares: 1000 * RESOURCE_PRECISION,
            },
        ),
        41,
    );
    assert!(execute(deployment, add(village, 1000 * RESOURCE_PRECISION, 1000 * RESOURCE_PRECISION), 41));
    assert!(execute(deployment, remove(village.entity_id, 1000 * RESOURCE_PRECISION), 42));
    assert_eq!(lp(deployment), 0);
    assert_eq!(
        view(deployment).liquidity(LiquidityKey { game_id: 3, owner: deployment.actor, resource_type: 26 }),
        1000 * RESOURCE_PRECISION,
    );
}

#[test]
#[feature("safe_dispatcher")]
fn bank_trade_and_withdrawal_configuration_are_independent_and_immutable() {
    let (deployment, source, _, _, _) = setup_with_wallet(false);
    let trade = crate::trade::ITradeDispatcher { contract_address: deployment.games };
    assert_eq!(crate::trade::ITradeDispatcherTrait::trade_rules(trade, 3).max_count, 7);
    assert_eq!(view(deployment).bank_rules(3).lp_fee_num, 3);
    let withdrawals = crate::withdrawals::IWithdrawalsSafeDispatcher { contract_address: deployment.games };
    let rules = crate::withdrawals::IWithdrawalsSafeDispatcherTrait::withdrawal_rules(withdrawals, 3).unwrap();
    assert_eq!(rules.bank_fee_bps, 500);
    start_cheat_caller_address(deployment.games, super::authority());
    let games = crate::game::IGameDispatcher { contract_address: deployment.games };
    assert!(
        crate::registrar::IRegistrarSafeDispatcher { contract_address: deployment.games }
            .register_preset(games.game(3).preset_id, market_preset())
            .is_err(),
    );
    assert!(
        crate::withdrawals::IWithdrawalsSafeDispatcherTrait::resource_token(
            withdrawals, MarketKey { game_id: 3, resource_type: 26 },
        )
            .is_err(),
    );
    assert!(crate::withdrawals::IWithdrawalsSafeDispatcherTrait::withdrawal_rules(withdrawals, 2).is_err());
    stop_cheat_caller_address(deployment.games);
    assert!(execute(deployment, add(source, 1000 * RESOURCE_PRECISION, 1000 * RESOURCE_PRECISION), 40));
    assert!(
        execute_recorded_at(
            deployment,
            Command::BuyFromBank(
                Swap {
                    bank_id: BANK, structure_id: source.entity_id, resource_type: 2, amount: 10 * RESOURCE_PRECISION,
                },
            ),
            50,
            1000,
        ),
    );
}

#[test]
fn market_price_and_share_vectors_preserve_integer_rounding() {
    assert_eq!(crate::market::output_price(1000, 1000, 500, 0, 1), 1001);
    assert_eq!(crate::market::output_price(1000, 1000, 500, 3, 1000), 1004);
    assert_eq!(crate::market::output_price(1000, 1000, 0, 0, 1), 1);
    assert_eq!(crate::market::input_price(1000, 1000, 1000, 0, 1), 500);
    assert_eq!(crate::market::input_price(1000, 1000, 1000, 3, 1000), 499);
    let market = Market { lords: 1000, resource: 2000, shares: 1000 };
    assert_eq!(crate::market::liquidity_cost(market, 500, 5000), (500, 1000, 500));
    assert_eq!(crate::market::liquidity_cost(market, 500, 100), (50, 100, 50));
    assert_eq!(crate::market::liquidity_payout(market, 333), (333, 666));
}

#[test]
#[should_panic(expected: "liquidity mints zero shares")]
fn liquidity_rejects_a_deposit_that_rounds_to_zero_shares() {
    crate::market::liquidity_cost(Market { lords: 1000, resource: 1000, shares: 1 }, 1, 1);
}

#[test]
fn liquidity_changes_have_distinct_recorded_story_keys() {
    let (d, source, _) = setup();
    let mut spy = spy_events();
    assert!(execute(d, add(source, 1000 * RESOURCE_PRECISION, 1000 * RESOURCE_PRECISION), 40));
    assert!(execute(d, add(source, 1000 * RESOURCE_PRECISION, 1000 * RESOURCE_PRECISION), 41));
    let mut ids = array![];
    for (_, event) in spy.get_events().emitted_by(d.games).events.span() {
        if *event.keys.at(0) == selector!("StoryEvent") {
            let mut keys = event.keys.span().slice(1, event.keys.len() - 1);
            let mut data = event.data.span();
            let story: crate::ownership::StoryEvent = starknet::Event::deserialize(ref keys, ref data).unwrap();
            assert_eq!(story.entity_id, Some(source.entity_id));
            ids.append(crate::ownership::StoryCursor { order: story.order, index: story.index });
        }
    }
    assert_eq!(ids.len(), 2);
    assert_ne!(*ids.at(0), *ids.at(1));
}


#[test]
#[feature("safe_dispatcher")]
fn the_game_creator_owns_bank_choices_and_preplay_liquidity_without_shard_authority() {
    let (d, source, authority_source) = super::resource_commands::setup_with_preset(market_preset());
    let games = crate::game::IGameDispatcher { contract_address: d.games };
    let game = crate::game::IGameDispatcherTrait::game(games, 3);
    let creator_game = crate::game::GameRegistry { creator: d.actor, start_main_at: 100, ..game };
    super::resource_commands::set_fixture(
        d.games, selector!("games"), selector!("games"), array![3].span(), creator_game,
    );
    assert!(d.actor != super::authority());
    let authority = super::bind_authority(d);
    assert!(!execute(authority, Command::CreateBanks(banks()), 40));
    assert!(execute(d, Command::CreateBanks(banks()), 40));
    let structure = crate::tests::state::StructureObservationTrait::structure(
        crate::structures::IStructureOperationsDispatcher { contract_address: d.games },
        ResourceKey { game_id: 3, entity_id: BANK },
    )
        .unwrap();
    assert_eq!(structure.owner, d.actor);
    grant(d, source, 2, STOCK);
    grant(d, source, crate::resources::LORDS, STOCK);
    snforge_std::interact_with_state(
        d.games, || {
            crate::logic::structures::StructureState::transfer_owner(authority_source, super::authority());
        },
    );
    grant(d, authority_source, 2, STOCK);
    grant(d, authority_source, crate::resources::LORDS, STOCK);
    assert!(!execute(authority, add(authority_source, 1000 * RESOURCE_PRECISION, 1000 * RESOURCE_PRECISION), 40));
    assert!(execute(d, add(source, 1000 * RESOURCE_PRECISION, 1000 * RESOURCE_PRECISION), 40));
    assert_eq!(lp(d), 1000 * RESOURCE_PRECISION);
    // The creator privilege is separate from the normal live-game liquidity permission.
    super::resource_commands::set_fixture(
        d.games,
        selector!("games"),
        selector!("games"),
        array![3].span(),
        crate::game::GameRegistry { creator: super::authority(), ..creator_game },
    );
    assert!(!execute(d, add(source, 1000 * RESOURCE_PRECISION, 1000 * RESOURCE_PRECISION), 50));
    assert!(execute(d, add(source, 1000 * RESOURCE_PRECISION, 1000 * RESOURCE_PRECISION), 100));
    assert_eq!(lp(d), 2000 * RESOURCE_PRECISION);
}
