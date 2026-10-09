use core::poseidon::poseidon_hash_span;
use game_ledger::types::{
    BlitzSeason, Chest, Credits, FrontierSeason, Game, GameKey, PlayerResult, Preset, RankedPlayer, Registration,
    WithdrawalPayment,
};
use starknet::ContractAddress;

pub const PAUSER_ROLE: felt252 = selector!("PAUSER_ROLE");
pub const OPERATOR_ROLE: felt252 = selector!("OPERATOR_ROLE");
const BPS: u256 = 10_000;
const PAYOUT_WEIGHT_SCALE: u256 = 1_000_000_000_000_000_000;
const SEASON_REVIEW_SECONDS: u64 = 3600;
const MMR_PRECISION: u256 = 1_000_000_000_000_000_000;
const NO_PASS: u8 = 0;
const SEASON_PASS: u8 = 1;
const VILLAGE_PASS: u8 = 2;

pub fn result_commitment(key: GameKey, ranked: Span<RankedPlayer>) -> felt252 {
    let mut payload = array!['ETERNUM_BLITZ_RESULT', 2, key.shard, key.game_id.into(), ranked.len().into()];
    for row in ranked {
        payload.append((*row.wallet).into());
        payload.append((*row.points).into());
        payload.append((*row.rank).into());
        payload.append((*row.chest.kind).into());
        payload.append((*row.chest.cosmetic).into());
        payload.append((*row.chest.lords.low).into());
        payload.append((*row.chest.lords.high).into());
    }
    poseidon_hash_span(payload.span())
}

#[starknet::interface]
pub trait IGameLedger<TState> {
    fn pause(ref self: TState);
    fn unpause(ref self: TState);
    fn fund_frontier(ref self: TState, shard: felt252, season_id: u32, start: u64, end: u64, amount: u256);
    fn pay(ref self: TState, shard: felt252, season_id: u32, claim_id: felt252, wallet: ContractAddress, amount: u256);
    fn close_frontier(ref self: TState, shard: felt252, season_id: u32);
    fn get_frontier(self: @TState, shard: felt252, season_id: u32) -> FrontierSeason;
    fn frontier_unlocked(self: @TState, shard: felt252, season_id: u32) -> u256;
    fn get_payment(self: @TState, shard: felt252, claim_id: felt252) -> WithdrawalPayment;
    fn rescue_token(ref self: TState, token: ContractAddress, recipient: ContractAddress, amount: u256);
    fn register_preset(ref self: TState, preset_id: u32, preset: Preset);
    fn open_season(ref self: TState, season_id: u32, preset_id: u32, start: u64, end: u64);
    fn get_season(self: @TState, season_id: u32) -> BlitzSeason;
    fn post_season_top(ref self: TState, season_id: u32, winners: Array<ContractAddress>);
    fn challenge_season(ref self: TState, season_id: u32, omitted: ContractAddress);
    fn claim_season(ref self: TState, season_id: u32);
    fn correct_season_mmr(ref self: TState, season_id: u32, updates: Array<(ContractAddress, u128)>);
    fn get_season_mmr(self: @TState, season_id: u32, owner: ContractAddress) -> u128;
    fn get_season_winner(self: @TState, season_id: u32, index: u32) -> (ContractAddress, u256);
    fn season_claimed(self: @TState, season_id: u32, owner: ContractAddress) -> bool;
    fn open_game(ref self: TState, key: GameKey, season_id: u32, preset_id: u32, start: u64, end: u64);
    fn register(ref self: TState, key: GameKey, sword: bool, shield: bool);
    fn register_with_pass(ref self: TState, key: GameKey, pass_id: u256);
    fn register_village(ref self: TState, key: GameKey, village_pass_id: u256);
    fn fund(ref self: TState, key: GameKey, amount: u256);
    fn cancel_game(ref self: TState, key: GameKey);
    fn abort_game(ref self: TState, key: GameKey);
    fn refund(ref self: TState, key: GameKey);
    fn apply_results(ref self: TState, key: GameKey, ranked: Array<RankedPlayer>);
    fn open_chest(ref self: TState, token_id: u256);
    fn get_chest(self: @TState, token_id: u256) -> Chest;
    fn get_credits(self: @TState, owner: ContractAddress) -> Credits;
    fn get_preset(self: @TState, preset_id: u32) -> Preset;
    fn get_game(self: @TState, key: GameKey) -> Game;
    fn get_registration(self: @TState, key: GameKey, owner: ContractAddress) -> Registration;
    fn get_registered_owner(self: @TState, key: GameKey, index: u16) -> ContractAddress;
    fn get_player_result(self: @TState, key: GameKey, owner: ContractAddress) -> PlayerResult;
}

#[starknet::interface]
pub trait IMMRToken<TState> {
    fn get_player_mmr(self: @TState, player: ContractAddress) -> u256;
    fn update_mmr_batch(ref self: TState, updates: Array<(ContractAddress, u256)>);
}

#[starknet::interface]
pub trait IPassBurn<TState> {
    fn burn(ref self: TState, token_id: u256);
}

#[starknet::interface]
pub trait IPassRestore<TState> {
    fn restore(ref self: TState, recipient: ContractAddress, token_id: u256);
}

#[starknet::interface]
pub trait ISeasonPassMetadata<TState> {
    fn get_encoded_metadata(self: @TState, token_id: u16) -> (felt252, felt252, felt252);
}

#[starknet::interface]
pub trait ICollectible<TState> {
    fn mint_with_id(ref self: TState, recipient: ContractAddress, attributes_raw: u128) -> u256;
    fn safe_mint(ref self: TState, recipient: ContractAddress, attributes_raw: u128);
    fn burn(ref self: TState, token_id: u256);
}

#[starknet::contract]
pub mod GameLedger {
    use core::dict::Felt252Dict;
    use core::num::traits::Zero;
    use game_ledger::mmr::MmrCalculatorImpl;
    use game_ledger::types::{
        BlitzSeason, Chest, ChestContent, Credits, FrontierSeason, Game, GameKey, PlayerResult, Preset, RankedPlayer,
        Registration, WithdrawalPayment,
    };
    use openzeppelin::access::accesscontrol::{AccessControlComponent, DEFAULT_ADMIN_ROLE};
    use openzeppelin::introspection::src5::SRC5Component;
    use openzeppelin::security::PausableComponent;
    use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use openzeppelin::token::erc721::interface::{IERC721Dispatcher, IERC721DispatcherTrait};
    use openzeppelin::upgrades::UpgradeableComponent;
    use openzeppelin::upgrades::interface::IUpgradeable;
    use starknet::storage::{Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ClassHash, ContractAddress};
    use super::{
        BPS, ICollectibleDispatcher, ICollectibleDispatcherTrait, IGameLedger, IMMRTokenDispatcher,
        IMMRTokenDispatcherTrait, IPassBurnDispatcher, IPassBurnDispatcherTrait, IPassRestoreDispatcher,
        IPassRestoreDispatcherTrait, ISeasonPassMetadataDispatcher, ISeasonPassMetadataDispatcherTrait, MMR_PRECISION,
        NO_PASS, OPERATOR_ROLE, PAUSER_ROLE, PAYOUT_WEIGHT_SCALE, SEASON_PASS, SEASON_REVIEW_SECONDS, VILLAGE_PASS,
        result_commitment,
    };

    component!(path: SRC5Component, storage: src5, event: SRC5Event);
    component!(path: AccessControlComponent, storage: accesscontrol, event: AccessControlEvent);
    component!(path: PausableComponent, storage: pausable, event: PausableEvent);
    component!(path: UpgradeableComponent, storage: upgradeable, event: UpgradeableEvent);

    #[abi(embed_v0)]
    impl AccessControlMixinImpl = AccessControlComponent::AccessControlMixinImpl<ContractState>;
    impl AccessControlInternalImpl = AccessControlComponent::InternalImpl<ContractState>;
    #[abi(embed_v0)]
    impl PausableImpl = PausableComponent::PausableImpl<ContractState>;
    impl PausableInternalImpl = PausableComponent::InternalImpl<ContractState>;
    impl UpgradeableInternalImpl = UpgradeableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        frontier: Map<(felt252, u32), FrontierSeason>,
        payments: Map<(felt252, felt252), WithdrawalPayment>,
        treasury: ContractAddress,
        lords: ContractAddress,
        mmr_token: ContractAddress,
        season_pass: ContractAddress,
        village_pass: ContractAddress,
        loot_chest: ContractAddress,
        cosmetics: ContractAddress,
        seasons: Map<u32, BlitzSeason>,
        latest_season_end: u64,
        season_participants: Map<(u32, ContractAddress), bool>,
        season_mmrs: Map<(u32, ContractAddress), u128>,
        season_winners: Map<(u32, u32), ContractAddress>,
        season_allocations: Map<(u32, u32), u256>,
        season_claims: Map<(u32, ContractAddress), bool>,
        chests: Map<u256, Chest>,
        credits: Map<ContractAddress, Credits>,
        presets: Map<u32, Preset>,
        preset_exists: Map<u32, bool>,
        games: Map<GameKey, Game>,
        registrations: Map<(GameKey, ContractAddress), Registration>,
        registered_owners: Map<(GameKey, u16), ContractAddress>,
        results: Map<(GameKey, ContractAddress), PlayerResult>,
        result_seen: Map<(GameKey, ContractAddress), bool>,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
        #[substorage(v0)]
        accesscontrol: AccessControlComponent::Storage,
        #[substorage(v0)]
        pausable: PausableComponent::Storage,
        #[substorage(v0)]
        upgradeable: UpgradeableComponent::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        SRC5Event: SRC5Component::Event,
        #[flat]
        AccessControlEvent: AccessControlComponent::Event,
        #[flat]
        PausableEvent: PausableComponent::Event,
        #[flat]
        UpgradeableEvent: UpgradeableComponent::Event,
        FrontierFunded: FrontierFunded,
        WithdrawalPaid: WithdrawalPaid,
        FrontierClosed: FrontierClosed,
        PresetRegistered: PresetRegistered,
        GameOpened: GameOpened,
        Registered: Registered,
        Funded: Funded,
        GameCancelled: GameCancelled,
        GameAborted: GameAborted,
        Refunded: Refunded,
        SeasonOpened: SeasonOpened,
        SeasonTopPosted: SeasonTopPosted,
        SeasonChallenged: SeasonChallenged,
        SeasonPaid: SeasonPaid,
        SeasonMmrCorrected: SeasonMmrCorrected,
        ResultsApplied: ResultsApplied,
        ChestMinted: ChestMinted,
        ChestOpened: ChestOpened,
    }

    #[derive(Drop, starknet::Event)]
    struct FrontierFunded {
        #[key]
        shard: felt252,
        #[key]
        season_id: u32,
        start: u64,
        end: u64,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct WithdrawalPaid {
        #[key]
        shard: felt252,
        #[key]
        claim_id: felt252,
        season_id: u32,
        wallet: ContractAddress,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct FrontierClosed {
        #[key]
        shard: felt252,
        #[key]
        season_id: u32,
        returned: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct PresetRegistered {
        #[key]
        preset_id: u32,
    }

    #[derive(Drop, starknet::Event)]
    struct GameOpened {
        #[key]
        key: GameKey,
        preset_id: u32,
        start: u64,
        end: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct Registered {
        #[key]
        key: GameKey,
        #[key]
        owner: ContractAddress,
        realm_id: u256,
        metadata: (felt252, felt252, felt252),
        pass_kind: u8,
    }

    #[derive(Drop, starknet::Event)]
    struct Funded {
        #[key]
        key: GameKey,
        #[key]
        funder: ContractAddress,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct GameCancelled {
        #[key]
        key: GameKey,
    }

    #[derive(Drop, starknet::Event)]
    struct GameAborted {
        #[key]
        key: GameKey,
    }

    #[derive(Drop, starknet::Event)]
    struct Refunded {
        #[key]
        key: GameKey,
        #[key]
        owner: ContractAddress,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct SeasonOpened {
        #[key]
        season_id: u32,
        preset_id: u32,
        start: u64,
        end: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct ResultsApplied {
        #[key]
        key: GameKey,
        season_id: u32,
        result_commitment: felt252,
        pool: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct ChestMinted {
        #[key]
        key: GameKey,
        #[key]
        wallet: ContractAddress,
        token_id: u256,
        content: ChestContent,
    }

    #[derive(Drop, starknet::Event)]
    struct ChestOpened {
        #[key]
        token_id: u256,
        #[key]
        wallet: ContractAddress,
        content: ChestContent,
    }

    #[derive(Drop, starknet::Event)]
    struct SeasonTopPosted {
        #[key]
        season_id: u32,
        winners: Span<ContractAddress>,
        review_until: u64,
        pool: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct SeasonChallenged {
        #[key]
        season_id: u32,
        #[key]
        omitted: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct SeasonPaid {
        #[key]
        season_id: u32,
        #[key]
        owner: ContractAddress,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct SeasonMmrCorrected {
        #[key]
        season_id: u32,
        updates: Span<(ContractAddress, u128)>,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        admin: ContractAddress,
        operator: ContractAddress,
        treasury: ContractAddress,
        lords: ContractAddress,
        mmr_token: ContractAddress,
        season_pass: ContractAddress,
        village_pass: ContractAddress,
        loot_chest: ContractAddress,
        cosmetics: ContractAddress,
    ) {
        self
            .assert_constructor_addresses(
                admin, operator, treasury, lords, mmr_token, season_pass, village_pass, loot_chest, cosmetics,
            );
        self.accesscontrol.initializer();
        self.accesscontrol._grant_role(DEFAULT_ADMIN_ROLE, admin);
        self.accesscontrol._grant_role(OPERATOR_ROLE, operator);
        self.treasury.write(treasury);
        self.lords.write(lords);
        self.mmr_token.write(mmr_token);
        self.season_pass.write(season_pass);
        self.village_pass.write(village_pass);
        self.loot_chest.write(loot_chest);
        self.cosmetics.write(cosmetics);
    }

    #[abi(embed_v0)]
    impl UpgradeableImpl of IUpgradeable<ContractState> {
        fn upgrade(ref self: ContractState, new_class_hash: ClassHash) {
            self.accesscontrol.assert_only_role(DEFAULT_ADMIN_ROLE);
            self.upgradeable.upgrade(new_class_hash);
        }
    }

    #[abi(embed_v0)]
    impl GameLedgerImpl of IGameLedger<ContractState> {
        fn pause(ref self: ContractState) {
            let caller = starknet::get_caller_address();
            assert!(
                self.accesscontrol.has_role(DEFAULT_ADMIN_ROLE, caller)
                    || self.accesscontrol.has_role(PAUSER_ROLE, caller),
                "Ledger: caller cannot pause",
            );
            self.pausable.pause();
        }

        fn unpause(ref self: ContractState) {
            self.accesscontrol.assert_only_role(DEFAULT_ADMIN_ROLE);
            self.pausable.unpause();
        }

        fn fund_frontier(ref self: ContractState, shard: felt252, season_id: u32, start: u64, end: u64, amount: u256) {
            self.accesscontrol.assert_only_role(DEFAULT_ADMIN_ROLE);
            assert!(shard != 0, "Ledger: zero shard");
            assert!(!self.frontier.entry((shard, season_id)).read().funded, "Ledger: season already funded");
            assert!(starknet::get_block_timestamp() <= start && start < end, "Ledger: invalid season window");
            assert!(amount > 0 && amount <= 0xffffffffffffffffffffffffffffffff, "Ledger: invalid season funding");
            self
                .frontier
                .entry((shard, season_id))
                .write(FrontierSeason { funded: true, start, end, pool: amount, ..Default::default() });
            self.pull_lords(starknet::get_caller_address(), amount);
            self.emit(FrontierFunded { shard, season_id, start, end, amount });
        }

        fn pay(
            ref self: ContractState,
            shard: felt252,
            season_id: u32,
            claim_id: felt252,
            wallet: ContractAddress,
            amount: u256,
        ) {
            self.accesscontrol.assert_only_role(OPERATOR_ROLE);
            if self.payments.entry((shard, claim_id)).read().paid {
                return;
            }
            self.pausable.assert_not_paused();
            assert!(claim_id != 0 && wallet.is_non_zero() && amount > 0, "Ledger: invalid withdrawal");
            let mut season = self.get_frontier(shard, season_id);
            assert!(!season.closed, "Ledger: season closed");
            assert!(amount <= self.frontier_unlocked(shard, season_id) - season.paid, "Ledger: unlock exceeded");
            season.paid += amount;
            self.frontier.entry((shard, season_id)).write(season);
            self.payments.entry((shard, claim_id)).write(WithdrawalPayment { paid: true, season_id, wallet, amount });
            self.send_lords(wallet, amount);
            self.emit(WithdrawalPaid { shard, claim_id, season_id, wallet, amount });
        }

        fn close_frontier(ref self: ContractState, shard: felt252, season_id: u32) {
            self.accesscontrol.assert_only_role(DEFAULT_ADMIN_ROLE);
            self.pausable.assert_not_paused();
            let mut season = self.get_frontier(shard, season_id);
            assert!(!season.closed, "Ledger: season closed");
            assert!(starknet::get_block_timestamp() >= season.end, "Ledger: season has not ended");
            let returned = season.pool - season.paid;
            season.closed = true;
            self.frontier.entry((shard, season_id)).write(season);
            self.send_lords(self.treasury.read(), returned);
            self.emit(FrontierClosed { shard, season_id, returned });
        }

        fn get_frontier(self: @ContractState, shard: felt252, season_id: u32) -> FrontierSeason {
            let season = self.frontier.entry((shard, season_id)).read();
            assert!(season.funded, "Ledger: unknown Frontier season");
            season
        }

        fn frontier_unlocked(self: @ContractState, shard: felt252, season_id: u32) -> u256 {
            let season = self.get_frontier(shard, season_id);
            let now = starknet::get_block_timestamp();
            if now <= season.start {
                0
            } else if now >= season.end {
                season.pool
            } else {
                season.pool * (now - season.start).into() / (season.end - season.start).into()
            }
        }

        fn get_payment(self: @ContractState, shard: felt252, claim_id: felt252) -> WithdrawalPayment {
            self.payments.entry((shard, claim_id)).read()
        }

        fn rescue_token(ref self: ContractState, token: ContractAddress, recipient: ContractAddress, amount: u256) {
            self.accesscontrol.assert_only_role(DEFAULT_ADMIN_ROLE);
            assert!(token != self.lords.read(), "Ledger: LORDS are managed funds");
            assert!(recipient.is_non_zero(), "Ledger: rescue recipient is zero");
            assert!(
                IERC20Dispatcher { contract_address: token }.transfer(recipient, amount), "Ledger: token rescue failed",
            );
        }

        fn register_preset(ref self: ContractState, preset_id: u32, preset: Preset) {
            self.accesscontrol.assert_only_role(DEFAULT_ADMIN_ROLE);
            assert!(!self.preset_exists.entry(preset_id).read(), "Ledger: preset already registered");
            self.assert_valid_preset(preset);
            self.presets.entry(preset_id).write(preset);
            self.preset_exists.entry(preset_id).write(true);
            self.emit(PresetRegistered { preset_id });
        }

        fn open_season(ref self: ContractState, season_id: u32, preset_id: u32, start: u64, end: u64) {
            self.accesscontrol.assert_only_role(DEFAULT_ADMIN_ROLE);
            assert!(!self.seasons.entry(season_id).read().exists, "Ledger: season already opened");
            assert!(self.preset_exists.entry(preset_id).read(), "Ledger: unknown preset");
            assert!(starknet::get_block_timestamp() <= start && start < end, "Ledger: invalid season window");
            assert!(start >= self.latest_season_end.read(), "Ledger: overlapping seasons");
            self.latest_season_end.write(end);
            self
                .seasons
                .entry(season_id)
                .write(BlitzSeason { exists: true, preset_id, start, end, ..Default::default() });
            self.emit(SeasonOpened { season_id, preset_id, start, end });
        }

        fn get_season(self: @ContractState, season_id: u32) -> BlitzSeason {
            let season = self.seasons.entry(season_id).read();
            assert!(season.exists, "Ledger: unknown Blitz season");
            season
        }

        fn post_season_top(ref self: ContractState, season_id: u32, winners: Array<ContractAddress>) {
            self.accesscontrol.assert_only_role(OPERATOR_ROLE);
            let mut season = self.get_season(season_id);
            self.assert_season_top_open(season);
            let preset = self.presets.entry(season.preset_id).read();
            self.validate_season_top(season_id, season, winners.span(), preset);
            self.write_season_allocations(season_id, season, winners.span(), preset);
            season.posted = true;
            season.challenged = false;
            season.top_count = winners.len();
            season.review_until = starknet::get_block_timestamp() + SEASON_REVIEW_SECONDS;
            self.seasons.entry(season_id).write(season);
            self
                .emit(
                    SeasonTopPosted {
                        season_id, winners: winners.span(), review_until: season.review_until, pool: season.pool,
                    },
                );
        }

        fn challenge_season(ref self: ContractState, season_id: u32, omitted: ContractAddress) {
            let mut season = self.get_season(season_id);
            assert!(season.posted && starknet::get_block_timestamp() < season.review_until, "Ledger: review closed");
            let mmr = self.get_season_mmr(season_id, omitted);
            assert!(
                self.season_position(season_id, season.top_count, omitted).is_none(), "Ledger: winner already listed",
            );
            let preset = self.presets.entry(season.preset_id).read();
            let short = season
                .top_count < SeasonWriterImpl::winner_count(season.participant_count, preset.paid_fraction_bps);
            if !short {
                let cutoff = self.season_winners.entry((season_id, season.top_count - 1)).read();
                assert!(
                    SeasonWriterImpl::outranks(omitted, mmr, cutoff, self.get_season_mmr(season_id, cutoff)),
                    "Ledger: does not beat cutoff",
                );
            }
            season.challenged = true;
            self.seasons.entry(season_id).write(season);
            self.emit(SeasonChallenged { season_id, omitted });
        }

        fn claim_season(ref self: ContractState, season_id: u32) {
            self.pausable.assert_not_paused();
            let owner = starknet::get_caller_address();
            let mut season = self.get_season(season_id);
            self.assert_season_claim_open(season);
            let position = self.season_position(season_id, season.top_count, owner).expect('Ledger: not a winner');
            if self.season_claims.entry((season_id, owner)).read() {
                return;
            }
            let amount = self.season_allocations.entry((season_id, position)).read();
            season.settlement_started = true;
            season.paid += amount;
            self.seasons.entry(season_id).write(season);
            self.season_claims.entry((season_id, owner)).write(true);
            self.send_lords(owner, amount);
            self.emit(SeasonPaid { season_id, owner, amount });
        }

        fn correct_season_mmr(ref self: ContractState, season_id: u32, updates: Array<(ContractAddress, u128)>) {
            self.accesscontrol.assert_only_role(DEFAULT_ADMIN_ROLE);
            let mut season = self.get_season(season_id);
            assert!(!season.settlement_started, "Ledger: season payout started");
            assert!(!updates.is_empty(), "Ledger: empty MMR correction");
            let mut token_updates = array![];
            for (owner, mmr) in updates.span() {
                self.get_season_mmr(season_id, *owner);
                assert!(*mmr >= 100, "Ledger: MMR below token floor");
                self.season_mmrs.entry((season_id, *owner)).write(*mmr);
                token_updates.append((*owner, Into::<u128, u256>::into(*mmr) * MMR_PRECISION));
            }
            season.challenged = season.posted;
            self.seasons.entry(season_id).write(season);
            IMMRTokenDispatcher { contract_address: self.mmr_token.read() }.update_mmr_batch(token_updates);
            self.emit(SeasonMmrCorrected { season_id, updates: updates.span() });
        }

        fn get_season_mmr(self: @ContractState, season_id: u32, owner: ContractAddress) -> u128 {
            assert!(self.season_participants.entry((season_id, owner)).read(), "Ledger: not a season participant");
            self.season_mmrs.entry((season_id, owner)).read()
        }

        fn get_season_winner(self: @ContractState, season_id: u32, index: u32) -> (ContractAddress, u256) {
            let season = self.get_season(season_id);
            assert!(season.posted && index < season.top_count, "Ledger: winner index out of bounds");
            (
                self.season_winners.entry((season_id, index)).read(),
                self.season_allocations.entry((season_id, index)).read(),
            )
        }

        fn season_claimed(self: @ContractState, season_id: u32, owner: ContractAddress) -> bool {
            self.season_claims.entry((season_id, owner)).read()
        }

        fn open_game(ref self: ContractState, key: GameKey, season_id: u32, preset_id: u32, start: u64, end: u64) {
            self.accesscontrol.assert_only_role(OPERATOR_ROLE);
            assert!(key.shard != 0, "Ledger: zero shard");
            assert!(!self.games.entry(key).read().exists, "Ledger: game already opened");
            assert!(self.preset_exists.entry(preset_id).read(), "Ledger: unknown preset");
            assert!(starknet::get_block_timestamp() < start, "Ledger: start must be in the future");
            assert!(start < end, "Ledger: invalid game window");

            let season = self.get_season(season_id);
            assert!(start >= season.start && end < season.end, "Ledger: game outside season");
            self.games.entry(key).write(Game { exists: true, season_id, preset_id, start, end, ..Default::default() });
            self.emit(GameOpened { key, preset_id, start, end });
        }

        fn register(ref self: ContractState, key: GameKey, sword: bool, shield: bool) {
            let owner = starknet::get_caller_address();
            let game = self.assert_registration_open(key, owner);
            let preset = self.presets.entry(game.preset_id).read();
            let payment = self.record_paid_registration(key, owner, sword, shield, preset);
            self.pull_lords(owner, payment);
            self.emit_registration(key, owner, 0, (0, 0, 0), NO_PASS);
        }

        fn register_with_pass(ref self: ContractState, key: GameKey, pass_id: u256) {
            let owner = starknet::get_caller_address();
            self.assert_registration_open(key, owner);
            let season_pass = self.season_pass.read();
            assert!(
                IERC721Dispatcher { contract_address: season_pass }.owner_of(pass_id) == owner,
                "Ledger: not pass owner",
            );
            assert!(pass_id <= 0xffff, "Ledger: pass id exceeds u16");
            let metadata = ISeasonPassMetadataDispatcher { contract_address: season_pass }
                .get_encoded_metadata(pass_id.try_into().unwrap());

            self.record_pass_registration(key, owner, pass_id, SEASON_PASS);
            IPassBurnDispatcher { contract_address: season_pass }.burn(pass_id);
            self.emit_registration(key, owner, pass_id, metadata, SEASON_PASS);
        }

        fn register_village(ref self: ContractState, key: GameKey, village_pass_id: u256) {
            let owner = starknet::get_caller_address();
            self.assert_registration_open(key, owner);
            let village_pass = self.village_pass.read();
            assert!(
                IERC721Dispatcher { contract_address: village_pass }.owner_of(village_pass_id) == owner,
                "Ledger: not village pass owner",
            );
            assert!(village_pass_id <= 0xffff, "Ledger: village pass id exceeds u16");

            self.record_pass_registration(key, owner, village_pass_id, VILLAGE_PASS);
            IPassBurnDispatcher { contract_address: village_pass }.burn(village_pass_id);
            self.emit_registration(key, owner, village_pass_id, (0, 0, 0), VILLAGE_PASS);
        }

        fn fund(ref self: ContractState, key: GameKey, amount: u256) {
            let funder = starknet::get_caller_address();
            let game = self.assert_game_open_before_start(key);
            assert!(amount > 0, "Ledger: zero funding");

            let mut registration = self.registrations.entry((key, funder)).read();
            registration.paid += amount;
            self.registrations.entry((key, funder)).write(registration);
            self.add_to_pool(key, game, amount);
            self.pull_lords(funder, amount);
            self.emit(Funded { key, funder, amount });
        }

        fn cancel_game(ref self: ContractState, key: GameKey) {
            self.accesscontrol.assert_only_role(OPERATOR_ROLE);
            let game = self.assert_game_open_before_start(key);
            self.open_refunds(key, game);
            self.emit(GameCancelled { key });
        }

        fn abort_game(ref self: ContractState, key: GameKey) {
            self.accesscontrol.assert_only_role(OPERATOR_ROLE);
            let game = self.games.entry(key).read();
            assert!(game.exists, "Ledger: unknown game");
            assert!(!game.cancelled && !game.finalized, "Ledger: game closed");
            assert!(starknet::get_block_timestamp() >= game.end, "Ledger: game has not ended");

            self.open_refunds(key, game);
            self.emit(GameAborted { key });
        }

        fn refund(ref self: ContractState, key: GameKey) {
            self.pausable.assert_not_paused();
            let owner = starknet::get_caller_address();
            let mut game = self.games.entry(key).read();
            assert!(game.exists && game.cancelled, "Ledger: game not cancelled");
            let mut registration = self.registrations.entry((key, owner)).read();
            let amount = registration.paid;
            let pass_kind = registration.pass_kind;
            let pass_id = registration.realm_id;
            assert!(
                amount > 0 || pass_kind != NO_PASS || registration.sword_credit || registration.shield_credit,
                "Ledger: nothing to refund",
            );
            self.restore_credits(owner, registration);
            registration.sword_credit = false;
            registration.shield_credit = false;
            registration.paid = 0;
            registration.pass_kind = NO_PASS;
            game.pool -= amount;
            self.registrations.entry((key, owner)).write(registration);
            self.games.entry(key).write(game);
            if amount > 0 {
                self.send_lords(owner, amount);
            }
            self.restore_pass(owner, pass_id, pass_kind);
            self.emit(Refunded { key, owner, amount });
        }

        fn apply_results(ref self: ContractState, key: GameKey, ranked: Array<RankedPlayer>) {
            self.accesscontrol.assert_only_role(OPERATOR_ROLE);
            let game = self.games.entry(key).read();
            self.assert_results_open(game);
            let preset = self.presets.entry(game.preset_id).read();
            self.validate_and_record_results(key, game.registered_count, ranked.span());
            let (pool, commitment) = self.finalize_game_pool(key, game, ranked.span(), preset);
            self.apply_mmr(key, ranked.span(), preset);
            self.record_season_players(game.season_id, key, ranked.span());
            self.mint_chests(key, ranked.span(), preset);
            self.emit(ResultsApplied { key, season_id: game.season_id, result_commitment: commitment, pool });
        }

        fn open_chest(ref self: ContractState, token_id: u256) {
            self.pausable.assert_not_paused();
            let wallet = starknet::get_caller_address();
            let mut chest = self.get_chest(token_id);
            assert!(!chest.opened, "Ledger: chest already opened");
            assert!(
                IERC721Dispatcher { contract_address: self.loot_chest.read() }.owner_of(token_id) == wallet,
                "Ledger: not chest owner",
            );
            chest.opened = true;
            self.chests.entry(token_id).write(chest);
            ICollectibleDispatcher { contract_address: self.loot_chest.read() }.burn(token_id);
            self.deliver_chest(wallet, chest.content);
            self.emit(ChestOpened { token_id, wallet, content: chest.content });
        }

        fn get_chest(self: @ContractState, token_id: u256) -> Chest {
            let chest = self.chests.entry(token_id).read();
            assert!(chest.exists, "Ledger: unknown chest");
            chest
        }

        fn get_credits(self: @ContractState, owner: ContractAddress) -> Credits {
            self.credits.entry(owner).read()
        }

        fn get_preset(self: @ContractState, preset_id: u32) -> Preset {
            assert!(self.preset_exists.entry(preset_id).read(), "Ledger: unknown preset");
            self.presets.entry(preset_id).read()
        }

        fn get_game(self: @ContractState, key: GameKey) -> Game {
            let game = self.games.entry(key).read();
            assert!(game.exists, "Ledger: unknown game");
            game
        }

        fn get_registration(self: @ContractState, key: GameKey, owner: ContractAddress) -> Registration {
            self.registrations.entry((key, owner)).read()
        }

        fn get_registered_owner(self: @ContractState, key: GameKey, index: u16) -> ContractAddress {
            let game = self.games.entry(key).read();
            assert!(game.exists && index < game.registered_count, "Ledger: registration index out of bounds");
            self.registered_owners.entry((key, index)).read()
        }

        fn get_player_result(self: @ContractState, key: GameKey, owner: ContractAddress) -> PlayerResult {
            self.results.entry((key, owner)).read()
        }
    }

    #[generate_trait]
    impl LedgerAssertionsImpl of LedgerAssertionsTrait {
        fn assert_constructor_addresses(
            self: @ContractState,
            admin: ContractAddress,
            operator: ContractAddress,
            treasury: ContractAddress,
            lords: ContractAddress,
            mmr_token: ContractAddress,
            season_pass: ContractAddress,
            village_pass: ContractAddress,
            loot_chest: ContractAddress,
            cosmetics: ContractAddress,
        ) {
            assert!(
                admin.is_non_zero()
                    && operator.is_non_zero()
                    && treasury.is_non_zero()
                    && lords.is_non_zero()
                    && mmr_token.is_non_zero()
                    && season_pass.is_non_zero()
                    && village_pass.is_non_zero()
                    && loot_chest.is_non_zero()
                    && cosmetics.is_non_zero(),
                "Ledger: zero constructor address",
            );
        }

        fn assert_valid_preset(self: @ContractState, preset: Preset) {
            assert!(preset.protocol_cut_bps <= 10_000, "Ledger: invalid protocol cut");
            assert!(preset.chest_lords_bps <= 10_000, "Ledger: invalid chest share");
            assert!(
                preset.chest_metadata != 0 && preset.chest_metadata != 0x101 && preset.chest_metadata != 0x201,
                "Ledger: legacy chest metadata",
            );
            assert!(
                preset.paid_fraction_bps > 0 && preset.paid_fraction_bps <= 10_000, "Ledger: invalid paid fraction",
            );
            assert!(preset.decay_bps > 0 && preset.decay_bps <= 10_000, "Ledger: invalid payout decay");
            assert!(preset.mmr.regression_bps <= 10_000, "Ledger: invalid MMR regression");
            if preset.mmr.enabled {
                assert!(
                    preset.mmr.spread > 0 && preset.mmr.max_delta > 0 && preset.mmr.k > 0 && preset.mmr.min_players > 1,
                    "Ledger: invalid MMR parameters",
                );
            }
        }

        fn assert_game_open_before_start(self: @ContractState, key: GameKey) -> Game {
            let game = self.games.entry(key).read();
            assert!(game.exists, "Ledger: unknown game");
            assert!(!game.cancelled && !game.finalized, "Ledger: game closed");
            assert!(starknet::get_block_timestamp() < game.start, "Ledger: game already started");
            game
        }

        fn assert_registration_open(self: @ContractState, key: GameKey, owner: ContractAddress) -> Game {
            let game = self.assert_game_open_before_start(key);
            assert!(!self.registrations.entry((key, owner)).read().registered, "Ledger: already registered");
            game
        }

        fn assert_results_open(self: @ContractState, game: Game) {
            assert!(game.exists, "Ledger: unknown game");
            assert!(!game.cancelled, "Ledger: game cancelled");
            assert!(!game.finalized, "Ledger: results already applied");
            assert!(starknet::get_block_timestamp() >= game.start, "Ledger: game not started");
            assert!(game.registered_count > 0, "Ledger: empty roster");
        }
    }

    #[generate_trait]
    impl RegistrationWriterImpl of RegistrationWriterTrait {
        fn open_refunds(ref self: ContractState, key: GameKey, mut game: Game) {
            game.cancelled = true;
            self.games.entry(key).write(game);
        }

        fn record_paid_registration(
            ref self: ContractState, key: GameKey, owner: ContractAddress, sword: bool, shield: bool, preset: Preset,
        ) -> u256 {
            let (sword_credit, shield_credit) = self.spend_credits(owner, sword, shield);
            let payment = preset.entry_fee
                + if sword && !sword_credit {
                    preset.sword_price
                } else {
                    0
                }
                + if shield && !shield_credit {
                    preset.shield_price
                } else {
                    0
                };
            let sponsored = self.registrations.entry((key, owner)).read().paid;
            let registration = Registration {
                registered: true,
                sword,
                shield,
                sword_credit,
                shield_credit,
                paid: sponsored + payment,
                ..Default::default(),
            };
            self.record_registration(key, owner, registration, payment, preset.entry_fee);
            payment
        }

        fn record_pass_registration(
            ref self: ContractState, key: GameKey, owner: ContractAddress, pass_id: u256, pass_kind: u8,
        ) {
            let sponsored = self.registrations.entry((key, owner)).read().paid;
            let registration = Registration {
                registered: true, realm_id: pass_id, pass_kind, paid: sponsored, ..Default::default(),
            };
            self.record_registration(key, owner, registration, 0, 0);
        }

        fn record_registration(
            ref self: ContractState,
            key: GameKey,
            owner: ContractAddress,
            registration: Registration,
            payment: u256,
            entry_fee: u256,
        ) {
            let mut game = self.games.entry(key).read();
            self.registrations.entry((key, owner)).write(registration);
            self.registered_owners.entry((key, game.registered_count)).write(owner);
            game.registered_count += 1;
            game.pool += payment;
            game.entries += entry_fee;
            assert!(game.entries <= 0xffffffffffffffffffffffffffffffff, "Ledger: entries exceed u128");
            self.games.entry(key).write(game);
        }

        fn add_to_pool(ref self: ContractState, key: GameKey, mut game: Game, amount: u256) {
            game.pool += amount;
            self.games.entry(key).write(game);
        }

        fn emit_registration(
            ref self: ContractState,
            key: GameKey,
            owner: ContractAddress,
            realm_id: u256,
            metadata: (felt252, felt252, felt252),
            pass_kind: u8,
        ) {
            self.emit(Registered { key, owner, realm_id, metadata, pass_kind });
        }

        fn restore_pass(ref self: ContractState, owner: ContractAddress, pass_id: u256, pass_kind: u8) {
            if pass_kind == SEASON_PASS {
                IPassRestoreDispatcher { contract_address: self.season_pass.read() }.restore(owner, pass_id);
            } else if pass_kind == VILLAGE_PASS {
                IPassRestoreDispatcher { contract_address: self.village_pass.read() }.restore(owner, pass_id);
            }
        }
    }

    #[generate_trait]
    impl ResultsValidatorImpl of ResultsValidatorTrait {
        fn finalize_game_pool(
            ref self: ContractState, key: GameKey, mut game: Game, ranked: Span<RankedPlayer>, preset: Preset,
        ) -> (u256, felt252) {
            let mut season = self.get_season(game.season_id);
            assert!(starknet::get_block_timestamp() < season.end, "Ledger: MMR frozen");
            let chest_lords = self.validate_chest_budget(game, ranked, preset);
            let treasury_cut = game.pool * preset.protocol_cut_bps.into() / BPS;
            let pool = game.pool - treasury_cut - chest_lords;
            let commitment = result_commitment(key, ranked);
            season.pool += pool;
            assert!(season.pool <= 0xffffffffffffffffffffffffffffffff, "Ledger: season pool exceeds u128");
            self.seasons.entry(game.season_id).write(season);
            game.finalized = true;
            game.pool = 0;
            game.result_commitment = commitment;
            self.games.entry(key).write(game);
            if treasury_cut > 0 {
                self.send_lords(self.treasury.read(), treasury_cut);
            }
            (pool, commitment)
        }

        fn validate_and_record_results(
            ref self: ContractState, key: GameKey, registered_count: u16, ranked: Span<RankedPlayer>,
        ) {
            assert!(ranked.len() == registered_count.into(), "Ledger: roster size mismatch");
            for index in 0..ranked.len() {
                let row = *ranked.at(index);
                let expected_rank = if index == 0 {
                    1
                } else {
                    let previous = *ranked.at(index - 1);
                    assert!(row.points <= previous.points, "Ledger: unordered points");
                    if row.points == previous.points {
                        assert!(previous.wallet < row.wallet, "Ledger: unordered tie");
                        previous.rank
                    } else {
                        (index + 1).try_into().unwrap()
                    }
                };
                assert!(row.rank == expected_rank, "Ledger: invalid competition rank");
                assert!(
                    self.registrations.entry((key, row.wallet)).read().registered, "Ledger: unregistered result owner",
                );
                assert!(!self.result_seen.entry((key, row.wallet)).read(), "Ledger: duplicate result owner");
                self.result_seen.entry((key, row.wallet)).write(true);
                self
                    .results
                    .entry((key, row.wallet))
                    .write(PlayerResult { rank: row.rank, points: row.points, ..Default::default() });
            }
        }
    }

    #[generate_trait]
    impl ChestWriterImpl of ChestWriterTrait {
        fn validate_chest_budget(self: @ContractState, game: Game, ranked: Span<RankedPlayer>, preset: Preset) -> u256 {
            let mut total_lords = 0;
            for row in ranked {
                let content = *row.chest;
                if content.kind == 0 {
                    assert!(content.cosmetic != 0 && content.lords == 0, "Ledger: invalid cosmetic chest");
                } else if content.kind == 1 || content.kind == 2 {
                    assert!(content.cosmetic == 0 && content.lords == 0, "Ledger: invalid credit chest");
                } else {
                    assert!(
                        content.kind == 3 && content.cosmetic == 0 && content.lords > 0, "Ledger: invalid LORDS chest",
                    );
                    total_lords += content.lords;
                }
            }
            assert!(total_lords <= game.entries * preset.chest_lords_bps.into() / BPS, "Ledger: chest share exceeded");
            total_lords
        }

        fn mint_chests(ref self: ContractState, key: GameKey, ranked: Span<RankedPlayer>, preset: Preset) {
            let chest_token = ICollectibleDispatcher { contract_address: self.loot_chest.read() };
            for row in ranked {
                let token_id = chest_token.mint_with_id(*row.wallet, preset.chest_metadata);
                assert!(!self.chests.entry(token_id).read().exists, "Ledger: duplicate chest id");
                self.chests.entry(token_id).write(Chest { exists: true, opened: false, content: *row.chest });
                let mut result = self.results.entry((key, *row.wallet)).read();
                result.chest_id = token_id;
                self.results.entry((key, *row.wallet)).write(result);
                self.emit(ChestMinted { key, wallet: *row.wallet, token_id, content: *row.chest });
            }
        }

        fn deliver_chest(ref self: ContractState, wallet: ContractAddress, content: ChestContent) {
            if content.kind == 0 {
                ICollectibleDispatcher { contract_address: self.cosmetics.read() }.safe_mint(wallet, content.cosmetic);
            } else if content.kind == 3 {
                self.send_lords(wallet, content.lords);
            } else {
                let mut credits = self.credits.entry(wallet).read();
                if content.kind == 1 {
                    credits.swords += 1;
                } else {
                    credits.shields += 1;
                }
                self.credits.entry(wallet).write(credits);
            }
        }

        fn spend_credits(ref self: ContractState, owner: ContractAddress, sword: bool, shield: bool) -> (bool, bool) {
            let mut credits = self.credits.entry(owner).read();
            let sword_credit = sword && credits.swords > 0;
            let shield_credit = shield && credits.shields > 0;
            if sword_credit {
                credits.swords -= 1;
            }
            if shield_credit {
                credits.shields -= 1;
            }
            self.credits.entry(owner).write(credits);
            (sword_credit, shield_credit)
        }

        fn restore_credits(ref self: ContractState, owner: ContractAddress, registration: Registration) {
            let mut credits = self.credits.entry(owner).read();
            if registration.sword_credit {
                credits.swords += 1;
            }
            if registration.shield_credit {
                credits.shields += 1;
            }
            self.credits.entry(owner).write(credits);
        }
    }

    #[generate_trait]
    impl SeasonWriterImpl of SeasonWriterTrait {
        fn record_season_players(ref self: ContractState, season_id: u32, key: GameKey, ranked: Span<RankedPlayer>) {
            let mut season = self.get_season(season_id);
            let token = IMMRTokenDispatcher { contract_address: self.mmr_token.read() };
            for row in ranked {
                let owner = *row.wallet;
                let mmr: u128 = (token.get_player_mmr(owner) / MMR_PRECISION).try_into().unwrap();
                if !self.season_participants.entry((season_id, owner)).read() {
                    self.season_participants.entry((season_id, owner)).write(true);
                    season.participant_count += 1;
                }
                self.season_mmrs.entry((season_id, owner)).write(mmr);
                let mut result = self.results.entry((key, owner)).read();
                if result.mmr_before == 0 {
                    result.mmr_before = mmr;
                }
                result.mmr_after = mmr;
                self.results.entry((key, owner)).write(result);
            }
            self.seasons.entry(season_id).write(season);
        }

        fn assert_season_top_open(self: @ContractState, season: BlitzSeason) {
            let now = starknet::get_block_timestamp();
            assert!(now >= season.end, "Ledger: season has not ended");
            assert!(!season.settlement_started, "Ledger: season payout started");
            assert!(!season.posted || season.challenged || now < season.review_until, "Ledger: top list final");
            assert!(season.participant_count > 0, "Ledger: no season participants");
        }

        fn assert_season_claim_open(self: @ContractState, season: BlitzSeason) {
            assert!(
                season.posted && starknet::get_block_timestamp() >= season.review_until, "Ledger: season under review",
            );
            assert!(!season.challenged, "Ledger: season challenged");
            let preset = self.presets.entry(season.preset_id).read();
            assert!(
                season.top_count == Self::winner_count(season.participant_count, preset.paid_fraction_bps),
                "Ledger: incomplete top list",
            );
        }

        fn validate_season_top(
            self: @ContractState, season_id: u32, season: BlitzSeason, winners: Span<ContractAddress>, preset: Preset,
        ) {
            assert!(
                winners.len() <= Self::winner_count(season.participant_count, preset.paid_fraction_bps),
                "Ledger: too many winners",
            );
            for index in 0..winners.len() {
                let owner = *winners.at(index);
                let mmr = self.get_season_mmr(season_id, owner);
                if index > 0 {
                    let previous = *winners.at(index - 1);
                    let previous_mmr = self.get_season_mmr(season_id, previous);
                    assert!(Self::outranks(previous, previous_mmr, owner, mmr), "Ledger: unordered winners");
                }
            }
        }

        fn write_season_allocations(
            ref self: ContractState,
            season_id: u32,
            season: BlitzSeason,
            winners: Span<ContractAddress>,
            preset: Preset,
        ) {
            let allocations = self
                .calculate_position_allocations(
                    season.pool, season.participant_count, preset.paid_fraction_bps, preset.decay_bps,
                );
            for index in 0..winners.len() {
                self.season_winners.entry((season_id, index)).write(*winners.at(index));
                self.season_allocations.entry((season_id, index)).write(*allocations.at(index));
            }
        }

        fn season_position(self: @ContractState, season_id: u32, count: u32, owner: ContractAddress) -> Option<u32> {
            for index in 0..count {
                if self.season_winners.entry((season_id, index)).read() == owner {
                    return Option::Some(index);
                }
            }
            Option::None
        }

        fn outranks(owner: ContractAddress, mmr: u128, other: ContractAddress, other_mmr: u128) -> bool {
            mmr > other_mmr || (mmr == other_mmr && owner < other)
        }

        fn winner_count(players: u32, fraction: u16) -> u32 {
            ((Into::<u32, u64>::into(players) * Into::<u16, u64>::into(fraction) + 9999) / 10000).try_into().unwrap()
        }
    }

    #[generate_trait]
    impl PayoutCalculatorImpl of PayoutCalculatorTrait {
        fn calculate_position_allocations(
            self: @ContractState, prize_pool: u256, player_count: u32, paid_fraction_bps: u16, decay_bps: u16,
        ) -> Array<u256> {
            let winner_count = SeasonWriterImpl::winner_count(player_count, paid_fraction_bps);
            let mut weights: Array<u256> = array![];
            let mut weight = PAYOUT_WEIGHT_SCALE;
            let mut total_weight = 0;
            for _ in 0..winner_count {
                weights.append(weight);
                total_weight += weight;
                weight = weight * decay_bps.into() / BPS;
            }

            let mut allocations = array![];
            let mut allocated = 0;
            for position in 0..winner_count {
                let amount = if position + 1 == winner_count {
                    prize_pool - allocated
                } else {
                    prize_pool * *weights.at(position) / total_weight
                };
                allocations.append(amount);
                allocated += amount;
            }
            allocations
        }
    }

    #[generate_trait]
    impl MmrWriterImpl of MmrWriterTrait {
        fn apply_mmr(ref self: ContractState, key: GameKey, ranked: Span<RankedPlayer>, preset: Preset) {
            if !preset.mmr.enabled || ranked.len() < preset.mmr.min_players.into() {
                self.consume_registration_flags(key, ranked);
                return;
            }

            let mmr_token = IMMRTokenDispatcher { contract_address: self.mmr_token.read() };
            let mut current_mmrs: Array<u128> = array![];
            let mut sorted_mmrs: Felt252Dict<u128> = Default::default();
            let mut index: u32 = 0;
            while index < ranked.len() {
                let owner = *ranked.at(index).wallet;
                let current_mmr: u128 = (mmr_token.get_player_mmr(owner) / MMR_PRECISION).try_into().unwrap();
                current_mmrs.append(current_mmr);
                Self::insert_sorted(ref sorted_mmrs, index, current_mmr);
                index += 1;
            }
            let median = Self::median(ref sorted_mmrs, ranked.len());

            let mut updates = array![];
            index = 0;
            while index < ranked.len() {
                let owner = *ranked.at(index).wallet;
                let rank = *ranked.at(index).rank;
                let group_size = Self::tie_count(ranked, index, rank);
                let current_mmr = *current_mmrs.at(index);
                let calculated_mmr = MmrCalculatorImpl::calculate_player_mmr(
                    preset.mmr, current_mmr, rank, group_size, ranked.len().try_into().unwrap(), median,
                );
                let mut registration = self.registrations.entry((key, owner)).read();
                let new_mmr = MmrCalculatorImpl::apply_flag_modifier(
                    current_mmr, calculated_mmr, registration.sword, registration.shield,
                );
                registration.flags_consumed = true;
                self.registrations.entry((key, owner)).write(registration);
                let mut result = self.results.entry((key, owner)).read();
                result.mmr_before = current_mmr;
                result.mmr_after = new_mmr;
                self.results.entry((key, owner)).write(result);
                updates.append((owner, new_mmr.into() * MMR_PRECISION));
                index += 1;
            }
            mmr_token.update_mmr_batch(updates);
        }

        fn consume_registration_flags(ref self: ContractState, key: GameKey, ranked: Span<RankedPlayer>) {
            for entry in ranked {
                let owner = *entry.wallet;
                let mut registration = self.registrations.entry((key, owner)).read();
                registration.flags_consumed = true;
                self.registrations.entry((key, owner)).write(registration);
            }
        }

        fn insert_sorted(ref values: Felt252Dict<u128>, length: u32, value: u128) {
            let mut index = length;
            while index > 0 && values.get((index - 1).into()) > value {
                values.insert(index.into(), values.get((index - 1).into()));
                index -= 1;
            }
            values.insert(index.into(), value);
        }

        fn median(ref values: Felt252Dict<u128>, length: u32) -> u128 {
            if length % 2 == 1 {
                values.get((length / 2).into())
            } else {
                (values.get((length / 2 - 1).into()) + values.get((length / 2).into())) / 2
            }
        }

        fn tie_count(ranked: Span<RankedPlayer>, index: u32, rank: u16) -> u16 {
            let mut first = index;
            while first > 0 {
                let previous_rank = *ranked.at(first - 1).rank;
                if previous_rank != rank {
                    break;
                }
                first -= 1;
            }
            let mut last = index;
            while last + 1 < ranked.len() {
                let next_rank = *ranked.at(last + 1).rank;
                if next_rank != rank {
                    break;
                }
                last += 1;
            }
            (last - first + 1).try_into().unwrap()
        }
    }

    #[generate_trait]
    impl LordsTransferImpl of LordsTransferTrait {
        fn pull_lords(ref self: ContractState, owner: ContractAddress, amount: u256) {
            if amount > 0 {
                assert!(
                    IERC20Dispatcher { contract_address: self.lords.read() }
                        .transfer_from(owner, starknet::get_contract_address(), amount),
                    "Ledger: LORDS transfer_from failed",
                );
            }
        }

        fn send_lords(ref self: ContractState, recipient: ContractAddress, amount: u256) {
            if amount > 0 {
                assert!(
                    IERC20Dispatcher { contract_address: self.lords.read() }.transfer(recipient, amount),
                    "Ledger: LORDS transfer failed",
                );
            }
        }
    }
}
