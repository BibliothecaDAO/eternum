#[starknet::contract]
pub mod EconomyDomain {
    use starknet::storage::StorageMapReadAccess;
    use starknet::{ContractAddress, get_caller_address};
    use crate::bridge::IBankWithdrawalDispatcherTrait;
    use crate::commands::ExecutionContext;
    use crate::game::{IGameDispatcher, IGameDispatcherTrait, assert_main_with_grace, assert_playing};
    use crate::relics::RelicState;
    component!(path: RelicState, storage: relics, event: RelicEvent);
    #[abi(embed_v0)]
    impl Relics = RelicState::RelicsImpl<ContractState>;
    #[abi(embed_v0)]
    impl Artificer = RelicState::ArtificerImpl<ContractState>;
    use crate::hyperstructures::HyperstructureState;
    use crate::lifecycle::Lifecycle;
    use crate::market::{
        AddLiquidity, BankPlacement, BankRules, IBankCreationDispatcher, IBankCreationDispatcherTrait, LiquidityKey,
        Market, MarketKey, MarketState, RemoveLiquidity, Swap,
    };
    use crate::ownership::{Story, StoryEvent};
    use crate::resources::{IResourcesDispatcher, IResourcesDispatcherTrait, ResourceAmount, ResourceKey};
    use crate::structures::{IStructuresDispatcher, IStructuresDispatcherTrait, Structure, structure_coord};
    use crate::trade::{
        AcceptOrder, CreateOrder, IEconomyDeliveryDispatcher, IEconomyDeliveryDispatcherTrait, TradeFill, TradeKey,
        TradeOrder, TradeRules, TradeState,
    };
    component!(path: HyperstructureState, storage: hyperstructures, event: HyperstructureEvent);
    #[abi(embed_v0)]
    impl Hyperstructures = HyperstructureState::HyperstructuresImpl<ContractState>;
    component!(path: MarketState, storage: markets, event: MarketEvent);
    component!(path: Lifecycle, storage: lifecycle, event: LifecycleEvent);
    component!(path: TradeState, storage: trades, event: TradeEvent);
    #[abi(embed_v0)]
    impl Domain = Lifecycle::DomainImpl<ContractState>;
    impl LifecycleInternal = Lifecycle::InternalImpl<ContractState>;
    impl MarketInternal = MarketState::InternalImpl<ContractState>;
    impl TradeInternal = TradeState::InternalImpl<ContractState>;
    #[storage]
    struct Storage {
        #[substorage(v0)]
        relics: RelicState::Storage,
        #[substorage(v0)]
        hyperstructures: HyperstructureState::Storage,
        #[substorage(v0)]
        lifecycle: Lifecycle::Storage,
        #[substorage(v0)]
        trades: TradeState::Storage,
        #[substorage(v0)]
        markets: MarketState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        RelicEvent: RelicState::Event,
        HyperstructureEvent: HyperstructureState::Event,
        LifecycleEvent: Lifecycle::Event,
        TradeEvent: TradeState::Event,
        MarketEvent: MarketState::Event,
        StoryEvent: StoryEvent,
    }
    #[constructor]
    fn constructor(ref self: ContractState, authority: ContractAddress) {
        self.lifecycle.initialize(authority);
    }
    #[abi(embed_v0)]
    impl Trade of crate::trade::ITrade<ContractState> {
        fn configure_trade(ref self: ContractState, game_id: u32, rules: TradeRules) {
            self.lifecycle.assert_configurator();
            let _ = self.games().game(game_id);
            self.trades.configure(game_id, rules);
        }
        fn trade_rules(self: @ContractState, game_id: u32) -> TradeRules {
            self.trades.rules(game_id)
        }
        fn trade_order(self: @ContractState, key: TradeKey) -> Option<TradeOrder> {
            self.trades.order(key)
        }
        fn create_trade_order(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: CreateOrder,
            context: ExecutionContext,
        ) {
            self.assert_command(game_id, context.timestamp, false, crate::rules::TRADE);
            self.validate_offer(game_id, actor, command, context.timestamp);
            let order = crate::trade::new_order(command);
            self.reserve_offer(game_id, order, context.timestamp);
            let trade_id = self.games().allocate_entity(game_id);
            self.trades.create(TradeKey { game_id, trade_id }, order);
            self
                .emit_story(
                    game_id,
                    order.maker_id,
                    actor,
                    Story::TradeCreated(crate::trade::TradeListing { trade_id, order }),
                    context.timestamp,
                );
        }

        fn accept_trade_order(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: AcceptOrder,
            context: ExecutionContext,
        ) {
            self.assert_command(game_id, context.timestamp, false, crate::rules::TRADE);
            let key = TradeKey { game_id, trade_id: command.trade_id };
            let order = self.trades.order(key).expect('trade does not exist');
            let taker = self.owned_structure(game_id, command.taker_id, actor);
            let maker = self.structure(game_id, order.maker_id);
            assert!(context.timestamp < order.expires_at.into(), "trade expired");
            assert!(order.taker_id == 0 || order.taker_id == command.taker_id, "not the taker");
            assert!(command.lots != 0 && command.lots <= order.remaining_lots, "invalid purchase count");
            assert!(!maker.base.alt && !taker.base.alt, "transportation only allowed on surface");
            let fill = self.settle_fill(game_id, order, command, maker, taker, context.timestamp);
            self.trades.fill(key, order, command.lots);
            self.emit_story(game_id, command.taker_id, actor, Story::TradeAccepted(fill), context.timestamp);
        }

        fn cancel_trade_order(
            ref self: ContractState, game_id: u32, actor: ContractAddress, trade_id: u32, context: ExecutionContext,
        ) {
            self.assert_command(game_id, context.timestamp, true, crate::rules::TRADE);
            let key = TradeKey { game_id, trade_id };
            let order = self.trades.order(key).expect('trade does not exist');
            self.owned_structure(game_id, order.maker_id, actor);
            self.refund_offer(game_id, order, context.timestamp);
            self.trades.remove(key, order);
            self.emit_story(game_id, order.maker_id, actor, Story::TradeCancelled(trade_id), context.timestamp);
        }
    }
    #[abi(embed_v0)]
    impl Bank of crate::market::IBank<ContractState> {
        fn configure_banks(ref self: ContractState, game_id: u32, rules: BankRules) {
            self.lifecycle.assert_configurator();
            let _ = self.games().game(game_id);
            self.markets.configure(game_id, rules);
        }
        fn bank_rules(self: @ContractState, game_id: u32) -> BankRules {
            self.markets.rules(game_id)
        }
        fn bank_name(self: @ContractState, key: ResourceKey) -> felt252 {
            self.markets.bank_names.read((key.game_id, key.entity_id))
        }
        fn market(self: @ContractState, key: MarketKey) -> Market {
            self.markets.market(key)
        }
        fn liquidity(self: @ContractState, key: LiquidityKey) -> u128 {
            self.markets.shares(key)
        }
        fn create_banks(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            banks: Span<BankPlacement>,
            context: ExecutionContext,
        ) {
            self.assert_economy_submission(game_id, context.timestamp, crate::rules::BANKS);
            assert!(actor == self.lifecycle.domain_state().authority, "only domain authority");
            assert!(banks.len() == 6, "six regional banks required");
            for index in 0..6_u32 {
                let bank = *banks.at(index);
                let key = ResourceKey { game_id, entity_id: 0xfffffffe - index };
                IBankCreationDispatcher { contract_address: self.lifecycle.require_active().structures }
                    .create_bank(key, actor, bank.coord, context.timestamp);
                self.markets.name_bank(key, bank.name);
            }
        }
        fn buy_from_bank(
            ref self: ContractState, game_id: u32, actor: ContractAddress, command: Swap, context: ExecutionContext,
        ) {
            self.execute_swap(game_id, actor, command, context, true);
        }
        fn sell_to_bank(
            ref self: ContractState, game_id: u32, actor: ContractAddress, command: Swap, context: ExecutionContext,
        ) {
            self.execute_swap(game_id, actor, command, context, false);
        }
        fn add_bank_liquidity(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: AddLiquidity,
            context: ExecutionContext,
        ) {
            self.assert_economy_submission(game_id, context.timestamp, crate::rules::BANKS);
            if actor != self.lifecycle.domain_state().authority {
                assert_playing(self.games().game(game_id), context.timestamp);
            }
            let player = self.owned_structure(game_id, command.structure_id, actor);
            self.bank_structure(game_id, command.bank_id);
            self.assert_liquidity_resource(player, command.resource_type);
            let key = MarketKey { game_id, resource_type: command.resource_type };
            let mut market = self.markets.market(key);
            let (lords, resource, shares) = crate::market::liquidity_cost(
                market, command.lords_amount, command.resource_amount,
            );
            let source = ResourceKey { game_id, entity_id: command.structure_id };
            self.resources().spend_resource(source, command.resource_type, resource, context.timestamp);
            self.resources().spend_resource(source, crate::resources::LORDS, lords, context.timestamp);
            market.lords += lords;
            market.resource += resource;
            market.shares += shares;
            self.markets.write_market(key, market);
            let liquidity = LiquidityKey { game_id, owner: actor, resource_type: command.resource_type };
            self.markets.write_shares(liquidity, self.markets.shares(liquidity) + shares);
            self
                .emit_liquidity(
                    game_id,
                    actor,
                    command.bank_id,
                    command.structure_id,
                    command.resource_type,
                    market,
                    lords,
                    resource,
                    shares,
                    true,
                    context.timestamp,
                );
        }
        fn remove_bank_liquidity(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: RemoveLiquidity,
            context: ExecutionContext,
        ) {
            self.assert_command(game_id, context.timestamp, true, crate::rules::BANKS);
            let bank = self.bank_structure(game_id, command.bank_id);
            assert!(command.resource_type != crate::resources::LORDS, "resource type cannot be lords");
            let key = MarketKey { game_id, resource_type: command.resource_type };
            let mut market = self.markets.market(key);
            let (lords, resource) = crate::market::liquidity_payout(market, command.shares);
            let liquidity = LiquidityKey { game_id, owner: actor, resource_type: command.resource_type };
            let owned = self.markets.shares(liquidity);
            assert!(owned >= command.shares, "insufficient player liquidity");
            market.lords -= lords;
            market.resource -= resource;
            market.shares -= command.shares;
            self.markets.write_market(key, market);
            self.markets.write_shares(liquidity, owned - command.shares);
            if command.structure_id == 0 {
                crate::bridge::IBankWithdrawalDispatcher { contract_address: self.lifecycle.require_active().bridge }
                    .withdraw_bank_resources(
                        game_id, actor, command.bank_id, command.resource_type, resource, context.timestamp,
                    );
                crate::bridge::IBankWithdrawalDispatcher { contract_address: self.lifecycle.require_active().bridge }
                    .withdraw_bank_resources(
                        game_id, actor, command.bank_id, crate::resources::LORDS, lords, context.timestamp,
                    );
            } else {
                let player = self.owned_structure(game_id, command.structure_id, actor);
                self.assert_liquidity_resource(player, command.resource_type);
                self
                    .pickup_bank_resources(
                        game_id,
                        command.bank_id,
                        command.structure_id,
                        bank,
                        player,
                        array![
                            ResourceAmount { resource_type: crate::resources::LORDS, amount: lords },
                            ResourceAmount { resource_type: command.resource_type, amount: resource },
                        ]
                            .span(),
                        context.timestamp,
                    );
            }
            self
                .emit_liquidity(
                    game_id,
                    actor,
                    command.bank_id,
                    command.structure_id,
                    command.resource_type,
                    market,
                    lords,
                    resource,
                    command.shares,
                    false,
                    context.timestamp,
                );
        }
    }
    #[generate_trait]
    impl Internal of InternalTrait {
        fn execute_swap(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: Swap,
            context: ExecutionContext,
            buy: bool,
        ) {
            self.assert_command(game_id, context.timestamp, false, crate::rules::BANKS);
            let player = self.owned_structure(game_id, command.structure_id, actor);
            let bank = self.bank_structure(game_id, command.bank_id);
            let key = MarketKey { game_id, resource_type: command.resource_type };
            let quote = crate::market::quote_swap(
                self.markets.market(key), self.markets.rules(game_id), command.amount, buy,
            );
            let input_resource = if buy {
                crate::resources::LORDS
            } else {
                command.resource_type
            };
            let output_resource = if buy {
                command.resource_type
            } else {
                crate::resources::LORDS
            };
            self
                .resources()
                .spend_resource(
                    ResourceKey { game_id, entity_id: command.structure_id },
                    input_resource,
                    quote.input,
                    context.timestamp,
                );
            self
                .resources()
                .grant_resource(
                    ResourceKey { game_id, entity_id: command.bank_id },
                    crate::resources::LORDS,
                    quote.owner_fee,
                    context.timestamp,
                );
            self.markets.write_market(key, quote.market);
            self
                .pickup_bank_resources(
                    game_id,
                    command.bank_id,
                    command.structure_id,
                    bank,
                    player,
                    array![ResourceAmount { resource_type: output_resource, amount: quote.output }].span(),
                    context.timestamp,
                );
            let lords = if buy {
                quote.input - quote.owner_fee
            } else {
                quote.output
            };
            self
                .emit_swap(
                    game_id, actor, command, quote.market, lords, quote.owner_fee, quote.lp_fee, buy, context.timestamp,
                );
        }
        fn assert_economy_submission(self: @ContractState, game_id: u32, timestamp: u64, rule: u32) {
            assert!(
                get_caller_address() == self.lifecycle.require_active().season, "only authenticated command domain",
            );
            crate::commands::assert_context_time(timestamp);
            assert!(crate::rules::rule_enabled(self.games().rules(game_id), rule), "economy operation is disabled");
        }
        fn bank_structure(self: @ContractState, game_id: u32, bank_id: u32) -> Structure {
            let bank = self.structure(game_id, bank_id);
            assert!(bank.base.category == 3, "structure is not a bank");
            bank
        }
        fn assert_liquidity_resource(self: @ContractState, player: Structure, resource_type: u8) {
            assert!(resource_type != crate::resources::LORDS, "resource type cannot be lords");
            assert!(
                player.base.category != 5 || !crate::resources::is_troop_resource(resource_type),
                "villages cannot use troop liquidity",
            );
        }
        fn pickup_bank_resources(
            ref self: ContractState,
            game_id: u32,
            bank_id: u32,
            structure_id: u32,
            bank: Structure,
            player: Structure,
            resources: Span<ResourceAmount>,
            timestamp: u64,
        ) {
            let rules = self.games().rules(game_id);
            let travel_time = crate::transport::travel_time(
                structure_coord(bank.base), structure_coord(player.base), resources, rules.speed_config, true,
            );
            let mut weight = 0;
            for resource in resources {
                weight += *resource.amount
                    * self.resources().resource_rule(game_id, *resource.resource_type).unit_weight;
            }
            let key = ResourceKey { game_id, entity_id: structure_id };
            self
                .resources()
                .spend_resource(
                    key,
                    crate::transport::DONKEY,
                    crate::transport::donkeys_needed(weight, rules.capacity_config.donkey_capacity.into()),
                    timestamp,
                );
            let delivery = IEconomyDeliveryDispatcher { contract_address: self.lifecycle.require_active().resources };
            for resource in resources {
                delivery.queue_economy_delivery(key, *resource, travel_time, timestamp);
            }
            let story = Story::ResourceTransferStory(
                crate::ownership::ResourceTransferStory {
                    transfer_type: crate::ownership::TransferType::Delayed,
                    from_entity_id: bank_id,
                    from_entity_owner_address: bank.owner,
                    to_entity_id: structure_id,
                    to_entity_owner_address: player.owner,
                    resources,
                    is_mint: true,
                    travel_time,
                },
            );
            self.emit_story(game_id, bank_id, bank.owner, story, timestamp);
            self.emit_story(game_id, structure_id, player.owner, story, timestamp);
        }
        fn emit_swap(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: Swap,
            market: Market,
            lords: u128,
            owner_fee: u128,
            lp_fee: u128,
            buy: bool,
            timestamp: u64,
        ) {
            // Preserve the pinned quote validation even though history uses the reserve ratio.
            crate::market::output_price(market.lords, market.resource, crate::rules::RESOURCE_PRECISION, 0, 1);
            self
                .emit_story(
                    game_id,
                    command.structure_id,
                    actor,
                    Story::BankSwap(
                        crate::market::SwapStory {
                            bank_id: command.bank_id,
                            structure_id: command.structure_id,
                            resource_type: command.resource_type,
                            lords_amount: lords,
                            resource_amount: command.amount,
                            owner_fee,
                            lp_fee,
                            resource_price: crate::market::resource_price(market),
                            buy,
                        },
                    ),
                    timestamp,
                );
        }
        fn emit_liquidity(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            bank_id: u32,
            structure_id: u32,
            resource_type: u8,
            market: Market,
            lords: u128,
            resource: u128,
            shares: u128,
            add: bool,
            timestamp: u64,
        ) {
            self
                .emit_story(
                    game_id,
                    structure_id,
                    actor,
                    Story::BankLiquidity(
                        crate::market::LiquidityStory {
                            bank_id,
                            structure_id,
                            resource_type,
                            lords_amount: lords,
                            resource_amount: resource,
                            shares,
                            resource_price: crate::market::resource_price(market),
                            add,
                        },
                    ),
                    timestamp,
                );
        }
        fn reserve_offer(self: @ContractState, game_id: u32, order: TradeOrder, timestamp: u64) {
            let key = ResourceKey { game_id, entity_id: order.maker_id };
            let resources = self.resources();
            let offered: u128 = order.offered_per_lot.into() * order.remaining_lots.into();
            let requested: u128 = order.requested_per_lot.into() * order.remaining_lots.into();
            resources.spend_resource(key, order.offered_resource, offered, timestamp);
            resources
                .spend_resource(
                    key,
                    crate::transport::DONKEY,
                    self.shipping_donkeys(game_id, order.requested_resource, requested),
                    timestamp,
                );
        }
        fn refund_offer(self: @ContractState, game_id: u32, order: TradeOrder, timestamp: u64) {
            let key = ResourceKey { game_id, entity_id: order.maker_id };
            let resources = self.resources();
            let offered: u128 = order.offered_per_lot.into() * order.remaining_lots.into();
            let requested: u128 = order.requested_per_lot.into() * order.remaining_lots.into();
            resources.grant_resource(key, order.offered_resource, offered, timestamp);
            resources
                .grant_resource(
                    key,
                    crate::transport::DONKEY,
                    self.shipping_donkeys(game_id, order.requested_resource, requested),
                    timestamp,
                );
        }
        fn settle_fill(
            self: @ContractState,
            game_id: u32,
            order: TradeOrder,
            command: AcceptOrder,
            maker: Structure,
            taker: Structure,
            timestamp: u64,
        ) -> TradeFill {
            let offered: u128 = order.offered_per_lot.into() * command.lots.into();
            let requested: u128 = order.requested_per_lot.into() * command.lots.into();
            let taker_key = ResourceKey { game_id, entity_id: command.taker_id };
            let resources = self.resources();
            resources
                .spend_resource(
                    taker_key,
                    crate::transport::DONKEY,
                    self.shipping_donkeys(game_id, order.offered_resource, offered),
                    timestamp,
                );
            resources.spend_resource(taker_key, order.requested_resource, requested, timestamp);
            self
                .deliver(
                    game_id,
                    order.maker_id,
                    taker,
                    maker,
                    ResourceAmount { resource_type: order.requested_resource, amount: requested },
                    timestamp,
                );
            self
                .deliver(
                    game_id,
                    command.taker_id,
                    maker,
                    taker,
                    ResourceAmount { resource_type: order.offered_resource, amount: offered },
                    timestamp,
                );
            TradeFill {
                trade_id: command.trade_id,
                maker_id: order.maker_id,
                taker_id: command.taker_id,
                offered_resource: order.offered_resource,
                requested_resource: order.requested_resource,
                offered_amount: offered,
                requested_amount: requested,
            }
        }
        fn games(self: @ContractState) -> IGameDispatcher {
            IGameDispatcher { contract_address: self.lifecycle.require_active().season }
        }
        fn resources(self: @ContractState) -> IResourcesDispatcher {
            IResourcesDispatcher { contract_address: self.lifecycle.require_active().resources }
        }
        fn structure(self: @ContractState, game_id: u32, entity_id: u32) -> Structure {
            IStructuresDispatcher { contract_address: self.lifecycle.require_active().structures }
                .structure(ResourceKey { game_id, entity_id })
                .expect('missing trade structure')
        }
        fn owned_structure(self: @ContractState, game_id: u32, entity_id: u32, actor: ContractAddress) -> Structure {
            let structure = self.structure(game_id, entity_id);
            assert!(structure.owner == actor && actor != 0.try_into().unwrap(), "actor does not own trade structure");
            structure
        }
        fn assert_command(self: @ContractState, game_id: u32, timestamp: u64, grace: bool, rule: u32) {
            self.assert_economy_submission(game_id, timestamp, rule);
            let games = self.games();
            if grace {
                assert_main_with_grace(games.game(game_id), timestamp);
            } else {
                assert_playing(games.game(game_id), timestamp);
            }
        }
        fn validate_offer(
            self: @ContractState, game_id: u32, actor: ContractAddress, command: CreateOrder, timestamp: u64,
        ) {
            let maker = self.owned_structure(game_id, command.maker_id, actor);
            assert!(!maker.base.alt, "transportation only allowed on surface");
            if command.taker_id != 0 {
                assert!(!self.structure(game_id, command.taker_id).base.alt, "transportation only allowed on surface");
            }
            assert!(command.offered_resource != command.requested_resource, "maker resource is taker resource");
            assert!(command.offered_resource != 57 && command.requested_resource != 57, "research is not tradable");
            assert!(
                command.offered_per_lot != 0 && command.requested_per_lot != 0 && command.lots != 0,
                "zero trade amount",
            );
            assert!(command.expires_at.into() > timestamp, "expires at is in the past");
            assert!(
                self.trades.open_count.read((game_id, command.maker_id)) < self.trades.rules(game_id).max_count,
                "trade count exceeds max",
            );
        }
        fn shipping_donkeys(self: @ContractState, game_id: u32, resource_type: u8, amount: u128) -> u128 {
            let weight = self.resources().resource_rule(game_id, resource_type).unit_weight * amount;
            crate::transport::donkeys_needed(weight, self.games().rules(game_id).capacity_config.donkey_capacity.into())
        }
        fn deliver(
            self: @ContractState,
            game_id: u32,
            destination: u32,
            from: Structure,
            to: Structure,
            resource: ResourceAmount,
            timestamp: u64,
        ) {
            let origin = structure_coord(from.base);
            let target = structure_coord(to.base);
            let travel_time = if origin == target {
                0
            } else {
                crate::transport::travel_time(
                    origin, target, array![resource].span(), self.games().rules(game_id).speed_config, true,
                )
            };
            IEconomyDeliveryDispatcher { contract_address: self.lifecycle.require_active().resources }
                .queue_economy_delivery(
                    ResourceKey { game_id, entity_id: destination }, resource, travel_time, timestamp,
                );
        }
        fn emit_story(
            ref self: ContractState, game_id: u32, entity_id: u32, actor: ContractAddress, story: Story, timestamp: u64,
        ) {
            self
                .emit(
                    StoryEvent {
                        version: 1,
                        game_id,
                        id: self.games().allocate_entity(game_id),
                        owner: Some(actor),
                        entity_id: Some(entity_id),
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story,
                        timestamp,
                    },
                );
        }
    }
}
