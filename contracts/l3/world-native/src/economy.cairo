#[starknet::contract]
pub mod EconomyDomain {
    use starknet::storage::StorageMapReadAccess;
    use starknet::{ContractAddress, get_caller_address};
    use crate::commands::ExecutionContext;
    use crate::game::{IGameDispatcher, IGameDispatcherTrait, assert_main_with_grace, assert_playing};
    use crate::lifecycle::Lifecycle;
    use crate::ownership::{Story, StoryEvent};
    use crate::resources::{IResourcesDispatcher, IResourcesDispatcherTrait, ResourceAmount, ResourceKey};
    use crate::structures::{IStructuresDispatcher, IStructuresDispatcherTrait, Structure, structure_coord};
    use crate::trade::{
        AcceptOrder, CreateOrder, IEconomyDeliveryDispatcher, IEconomyDeliveryDispatcherTrait, TradeFill, TradeKey,
        TradeOrder, TradeRules, TradeState,
    };
    component!(path: Lifecycle, storage: lifecycle, event: LifecycleEvent);
    component!(path: TradeState, storage: trades, event: TradeEvent);
    #[abi(embed_v0)]
    impl Domain = Lifecycle::DomainImpl<ContractState>;
    impl LifecycleInternal = Lifecycle::InternalImpl<ContractState>;
    impl TradeInternal = TradeState::InternalImpl<ContractState>;
    #[storage]
    struct Storage {
        #[substorage(v0)]
        lifecycle: Lifecycle::Storage,
        #[substorage(v0)]
        trades: TradeState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        LifecycleEvent: Lifecycle::Event,
        TradeEvent: TradeState::Event,
        StoryEvent: StoryEvent,
    }
    #[constructor]
    fn constructor(ref self: ContractState, authority: ContractAddress) {
        self.lifecycle.initialize(authority);
    }
    #[abi(embed_v0)]
    impl Trade of crate::trade::ITrade<ContractState> {
        fn configure_trade(ref self: ContractState, game_id: u32, rules: TradeRules) {
            self.lifecycle.assert_authority();
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
            self.assert_command(game_id, context.timestamp, false);
            self.validate_offer(game_id, actor, command, context.timestamp);
            let order = crate::trade::new_order(command);
            self.reserve_offer(game_id, order, context.timestamp);
            let trade_id = self.games().allocate_entity(game_id);
            self.trades.create(TradeKey { game_id, trade_id }, order);
            self
                .emit_story(
                    game_id,
                    trade_id,
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
            self.assert_command(game_id, context.timestamp, false);
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
            let event_id = self.games().allocate_entity(game_id);
            self.emit_story(game_id, event_id, command.taker_id, actor, Story::TradeAccepted(fill), context.timestamp);
        }

        fn cancel_trade_order(
            ref self: ContractState, game_id: u32, actor: ContractAddress, trade_id: u32, context: ExecutionContext,
        ) {
            self.assert_command(game_id, context.timestamp, true);
            let key = TradeKey { game_id, trade_id };
            let order = self.trades.order(key).expect('trade does not exist');
            self.owned_structure(game_id, order.maker_id, actor);
            self.refund_offer(game_id, order, context.timestamp);
            self.trades.remove(key, order);
            self
                .emit_story(
                    game_id, trade_id, order.maker_id, actor, Story::TradeCancelled(trade_id), context.timestamp,
                );
        }
    }
    #[generate_trait]
    impl Internal of InternalTrait {
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
        fn assert_command(self: @ContractState, game_id: u32, timestamp: u64, grace: bool) {
            assert!(
                get_caller_address() == self.lifecycle.require_active().season, "only authenticated command domain",
            );
            crate::commands::assert_context_time(timestamp);
            let games = self.games();
            assert!(!games.rules(game_id).blitz_mode_on, "trading requires Eternum mode");
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
            ref self: ContractState,
            game_id: u32,
            id: u32,
            entity_id: u32,
            actor: ContractAddress,
            story: Story,
            timestamp: u64,
        ) {
            self
                .emit(
                    StoryEvent {
                        version: 1,
                        game_id,
                        id,
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
