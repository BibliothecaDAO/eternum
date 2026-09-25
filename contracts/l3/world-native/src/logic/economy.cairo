#[starknet::contract]
pub mod EconomyLogic {
    use starknet::ContractAddress;
    use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess};
    use crate::bridge::IBankWithdrawalDispatcherTrait;
    use crate::commands::ExecutionContext;
    use crate::game::{assert_main_with_grace, assert_playing};
    use crate::logic::hyperstructures::HyperstructureState;
    use crate::logic::market::MarketState;
    use crate::logic::release::ReleaseState;
    use crate::logic::trade::TradeState;
    #[cfg(test)]
    use crate::market::BankRules;
    use crate::market::{
        AddLiquidity, BankPlacement, IBankCreationDispatcherTrait, IBankCreationLibraryDispatcher, LiquidityKey, Market,
        MarketKey, RemoveLiquidity, Swap,
    };
    use crate::ownership::{Story, StoryEvent, StoryResultTrait};
    use crate::resources::{
        IResourceOperationsDispatcherTrait, IResourceOperationsLibraryDispatcher, ResourceAmount, ResourceKey,
    };
    use crate::structures::{Structure, structure_coord};
    #[cfg(test)]
    use crate::trade::TradeRules;
    use crate::trade::{
        AcceptOrder, CreateOrder, IEconomyDeliveryDispatcherTrait, IEconomyDeliveryLibraryDispatcher, TradeFill,
        TradeKey, TradeOrder,
    };
    component!(path: HyperstructureState, storage: hyperstructures, event: HyperstructureEvent);
    #[abi(embed_v0)]
    impl Hyperstructures = HyperstructureState::HyperstructuresImpl<ContractState>;
    component!(path: MarketState, storage: markets, event: MarketEvent);
    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    component!(path: TradeState, storage: trades, event: TradeEvent);
    impl LifecycleInternal = ReleaseState::InternalImpl<ContractState>;
    impl MarketInternal = MarketState::InternalImpl<ContractState>;
    impl TradeInternal = TradeState::InternalImpl<ContractState>;
    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[substorage(v0)]
        hyperstructures: HyperstructureState::Storage,
        #[substorage(v0)]
        release: ReleaseState::Storage,
        #[substorage(v0)]
        trades: TradeState::Storage,
        #[substorage(v0)]
        markets: MarketState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        HyperstructureEvent: HyperstructureState::Event,
        ReleaseEvent: ReleaseState::Event,
        TradeEvent: TradeState::Event,
        MarketEvent: MarketState::Event,
        StoryEvent: StoryEvent,
    }
    #[abi(embed_v0)]
    impl Trade of crate::trade::ITrade<ContractState> {
        #[cfg(test)]
        fn trade_rules(self: @ContractState, game_id: u32) -> TradeRules {
            self.trades.rules(game_id)
        }
        #[cfg(test)]
        fn trade_order(self: @ContractState, key: TradeKey) -> Option<TradeOrder> {
            self.trades.order(key)
        }
        fn create_trade_order(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: CreateOrder,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            self.assert_command(game_id, context.timestamp, false, context);
            self.validate_offer(game_id, actor, command, context.timestamp);
            let order = crate::trade::new_order(command);
            self.reserve_offer(game_id, order, context.timestamp, context);
            let trade_id = crate::logic::game::allocate_entity(game_id);
            self.trades.create(TradeKey { game_id, trade_id }, order);
            self
                .emit_story(
                    game_id,
                    order.maker_id,
                    actor,
                    Story::TradeCreated(crate::trade::TradeListing { trade_id, order }),
                    context.timestamp,
                    ref story_cursor,
                );
            ((), story_cursor)
        }

        fn accept_trade_order(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: AcceptOrder,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            self.assert_command(game_id, context.timestamp, false, context);
            let key = TradeKey { game_id, trade_id: command.trade_id };
            let order = self.trades.order(key).expect('trade does not exist');
            let taker = self.owned_structure(game_id, command.taker_id, actor);
            let maker = self.structure(game_id, order.maker_id);
            assert!(context.timestamp < order.expires_at.into(), "trade expired");
            assert!(order.taker_id == 0 || order.taker_id == command.taker_id, "not the taker");
            assert!(command.lots != 0 && command.lots <= order.remaining_lots, "invalid purchase count");
            assert!(
                !structure_coord(ResourceKey { game_id, entity_id: order.maker_id }).alt
                    && !structure_coord(ResourceKey { game_id, entity_id: command.taker_id }).alt,
                "transportation only allowed on surface",
            );
            let fill = self
                .settle_fill(game_id, order, command, maker, taker, context.timestamp, context, ref story_cursor);
            self.trades.fill(key, order, command.lots);
            self
                .emit_story(
                    game_id, command.taker_id, actor, Story::TradeAccepted(fill), context.timestamp, ref story_cursor,
                );
            ((), story_cursor)
        }

        fn cancel_trade_order(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            trade_id: u32,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            self.assert_command(game_id, context.timestamp, true, context);
            let key = TradeKey { game_id, trade_id };
            let order = self.trades.order(key).expect('trade does not exist');
            self.owned_structure(game_id, order.maker_id, actor);
            self.refund_offer(game_id, order, context.timestamp, context);
            self.trades.remove(key, order);
            self
                .emit_story(
                    game_id,
                    order.maker_id,
                    actor,
                    Story::TradeCancelled(trade_id),
                    context.timestamp,
                    ref story_cursor,
                );
            ((), story_cursor)
        }
    }
    #[abi(embed_v0)]
    impl Bank of crate::market::IBank<ContractState> {
        #[cfg(test)]
        fn bank_rules(self: @ContractState, game_id: u32) -> BankRules {
            self.markets.rules(game_id)
        }
        #[cfg(test)]
        fn bank_name(self: @ContractState, key: ResourceKey) -> felt252 {
            self.markets.data.market.bank_names.read((key.game_id, key.entity_id))
        }
        fn market(self: @ContractState, key: MarketKey) -> Market {
            self.markets.market(key)
        }
        #[cfg(test)]
        fn liquidity(self: @ContractState, key: LiquidityKey) -> u128 {
            self.markets.shares(key)
        }
        fn create_banks(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            banks: Span<BankPlacement>,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) {
            let context = crate::commands::load_context(game_id, context);

            assert!(actor == context.game.unbox().creator, "only game creator");
            assert!(banks.len() == 6, "six regional banks required");
            for index in 0..6_u32 {
                let bank = *banks.at(index);
                let key = ResourceKey { game_id, entity_id: 0xfffffffe - index };
                IBankCreationLibraryDispatcher { class_hash: self.release.classes(game_id).structures.read() }
                    .create_bank(key, actor, bank.coord, context.timestamp, crate::commands::action_context(context));
                self.markets.name_bank(key, bank.name);
            }
        }
        fn buy_from_bank(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: Swap,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            self.execute_swap(game_id, actor, command, context, true, ref story_cursor);
            ((), story_cursor)
        }
        fn sell_to_bank(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: Swap,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            self.execute_swap(game_id, actor, command, context, false, ref story_cursor);
            ((), story_cursor)
        }
        fn add_bank_liquidity(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: AddLiquidity,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            if actor != context.game.unbox().creator {
                assert_playing(context.game.unbox(), context.timestamp);
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
            self
                .resources(game_id)
                .spend_resource(
                    source,
                    command.resource_type,
                    resource,
                    context.timestamp,
                    crate::commands::resource_context(context),
                );
            self
                .resources(game_id)
                .spend_resource(
                    source,
                    crate::resources::LORDS,
                    lords,
                    context.timestamp,
                    crate::commands::resource_context(context),
                );
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
                    ref story_cursor,
                );
            ((), story_cursor)
        }
        fn remove_bank_liquidity(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: RemoveLiquidity,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            self.assert_command(game_id, context.timestamp, true, context);
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
                crate::bridge::IBankWithdrawalLibraryDispatcher {
                    class_hash: self.release.classes(game_id).bridge.read(),
                }
                    .withdraw_bank_resources(
                        game_id,
                        actor,
                        command.bank_id,
                        command.resource_type,
                        resource,
                        context.timestamp,
                        crate::commands::action_context(context),
                        story_cursor,
                    )
                    .resume_story(ref story_cursor);
                crate::bridge::IBankWithdrawalLibraryDispatcher {
                    class_hash: self.release.classes(game_id).bridge.read(),
                }
                    .withdraw_bank_resources(
                        game_id,
                        actor,
                        command.bank_id,
                        crate::resources::LORDS,
                        lords,
                        context.timestamp,
                        crate::commands::action_context(context),
                        story_cursor,
                    )
                    .resume_story(ref story_cursor);
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
                        context,
                        ref story_cursor,
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
                    ref story_cursor,
                );
            ((), story_cursor)
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
            ref story_cursor: crate::ownership::StoryCursor,
        ) {
            self.assert_command(game_id, context.timestamp, false, context);
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
                .resources(game_id)
                .spend_resource(
                    ResourceKey { game_id, entity_id: command.structure_id },
                    input_resource,
                    quote.input,
                    context.timestamp,
                    crate::commands::resource_context(context),
                );
            self
                .resources(game_id)
                .grant_resource(
                    ResourceKey { game_id, entity_id: command.bank_id },
                    crate::resources::LORDS,
                    quote.owner_fee,
                    context.timestamp,
                    crate::commands::resource_context(context),
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
                    context,
                    ref story_cursor,
                );
            let lords = if buy {
                quote.input - quote.owner_fee
            } else {
                quote.output
            };
            self
                .emit_swap(
                    game_id,
                    actor,
                    command,
                    quote.market,
                    lords,
                    quote.owner_fee,
                    quote.lp_fee,
                    buy,
                    context.timestamp,
                    ref story_cursor,
                );
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
            game_context: crate::commands::ExecutionContext,
            ref story_cursor: crate::ownership::StoryCursor,
        ) {
            let rules = game_context.rules.unbox();
            let travel_time = crate::transport::travel_time(
                structure_coord(ResourceKey { game_id, entity_id: bank_id }),
                structure_coord(ResourceKey { game_id, entity_id: structure_id }),
                resources,
                rules.speed_config,
                true,
            );
            let mut weight = 0;
            for resource in resources {
                weight += *resource.amount
                    * crate::logic::resources::rule(game_id, *resource.resource_type).unit_weight;
            }
            let key = ResourceKey { game_id, entity_id: structure_id };
            self
                .resources(game_id)
                .spend_resource(
                    key,
                    crate::transport::DONKEY,
                    crate::transport::donkeys_needed(weight, rules.capacity_config.donkey_capacity.into()),
                    timestamp,
                    crate::commands::resource_context(game_context),
                );
            let delivery = IEconomyDeliveryLibraryDispatcher {
                class_hash: self.release.classes(game_id).resources.read(),
            };
            for resource in resources {
                delivery
                    .queue_economy_delivery(
                        key, *resource, travel_time, timestamp, crate::commands::resource_context(game_context),
                    );
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
            self.emit_story(game_id, bank_id, bank.owner, story, timestamp, ref story_cursor);
            self.emit_story(game_id, structure_id, player.owner, story, timestamp, ref story_cursor);
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
            ref story_cursor: crate::ownership::StoryCursor,
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
                    ref story_cursor,
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
            ref story_cursor: crate::ownership::StoryCursor,
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
                    ref story_cursor,
                );
        }
        fn reserve_offer(
            self: @ContractState,
            game_id: u32,
            order: TradeOrder,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) {
            let key = ResourceKey { game_id, entity_id: order.maker_id };
            let resources = self.resources(game_id);
            let offered: u128 = order.offered_per_lot.into() * order.remaining_lots.into();
            let requested: u128 = order.requested_per_lot.into() * order.remaining_lots.into();
            resources
                .spend_resource(
                    key, order.offered_resource, offered, timestamp, crate::commands::resource_context(game_context),
                );
            resources
                .spend_resource(
                    key,
                    crate::transport::DONKEY,
                    self.shipping_donkeys(game_id, order.requested_resource, requested, game_context),
                    timestamp,
                    crate::commands::resource_context(game_context),
                );
        }
        fn refund_offer(
            self: @ContractState,
            game_id: u32,
            order: TradeOrder,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) {
            let key = ResourceKey { game_id, entity_id: order.maker_id };
            let resources = self.resources(game_id);
            let offered: u128 = order.offered_per_lot.into() * order.remaining_lots.into();
            let requested: u128 = order.requested_per_lot.into() * order.remaining_lots.into();
            resources
                .grant_resource(
                    key, order.offered_resource, offered, timestamp, crate::commands::resource_context(game_context),
                );
            resources
                .grant_resource(
                    key,
                    crate::transport::DONKEY,
                    self.shipping_donkeys(game_id, order.requested_resource, requested, game_context),
                    timestamp,
                    crate::commands::resource_context(game_context),
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
            game_context: crate::commands::ExecutionContext,
            ref story_cursor: crate::ownership::StoryCursor,
        ) -> TradeFill {
            let offered: u128 = order.offered_per_lot.into() * command.lots.into();
            let requested: u128 = order.requested_per_lot.into() * command.lots.into();
            let taker_key = ResourceKey { game_id, entity_id: command.taker_id };
            let resources = self.resources(game_id);
            resources
                .spend_resource(
                    taker_key,
                    crate::transport::DONKEY,
                    self.shipping_donkeys(game_id, order.offered_resource, offered, game_context),
                    timestamp,
                    crate::commands::resource_context(game_context),
                );
            resources
                .spend_resource(
                    taker_key,
                    order.requested_resource,
                    requested,
                    timestamp,
                    crate::commands::resource_context(game_context),
                );
            self
                .deliver(
                    game_id,
                    order.maker_id,
                    command.taker_id,
                    ResourceAmount { resource_type: order.requested_resource, amount: requested },
                    timestamp,
                    game_context,
                    ref story_cursor,
                );
            self
                .deliver(
                    game_id,
                    command.taker_id,
                    order.maker_id,
                    ResourceAmount { resource_type: order.offered_resource, amount: offered },
                    timestamp,
                    game_context,
                    ref story_cursor,
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
        fn resources(self: @ContractState, game_id: u32) -> IResourceOperationsLibraryDispatcher {
            IResourceOperationsLibraryDispatcher { class_hash: self.release.classes(game_id).resources.read() }
        }
        fn structure(self: @ContractState, game_id: u32, entity_id: u32) -> Structure {
            crate::logic::structures::structure(ResourceKey { game_id, entity_id }).expect('missing trade structure')
        }
        fn owned_structure(self: @ContractState, game_id: u32, entity_id: u32, actor: ContractAddress) -> Structure {
            let structure = self.structure(game_id, entity_id);
            assert!(structure.owner == actor && actor != 0.try_into().unwrap(), "actor does not own trade structure");
            structure
        }
        fn assert_command(
            self: @ContractState,
            game_id: u32,
            timestamp: u64,
            grace: bool,
            game_context: crate::commands::ExecutionContext,
        ) {
            if grace {
                assert_main_with_grace(game_context.game.unbox(), timestamp);
            } else {
                assert_playing(game_context.game.unbox(), timestamp);
            }
        }
        fn validate_offer(
            self: @ContractState, game_id: u32, actor: ContractAddress, command: CreateOrder, timestamp: u64,
        ) {
            self.owned_structure(game_id, command.maker_id, actor);
            assert!(
                !structure_coord(ResourceKey { game_id, entity_id: command.maker_id }).alt,
                "transportation only allowed on surface",
            );
            if command.taker_id != 0 {
                assert!(
                    !structure_coord(ResourceKey { game_id, entity_id: command.taker_id }).alt,
                    "transportation only allowed on surface",
                );
            }
            assert!(command.offered_resource != command.requested_resource, "maker resource is taker resource");
            assert!(command.offered_resource != 57 && command.requested_resource != 57, "research is not tradable");
            assert!(
                command.offered_per_lot != 0 && command.requested_per_lot != 0 && command.lots != 0,
                "zero trade amount",
            );
            assert!(command.expires_at.into() > timestamp, "expires at is in the past");
            assert!(
                self
                    .trades
                    .data
                    .trade
                    .open_count
                    .read((game_id, command.maker_id)) < self
                    .trades
                    .rules(game_id)
                    .max_count,
                "trade count exceeds max",
            );
        }
        fn shipping_donkeys(
            self: @ContractState,
            game_id: u32,
            resource_type: u8,
            amount: u128,
            game_context: crate::commands::ExecutionContext,
        ) -> u128 {
            let weight = crate::logic::resources::rule(game_id, resource_type).unit_weight * amount;
            crate::transport::donkeys_needed(weight, game_context.rules.unbox().capacity_config.donkey_capacity.into())
        }
        fn deliver(
            self: @ContractState,
            game_id: u32,
            destination: u32,
            source: u32,
            resource: ResourceAmount,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
            ref story_cursor: crate::ownership::StoryCursor,
        ) {
            let origin = structure_coord(ResourceKey { game_id, entity_id: source });
            let target = structure_coord(ResourceKey { game_id, entity_id: destination });
            let travel_time = if origin == target {
                0
            } else {
                crate::transport::travel_time(
                    origin, target, array![resource].span(), game_context.rules.unbox().speed_config, true,
                )
            };
            IEconomyDeliveryLibraryDispatcher { class_hash: self.release.classes(game_id).resources.read() }
                .queue_economy_delivery(
                    ResourceKey { game_id, entity_id: destination },
                    resource,
                    travel_time,
                    timestamp,
                    crate::commands::resource_context(game_context),
                );
        }
        fn emit_story(
            ref self: ContractState,
            game_id: u32,
            entity_id: u32,
            actor: ContractAddress,
            story: Story,
            timestamp: u64,
            ref story_cursor: crate::ownership::StoryCursor,
        ) {
            self
                .emit(
                    StoryEvent {
                        version: 1,
                        game_id,
                        order: story_cursor.order,
                        index: crate::ownership::StoryCursorTrait::next(ref story_cursor),
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
