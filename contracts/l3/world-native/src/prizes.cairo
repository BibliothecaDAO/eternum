#[starknet::contract]
pub mod PrizesDomain {
    const MAX_PHASES_PER_CLAIM: u32 = 8;
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use crate::blitz_results::BlitzResultState;
    use crate::commands::ExecutionContext;
    use crate::events::RowSet;
    use crate::faith::{
        ClaimPlayer, FaithState, FaithfulStructure, PlayerFaithKey, PlayerFaithPoints, WonderFaith, WonderFaithWinners,
    };
    use crate::faith_prizes::{IPrizeTokenDispatcher, IPrizeTokenDispatcherTrait, PrizePool};
    use crate::game::{GameRegistry, IGameDispatcher, IGameDispatcherTrait, assert_playing};
    use crate::lifecycle::Lifecycle;
    use crate::resources::{IResourcesDispatcher, IResourcesDispatcherTrait, ResourceKey};
    use crate::structures::{IStructuresDispatcher, IStructuresDispatcherTrait};
    component!(path: crate::bitcoin::BitcoinState, storage: bitcoin, event: BitcoinEvent);
    impl BitcoinInternal = crate::bitcoin::BitcoinState::InternalImpl<ContractState>;
    component!(path: FaithState, storage: faith, event: FaithEvent);
    impl FaithInternal = FaithState::InternalImpl<ContractState>;
    #[abi(embed_v0)]
    impl Faith = FaithState::FaithImpl<ContractState>;
    impl FaithSettlement = FaithState::PrizeSettlement<ContractState>;
    component!(path: BlitzResultState, storage: blitz, event: BlitzEvent);
    #[abi(embed_v0)]
    impl BlitzResults = BlitzResultState::BlitzResultsImpl<ContractState>;
    component!(path: Lifecycle, storage: lifecycle, event: LifecycleEvent);
    #[abi(embed_v0)]
    impl Domain = Lifecycle::DomainImpl<ContractState>;
    impl LifeInternal = Lifecycle::InternalImpl<ContractState>;
    #[storage]
    struct Storage {
        #[substorage(v0)]
        lifecycle: Lifecycle::Storage,
        #[substorage(v0)]
        blitz: BlitzResultState::Storage,
        #[substorage(v0)]
        faith: FaithState::Storage,
        #[substorage(v0)]
        bitcoin: crate::bitcoin::BitcoinState::Storage,
        reward_tokens: Map<u32, Option<ContractAddress>>,
        faith_pools: Map<u32, PrizePool>,
        faith_claims: Map<(u32, ContractAddress, u32), bool>,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        LifecycleEvent: Lifecycle::Event,
        BlitzEvent: BlitzResultState::Event,
        FaithEvent: FaithState::Event,
        BitcoinEvent: crate::bitcoin::BitcoinState::Event,
        StoryEvent: crate::ownership::StoryEvent,
        RowSet: RowSet,
    }
    #[abi(embed_v0)]
    impl FaithViews of crate::faith::IFaithOwnershipViews<ContractState> {
        fn wonder_faith(self: @ContractState, key: ResourceKey) -> WonderFaith {
            self.faith.faith_wonders.read((key.game_id, key.entity_id))
        }
        fn faithful_structure(self: @ContractState, key: ResourceKey) -> FaithfulStructure {
            self.faith.faith_pledges.read((key.game_id, key.entity_id))
        }
        fn player_faith_points(self: @ContractState, key: PlayerFaithKey) -> PlayerFaithPoints {
            self.faith.faith_players.read((key.game_id, key.player, key.wonder_id))
        }
        fn wonder_faith_winners(self: @ContractState, game_id: u32) -> WonderFaithWinners {
            self.faith.winners(game_id)
        }
    }
    #[abi(embed_v0)]
    impl FaithOwnership of crate::faith::IFaithOwnership<ContractState> {
        fn transfer_faith_ownership(ref self: ContractState, key: ResourceKey, owner: ContractAddress, timestamp: u64) {
            assert!(get_caller_address() == self.lifecycle.require_active().structures, "only structures domain");
            let game = self.games().game(key.game_id);
            self.faith.transfer(key.game_id, key.entity_id, owner, timestamp, game.end_at);
        }
    }
    #[abi(embed_v0)]
    impl BitcoinViews of crate::bitcoin::IBitcoinViews<ContractState> {
        fn bitcoin_mine(self: @ContractState, key: ResourceKey) -> crate::bitcoin::MineFunding {
            self.bitcoin.mine(key)
        }
        fn bitcoin_claimed(self: @ContractState, key: crate::bitcoin::ClaimKey) -> bool {
            self.bitcoin.was_claimed(key)
        }
        fn bitcoin_phase(self: @ContractState, key: crate::bitcoin::PhaseKey) -> crate::bitcoin::Phase {
            self.bitcoin.phase(key)
        }
        fn bitcoin_contribution(
            self: @ContractState, key: crate::bitcoin::ContributionKey,
        ) -> crate::bitcoin::Contribution {
            self.bitcoin.contribution(key)
        }
        fn bitcoin_contributor(self: @ContractState, key: crate::bitcoin::PhaseKey, index: u32) -> ContractAddress {
            self.bitcoin.contributor(key, index)
        }
    }
    #[abi(embed_v0)]
    impl BitcoinFunding of crate::bitcoin::IBitcoinFunding<ContractState> {
        fn register_bitcoin_structure(ref self: ContractState, key: ResourceKey, category: u8, timestamp: u64) {
            assert!(get_caller_address() == self.lifecycle.require_active().resources, "only resources domain");
            assert!(category == 8, "not a Bitcoin mine");
            let interval = self.games().rules(key.game_id).tick_config.bitcoin_phase_in_seconds;
            assert!(interval != 0, "zero Bitcoin phase duration");
            self.bitcoin.register_mine(key, timestamp / interval + 1);
        }
        fn bitcoin_mine_captured(ref self: ContractState, key: ResourceKey, timestamp: u64) {
            assert!(get_caller_address() == self.lifecycle.require_active().structures, "only structures domain");
            let rules = self.games().rules(key.game_id);
            let mine = IStructuresDispatcher { contract_address: self.lifecycle.require_active().structures }
                .structure(key)
                .expect('missing Bitcoin mine');
            let prize = if mine.owner == 0.try_into().unwrap() {
                0
            } else {
                rules.bitcoin_mine_config.prize_per_phase
            };
            let interval = rules.tick_config.bitcoin_phase_in_seconds;
            let phase = timestamp / interval;
            let closed_before = if timestamp % interval == interval - 1 {
                phase + 1
            } else {
                phase
            };
            self.bitcoin.capture_mine(key, phase + 1, closed_before, prize);
        }
    }
    #[abi(embed_v0)]
    impl BitcoinCommands of crate::bitcoin::IBitcoinCommands<ContractState> {
        fn claim_bitcoin_phase(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::bitcoin::ClaimPhase,
            context: ExecutionContext,
        ) -> u64 {
            self.assert_bitcoin_phase_closed(game_id, command.phase, context.timestamp);
            assert!(!command.mine_ids.is_empty(), "empty Bitcoin claim batch");
            assert!(command.mine_ids.len() <= crate::commands::MAX_COMMAND_ITEMS, "too many Bitcoin mines");
            crate::commands::assert_unique_entity_ids(command.mine_ids);
            let limit = core::cmp::min(
                MAX_PHASES_PER_CLAIM, crate::commands::MAX_COMMAND_ITEMS / command.mine_ids.len(),
            );
            let mut remaining = 0;
            for mine_id in command.mine_ids {
                remaining += self
                    .claim_bound_phases(
                        ResourceKey { game_id, entity_id: *mine_id }, command.phase, limit, context.timestamp,
                    );
            }
            remaining
        }

        fn contribute_bitcoin_labor(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::bitcoin::ContributeLabor,
            context: ExecutionContext,
        ) {
            self.assert_bitcoin_command(game_id, context.timestamp);
            let game = self.games().game(game_id);
            assert_playing(game, context.timestamp);
            let rules = self.games().rules(game_id);
            let phase = context.timestamp / rules.tick_config.bitcoin_phase_in_seconds;
            let end = crate::bitcoin::phase_end(phase, rules.tick_config.bitcoin_phase_in_seconds);
            assert!(context.timestamp < end, "Bitcoin contribution window is closed");
            assert!(game.end_at == 0 || end <= game.end_at, "Bitcoin phase ends after game");
            assert!(
                command.amount != 0 && command.amount >= rules.bitcoin_mine_config.min_labor_per_contribution,
                "Bitcoin labor below minimum",
            );
            let key = ResourceKey { game_id, entity_id: command.structure_id };
            assert!(
                IStructuresDispatcher { contract_address: self.lifecycle.require_active().structures }
                    .structure_owner(key) == actor,
                "actor does not own labor source",
            );
            self.resources().spend_resource(key, 23, command.amount, context.timestamp);
            self
                .bitcoin
                .contribute(
                    crate::bitcoin::ContributionKey { game_id, phase, player: actor },
                    command.structure_id,
                    command.amount,
                );
        }
        fn close_bitcoin_phase(
            ref self: ContractState, game_id: u32, actor: ContractAddress, phase: u64, context: ExecutionContext,
        ) {
            self.assert_bitcoin_phase_closed(game_id, phase, context.timestamp);
            self.bitcoin.close(crate::bitcoin::PhaseKey { game_id, phase });
        }
        fn bind_bitcoin_phase(
            ref self: ContractState, game_id: u32, actor: ContractAddress, phase: u64, context: ExecutionContext,
        ) {
            self.assert_bitcoin_phase_closed(game_id, phase, context.timestamp);
            self.bitcoin.bind(crate::bitcoin::PhaseKey { game_id, phase }, context.raw_root);
        }
    }
    #[constructor]
    fn constructor(ref self: ContractState, authority: ContractAddress) {
        self.lifecycle.initialize(authority);
    }
    #[abi(embed_v0)]
    impl FaithPrizes of crate::faith_prizes::IFaithPrizes<ContractState> {
        fn configure_faith_reward_token(ref self: ContractState, game_id: u32, token: ContractAddress) {
            self.lifecycle.assert_configurator();
            self.games().game(game_id);
            assert!(self.reward_tokens.read(game_id).is_none(), "faith token already configured");
            self.reward_tokens.write(game_id, Some(token));
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'FaithRewardToken',
                        keys: array![game_id.into()].span(),
                        values: array![token.into()].span(),
                    },
                );
        }
        fn faith_reward_token(self: @ContractState, game_id: u32) -> ContractAddress {
            self.reward_tokens.read(game_id).expect('missing faith reward token')
        }
        fn faith_prize_pool(self: @ContractState, game_id: u32) -> PrizePool {
            self.faith_pools.read(game_id)
        }
        fn faith_prize_claimed(self: @ContractState, key: PlayerFaithKey) -> bool {
            self.faith_claims.read((key.game_id, key.player, key.wonder_id))
        }
        fn fund_faith_prizes(
            ref self: ContractState, game_id: u32, actor: ContractAddress, amount: u128, context: ExecutionContext,
        ) {
            let game = self.authorize(game_id, context.timestamp);
            assert!(game.end_at == 0 || context.timestamp < game.end_at, "game ended");
            assert!(amount > 0, "faith funding must be positive");
            let token = self.token(game_id);
            assert!(
                self.games().rules(game_id).faith_enabled && token.contract_address != 0.try_into().unwrap(),
                "faith reward token disabled",
            );
            let mut pool = self.faith_prize_pool(game_id);
            assert!(!pool.distributed, "faith prizes already distributed");
            self.receive_funding(token, actor, amount);
            pool.funded += amount;
            self.write_pool(game_id, pool);
        }
        fn distribute_faith_prizes(
            ref self: ContractState, game_id: u32, actor: ContractAddress, context: ExecutionContext,
        ) -> u64 {
            self.require_ended(self.authorize(game_id, context.timestamp), context.timestamp);
            let mut pool = self.faith_prize_pool(game_id);
            assert!(!pool.distributed, "faith prizes already distributed");
            let remaining = self.faith.settle_faith_wonders(game_id, context.timestamp);
            if remaining != 0 {
                return remaining.into();
            }
            pool.distributed = true;
            self.write_pool(game_id, pool);
            0
        }
        fn claim_faith_prize(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: ClaimPlayer,
            context: ExecutionContext,
        ) {
            self.require_ended(self.authorize(game_id, context.timestamp), context.timestamp);
            assert!(command.player != 0.try_into().unwrap(), "invalid player");
            let key = PlayerFaithKey { game_id, player: command.player, wonder_id: command.wonder_id };
            assert!(!self.faith_prize_claimed(key), "faith prize already claimed");
            let prize = self.wonder_prize(game_id, command.wonder_id);
            self.faith.settle_player_faith(game_id, command.player, command.wonder_id, context.timestamp);
            let points = self.player_faith_points(key).points_claimed;
            if points == 0 {
                return;
            }
            let total = self
                .wonder_faith(crate::resources::ResourceKey { game_id, entity_id: command.wonder_id })
                .claimed_points;
            assert!(total > 0, "wonder has no points");
            let share: u256 = Into::<u128, u256>::into(points) * prize.into() / total.into();
            if share != 0 {
                self.pay_claim(key, share);
            }
        }
    }
    #[generate_trait]
    impl Internal of InternalTrait {
        fn resources(self: @ContractState) -> IResourcesDispatcher {
            IResourcesDispatcher { contract_address: self.lifecycle.require_active().resources }
        }
        fn claim_bound_phases(
            ref self: ContractState, mine: ResourceKey, through: u64, limit: u32, timestamp: u64,
        ) -> u64 {
            let mut phase_id = self.bitcoin.mine(mine).next_phase;
            for _ in 0..limit {
                if phase_id > through {
                    break;
                }
                let phase = self.bitcoin.phase(crate::bitcoin::PhaseKey { game_id: mine.game_id, phase: phase_id });
                if phase.state == crate::bitcoin::PhaseStatus::Open
                    || (phase.total_labor != 0 && phase.state != crate::bitcoin::PhaseStatus::Bound) {
                    break;
                }
                self
                    .claim_bitcoin_mine(
                        crate::bitcoin::ClaimKey { game_id: mine.game_id, phase: phase_id, mine_id: mine.entity_id },
                        phase,
                        timestamp,
                    );
                phase_id += 1;
            }
            if phase_id > through {
                0
            } else {
                through - phase_id + 1
            }
        }
        fn claim_bitcoin_mine(
            ref self: ContractState, key: crate::bitcoin::ClaimKey, phase: crate::bitcoin::Phase, timestamp: u64,
        ) {
            if self.bitcoin.was_claimed(key) {
                return;
            }
            let resource_key = ResourceKey { game_id: key.game_id, entity_id: key.mine_id };
            let mut funding = self.bitcoin.mine(resource_key);
            assert!(funding.next_phase == key.phase, "claim earlier Bitcoin phase first");
            let structures = IStructuresDispatcher { contract_address: self.lifecycle.require_active().structures };
            let mine = structures.structure(resource_key).expect('missing Bitcoin mine');
            assert!(mine.base.category == 8, "not a Bitcoin mine");
            if mine.owner != 0.try_into().unwrap() && key.phase >= funding.eligible_from {
                let config = self.games().rules(key.game_id).bitcoin_mine_config;
                if phase.total_labor == 0 {
                    funding.unsplit_carry += config.prize_per_phase;
                } else {
                    let winner = self.bitcoin.winner(key);
                    let (winner_share, owner_share) = crate::bitcoin::split_prize(
                        config.prize_per_phase + funding.unsplit_carry, config.owner_cut_bps,
                    );
                    let winner_share = winner_share + funding.winner_carry;
                    let (winner_destination, winner_paid) = self
                        .pay_bitcoin_winner(key, winner, winner_share, timestamp);
                    let owner_destination = key.mine_id;
                    let owner_paid = self.pay_bitcoin_share(resource_key, owner_share, timestamp);
                    funding.unsplit_carry = 0;
                    funding.winner_carry = winner_share - winner_paid;
                    self
                        .emit_bitcoin_award(
                            key.game_id,
                            timestamp,
                            crate::bitcoin::BitcoinAwardStory {
                                phase: key.phase,
                                mine_id: key.mine_id,
                                winner,
                                owner: mine.owner,
                                winner_destination,
                                owner_destination,
                                winner_paid,
                                owner_paid,
                            },
                        );
                }
            }
            self.bitcoin.complete_claim(key, funding);
        }
        fn pay_bitcoin_winner(
            ref self: ContractState,
            key: crate::bitcoin::ClaimKey,
            winner: ContractAddress,
            amount: u128,
            timestamp: u64,
        ) -> (u32, u128) {
            let contribution = self
                .bitcoin
                .contribution(
                    crate::bitcoin::ContributionKey { game_id: key.game_id, phase: key.phase, player: winner },
                );
            let destination = ResourceKey { game_id: key.game_id, entity_id: contribution.structure_id };
            let structures = IStructuresDispatcher { contract_address: self.lifecycle.require_active().structures };
            if structures.structure_owner(destination) != winner || amount == 0 {
                return (0, 0);
            }
            (destination.entity_id, self.pay_bitcoin_share(destination, amount, timestamp))
        }
        fn emit_bitcoin_award(
            ref self: ContractState, game_id: u32, timestamp: u64, award: crate::bitcoin::BitcoinAwardStory,
        ) {
            self
                .emit(
                    crate::ownership::StoryEvent {
                        version: 1,
                        game_id,
                        id: self.games().allocate_entity(game_id),
                        owner: Some(award.winner),
                        entity_id: Some(award.mine_id),
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        timestamp,
                        story: crate::ownership::Story::BitcoinAwardStory(award),
                    },
                );
        }
        fn pay_bitcoin_share(ref self: ContractState, destination: ResourceKey, amount: u128, timestamp: u64) -> u128 {
            if amount == 0 {
                return 0;
            }
            let rule = self.resources().resource_rule(destination.game_id, 58);
            assert!(rule.unit_weight == 0, "SAT must be weightless");
            let paid = self.resources().grant_resource(destination, 58, amount, timestamp);
            assert!(paid == amount, "incomplete Bitcoin award");
            paid
        }
        fn assert_bitcoin_command(self: @ContractState, game_id: u32, timestamp: u64) {
            assert!(
                get_caller_address() == self.lifecycle.require_active().season, "only authenticated command domain",
            );
            crate::commands::assert_context_time(timestamp);
            assert!(self.games().rules(game_id).bitcoin_mine_config.enabled, "Bitcoin mining disabled");
        }
        fn assert_bitcoin_phase_closed(self: @ContractState, game_id: u32, phase: u64, timestamp: u64) {
            self.assert_bitcoin_command(game_id, timestamp);
            let end = crate::bitcoin::phase_end(
                phase, self.games().rules(game_id).tick_config.bitcoin_phase_in_seconds,
            );
            let game = self.games().game(game_id);
            assert!(
                end >= game.start_main_at && (game.end_at == 0 || end <= game.end_at), "Bitcoin phase outside game",
            );
            assert!(timestamp >= end, "Bitcoin phase is still open");
        }

        fn games(self: @ContractState) -> IGameDispatcher {
            IGameDispatcher { contract_address: self.lifecycle.require_active().season }
        }
        fn token(self: @ContractState, game_id: u32) -> IPrizeTokenDispatcher {
            IPrizeTokenDispatcher { contract_address: self.faith_reward_token(game_id) }
        }
        fn authorize(self: @ContractState, game_id: u32, timestamp: u64) -> GameRegistry {
            self.faith.authorize(game_id, timestamp)
        }
        fn require_ended(self: @ContractState, game: GameRegistry, timestamp: u64) {
            assert!(
                game.dev_mode_on || (timestamp >= game.start_main_at && timestamp >= game.start_settling_at),
                "game not started",
            );
            assert!(game.end_at != 0 && timestamp >= game.end_at, "game not ended");
        }
        fn receive_funding(self: @ContractState, token: IPrizeTokenDispatcher, actor: ContractAddress, amount: u128) {
            let recipient = get_contract_address();
            let before = token.balance_of(recipient);
            assert!(token.transfer_from(actor, recipient, amount.into()), "faith funding transfer failed");
            assert!(token.balance_of(recipient) == before + amount.into(), "faith funding amount mismatch");
        }
        fn wonder_prize(self: @ContractState, game_id: u32, wonder_id: u32) -> u128 {
            let pool = self.faith_prize_pool(game_id);
            assert!(pool.distributed, "faith prizes not distributed");
            let winners = self.faith.faith_winner_count(game_id, wonder_id);
            assert!(winners != 0, "no prize for wonder");
            let prize = pool.funded / winners.into();
            assert!(prize > 0, "no prize for wonder");
            prize
        }
        fn pay_claim(ref self: ContractState, key: PlayerFaithKey, amount: u256) {
            self.faith_claims.write((key.game_id, key.player, key.wonder_id), true);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'FaithPrizeClaimed',
                        keys: array![key.game_id.into(), key.player.into(), key.wonder_id.into()].span(),
                        values: array![1].span(),
                    },
                );
            assert!(self.token(key.game_id).transfer(key.player, amount), "faith prize transfer failed");
        }
        fn write_pool(ref self: ContractState, game_id: u32, pool: PrizePool) {
            self.faith_pools.write(game_id, pool);
            let mut values = array![];
            pool.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1, model: 'FaithPrizePool', keys: array![game_id.into()].span(), values: values.span(),
                    },
                );
        }
    }
}
