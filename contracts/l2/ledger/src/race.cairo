use core::poseidon::poseidon_hash_span;
use starknet::{ClassHash, ContractAddress};

pub const RACE_CLAIM_WINDOW_SECONDS: u64 = 604800;

#[derive(Copy, Default, Drop, Serde, PartialEq, starknet::Store)]
pub struct RaceSeason {
    pub funded: bool,
    pub pool: u256,
    pub posted: bool,
    pub posted_at: u64,
    pub total: u256,
    pub paid: u256,
    pub closed: bool,
}

#[derive(Copy, Drop, Serde, PartialEq, starknet::Store)]
pub struct RaceReward {
    pub wallet: ContractAddress,
    pub amount: u256,
}

pub fn race_post_hash(
    chain: felt252, rewards: ContractAddress, epoch: u64, shard: felt252, season: u32, total: u256,
) -> felt252 {
    poseidon_hash_span(
        array![
            'ETERNUM_RACE_POST_V1', chain, rewards.into(), epoch.into(), shard, season.into(), total.low.into(),
            total.high.into(),
        ]
            .span(),
    )
}

pub fn race_pay_hash(
    chain: felt252,
    rewards: ContractAddress,
    epoch: u64,
    shard: felt252,
    season: u32,
    home: u64,
    wallet: ContractAddress,
    amount: u256,
) -> felt252 {
    poseidon_hash_span(
        array![
            'ETERNUM_RACE_PAY_V1', chain, rewards.into(), epoch.into(), shard, season.into(), home.into(),
            wallet.into(), amount.low.into(), amount.high.into(),
        ]
            .span(),
    )
}

#[starknet::interface]
pub trait IRaceRewards<TState> {
    fn ledger(self: @TState) -> ContractAddress;
    fn treasury(self: @TState) -> ContractAddress;
    fn upgrade(ref self: TState, new_class_hash: ClassHash);
    fn fund_race(ref self: TState, shard: felt252, season_id: u32, amount: u256);
    fn post_race(
        ref self: TState, shard: felt252, season_id: u32, total: u256, signature_r: felt252, signature_s: felt252,
    );
    fn pay_race(
        ref self: TState,
        shard: felt252,
        season_id: u32,
        home: u64,
        wallet: ContractAddress,
        amount: u256,
        signature_r: felt252,
        signature_s: felt252,
    );
    fn close_race(ref self: TState, shard: felt252, season_id: u32);
    fn get_race(self: @TState, shard: felt252, season_id: u32) -> RaceSeason;
    fn get_race_reward(self: @TState, shard: felt252, season_id: u32, home: u64) -> RaceReward;
}

#[starknet::contract]
pub mod RaceRewards {
    use core::num::traits::Zero;
    use game_ledger::contract::{IGameLedgerDispatcher, IGameLedgerDispatcherTrait, OPERATOR_ROLE};
    use openzeppelin::access::accesscontrol::DEFAULT_ADMIN_ROLE;
    use openzeppelin::access::accesscontrol::interface::{IAccessControlDispatcher, IAccessControlDispatcherTrait};
    use openzeppelin::security::interface::{IPausableDispatcher, IPausableDispatcherTrait};
    use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use starknet::storage::{Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ClassHash, ContractAddress, SyscallResultTrait};
    use super::{IRaceRewards, RACE_CLAIM_WINDOW_SECONDS, RaceReward, RaceSeason};

    #[storage]
    struct Storage {
        ledger: ContractAddress,
        treasury: ContractAddress,
        race_seasons: Map<(felt252, u32), RaceSeason>,
        race_rewards: Map<(felt252, u32, u64), RaceReward>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        RaceFunded: RaceFunded,
        RacePosted: RacePosted,
        RacePaid: RacePaid,
        RaceClosed: RaceClosed,
    }

    #[derive(Drop, starknet::Event)]
    struct RaceFunded {
        #[key]
        shard: felt252,
        #[key]
        season_id: u32,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct RacePosted {
        #[key]
        shard: felt252,
        #[key]
        season_id: u32,
        total: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct RacePaid {
        #[key]
        shard: felt252,
        #[key]
        season_id: u32,
        #[key]
        home: u64,
        wallet: ContractAddress,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct RaceClosed {
        #[key]
        shard: felt252,
        #[key]
        season_id: u32,
        treasury: ContractAddress,
        returned: u256,
    }

    #[constructor]
    fn constructor(ref self: ContractState, ledger: ContractAddress, treasury: ContractAddress) {
        self.ledger.write(ledger);
        self.treasury.write(treasury);
    }

    #[abi(embed_v0)]
    impl RaceRewardsImpl of IRaceRewards<ContractState> {
        fn ledger(self: @ContractState) -> ContractAddress {
            self.ledger.read()
        }

        fn treasury(self: @ContractState) -> ContractAddress {
            self.treasury.read()
        }

        fn upgrade(ref self: ContractState, new_class_hash: ClassHash) {
            self.assert_ledger_role(DEFAULT_ADMIN_ROLE);
            assert!(new_class_hash.is_non_zero(), "Race: zero class");
            starknet::syscalls::replace_class_syscall(new_class_hash).unwrap_syscall();
        }

        fn fund_race(ref self: ContractState, shard: felt252, season_id: u32, amount: u256) {
            self.assert_ledger_role(DEFAULT_ADMIN_ROLE);
            assert!(shard != 0, "Race: zero shard");
            assert!(!self.get_race(shard, season_id).funded, "Race: already funded");
            assert!(amount > 0, "Race: invalid funding");
            self
                .race_seasons
                .entry((shard, season_id))
                .write(RaceSeason { funded: true, pool: amount, ..Default::default() });
            assert!(
                self.lords().transfer_from(starknet::get_caller_address(), starknet::get_contract_address(), amount),
                "Race: LORDS transfer_from failed",
            );
            self.emit(RaceFunded { shard, season_id, amount });
        }

        fn post_race(
            ref self: ContractState,
            shard: felt252,
            season_id: u32,
            total: u256,
            signature_r: felt252,
            signature_s: felt252,
        ) {
            self.assert_operating();
            let mut season = self.get_race(shard, season_id);
            assert!(season.funded, "Race: unknown race");
            if season.posted {
                assert!(season.total == total, "Race: conflicting post");
                return;
            }
            assert!(total <= season.pool, "Race: total exceeds pool");
            let (key, epoch) = self.ledger_dispatcher().cosigner();
            let message = super::race_post_hash(
                starknet::get_tx_info().unbox().chain_id,
                starknet::get_contract_address(),
                epoch,
                shard,
                season_id,
                total,
            );
            assert!(
                core::ecdsa::check_ecdsa_signature(message, key, signature_r, signature_s), "Race: invalid cosignature",
            );
            season.posted = true;
            season.posted_at = starknet::get_block_timestamp();
            season.total = total;
            self.race_seasons.entry((shard, season_id)).write(season);
            self.emit(RacePosted { shard, season_id, total });
        }

        fn pay_race(
            ref self: ContractState,
            shard: felt252,
            season_id: u32,
            home: u64,
            wallet: ContractAddress,
            amount: u256,
            signature_r: felt252,
            signature_s: felt252,
        ) {
            self.assert_operating();
            assert!(wallet.is_non_zero() && amount > 0, "Race: invalid payment");
            let paid = self.get_race_reward(shard, season_id, home);
            if paid.amount != 0 {
                assert!(paid.wallet == wallet && paid.amount == amount, "Race: conflicting payment");
                return;
            }
            let mut season = self.get_race(shard, season_id);
            assert!(season.posted, "Race: not posted");
            assert!(!season.closed, "Race: closed");
            assert!(amount <= season.total - season.paid, "Race: total exceeded");
            let (key, epoch) = self.ledger_dispatcher().cosigner();
            let message = super::race_pay_hash(
                starknet::get_tx_info().unbox().chain_id,
                starknet::get_contract_address(),
                epoch,
                shard,
                season_id,
                home,
                wallet,
                amount,
            );
            assert!(
                core::ecdsa::check_ecdsa_signature(message, key, signature_r, signature_s), "Race: invalid cosignature",
            );
            season.paid += amount;
            self.race_seasons.entry((shard, season_id)).write(season);
            self.race_rewards.entry((shard, season_id, home)).write(RaceReward { wallet, amount });
            assert!(self.lords().transfer(wallet, amount), "Race: LORDS transfer failed");
            self.emit(RacePaid { shard, season_id, home, wallet, amount });
        }

        fn close_race(ref self: ContractState, shard: felt252, season_id: u32) {
            self.assert_operating();
            let mut season = self.get_race(shard, season_id);
            if season.closed {
                return;
            }
            assert!(season.posted, "Race: not posted");
            assert!(
                season.paid == season.total || starknet::get_block_timestamp() >= season.posted_at
                    + RACE_CLAIM_WINDOW_SECONDS,
                "Race: rewards unpaid",
            );
            let returned = season.pool - season.paid;
            let treasury = self.treasury.read();
            season.closed = true;
            self.race_seasons.entry((shard, season_id)).write(season);
            if returned > 0 {
                assert!(self.lords().transfer(treasury, returned), "Race: LORDS transfer failed");
            }
            self.emit(RaceClosed { shard, season_id, treasury, returned });
        }

        fn get_race(self: @ContractState, shard: felt252, season_id: u32) -> RaceSeason {
            self.race_seasons.entry((shard, season_id)).read()
        }

        fn get_race_reward(self: @ContractState, shard: felt252, season_id: u32, home: u64) -> RaceReward {
            self.race_rewards.entry((shard, season_id, home)).read()
        }
    }

    #[generate_trait]
    impl Internal of InternalTrait {
        fn ledger_dispatcher(self: @ContractState) -> IGameLedgerDispatcher {
            IGameLedgerDispatcher { contract_address: self.ledger.read() }
        }

        fn lords(self: @ContractState) -> IERC20Dispatcher {
            IERC20Dispatcher { contract_address: self.ledger_dispatcher().lords() }
        }

        fn assert_ledger_role(self: @ContractState, role: felt252) {
            assert!(
                IAccessControlDispatcher { contract_address: self.ledger.read() }
                    .has_role(role, starknet::get_caller_address()),
                "Race: caller lacks the ledger role",
            );
        }

        fn assert_operating(self: @ContractState) {
            self.assert_ledger_role(OPERATOR_ROLE);
            assert!(!IPausableDispatcher { contract_address: self.ledger.read() }.is_paused(), "Race: ledger paused");
        }
    }
}
