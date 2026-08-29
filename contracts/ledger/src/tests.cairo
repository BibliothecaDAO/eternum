use game_ledger::contract::{IGameLedgerDispatcher, IGameLedgerDispatcherTrait};
use game_ledger::types::{MmrParams, PmParams, Preset};
use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_timestamp, start_cheat_caller_address,
    stop_cheat_block_timestamp, stop_cheat_caller_address,
};
use starknet::ContractAddress;

#[starknet::interface]
trait ITestLords<TState> {
    fn mint(ref self: TState, recipient: ContractAddress, amount: u256);
}

#[starknet::contract]
mod TestLords {
    use openzeppelin::introspection::src5::SRC5Component;
    use openzeppelin::token::erc20::{ERC20Component, ERC20HooksEmptyImpl};
    use starknet::ContractAddress;

    component!(path: ERC20Component, storage: erc20, event: ERC20Event);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);

    #[abi(embed_v0)]
    impl ERC20Impl = ERC20Component::ERC20Impl<ContractState>;
    #[abi(embed_v0)]
    impl ERC20MetadataImpl = ERC20Component::ERC20MetadataImpl<ContractState>;
    impl ERC20InternalImpl = ERC20Component::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        erc20: ERC20Component::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        ERC20Event: ERC20Component::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
    }

    #[constructor]
    fn constructor(ref self: ContractState) {
        self.erc20.initializer("Test LORDS", "TLORDS");
    }

    #[abi(embed_v0)]
    impl TestLordsImpl of super::ITestLords<ContractState> {
        fn mint(ref self: ContractState, recipient: ContractAddress, amount: u256) {
            self.erc20.mint(recipient, amount);
        }
    }
}

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

const GAME_ID: u32 = 7;
const PRESET_ID: u32 = 3;
const START: u64 = 100;
const END: u64 = 200;

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
        entry_fee: 500,
        protocol_cut_bps: 2_000,
        paid_fraction_bps: 2_000,
        decay_bps: 9_600,
        sword_price: 500,
        shield_price: 500,
        mmr: MmrParams {
            enabled: true, mean: 1500, spread: 450, max_delta: 45, k: 50, regression_bps: 150, min_players: 6,
        },
        pm: PmParams { fee_bps: 500, liability_cap: 10_000, seed: 100, claim_window_seconds: 604_800 },
    }
}

#[derive(Copy, Drop)]
struct Fixture {
    ledger_address: ContractAddress,
    ledger: IGameLedgerDispatcher,
    lords_address: ContractAddress,
    lords: IERC20Dispatcher,
    lords_minter: ITestLordsDispatcher,
}

fn deploy_fixture(preset: Preset) -> Fixture {
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
    let season_pass: ContractAddress = 'season_pass'.try_into().unwrap();
    let village_pass: ContractAddress = 'village_pass'.try_into().unwrap();
    let loot_chest: ContractAddress = 'loot_chest'.try_into().unwrap();
    let elite_invite: ContractAddress = 'elite_invite'.try_into().unwrap();
    let cosmetics: ContractAddress = 'cosmetics'.try_into().unwrap();
    season_pass.serialize(ref constructor);
    village_pass.serialize(ref constructor);
    loot_chest.serialize(ref constructor);
    elite_invite.serialize(ref constructor);
    cosmetics.serialize(ref constructor);
    let (ledger_address, _) = ledger_class.deploy(@constructor).unwrap();
    let ledger = IGameLedgerDispatcher { contract_address: ledger_address };

    start_cheat_caller_address(ledger_address, ADMIN());
    ledger.register_preset(PRESET_ID, preset);
    stop_cheat_caller_address(ledger_address);
    start_cheat_caller_address(ledger_address, OPERATOR());
    ledger.open_game(GAME_ID, PRESET_ID, START, END);
    stop_cheat_caller_address(ledger_address);

    Fixture {
        ledger_address,
        ledger,
        lords_address,
        lords: IERC20Dispatcher { contract_address: lords_address },
        lords_minter: ITestLordsDispatcher { contract_address: lords_address },
    }
}

fn fund_and_approve_player(fixture: @Fixture, owner: ContractAddress, amount: u256) {
    fixture.lords_minter.mint(owner, amount);
    start_cheat_caller_address(*fixture.lords_address, owner);
    fixture.lords.approve(*fixture.ledger_address, amount);
    stop_cheat_caller_address(*fixture.lords_address);
}

fn register_players(fixture: @Fixture, count: u16) {
    for index in 0..count {
        let owner = player(index);
        fund_and_approve_player(fixture, owner, 500);
        start_cheat_caller_address(*fixture.ledger_address, owner);
        fixture.ledger.register(GAME_ID, false, false);
        stop_cheat_caller_address(*fixture.ledger_address);
    }
}

fn ranked_players(count: u16) -> Array<(ContractAddress, u16, u16)> {
    let mut ranked = array![];
    for index in 0..count {
        ranked.append((player(index), index + 1, 0));
    }
    ranked
}

fn apply_results(fixture: @Fixture, ranked: Array<(ContractAddress, u16, u16)>) {
    start_cheat_block_timestamp(*fixture.ledger_address, END);
    start_cheat_caller_address(*fixture.ledger_address, OPERATOR());
    fixture.ledger.apply_results(GAME_ID, ranked);
    stop_cheat_caller_address(*fixture.ledger_address);
    stop_cheat_block_timestamp(*fixture.ledger_address);
}

fn assert_conservation(count: u16) {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, count);
    let initial_pool: u256 = count.into() * 500;
    apply_results(@fixture, ranked_players(count));

    let mut payouts = 0;
    for index in 0..count {
        payouts += fixture.ledger.get_player_result(GAME_ID, player(index)).payout;
    }
    let game = fixture.ledger.get_game(GAME_ID);
    assert!(game.pool == 0, "game accounting should be zero");
    assert!(payouts + game.protocol_cut + game.dust == initial_pool, "pool should be conserved");
    assert!(fixture.lords.balance_of(fixture.ledger_address) == 0, "ledger token balance should be zero");
    assert!(fixture.lords.balance_of(TREASURY()) == game.protocol_cut + game.dust, "treasury should receive remainder");
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
    fixture.ledger.register(GAME_ID, false, false);
    fixture.ledger.register(GAME_ID, false, false);
}

#[test]
#[should_panic]
fn rejects_registration_after_start() {
    let fixture = deploy_fixture(default_preset());
    let owner = player(0);
    fund_and_approve_player(@fixture, owner, 500);
    start_cheat_block_timestamp(fixture.ledger_address, START);
    start_cheat_caller_address(fixture.ledger_address, owner);
    fixture.ledger.register(GAME_ID, false, false);
}

#[test]
#[should_panic]
fn rejects_cancellation_after_start() {
    let fixture = deploy_fixture(default_preset());
    start_cheat_block_timestamp(fixture.ledger_address, START);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.cancel_game(GAME_ID);
}

#[test]
fn cancellation_refunds_registration_and_sponsorship() {
    let fixture = deploy_fixture(default_preset());
    let owner = player(0);
    fund_and_approve_player(@fixture, owner, 700);
    start_cheat_caller_address(fixture.ledger_address, owner);
    fixture.ledger.register(GAME_ID, false, false);
    fixture.ledger.fund(GAME_ID, 200);
    stop_cheat_caller_address(fixture.ledger_address);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.cancel_game(GAME_ID);
    stop_cheat_caller_address(fixture.ledger_address);
    start_cheat_caller_address(fixture.ledger_address, owner);
    fixture.ledger.refund(GAME_ID);
    stop_cheat_caller_address(fixture.ledger_address);

    assert!(fixture.lords.balance_of(owner) == 700, "owner should recover all payments");
    assert!(fixture.ledger.get_game(GAME_ID).pool == 0, "cancelled pool should be empty");
}

#[test]
#[should_panic]
fn rejects_roster_size_mismatch() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 6);
    apply_results(@fixture, ranked_players(5));
}

#[test]
#[should_panic]
fn rejects_unordered_ranks() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 6);
    let ranked = array![
        (player(0), 1, 0), (player(1), 3, 0), (player(2), 2, 0), (player(3), 4, 0), (player(4), 5, 0),
        (player(5), 6, 0),
    ];
    apply_results(@fixture, ranked);
}

#[test]
#[should_panic]
fn rejects_dense_rank_after_tie() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 6);
    let ranked = array![
        (player(0), 1, 0), (player(1), 1, 0), (player(2), 2, 0), (player(3), 4, 0), (player(4), 5, 0),
        (player(5), 6, 0),
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
fn conserves_twenty_four_player_pool() {
    assert_conservation(24);
}

#[test]
fn conserves_ninety_six_player_pool() {
    assert_conservation(96);
}

#[test]
fn tie_fixture_one_one_three_splits_positions_once() {
    let mut preset = default_preset();
    preset.paid_fraction_bps = 10_000;
    preset.mmr.min_players = 3;
    let fixture = deploy_fixture(preset);
    register_players(@fixture, 3);
    apply_results(@fixture, array![(player(0), 1, 0), (player(1), 1, 0), (player(2), 3, 0)]);

    let first = fixture.ledger.get_player_result(GAME_ID, player(0));
    let second = fixture.ledger.get_player_result(GAME_ID, player(1));
    let third = fixture.ledger.get_player_result(GAME_ID, player(2));
    assert!(first.payout == second.payout, "tied players should split equally");
    assert!(first.mmr_after == second.mmr_after, "tied players should receive equal MMR");
    assert!(third.payout < first.payout, "third place should receive less");
}

#[test]
fn tie_fixture_one_two_two_four_splits_positions_once() {
    let mut preset = default_preset();
    preset.paid_fraction_bps = 10_000;
    preset.mmr.min_players = 4;
    let fixture = deploy_fixture(preset);
    register_players(@fixture, 4);
    apply_results(@fixture, array![(player(0), 1, 0), (player(1), 2, 0), (player(2), 2, 0), (player(3), 4, 0)]);

    let first = fixture.ledger.get_player_result(GAME_ID, player(0));
    let second = fixture.ledger.get_player_result(GAME_ID, player(1));
    let third = fixture.ledger.get_player_result(GAME_ID, player(2));
    let fourth = fixture.ledger.get_player_result(GAME_ID, player(3));
    assert!(second.payout == third.payout, "tied players should split equally");
    assert!(second.mmr_after == third.mmr_after, "tied players should receive equal MMR");
    assert!(first.payout > second.payout && second.payout > fourth.payout, "positions should decay");
}
