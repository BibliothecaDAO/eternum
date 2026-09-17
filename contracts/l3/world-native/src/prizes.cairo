#[starknet::contract]
pub mod PrizesDomain {
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use crate::blitz_prizes::BlitzPrizeState;
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
    component!(path: BlitzPrizeState, storage: blitz, event: BlitzEvent);
    #[abi(embed_v0)]
    impl BlitzPrizes = BlitzPrizeState::BlitzPrizesImpl<ContractState>;
    component!(path: Lifecycle, storage: lifecycle, event: LifecycleEvent);
    #[abi(embed_v0)]
    impl Domain = Lifecycle::DomainImpl<ContractState>;
    impl LifeInternal = Lifecycle::InternalImpl<ContractState>;
    #[storage]
    struct Storage {
        #[substorage(v0)]
        lifecycle: Lifecycle::Storage,
        #[substorage(v0)]
        blitz: BlitzPrizeState::Storage,
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
        BlitzEvent: BlitzPrizeState::Event,
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
        fn bitcoin_contribution(self: @ContractState, key: crate::bitcoin::ContributionKey) -> u128 {
            self.bitcoin.labor(key)
        }
        fn bitcoin_contributor(self: @ContractState, key: crate::bitcoin::PhaseKey, index: u32) -> ContractAddress {
            self.bitcoin.contributor(key, index)
        }
    }
    #[abi(embed_v0)]
    impl BitcoinFunding of crate::bitcoin::IBitcoinFunding<ContractState> {
        fn register_bitcoin_structure(ref self: ContractState, key: ResourceKey, category: u8, timestamp: u64) {
            assert!(get_caller_address() == self.lifecycle.require_active().resources, "only resources domain");
            if category == 1 || category == 5 {
                self.bitcoin.index_settlement(key);
            } else {
                assert!(category == 8, "not a Bitcoin structure");
                let interval = self.games().rules(key.game_id).tick_config.bitcoin_phase_in_seconds;
                assert!(interval != 0, "zero Bitcoin phase duration");
                self.bitcoin.register_mine(key, timestamp / interval + 1);
            }
        }
        fn bitcoin_mine_captured(ref self: ContractState, key: ResourceKey, timestamp: u64) {
            assert!(get_caller_address() == self.lifecycle.require_active().structures, "only structures domain");
            let interval = self.games().rules(key.game_id).tick_config.bitcoin_phase_in_seconds;
            self.bitcoin.capture_mine(key, timestamp / interval + 1);
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
        ) {
            self.assert_bitcoin_phase_closed(game_id, command.phase, context.timestamp);
            let phase = self.bitcoin.phase(crate::bitcoin::PhaseKey { game_id, phase: command.phase });
            assert!(phase.state != crate::bitcoin::PhaseStatus::Open, "Bitcoin pool is not closed");
            if phase.total_labor != 0 {
                assert!(phase.state == crate::bitcoin::PhaseStatus::Bound, "Bitcoin phase root is not bound");
            }
            assert!(!command.mine_ids.is_empty(), "empty Bitcoin claim batch");
            crate::commands::assert_unique_entity_ids(command.mine_ids);
            for mine_id in command.mine_ids {
                self
                    .claim_bitcoin_mine(
                        crate::bitcoin::ClaimKey { game_id, phase: command.phase, mine_id: *mine_id },
                        phase,
                        context.timestamp,
                    );
            }
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
            self.bitcoin.contribute(crate::bitcoin::ContributionKey { game_id, phase, player: actor }, command.amount);
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
        ) {
            self.require_ended(self.authorize(game_id, context.timestamp), context.timestamp);
            let mut pool = self.faith_prize_pool(game_id);
            assert!(!pool.distributed, "faith prizes already distributed");
            if !self.faith.settle_faith_wonders(game_id, context.timestamp) {
                return;
            }
            pool.distributed = true;
            self.write_pool(game_id, pool);
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
                    let owner_share = owner_share + funding.owner_carry;
                    let origin = crate::structures::structure_coord(mine.base);
                    let (winner_destination, winner_paid) = self
                        .pay_bitcoin_share(key.game_id, winner, origin, winner_share, timestamp);
                    let (owner_destination, owner_paid) = self
                        .pay_bitcoin_share(key.game_id, mine.owner, origin, owner_share, timestamp);
                    funding.unsplit_carry = 0;
                    funding.winner_carry = winner_share - winner_paid;
                    funding.owner_carry = owner_share - owner_paid;
                    self
                        .emit(
                            crate::ownership::StoryEvent {
                                version: 1,
                                game_id: key.game_id,
                                id: self.games().allocate_entity(key.game_id),
                                owner: Some(winner),
                                entity_id: Some(key.mine_id),
                                tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                                timestamp,
                                story: crate::ownership::Story::BitcoinAwardStory(
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
                                ),
                            },
                        );
                }
            }
            self.bitcoin.complete_claim(key, funding);
        }
        fn bitcoin_destination(
            self: @ContractState, game_id: u32, player: ContractAddress, origin: crate::troops::Coord,
        ) -> u32 {
            let structures = IStructuresDispatcher { contract_address: self.lifecycle.require_active().structures };
            let mut nearest = 0_u32;
            let mut shortest = 0xffffffffffffffffffffffffffffffff_u128;
            for index in 0..self.bitcoin.settlement_count.read(game_id) {
                let id = self.bitcoin.settlement_ids.read((game_id, index));
                let key = ResourceKey { game_id, entity_id: id };
                if structures.structure_owner(key) != player {
                    continue;
                }
                let settlement = structures.structure(key).expect('missing indexed settlement');
                let distance = crate::geometry::distance(origin, crate::structures::structure_coord(settlement.base));
                if distance < shortest || (distance == shortest && (nearest == 0 || id < nearest)) {
                    nearest = id;
                    shortest = distance;
                }
            }
            nearest
        }
        fn pay_bitcoin_share(
            ref self: ContractState,
            game_id: u32,
            player: ContractAddress,
            origin: crate::troops::Coord,
            amount: u128,
            timestamp: u64,
        ) -> (u32, u128) {
            if amount == 0 {
                return (0, 0);
            }
            let destination = self.bitcoin_destination(game_id, player, origin);
            if destination == 0 {
                return (0, 0);
            }
            let rule = self.resources().resource_rule(game_id, 58);
            assert!(rule.unit_weight == 0, "SAT must be weightless");
            let paid = self
                .resources()
                .grant_resource(ResourceKey { game_id, entity_id: destination }, 58, amount, timestamp);
            assert!(paid == amount, "incomplete Bitcoin award");
            (destination, paid)
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
