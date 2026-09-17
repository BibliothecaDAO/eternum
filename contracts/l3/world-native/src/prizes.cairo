#[starknet::contract]
pub mod PrizesDomain {
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use crate::blitz_prizes::BlitzPrizeState;
    use crate::commands::ExecutionContext;
    use crate::events::RowSet;
    use crate::faith::{
        ClaimPlayer, IFaithOwnershipViewsDispatcher, IFaithOwnershipViewsDispatcherTrait, IFaithSettlementDispatcher,
        IFaithSettlementDispatcherTrait, PlayerFaithKey,
    };
    use crate::faith_prizes::{IPrizeTokenDispatcher, IPrizeTokenDispatcherTrait, PrizePool};
    use crate::game::{GameRegistry, IGameDispatcher, IGameDispatcherTrait};
    use crate::lifecycle::Lifecycle;
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
        reward_tokens: Map<u32, Option<ContractAddress>>,
        faith_pools: Map<u32, PrizePool>,
        faith_claims: Map<(u32, ContractAddress, u32), bool>,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        LifecycleEvent: Lifecycle::Event,
        BlitzEvent: BlitzPrizeState::Event,
        RowSet: RowSet,
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
            if !self.settlement().settle_faith_wonders(game_id, context.timestamp) {
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
            self.settlement().settle_player_faith(game_id, command.player, command.wonder_id, context.timestamp);
            let points = self.faith().player_faith_points(key).points_claimed;
            if points == 0 {
                return;
            }
            let total = self
                .faith()
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
        fn games(self: @ContractState) -> IGameDispatcher {
            IGameDispatcher { contract_address: self.lifecycle.require_active().season }
        }
        fn faith(self: @ContractState) -> IFaithOwnershipViewsDispatcher {
            IFaithOwnershipViewsDispatcher { contract_address: self.lifecycle.require_active().structures }
        }
        fn settlement(self: @ContractState) -> IFaithSettlementDispatcher {
            IFaithSettlementDispatcher { contract_address: self.lifecycle.require_active().structures }
        }
        fn token(self: @ContractState, game_id: u32) -> IPrizeTokenDispatcher {
            IPrizeTokenDispatcher { contract_address: self.faith_reward_token(game_id) }
        }
        fn authorize(self: @ContractState, game_id: u32, timestamp: u64) -> GameRegistry {
            assert!(
                get_caller_address() == self.lifecycle.require_active().season, "only authenticated command domain",
            );
            crate::commands::assert_context_time(timestamp);
            assert!(!self.games().rules(game_id).blitz_mode_on, "faith requires Eternum");
            self.games().game(game_id)
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
            let winners = self.settlement().faith_winner_count(game_id, wonder_id);
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
