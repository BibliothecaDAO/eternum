use game_ledger::contract::{IGameLedgerDispatcher, IGameLedgerDispatcherTrait, result_commitment};
use game_ledger::types::{MmrParams, PmParams, Preset};
use openzeppelin::access::accesscontrol::interface::{IAccessControlDispatcher, IAccessControlDispatcherTrait};
use openzeppelin::security::interface::{IPausableDispatcher, IPausableDispatcherTrait};
use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
use openzeppelin::token::erc721::interface::{IERC721Dispatcher, IERC721DispatcherTrait};
use openzeppelin::upgrades::interface::{IUpgradeableDispatcher, IUpgradeableDispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, get_class_hash, start_cheat_block_timestamp,
    start_cheat_caller_address, stop_cheat_block_timestamp, stop_cheat_caller_address,
};
use starknet::ContractAddress;

#[starknet::interface]
trait ITestLords<TState> {
    fn mint(ref self: TState, recipient: ContractAddress, amount: u256);
}

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
                IGameLedgerDispatcher { contract_address: ledger }.get_registration(super::GAME_ID, owner).registered,
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

    Fixture {
        ledger_address,
        ledger,
        lords_address,
        lords: IERC20Dispatcher { contract_address: lords_address },
        lords_minter: ITestLordsDispatcher { contract_address: lords_address },
    }
}

fn deploy_ledger() -> Fixture {
    deploy_ledger_with_passes('season_pass'.try_into().unwrap(), 'village_pass'.try_into().unwrap())
}

fn configure_game(fixture: Fixture, preset: Preset) -> Fixture {
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.register_preset(PRESET_ID, preset);
    stop_cheat_caller_address(fixture.ledger_address);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.open_game(GAME_ID, PRESET_ID, START, END);
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

#[test]
fn result_commitment_binds_game_order_and_chests() {
    let ranked = array![(player(0), 1, 3), (player(1), 1, 2)];
    assert!(
        result_commitment(GAME_ID, ranked.span()) == 0x3c7fe8cc71208719a97530868d02e7dc226bb064a5a01abcc48d964be511342,
        "result commitment should remain stable",
    );
    let reordered = array![(player(1), 1, 2), (player(0), 1, 3)];
    assert!(
        result_commitment(GAME_ID, reordered.span()) != result_commitment(GAME_ID, ranked.span()),
        "result commitment should bind row order",
    );
}

fn apply_results_at(fixture: @Fixture, timestamp: u64, ranked: Array<(ContractAddress, u16, u16)>) {
    start_cheat_block_timestamp(*fixture.ledger_address, timestamp);
    start_cheat_caller_address(*fixture.ledger_address, OPERATOR());
    fixture.ledger.apply_results(GAME_ID, ranked);
    stop_cheat_caller_address(*fixture.ledger_address);
    stop_cheat_block_timestamp(*fixture.ledger_address);
}

fn apply_results(fixture: @Fixture, ranked: Array<(ContractAddress, u16, u16)>) {
    apply_results_at(fixture, START, ranked);
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
fn deploys_with_value_plane_guardrails_engaged() {
    let fixture = deploy_ledger();
    let pausable = IPausableDispatcher { contract_address: fixture.ledger_address };

    assert!(!pausable.is_paused(), "ledger should deploy active");
    assert!(!fixture.ledger.is_pm_enabled(), "prediction markets should deploy disabled");
    assert!(fixture.ledger.get_reserve() == 0, "prediction-market reserve should deploy empty");
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
#[should_panic(expected: 'Pausable: paused')]
fn paused_ledger_rejects_new_sponsorship() {
    let fixture = deploy_fixture(default_preset());
    let sponsor = player(0);
    fund_and_approve_player(@fixture, sponsor, 500);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.pause();
    stop_cheat_caller_address(fixture.ledger_address);

    start_cheat_caller_address(fixture.ledger_address, sponsor);
    fixture.ledger.fund(GAME_ID, 500);
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
    fixture.ledger.register_preset(PRESET_ID, default_preset());
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
    fixture.ledger.register_with_pass(GAME_ID, token_id);
    stop_cheat_caller_address(fixture.ledger_address);

    let registration = fixture.ledger.get_registration(GAME_ID, owner);
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
    fixture.ledger.register_with_pass(GAME_ID, 42);
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
    fixture.ledger.register_with_pass(GAME_ID, token_id);
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
    fixture.ledger.register_village(GAME_ID, token_id);
    stop_cheat_caller_address(fixture.ledger_address);

    assert!(fixture.ledger.get_registration(GAME_ID, owner).registered, "village registration should be recorded");
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
    fixture.ledger.register_village(GAME_ID, token_id);
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
#[should_panic(expected: 'Pausable: paused')]
fn paused_ledger_rejects_refunds() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 1);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.cancel_game(GAME_ID);
    stop_cheat_caller_address(fixture.ledger_address);
    start_cheat_caller_address(fixture.ledger_address, ADMIN());
    fixture.ledger.pause();
    stop_cheat_caller_address(fixture.ledger_address);

    start_cheat_caller_address(fixture.ledger_address, player(0));
    fixture.ledger.refund(GAME_ID);
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
    fixture.ledger.register_with_pass(GAME_ID, token_id);
    stop_cheat_caller_address(fixture.ledger_address);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.cancel_game(GAME_ID);
    stop_cheat_caller_address(fixture.ledger_address);

    start_cheat_caller_address(fixture.ledger_address, owner);
    fixture.ledger.refund(GAME_ID);
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
    fixture.ledger.register_village(GAME_ID, token_id);
    stop_cheat_caller_address(fixture.ledger_address);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.cancel_game(GAME_ID);
    stop_cheat_caller_address(fixture.ledger_address);

    start_cheat_caller_address(fixture.ledger_address, owner);
    fixture.ledger.refund(GAME_ID);
    stop_cheat_caller_address(fixture.ledger_address);

    assert!(IERC721Dispatcher { contract_address: pass_address }.owner_of(token_id) == owner, "pass was not restored");
}

#[test]
fn started_abandoned_game_refunds_every_entrant_after_end() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 2);
    start_cheat_block_timestamp(fixture.ledger_address, END);
    start_cheat_caller_address(fixture.ledger_address, OPERATOR());
    fixture.ledger.abort_game(GAME_ID);
    stop_cheat_caller_address(fixture.ledger_address);

    let mut index: u16 = 0;
    while index < 2 {
        let owner = player(index);
        start_cheat_caller_address(fixture.ledger_address, owner);
        fixture.ledger.refund(GAME_ID);
        stop_cheat_caller_address(fixture.ledger_address);
        assert!(fixture.lords.balance_of(owner) == 500, "entrant should recover the registration payment");
        index += 1;
    }
    stop_cheat_block_timestamp(fixture.ledger_address);

    assert!(fixture.ledger.get_game(GAME_ID).pool == 0, "aborted pool should be empty");
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
    fixture.ledger.apply_results(GAME_ID, ranked_players(1));
}

#[test]
fn operator_can_resolve_after_start_before_scheduled_end() {
    let fixture = deploy_fixture(default_preset());
    register_players(@fixture, 1);
    apply_results_at(@fixture, START, ranked_players(1));

    assert!(fixture.ledger.get_game(GAME_ID).finalized, "an ended match should settle before its scheduled deadline");
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
    assert!((first.payout, second.payout, third.payout) == (407, 407, 383), "1,1,3 payout fixture changed");
    assert!((first.mmr_after, second.mmr_after, third.mmr_after) == (1016, 1016, 991), "1,1,3 MMR fixture changed");
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
    assert!(
        (first.payout, second.payout, third.payout, fourth.payout) == (424, 399, 399, 375),
        "1,2,2,4 payout fixture changed",
    );
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
    fixture.ledger.register(GAME_ID, true, false);
    stop_cheat_caller_address(fixture.ledger_address);
    apply_results(@fixture, array![(owner, 1, 0)]);

    let registration = fixture.ledger.get_registration(GAME_ID, owner);
    assert!(registration.sword, "sword purchase should be recorded");
    assert!(registration.flags_consumed, "final results should consume paid flags");
}
