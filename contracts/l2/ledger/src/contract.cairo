use core::poseidon::poseidon_hash_span;
use game_ledger::types::{
    BlitzSeason, Chest, ChestBandPreset, Credits, FrontierSeason, GameKey, MmrPreview, PlayerResult, Preset,
    RankedPlayer, Registration, Slot, SlotKey, WithdrawalPayment,
};
use starknet::ContractAddress;

pub const PAUSER_ROLE: felt252 = selector!("PAUSER_ROLE");
pub const OPERATOR_ROLE: felt252 = selector!("OPERATOR_ROLE");
const BPS: u256 = 10_000;
const PAYOUT_WEIGHT_SCALE: u256 = 1_000_000_000_000_000_000;
// One settlement tick must fit after the last scheduled game.
const BLITZ_SETTLEMENT_MARGIN_SECONDS: u64 = 600;
const SEASON_REVIEW_SECONDS: u64 = 3600;
const MMR_PRECISION: u256 = 1_000_000_000_000_000_000;

pub fn result_commitment(key: GameKey, ranked: Span<RankedPlayer>) -> felt252 {
    let mut payload = array!['ETERNUM_BLITZ_RESULT', 3, key.shard, key.game_id.into(), ranked.len().into()];
    for row in ranked {
        payload.append((*row.wallet).into());
        payload.append((*row.rank).into());
    }
    poseidon_hash_span(payload.span())
}

#[starknet::interface]
pub trait IGameLedger<TState> {
    fn lords(self: @TState) -> ContractAddress;
    fn chest_collection(self: @TState) -> ContractAddress;
    fn pause(ref self: TState);
    fn unpause(ref self: TState);
    fn fund_frontier(
        ref self: TState,
        shard: felt252,
        season_id: u32,
        preset_id: u32,
        start: u64,
        end: u64,
        seed: felt252,
        amount: u256,
    );
    fn pay(ref self: TState, shard: felt252, season_id: u32, claim_id: felt252, wallet: ContractAddress, amount: u256);
    fn report_withdrawal(
        ref self: TState,
        shard: felt252,
        season_id: u32,
        claim_id: felt252,
        amount: u256,
        prize_rank: u16,
        prize_count: u16,
    );
    fn close_frontier(ref self: TState, shard: felt252, season_id: u32);
    fn extend_frontier(ref self: TState, shard: felt252, season_id: u32);
    fn apply_frontier_carry(ref self: TState, shard: felt252, season_id: u32);
    fn frontier_carry(self: @TState, shard: felt252) -> u256;
    fn get_frontier(self: @TState, shard: felt252, season_id: u32) -> FrontierSeason;
    fn frontier_unlocked(self: @TState, shard: felt252, season_id: u32) -> u256;
    fn frontier_claim_deadline(self: @TState, shard: felt252, season_id: u32) -> u64;
    fn get_payment(self: @TState, shard: felt252, claim_id: felt252) -> WithdrawalPayment;
    fn rescue_token(ref self: TState, token: ContractAddress, recipient: ContractAddress, amount: u256);
    fn register_preset(
        ref self: TState, preset_id: u32, preset: Preset, bands: Array<ChestBandPreset>, items: Array<Array<u128>>,
    );
    fn open_season(ref self: TState, season_id: u32, preset_id: u32, start: u64, end: u64);
    fn get_season(self: @TState, season_id: u32) -> BlitzSeason;
    fn post_season_top(ref self: TState, season_id: u32, winners: Array<ContractAddress>);
    fn challenge_season(ref self: TState, season_id: u32, omitted: ContractAddress);
    fn claim_season(ref self: TState, season_id: u32, position: u32);
    fn get_season_mmr(self: @TState, season_id: u32, owner: ContractAddress) -> u128;
    fn get_season_winner(self: @TState, season_id: u32, index: u32) -> (ContractAddress, u256);
    fn season_claimed(self: @TState, season_id: u32, owner: ContractAddress) -> bool;
    fn open_slot(ref self: TState, key: SlotKey, season_id: u32, preset_id: u32, close: u64, end: u64);
    fn register(ref self: TState, key: SlotKey, sword: bool, shield: bool);
    fn cancel_slot(ref self: TState, key: SlotKey);
    fn abort_slot(ref self: TState, key: SlotKey);
    fn refund(ref self: TState, key: SlotKey);
    fn mark_refundable(ref self: TState, key: SlotKey, wallets: Array<ContractAddress>);
    fn get_result_commitment(self: @TState, key: GameKey) -> felt252;
    fn apply_results(ref self: TState, key: SlotKey, game_id: u32, ranked: Array<RankedPlayer>);
    fn preview_mmr(self: @TState, key: SlotKey, ranked: Array<RankedPlayer>) -> Array<MmrPreview>;
    fn open_request(ref self: TState, token_id: u256);
    fn open_finish(ref self: TState, token_id: u256);
    fn get_chest_band(self: @TState, preset_id: u32, band: u8) -> ChestBandPreset;
    fn get_cosmetic_items(self: @TState, preset_id: u32, rarity: u8) -> Array<u128>;
    fn get_chest(self: @TState, token_id: u256) -> Chest;
    fn get_credits(self: @TState, owner: ContractAddress) -> Credits;
    fn get_preset(self: @TState, preset_id: u32) -> Preset;
    fn get_slot(self: @TState, key: SlotKey) -> Slot;
    fn get_registration(self: @TState, key: SlotKey, owner: ContractAddress) -> Registration;
    fn get_registrations(self: @TState, key: SlotKey, from: u64, limit: u32) -> Array<(ContractAddress, u64)>;
    fn get_player_result(self: @TState, key: GameKey, owner: ContractAddress) -> PlayerResult;
}

#[starknet::interface]
pub trait IMMRToken<TState> {
    fn get_player_mmr(self: @TState, player: ContractAddress) -> u256;
    fn update_mmr_batch(ref self: TState, updates: Array<(ContractAddress, u256)>);
}

#[starknet::interface]
pub trait ICollectible<TState> {
    fn mint(ref self: TState, recipient: ContractAddress, attributes_raw: u128);
    fn mint_with_id(ref self: TState, recipient: ContractAddress, attributes_raw: u128) -> u256;
    fn burn(ref self: TState, token_id: u256);
}

#[starknet::contract]
pub mod GameLedger {
    use core::dict::Felt252Dict;
    use core::num::traits::Zero;
    use game_ledger::chests::{draw_item_index, draw_outcome, outcome_weights, rank_band};
    use game_ledger::mmr::MmrCalculatorImpl;
    use game_ledger::types::{
        BlitzSeason, Chest, ChestBandPreset, ChestContent, Credits, FrontierSeason, GameKey, MmrPreview, PlayerResult,
        Preset, RankedPlayer, Registration, Slot, SlotKey, WithdrawalPayment,
    };
    use openzeppelin::access::accesscontrol::{AccessControlComponent, DEFAULT_ADMIN_ROLE};
    use openzeppelin::introspection::src5::SRC5Component;
    use openzeppelin::security::PausableComponent;
    use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use openzeppelin::token::erc721::interface::{IERC721Dispatcher, IERC721DispatcherTrait};
    use openzeppelin::upgrades::UpgradeableComponent;
    use openzeppelin::upgrades::interface::IUpgradeable;
    use starknet::storage::{Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ClassHash, ContractAddress, SyscallResultTrait};
    use super::{
        BLITZ_SETTLEMENT_MARGIN_SECONDS, BPS, ICollectibleDispatcher, ICollectibleDispatcherTrait, IGameLedger,
        IMMRTokenDispatcher, IMMRTokenDispatcherTrait, MMR_PRECISION, OPERATOR_ROLE, PAUSER_ROLE, PAYOUT_WEIGHT_SCALE,
        SEASON_REVIEW_SECONDS, result_commitment,
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
        frontier_days: Map<(felt252, u32), FrontierSeason>,
        frontier_carry_pool: Map<felt252, u256>,
        frontier_carry_end: Map<felt252, u64>,
        frontier_prize_claims: Map<(felt252, u32, u16), felt252>,
        frontier_prize_count: Map<(felt252, u32), u16>,
        payments: Map<(felt252, felt252), WithdrawalPayment>,
        treasury: ContractAddress,
        lords: ContractAddress,
        mmr_token: ContractAddress,
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
        chest_bands: Map<(u32, u8), ChestBandPreset>,
        cosmetic_items: Map<(u32, u8, u32), u128>,
        cosmetic_counts: Map<(u32, u8), u32>,
        credits: Map<ContractAddress, Credits>,
        presets: Map<u32, Preset>,
        preset_exists: Map<u32, bool>,
        slots: Map<SlotKey, Slot>,
        registrations: Map<(SlotKey, ContractAddress), Registration>,
        registered_owners: Map<(SlotKey, u64), ContractAddress>,
        result_commitments: Map<GameKey, felt252>,
        results: Map<(GameKey, ContractAddress), PlayerResult>,
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
        SlotOpened: SlotOpened,
        Registered: Registered,
        SlotCancelled: SlotCancelled,
        SlotAborted: SlotAborted,
        Refunded: Refunded,
        RegistrationRefundable: RegistrationRefundable,
        SeasonOpened: SeasonOpened,
        SeasonTopPosted: SeasonTopPosted,
        SeasonChallenged: SeasonChallenged,
        SeasonPaid: SeasonPaid,
        ResultsApplied: ResultsApplied,
        ChestMinted: ChestMinted,
        ChestOpened: ChestOpened,
        ChestRequested: ChestRequested,
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
        prize_rank: u16,
        prize_count: u16,
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
    struct SlotOpened {
        #[key]
        key: SlotKey,
        season_id: u32,
        preset_id: u32,
        close: u64,
        end: u64,
    }


    #[derive(Drop, starknet::Event)]
    struct Registered {
        #[key]
        key: SlotKey,
        #[key]
        owner: ContractAddress,
    }


    #[derive(Drop, starknet::Event)]
    struct SlotCancelled {
        #[key]
        key: SlotKey,
    }

    #[derive(Drop, starknet::Event)]
    struct SlotAborted {
        #[key]
        key: SlotKey,
    }

    #[derive(Drop, starknet::Event)]
    struct Refunded {
        #[key]
        key: SlotKey,
        #[key]
        owner: ContractAddress,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct RegistrationRefundable {
        #[key]
        key: SlotKey,
        #[key]
        owner: ContractAddress,
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
        slot_id: u32,
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
        season_id: u32,
        band: u8,
    }

    #[derive(Drop, starknet::Event)]
    struct ChestRequested {
        #[key]
        token_id: u256,
        #[key]
        wallet: ContractAddress,
        request_block: u64,
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
        top_count: u32,
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

    #[constructor]
    fn constructor(
        ref self: ContractState,
        admin: ContractAddress,
        operator: ContractAddress,
        treasury: ContractAddress,
        lords: ContractAddress,
        mmr_token: ContractAddress,
        loot_chest: ContractAddress,
        cosmetics: ContractAddress,
    ) {
        self.assert_constructor_addresses(admin, operator, treasury, lords, mmr_token, loot_chest, cosmetics);
        self.accesscontrol.initializer();
        self.accesscontrol._grant_role(DEFAULT_ADMIN_ROLE, admin);
        self.accesscontrol._grant_role(OPERATOR_ROLE, operator);
        self.treasury.write(treasury);
        self.lords.write(lords);
        self.mmr_token.write(mmr_token);

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
        fn lords(self: @ContractState) -> ContractAddress {
            self.lords.read()
        }

        fn chest_collection(self: @ContractState) -> ContractAddress {
            self.loot_chest.read()
        }

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

        fn fund_frontier(
            ref self: ContractState,
            shard: felt252,
            season_id: u32,
            preset_id: u32,
            start: u64,
            end: u64,
            seed: felt252,
            amount: u256,
        ) {
            self.accesscontrol.assert_only_role(DEFAULT_ADMIN_ROLE);
            assert!(shard != 0, "Ledger: zero shard");
            assert!(!self.frontier_days.entry((shard, season_id)).read().funded, "Ledger: season already funded");
            let preset = self.get_preset(preset_id);
            assert!(preset.day_unit_seconds != 0, "Ledger: Frontier days disabled");
            assert!(end > start, "Ledger: invalid season window");
            crate::days::season_days(end - start, preset.day_unit_seconds);
            assert!(
                Into::<u64, u128>::into(end) + preset.claim_window_seconds.into() <= 0xffffffffffffffff,
                "Ledger: claim deadline exceeds u64",
            );
            assert!(starknet::get_block_timestamp() < end, "Ledger: season ended");
            assert!(amount > 0 && amount <= 0xffffffffffffffffffffffffffffffff, "Ledger: invalid season funding");
            let prize = amount
                * (BPS - preset.frontier_chest_bps.into())
                / BPS
                / 1000000000000000000
                * 1000000000000000000;
            let chest = amount - prize;
            let carry = self.frontier_carry_pool.entry(shard).read();
            assert!(chest + carry <= 0xffffffffffffffffffffffffffffffff, "Ledger: season pool exceeds u128");
            assert!(
                carry == 0 || start >= self.frontier_carry_end.entry(shard).read(),
                "Ledger: carry belongs to later season",
            );
            self.frontier_carry_pool.entry(shard).write(0);
            self
                .frontier_days
                .entry((shard, season_id))
                .write(
                    FrontierSeason {
                        funded: true,
                        preset_id,
                        start,
                        end,
                        seed,
                        pool: chest + carry,
                        prize_pool: amount - chest,
                        ..Default::default(),
                    },
                );
            self.pull_lords(starknet::get_caller_address(), amount);
            self.emit(FrontierFunded { shard, season_id, start, end, amount });
        }

        fn report_withdrawal(
            ref self: ContractState,
            shard: felt252,
            season_id: u32,
            claim_id: felt252,
            amount: u256,
            prize_rank: u16,
            prize_count: u16,
        ) {
            self.accesscontrol.assert_only_role(OPERATOR_ROLE);
            let previous = self.get_payment(shard, claim_id);
            if previous.amount != 0 {
                assert!(
                    previous.season_id == season_id
                        && previous.amount == amount
                        && previous.prize_rank == prize_rank
                        && previous.prize_count == prize_count,
                    "Ledger: conflicting withdrawal report",
                );
                return;
            }
            assert!(claim_id != 0 && amount > 0, "Ledger: invalid withdrawal");
            let season = self.get_frontier(shard, season_id);
            if prize_rank == 0 {
                assert!(!season.closed, "Ledger: season closed");
                assert!(
                    starknet::get_block_timestamp() < self.frontier_claim_deadline(shard, season_id),
                    "Ledger: claim window ended",
                );
                assert!(prize_count == 0, "Ledger: invalid prize rank");
            } else {
                assert!(starknet::get_block_timestamp() >= season.end, "Ledger: season has not ended");
                let top_n = self.get_preset(season.preset_id).frontier_top_n;
                assert!(
                    prize_count > 0 && prize_count <= top_n && prize_rank <= prize_count, "Ledger: invalid prize rank",
                );
                let fixed_count = self.frontier_prize_count.entry((shard, season_id)).read();
                assert!(fixed_count == 0 || fixed_count == prize_count, "Ledger: conflicting prize count");
                assert!(
                    self.frontier_prize_claims.entry((shard, season_id, prize_rank)).read() == 0,
                    "Ledger: prize already reported",
                );
                let whole: u128 = (season.prize_pool / 1000000000000000000).try_into().unwrap();
                let expected: u256 = crate::frontier_prizes::prize_amount(whole, prize_count, prize_rank).into();
                assert!(amount == expected * 1000000000000000000, "Ledger: incorrect prize amount");
                self.frontier_prize_count.entry((shard, season_id)).write(prize_count);
                self.frontier_prize_claims.entry((shard, season_id, prize_rank)).write(claim_id);
            }
            self
                .payments
                .entry((shard, claim_id))
                .write(
                    WithdrawalPayment {
                        paid: false, season_id, wallet: 0.try_into().unwrap(), amount, prize_rank, prize_count,
                    },
                );
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
            let reported = self.get_payment(shard, claim_id);
            assert!(reported.prize_rank > 0 || !season.closed, "Ledger: season closed");
            assert!(reported.amount != 0, "Ledger: withdrawal unreported");
            assert!(
                reported.season_id == season_id && reported.amount == amount, "Ledger: conflicting withdrawal report",
            );
            if reported.prize_rank == 0 {
                assert!(amount <= self.frontier_unlocked(shard, season_id) - season.paid, "Ledger: unlock exceeded");
                season.paid += amount;
            } else {
                assert!(
                    starknet::get_block_timestamp() >= season.end && amount <= season.prize_pool - season.prize_paid,
                    "Ledger: unlock exceeded",
                );
                season.prize_paid += amount;
            }
            self.frontier_days.entry((shard, season_id)).write(season);
            self
                .payments
                .entry((shard, claim_id))
                .write(WithdrawalPayment { paid: true, season_id, wallet, amount, ..reported });
            self.send_lords(wallet, amount);
            self
                .emit(
                    WithdrawalPaid {
                        shard,
                        claim_id,
                        season_id,
                        wallet,
                        amount,
                        prize_rank: reported.prize_rank,
                        prize_count: reported.prize_count,
                    },
                );
        }

        fn extend_frontier(ref self: ContractState, shard: felt252, season_id: u32) {
            use crate::approved_frontier_extension as approved;
            self.accesscontrol.assert_only_role(DEFAULT_ADMIN_ROLE);
            assert!(shard == approved::CHAIN_ID && season_id == approved::GAME_ID, "Ledger: extension target differs");
            let mut season = self.get_frontier(shard, season_id);
            let preset = self.get_preset(season.preset_id);
            assert!(
                season.start == approved::START
                    && season.seed == approved::SEED
                    && season.preset_id == approved::PRESET_ID
                    && preset.day_unit_seconds == approved::DAY_UNIT
                    && preset.claim_window_seconds == approved::CLAIM_WINDOW,
                "Ledger: extension identity differs",
            );
            assert!(
                season.pool == Into::<u128, u256>::into(approved::POOL_LORDS) * 1000000000000000000,
                "Ledger: extension pool differs",
            );
            if season.end == approved::END {
                return;
            }
            assert!(season.end == approved::OLD_END, "Ledger: extension end differs");
            let now = starknet::get_block_timestamp();
            assert!(!season.closed && now >= season.start && now < season.end, "Ledger: extension not live");
            assert!(approved::END > season.end, "Ledger: extension must grow");
            crate::days::season_days(approved::END - season.start, preset.day_unit_seconds);
            assert!(
                Into::<u64, u128>::into(approved::END) + preset.claim_window_seconds.into() <= 0xffffffffffffffff,
                "Ledger: claim deadline exceeds u64",
            );
            season.end = approved::END;
            assert!(season.paid <= super::frontier_unlock(season, preset, now), "Ledger: extension exceeds unlock");
            self.frontier_days.entry((shard, season_id)).write(season);
        }

        fn close_frontier(ref self: ContractState, shard: felt252, season_id: u32) {
            self.accesscontrol.assert_only_role(DEFAULT_ADMIN_ROLE);
            let mut season = self.get_frontier(shard, season_id);
            if season.closed {
                return;
            }
            assert!(
                starknet::get_block_timestamp() >= self.frontier_claim_deadline(shard, season_id),
                "Ledger: claim window open",
            );
            let returned = season.pool - season.paid;
            season.closed = true;
            self.frontier_days.entry((shard, season_id)).write(season);
            self.frontier_carry_pool.entry(shard).write(self.frontier_carry_pool.entry(shard).read() + returned);
            self
                .frontier_carry_end
                .entry(shard)
                .write(core::cmp::max(season.end, self.frontier_carry_end.entry(shard).read()));
            self.emit(FrontierClosed { shard, season_id, returned });
        }

        fn frontier_carry(self: @ContractState, shard: felt252) -> u256 {
            self.frontier_carry_pool.entry(shard).read()
        }
        fn apply_frontier_carry(ref self: ContractState, shard: felt252, season_id: u32) {
            self.accesscontrol.assert_only_role(DEFAULT_ADMIN_ROLE);
            let amount = self.frontier_carry_pool.entry(shard).read();
            if amount == 0 {
                return;
            }
            let mut season = self.get_frontier(shard, season_id);
            assert!(!season.closed && starknet::get_block_timestamp() < season.end, "Ledger: season ended");
            assert!(
                season.start >= self.frontier_carry_end.entry(shard).read(), "Ledger: carry belongs to later season",
            );
            assert!(season.pool + amount <= 0xffffffffffffffffffffffffffffffff, "Ledger: season pool exceeds u128");
            season.pool += amount;
            self.frontier_carry_pool.entry(shard).write(0);
            self.frontier_days.entry((shard, season_id)).write(season);
        }

        fn get_frontier(self: @ContractState, shard: felt252, season_id: u32) -> FrontierSeason {
            let season = self.frontier_days.entry((shard, season_id)).read();
            assert!(season.funded, "Ledger: unknown Frontier season");
            season
        }

        fn frontier_unlocked(self: @ContractState, shard: felt252, season_id: u32) -> u256 {
            let season = self.get_frontier(shard, season_id);
            let now = starknet::get_block_timestamp();
            super::frontier_unlock(season, self.get_preset(season.preset_id), now)
        }

        fn get_payment(self: @ContractState, shard: felt252, claim_id: felt252) -> WithdrawalPayment {
            self.payments.entry((shard, claim_id)).read()
        }

        fn frontier_claim_deadline(self: @ContractState, shard: felt252, season_id: u32) -> u64 {
            let season = self.get_frontier(shard, season_id);
            season.end + self.get_preset(season.preset_id).claim_window_seconds.into()
        }

        fn rescue_token(ref self: ContractState, token: ContractAddress, recipient: ContractAddress, amount: u256) {
            self.accesscontrol.assert_only_role(DEFAULT_ADMIN_ROLE);
            assert!(token != self.lords.read(), "Ledger: LORDS are managed funds");
            assert!(recipient.is_non_zero(), "Ledger: rescue recipient is zero");
            assert!(
                IERC20Dispatcher { contract_address: token }.transfer(recipient, amount), "Ledger: token rescue failed",
            );
        }

        fn register_preset(
            ref self: ContractState,
            preset_id: u32,
            preset: Preset,
            bands: Array<ChestBandPreset>,
            items: Array<Array<u128>>,
        ) {
            self.accesscontrol.assert_only_role(DEFAULT_ADMIN_ROLE);
            assert!(!self.preset_exists.entry(preset_id).read(), "Ledger: preset already registered");
            self.assert_valid_preset(preset);
            self.write_chest_preset(preset_id, bands.span(), items.span());
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
            season.pool += season.chest_reserve;
            assert!(season.pool <= 0xffffffffffffffffffffffffffffffff, "Ledger: season pool exceeds u128");
            season.chest_reserve = 0;
            self.write_season_allocations(season_id, season, winners.span(), preset);
            season.posted = true;
            season.challenged = false;
            season.top_count = winners.len();
            season.review_until = starknet::get_block_timestamp() + SEASON_REVIEW_SECONDS;
            self.seasons.entry(season_id).write(season);
            self
                .emit(
                    SeasonTopPosted {
                        season_id, top_count: season.top_count, review_until: season.review_until, pool: season.pool,
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
            let cutoff = self.season_winners.entry((season_id, season.top_count - 1)).read();
            assert!(
                SeasonWriterImpl::outranks(omitted, mmr, cutoff, self.get_season_mmr(season_id, cutoff)),
                "Ledger: does not beat cutoff",
            );
            season.challenged = true;
            self.seasons.entry(season_id).write(season);
            self.emit(SeasonChallenged { season_id, omitted });
        }

        fn claim_season(ref self: ContractState, season_id: u32, position: u32) {
            self.pausable.assert_not_paused();
            let owner = starknet::get_caller_address();
            let mut season = self.get_season(season_id);
            self.assert_season_claim_open(season);
            assert!(position < season.top_count, "Ledger: winner index out of bounds");
            assert!(self.season_winners.entry((season_id, position)).read() == owner, "Ledger: not a winner");
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

        fn open_slot(ref self: ContractState, key: SlotKey, season_id: u32, preset_id: u32, close: u64, end: u64) {
            self.accesscontrol.assert_only_role(OPERATOR_ROLE);
            assert!(key.shard != 0, "Ledger: zero shard");
            assert!(!self.slots.entry(key).read().exists, "Ledger: slot already opened");
            assert!(self.preset_exists.entry(preset_id).read(), "Ledger: unknown preset");
            assert!(starknet::get_block_timestamp() < close, "Ledger: close must be in the future");
            assert!(close < end, "Ledger: invalid slot window");
            let season = self.get_season(season_id);
            assert!(preset_id == season.preset_id, "Ledger: slot preset differs from season");
            assert!(
                close >= season.start && end + BLITZ_SETTLEMENT_MARGIN_SECONDS < season.end,
                "Ledger: slot outside season",
            );
            self.slots.entry(key).write(Slot { exists: true, season_id, preset_id, close, end, ..Default::default() });
            self.emit(SlotOpened { key, season_id, preset_id, close, end });
        }

        fn register(ref self: ContractState, key: SlotKey, sword: bool, shield: bool) {
            let owner = starknet::get_caller_address();
            let slot = self.assert_registration_open(key, owner);
            let preset = self.presets.entry(slot.preset_id).read();
            let payment = self.record_paid_registration(key, owner, sword, shield, preset);
            self.pull_lords(owner, payment);
            self.emit(Registered { key, owner });
        }


        fn cancel_slot(ref self: ContractState, key: SlotKey) {
            self.accesscontrol.assert_only_role(OPERATOR_ROLE);
            let slot = self.assert_slot_open_before_close(key);
            self.open_refunds(key, slot);
            self.emit(SlotCancelled { key });
        }

        fn abort_slot(ref self: ContractState, key: SlotKey) {
            self.accesscontrol.assert_only_role(OPERATOR_ROLE);
            let slot = self.slots.entry(key).read();
            assert!(slot.exists, "Ledger: unknown slot");
            assert!(!slot.cancelled, "Ledger: slot closed");
            assert!(starknet::get_block_timestamp() >= slot.end, "Ledger: slot has not ended");

            self.open_refunds(key, slot);
            self.emit(SlotAborted { key });
        }

        fn refund(ref self: ContractState, key: SlotKey) {
            let owner = starknet::get_caller_address();
            let mut slot = self.slots.entry(key).read();
            let mut registration = self.registrations.entry((key, owner)).read();
            assert!(slot.exists && (slot.cancelled || registration.refundable), "Ledger: registration not refundable");
            assert!(registration.game_id == 0, "Ledger: registration already settled");
            let amount = registration.paid;
            assert!(amount > 0 || registration.sword_credit || registration.shield_credit, "Ledger: nothing to refund");
            self.restore_credits(owner, registration);
            registration.sword_credit = false;
            registration.shield_credit = false;
            registration.paid = 0;
            slot.pool -= amount;
            self.registrations.entry((key, owner)).write(registration);
            self.slots.entry(key).write(slot);
            if amount > 0 {
                self.send_lords(owner, amount);
            }
            self.emit(Refunded { key, owner, amount });
        }

        fn apply_results(ref self: ContractState, key: SlotKey, game_id: u32, ranked: Array<RankedPlayer>) {
            self.accesscontrol.assert_only_role(OPERATOR_ROLE);
            let slot = self.get_slot(key);
            self.assert_results_open(slot);
            assert!(game_id != 0, "Ledger: zero game id");
            let game_key = GameKey { shard: key.shard, game_id };
            assert!(self.result_commitments.entry(game_key).read() == 0, "Ledger: results already applied");
            let preset = self.presets.entry(slot.preset_id).read();
            let pool = self.validate_and_record_results(key, game_key, ranked.span());
            let commitment = result_commitment(game_key, ranked.span());
            self.allocate_game_pool(key, slot, pool, preset);
            self.result_commitments.entry(game_key).write(commitment);
            self.apply_mmr(key, game_key, ranked.span(), preset);
            self.record_season_players(slot.season_id, game_key, ranked.span());
            self.mint_chests(game_key, slot, ranked.span());
            self
                .emit(
                    ResultsApplied {
                        key: game_key,
                        slot_id: key.slot_id,
                        season_id: slot.season_id,
                        result_commitment: commitment,
                        pool,
                    },
                );
        }

        fn preview_mmr(self: @ContractState, key: SlotKey, ranked: Array<RankedPlayer>) -> Array<MmrPreview> {
            let slot = self.get_slot(key);
            assert!(slot.exists && !slot.cancelled, "Ledger: slot unavailable");
            ResultsValidatorImpl::assert_ranked_players(ranked.span());
            for row in ranked.span() {
                self.unsettled_registration(key, *row.wallet);
            }
            self.calculate_mmr(key, ranked.span(), self.presets.entry(slot.preset_id).read())
        }

        fn get_result_commitment(self: @ContractState, key: GameKey) -> felt252 {
            self.result_commitments.entry(key).read()
        }

        fn mark_refundable(ref self: ContractState, key: SlotKey, wallets: Array<ContractAddress>) {
            self.accesscontrol.assert_only_role(OPERATOR_ROLE);
            let slot = self.get_slot(key);
            assert!(slot.exists, "Ledger: unknown slot");
            assert!(starknet::get_block_timestamp() >= slot.close, "Ledger: slot still open");
            for owner in wallets {
                let mut registration = self.registrations.entry((key, owner)).read();
                assert!(registration.registered, "Ledger: not registered");
                assert!(registration.game_id == 0, "Ledger: registration already settled");
                if !registration.refundable {
                    registration.refundable = true;
                    self.registrations.entry((key, owner)).write(registration);
                    self.emit(RegistrationRefundable { key, owner });
                }
            }
        }

        fn open_request(ref self: ContractState, token_id: u256) {
            let wallet = starknet::get_caller_address();
            let mut chest = self.get_chest(token_id);
            assert!(!chest.requested, "Ledger: chest already requested");
            assert!(
                IERC721Dispatcher { contract_address: self.loot_chest.read() }.owner_of(token_id) == wallet,
                "Ledger: not chest owner",
            );
            chest.requested = true;
            chest.requester = wallet;
            chest.request_block = starknet::get_block_number();
            self.chests.entry(token_id).write(chest);
            ICollectibleDispatcher { contract_address: self.loot_chest.read() }.burn(token_id);
            self.emit(ChestRequested { token_id, wallet, request_block: chest.request_block });
        }

        fn open_finish(ref self: ContractState, token_id: u256) {
            self.pausable.assert_not_paused();
            let mut chest = self.get_chest(token_id);
            assert!(chest.requested, "Ledger: chest not requested");
            assert!(!chest.finished, "Ledger: chest already finished");
            let draw_block = chest.request_block + 1;
            assert!(starknet::get_block_number() >= draw_block + 10, "Ledger: draw block not readable");
            let block_hash = starknet::syscalls::get_block_hash_syscall(draw_block).unwrap_syscall();
            assert!(block_hash != 0, "Ledger: draw block unavailable");
            chest.finished = true;
            self.chests.entry(token_id).write(chest);
            let content = self.resolve_chest_content(token_id, chest, block_hash);
            self.deliver_chest(chest.requester, content);
            self.emit(ChestOpened { token_id, wallet: chest.requester, content });
        }

        fn get_chest_band(self: @ContractState, preset_id: u32, band: u8) -> ChestBandPreset {
            assert!(self.preset_exists.entry(preset_id).read(), "Ledger: unknown preset");
            assert!(band < 5, "Ledger: invalid chest band");
            self.chest_bands.entry((preset_id, band)).read()
        }

        fn get_cosmetic_items(self: @ContractState, preset_id: u32, rarity: u8) -> Array<u128> {
            assert!(self.preset_exists.entry(preset_id).read(), "Ledger: unknown preset");
            assert!(rarity < 5, "Ledger: invalid cosmetic rarity");
            let mut items = array![];
            for index in 0..self.cosmetic_counts.entry((preset_id, rarity)).read() {
                items.append(self.cosmetic_items.entry((preset_id, rarity, index)).read());
            }
            items
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

        fn get_slot(self: @ContractState, key: SlotKey) -> Slot {
            self.slots.entry(key).read()
        }

        fn get_registration(self: @ContractState, key: SlotKey, owner: ContractAddress) -> Registration {
            self.registrations.entry((key, owner)).read()
        }

        fn get_registrations(
            self: @ContractState, key: SlotKey, from: u64, limit: u32,
        ) -> Array<(ContractAddress, u64)> {
            let slot = self.slots.entry(key).read();
            assert!(slot.exists && from <= slot.registered_count, "Ledger: registration index out of bounds");
            assert!(limit > 0 && limit <= 100, "Ledger: invalid registration page size");
            let end = from + core::cmp::min(limit.into(), slot.registered_count - from);
            let mut page = array![];
            for index in from..end {
                let wallet = self.registered_owners.entry((key, index)).read();
                page.append((wallet, self.registrations.entry((key, wallet)).read().registered_at));
            }
            page
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
            loot_chest: ContractAddress,
            cosmetics: ContractAddress,
        ) {
            assert!(
                admin.is_non_zero()
                    && operator.is_non_zero()
                    && treasury.is_non_zero()
                    && lords.is_non_zero()
                    && mmr_token.is_non_zero()
                    && loot_chest.is_non_zero()
                    && cosmetics.is_non_zero(),
                "Ledger: zero constructor address",
            );
        }

        fn assert_valid_preset(self: @ContractState, preset: Preset) {
            assert!(
                preset.day_unit_seconds == 0
                    || preset.claim_window_seconds > crate::days::FRONTIER_REPORT_GRACE_SECONDS,
                "Ledger: claim window needs reporting grace",
            );
            assert!(preset.protocol_cut_bps <= 10_000, "Ledger: invalid protocol cut");
            assert!(preset.chest_lords_bps <= 10_000, "Ledger: invalid chest share");
            assert!(preset.frontier_top_n <= 100, "Ledger: invalid Frontier top count");
            assert!(
                preset.day_unit_seconds == 0
                    || (preset.frontier_top_n > 0
                        && preset.frontier_chest_bps > 0
                        && preset.frontier_chest_bps <= 10000),
                "Ledger: invalid Frontier split",
            );
            assert!(preset.protocol_cut_bps + preset.chest_lords_bps <= 10_000, "Ledger: combined shares exceed pot");
            assert!(
                preset.paid_fraction_bps > 0 && preset.paid_fraction_bps <= 10_000, "Ledger: invalid paid fraction",
            );
            assert!(preset.decay_bps > 0 && preset.decay_bps <= 10_000, "Ledger: invalid payout decay");
            assert!(preset.mmr.regression_bps <= 10_000, "Ledger: invalid MMR regression");
            if preset.mmr.enabled {
                assert!(
                    preset.mmr.spread > 0 && preset.mmr.max_delta > 0 && preset.mmr.k > 0,
                    "Ledger: invalid MMR parameters",
                );
            }
        }

        fn assert_slot_open_before_close(self: @ContractState, key: SlotKey) -> Slot {
            let slot = self.slots.entry(key).read();
            assert!(slot.exists, "Ledger: unknown slot");
            assert!(!slot.cancelled, "Ledger: slot closed");
            assert!(starknet::get_block_timestamp() < slot.close, "Ledger: slot already closed");
            slot
        }


        fn assert_registration_open(self: @ContractState, key: SlotKey, owner: ContractAddress) -> Slot {
            let slot = self.assert_slot_open_before_close(key);
            assert!(!self.registrations.entry((key, owner)).read().registered, "Ledger: already registered");
            slot
        }

        fn assert_results_open(self: @ContractState, slot: Slot) {
            assert!(slot.exists, "Ledger: unknown slot");
            assert!(!slot.cancelled, "Ledger: slot cancelled");
            assert!(starknet::get_block_timestamp() >= slot.close, "Ledger: slot still open");
            assert!(slot.registered_count > 0, "Ledger: empty roster");
        }
    }

    #[generate_trait]
    impl RegistrationWriterImpl of RegistrationWriterTrait {
        fn open_refunds(ref self: ContractState, key: SlotKey, mut slot: Slot) {
            slot.cancelled = true;
            self.slots.entry(key).write(slot);
        }

        fn record_paid_registration(
            ref self: ContractState, key: SlotKey, owner: ContractAddress, sword: bool, shield: bool, preset: Preset,
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
            let registration = Registration {
                registered: true,
                sword,
                shield,
                sword_credit,
                shield_credit,
                paid: payment,
                registered_at: starknet::get_block_timestamp(),
                ..Default::default(),
            };
            self.record_registration(key, owner, registration, payment);
            payment
        }

        fn record_registration(
            ref self: ContractState, key: SlotKey, owner: ContractAddress, registration: Registration, payment: u256,
        ) {
            let mut slot = self.slots.entry(key).read();
            self.registrations.entry((key, owner)).write(registration);
            self.registered_owners.entry((key, slot.registered_count)).write(owner);
            slot.registered_count += 1;
            self.add_to_pool(key, slot, payment);
        }

        fn add_to_pool(ref self: ContractState, key: SlotKey, mut slot: Slot, amount: u256) {
            slot.pool += amount;
            assert!(slot.pool <= 0xffffffffffffffffffffffffffffffff, "Ledger: slot pool exceeds u128");
            self.slots.entry(key).write(slot);
        }
    }

    #[generate_trait]
    impl ResultsValidatorImpl of ResultsValidatorTrait {
        fn allocate_game_pool(ref self: ContractState, key: SlotKey, mut slot: Slot, pool: u256, preset: Preset) {
            let mut season = self.get_season(slot.season_id);
            assert!(starknet::get_block_timestamp() < season.end, "Ledger: MMR frozen");
            let treasury_cut = pool * preset.protocol_cut_bps.into() / BPS;
            let net_pool = pool - treasury_cut;
            let chest_lords = pool * preset.chest_lords_bps.into() / BPS;
            season.chest_reserve += chest_lords;
            season.pool += net_pool - chest_lords;
            assert!(
                season.pool + season.chest_reserve <= 0xffffffffffffffffffffffffffffffff,
                "Ledger: season pool exceeds u128",
            );
            self.seasons.entry(slot.season_id).write(season);
            slot.pool -= pool;
            self.slots.entry(key).write(slot);
            self.send_lords(self.treasury.read(), treasury_cut);
        }

        fn assert_ranked_players(ranked: Span<RankedPlayer>) {
            assert!(!ranked.is_empty(), "Ledger: empty result");
            let _: u16 = ranked.len().try_into().unwrap();
            let mut seen: Felt252Dict<u8> = Default::default();
            for index in 0..ranked.len() {
                let row = *ranked.at(index);
                let expected_rank = if index == 0 {
                    1
                } else {
                    let previous = *ranked.at(index - 1);
                    if row.rank == previous.rank {
                        assert!(previous.wallet < row.wallet, "Ledger: unordered tie");
                        previous.rank
                    } else {
                        (index + 1).try_into().unwrap()
                    }
                };
                assert!(row.rank == expected_rank, "Ledger: invalid competition rank");
                assert!(seen.get(row.wallet.into()) == 0, "Ledger: duplicate result owner");
                seen.insert(row.wallet.into(), 1);
            }
        }

        fn unsettled_registration(self: @ContractState, key: SlotKey, owner: ContractAddress) -> Registration {
            let registration = self.registrations.entry((key, owner)).read();
            assert!(registration.registered, "Ledger: unregistered result owner");
            assert!(!registration.refundable, "Ledger: registration refundable");
            assert!(registration.game_id == 0, "Ledger: registration already settled");
            registration
        }

        fn validate_and_record_results(
            ref self: ContractState, slot_key: SlotKey, key: GameKey, ranked: Span<RankedPlayer>,
        ) -> u256 {
            Self::assert_ranked_players(ranked);
            let mut pool = 0;
            for row in ranked {
                let row = *row;
                let mut registration = self.unsettled_registration(slot_key, row.wallet);
                pool += registration.paid;
                registration.game_id = key.game_id;
                self.registrations.entry((slot_key, row.wallet)).write(registration);
                self.results.entry((key, row.wallet)).write(PlayerResult { rank: row.rank, ..Default::default() });
            }
            pool
        }
    }

    #[generate_trait]
    impl ChestWriterImpl of ChestWriterTrait {
        fn write_chest_preset(
            ref self: ContractState, preset_id: u32, bands: Span<ChestBandPreset>, items: Span<Array<u128>>,
        ) {
            assert!(bands.len() == 5 && items.len() == 5, "Ledger: five chest bands and rarities required");
            for index in 0_u32..5 {
                let band = *bands.at(index);
                Self::assert_valid_chest_band(band, bands.slice(0, index));
                self.chest_bands.entry((preset_id, index.try_into().unwrap())).write(band);
                self.write_cosmetic_inventory(preset_id, index.try_into().unwrap(), items.at(index).span());
            }
        }

        fn assert_valid_chest_band(band: ChestBandPreset, previous: Span<ChestBandPreset>) {
            assert!(
                band.metadata != 0 && band.metadata != 0x101 && band.metadata != 0x201, "Ledger: legacy chest metadata",
            );
            for other in previous {
                assert!(*other.metadata != band.metadata, "Ledger: duplicate band metadata");
            }
            let mut total: u32 = 0;
            for weight in outcome_weights(band.odds) {
                total += weight.into();
            }
            assert!(total == 10000, "Ledger: invalid chest odds");
            assert!(band.odds.lords == 0 || band.lords_shares > 0, "Ledger: zero LORDS reward");
            assert!(band.odds.lords < 10000, "Ledger: missing chest fallback");
        }

        fn write_cosmetic_inventory(ref self: ContractState, preset_id: u32, rarity: u8, items: Span<u128>) {
            assert!(!items.is_empty(), "Ledger: empty cosmetic rarity");
            for index in 0..items.len() {
                let item = *items.at(index);
                assert!(item != 0, "Ledger: zero cosmetic metadata");
                if index > 0 {
                    assert!(*items.at(index - 1) < item, "Ledger: unordered cosmetic items");
                }
                self.cosmetic_items.entry((preset_id, rarity, index)).write(item);
            }
            self.cosmetic_counts.entry((preset_id, rarity)).write(items.len());
        }

        fn mint_chests(ref self: ContractState, key: GameKey, slot: Slot, ranked: Span<RankedPlayer>) {
            let chest_token = ICollectibleDispatcher { contract_address: self.loot_chest.read() };
            for index in 0..ranked.len() {
                let row = *ranked.at(index);
                let ties = MmrWriterImpl::tie_count(ranked, index, row.rank);
                let band = rank_band(row.rank, ties, ranked.len().try_into().unwrap());
                let metadata = self.chest_bands.entry((slot.preset_id, band)).read().metadata;
                let token_id = chest_token.mint_with_id(row.wallet, metadata);
                self.record_minted_chest(key, slot.season_id, row.wallet, token_id, band);
            }
        }

        fn record_minted_chest(
            ref self: ContractState, key: GameKey, season_id: u32, wallet: ContractAddress, token_id: u256, band: u8,
        ) {
            assert!(!self.chests.entry(token_id).read().exists, "Ledger: duplicate chest id");
            self
                .chests
                .entry(token_id)
                .write(
                    Chest {
                        exists: true,
                        season_id,
                        band,
                        requested: false,
                        finished: false,
                        requester: Zero::zero(),
                        request_block: 0,
                    },
                );
            let mut result = self.results.entry((key, wallet)).read();
            result.chest_id = token_id;
            self.results.entry((key, wallet)).write(result);
            self.emit(ChestMinted { key, wallet, token_id, season_id, band });
        }

        fn resolve_chest_content(
            ref self: ContractState, token_id: u256, chest: Chest, block_hash: felt252,
        ) -> ChestContent {
            let mut season = self.get_season(chest.season_id);
            let band = self.chest_bands.entry((season.preset_id, chest.band)).read();
            let mut outcome = draw_outcome(band.odds, block_hash, token_id, chest.season_id);
            if outcome == 5 {
                let lords = self.get_preset(season.preset_id).entry_fee * band.lords_shares.into();
                if lords > 0 && lords <= season.chest_reserve {
                    season.chest_reserve -= lords;
                    self.seasons.entry(chest.season_id).write(season);
                    return ChestContent { kind: 3, cosmetic: 0, lords };
                }
                let mut fallback = band.odds;
                fallback.lords = 0;
                outcome = draw_outcome(fallback, block_hash, token_id, chest.season_id);
            }
            if outcome < 5 {
                let count = self.cosmetic_counts.entry((season.preset_id, outcome)).read();
                let index = draw_item_index(block_hash, token_id, chest.season_id, count);
                let cosmetic = self.cosmetic_items.entry((season.preset_id, outcome, index)).read();
                ChestContent { kind: 0, cosmetic, lords: 0 }
            } else {
                ChestContent { kind: outcome - 5, cosmetic: 0, lords: 0 }
            }
        }

        fn deliver_chest(ref self: ContractState, wallet: ContractAddress, content: ChestContent) {
            if content.kind == 0 {
                ICollectibleDispatcher { contract_address: self.cosmetics.read() }.mint(wallet, content.cosmetic);
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
        }

        fn validate_season_top(
            self: @ContractState, season_id: u32, season: BlitzSeason, winners: Span<ContractAddress>, preset: Preset,
        ) {
            assert!(
                winners.len() == Self::winner_count(season.participant_count, preset.paid_fraction_bps),
                "Ledger: incomplete top list",
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
        fn apply_mmr(
            ref self: ContractState, slot_key: SlotKey, key: GameKey, ranked: Span<RankedPlayer>, preset: Preset,
        ) {
            if !preset.mmr.enabled {
                return;
            }

            let mut updates = array![];
            for preview in self.calculate_mmr(slot_key, ranked, preset) {
                let mut result = self.results.entry((key, preview.wallet)).read();
                result.mmr_before = preview.mmr_before;
                result.mmr_after = preview.mmr_after;
                self.results.entry((key, preview.wallet)).write(result);
                updates.append((preview.wallet, preview.mmr_after.into() * MMR_PRECISION));
            }
            IMMRTokenDispatcher { contract_address: self.mmr_token.read() }.update_mmr_batch(updates);
        }

        fn calculate_mmr(
            self: @ContractState, slot_key: SlotKey, ranked: Span<RankedPlayer>, preset: Preset,
        ) -> Array<MmrPreview> {
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
            let median = if preset.mmr.enabled {
                Self::median(ref sorted_mmrs, ranked.len())
            } else {
                0
            };

            let mut previews = array![];
            index = 0;
            while index < ranked.len() {
                let owner = *ranked.at(index).wallet;
                let rank = *ranked.at(index).rank;
                let group_size = Self::tie_count(ranked, index, rank);
                let current_mmr = *current_mmrs.at(index);
                let new_mmr = if preset.mmr.enabled {
                    let calculated_mmr = MmrCalculatorImpl::calculate_player_mmr(
                        preset.mmr, current_mmr, rank, group_size, ranked.len().try_into().unwrap(), median,
                    );
                    let registration = self.registrations.entry((slot_key, owner)).read();
                    MmrCalculatorImpl::apply_flag_modifier(
                        current_mmr, calculated_mmr, registration.sword, registration.shield,
                    )
                } else {
                    current_mmr
                };
                let delta: i32 = if new_mmr >= current_mmr {
                    (new_mmr - current_mmr).try_into().unwrap()
                } else {
                    -(current_mmr - new_mmr).try_into().unwrap()
                };
                previews.append(MmrPreview { wallet: owner, mmr_before: current_mmr, mmr_after: new_mmr, delta });
                index += 1;
            }
            previews
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

fn frontier_unlock(season: FrontierSeason, preset: Preset, now: u64) -> u256 {
    if now < season.start {
        0
    } else if now >= season.end {
        season.pool
    } else {
        let clock = crate::types::FrontierClock { start_main_at: season.start, seed: season.seed };
        let day = crate::days::day_of(clock, preset.day_unit_seconds, now);
        let end = core::cmp::min(day.end, season.end);
        season.pool * (end - season.start).into() / (season.end - season.start).into()
    }
}
