use collectibles::contract::{
    IRealmsCollectibleMetadataDispatcher, IRealmsCollectibleMetadataDispatcherTrait, MINTER_ROLE,
};
use core::num::traits::Zero;
use game_ledger::contract::{
    IGameLedgerDispatcher, IGameLedgerDispatcherTrait, IGameLedgerSafeDispatcher, IGameLedgerSafeDispatcherTrait,
    IMMRTokenDispatcher, IMMRTokenDispatcherTrait, result_commitment,
};
use game_ledger::test_lords::{ITestLordsDispatcher, ITestLordsDispatcherTrait};
use game_ledger::types::{ChestBandPreset, ChestOdds, GameKey, MmrParams, Preset, RankedPlayer, SlotKey};
use openzeppelin::access::accesscontrol::interface::{IAccessControlDispatcher, IAccessControlDispatcherTrait};
use openzeppelin::security::interface::{IPausableDispatcher, IPausableDispatcherTrait};
use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
use openzeppelin::token::erc721::interface::{IERC721Dispatcher, IERC721DispatcherTrait};
use openzeppelin::upgrades::interface::{IUpgradeableDispatcher, IUpgradeableDispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, EventSpyTrait, declare, get_class_hash, spy_events, start_cheat_block_hash,
    start_cheat_block_number, start_cheat_block_timestamp, start_cheat_caller_address, stop_cheat_block_number,
    stop_cheat_block_timestamp, stop_cheat_caller_address,
};
use starknet::ContractAddress;

#[starknet::contract]
mod TestMMR {
    use core::num::traits::Zero;
    use game_ledger::contract::IMMRToken;
    use starknet::ContractAddress;
    use starknet::storage::{Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess};

    const INITIAL_MMR: u256 = 1_000_000_000_000_000_000_000;

    #[storage]
    struct Storage {
        ratings: Map<ContractAddress, u256>,
    }

    #[abi(embed_v0)]
    impl TestMMRImpl of IMMRToken<ContractState> {
        fn get_player_mmr(self: @ContractState, player: ContractAddress) -> u256 {
            let rating = self.ratings.entry(player).read();
            if rating.is_zero() {
                INITIAL_MMR
            } else {
                rating
            }
        }

        fn update_mmr_batch(ref self: ContractState, updates: Array<(ContractAddress, u256)>) {
            for (player, rating) in updates {
                self.ratings.entry(player).write(rating);
            }
        }
    }
}

const GAME_KEY: GameKey = GameKey { shard: 'shard', game_id: 7 };
const SLOT_KEY: SlotKey = SlotKey { shard: 'shard', slot_id: 42 };
const PRESET_ID: u32 = 3;
const START: u64 = 100;
const END: u64 = 200;
const SEASON_END: u64 = END + 1000;

fn ADMIN() -> ContractAddress {
    'admin'.try_into().unwrap()
}

fn OPERATOR() -> ContractAddress {
    'operator'.try_into().unwrap()
}

fn TREASURY() -> ContractAddress {
    'treasury'.try_into().unwrap()
}

fn player(index: u16) -> ContractAddress {
    (1_000 + index.into()).try_into().unwrap()
}

fn default_preset() -> Preset {
    Preset {
        day_unit_seconds: 1,
        claim_window_seconds: 7 * 24 * 60 * 60,
        frontier_top_n: 10,
        frontier_chest_bps: 10000,
        entry_fee: 500,
        protocol_cut_bps: 0,
        chest_lords_bps: 0,
        paid_fraction_bps: 2_000,
        decay_bps: 9_600,
        sword_price: 500,
        shield_price: 500,
        mmr: MmrParams { enabled: true, mean: 1500, spread: 450, max_delta: 45, k: 50, regression_bps: 150 },
    }
}

#[derive(Copy, Drop)]
struct Fixture {
    ledger_address: ContractAddress,
    ledger: IGameLedgerDispatcher,
    lords_address: ContractAddress,
    mmr: IMMRTokenDispatcher,
    chest_address: ContractAddress,
    cosmetics_address: ContractAddress,
    lords: IERC20Dispatcher,
    lords_minter: ITestLordsDispatcher,
}

fn deploy_ledger() -> Fixture {
    let lords_class = declare("TestLords").unwrap().contract_class();
    let (lords_address, _) = lords_class.deploy(@array![]).unwrap();
    let mmr_class = declare("TestMMR").unwrap().contract_class();
    let (mmr_address, _) = mmr_class.deploy(@array![]).unwrap();
    let ledger_class = declare("GameLedger").unwrap().contract_class();
    let mut constructor = array![];
    ADMIN().serialize(ref constructor);
    OPERATOR().serialize(ref constructor);
    TREASURY().serialize(ref constructor);
    lords_address.serialize(ref constructor);
    mmr_address.serialize(ref constructor);
    let loot_chest = deploy_collection("devChest");
    let cosmetics = deploy_collection("devCosmetics");
    loot_chest.serialize(ref constructor);
    cosmetics.serialize(ref constructor);
    let (ledger_address, _) = ledger_class.deploy(@constructor).unwrap();
    let ledger = IGameLedgerDispatcher { contract_address: ledger_address };
    grant_collection_minter(loot_chest, ledger_address);
    grant_collection_minter(cosmetics, ledger_address);
    let mut chest_metadata = array![];
    for band in test_bands() {
        chest_metadata.append(band.metadata);
    }
    configure_collection_metadata(loot_chest, chest_metadata);
    for items in test_items() {
        configure_collection_metadata(cosmetics, items);
    }

    Fixture {
        ledger_address,
        ledger,
        lords_address,
        mmr: IMMRTokenDispatcher { contract_address: mmr_address },
        chest_address: loot_chest,
        cosmetics_address: cosmetics,
        lords: IERC20Dispatcher { contract_address: lords_address },
        lords_minter: ITestLordsDispatcher { contract_address: lords_address },
    }
}


fn configure_game(fixture: Fixture, preset: Preset) -> Fixture {
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.register_preset(PRESET_ID, preset, test_bands(), test_items());
    fixture.ledger.open_season(1, PRESET_ID, START, SEASON_END);
    stop_cheat_caller_address(fixture.ledger_address);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.open_slot(SLOT_KEY, 1, PRESET_ID, START, END);
    stop_cheat_caller_address(fixture.ledger_address);

    fixture
}

fn deploy_fixture(preset: Preset) -> Fixture {
    configure_game(deploy_ledger(), preset)
}

fn fund_and_approve_player(fixture: @Fixture, owner: ContractAddress, amount: u256) {
    fixture.lords_minter.mint(owner, amount);
    start_cheat_caller_address(*fixture.lords_address, owner);
    IERC20Dispatcher { contract_address: fixture.ledger.lords() }.approve(*fixture.ledger_address, amount);
    stop_cheat_caller_address(*fixture.lords_address);
}


fn register_players(fixture: @Fixture, count: u16) {
    for index in 0..count {
        let owner = player(index);
        fund_and_approve_player(fixture, owner, 500);

        start_cheat_caller_address(*fixture.ledger_address, owner);
        fixture.ledger.register(SLOT_KEY, false, false);
        stop_cheat_caller_address(*fixture.ledger_address);
    }
}

fn ranked_players(count: u16) -> Array<RankedPlayer> {
    let mut ranked = array![];
    for index in 0..count {
        ranked.append(row(player(index), index + 1));
    }
    ranked
}

fn row(wallet: ContractAddress, rank: u16) -> RankedPlayer {
    RankedPlayer { wallet, rank }
}

#[test]
fn result_commitment_binds_game_order_and_ranks() {
    let ranked = array![row(player(0), 1), row(player(1), 1)];
    let expected = core::poseidon::poseidon_hash_span(
        array!['ETERNUM_BLITZ_RESULT', 3, 'shard', 7, 2, 1000, 1, 1001, 1].span(),
    );
    assert!(result_commitment(GAME_KEY, ranked.span()) == expected);
    assert!(expected == 0x5d912378a36e87b3b4331c33a3cb97ad23ddfbcab670825f2fa18743f34c6d6);
    let reordered = array![row(player(1), 1), row(player(0), 1)];
    assert!(result_commitment(GAME_KEY, reordered.span()) != expected);
    let mut different = row(player(0), 1);
    different.rank = 2;
    assert!(result_commitment(GAME_KEY, array![different, row(player(1), 1)].span()) != expected);
}

fn apply_results_at(fixture: @Fixture, timestamp: u64, ranked: Array<RankedPlayer>) {
    start_cheat_block_timestamp(*fixture.ledger_address, timestamp);
    start_cheat_caller_address(*fixture.ledger_address, OPERATOR());
    fixture.ledger.apply_results(SLOT_KEY, GAME_KEY.game_id, ranked);
    stop_cheat_caller_address(*fixture.ledger_address);
    stop_cheat_block_timestamp(*fixture.ledger_address);
}

fn apply_results(fixture: @Fixture, ranked: Array<RankedPlayer>) {
    apply_results_at(fixture, START, ranked);
}

fn assert_conservation(count: u16) {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, count);
    let initial_pool: u256 = count.into() * 500;
    apply_results(@fixture, ranked_players(count));

    let game = fixture.ledger.get_slot(SLOT_KEY);
    assert!(game.pool == 0, "game accounting should be zero");
    assert!(fixture.ledger.get_season(1).pool == initial_pool, "entries must join the season pool");
    assert!(fixture.lords.balance_of(fixture.ledger_address) == initial_pool, "season holds all entries");
    assert!(fixture.lords.balance_of(TREASURY()) == 0, "no per-game treasury cut");
    for index in 0..count {
        assert!(fixture.lords.balance_of(player(index)) == 0, "no per-game rank payment");
    }
}

#[test]
fn deploys_with_value_plane_guardrails_engaged() {
    let fixture = deploy_ledger();
    let pausable = IPausableDispatcher { contract_address: fixture.ledger_address };

    assert!(!pausable.is_paused(), "ledger should deploy active");
    assert!(fixture.lords.balance_of(fixture.ledger_address) == 0, "ledger should deploy without LORDS custody");
}

#[test]
fn admin_controls_pause() {
    let fixture = deploy_ledger();
    let pausable = IPausableDispatcher { contract_address: fixture.ledger_address };

    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.pause();
    assert!(pausable.is_paused(), "admin should be able to pause the ledger");
    fixture.ledger.unpause();
    stop_cheat_caller_address(fixture.ledger_address);

    assert!(!pausable.is_paused(), "admin should be able to unpause the ledger");
}

#[test]
#[should_panic]
fn non_admin_cannot_pause() {
    let fixture = deploy_ledger();
    start_cheat_caller_address(fixture.ledger_address, player(0));
    fixture.ledger.pause();
}

#[test]
fn admin_can_rescue_an_unmanaged_token() {
    let fixture = deploy_ledger();
    let token_class = declare("TestLords").unwrap().contract_class();
    let (token_address, _) = token_class.deploy(@array![]).unwrap();
    let token = IERC20Dispatcher { contract_address: token_address };
    ITestLordsDispatcher { contract_address: token_address }.mint(fixture.ledger_address, 17);

    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.rescue_token(token_address, ADMIN(), 17);
    stop_cheat_caller_address(fixture.ledger_address);

    assert!(token.balance_of(ADMIN()) == 17, "rescued token did not reach the admin recipient");
}

#[test]
#[should_panic(expected: "Ledger: LORDS are managed funds")]
fn admin_cannot_rescue_managed_lords() {
    let fixture = deploy_ledger();
    fixture.lords_minter.mint(fixture.ledger_address, 17);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.rescue_token(fixture.lords_address, ADMIN(), 17);
}

#[test]
fn payout_pause_keeps_registration_open() {
    let fixture = deploy_fixture(default_preset());
    fund_and_approve_player(@fixture, player(0), 500);

    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.pause();
    start_cheat_caller_address(fixture.ledger_address, player(0));
    fixture.ledger.register(SLOT_KEY, false, false);

    assert!(fixture.ledger.get_slot(SLOT_KEY).pool == 500);
}

#[test]
fn admin_can_upgrade_without_losing_state() {
    let fixture = deploy_fixture(default_preset());
    let upgradeable = IUpgradeableDispatcher { contract_address: fixture.ledger_address };
    let class_hash = get_class_hash(fixture.ledger_address);

    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    upgradeable.upgrade(class_hash);
    stop_cheat_caller_address(fixture.ledger_address);

    assert!(fixture.ledger.get_preset(PRESET_ID).entry_fee == 500, "upgrade should preserve ledger storage");
}

#[test]
#[should_panic]
fn non_admin_cannot_upgrade() {
    let fixture = deploy_ledger();
    let upgradeable = IUpgradeableDispatcher { contract_address: fixture.ledger_address };
    start_cheat_caller_address(fixture.ledger_address, player(0));
    upgradeable.upgrade(get_class_hash(fixture.ledger_address));
}

#[test]
#[should_panic]
fn non_admin_cannot_register_preset() {
    let fixture = deploy_ledger();
    start_cheat_caller_address(fixture.ledger_address, player(0));
    fixture.ledger.register_preset(PRESET_ID, default_preset(), test_bands(), test_items());
}

#[test]
#[should_panic]
fn rejects_zero_paid_fraction() {
    let mut preset = default_preset();
    preset.paid_fraction_bps = 0;
    deploy_fixture(preset);
}

#[test]
#[should_panic]
fn rejects_paid_fraction_above_one_hundred_percent() {
    let mut preset = default_preset();
    preset.paid_fraction_bps = 10_001;
    deploy_fixture(preset);
}

#[test]
#[should_panic]
fn rejects_zero_decay() {
    let mut preset = default_preset();
    preset.decay_bps = 0;
    deploy_fixture(preset);
}

#[test]
#[should_panic]
fn rejects_decay_above_one_hundred_percent() {
    let mut preset = default_preset();
    preset.decay_bps = 10_001;
    deploy_fixture(preset);
}

#[test]
#[should_panic]
fn rejects_double_registration() {
    let fixture = deploy_fixture(default_preset());
    let owner = player(0);
    fund_and_approve_player(@fixture, owner, 1_000);

    start_cheat_caller_address(fixture.ledger_address, owner);
    fixture.ledger.register(SLOT_KEY, false, false);
    fixture.ledger.register(SLOT_KEY, false, false);
}

#[test]
#[should_panic]
fn rejects_registration_after_start() {
    let fixture = deploy_fixture(default_preset());
    let owner = player(0);
    fund_and_approve_player(@fixture, owner, 500);
    start_cheat_block_timestamp(fixture.ledger_address, START);

    start_cheat_caller_address(fixture.ledger_address, owner);
    fixture.ledger.register(SLOT_KEY, false, false);
}

#[test]
#[should_panic]
fn rejects_cancellation_after_start() {
    let fixture = deploy_fixture(default_preset());
    start_cheat_block_timestamp(fixture.ledger_address, START);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.cancel_slot(SLOT_KEY);
}

#[test]
fn cancellation_refunds_exact_registration_payment() {
    let fixture = deploy_fixture(default_preset());
    let owner = player(0);
    fund_and_approve_player(@fixture, owner, 500);

    start_cheat_caller_address(fixture.ledger_address, owner);
    fixture.ledger.register(SLOT_KEY, false, false);

    stop_cheat_caller_address(fixture.ledger_address);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.cancel_slot(SLOT_KEY);
    stop_cheat_caller_address(fixture.ledger_address);
    start_cheat_caller_address(fixture.ledger_address, owner);
    fixture.ledger.refund(SLOT_KEY);
    stop_cheat_caller_address(fixture.ledger_address);

    assert!(fixture.lords.balance_of(owner) == 500, "owner should recover all payments");
    assert!(fixture.ledger.get_slot(SLOT_KEY).pool == 0, "cancelled pool should be empty");
}

#[test]
fn paused_ledger_allows_refunds() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 1);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.cancel_slot(SLOT_KEY);
    stop_cheat_caller_address(fixture.ledger_address);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.pause();
    stop_cheat_caller_address(fixture.ledger_address);

    start_cheat_caller_address(fixture.ledger_address, player(0));
    fixture.ledger.refund(SLOT_KEY);
    assert!(fixture.lords.balance_of(player(0)) == 500);
    assert!(fixture.ledger.get_slot(SLOT_KEY).pool == 0);
}

#[test]
fn started_abandoned_game_refunds_every_entrant_after_end() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 2);
    start_cheat_block_timestamp(fixture.ledger_address, END);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.abort_slot(SLOT_KEY);
    stop_cheat_caller_address(fixture.ledger_address);

    let mut index: u16 = 0;
    while index < 2 {
        let owner = player(index);
        start_cheat_caller_address(fixture.ledger_address, owner);
        fixture.ledger.refund(SLOT_KEY);
        stop_cheat_caller_address(fixture.ledger_address);
        assert!(fixture.lords.balance_of(owner) == 500, "entrant should recover the registration payment");
        index += 1;
    }
    stop_cheat_block_timestamp(fixture.ledger_address);

    assert!(fixture.ledger.get_slot(SLOT_KEY).pool == 0, "aborted pool should be empty");
    assert!(fixture.lords.balance_of(fixture.ledger_address) == 0, "aborted funds should leave the ledger");
}

#[test]
#[should_panic]
fn non_operator_cannot_apply_results() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 1);
    start_cheat_block_timestamp(fixture.ledger_address, START);
    start_cheat_caller_address(fixture.ledger_address, player(0));
    fixture.ledger.apply_results(SLOT_KEY, GAME_KEY.game_id, ranked_players(1));
}

#[test]
fn operator_can_resolve_after_start_before_scheduled_end() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 1);
    apply_results_at(@fixture, START, ranked_players(1));

    assert!(
        fixture.ledger.get_result_commitment(GAME_KEY) != 0,
        "an ended match should settle before its scheduled deadline",
    );
}

#[test]
#[should_panic]
fn rejects_unordered_ranks() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 6);
    let ranked = array![
        row(player(0), 1), row(player(1), 3), row(player(2), 2), row(player(3), 4), row(player(4), 5),
        row(player(5), 6),
    ];
    apply_results(@fixture, ranked);
}

#[test]
#[should_panic]
fn rejects_dense_rank_after_tie() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 6);
    let ranked = array![
        row(player(0), 1), row(player(1), 1), row(player(2), 2), row(player(3), 4), row(player(4), 5),
        row(player(5), 6),
    ];
    apply_results(@fixture, ranked);
}

#[test]
#[should_panic]
fn rejects_second_results_application() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 6);
    apply_results(@fixture, ranked_players(6));
    apply_results(@fixture, ranked_players(6));
}

#[test]
fn conserves_six_player_pool() {
    assert_conservation(6);
}

#[test]
fn conserves_maximum_shard_roster_pool() {
    assert_conservation(24);
}

#[test]
fn tie_fixture_one_one_three_preserves_mmr() {
    let mut preset = default_preset();
    preset.paid_fraction_bps = 10_000;
    let fixture = deploy_fixture(preset);
    register_players(@fixture, 3);
    apply_results(@fixture, array![row(player(0), 1), row(player(1), 1), row(player(2), 3)]);

    let first = fixture.ledger.get_player_result(GAME_KEY, player(0));
    let second = fixture.ledger.get_player_result(GAME_KEY, player(1));
    let third = fixture.ledger.get_player_result(GAME_KEY, player(2));
    assert!((first.mmr_after, second.mmr_after, third.mmr_after) == (1016, 1016, 991), "1,1,3 MMR fixture changed");
}

#[test]
fn tie_fixture_one_two_two_four_preserves_mmr() {
    let mut preset = default_preset();
    preset.paid_fraction_bps = 10_000;
    let fixture = deploy_fixture(preset);
    register_players(@fixture, 4);
    apply_results(@fixture, array![row(player(0), 1), row(player(1), 2), row(player(2), 2), row(player(3), 4)]);

    let first = fixture.ledger.get_player_result(GAME_KEY, player(0));
    let second = fixture.ledger.get_player_result(GAME_KEY, player(1));
    let third = fixture.ledger.get_player_result(GAME_KEY, player(2));
    let fourth = fixture.ledger.get_player_result(GAME_KEY, player(3));
    assert!(
        (first.mmr_after, second.mmr_after, third.mmr_after, fourth.mmr_after) == (1026, 1007, 1007, 989),
        "1,2,2,4 MMR fixture changed",
    );
}

#[test]
fn a_single_player_keeps_the_rating_and_the_paid_flag_purchase() {
    let fixture = deploy_fixture(default_preset());
    let owner = player(0);
    fund_and_approve_player(@fixture, owner, 1_000);

    start_cheat_caller_address(fixture.ledger_address, owner);
    fixture.ledger.register(SLOT_KEY, true, false);
    stop_cheat_caller_address(fixture.ledger_address);
    apply_results(@fixture, array![row(owner, 1)]);

    let registration = fixture.ledger.get_registration(SLOT_KEY, owner);
    assert!(registration.sword, "sword purchase should be recorded");
    assert!(registration.paid == 1000, "the purchase amount must stay in the registration snapshot");
    assert!(fixture.ledger.get_result_commitment(GAME_KEY) != 0, "the single-player game must settle");
    assert!(fixture.ledger.get_player_result(GAME_KEY, owner).rank == 1);
    assert!(fixture.ledger.get_season(1).participant_count == 1);
    assert!(fixture.ledger.get_season_mmr(1, owner) == 1000);
    assert!(
        fixture
            .ledger
            .get_player_result(GAME_KEY, owner)
            .mmr_before == fixture
            .ledger
            .get_player_result(GAME_KEY, owner)
            .mmr_after,
    );
}

#[test]
fn two_player_slot_results_update_both_season_ratings() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 2);
    apply_results(@fixture, ranked_players(2));
    let winner = fixture.ledger.get_player_result(GAME_KEY, player(0));
    let loser = fixture.ledger.get_player_result(GAME_KEY, player(1));
    assert!(winner.mmr_before == 1000 && winner.mmr_after > 1000 && winner.mmr_after <= 1045);
    assert!(loser.mmr_before == 1000 && loser.mmr_after < 1000 && loser.mmr_after >= 955);
    assert!(fixture.ledger.get_season(1).participant_count == 2);
    assert!(fixture.ledger.get_season_mmr(1, player(0)) == winner.mmr_after);
    assert!(fixture.ledger.get_season_mmr(1, player(1)) == loser.mmr_after);
}

fn funded_frontier() -> Fixture {
    let fixture = deploy_ledger();
    fund_and_approve_player(@fixture, ADMIN(), 1000);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.register_preset(PRESET_ID, default_preset(), test_bands(), test_items());
    fixture.ledger.fund_frontier('shard', 1, PRESET_ID, START, END, 0x5eed, 1000);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture
}

#[test]
fn frontier_unlock_uses_the_shards_seeded_boundaries_including_the_first_second() {
    let fixture = funded_frontier();
    start_cheat_block_timestamp(fixture.ledger_address, START - 1);
    assert!(fixture.ledger.frontier_unlocked('shard', 1) == 0);
    // The shard/client golden vector: variable days, including crossings between bags.
    let units = array![4_u64, 6, 3, 2, 5, 4, 3, 5, 2, 6, 3, 6, 4, 2, 5];
    let mut elapsed = 0;
    for length in units {
        let end = elapsed + length;
        let expected: u256 = 1000_u256 * end.into() / (END - START).into();
        start_cheat_block_timestamp(fixture.ledger_address, START + elapsed);
        assert!(fixture.ledger.frontier_unlocked('shard', 1) == expected);
        start_cheat_block_timestamp(fixture.ledger_address, START + end - 1);
        assert!(fixture.ledger.frontier_unlocked('shard', 1) == expected);
        elapsed = end;
    }
    start_cheat_block_timestamp(fixture.ledger_address, END - 1);
    assert!(fixture.ledger.frontier_unlocked('shard', 1) == 1000);
    start_cheat_block_timestamp(fixture.ledger_address, END);
    assert!(fixture.ledger.frontier_unlocked('shard', 1) == 1000);
}

#[test]
fn frontier_reads_the_seasons_start_and_its_exact_preset_day_unit() {
    let fixture = funded_frontier();
    let preset = Preset { day_unit_seconds: 2, ..default_preset() };
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.register_preset(2, preset, test_bands(), test_items());
    fund_and_approve_player(@fixture, ADMIN(), 1000);
    fixture.ledger.fund_frontier('shard', 2, 2, 300, 340, 0x5eed, 1000);
    start_cheat_block_timestamp(fixture.ledger_address, 299);
    assert!(fixture.ledger.frontier_unlocked('shard', 2) == 0);
    start_cheat_block_timestamp(fixture.ledger_address, 300);
    assert!(fixture.ledger.frontier_unlocked('shard', 2) == 200);
    start_cheat_block_timestamp(fixture.ledger_address, 307);
    assert!(fixture.ledger.frontier_unlocked('shard', 2) == 200);
    start_cheat_block_timestamp(fixture.ledger_address, 308);
    assert!(fixture.ledger.frontier_unlocked('shard', 2) == 500);
}

#[test]
fn frontier_unlocks_the_last_day_from_its_start_and_stops_at_the_supplied_end() {
    let fixture = deploy_ledger();
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.register_preset(PRESET_ID, default_preset(), test_bands(), test_items());
    fund_and_approve_player(@fixture, ADMIN(), 1000);
    fixture.ledger.fund_frontier('shard', 1, PRESET_ID, START, START + 20, 0x5eed, 1000);
    start_cheat_block_timestamp(fixture.ledger_address, START + 14);
    assert!(fixture.ledger.frontier_unlocked('shard', 1) == 750);
    start_cheat_block_timestamp(fixture.ledger_address, START + 15);
    assert!(fixture.ledger.frontier_unlocked('shard', 1) == 1000);
    start_cheat_block_timestamp(fixture.ledger_address, START + 20);
    assert!(fixture.ledger.frontier_unlocked('shard', 1) == 1000);
}

#[test]
#[should_panic(expected: "Ledger: Frontier days disabled")]
fn frontier_funding_requires_an_enabled_preset_calendar() {
    let fixture = deploy_fixture(Preset { day_unit_seconds: 0, ..default_preset() });
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.fund_frontier('shard', 1, PRESET_ID, START, END, 0x5eed, 1000);
}

#[test]
#[feature("safe_dispatcher")]
fn frontier_funding_requires_a_positive_whole_bag_window() {
    let fixture = deploy_fixture(default_preset());
    fund_and_approve_player(@fixture, ADMIN(), 1000);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    let safe = IGameLedgerSafeDispatcher { contract_address: fixture.ledger_address };
    for end in array![START - 1, START, START + 1, START + 19, START + 21, END - 1] {
        assert!(safe.fund_frontier('shard', 1, PRESET_ID, START, end, 0x5eed, 1000).is_err());
        assert!(fixture.lords.balance_of(ADMIN()) == 1000);
    }
    fixture.ledger.fund_frontier('shard', 1, PRESET_ID, START, START + 20, 0x5eed, 1000);
    assert!(fixture.ledger.get_frontier('shard', 1).end == START + 20);
}

#[test]
#[feature("safe_dispatcher")]
fn different_season_lengths_share_one_preset_and_keep_their_own_unlock_and_close_deadline() {
    let fixture = funded_frontier();
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    for (season_id, end) in array![(2_u32, START + 20), (3, START + 60)] {
        fund_and_approve_player(@fixture, ADMIN(), 1000);
        fixture.ledger.fund_frontier('shard', season_id, PRESET_ID, START, end, 0x5eed, 1000);
    }
    let safe = IGameLedgerSafeDispatcher { contract_address: fixture.ledger_address };
    let claim_window: u64 = default_preset().claim_window_seconds.into();
    for (season_id, end) in array![(2_u32, START + 20), (3, START + 60), (1, END)] {
        let season = fixture.ledger.get_frontier('shard', season_id);
        assert!(season.start == START && season.end == end && season.preset_id == PRESET_ID);
        start_cheat_block_timestamp(fixture.ledger_address, START - 1);
        assert!(fixture.ledger.frontier_unlocked('shard', season_id) == 0);
        start_cheat_block_timestamp(fixture.ledger_address, START);
        assert!(fixture.ledger.frontier_unlocked('shard', season_id) == 4000_u256 / (end - START).into());
        start_cheat_block_timestamp(fixture.ledger_address, end - 1);
        assert!(fixture.ledger.frontier_unlocked('shard', season_id) == 1000);
        start_cheat_block_timestamp(fixture.ledger_address, end);
        assert!(fixture.ledger.frontier_unlocked('shard', season_id) == 1000);
        let deadline = end + claim_window;
        assert!(fixture.ledger.frontier_claim_deadline('shard', season_id) == deadline);
        start_cheat_block_timestamp(fixture.ledger_address, deadline - 1);
        assert!(safe.close_frontier('shard', season_id).is_err());
        start_cheat_caller_address(fixture.ledger_address, OPERATOR());
        fixture.ledger.report_withdrawal('shard', season_id, season_id.into(), 1, 0, 0);
        start_cheat_block_timestamp(fixture.ledger_address, deadline);
        assert!(safe.report_withdrawal('shard', season_id, (season_id + 100).into(), 1, 0, 0).is_err());
        start_cheat_caller_address(fixture.ledger_address, ADMIN());
        fixture.ledger.close_frontier('shard', season_id);
        assert!(fixture.ledger.get_frontier('shard', season_id).closed);
    }
    assert!(fixture.ledger.frontier_carry('shard') == 3000);
    assert!(fixture.lords.balance_of(TREASURY()) == 0);
}

#[test]
fn frontier_unlock_rolls_over_and_retries_pay_once() {
    let fixture = funded_frontier();
    start_cheat_block_timestamp(fixture.ledger_address, START);
    assert!(fixture.ledger.frontier_unlocked('shard', 1) == 40);
    fixture.ledger.report_withdrawal('shard', 1, 'withdrawal', 40, 0, 0);
    fixture.ledger.pay('shard', 1, 'withdrawal', player(0), 40);
    fixture.ledger.pay('shard', 1, 'withdrawal', player(1), 999);
    assert!(fixture.lords.balance_of(player(0)) == 40);
    assert!(fixture.lords.balance_of(player(1)) == 0);
    assert!(fixture.ledger.get_payment('shard', 'withdrawal').amount == 40);
    start_cheat_block_timestamp(fixture.ledger_address, END + 1);
    fixture.ledger.report_withdrawal('shard', 1, 'next', 960, 0, 0);
    fixture.ledger.pay('shard', 1, 'next', player(0), 960);
    assert!(fixture.ledger.get_frontier('shard', 1).paid == 1000);
}

#[test]
#[should_panic(expected: "Ledger: unlock exceeded")]
fn frontier_refuses_borrowing_future_unlock() {
    let fixture = funded_frontier();
    start_cheat_block_timestamp(fixture.ledger_address, START);
    fixture.ledger.report_withdrawal('shard', 1, 'first', 30, 0, 0);
    fixture.ledger.pay('shard', 1, 'first', player(0), 30);
    fixture.ledger.report_withdrawal('shard', 1, 'second', 11, 0, 0);
    fixture.ledger.pay('shard', 1, 'second', player(0), 11);
}

#[test]
#[should_panic(expected: "Ledger: unlock exceeded")]
fn frontier_refuses_before_start() {
    let fixture = funded_frontier();
    fixture.ledger.report_withdrawal('shard', 1, 'first', 1, 0, 0);
    fixture.ledger.pay('shard', 1, 'first', player(0), 1);
}

#[test]
#[should_panic(expected: "Ledger: season already funded")]
fn frontier_is_funded_once() {
    let fixture = funded_frontier();
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.fund_frontier('shard', 1, PRESET_ID, START, END, 0x5eed, 1000);
}

fn grant_pauser(fixture: @Fixture) {
    start_cheat_caller_address(*fixture.ledger_address, ADMIN());
    IAccessControlDispatcher { contract_address: *fixture.ledger_address }
        .grant_role(selector!("PAUSER_ROLE"), player(9));
    start_cheat_caller_address(*fixture.ledger_address, player(9));
}

#[test]
#[should_panic(expected: 'Pausable: paused')]
fn pauser_stops_frontier_payments() {
    let fixture = funded_frontier();
    grant_pauser(@fixture);
    fixture.ledger.pause();
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    start_cheat_block_timestamp(fixture.ledger_address, END);
    fixture.ledger.pay('shard', 1, 'first', player(0), 1000);
}

#[test]
#[should_panic]
fn pauser_cannot_unpause() {
    let fixture = deploy_ledger();
    grant_pauser(@fixture);
    fixture.ledger.pause();
    fixture.ledger.unpause();
}

#[test]
#[should_panic]
fn pauser_cannot_pay() {
    let fixture = funded_frontier();
    grant_pauser(@fixture);
    start_cheat_block_timestamp(fixture.ledger_address, END);
    fixture.ledger.pay('shard', 1, 'first', player(0), 1000);
}

#[test]
fn frontier_close_returns_only_unspent_custody_even_when_paused() {
    let fixture = funded_frontier();
    start_cheat_block_timestamp(fixture.ledger_address, 150);
    fixture.ledger.report_withdrawal('shard', 1, 'first', 300, 0, 0);
    fixture.ledger.pay('shard', 1, 'first', player(0), 300);
    start_cheat_block_timestamp(fixture.ledger_address, END + default_preset().claim_window_seconds.into());
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.pause();
    fixture.ledger.close_frontier('shard', 1);
    assert!(fixture.ledger.frontier_carry('shard') == 700);
    assert!(fixture.lords.balance_of(TREASURY()) == 0);
    assert!(fixture.ledger.get_frontier('shard', 1).closed);
}

#[test]
#[should_panic(expected: "Ledger: season closed")]
fn frontier_close_refuses_later_claims() {
    let fixture = funded_frontier();
    start_cheat_block_timestamp(fixture.ledger_address, END + default_preset().claim_window_seconds.into());
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.close_frontier('shard', 1);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.pay('shard', 1, 'first', player(0), 1);
}

#[test]
fn frontier_claim_namespace_binds_shard_and_survives_season_close() {
    let fixture = funded_frontier();
    fund_and_approve_player(@fixture, ADMIN(), 1000);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.fund_frontier('other', 1, PRESET_ID, START, END, 0x5eed, 1000);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.report_withdrawal('shard', 1, 'tx', 1000, 0, 0);
    fixture.ledger.report_withdrawal('other', 1, 'tx', 1000, 0, 0);
    start_cheat_block_timestamp(fixture.ledger_address, END + default_preset().claim_window_seconds.into());
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.pay('shard', 1, 'tx', player(0), 1000);
    fixture.ledger.pay('other', 1, 'tx', player(1), 1000);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.close_frontier('shard', 1);
    fixture.ledger.pause();
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.pay('shard', 2, 'tx', player(0), 1000);
    assert!(fixture.lords.balance_of(player(0)) == 1000);
    assert!(fixture.lords.balance_of(player(1)) == 1000);
}

#[test]
fn sword_and_shield_payments_feed_the_same_season() {
    let fixture = deploy_fixture(default_preset());
    let owner = player(0);
    fund_and_approve_player(@fixture, owner, 1500);

    start_cheat_caller_address(fixture.ledger_address, owner);
    fixture.ledger.register(SLOT_KEY, true, true);

    apply_results(@fixture, ranked_players(1));
    assert!(fixture.ledger.get_season(1).pool == 1500);
    assert!(fixture.lords.balance_of(fixture.ledger_address) == 1500);
}

#[test]
fn payout_pause_still_allows_results_and_mmr() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 6);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.pause();
    apply_results(@fixture, ranked_players(6));
    assert!(fixture.ledger.get_result_commitment(GAME_KEY) != 0);
    assert!(fixture.ledger.get_player_result(GAME_KEY, player(0)).mmr_after > 1000);
}

#[test]
#[should_panic(expected: "Ledger: MMR frozen")]
fn season_end_freezes_results() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 1);
    apply_results_at(@fixture, SEASON_END, ranked_players(1));
}

#[test]
fn identical_game_ids_on_different_shards_have_independent_custody() {
    let fixture = deploy_fixture(default_preset());
    let other = SlotKey { shard: 'other', slot_id: SLOT_KEY.slot_id };
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.open_slot(other, 1, PRESET_ID, START, END);
    fund_and_approve_player(@fixture, player(0), 1000);

    start_cheat_caller_address(fixture.ledger_address, player(0));
    fixture.ledger.register(SLOT_KEY, false, false);
    fixture.ledger.register(other, false, false);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.cancel_slot(other);
    start_cheat_caller_address(fixture.ledger_address, player(0));
    fixture.ledger.refund(other);
    assert!(fixture.ledger.get_slot(SLOT_KEY).pool == 500);
    assert!(fixture.ledger.get_slot(other).pool == 0);
    apply_results(@fixture, ranked_players(1));
    assert!(fixture.ledger.get_season(1).pool == 500);
    assert!(
        fixture
            .ledger
            .get_player_result(GameKey { shard: other.shard, game_id: GAME_KEY.game_id }, player(0))
            .rank == 0,
    );
}

#[test]
fn result_commitment_binds_the_shard_namespace() {
    let ranked = ranked_players(1);
    let other = SlotKey { shard: 'other', slot_id: SLOT_KEY.slot_id };
    assert!(
        result_commitment(
            GAME_KEY, ranked.span(),
        ) != result_commitment(GameKey { shard: other.shard, game_id: GAME_KEY.game_id }, ranked.span()),
    );
}

fn deploy_collection(name: ByteArray) -> ContractAddress {
    let collectible_class = declare("RealmsCollectible").unwrap().contract_class();
    let mut constructor = array![];
    name.serialize(ref constructor);
    name.serialize(ref constructor);
    let empty: ByteArray = "";
    empty.serialize(ref constructor);
    let description: ByteArray = "Dev test collection (no value)";
    description.serialize(ref constructor);
    for _ in 0_u32..6 {
        ADMIN().serialize(ref constructor);
    }
    0_u128.serialize(ref constructor);
    let (address, _) = collectible_class.deploy(@constructor).unwrap();
    address
}

fn grant_collection_minter(collection: ContractAddress, minter: ContractAddress) {
    start_cheat_caller_address(collection, ADMIN());
    IAccessControlDispatcher { contract_address: collection }.grant_role(MINTER_ROLE, minter);
    stop_cheat_caller_address(collection);
}

fn configure_collection_metadata(collection: ContractAddress, attributes: Array<u128>) {
    start_cheat_caller_address(collection, ADMIN());
    let metadata = IRealmsCollectibleMetadataDispatcher { contract_address: collection };
    for attribute in attributes {
        metadata.set_attrs_raw_to_ipfs_cid(attribute, "test-cid", false);
    }
    stop_cheat_caller_address(collection);
}

fn test_items() -> Array<Array<u128>> {
    array![array![0x1011401], array![0x3021101], array![0x4030f01], array![0x4040d01], array![0x207050c01]]
}

fn odds_for(outcome: u8) -> ChestOdds {
    ChestOdds {
        common: if outcome == 0 {
            10000
        } else {
            0
        },
        uncommon: if outcome == 1 {
            10000
        } else {
            0
        },
        rare: if outcome == 2 {
            10000
        } else {
            0
        },
        epic: if outcome == 3 {
            10000
        } else {
            0
        },
        legendary: if outcome == 4 {
            10000
        } else {
            0
        },
        lords: if outcome == 5 {
            9999
        } else {
            0
        },
        sword: if outcome == 6 {
            10000
        } else if outcome == 5 {
            1
        } else {
            0
        },
        shield: if outcome == 7 {
            10000
        } else {
            0
        },
    }
}

fn test_bands() -> Array<ChestBandPreset> {
    let mut bands = array![];
    for band in 0_u32..5 {
        bands
            .append(
                ChestBandPreset {
                    metadata: 0x301 + band.into(), odds: odds_for(if band == 4 {
                        7
                    } else {
                        6
                    }), lords_shares: 0,
                },
            );
    }
    bands
}

fn deploy_reward_fixture(outcome: u8, reserve_bps: u16, lords_shares: u8) -> Fixture {
    let fixture = deploy_ledger();
    let mut preset = default_preset();
    preset.chest_lords_bps = reserve_bps;
    let mut bands = array![];
    for band in 0_u32..5 {
        bands.append(ChestBandPreset { metadata: 0x301 + band.into(), odds: odds_for(outcome), lords_shares });
    }
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.register_preset(PRESET_ID, preset, bands, test_items());
    fixture.ledger.open_season(1, PRESET_ID, START, SEASON_END);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.open_slot(SLOT_KEY, 1, PRESET_ID, START, END);
    stop_cheat_caller_address(fixture.ledger_address);
    fixture
}

#[test]
fn chest_shares_use_the_slots_entry_fee_and_never_pay_less_than_one_entry() {
    for entry in array![100_u256, 500] {
        for band in 0_u16..5 {
            let fixture = deploy_ledger();
            let mut preset = default_preset();
            preset.entry_fee = entry;
            preset.chest_lords_bps = 10000;
            let shares = array![4_u8, 2, 1, 0, 0];
            let mut bands = array![];
            for index in 0_u32..5 {
                bands
                    .append(
                        ChestBandPreset {
                            metadata: 0x301 + index.into(),
                            odds: odds_for(if index < 3 {
                                5
                            } else {
                                6
                            }),
                            lords_shares: *shares.at(index),
                        },
                    );
            }
            start_cheat_caller_address(fixture.ledger_address, ADMIN());
            fixture.ledger.register_preset(PRESET_ID, preset, bands, test_items());
            fixture.ledger.open_season(1, PRESET_ID, START, SEASON_END);
            start_cheat_caller_address(fixture.ledger_address, OPERATOR());
            fixture.ledger.open_slot(SLOT_KEY, 1, PRESET_ID, START, END);
            for index in 0_u16..5 {
                fund_and_approve_player(@fixture, player(index), entry);
                start_cheat_caller_address(fixture.ledger_address, player(index));
                fixture.ledger.register(SLOT_KEY, false, false);
            }
            apply_results(@fixture, ranked_players(5));
            let token_id: u256 = (band + 1).into();
            assert!(fixture.ledger.get_chest(token_id).band == band.try_into().unwrap());
            open_reward(@fixture, player(band), token_id);
            let expected = entry * (*shares.at(band.into())).into();
            assert!(fixture.lords.balance_of(player(band)) == expected);
            assert!(expected == 0 || expected >= entry);
            assert!(fixture.ledger.get_season(1).chest_reserve == 5 * entry - expected);
            if band >= 3 {
                assert!(fixture.ledger.get_credits(player(band)).swords == 1);
            }
        }
    }
}

#[test]
#[feature("safe_dispatcher")]
fn pot_shares_accept_exactly_one_hundred_percent_and_refuse_more() {
    let fixture = deploy_ledger();
    let safe = IGameLedgerSafeDispatcher { contract_address: fixture.ledger_address };
    let mut preset = default_preset();
    preset.protocol_cut_bps = 5000;
    preset.chest_lords_bps = 5001;
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    assert!(safe.register_preset(2, preset, test_bands(), test_items()).is_err());
    preset.chest_lords_bps = 5000;
    fixture.ledger.register_preset(2, preset, test_bands(), test_items());
    assert!(fixture.ledger.get_preset(2).chest_lords_bps == 5000);
}

#[test]
#[should_panic(expected: "Ledger: missing chest fallback")]
fn token_odds_must_leave_a_non_token_fallback() {
    let fixture = deploy_ledger();
    let mut bands = test_bands();
    let mut band = bands.pop_front().unwrap();
    band.odds = odds_for(5);
    band.odds.lords = 10000;
    band.odds.sword = 0;
    band.lords_shares = 1;
    bands.append(band);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.register_preset(2, default_preset(), bands, test_items());
}

fn request_reward(fixture: @Fixture, wallet: ContractAddress, token_id: u256) {
    start_cheat_caller_address(*fixture.chest_address, wallet);
    IERC721Dispatcher { contract_address: *fixture.chest_address }.approve(*fixture.ledger_address, token_id);
    start_cheat_caller_address(*fixture.ledger_address, wallet);
    start_cheat_block_number(*fixture.ledger_address, 100);
    fixture.ledger.open_request(token_id);
    stop_cheat_caller_address(*fixture.ledger_address);
}

fn finish_reward(fixture: @Fixture, token_id: u256, tip: u64) {
    start_cheat_block_number(*fixture.ledger_address, tip);
    start_cheat_block_hash(*fixture.ledger_address, 101, 'future block hash');
    start_cheat_caller_address(*fixture.ledger_address, player(99));
    fixture.ledger.open_finish(token_id);
    stop_cheat_caller_address(*fixture.ledger_address);
    stop_cheat_block_number(*fixture.ledger_address);
}

fn open_reward(fixture: @Fixture, wallet: ContractAddress, token_id: u256) {
    request_reward(fixture, wallet, token_id);
    finish_reward(fixture, token_id, 111);
}

#[test]
fn unaffordable_lords_draws_pay_the_fallback_and_preserve_the_whole_reserve() {
    let fixture = deploy_reward_fixture(5, 2000, 1);
    register_players(@fixture, 2);
    apply_results(@fixture, ranked_players(2));
    assert!(fixture.ledger.get_season(1).pool == 800);
    assert!(fixture.ledger.get_season(1).chest_reserve == 200);
    assert!(fixture.ledger.get_chest(1).band == 0);
    assert!(fixture.ledger.get_chest(2).band == 4);
    assert!(fixture.ledger.get_chest(1).season_id == 1);
    open_reward(@fixture, player(0), 1);
    open_reward(@fixture, player(1), 2);
    assert!(fixture.lords.balance_of(player(0)) == 0);
    assert!(fixture.ledger.get_credits(player(0)).swords == 1);
    assert!(fixture.ledger.get_credits(player(1)).swords == 1);
    assert!(fixture.lords.balance_of(player(1)) == 0);
    assert!(fixture.lords.balance_of(TREASURY()) == 0);
    assert!(fixture.ledger.get_season(1).chest_reserve == 200);
    assert!(fixture.lords.balance_of(fixture.ledger_address) == 1000);
    assert!(fixture.ledger.get_chest(1).finished && fixture.ledger.get_chest(2).finished);
}

#[test]
fn a_permissionless_cosmetic_finish_mints_to_the_requester() {
    let fixture = deploy_reward_fixture(0, 0, 1);
    register_players(@fixture, 1);
    apply_results(@fixture, ranked_players(1));
    request_reward(@fixture, player(0), 1);
    finish_reward(@fixture, 1, 999999);
    let cosmetics = IERC721Dispatcher { contract_address: fixture.cosmetics_address };
    assert!(cosmetics.owner_of(1) == player(0));
    assert!(
        IRealmsCollectibleMetadataDispatcher { contract_address: fixture.cosmetics_address }
            .get_metadata_raw(1) == 0x1011401,
    );
    assert!(fixture.ledger.get_chest(1).request_block == 100);
}

#[test]
fn chest_owner_can_trade_the_mystery_before_requesting() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 1);
    apply_results(@fixture, ranked_players(1));
    start_cheat_caller_address(fixture.chest_address, player(0));
    IERC721Dispatcher { contract_address: fixture.chest_address }.transfer_from(player(0), player(1), 1);
    open_reward(@fixture, player(1), 1);
    assert!(fixture.ledger.get_credits(player(1)).swords == 1);
    assert!(fixture.ledger.get_credits(player(0)).swords == 0);
}

#[test]
fn sword_and_shield_credits_are_spent_and_refunded_once() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 2);
    apply_results(@fixture, ranked_players(2));
    open_reward(@fixture, player(0), 1);
    open_reward(@fixture, player(1), 2);
    let next = SlotKey { shard: 'shard', slot_id: 8 };
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.open_slot(next, 1, PRESET_ID, START, END);
    fund_and_approve_player(@fixture, player(0), 500);
    fund_and_approve_player(@fixture, player(1), 500);

    start_cheat_caller_address(fixture.ledger_address, player(0));
    fixture.ledger.register(next, true, false);

    start_cheat_caller_address(fixture.ledger_address, player(1));
    fixture.ledger.register(next, false, true);
    assert!(fixture.ledger.get_credits(player(0)).swords == 0);
    assert!(fixture.ledger.get_credits(player(1)).shields == 0);
    assert!(fixture.ledger.get_slot(next).pool == 1000);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.cancel_slot(next);
    start_cheat_caller_address(fixture.ledger_address, player(0));
    fixture.ledger.refund(next);
    start_cheat_caller_address(fixture.ledger_address, player(1));
    fixture.ledger.refund(next);
    assert!(fixture.ledger.get_credits(player(0)).swords == 1);
    assert!(fixture.ledger.get_credits(player(1)).shields == 1);
}

#[test]
#[should_panic(expected: "Ledger: chest already requested")]
fn chest_request_cannot_be_repeated() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 1);
    apply_results(@fixture, ranked_players(1));
    open_reward(@fixture, player(0), 1);
    fixture.ledger.open_request(1);
}

#[test]
fn paid_flags_and_entries_split_the_whole_pot_ten_ten_eighty() {
    let mut preset = default_preset();
    preset.protocol_cut_bps = 1000;
    preset.chest_lords_bps = 1000;
    let fixture = deploy_fixture(preset);
    fund_and_approve_player(@fixture, player(0), 1500);

    start_cheat_caller_address(fixture.ledger_address, player(0));
    fixture.ledger.register(SLOT_KEY, true, true);

    apply_results(@fixture, ranked_players(1));
    assert!(fixture.lords.balance_of(TREASURY()) == 150);
    assert!(fixture.ledger.get_season(1).chest_reserve == 150);
    assert!(fixture.ledger.get_season(1).pool == 1200);
}

#[test]
#[should_panic(expected: 'Pausable: paused')]
fn payout_pause_stops_finish_but_allows_irreversible_request() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 1);
    apply_results(@fixture, ranked_players(1));
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.pause();
    request_reward(@fixture, player(0), 1);
    finish_reward(@fixture, 1, 111);
}

#[test]
#[should_panic(expected: "Ledger: draw block not readable")]
fn finish_refuses_nine_blocks_after_the_fixed_draw_block() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 1);
    apply_results(@fixture, ranked_players(1));
    request_reward(@fixture, player(0), 1);
    finish_reward(@fixture, 1, 110);
}

#[test]
#[should_panic(expected: "Ledger: chest not requested")]
fn finish_cannot_be_previewed_before_consuming_the_token() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 1);
    apply_results(@fixture, ranked_players(1));
    finish_reward(@fixture, 1, 111);
}

#[test]
#[should_panic(expected: "Ledger: chest already finished")]
fn finish_cannot_pay_twice() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 1);
    apply_results(@fixture, ranked_players(1));
    open_reward(@fixture, player(0), 1);
    finish_reward(@fixture, 1, 112);
}

fn completed_season() -> Fixture {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 6);
    apply_results(@fixture, ranked_players(6));
    fixture
}

fn post_top_at(fixture: @Fixture, timestamp: u64, winners: Array<ContractAddress>) {
    start_cheat_block_timestamp(*fixture.ledger_address, timestamp);
    start_cheat_caller_address(*fixture.ledger_address, OPERATOR());
    fixture.ledger.post_season_top(1, winners);
}

fn claim_season_at(fixture: @Fixture, timestamp: u64, owner: ContractAddress) {
    start_cheat_block_timestamp(*fixture.ledger_address, timestamp);
    start_cheat_caller_address(*fixture.ledger_address, owner);
    let mut position = 0;
    while position < fixture.ledger.get_season(1).top_count {
        let (winner, _) = fixture.ledger.get_season_winner(1, position);
        if winner == owner {
            break;
        }
        position += 1;
    }
    fixture.ledger.claim_season(1, position);
}

#[test]
fn season_winners_pull_after_one_hour_using_the_preset_curve() {
    let fixture = completed_season();
    post_top_at(@fixture, SEASON_END, array![player(0), player(1)]);
    let season = fixture.ledger.get_season(1);
    assert!(season.participant_count == 6 && season.top_count == 2);
    assert!(season.review_until == SEASON_END + 3600);
    let (first, first_amount) = fixture.ledger.get_season_winner(1, 0);
    let (second, second_amount) = fixture.ledger.get_season_winner(1, 1);
    assert!(first == player(0) && second == player(1));
    assert!(first_amount == 1530 && second_amount == 1470);
    claim_season_at(@fixture, season.review_until, first);
    claim_season_at(@fixture, season.review_until, first);
    claim_season_at(@fixture, season.review_until, second);
    assert!(fixture.lords.balance_of(first) == first_amount);
    assert!(fixture.lords.balance_of(second) == second_amount);
    assert!(fixture.ledger.get_season(1).paid == first_amount + second_amount);
    assert!(fixture.ledger.season_claimed(1, first));
}

#[test]
#[should_panic(expected: "Ledger: season under review")]
fn season_payout_refuses_one_second_before_the_review_ends() {
    let fixture = completed_season();
    post_top_at(@fixture, SEASON_END, array![player(0), player(1)]);
    claim_season_at(@fixture, SEASON_END + 3599, player(0));
}

#[test]
fn a_better_omitted_player_challenges_a_wrong_list() {
    let fixture = completed_season();
    post_top_at(@fixture, SEASON_END, array![player(1), player(2)]);
    start_cheat_caller_address(fixture.ledger_address, player(5));
    fixture.ledger.challenge_season(1, player(0));
    assert!(fixture.ledger.get_season(1).challenged);
}

#[test]
fn a_challenged_complete_list_can_be_corrected_and_restarts_the_hour() {
    let fixture = completed_season();
    post_top_at(@fixture, SEASON_END, array![player(1), player(2)]);
    fixture.ledger.challenge_season(1, player(0));
    assert!(fixture.ledger.get_season(1).challenged);
    post_top_at(@fixture, SEASON_END + 3599, array![player(0), player(1)]);
    let corrected = fixture.ledger.get_season(1);
    assert!(!corrected.challenged);
    assert!(corrected.review_until == SEASON_END + 3599 + 3600);
    claim_season_at(@fixture, corrected.review_until, player(0));
}

#[test]
#[should_panic(expected: "Ledger: season challenged")]
fn challenged_list_blocks_payout_even_after_the_hour() {
    let fixture = completed_season();
    post_top_at(@fixture, SEASON_END, array![player(1), player(2)]);
    fixture.ledger.challenge_season(1, player(0));
    claim_season_at(@fixture, SEASON_END + 3600, player(1));
}

#[test]
#[should_panic(expected: "Ledger: incomplete top list")]
fn short_list_is_rejected_at_post() {
    let fixture = completed_season();
    post_top_at(@fixture, SEASON_END, array![player(0)]);
}

#[test]
#[should_panic(expected: "Ledger: incomplete top list")]
fn empty_list_is_rejected_at_post() {
    let fixture = completed_season();
    post_top_at(@fixture, SEASON_END, array![]);
}

#[test]
#[should_panic(expected: "Ledger: incomplete top list")]
fn overlong_list_is_rejected_at_post() {
    let fixture = completed_season();
    post_top_at(@fixture, SEASON_END, array![player(0), player(1), player(2)]);
}

#[test]
#[should_panic(expected: "Ledger: does not beat cutoff")]
fn worse_omitted_player_cannot_block_a_correct_list() {
    let fixture = completed_season();
    post_top_at(@fixture, SEASON_END, array![player(0), player(1)]);
    fixture.ledger.challenge_season(1, player(5));
}

#[test]
#[should_panic(expected: "Ledger: review closed")]
fn challenge_refuses_at_the_exact_hour_boundary() {
    let fixture = completed_season();
    post_top_at(@fixture, SEASON_END, array![player(1), player(2)]);
    start_cheat_block_timestamp(fixture.ledger_address, SEASON_END + 3600);
    fixture.ledger.challenge_season(1, player(0));
}

#[test]
#[should_panic(expected: "Ledger: unordered winners")]
fn top_list_rejects_duplicate_winners() {
    let fixture = completed_season();
    post_top_at(@fixture, SEASON_END, array![player(0), player(0)]);
}

#[test]
#[should_panic(expected: "Ledger: unordered winners")]
fn top_list_rejects_ratings_in_the_wrong_order() {
    let fixture = completed_season();
    post_top_at(@fixture, SEASON_END, array![player(1), player(0)]);
}

#[test]
#[should_panic(expected: "Ledger: not a season participant")]
fn outsider_cannot_challenge() {
    let fixture = completed_season();
    post_top_at(@fixture, SEASON_END, array![player(0), player(1)]);
    fixture.ledger.challenge_season(1, player(99));
}

#[test]
#[should_panic(expected: "Ledger: season has not ended")]
fn operator_cannot_post_top_before_freeze() {
    let fixture = completed_season();
    post_top_at(@fixture, SEASON_END - 1, array![player(0), player(1)]);
}

#[test]
#[should_panic(expected: "Ledger: top list final")]
fn operator_cannot_restart_a_finished_review_to_delay_claims() {
    let fixture = completed_season();
    post_top_at(@fixture, SEASON_END, array![player(0), player(1)]);
    post_top_at(@fixture, SEASON_END + 3600, array![player(0), player(1)]);
}

#[test]
#[should_panic(expected: 'Pausable: paused')]
fn monitor_pause_stops_season_payouts() {
    let fixture = completed_season();
    post_top_at(@fixture, SEASON_END, array![player(0), player(1)]);
    grant_pauser(@fixture);
    fixture.ledger.pause();
    claim_season_at(@fixture, SEASON_END + 3600, player(0));
}

#[test]
fn tied_mmr_uses_wallet_order_so_a_cutoff_tie_is_challengeable() {
    let mut preset = default_preset();
    preset.mmr.enabled = false;
    let fixture = deploy_fixture(preset);
    register_players(@fixture, 6);
    apply_results(@fixture, ranked_players(6));
    post_top_at(@fixture, SEASON_END, array![player(1), player(2)]);
    fixture.ledger.challenge_season(1, player(0));
    assert!(fixture.ledger.get_season(1).challenged);
}

#[test]
fn multiple_games_count_a_participant_once_and_accumulate_one_pool() {
    let fixture = completed_season();
    let next = SlotKey { shard: 'other', slot_id: 8 };
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.open_slot(next, 1, PRESET_ID, START, END);
    for index in 0..6_u16 {
        fund_and_approve_player(@fixture, player(index), 500);

        start_cheat_caller_address(fixture.ledger_address, player(index));
        fixture.ledger.register(next, false, false);
    }
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    start_cheat_block_timestamp(fixture.ledger_address, START);
    fixture.ledger.apply_results(next, 8, ranked_players(6));
    assert!(fixture.ledger.get_season(1).participant_count == 6);
    assert!(fixture.ledger.get_season(1).pool == 6000);
}


#[test]
#[should_panic(expected: "Ledger: slot outside season")]
fn a_game_cannot_end_at_the_instant_its_result_ratings_freeze() {
    let fixture = deploy_fixture(default_preset());
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.open_slot(SlotKey { shard: 'shard', slot_id: 99 }, 1, PRESET_ID, START, SEASON_END);
}

#[test]
fn frontier_season_chests_and_unfinished_game_custody_are_conserved_together() {
    let fixture = deploy_reward_fixture(5, 2000, 1);
    fund_and_approve_player(@fixture, ADMIN(), 1000);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.fund_frontier('shard', 1, PRESET_ID, START, END, 0x5eed, 1000);
    let unfinished = SlotKey { shard: 'other', slot_id: 8 };
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.open_slot(unfinished, 1, PRESET_ID, START, END);
    fund_and_approve_player(@fixture, player(2), 500);

    start_cheat_caller_address(fixture.ledger_address, player(2));
    fixture.ledger.register(unfinished, false, false);
    register_players(@fixture, 2);
    apply_results(@fixture, ranked_players(2));
    assert!(fixture.lords.balance_of(fixture.ledger_address) == 2500);
    start_cheat_block_timestamp(fixture.ledger_address, END);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.report_withdrawal('shard', 1, 'withdrawal', 1000, 0, 0);
    fixture.ledger.pay('shard', 1, 'withdrawal', player(0), 1000);
    open_reward(@fixture, player(0), 1);
    assert!(fixture.ledger.get_season(1).pool == 800);
    assert!(fixture.ledger.get_slot(unfinished).pool == 500);
    post_top_at(@fixture, SEASON_END, array![player(0)]);
    claim_season_at(@fixture, SEASON_END + 3600, player(0));
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.abort_slot(unfinished);
    start_cheat_caller_address(fixture.ledger_address, player(2));
    fixture.ledger.refund(unfinished);
    assert!(fixture.lords.balance_of(player(0)) == 2000);
    assert!(fixture.lords.balance_of(player(2)) == 500);
    assert!(fixture.lords.balance_of(fixture.ledger_address) == 0);
}

#[test]
#[should_panic(expected: 'ERC721: unauthorized caller')]
fn a_chest_open_requires_the_owners_burn_approval() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 1);
    apply_results(@fixture, ranked_players(1));
    start_cheat_caller_address(fixture.ledger_address, player(0));
    fixture.ledger.open_request(1);
}

#[test]
fn treasury_cut_is_taken_once_from_entries_and_flags() {
    let mut preset = default_preset();
    preset.protocol_cut_bps = 2000;
    let fixture = deploy_fixture(preset);
    let owner = player(0);
    fund_and_approve_player(@fixture, owner, 2500);

    start_cheat_caller_address(fixture.ledger_address, owner);
    fixture.ledger.register(SLOT_KEY, true, true);

    stop_cheat_caller_address(fixture.ledger_address);
    apply_results(@fixture, ranked_players(1));
    assert!(fixture.lords.balance_of(TREASURY()) == 300);
    assert!(fixture.ledger.get_season(1).pool == 1200);
    assert!(fixture.lords.balance_of(fixture.ledger_address) == 1200);
}

#[test]
#[should_panic(expected: "Ledger: invalid protocol cut")]
fn rejects_treasury_cut_above_the_whole_pot() {
    let mut preset = default_preset();
    preset.protocol_cut_bps = 10001;
    deploy_fixture(preset);
}

#[test]
fn twenty_four_players_mint_exactly_five_percentile_kinds() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 24);
    apply_results(@fixture, ranked_players(24));
    let expected = array![5_u32, 5, 4, 5, 5];
    let mut counts = array![0_u32, 0, 0, 0, 0];
    // Token metadata exposes only the band; every chest points to the same season.
    for index in 0_u16..24 {
        let chest = fixture.ledger.get_chest((index + 1).into());
        assert!(chest.season_id == 1 && !chest.requested && !chest.finished);
        let metadata = IRealmsCollectibleMetadataDispatcher { contract_address: fixture.chest_address }
            .get_metadata_raw((index + 1).into());
        assert!(metadata == 0x301 + chest.band.into());
        let old = *counts.at(chest.band.into());
        let mut updated = array![];
        for band in 0_u32..5 {
            updated.append(if band == chest.band.into() {
                old + 1
            } else {
                *counts.at(band)
            });
        }
        counts = updated;
    }
    assert!(counts == expected);
}

#[test]
fn tied_players_receive_the_same_middle_band_used_by_mmr() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 6);
    let mut rows = array![];
    for index in 0_u16..6 {
        rows.append(row(player(index), 1));
    }
    apply_results(@fixture, rows);
    for index in 0_u16..6 {
        assert!(fixture.ledger.get_chest((index + 1).into()).band == 2);
    }
}

#[test]
fn all_eight_outcomes_use_the_immutable_band_presets() {
    for outcome in 0_u8..8 {
        let fixture = deploy_reward_fixture(outcome, 10000, 1);
        register_players(@fixture, 1);
        apply_results(@fixture, ranked_players(1));
        open_reward(@fixture, player(0), 1);
        if outcome < 5 {
            let items = test_items();
            assert!(
                IRealmsCollectibleMetadataDispatcher { contract_address: fixture.cosmetics_address }
                    .get_metadata_raw(1) == *items
                    .at(outcome.into())
                    .at(0),
            );
        } else if outcome == 5 {
            assert!(fixture.lords.balance_of(player(0)) == 500);
            assert!(fixture.ledger.get_season(1).chest_reserve == 0);
        } else if outcome == 6 {
            assert!(fixture.ledger.get_credits(player(0)).swords == 1);
        } else {
            assert!(fixture.ledger.get_credits(player(0)).shields == 1);
        }
    }
}

#[test]
fn posting_the_first_top_list_sweeps_reserve_and_late_chests_still_finish() {
    let fixture = deploy_reward_fixture(5, 2000, 1);
    register_players(@fixture, 2);
    apply_results(@fixture, ranked_players(2));
    request_reward(@fixture, player(0), 1);
    assert!(fixture.ledger.get_season(1).pool == 800);
    post_top_at(@fixture, SEASON_END, array![player(0)]);
    assert!(fixture.ledger.get_season(1).pool == 1000);
    assert!(fixture.ledger.get_season(1).chest_reserve == 0);
    let (_, allocation) = fixture.ledger.get_season_winner(1, 0);
    assert!(allocation == 1000);
    finish_reward(@fixture, 1, 999999);
    assert!(fixture.ledger.get_chest(1).finished);
    assert!(fixture.lords.balance_of(player(0)) == 0);
    claim_season_at(@fixture, SEASON_END + 3600, player(0));
    assert!(fixture.lords.balance_of(player(0)) == 1000);
    // A still-unrequested token remains openable, with zero available LORDS after the sweep.
    open_reward(@fixture, player(1), 2);
    assert!(fixture.ledger.get_chest(2).finished);
    assert!(fixture.lords.balance_of(fixture.ledger_address) == 0);
}

#[test]
#[should_panic(expected: "Ledger: not chest owner")]
fn non_owner_cannot_consume_a_tradable_chest() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 1);
    apply_results(@fixture, ranked_players(1));
    start_cheat_caller_address(fixture.ledger_address, player(1));
    fixture.ledger.open_request(1);
}

#[test]
#[should_panic(expected: "Ledger: slot preset differs from season")]
fn a_season_cannot_mix_chest_presets() {
    let fixture = deploy_fixture(default_preset());
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.register_preset(2, default_preset(), test_bands(), test_items());
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.open_slot(SlotKey { shard: 'shard', slot_id: 8 }, 1, 2, START, END);
}


#[test]
#[should_panic(expected: "Ledger: invalid chest odds")]
fn odds_must_fill_the_whole_draw_space() {
    let fixture = deploy_ledger();
    let mut bands = test_bands();
    let mut bad = bands.pop_front().unwrap();
    bad.odds.sword = 9999;
    bands.append(bad);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.register_preset(1, default_preset(), bands, test_items());
}

#[test]
#[should_panic(expected: "Ledger: preset already registered")]
fn opening_presets_cannot_change_after_registration() {
    let fixture = deploy_fixture(default_preset());
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.register_preset(PRESET_ID, default_preset(), test_bands(), test_items());
}

#[test]
#[should_panic(expected: "Ledger: unordered cosmetic items")]
fn rarity_inventory_cannot_repeat_an_item_to_weight_its_odds() {
    let fixture = deploy_ledger();
    let items = array![array![1, 1], array![2], array![3], array![4], array![5]];
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.register_preset(1, default_preset(), test_bands(), items);
}

#[test]
fn golden_draw_uses_only_the_fixed_future_hash_and_chest_identity() {
    let odds = ChestOdds {
        common: 2000, uncommon: 2000, rare: 2000, epic: 1500, legendary: 1000, lords: 1000, sword: 250, shield: 250,
    };
    // Independent SDK vector: outcome roll 2504, and item index 1 out of three.
    assert!(game_ledger::chests::draw_outcome(odds, 'future block hash', 1, 1) == 1);
    assert!(game_ledger::chests::draw_item_index('future block hash', 1, 1, 3) == 1);
}

#[test]
fn unfinished_cosmetic_requests_remain_finishable_after_season_settlement() {
    let fixture = deploy_reward_fixture(0, 2000, 1);
    register_players(@fixture, 1);
    apply_results(@fixture, ranked_players(1));
    request_reward(@fixture, player(0), 1);
    post_top_at(@fixture, SEASON_END, array![player(0)]);
    claim_season_at(@fixture, SEASON_END + 3600, player(0));
    finish_reward(@fixture, 1, 999999);
    assert!(IERC721Dispatcher { contract_address: fixture.cosmetics_address }.owner_of(1) == player(0));
    assert!(fixture.lords.balance_of(player(0)) == 500);
}

#[test]
fn a_cosmetic_rarity_selects_from_all_its_items_using_an_independent_hash() {
    let fixture = deploy_ledger();
    let mut bands = array![];
    for band in 0_u32..5 {
        bands.append(ChestBandPreset { metadata: 0x301 + band.into(), odds: odds_for(0), lords_shares: 0 });
    }
    let items = array![array![1, 2, 3], array![4], array![5], array![6], array![7]];
    configure_collection_metadata(fixture.cosmetics_address, array![1, 2, 3, 4, 5, 6, 7]);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.register_preset(PRESET_ID, default_preset(), bands, items);
    assert!(fixture.ledger.get_cosmetic_items(PRESET_ID, 0) == array![1_u128, 2, 3]);
    fixture.ledger.open_season(1, PRESET_ID, START, SEASON_END);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.open_slot(SLOT_KEY, 1, PRESET_ID, START, END);
    stop_cheat_caller_address(fixture.ledger_address);
    register_players(@fixture, 1);
    apply_results(@fixture, ranked_players(1));
    open_reward(@fixture, player(0), 1);
    assert!(
        IRealmsCollectibleMetadataDispatcher { contract_address: fixture.cosmetics_address }.get_metadata_raw(1) == 2,
    );
}

#[test]
#[should_panic(expected: "Ledger: draw block unavailable")]
fn a_missing_historical_hash_cannot_be_used_as_entropy() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 1);
    apply_results(@fixture, ranked_players(1));
    request_reward(@fixture, player(0), 1);
    start_cheat_block_number(fixture.ledger_address, 111);
    start_cheat_block_hash(fixture.ledger_address, 101, 0);
    fixture.ledger.open_finish(1);
}

#[test]
fn claim_window_preserves_payments_through_its_last_second() {
    let fixture = funded_frontier();
    let deadline = END + default_preset().claim_window_seconds.into();
    assert!(fixture.ledger.frontier_claim_deadline('shard', 1) == deadline);
    start_cheat_block_timestamp(fixture.ledger_address, deadline - 1);
    fixture.ledger.report_withdrawal('shard', 1, 'last', 400, 0, 0);
    fixture.ledger.pay('shard', 1, 'last', player(0), 400);
    start_cheat_block_timestamp(fixture.ledger_address, deadline);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.close_frontier('shard', 1);
    assert!(fixture.ledger.frontier_carry('shard') == 600);
    assert!(fixture.lords.balance_of(TREASURY()) == 0);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.pay('shard', 1, 'last', player(0), 400);
    assert!(fixture.lords.balance_of(player(0)) == 400);
}

#[test]
#[should_panic(expected: "Ledger: claim window open")]
fn close_refuses_the_last_second_of_the_claim_window() {
    let fixture = funded_frontier();
    start_cheat_block_timestamp(fixture.ledger_address, END + default_preset().claim_window_seconds.into() - 1);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.close_frontier('shard', 1);
}

#[test]
#[should_panic(expected: "Ledger: claim window open")]
fn ending_the_season_does_not_close_the_claim_window() {
    let fixture = funded_frontier();
    start_cheat_block_timestamp(fixture.ledger_address, END);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.close_frontier('shard', 1);
}

#[test]
fn a_reported_receipt_can_be_paid_after_the_window_until_admin_closes() {
    let fixture = funded_frontier();
    fixture.ledger.report_withdrawal('shard', 1, 'delayed', 400, 0, 0);
    start_cheat_block_timestamp(fixture.ledger_address, END + default_preset().claim_window_seconds.into() + 1);
    fixture.ledger.pay('shard', 1, 'delayed', player(0), 400);
    assert!(fixture.lords.balance_of(player(0)) == 400);
}

#[test]
#[should_panic(expected: "Ledger: claim window needs reporting grace")]
fn a_frontier_calendar_requires_more_than_the_reporting_hour() {
    deploy_fixture(Preset { claim_window_seconds: crate::days::FRONTIER_REPORT_GRACE_SECONDS, ..default_preset() });
}

#[test]
fn claim_window_is_an_immutable_preset_not_a_constant() {
    let fixture = deploy_fixture(Preset { claim_window_seconds: 3617, ..default_preset() });
    fund_and_approve_player(@fixture, ADMIN(), 1000);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.fund_frontier('shard', 1, PRESET_ID, START, END, 0x5eed, 1000);
    assert!(fixture.ledger.frontier_claim_deadline('shard', 1) == END + 3617);
    start_cheat_block_timestamp(fixture.ledger_address, END + 3617);
    fixture.ledger.close_frontier('shard', 1);
}

#[test]
#[should_panic(expected: "Ledger: claim deadline exceeds u64")]
fn frontier_claim_deadline_cannot_overflow() {
    let fixture = funded_frontier();
    fund_and_approve_player(@fixture, ADMIN(), 1000);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.fund_frontier('other', 1, PRESET_ID, 0xffffffffffffffff - 100, 0xffffffffffffffff, 0x5eed, 1000);
}

#[test]
#[should_panic(expected: "Ledger: registration index out of bounds")]
fn roster_read_refuses_an_unseated_index() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 1);
    fixture.ledger.get_registrations(SLOT_KEY, 2, 1);
}

#[test]
fn asset_views_return_this_deployments_tokens_to_any_reader_even_when_paused() {
    let fixture = deploy_ledger();
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.pause();
    start_cheat_caller_address(fixture.ledger_address, player(42));
    assert!(fixture.ledger.lords() == fixture.lords_address);
    assert!(fixture.ledger.chest_collection() == fixture.chest_address);
    assert!(fixture.ledger.chest_collection() != fixture.cosmetics_address);
}

#[test]
fn reported_withdrawals_keep_the_same_receipt_on_exact_retries() {
    let fixture = funded_frontier();
    fixture.ledger.report_withdrawal('shard', 1, 'pending', 400, 0, 0);
    fixture.ledger.report_withdrawal('shard', 1, 'pending', 400, 0, 0);
    let report = fixture.ledger.get_payment('shard', 'pending');
    assert!(!report.paid && report.amount == 400 && report.wallet.is_zero());
    start_cheat_block_timestamp(fixture.ledger_address, END + default_preset().claim_window_seconds.into());
    fixture.ledger.pay('shard', 1, 'pending', player(0), 400);
    fixture.ledger.report_withdrawal('shard', 1, 'pending', 400, 0, 0);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.close_frontier('shard', 1);
    assert!(fixture.ledger.frontier_carry('shard') == 600);
    assert!(fixture.lords.balance_of(TREASURY()) == 0);
}

#[test]
fn close_voids_unpaid_reports_and_returns_their_backing() {
    let fixture = funded_frontier();
    fixture.ledger.report_withdrawal('shard', 1, 'pending', 400, 0, 0);
    start_cheat_block_timestamp(fixture.ledger_address, END + default_preset().claim_window_seconds.into());
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.close_frontier('shard', 1);
    assert!(fixture.ledger.frontier_carry('shard') == 1000);
    assert!(fixture.lords.balance_of(TREASURY()) == 0);
    assert!((fixture.ledger.get_frontier('shard', 1).closed && !fixture.ledger.get_payment('shard', 'pending').paid));
}

#[test]
fn a_pending_debt_has_no_recipient_until_payment() {
    let fixture = funded_frontier();
    fixture.ledger.report_withdrawal('shard', 1, 'pending', 400, 0, 0);
    assert!(fixture.ledger.get_payment('shard', 'pending').wallet.is_zero());
    start_cheat_block_timestamp(fixture.ledger_address, END);
    fixture.ledger.pay('shard', 1, 'pending', player(1), 400);
    let paid = fixture.ledger.get_payment('shard', 'pending');
    assert!(paid.paid && paid.wallet == player(1) && paid.amount == 400);
    assert!(fixture.lords.balance_of(player(0)) == 0);
    assert!(fixture.lords.balance_of(player(1)) == 400);
}

#[test]
#[feature("safe_dispatcher")]
fn a_failed_payment_preserves_the_reported_receipt() {
    let fixture = funded_frontier();
    fixture.ledger.report_withdrawal('shard', 1, 'pending', 1000, 0, 0);
    start_cheat_block_timestamp(fixture.ledger_address, START - 1);
    let safe = IGameLedgerSafeDispatcher { contract_address: fixture.ledger_address };
    assert!(safe.pay('shard', 1, 'pending', player(0), 1000).is_err());
    assert!(!fixture.ledger.get_payment('shard', 'pending').paid);
}

#[test]
#[should_panic(expected: "Ledger: claim window ended")]
fn a_first_debt_report_at_the_deadline_is_refused() {
    let fixture = funded_frontier();
    start_cheat_block_timestamp(fixture.ledger_address, END + default_preset().claim_window_seconds.into());
    fixture.ledger.report_withdrawal('shard', 1, 'late', 1, 0, 0);
}

#[test]
#[should_panic(expected: "Ledger: withdrawal unreported")]
fn payment_cannot_bypass_reporting_the_debt() {
    let fixture = funded_frontier();
    start_cheat_block_timestamp(fixture.ledger_address, START);
    fixture.ledger.pay('shard', 1, 'missing', player(0), 1);
}

#[test]
#[feature("safe_dispatcher")]
fn reported_amount_and_paid_recipient_are_immutable() {
    let fixture = funded_frontier();
    fixture.ledger.report_withdrawal('shard', 1, 'claim', 40, 0, 0);
    let safe = IGameLedgerSafeDispatcher { contract_address: fixture.ledger_address };
    assert!(safe.report_withdrawal('shard', 1, 'claim', 41, 0, 0).is_err());
    assert!(safe.pay('shard', 1, 'claim', player(1), 41).is_err());
    start_cheat_block_timestamp(fixture.ledger_address, START);
    fixture.ledger.pay('shard', 1, 'claim', player(1), 40);
    assert!(safe.report_withdrawal('shard', 999, 'claim', 40, 0, 0).is_err());
    fixture.ledger.pay('shard', 1, 'claim', player(0), 999);
    let paid = fixture.ledger.get_payment('shard', 'claim');
    assert!(paid.paid && paid.season_id == 1 && paid.wallet == player(1) && paid.amount == 40);
    assert!(fixture.lords.balance_of(player(1)) == 40 && fixture.lords.balance_of(player(0)) == 0);
}

#[test]
#[feature("safe_dispatcher")]
fn reports_do_not_reserve_money_and_cannot_block_closing_the_pool() {
    let fixture = funded_frontier();
    let safe = IGameLedgerSafeDispatcher { contract_address: fixture.ledger_address };
    fixture.ledger.report_withdrawal('shard', 1, 'oversized', 1001, 0, 0);
    fixture.ledger.report_withdrawal('shard', 1, 'first', 600, 0, 0);
    fixture.ledger.report_withdrawal('shard', 1, 'second', 400, 0, 0);
    start_cheat_block_timestamp(fixture.ledger_address, END);
    assert!(safe.pay('shard', 1, 'oversized', player(0), 1001).is_err());
    fixture.ledger.pay('shard', 1, 'first', player(0), 600);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.pause();
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.report_withdrawal('shard', 1, 'paused_report', 1001, 0, 0);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.unpause();
    start_cheat_block_timestamp(fixture.ledger_address, fixture.ledger.frontier_claim_deadline('shard', 1));
    fixture.ledger.close_frontier('shard', 1);
    assert!(fixture.ledger.frontier_carry('shard') == 400);
    assert!(fixture.lords.balance_of(TREASURY()) == 0);
    assert!((fixture.ledger.get_frontier('shard', 1).closed && !fixture.ledger.get_payment('shard', 'second').paid));
    assert!((fixture.ledger.get_frontier('shard', 1).closed && !fixture.ledger.get_payment('shard', 'oversized').paid));
    assert!(
        (fixture.ledger.get_frontier('shard', 1).closed && !fixture.ledger.get_payment('shard', 'paused_report').paid),
    );
    assert!(!(fixture.ledger.get_frontier('shard', 1).closed && !fixture.ledger.get_payment('shard', 'first').paid));
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    assert!(safe.pay('shard', 1, 'second', player(1), 400).is_err());
    fixture.ledger.pay('shard', 1, 'first', player(1), 600);
    assert!(fixture.lords.balance_of(player(0)) == 600);
    assert!(fixture.lords.balance_of(player(1)) == 0);
}


#[test]
fn reporting_grace_accepts_confirmed_receipts_after_the_shards_withdrawal_cutoff() {
    let fixture = funded_frontier();
    let deadline = fixture.ledger.frontier_claim_deadline('shard', 1);
    // The shard stops new withdrawals 3600 seconds earlier; delayed receipts can still report here.
    start_cheat_block_timestamp(fixture.ledger_address, deadline - 3600);
    fixture.ledger.report_withdrawal('shard', 1, 'grace_start', 100, 0, 0);
    start_cheat_block_timestamp(fixture.ledger_address, deadline - 1);
    fixture.ledger.report_withdrawal('shard', 1, 'grace_last', 100, 0, 0);
    assert!(fixture.ledger.get_payment('shard', 'grace_last').amount == 100);
}


#[test]
#[should_panic(expected: "Ledger: duplicate result owner")]
fn results_reject_duplicate_wallets() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 2);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    start_cheat_block_timestamp(fixture.ledger_address, START);
    fixture
        .ledger
        .apply_results(
            SLOT_KEY,
            GAME_KEY.game_id,
            array![RankedPlayer { wallet: player(0), rank: 1 }, RankedPlayer { wallet: player(0), rank: 2 }],
        );
}


#[test]
#[feature("safe_dispatcher")]
fn season_claim_checks_the_named_position_before_paying() {
    let fixture = completed_season();
    post_top_at(@fixture, SEASON_END, array![player(0), player(1)]);
    start_cheat_block_timestamp(fixture.ledger_address, SEASON_END + 3600);
    start_cheat_caller_address(fixture.ledger_address, player(1));
    let safe = IGameLedgerSafeDispatcher { contract_address: fixture.ledger_address };
    assert!(safe.claim_season(1, 0).is_err());
    assert!(safe.claim_season(1, 2).is_err());
    assert!(!fixture.ledger.season_claimed(1, player(1)));
    fixture.ledger.claim_season(1, 1);
    let paid = fixture.lords.balance_of(player(1));
    assert!(paid > 0);
    fixture.ledger.claim_season(1, 1);
    assert!(fixture.lords.balance_of(player(1)) == paid);
}

#[test]
fn season_post_at_two_thousand_participants_allocates_in_one_call() {
    // Seed the frozen season facts directly so the measurement excludes 2,000 registrations and results.
    let fixture = deploy_fixture(default_preset());
    let mut season = fixture.ledger.get_season(1);
    season.participant_count = 2000;
    season.pool = 1_000_000;
    let mut serialized = array![];
    season.serialize(ref serialized);
    snforge_std::store(
        fixture.ledger_address,
        snforge_std::map_entry_address(selector!("seasons"), array![1].span()),
        serialized.span(),
    );
    for index in 0_u16..2000 {
        let keys = array![1, player(index).into()];
        snforge_std::store(
            fixture.ledger_address,
            snforge_std::map_entry_address(selector!("season_participants"), keys.span()),
            array![1].span(),
        );
        snforge_std::store(
            fixture.ledger_address,
            snforge_std::map_entry_address(selector!("season_mmrs"), keys.span()),
            array![1500].span(),
        );
    }
    let mut winners = array![];
    for index in 0_u16..400 {
        winners.append(player(index));
    }
    post_top_at(@fixture, SEASON_END, winners);
    let posted = fixture.ledger.get_season(1);
    assert!(posted.posted && posted.top_count == 400 && posted.review_until == SEASON_END + 3600);
    let mut total = 0;
    for index in 0_u32..400 {
        let (owner, amount) = fixture.ledger.get_season_winner(1, index);
        assert!(owner == player(index.try_into().unwrap()));
        total += amount;
    }
    assert!(total == season.pool);
}

#[test]
fn one_slot_accepts_more_than_one_game_and_preserves_payment_ownership() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 27);
    assert!(fixture.ledger.get_slot(SLOT_KEY).registered_count == 27);
    assert!(fixture.ledger.get_slot(SLOT_KEY).pool == 13500);
    for index in 0_u16..27 {
        let (wallet, _) = *fixture.ledger.get_registrations(SLOT_KEY, index.into(), 1).at(0);
        assert!(wallet == player(index));
    }
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    start_cheat_block_timestamp(fixture.ledger_address, START);
    let mut events = spy_events();
    fixture.ledger.mark_refundable(SLOT_KEY, array![player(26)]);
    assert!(events.get_events().events.len() == 1);
    fixture.ledger.mark_refundable(SLOT_KEY, array![player(26)]);
    assert!(events.get_events().events.len() == 1);
    fixture.ledger.apply_results(SLOT_KEY, 7, ranked_players(24));
    fixture.ledger.apply_results(SLOT_KEY, 8, array![row(player(24), 1), row(player(25), 2)]);
    assert!(fixture.ledger.get_slot(SLOT_KEY).pool == 500);
    assert!(fixture.ledger.get_season(1).pool == 13000);
    assert!(fixture.ledger.get_registration(SLOT_KEY, player(24)).game_id == 8);
    assert!(fixture.ledger.get_result_commitment(GameKey { shard: 'shard', game_id: 8 }) != 0);
    start_cheat_caller_address(fixture.ledger_address, player(26));
    fixture.ledger.refund(SLOT_KEY);
    assert!(fixture.lords.balance_of(player(26)) == 500);
    assert!(fixture.ledger.get_slot(SLOT_KEY).pool == 0);
}

#[test]
#[feature("safe_dispatcher")]
fn unseated_refund_is_exact_once_and_remains_available_while_paused() {
    let fixture = deploy_fixture(default_preset());
    fund_and_approve_player(@fixture, player(0), 1500);
    start_cheat_caller_address(fixture.ledger_address, player(0));
    fixture.ledger.register(SLOT_KEY, true, true);
    start_cheat_block_timestamp(fixture.ledger_address, START);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.mark_refundable(SLOT_KEY, array![player(0)]);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.pause();
    start_cheat_caller_address(fixture.ledger_address, player(0));
    fixture.ledger.refund(SLOT_KEY);
    assert!(fixture.lords.balance_of(player(0)) == 1500);
    assert!(fixture.ledger.get_slot(SLOT_KEY).pool == 0);
    let safe = IGameLedgerSafeDispatcher { contract_address: fixture.ledger_address };
    assert!(safe.refund(SLOT_KEY).is_err());
    assert!(fixture.lords.balance_of(player(0)) == 1500);
}

#[test]
#[should_panic(expected: "Ledger: registration already settled")]
fn settled_registration_cannot_be_marked_refundable() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 2);
    apply_results(@fixture, ranked_players(1));
    start_cheat_block_timestamp(fixture.ledger_address, START);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.mark_refundable(SLOT_KEY, array![player(0)]);
}

#[test]
#[should_panic(expected: "Ledger: registration refundable")]
fn marked_registration_cannot_enter_a_result() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 1);
    start_cheat_block_timestamp(fixture.ledger_address, START);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.mark_refundable(SLOT_KEY, array![player(0)]);
    fixture.ledger.apply_results(SLOT_KEY, 7, ranked_players(1));
}

#[test]
#[should_panic(expected: "Ledger: registration already settled")]
fn two_games_cannot_consume_the_same_registration() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 1);
    apply_results(@fixture, ranked_players(1));
    start_cheat_block_timestamp(fixture.ledger_address, START);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.apply_results(SLOT_KEY, 8, ranked_players(1));
}

#[test]
#[feature("safe_dispatcher")]
fn slot_open_requires_more_than_ten_minutes_before_season_end() {
    let fixture = deploy_fixture(default_preset());
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    let safe = IGameLedgerSafeDispatcher { contract_address: fixture.ledger_address };
    let key = SlotKey { shard: 'shard', slot_id: 99 };
    assert!(safe.open_slot(key, 1, PRESET_ID, START, SEASON_END - 600).is_err());
    fixture.ledger.open_slot(key, 1, PRESET_ID, START, SEASON_END - 601);
    assert!(fixture.ledger.get_slot(key).end == SEASON_END - 601);
}

#[test]
#[should_panic(expected: "Ledger: results already applied")]
fn different_slots_cannot_settle_the_same_shard_game() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 1);
    let other = SlotKey { shard: 'shard', slot_id: 99 };
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.open_slot(other, 1, PRESET_ID, START, END);
    fund_and_approve_player(@fixture, player(1), 500);
    start_cheat_caller_address(fixture.ledger_address, player(1));
    fixture.ledger.register(other, false, false);
    apply_results(@fixture, ranked_players(1));
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    start_cheat_block_timestamp(fixture.ledger_address, START);
    fixture.ledger.apply_results(other, GAME_KEY.game_id, array![row(player(1), 1)]);
}

#[test]
#[should_panic(expected: "Ledger: slot still open")]
fn individual_refunds_cannot_be_marked_before_the_slot_closes() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 1);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.mark_refundable(SLOT_KEY, array![player(0)]);
}

#[test]
#[should_panic]
fn only_the_operator_can_mark_individual_refunds() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 1);
    start_cheat_caller_address(fixture.ledger_address, player(0));
    start_cheat_block_timestamp(fixture.ledger_address, START);
    fixture.ledger.mark_refundable(SLOT_KEY, array![player(0)]);
}

#[test]
fn an_unknown_slot_reads_as_absent_without_creating_it() {
    let fixture = deploy_fixture(default_preset());
    let key = SlotKey { shard: 'shard', slot_id: 99 };
    let missing = fixture.ledger.get_slot(key);
    assert!(!missing.exists);
    let mut values = array![];
    missing.serialize(ref values);
    assert!(values.span() == array![0, 0, 0, 0, 0, 0, 0, 0, 0].span());
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.open_slot(key, 1, PRESET_ID, START, END);
    let opened = fixture.ledger.get_slot(key);
    assert!(opened.exists && opened.season_id == 1 && opened.preset_id == PRESET_ID);
    assert!(opened.close == START && opened.end == END && opened.registered_count == 0);
}

#[test]
#[feature("safe_dispatcher")]
fn absent_slot_reads_do_not_allow_mutations_on_unknown_slots() {
    let fixture = deploy_fixture(default_preset());
    let key = SlotKey { shard: 'shard', slot_id: 99 };
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    let safe = IGameLedgerSafeDispatcher { contract_address: fixture.ledger_address };
    assert!(safe.register(key, false, false).is_err());
    assert!(safe.cancel_slot(key).is_err());
    assert!(safe.abort_slot(key).is_err());
    assert!(safe.refund(key).is_err());
    assert!(safe.apply_results(key, 7, array![]).is_err());
    assert!(safe.mark_refundable(key, array![]).is_err());
    assert!(!fixture.ledger.get_slot(key).exists);
}

#[test]
#[feature("safe_dispatcher")]
fn funding_after_start_preserves_the_original_unlock_and_payment_limit() {
    let fixture = deploy_ledger();
    fund_and_approve_player(@fixture, ADMIN(), 1000);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.register_preset(PRESET_ID, default_preset(), test_bands(), test_items());
    start_cheat_block_timestamp(fixture.ledger_address, START + 4);
    fixture.ledger.fund_frontier('shard', 1, PRESET_ID, START, END, 0x5eed, 1000);
    let season = fixture.ledger.get_frontier('shard', 1);
    assert!(season.start == START && season.end == END && season.seed == 0x5eed);
    assert!(fixture.ledger.frontier_unlocked('shard', 1) == 100);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.report_withdrawal('shard', 1, 'elapsed', 100, 0, 0);
    fixture.ledger.pay('shard', 1, 'elapsed', player(0), 100);
    fixture.ledger.report_withdrawal('shard', 1, 'future', 1, 0, 0);
    let safe = IGameLedgerSafeDispatcher { contract_address: fixture.ledger_address };
    assert!(safe.pay('shard', 1, 'future', player(0), 1).is_err());
    assert!(fixture.lords.balance_of(player(0)) == 100);
    assert!(fixture.ledger.get_frontier('shard', 1).paid == 100);
    start_cheat_block_timestamp(fixture.ledger_address, START + 10);
    fixture.ledger.pay('shard', 1, 'future', player(0), 1);
    assert!(fixture.lords.balance_of(player(0)) == 101);
}

#[test]
#[feature("safe_dispatcher")]
fn frontier_funding_stops_at_the_season_end() {
    let fixture = deploy_ledger();
    fund_and_approve_player(@fixture, ADMIN(), 1000);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.register_preset(PRESET_ID, default_preset(), test_bands(), test_items());
    let safe = IGameLedgerSafeDispatcher { contract_address: fixture.ledger_address };
    start_cheat_block_timestamp(fixture.ledger_address, END);
    assert!(safe.fund_frontier('shard', 1, PRESET_ID, START, END, 0x5eed, 1000).is_err());
    start_cheat_block_timestamp(fixture.ledger_address, END + 1);
    assert!(safe.fund_frontier('shard', 1, PRESET_ID, START, END, 0x5eed, 1000).is_err());
    start_cheat_block_timestamp(fixture.ledger_address, END - 1);
    fixture.ledger.fund_frontier('shard', 1, PRESET_ID, START, END, 0x5eed, 1000);
    assert!(fixture.ledger.frontier_unlocked('shard', 1) == 1000);
}

#[test]
#[feature("safe_dispatcher")]
fn registration_pages_keep_block_times_order_and_refunded_wallets() {
    let fixture = deploy_fixture(default_preset());
    for index in 0..125_u16 {
        fund_and_approve_player(@fixture, player(index), 500);
        start_cheat_caller_address(fixture.ledger_address, player(index));
        start_cheat_block_timestamp(fixture.ledger_address, (index / 2 + 1).into());
        fixture.ledger.register(SLOT_KEY, false, false);
    }
    let first = fixture.ledger.get_registrations(SLOT_KEY, 0, 100);
    let last = fixture.ledger.get_registrations(SLOT_KEY, 100, 100);
    assert!(first.len() == 100 && last.len() == 25);
    assert!(*first.at(0) == (player(0), 1));
    assert!(*last.at(0) == (player(100), 51));
    assert!(*last.at(24) == (player(124), 63));
    assert!(fixture.ledger.get_registration(SLOT_KEY, player(100)).registered_at == 51);
    assert!(fixture.ledger.get_registrations(SLOT_KEY, 125, 100).is_empty());
    let safe = IGameLedgerSafeDispatcher { contract_address: fixture.ledger_address };
    assert!(safe.get_registrations(SLOT_KEY, 126, 100).is_err());
    assert!(safe.get_registrations(SLOT_KEY, 0, 0).is_err());
    assert!(safe.get_registrations(SLOT_KEY, 0, 101).is_err());
    assert!(safe.get_registrations(SlotKey { slot_id: 999, ..SLOT_KEY }, 0, 100).is_err());
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.cancel_slot(SLOT_KEY);
    start_cheat_caller_address(fixture.ledger_address, player(100));
    fixture.ledger.refund(SLOT_KEY);
    assert!(fixture.ledger.get_registration(SLOT_KEY, player(100)).registered_at == 51);
    assert!(fixture.ledger.get_registrations(SLOT_KEY, 100, 100) == last);
}

#[test]
fn settlement_keeps_the_registration_timestamp() {
    let fixture = deploy_fixture(default_preset());
    fund_and_approve_player(@fixture, player(0), 500);
    start_cheat_caller_address(fixture.ledger_address, player(0));
    start_cheat_block_timestamp(fixture.ledger_address, 77);
    let key = SLOT_KEY;
    fixture.ledger.register(key, false, false);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    start_cheat_block_timestamp(fixture.ledger_address, START);
    fixture.ledger.apply_results(key, GAME_KEY.game_id, array![row(player(0), 1)]);
    assert!(fixture.ledger.get_registration(key, player(0)).registered_at == 77);
    assert!(*fixture.ledger.get_registrations(key, 0, 100).at(0) == (player(0), 77));
}

#[test]
fn ranked_season_pool_keeps_its_u128_capacity() {
    let entry_fee = 0x1000000000000000000000000;
    let fixture = deploy_fixture(Preset { entry_fee, ..default_preset() });
    fund_and_approve_player(@fixture, player(0), entry_fee);
    start_cheat_caller_address(fixture.ledger_address, player(0));
    fixture.ledger.register(SLOT_KEY, false, false);
    apply_results(@fixture, array![row(player(0), 1)]);
    assert!(fixture.ledger.get_season(1).pool == entry_fee);
}

fn assert_preview_applies(fixture: @Fixture, ranked: Array<RankedPlayer>) -> Array<i32> {
    let pool_before = fixture.ledger.get_slot(SLOT_KEY).pool;
    let mut repeated = array![];
    let mut settlement = array![];
    for row in ranked.span() {
        repeated.append(*row);
        settlement.append(*row);
    }
    let mut events = spy_events();
    let preview = fixture.ledger.preview_mmr(SLOT_KEY, ranked);
    let again = fixture.ledger.preview_mmr(SLOT_KEY, repeated);
    assert!(preview.len() == settlement.len());
    assert!(events.get_events().events.is_empty(), "preview emits nothing");
    assert!(fixture.ledger.get_slot(SLOT_KEY).pool == pool_before);
    assert!(fixture.ledger.get_result_commitment(GAME_KEY) == 0);
    assert!(fixture.ledger.get_season(1).participant_count == 0);
    for index in 0..preview.len() {
        let entry = *preview.at(index);
        assert!(entry == *again.at(index), "preview is repeatable");
        assert!(entry.wallet == *settlement.at(index).wallet);
        assert!(fixture.ledger.get_registration(SLOT_KEY, entry.wallet).game_id == 0);
        assert!(fixture.ledger.get_player_result(GAME_KEY, entry.wallet).rank == 0);
        assert!(fixture.mmr.get_player_mmr(entry.wallet) / 1_000_000_000_000_000_000 == entry.mmr_before.into());
    }
    apply_results(fixture, settlement);
    let mut deltas = array![];
    for entry in preview {
        let applied = fixture.ledger.get_player_result(GAME_KEY, entry.wallet);
        assert!(applied.mmr_before == entry.mmr_before && applied.mmr_after == entry.mmr_after);
        assert!(fixture.mmr.get_player_mmr(entry.wallet) / 1_000_000_000_000_000_000 == entry.mmr_after.into());
        if entry.delta >= 0 {
            assert!(applied.mmr_after - applied.mmr_before == entry.delta.try_into().unwrap());
        } else {
            assert!(applied.mmr_before - applied.mmr_after == (-entry.delta).try_into().unwrap());
        }
        deltas.append(entry.delta);
    }
    deltas
}

#[test]
fn preview_matches_even_tied_settlement() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 4);
    let deltas = assert_preview_applies(
        @fixture, array![row(player(0), 1), row(player(1), 2), row(player(2), 2), row(player(3), 4)],
    );
    assert!(deltas == array![26, 7, 7, -11]);
}

#[test]
fn preview_matches_odd_tied_settlement() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 3);
    let deltas = assert_preview_applies(@fixture, array![row(player(0), 1), row(player(1), 1), row(player(2), 3)]);
    assert!(deltas == array![16, 16, -9]);
}

#[test]
fn preview_matches_a_game_subset_with_unequal_live_ratings() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 6);
    fixture
        .mmr
        .update_mmr_batch(
            array![(player(1), 1_800_000_000_000_000_000_999), (player(3), 1_200_000_000_000_000_000_000)],
        );
    let deltas = assert_preview_applies(@fixture, array![row(player(1), 1), row(player(3), 2), row(player(5), 3)]);
    assert!(deltas.len() == 3);
    assert!(fixture.ledger.get_registration(SLOT_KEY, player(0)).game_id == 0);
}

#[test]
fn preview_includes_sword_and_shield_modifiers() {
    let fixture = deploy_fixture(default_preset());
    for index in 0_u16..4 {
        let owner = player(index);
        fund_and_approve_player(@fixture, owner, 1000);
        start_cheat_caller_address(fixture.ledger_address, owner);
        fixture.ledger.register(SLOT_KEY, index == 0, index != 0);
        stop_cheat_caller_address(fixture.ledger_address);
    }
    let deltas = assert_preview_applies(
        @fixture, array![row(player(0), 1), row(player(1), 2), row(player(2), 2), row(player(3), 4)],
    );
    assert!(deltas == array![52, 7, 7, -5]);
}

#[test]
fn preview_single_player_with_sword_is_unchanged() {
    let fixture = deploy_fixture(default_preset());
    fund_and_approve_player(@fixture, player(0), 1000);
    start_cheat_caller_address(fixture.ledger_address, player(0));
    fixture.ledger.register(SLOT_KEY, true, false);
    stop_cheat_caller_address(fixture.ledger_address);
    assert!(assert_preview_applies(@fixture, ranked_players(1)) == array![0]);
}

#[test]
fn preview_disabled_mmr_is_unchanged() {
    let mut preset = default_preset();
    preset.mmr.enabled = false;
    let fixture = deploy_fixture(preset);
    register_players(@fixture, 2);
    let maximum: u128 = 0xffffffffffffffffffffffffffffffff;
    let rating: u256 = maximum.into() * 1_000_000_000_000_000_000;
    fixture.mmr.update_mmr_batch(array![(player(0), rating), (player(1), rating)]);
    assert!(assert_preview_applies(@fixture, ranked_players(2)) == array![0, 0]);
}

#[test]
fn preview_covers_the_maximum_game_roster() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 24);
    assert!(assert_preview_applies(@fixture, ranked_players(24)).len() == 24);
}

#[test]
#[should_panic(expected: "Ledger: empty result")]
fn preview_rejects_empty_ranking() {
    let fixture = deploy_fixture(default_preset());
    fixture.ledger.preview_mmr(SLOT_KEY, array![]);
}

#[test]
#[should_panic(expected: "Ledger: invalid competition rank")]
fn preview_rejects_dense_ranks_after_a_tie() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 3);
    fixture.ledger.preview_mmr(SLOT_KEY, array![row(player(0), 1), row(player(1), 1), row(player(2), 2)]);
}

#[test]
#[should_panic(expected: "Ledger: unordered tie")]
fn preview_rejects_unordered_tied_wallets() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 2);
    fixture.ledger.preview_mmr(SLOT_KEY, array![row(player(1), 1), row(player(0), 1)]);
}

#[test]
#[should_panic(expected: "Ledger: duplicate result owner")]
fn preview_rejects_duplicate_wallets() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 2);
    fixture.ledger.preview_mmr(SLOT_KEY, array![row(player(0), 1), row(player(0), 2)]);
}

#[test]
#[should_panic(expected: "Ledger: unregistered result owner")]
fn preview_rejects_unregistered_wallets() {
    let fixture = deploy_fixture(default_preset());
    fixture.ledger.preview_mmr(SLOT_KEY, ranked_players(1));
}

#[test]
#[should_panic(expected: "Ledger: slot unavailable")]
fn preview_rejects_unknown_slot() {
    let fixture = deploy_fixture(default_preset());
    fixture.ledger.preview_mmr(SlotKey { shard: 'other', slot_id: 42 }, ranked_players(1));
}

#[test]
#[should_panic(expected: "Ledger: slot unavailable")]
fn preview_rejects_cancelled_slot() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 1);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.cancel_slot(SLOT_KEY);
    stop_cheat_caller_address(fixture.ledger_address);
    fixture.ledger.preview_mmr(SLOT_KEY, ranked_players(1));
}

#[test]
#[should_panic(expected: "Ledger: registration refundable")]
fn preview_rejects_refundable_registration() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 1);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    start_cheat_block_timestamp(fixture.ledger_address, START);
    fixture.ledger.mark_refundable(SLOT_KEY, array![player(0)]);
    stop_cheat_caller_address(fixture.ledger_address);
    fixture.ledger.preview_mmr(SLOT_KEY, ranked_players(1));
}

#[test]
#[should_panic(expected: "Ledger: registration already settled")]
fn preview_rejects_settled_registration() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 1);
    apply_results(@fixture, ranked_players(1));
    fixture.ledger.preview_mmr(SLOT_KEY, ranked_players(1));
}

#[test]
#[feature("safe_dispatcher")]
fn frontier_split_prizes_and_chest_carry_have_separate_custody() {
    let fixture = deploy_ledger();
    let unit: u256 = 1000000000000000000;
    let preset = Preset { frontier_chest_bps: 7000, frontier_top_n: 10, ..default_preset() };
    fund_and_approve_player(@fixture, ADMIN(), 2100 * unit);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.register_preset(PRESET_ID, preset, test_bands(), test_items());
    fixture.ledger.fund_frontier('shard', 1, PRESET_ID, START, END, 0x5eed, 1100 * unit);
    let season = fixture.ledger.get_frontier('shard', 1);
    assert_eq!((season.pool, season.prize_pool), (770 * unit, 330 * unit));
    let safe = IGameLedgerSafeDispatcher { contract_address: fixture.ledger_address };
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    start_cheat_block_timestamp(fixture.ledger_address, END - 1);
    assert!(safe.report_withdrawal('shard', 1, 'prize', 60 * unit, 1, 10).is_err());
    start_cheat_block_timestamp(fixture.ledger_address, END);
    assert!(safe.report_withdrawal('shard', 1, 'prize', 61 * unit, 1, 10).is_err());
    fixture.ledger.report_withdrawal('shard', 1, 'prize', 60 * unit, 1, 10);
    fixture.ledger.report_withdrawal('shard', 1, 'prize', 60 * unit, 1, 10);
    assert!(safe.report_withdrawal('shard', 1, 'duplicate', 60 * unit, 1, 10).is_err());
    assert!(safe.report_withdrawal('shard', 1, 'wrong_count', 60 * unit, 2, 9).is_err());
    fixture.ledger.pay('shard', 1, 'prize', player(0), 60 * unit);
    fixture.ledger.pay('shard', 1, 'prize', player(0), 60 * unit);
    fixture.ledger.report_withdrawal('shard', 1, 'chest', 70 * unit, 0, 0);
    fixture.ledger.pay('shard', 1, 'chest', player(1), 70 * unit);
    let settled = fixture.ledger.get_frontier('shard', 1);
    assert_eq!((settled.paid, settled.prize_paid), (70 * unit, 60 * unit));
    let next_start = END + preset.claim_window_seconds.into();
    start_cheat_block_timestamp(fixture.ledger_address, next_start);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.close_frontier('shard', 1);
    assert_eq!(fixture.ledger.frontier_carry('shard'), 700 * unit);
    assert_eq!(fixture.lords.balance_of(TREASURY()), 0);
    // Closing chest claims cannot void a prize whose winner links a wallet later.
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.report_withdrawal('shard', 1, 'late_prize', 54 * unit, 2, 10);
    fixture.ledger.pay('shard', 1, 'late_prize', player(2), 54 * unit);
    let settled = fixture.ledger.get_frontier('shard', 1);
    assert_eq!(settled.prize_paid, 114 * unit);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.fund_frontier('shard', 2, PRESET_ID, next_start, next_start + 100, 0x5eed, 1000 * unit);
    let next = fixture.ledger.get_frontier('shard', 2);
    assert_eq!((next.pool, next.prize_pool), (1400 * unit, 300 * unit));
    assert_eq!(fixture.ledger.frontier_carry('shard'), 0);
    assert_eq!(
        fixture.lords.balance_of(fixture.ledger_address),
        next.pool + next.prize_pool + settled.prize_pool - settled.prize_paid,
    );
}

#[test]
fn carry_can_arrive_after_the_next_season_starts_without_being_split_again() {
    let fixture = funded_frontier();
    let next_end = END + default_preset().claim_window_seconds.into() + 100;
    start_cheat_block_timestamp(fixture.ledger_address, END);
    fund_and_approve_player(@fixture, ADMIN(), 1000);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.fund_frontier('shard', 2, PRESET_ID, END, next_end, 0x5eed, 1000);
    start_cheat_block_timestamp(fixture.ledger_address, next_end - 100);
    fixture.ledger.close_frontier('shard', 1);
    fixture.ledger.apply_frontier_carry('shard', 2);
    fixture.ledger.apply_frontier_carry('shard', 2);
    assert_eq!(fixture.ledger.get_frontier('shard', 2).pool, 2000);
    assert_eq!(fixture.ledger.get_frontier('shard', 2).prize_pool, 0);
    assert_eq!(fixture.ledger.frontier_carry('shard'), 0);
}
