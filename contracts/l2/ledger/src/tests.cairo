use game_ledger::contract::{IGameLedgerDispatcher, IGameLedgerDispatcherTrait, result_commitment};
use game_ledger::test_lords::{ITestLordsDispatcher, ITestLordsDispatcherTrait};
use game_ledger::types::{ChestBandPreset, ChestOdds, GameKey, MmrParams, Preset, RankedPlayer};
use openzeppelin::access::accesscontrol::interface::{IAccessControlDispatcher, IAccessControlDispatcherTrait};
use openzeppelin::security::interface::{IPausableDispatcher, IPausableDispatcherTrait};
use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
use openzeppelin::token::erc721::interface::{IERC721Dispatcher, IERC721DispatcherTrait};
use openzeppelin::upgrades::interface::{IUpgradeableDispatcher, IUpgradeableDispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, get_class_hash, start_cheat_block_hash, start_cheat_block_number,
    start_cheat_block_timestamp, start_cheat_caller_address, stop_cheat_block_number, stop_cheat_block_timestamp,
    stop_cheat_caller_address,
};
use starknet::ContractAddress;

#[starknet::interface]
trait ITestSeasonPass<TState> {
    fn set_ledger(ref self: TState, ledger: ContractAddress);
    fn mint(ref self: TState, recipient: ContractAddress, token_id: u256);
    fn burn(ref self: TState, token_id: u256);
    fn restore(ref self: TState, recipient: ContractAddress, token_id: u256);
    fn get_encoded_metadata(self: @TState, token_id: u16) -> (felt252, felt252, felt252);
}

#[starknet::interface]
trait ITestVillagePass<TState> {
    fn mint(ref self: TState, recipient: ContractAddress) -> u256;
    fn burn(ref self: TState, token_id: u256);
    fn restore(ref self: TState, recipient: ContractAddress, token_id: u256);
}

#[starknet::contract]
mod TestSeasonPass {
    use core::num::traits::Zero;
    use game_ledger::contract::{IGameLedgerDispatcher, IGameLedgerDispatcherTrait};
    use openzeppelin::introspection::src5::SRC5Component;
    use openzeppelin::token::erc721::{ERC721Component, ERC721HooksEmptyImpl};
    use starknet::ContractAddress;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};

    component!(path: ERC721Component, storage: erc721, event: ERC721Event);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);

    #[abi(embed_v0)]
    impl ERC721Impl = ERC721Component::ERC721Impl<ContractState>;
    impl ERC721InternalImpl = ERC721Component::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        ledger: ContractAddress,
        #[substorage(v0)]
        erc721: ERC721Component::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        ERC721Event: ERC721Component::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
    }

    #[constructor]
    fn constructor(ref self: ContractState) {
        self.erc721.initializer("Test Season Pass", "PASS", "");
    }

    #[abi(embed_v0)]
    impl TestSeasonPassImpl of super::ITestSeasonPass<ContractState> {
        fn set_ledger(ref self: ContractState, ledger: ContractAddress) {
            self.ledger.write(ledger);
        }

        fn mint(ref self: ContractState, recipient: ContractAddress, token_id: u256) {
            self.erc721.mint(recipient, token_id);
        }

        fn burn(ref self: ContractState, token_id: u256) {
            let owner = self.erc721.owner_of(token_id);
            let ledger = self.ledger.read();
            assert!(
                IGameLedgerDispatcher { contract_address: ledger }.get_registration(super::GAME_KEY, owner).registered,
                "registration should be recorded before burn",
            );
            self.erc721.update(Zero::zero(), token_id, starknet::get_caller_address());
        }

        fn restore(ref self: ContractState, recipient: ContractAddress, token_id: u256) {
            assert!(starknet::get_caller_address() == self.ledger.read(), "only ledger may restore");
            self.erc721.mint(recipient, token_id);
        }

        fn get_encoded_metadata(self: @ContractState, token_id: u16) -> (felt252, felt252, felt252) {
            ('realm', token_id.into(), 'metadata')
        }
    }
}

#[starknet::contract]
mod TestVillagePass {
    use core::num::traits::Zero;
    use openzeppelin::access::accesscontrol::{AccessControlComponent, DEFAULT_ADMIN_ROLE};
    use openzeppelin::introspection::src5::SRC5Component;
    use openzeppelin::token::erc721::ERC721Component;
    use starknet::ContractAddress;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};

    const DISTRIBUTOR_ROLE: felt252 = selector!("DISTRIBUTOR_ROLE");

    component!(path: ERC721Component, storage: erc721, event: ERC721Event);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);
    component!(path: AccessControlComponent, storage: accesscontrol, event: AccessControlEvent);

    #[abi(embed_v0)]
    impl ERC721Impl = ERC721Component::ERC721Impl<ContractState>;
    #[abi(embed_v0)]
    impl AccessControlImpl = AccessControlComponent::AccessControlImpl<ContractState>;
    impl AccessControlInternalImpl = AccessControlComponent::InternalImpl<ContractState>;
    impl ERC721InternalImpl = ERC721Component::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        counter: u256,
        #[substorage(v0)]
        erc721: ERC721Component::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
        #[substorage(v0)]
        accesscontrol: AccessControlComponent::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        ERC721Event: ERC721Component::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
        #[flat]
        AccessControlEvent: AccessControlComponent::Event,
    }

    #[constructor]
    fn constructor(ref self: ContractState, admin: ContractAddress) {
        self.erc721.initializer("Test Village Pass", "VILLAGE", "");
        self.accesscontrol.initializer();
        self.accesscontrol._grant_role(DEFAULT_ADMIN_ROLE, admin);
    }

    impl ERC721HooksImpl of ERC721Component::ERC721HooksTrait<ContractState> {
        fn before_update(
            ref self: ERC721Component::ComponentState<ContractState>,
            to: ContractAddress,
            token_id: u256,
            auth: ContractAddress,
        ) {
            let contract_state = self.get_contract_mut();
            let owner = contract_state.erc721._owner_of(token_id);
            if owner.is_non_zero() {
                let owner_is_distributor = contract_state.accesscontrol.has_role(DISTRIBUTOR_ROLE, owner);
                let caller_is_distributor = contract_state.accesscontrol.has_role(DISTRIBUTOR_ROLE, auth);
                assert!(owner_is_distributor || caller_is_distributor, "EVP: Village token can not be transferred");
            }
        }
    }

    #[abi(embed_v0)]
    impl TestVillagePassImpl of super::ITestVillagePass<ContractState> {
        fn mint(ref self: ContractState, recipient: ContractAddress) -> u256 {
            let token_id = self.counter.read() + 1;
            self.counter.write(token_id);
            self.erc721.mint(recipient, token_id);
            token_id
        }

        fn burn(ref self: ContractState, token_id: u256) {
            self.erc721.update(Zero::zero(), token_id, starknet::get_caller_address());
        }

        fn restore(ref self: ContractState, recipient: ContractAddress, token_id: u256) {
            self.accesscontrol.assert_only_role(DISTRIBUTOR_ROLE);
            self.erc721.mint(recipient, token_id);
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

const GAME_KEY: GameKey = GameKey { shard: 'shard', game_id: 7 };
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
        day_unit_seconds: 1,
        season_bags: 5,
        entry_fee: 500,
        protocol_cut_bps: 0,
        chest_lords_bps: 0,
        paid_fraction_bps: 2_000,
        decay_bps: 9_600,
        sword_price: 500,
        shield_price: 500,
        mmr: MmrParams {
            enabled: true, mean: 1500, spread: 450, max_delta: 45, k: 50, regression_bps: 150, min_players: 6,
        },
    }
}

#[derive(Copy, Drop)]
struct Fixture {
    ledger_address: ContractAddress,
    ledger: IGameLedgerDispatcher,
    lords_address: ContractAddress,
    chest_address: ContractAddress,
    cosmetics_address: ContractAddress,
    lords: IERC20Dispatcher,
    lords_minter: ITestLordsDispatcher,
}

fn deploy_ledger_with_passes(season_pass: ContractAddress, village_pass: ContractAddress) -> Fixture {
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
    let collectible_class = declare("TestCollectible").unwrap().contract_class();
    let (loot_chest, _) = collectible_class.deploy(@array![]).unwrap();
    let (cosmetics, _) = collectible_class.deploy(@array![]).unwrap();
    season_pass.serialize(ref constructor);
    village_pass.serialize(ref constructor);
    loot_chest.serialize(ref constructor);
    cosmetics.serialize(ref constructor);
    let (ledger_address, _) = ledger_class.deploy(@constructor).unwrap();
    let ledger = IGameLedgerDispatcher { contract_address: ledger_address };
    ITestCollectibleDispatcher { contract_address: loot_chest }.set_minter(ledger_address);
    ITestCollectibleDispatcher { contract_address: cosmetics }.set_minter(ledger_address);

    Fixture {
        ledger_address,
        ledger,
        lords_address,
        chest_address: loot_chest,
        cosmetics_address: cosmetics,
        lords: IERC20Dispatcher { contract_address: lords_address },
        lords_minter: ITestLordsDispatcher { contract_address: lords_address },
    }
}

fn deploy_ledger() -> Fixture {
    deploy_ledger_with_passes('season_pass'.try_into().unwrap(), 'village_pass'.try_into().unwrap())
}

fn configure_game(fixture: Fixture, preset: Preset) -> Fixture {
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.register_preset(PRESET_ID, preset, test_bands(), test_items());
    fixture.ledger.open_season(1, PRESET_ID, START, END + 100);
    stop_cheat_caller_address(fixture.ledger_address);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.open_game(GAME_KEY, 1, PRESET_ID, START, END);
    stop_cheat_caller_address(fixture.ledger_address);

    fixture
}

fn deploy_fixture(preset: Preset) -> Fixture {
    configure_game(deploy_ledger(), preset)
}

fn deploy_season_pass_fixture() -> (Fixture, ContractAddress, ITestSeasonPassDispatcher) {
    let pass_class = declare("TestSeasonPass").unwrap().contract_class();
    let (pass_address, _) = pass_class.deploy(@array![]).unwrap();
    let pass = ITestSeasonPassDispatcher { contract_address: pass_address };
    let fixture = configure_game(
        deploy_ledger_with_passes(pass_address, 'village_pass'.try_into().unwrap()), default_preset(),
    );
    pass.set_ledger(fixture.ledger_address);
    (fixture, pass_address, pass)
}

fn deploy_village_pass_fixture() -> (Fixture, ContractAddress, ITestVillagePassDispatcher) {
    let pass_class = declare("TestVillagePass").unwrap().contract_class();
    let mut constructor = array![];
    ADMIN().serialize(ref constructor);
    let (pass_address, _) = pass_class.deploy(@constructor).unwrap();
    let fixture = configure_game(
        deploy_ledger_with_passes('season_pass'.try_into().unwrap(), pass_address), default_preset(),
    );
    (fixture, pass_address, ITestVillagePassDispatcher { contract_address: pass_address })
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
        fixture.ledger.register(GAME_KEY, false, false);
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
    fixture.ledger.apply_results(GAME_KEY, ranked);
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

    let game = fixture.ledger.get_game(GAME_KEY);
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
fn payout_pause_keeps_registration_and_funding_open() {
    let fixture = deploy_fixture(default_preset());
    fund_and_approve_player(@fixture, player(0), 700);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.pause();
    start_cheat_caller_address(fixture.ledger_address, player(0));
    fixture.ledger.register(GAME_KEY, false, false);
    fixture.ledger.fund(GAME_KEY, 200);
    assert!(fixture.ledger.get_game(GAME_KEY).pool == 700);
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
    fixture.ledger.register(GAME_KEY, false, false);
    fixture.ledger.register(GAME_KEY, false, false);
}

#[test]
#[should_panic]
fn rejects_registration_after_start() {
    let fixture = deploy_fixture(default_preset());
    let owner = player(0);
    fund_and_approve_player(@fixture, owner, 500);
    start_cheat_block_timestamp(fixture.ledger_address, START);
    start_cheat_caller_address(fixture.ledger_address, owner);
    fixture.ledger.register(GAME_KEY, false, false);
}

#[test]
fn season_pass_registration_records_then_burns_an_approved_pass() {
    let (fixture, pass_address, pass) = deploy_season_pass_fixture();
    let owner = player(0);
    let token_id = 42;
    pass.mint(owner, token_id);
    let erc721 = IERC721Dispatcher { contract_address: pass_address };
    start_cheat_caller_address(pass_address, owner);
    erc721.approve(fixture.ledger_address, token_id);
    stop_cheat_caller_address(pass_address);

    start_cheat_caller_address(fixture.ledger_address, owner);
    fixture.ledger.register_with_pass(GAME_KEY, token_id);
    stop_cheat_caller_address(fixture.ledger_address);

    let registration = fixture.ledger.get_registration(GAME_KEY, owner);
    assert!(registration.registered && registration.realm_id == token_id, "pass registration should be recorded");
    assert!(erc721.balance_of(owner) == 0, "the registered season pass should be burned");
}

#[test]
#[should_panic(expected: 'ERC721: unauthorized caller')]
fn season_pass_registration_requires_ledger_approval() {
    let (fixture, _, pass) = deploy_season_pass_fixture();
    let owner = player(0);
    pass.mint(owner, 42);

    start_cheat_caller_address(fixture.ledger_address, owner);
    fixture.ledger.register_with_pass(GAME_KEY, 42);
}

#[test]
#[should_panic]
fn season_pass_id_must_fit_metadata_abi() {
    let (fixture, pass_address, pass) = deploy_season_pass_fixture();
    let owner = player(0);
    let token_id = 65_536;
    pass.mint(owner, token_id);
    start_cheat_caller_address(pass_address, owner);
    IERC721Dispatcher { contract_address: pass_address }.approve(fixture.ledger_address, token_id);
    stop_cheat_caller_address(pass_address);

    start_cheat_caller_address(fixture.ledger_address, owner);
    fixture.ledger.register_with_pass(GAME_KEY, token_id);
}

#[test]
fn village_registration_burns_when_ledger_is_a_distributor() {
    let (fixture, pass_address, pass) = deploy_village_pass_fixture();
    let owner = player(0);
    start_cheat_caller_address(pass_address, ADMIN());
    let token_id = pass.mint(owner);
    IAccessControlDispatcher { contract_address: pass_address }
        .grant_role(selector!("DISTRIBUTOR_ROLE"), fixture.ledger_address);
    stop_cheat_caller_address(pass_address);
    let erc721 = IERC721Dispatcher { contract_address: pass_address };
    start_cheat_caller_address(pass_address, owner);
    erc721.approve(fixture.ledger_address, token_id);
    stop_cheat_caller_address(pass_address);

    start_cheat_caller_address(fixture.ledger_address, owner);
    fixture.ledger.register_village(GAME_KEY, token_id);
    stop_cheat_caller_address(fixture.ledger_address);

    assert!(fixture.ledger.get_registration(GAME_KEY, owner).registered, "village registration should be recorded");
    assert!(erc721.balance_of(owner) == 0, "the registered village pass should be burned");
}

#[test]
#[should_panic]
fn village_registration_requires_distributor_role() {
    let (fixture, pass_address, pass) = deploy_village_pass_fixture();
    let owner = player(0);
    start_cheat_caller_address(pass_address, ADMIN());
    let token_id = pass.mint(owner);
    stop_cheat_caller_address(pass_address);
    start_cheat_caller_address(pass_address, owner);
    IERC721Dispatcher { contract_address: pass_address }.approve(fixture.ledger_address, token_id);
    stop_cheat_caller_address(pass_address);

    start_cheat_caller_address(fixture.ledger_address, owner);
    fixture.ledger.register_village(GAME_KEY, token_id);
}

#[test]
#[should_panic]
fn rejects_cancellation_after_start() {
    let fixture = deploy_fixture(default_preset());
    start_cheat_block_timestamp(fixture.ledger_address, START);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.cancel_game(GAME_KEY);
}

#[test]
fn cancellation_refunds_registration_and_sponsorship() {
    let fixture = deploy_fixture(default_preset());
    let owner = player(0);
    fund_and_approve_player(@fixture, owner, 700);
    start_cheat_caller_address(fixture.ledger_address, owner);
    fixture.ledger.register(GAME_KEY, false, false);
    fixture.ledger.fund(GAME_KEY, 200);
    stop_cheat_caller_address(fixture.ledger_address);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.cancel_game(GAME_KEY);
    stop_cheat_caller_address(fixture.ledger_address);
    start_cheat_caller_address(fixture.ledger_address, owner);
    fixture.ledger.refund(GAME_KEY);
    stop_cheat_caller_address(fixture.ledger_address);

    assert!(fixture.lords.balance_of(owner) == 700, "owner should recover all payments");
    assert!(fixture.ledger.get_game(GAME_KEY).pool == 0, "cancelled pool should be empty");
}

#[test]
#[should_panic(expected: 'Pausable: paused')]
fn paused_ledger_rejects_refunds() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 1);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.cancel_game(GAME_KEY);
    stop_cheat_caller_address(fixture.ledger_address);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.pause();
    stop_cheat_caller_address(fixture.ledger_address);

    start_cheat_caller_address(fixture.ledger_address, player(0));
    fixture.ledger.refund(GAME_KEY);
}

#[test]
fn cancelled_game_restores_burned_season_pass() {
    let (fixture, pass_address, pass) = deploy_season_pass_fixture();
    let owner = player(0);
    let token_id = 42;
    pass.mint(owner, token_id);
    start_cheat_caller_address(pass_address, owner);
    IERC721Dispatcher { contract_address: pass_address }.approve(fixture.ledger_address, token_id);
    stop_cheat_caller_address(pass_address);
    start_cheat_caller_address(fixture.ledger_address, owner);
    fixture.ledger.register_with_pass(GAME_KEY, token_id);
    stop_cheat_caller_address(fixture.ledger_address);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.cancel_game(GAME_KEY);
    stop_cheat_caller_address(fixture.ledger_address);

    start_cheat_caller_address(fixture.ledger_address, owner);
    fixture.ledger.refund(GAME_KEY);
    stop_cheat_caller_address(fixture.ledger_address);

    assert!(IERC721Dispatcher { contract_address: pass_address }.owner_of(token_id) == owner, "pass was not restored");
}

#[test]
fn cancelled_game_restores_burned_village_pass() {
    let (fixture, pass_address, pass) = deploy_village_pass_fixture();
    let owner = player(0);
    start_cheat_caller_address(pass_address, ADMIN());
    let token_id = pass.mint(owner);
    IAccessControlDispatcher { contract_address: pass_address }
        .grant_role(selector!("DISTRIBUTOR_ROLE"), fixture.ledger_address);
    stop_cheat_caller_address(pass_address);
    start_cheat_caller_address(pass_address, owner);
    IERC721Dispatcher { contract_address: pass_address }.approve(fixture.ledger_address, token_id);
    stop_cheat_caller_address(pass_address);
    start_cheat_caller_address(fixture.ledger_address, owner);
    fixture.ledger.register_village(GAME_KEY, token_id);
    stop_cheat_caller_address(fixture.ledger_address);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.cancel_game(GAME_KEY);
    stop_cheat_caller_address(fixture.ledger_address);

    start_cheat_caller_address(fixture.ledger_address, owner);
    fixture.ledger.refund(GAME_KEY);
    stop_cheat_caller_address(fixture.ledger_address);

    assert!(IERC721Dispatcher { contract_address: pass_address }.owner_of(token_id) == owner, "pass was not restored");
}

#[test]
fn started_abandoned_game_refunds_every_entrant_after_end() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 2);
    start_cheat_block_timestamp(fixture.ledger_address, END);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.abort_game(GAME_KEY);
    stop_cheat_caller_address(fixture.ledger_address);

    let mut index: u16 = 0;
    while index < 2 {
        let owner = player(index);
        start_cheat_caller_address(fixture.ledger_address, owner);
        fixture.ledger.refund(GAME_KEY);
        stop_cheat_caller_address(fixture.ledger_address);
        assert!(fixture.lords.balance_of(owner) == 500, "entrant should recover the registration payment");
        index += 1;
    }
    stop_cheat_block_timestamp(fixture.ledger_address);

    assert!(fixture.ledger.get_game(GAME_KEY).pool == 0, "aborted pool should be empty");
    assert!(fixture.lords.balance_of(fixture.ledger_address) == 0, "aborted funds should leave the ledger");
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
fn non_operator_cannot_apply_results() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 1);
    start_cheat_block_timestamp(fixture.ledger_address, START);
    start_cheat_caller_address(fixture.ledger_address, player(0));
    fixture.ledger.apply_results(GAME_KEY, ranked_players(1));
}

#[test]
fn operator_can_resolve_after_start_before_scheduled_end() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 1);
    apply_results_at(@fixture, START, ranked_players(1));

    assert!(fixture.ledger.get_game(GAME_KEY).finalized, "an ended match should settle before its scheduled deadline");
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
fn conserves_twenty_four_player_pool() {
    assert_conservation(24);
}

#[test]
fn conserves_ninety_six_player_pool() {
    assert_conservation(96);
}

#[test]
fn tie_fixture_one_one_three_preserves_mmr() {
    let mut preset = default_preset();
    preset.paid_fraction_bps = 10_000;
    preset.mmr.min_players = 3;
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
    preset.mmr.min_players = 4;
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
fn consumes_paid_flags_when_the_roster_is_below_the_mmr_minimum() {
    let fixture = deploy_fixture(default_preset());
    let owner = player(0);
    fund_and_approve_player(@fixture, owner, 1_000);
    start_cheat_caller_address(fixture.ledger_address, owner);
    fixture.ledger.register(GAME_KEY, true, false);
    stop_cheat_caller_address(fixture.ledger_address);
    apply_results(@fixture, array![row(owner, 1)]);

    let registration = fixture.ledger.get_registration(GAME_KEY, owner);
    assert!(registration.sword, "sword purchase should be recorded");
    assert!(registration.flags_consumed, "final results should consume paid flags");
}

fn funded_frontier() -> Fixture {
    let fixture = deploy_ledger();
    fund_and_approve_player(@fixture, ADMIN(), 1000);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.register_preset(PRESET_ID, default_preset(), test_bands(), test_items());
    fixture.ledger.fund_frontier('shard', 1, PRESET_ID, START, 0x5eed, 1000);
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
    let preset = Preset { day_unit_seconds: 2, season_bags: 1, ..default_preset() };
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.register_preset(2, preset, test_bands(), test_items());
    fund_and_approve_player(@fixture, ADMIN(), 1000);
    fixture.ledger.fund_frontier('shard', 2, 2, 300, 0x5eed, 1000);
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
fn frontier_unlocks_the_last_day_from_its_start_and_stops_at_the_preset_end() {
    let fixture = deploy_ledger();
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture
        .ledger
        .register_preset(PRESET_ID, Preset { season_bags: 1, ..default_preset() }, test_bands(), test_items());
    fund_and_approve_player(@fixture, ADMIN(), 1000);
    fixture.ledger.fund_frontier('shard', 1, PRESET_ID, START, 0x5eed, 1000);
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
    let fixture = deploy_fixture(Preset { day_unit_seconds: 0, season_bags: 0, ..default_preset() });
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.fund_frontier('shard', 1, PRESET_ID, START, 0x5eed, 1000);
}

#[test]
#[should_panic(expected: "Ledger: incomplete calendar")]
fn calendar_preset_requires_both_unit_and_bag_count_or_neither() {
    deploy_fixture(Preset { season_bags: 0, ..default_preset() });
}

#[test]
#[should_panic(expected: "Ledger: season duration exceeds u64")]
fn calendar_duration_is_checked_before_funding() {
    deploy_fixture(Preset { day_unit_seconds: 0xffffffff, season_bags: 0xffffffff, ..default_preset() });
}

#[test]
fn frontier_unlock_rolls_over_and_retries_pay_once() {
    let fixture = funded_frontier();
    start_cheat_block_timestamp(fixture.ledger_address, START);
    assert!(fixture.ledger.frontier_unlocked('shard', 1) == 40);
    fixture.ledger.pay('shard', 1, 'withdrawal', player(0), 40);
    fixture.ledger.pay('shard', 1, 'withdrawal', player(1), 999);
    assert!(fixture.lords.balance_of(player(0)) == 40);
    assert!(fixture.lords.balance_of(player(1)) == 0);
    assert!(fixture.ledger.get_payment('shard', 'withdrawal').amount == 40);
    start_cheat_block_timestamp(fixture.ledger_address, END + 1);
    fixture.ledger.pay('shard', 1, 'next', player(0), 960);
    assert!(fixture.ledger.get_frontier('shard', 1).paid == 1000);
}

#[test]
#[should_panic(expected: "Ledger: unlock exceeded")]
fn frontier_refuses_borrowing_future_unlock() {
    let fixture = funded_frontier();
    start_cheat_block_timestamp(fixture.ledger_address, START);
    fixture.ledger.pay('shard', 1, 'first', player(0), 30);
    fixture.ledger.pay('shard', 1, 'second', player(0), 11);
}

#[test]
#[should_panic(expected: "Ledger: unlock exceeded")]
fn frontier_refuses_before_start() {
    let fixture = funded_frontier();
    fixture.ledger.pay('shard', 1, 'first', player(0), 1);
}

#[test]
#[should_panic(expected: "Ledger: season already funded")]
fn frontier_is_funded_once() {
    let fixture = funded_frontier();
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.fund_frontier('shard', 1, PRESET_ID, START, 0x5eed, 1000);
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
fn frontier_close_returns_only_unspent_custody() {
    let fixture = funded_frontier();
    start_cheat_block_timestamp(fixture.ledger_address, 150);
    fixture.ledger.pay('shard', 1, 'first', player(0), 300);
    start_cheat_block_timestamp(fixture.ledger_address, END);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.close_frontier('shard', 1);
    assert!(fixture.lords.balance_of(TREASURY()) == 700);
    assert!(fixture.ledger.get_frontier('shard', 1).closed);
}

#[test]
#[should_panic(expected: "Ledger: season closed")]
fn frontier_close_refuses_later_claims() {
    let fixture = funded_frontier();
    start_cheat_block_timestamp(fixture.ledger_address, END);
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
    fixture.ledger.fund_frontier('other', 1, PRESET_ID, START, 0x5eed, 1000);
    start_cheat_block_timestamp(fixture.ledger_address, END);
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
fn sword_shield_and_sponsor_payments_feed_the_same_season() {
    let fixture = deploy_fixture(default_preset());
    let owner = player(0);
    fund_and_approve_player(@fixture, owner, 1700);
    start_cheat_caller_address(fixture.ledger_address, owner);
    fixture.ledger.register(GAME_KEY, true, true);
    fixture.ledger.fund(GAME_KEY, 200);
    apply_results(@fixture, ranked_players(1));
    assert!(fixture.ledger.get_season(1).pool == 1700);
    assert!(fixture.lords.balance_of(fixture.ledger_address) == 1700);
}

#[test]
fn payout_pause_still_allows_results_and_mmr() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 6);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.pause();
    apply_results(@fixture, ranked_players(6));
    assert!(fixture.ledger.get_game(GAME_KEY).finalized);
    assert!(fixture.ledger.get_player_result(GAME_KEY, player(0)).mmr_after > 1000);
}

#[test]
#[should_panic(expected: "Ledger: MMR frozen")]
fn season_end_freezes_results() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 1);
    apply_results_at(@fixture, END + 100, ranked_players(1));
}

#[test]
fn identical_game_ids_on_different_shards_have_independent_custody() {
    let fixture = deploy_fixture(default_preset());
    let other = GameKey { shard: 'other', game_id: GAME_KEY.game_id };
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.open_game(other, 1, PRESET_ID, START, END);
    fund_and_approve_player(@fixture, player(0), 1000);
    start_cheat_caller_address(fixture.ledger_address, player(0));
    fixture.ledger.register(GAME_KEY, false, false);
    fixture.ledger.register(other, false, false);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.cancel_game(other);
    start_cheat_caller_address(fixture.ledger_address, player(0));
    fixture.ledger.refund(other);
    assert!(fixture.ledger.get_game(GAME_KEY).pool == 500);
    assert!(fixture.ledger.get_game(other).pool == 0);
    apply_results(@fixture, ranked_players(1));
    assert!(fixture.ledger.get_season(1).pool == 500);
    assert!(fixture.ledger.get_player_result(other, player(0)).rank == 0);
}

#[test]
fn result_commitment_binds_the_shard_namespace() {
    let ranked = ranked_players(1);
    let other = GameKey { shard: 'other', game_id: GAME_KEY.game_id };
    assert!(result_commitment(GAME_KEY, ranked.span()) != result_commitment(other, ranked.span()));
}

#[starknet::interface]
trait ITestCollectible<TState> {
    fn set_minter(ref self: TState, minter: ContractAddress);
    fn get_metadata_raw(self: @TState, token_id: u256) -> u128;
}

#[starknet::contract]
mod TestCollectible {
    use core::num::traits::Zero;
    use game_ledger::contract::ICollectible;
    use openzeppelin::introspection::src5::SRC5Component;
    use openzeppelin::token::erc721::{ERC721Component, ERC721HooksEmptyImpl};
    use starknet::ContractAddress;
    use starknet::storage::{Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess};
    component!(path: ERC721Component, storage: erc721, event: ERC721Event);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);
    #[abi(embed_v0)]
    impl ERC721Impl = ERC721Component::ERC721Impl<ContractState>;
    impl ERC721InternalImpl = ERC721Component::InternalImpl<ContractState>;
    #[storage]
    struct Storage {
        minter: ContractAddress,
        counter: u256,
        attributes: Map<u256, u128>,
        #[substorage(v0)]
        erc721: ERC721Component::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        ERC721Event: ERC721Component::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
    }
    #[constructor]
    fn constructor(ref self: ContractState) {
        self.erc721.initializer("Test collectible", "TEST", "");
    }
    #[abi(embed_v0)]
    impl CollectibleImpl of ICollectible<ContractState> {
        fn mint(ref self: ContractState, recipient: ContractAddress, attributes_raw: u128) {
            self.mint_with_id(recipient, attributes_raw);
        }
        fn mint_with_id(ref self: ContractState, recipient: ContractAddress, attributes_raw: u128) -> u256 {
            assert!(starknet::get_caller_address() == self.minter.read(), "only minter");
            let token_id = self.counter.read() + 1;
            self.counter.write(token_id);
            self.attributes.entry(token_id).write(attributes_raw);
            self.erc721.mint(recipient, token_id);
            token_id
        }
        fn burn(ref self: ContractState, token_id: u256) {
            self.erc721.update(Zero::zero(), token_id, starknet::get_caller_address());
        }
    }
    #[abi(embed_v0)]
    impl TestCollectibleImpl of super::ITestCollectible<ContractState> {
        fn set_minter(ref self: ContractState, minter: ContractAddress) {
            self.minter.write(minter);
        }
        fn get_metadata_raw(self: @ContractState, token_id: u256) -> u128 {
            self.attributes.entry(token_id).read()
        }
    }
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
            10000
        } else {
            0
        },
        sword: if outcome == 6 {
            10000
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
                    }), lords_amount: 700,
                },
            );
    }
    bands
}

fn deploy_reward_fixture(outcome: u8, reserve_bps: u16, nominal_lords: u256) -> Fixture {
    let fixture = deploy_ledger();
    let mut preset = default_preset();
    preset.chest_lords_bps = reserve_bps;
    let mut bands = array![];
    for band in 0_u32..5 {
        bands
            .append(
                ChestBandPreset { metadata: 0x301 + band.into(), odds: odds_for(outcome), lords_amount: nominal_lords },
            );
    }
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.register_preset(PRESET_ID, preset, bands, test_items());
    fixture.ledger.open_season(1, PRESET_ID, START, END + 100);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.open_game(GAME_KEY, 1, PRESET_ID, START, END);
    stop_cheat_caller_address(fixture.ledger_address);
    fixture
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
fn lords_draws_use_only_the_reserve_and_are_capped_without_a_second_fee() {
    let fixture = deploy_reward_fixture(5, 2000, 700);
    register_players(@fixture, 2);
    apply_results(@fixture, ranked_players(2));
    assert!(fixture.ledger.get_season(1).pool == 800);
    assert!(fixture.ledger.get_season(1).chest_reserve == 200);
    assert!(fixture.ledger.get_chest(1).band == 0);
    assert!(fixture.ledger.get_chest(2).band == 4);
    assert!(fixture.ledger.get_chest(1).season_id == 1);
    open_reward(@fixture, player(0), 1);
    open_reward(@fixture, player(1), 2);
    assert!(fixture.lords.balance_of(player(0)) == 200);
    assert!(fixture.lords.balance_of(player(1)) == 0);
    assert!(fixture.lords.balance_of(TREASURY()) == 0);
    assert!(fixture.ledger.get_season(1).chest_reserve == 0);
    assert!(fixture.lords.balance_of(fixture.ledger_address) == 800);
    assert!(fixture.ledger.get_chest(1).finished && fixture.ledger.get_chest(2).finished);
}

#[test]
fn a_permissionless_cosmetic_finish_mints_to_the_requester() {
    let fixture = deploy_reward_fixture(0, 0, 700);
    register_players(@fixture, 1);
    apply_results(@fixture, ranked_players(1));
    request_reward(@fixture, player(0), 1);
    finish_reward(@fixture, 1, 999999);
    let cosmetics = IERC721Dispatcher { contract_address: fixture.cosmetics_address };
    assert!(cosmetics.owner_of(1) == player(0));
    assert!(
        ITestCollectibleDispatcher { contract_address: fixture.cosmetics_address }.get_metadata_raw(1) == 0x1011401,
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
    let next = GameKey { shard: 'shard', game_id: 8 };
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.open_game(next, 1, PRESET_ID, START, END);
    fund_and_approve_player(@fixture, player(0), 500);
    fund_and_approve_player(@fixture, player(1), 500);
    start_cheat_caller_address(fixture.ledger_address, player(0));
    fixture.ledger.register(next, true, false);
    start_cheat_caller_address(fixture.ledger_address, player(1));
    fixture.ledger.register(next, false, true);
    assert!(fixture.ledger.get_credits(player(0)).swords == 0);
    assert!(fixture.ledger.get_credits(player(1)).shields == 0);
    assert!(fixture.ledger.get_game(next).pool == 1000);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.cancel_game(next);
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
fn paid_flags_and_sponsorship_feed_the_chest_reserve_after_the_treasury_cut() {
    let mut preset = default_preset();
    preset.protocol_cut_bps = 2000;
    preset.chest_lords_bps = 2000;
    let fixture = deploy_fixture(preset);
    fund_and_approve_player(@fixture, player(0), 2000);
    start_cheat_caller_address(fixture.ledger_address, player(0));
    fixture.ledger.register(GAME_KEY, true, true);
    fixture.ledger.fund(GAME_KEY, 500);
    apply_results(@fixture, ranked_players(1));
    assert!(fixture.lords.balance_of(TREASURY()) == 400);
    assert!(fixture.ledger.get_season(1).chest_reserve == 320);
    assert!(fixture.ledger.get_season(1).pool == 1280);
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
    fixture.ledger.claim_season(1);
}

#[test]
fn season_winners_pull_after_one_hour_using_the_preset_curve() {
    let fixture = completed_season();
    post_top_at(@fixture, END + 100, array![player(0), player(1)]);
    let season = fixture.ledger.get_season(1);
    assert!(season.participant_count == 6 && season.top_count == 2);
    assert!(season.review_until == END + 100 + 3600);
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
    post_top_at(@fixture, END + 100, array![player(0), player(1)]);
    claim_season_at(@fixture, END + 100 + 3599, player(0));
}

#[test]
fn a_better_omitted_player_challenges_a_wrong_list() {
    let fixture = completed_season();
    post_top_at(@fixture, END + 100, array![player(1), player(2)]);
    start_cheat_caller_address(fixture.ledger_address, player(5));
    fixture.ledger.challenge_season(1, player(0));
    assert!(fixture.ledger.get_season(1).challenged);
}

#[test]
fn a_short_list_can_be_challenged_and_correction_restarts_the_hour() {
    let fixture = completed_season();
    post_top_at(@fixture, END + 100, array![player(0)]);
    fixture.ledger.challenge_season(1, player(1));
    assert!(fixture.ledger.get_season(1).challenged);
    post_top_at(@fixture, END + 100 + 3599, array![player(0), player(1)]);
    let corrected = fixture.ledger.get_season(1);
    assert!(!corrected.challenged);
    assert!(corrected.review_until == END + 100 + 3599 + 3600);
    claim_season_at(@fixture, corrected.review_until, player(0));
}

#[test]
#[should_panic(expected: "Ledger: season challenged")]
fn challenged_list_blocks_payout_even_after_the_hour() {
    let fixture = completed_season();
    post_top_at(@fixture, END + 100, array![player(1), player(2)]);
    fixture.ledger.challenge_season(1, player(0));
    claim_season_at(@fixture, END + 100 + 3600, player(1));
}

#[test]
#[should_panic(expected: "Ledger: incomplete top list")]
fn short_list_cannot_pay_even_if_nobody_challenges() {
    let fixture = completed_season();
    post_top_at(@fixture, END + 100, array![player(0)]);
    claim_season_at(@fixture, END + 100 + 3600, player(0));
}

#[test]
#[should_panic(expected: "Ledger: does not beat cutoff")]
fn worse_omitted_player_cannot_block_a_correct_list() {
    let fixture = completed_season();
    post_top_at(@fixture, END + 100, array![player(0), player(1)]);
    fixture.ledger.challenge_season(1, player(5));
}

#[test]
#[should_panic(expected: "Ledger: review closed")]
fn challenge_refuses_at_the_exact_hour_boundary() {
    let fixture = completed_season();
    post_top_at(@fixture, END + 100, array![player(1), player(2)]);
    start_cheat_block_timestamp(fixture.ledger_address, END + 100 + 3600);
    fixture.ledger.challenge_season(1, player(0));
}

#[test]
#[should_panic(expected: "Ledger: unordered winners")]
fn top_list_rejects_duplicate_winners() {
    let fixture = completed_season();
    post_top_at(@fixture, END + 100, array![player(0), player(0)]);
}

#[test]
#[should_panic(expected: "Ledger: unordered winners")]
fn top_list_rejects_ratings_in_the_wrong_order() {
    let fixture = completed_season();
    post_top_at(@fixture, END + 100, array![player(1), player(0)]);
}

#[test]
#[should_panic(expected: "Ledger: not a season participant")]
fn outsider_cannot_challenge() {
    let fixture = completed_season();
    post_top_at(@fixture, END + 100, array![player(0)]);
    fixture.ledger.challenge_season(1, player(99));
}

#[test]
#[should_panic(expected: "Ledger: season has not ended")]
fn operator_cannot_post_top_before_freeze() {
    let fixture = completed_season();
    post_top_at(@fixture, END + 99, array![player(0), player(1)]);
}

#[test]
#[should_panic(expected: "Ledger: top list final")]
fn operator_cannot_restart_a_finished_review_to_delay_claims() {
    let fixture = completed_season();
    post_top_at(@fixture, END + 100, array![player(0), player(1)]);
    post_top_at(@fixture, END + 100 + 3600, array![player(0), player(1)]);
}

#[test]
fn admin_mmr_correction_invalidates_a_posted_list_before_payout() {
    let fixture = completed_season();
    post_top_at(@fixture, END + 100, array![player(0), player(1)]);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.correct_season_mmr(1, array![(player(5), 2000)]);
    assert!(fixture.ledger.get_season(1).challenged);
    assert!(fixture.ledger.get_season_mmr(1, player(5)) == 2000);
    post_top_at(@fixture, END + 100 + 1, array![player(5), player(0)]);
    claim_season_at(@fixture, END + 100 + 1 + 3600, player(5));
    assert!(fixture.lords.balance_of(player(5)) > 0);
}

#[test]
#[should_panic(expected: "Ledger: season payout started")]
fn ratings_cannot_be_rewritten_after_a_winner_has_claimed() {
    let fixture = completed_season();
    post_top_at(@fixture, END + 100, array![player(0), player(1)]);
    claim_season_at(@fixture, END + 100 + 3600, player(0));
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.correct_season_mmr(1, array![(player(5), 2000)]);
}

#[test]
#[should_panic(expected: 'Pausable: paused')]
fn monitor_pause_stops_season_payouts() {
    let fixture = completed_season();
    post_top_at(@fixture, END + 100, array![player(0), player(1)]);
    grant_pauser(@fixture);
    fixture.ledger.pause();
    claim_season_at(@fixture, END + 100 + 3600, player(0));
}

#[test]
fn tied_mmr_uses_wallet_order_so_a_cutoff_tie_is_challengeable() {
    let mut preset = default_preset();
    preset.mmr.enabled = false;
    let fixture = deploy_fixture(preset);
    register_players(@fixture, 6);
    apply_results(@fixture, ranked_players(6));
    post_top_at(@fixture, END + 100, array![player(1), player(2)]);
    fixture.ledger.challenge_season(1, player(0));
    assert!(fixture.ledger.get_season(1).challenged);
}

#[test]
fn multiple_games_count_a_participant_once_and_accumulate_one_pool() {
    let fixture = completed_season();
    let next = GameKey { shard: 'other', game_id: 8 };
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.open_game(next, 1, PRESET_ID, START, END);
    for index in 0..6_u16 {
        fund_and_approve_player(@fixture, player(index), 500);
        start_cheat_caller_address(fixture.ledger_address, player(index));
        fixture.ledger.register(next, false, false);
    }
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    start_cheat_block_timestamp(fixture.ledger_address, START);
    fixture.ledger.apply_results(next, ranked_players(6));
    assert!(fixture.ledger.get_season(1).participant_count == 6);
    assert!(fixture.ledger.get_season(1).pool == 6000);
}

#[test]
fn sponsoring_before_registration_is_preserved_in_the_refund() {
    let fixture = deploy_fixture(default_preset());
    let owner = player(0);
    fund_and_approve_player(@fixture, owner, 700);
    start_cheat_caller_address(fixture.ledger_address, owner);
    fixture.ledger.fund(GAME_KEY, 200);
    fixture.ledger.register(GAME_KEY, false, false);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.cancel_game(GAME_KEY);
    start_cheat_caller_address(fixture.ledger_address, owner);
    fixture.ledger.refund(GAME_KEY);
    assert!(fixture.lords.balance_of(owner) == 700);
}

#[test]
#[should_panic(expected: "Ledger: game outside season")]
fn a_game_cannot_end_at_the_instant_its_result_ratings_freeze() {
    let fixture = deploy_fixture(default_preset());
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.open_game(GameKey { shard: 'shard', game_id: 99 }, 1, PRESET_ID, START, END + 100);
}

#[test]
fn frontier_season_chests_and_unfinished_game_custody_are_conserved_together() {
    let fixture = deploy_reward_fixture(5, 2000, 200);
    fund_and_approve_player(@fixture, ADMIN(), 1000);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.fund_frontier('shard', 1, PRESET_ID, START, 0x5eed, 1000);
    let unfinished = GameKey { shard: 'other', game_id: 8 };
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.open_game(unfinished, 1, PRESET_ID, START, END);
    fund_and_approve_player(@fixture, player(2), 500);
    start_cheat_caller_address(fixture.ledger_address, player(2));
    fixture.ledger.register(unfinished, false, false);
    register_players(@fixture, 2);
    apply_results(@fixture, ranked_players(2));
    assert!(fixture.lords.balance_of(fixture.ledger_address) == 2500);
    start_cheat_block_timestamp(fixture.ledger_address, END);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.pay('shard', 1, 'withdrawal', player(0), 1000);
    open_reward(@fixture, player(0), 1);
    assert!(fixture.ledger.get_season(1).pool == 800);
    assert!(fixture.ledger.get_game(unfinished).pool == 500);
    post_top_at(@fixture, END + 100, array![player(0)]);
    claim_season_at(@fixture, END + 100 + 3600, player(0));
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.abort_game(unfinished);
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
fn treasury_cut_is_taken_once_from_entries_flags_and_sponsors() {
    let mut preset = default_preset();
    preset.protocol_cut_bps = 2000;
    let fixture = deploy_fixture(preset);
    let owner = player(0);
    fund_and_approve_player(@fixture, owner, 2500);
    start_cheat_caller_address(fixture.ledger_address, owner);
    fixture.ledger.register(GAME_KEY, true, true);
    fixture.ledger.fund(GAME_KEY, 1000);
    stop_cheat_caller_address(fixture.ledger_address);
    apply_results(@fixture, ranked_players(1));
    assert!(fixture.lords.balance_of(TREASURY()) == 500);
    assert!(fixture.ledger.get_season(1).pool == 2000);
    assert!(fixture.lords.balance_of(fixture.ledger_address) == 2000);
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
        let metadata = ITestCollectibleDispatcher { contract_address: fixture.chest_address }
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
        let fixture = deploy_reward_fixture(outcome, 10000, 50);
        register_players(@fixture, 1);
        apply_results(@fixture, ranked_players(1));
        open_reward(@fixture, player(0), 1);
        if outcome < 5 {
            let items = test_items();
            assert!(
                ITestCollectibleDispatcher { contract_address: fixture.cosmetics_address }
                    .get_metadata_raw(1) == *items
                    .at(outcome.into())
                    .at(0),
            );
        } else if outcome == 5 {
            assert!(fixture.lords.balance_of(player(0)) == 50);
            assert!(fixture.ledger.get_season(1).chest_reserve == 450);
        } else if outcome == 6 {
            assert!(fixture.ledger.get_credits(player(0)).swords == 1);
        } else {
            assert!(fixture.ledger.get_credits(player(0)).shields == 1);
        }
    }
}

#[test]
fn posting_the_first_top_list_sweeps_reserve_and_late_chests_still_finish() {
    let fixture = deploy_reward_fixture(5, 2000, 700);
    register_players(@fixture, 2);
    apply_results(@fixture, ranked_players(2));
    request_reward(@fixture, player(0), 1);
    assert!(fixture.ledger.get_season(1).pool == 800);
    post_top_at(@fixture, END + 100, array![player(0)]);
    assert!(fixture.ledger.get_season(1).pool == 1000);
    assert!(fixture.ledger.get_season(1).chest_reserve == 0);
    let (_, allocation) = fixture.ledger.get_season_winner(1, 0);
    assert!(allocation == 1000);
    finish_reward(@fixture, 1, 999999);
    assert!(fixture.ledger.get_chest(1).finished);
    assert!(fixture.lords.balance_of(player(0)) == 0);
    claim_season_at(@fixture, END + 100 + 3600, player(0));
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
#[should_panic(expected: "Ledger: game preset differs from season")]
fn a_season_cannot_mix_chest_presets() {
    let fixture = deploy_fixture(default_preset());
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.register_preset(2, default_preset(), test_bands(), test_items());
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.open_game(GameKey { shard: 'shard', game_id: 8 }, 1, 2, START, END);
}

#[test]
#[should_panic(expected: "Ledger: game pool exceeds u128")]
fn all_sponsor_value_has_the_same_safe_arithmetic_bound_as_entries() {
    let fixture = deploy_fixture(default_preset());
    let amount = 0x100000000000000000000000000000000;
    fund_and_approve_player(@fixture, player(0), amount);
    start_cheat_caller_address(fixture.ledger_address, player(0));
    fixture.ledger.fund(GAME_KEY, amount);
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
    let fixture = deploy_reward_fixture(0, 2000, 700);
    register_players(@fixture, 1);
    apply_results(@fixture, ranked_players(1));
    request_reward(@fixture, player(0), 1);
    post_top_at(@fixture, END + 100, array![player(0)]);
    claim_season_at(@fixture, END + 100 + 3600, player(0));
    finish_reward(@fixture, 1, 999999);
    assert!(IERC721Dispatcher { contract_address: fixture.cosmetics_address }.owner_of(1) == player(0));
    assert!(fixture.lords.balance_of(player(0)) == 500);
}

#[test]
fn a_cosmetic_rarity_selects_from_all_its_items_using_an_independent_hash() {
    let fixture = deploy_ledger();
    let mut bands = array![];
    for band in 0_u32..5 {
        bands.append(ChestBandPreset { metadata: 0x301 + band.into(), odds: odds_for(0), lords_amount: 700 });
    }
    let items = array![array![1, 2, 3], array![4], array![5], array![6], array![7]];
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.register_preset(PRESET_ID, default_preset(), bands, items);
    assert!(fixture.ledger.get_cosmetic_items(PRESET_ID, 0) == array![1_u128, 2, 3]);
    fixture.ledger.open_season(1, PRESET_ID, START, END + 100);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.open_game(GAME_KEY, 1, PRESET_ID, START, END);
    stop_cheat_caller_address(fixture.ledger_address);
    register_players(@fixture, 1);
    apply_results(@fixture, ranked_players(1));
    open_reward(@fixture, player(0), 1);
    assert!(ITestCollectibleDispatcher { contract_address: fixture.cosmetics_address }.get_metadata_raw(1) == 2);
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
