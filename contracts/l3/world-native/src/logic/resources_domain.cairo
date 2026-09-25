#[starknet::contract]
pub mod ResourcesLogic {
    use starknet::ContractAddress;
    use starknet::storage::StoragePointerReadAccess;
    use crate::arrivals::{ArrivalKey, OffloadArrival, has_arrived};
    use crate::events::RowSet;
    use crate::logic::arrivals::ArrivalState;
    use crate::logic::production::ProductionState;
    use crate::logic::release::ReleaseState;
    use crate::logic::resources::ResourceState;
    use crate::ownership::{Story, StoryEvent};
    use crate::resources::ResourceKey;
    use crate::troops::ExplorerKey;

    component!(path: crate::logic::mines::MineState, storage: mines, event: MineEvent);
    impl MineInternal = crate::logic::mines::MineState::InternalImpl<ContractState>;
    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    component!(path: ResourceState, storage: resources, event: ResourceEvent);
    component!(path: ArrivalState, storage: arrivals, event: ArrivalEvent);
    component!(path: ProductionState, storage: production, event: ProductionEvent);
    impl LifeInternal = ReleaseState::InternalImpl<ContractState>;
    impl ResourceInternal = ResourceState::InternalImpl<ContractState>;
    impl ArrivalInternal = ArrivalState::InternalImpl<ContractState>;
    impl ProductionInternal = ProductionState::InternalImpl<ContractState>;

    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[substorage(v0)]
        release: ReleaseState::Storage,
        #[substorage(v0)]
        resources: ResourceState::Storage,
        #[substorage(v0)]
        arrivals: ArrivalState::Storage,
        #[substorage(v0)]
        production: ProductionState::Storage,
        #[substorage(v0)]
        mines: crate::logic::mines::MineState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        MineEvent: crate::logic::mines::MineState::Event,
        ReleaseEvent: ReleaseState::Event,
        ResourceEvent: ResourceState::Event,
        ArrivalEvent: ArrivalState::Event,
        ProductionEvent: ProductionState::Event,
        RowSet: RowSet,
        StoryEvent: StoryEvent,
    }
    #[abi(embed_v0)]
    impl Resources of crate::resources::IResourceOperations<ContractState> {
        fn redirect_production(
            ref self: ContractState,
            key: ResourceKey,
            resource_type: u8,
            receiver: crate::resources::ProductionReceiver,
            rate: u64,
            timestamp: u64,
            game_context: crate::commands::ResourceContext,
        ) {
            let rule = crate::logic::resources::rule(key.game_id, resource_type);
            self
                .resources
                .redirect_production(
                    key,
                    resource_type,
                    receiver,
                    rate,
                    rule.unit_weight,
                    timestamp.try_into().unwrap(),
                    game_context.production_start,
                );
        }

        fn initialize_explorer_resources(
            ref self: ContractState, key: ResourceKey, amount: u128, game_context: crate::commands::ResourceContext,
        ) {
            self.resources.initialize(key, game_context.troop_capacity.into() * amount);
        }
        fn change_explorer_capacity(
            ref self: ContractState,
            key: ResourceKey,
            amount: u128,
            increase: bool,
            game_context: crate::commands::ResourceContext,
        ) {
            self.resources.change_capacity(key, game_context.troop_capacity.into() * amount, increase);
        }
        fn spend_food(
            ref self: ContractState,
            key: ResourceKey,
            wheat: u128,
            fish: u128,
            timestamp: u64,
            game_context: crate::commands::ResourceContext,
        ) {
            self.resources.spend(key, 35, wheat, timestamp, game_context);
            self.resources.spend(key, 36, fish, timestamp, game_context);
        }
        fn spend_spire_fee(
            ref self: ContractState, key: ResourceKey, timestamp: u64, game_context: crate::commands::ResourceContext,
        ) {
            if game_context.spire_fee != 0 {
                self.resources.spend(key, 38, game_context.spire_fee, timestamp, game_context);
            }
        }

        fn initialize_resources(
            ref self: ContractState,
            key: ResourceKey,
            capacity: u128,
            category: u8,
            timestamp: u64,
            game_context: crate::commands::ActionContext,
        ) {
            let game_context = crate::commands::load_context(key.game_id, game_context);

            self.resources.initialize(key, capacity);
            if category == 8 {
                crate::bitcoin::IBitcoinFundingDispatcherTrait::register_bitcoin_structure(
                    crate::bitcoin::IBitcoinFundingLibraryDispatcher {
                        class_hash: self.release.classes(key.game_id).prizes.read(),
                    },
                    key,
                    category,
                    timestamp,
                    crate::commands::action_context(game_context),
                );
            }
        }
        fn destroy_resources(ref self: ContractState, key: ResourceKey) {
            self.resources.destroy(key);
        }
        fn grant_resource(
            ref self: ContractState,
            key: ResourceKey,
            resource_type: u8,
            amount: u128,
            timestamp: u64,
            game_context: crate::commands::ResourceContext,
        ) -> u128 {
            let rule = crate::logic::resources::rule(key.game_id, resource_type);
            self
                .resources
                .grant_resource(
                    key,
                    resource_type,
                    amount,
                    rule.unit_weight,
                    timestamp.try_into().unwrap(),
                    game_context.production_start,
                )
        }
        fn spend_resource(
            ref self: ContractState,
            key: ResourceKey,
            resource_type: u8,
            amount: u128,
            timestamp: u64,
            game_context: crate::commands::ResourceContext,
        ) {
            self.resources.spend(key, resource_type, amount, timestamp, game_context);
        }
        fn stop_production(
            ref self: ContractState,
            key: ResourceKey,
            resource_type: u8,
            rate: u64,
            timestamp: u64,
            game_context: crate::commands::ResourceContext,
        ) {
            self
                .resources
                .stop_production(
                    key,
                    resource_type,
                    rate,
                    crate::logic::resources::rule(key.game_id, resource_type).unit_weight,
                    timestamp.try_into().unwrap(),
                    game_context.production_start,
                );
        }
        fn change_structure_capacity(ref self: ContractState, key: ResourceKey, amount: u128, adding: bool) {
            self.resources.change_structure_capacity(key, amount, adding);
        }
        fn start_production(
            ref self: ContractState,
            key: ResourceKey,
            resource_type: u8,
            rate: u64,
            output: u128,
            timestamp: u64,
            game_context: crate::commands::ResourceContext,
        ) {
            let rule = crate::logic::resources::rule(key.game_id, resource_type);
            self
                .resources
                .start_production(
                    key,
                    resource_type,
                    rate,
                    output,
                    rule.unit_weight,
                    timestamp.try_into().unwrap(),
                    game_context.production_start,
                );
        }
    }
    #[abi(embed_v0)]
    impl EconomyDelivery of crate::trade::IEconomyDelivery<ContractState> {
        fn queue_economy_delivery(
            ref self: ContractState,
            key: ResourceKey,
            resource: crate::resources::ResourceAmount,
            travel_time: u64,
            timestamp: u64,
            game_context: crate::commands::ResourceContext,
        ) {
            let _ = crate::logic::resources::rule(key.game_id, resource.resource_type);

            let arrival = crate::arrivals::arrival_key(
                key.game_id, key.entity_id, game_context.delivery_tick, timestamp, travel_time,
            );
            self.arrivals.enqueue(arrival, array![resource].span());
        }
    }

    #[abi(embed_v0)]
    impl ExplorationGrant of crate::exploration_rewards::IExplorationGrant<ContractState> {
        fn grant_exploration_reward(
            ref self: ContractState,
            key: ResourceKey,
            resource_type: u8,
            amount: u128,
            timestamp: u64,
            game_context: crate::commands::ResourceContext,
        ) {
            let rule = crate::logic::resources::rule(key.game_id, resource_type);
            self
                .resources
                .grant_resource(
                    key,
                    resource_type,
                    amount,
                    rule.unit_weight,
                    timestamp.try_into().unwrap(),
                    game_context.production_start,
                );
        }
    }

    #[abi(embed_v0)]
    impl ResourceCommands of crate::commands::IResourceCommands<ContractState> {
        fn send_resources(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::resources::ResourceTransfer,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            self.assert_resource_command(game_id, context.timestamp, context);
            crate::resources::assert_unique_resources(command.resources);
            let from = ResourceKey { game_id, entity_id: command.from_entity_id };
            assert!(crate::logic::structures::owner(from) == actor, "actor does not own sender");
            self.transfer_delayed(game_id, command, context.timestamp, context, ref story_cursor);
            ((), story_cursor)
        }
        fn transfer_explorer_resources_to_structure(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::resources::ResourceTransfer,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            self.assert_resource_command(game_id, context.timestamp, context);
            let explorer = crate::logic::troops::authorized_explorer(
                ExplorerKey { game_id, explorer_id: command.from_entity_id }, actor, context.timestamp, context,
            );
            let structure = crate::logic::structures::structure(
                ResourceKey { game_id, entity_id: command.to_entity_id },
            )
                .expect('missing recipient structure');
            assert!(
                crate::geometry::adjacent(
                    explorer.coord,
                    crate::structures::structure_coord(ResourceKey { game_id, entity_id: command.to_entity_id }),
                ),
                "explorer and structure are not adjacent",
            );
            for resource in command.resources {
                if crate::resources::is_troop_resource(*resource.resource_type) {
                    let owner = crate::logic::structures::owner(ResourceKey { game_id, entity_id: explorer.owner });
                    assert!(
                        owner != 0.try_into().unwrap() && owner == structure.owner,
                        "reinforcement requires target ownership",
                    );
                    break;
                }
            }
            self.transfer_instant(game_id, command, context.timestamp, context, ref story_cursor);
            ((), story_cursor)
        }
        fn offload_arrival(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: OffloadArrival,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            self.assert_resource_command(game_id, context.timestamp, context);
            let entity = ResourceKey { game_id, entity_id: command.entity_id };
            assert!(command.entity_id != 0, "missing destination structure");
            assert!(crate::logic::structures::owner(entity) == actor, "actor does not own structure");
            self.assert_deposits_unlocked(entity, context.timestamp, context);
            assert!(command.resource_count != 0, "resource count is zero");
            let key = ArrivalKey { game_id, entity_id: command.entity_id, day: command.day, slot: command.slot };
            let rules = context.rules.unbox();
            assert!(
                has_arrived(key, rules.tick_config.delivery_tick_in_seconds, context.timestamp),
                "resources have not arrived",
            );
            let arrival = self.arrivals.read(key);
            let count = core::cmp::min(command.resource_count.into(), arrival.resources.len());
            let delivered = arrival.resources.slice(0, count);
            let start_at = crate::logic::resources::production_start(game_id, context);
            for resource in delivered {
                let rule = crate::logic::resources::rule(game_id, *resource.resource_type);
                self
                    .resources
                    .grant_resource(
                        entity,
                        *resource.resource_type,
                        *resource.amount,
                        rule.unit_weight,
                        context.timestamp.try_into().unwrap(),
                        start_at,
                    );
            }
            self.arrivals.remove_prefix(key, count);
            if count != 0 {
                crate::logic::stories::emit_entity_story(
                    entity,
                    actor,
                    Story::ResourceReceiveArrivalStory(crate::ownership::ResourceAmountsStory { resources: delivered }),
                    context.timestamp,
                    ref story_cursor,
                );
            }
            ((), story_cursor)
        }
        fn burn_structure_resources(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::resources::ResourceBurn,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            self.assert_resource_command(game_id, context.timestamp, context);
            let key = ResourceKey { game_id, entity_id: command.entity_id };
            assert!(crate::logic::structures::owner(key) == actor, "actor does not own structure");
            crate::resources::assert_unique_resources(command.resources);
            self.burn(key, command.resources);
            crate::logic::stories::emit_entity_story(
                key,
                actor,
                Story::ResourceBurnStory(crate::ownership::ResourceAmountsStory { resources: command.resources }),
                context.timestamp,
                ref story_cursor,
            );
            ((), story_cursor)
        }
        fn transfer_explorer_resources(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::resources::ResourceTransfer,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            self.assert_resource_command(game_id, context.timestamp, context);
            assert!(command.from_entity_id != 0 && command.to_entity_id != 0, "missing explorer id");
            let from = crate::logic::troops::authorized_explorer(
                ExplorerKey { game_id, explorer_id: command.from_entity_id }, actor, context.timestamp, context,
            );
            let to = crate::logic::troops::active_explorer(
                ExplorerKey { game_id, explorer_id: command.to_entity_id }, context.timestamp, context,
            );
            assert!(to.owner != 0, "recipient explorer has no owner");
            assert!(crate::geometry::adjacent(from.coord, to.coord), "explorers are not adjacent");
            self.transfer_instant(game_id, command, context.timestamp, context, ref story_cursor);
            ((), story_cursor)
        }
        fn transfer_structure_resources_to_explorer(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::resources::ResourceTransfer,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            self.assert_resource_command(game_id, context.timestamp, context);
            assert!(command.from_entity_id != 0 && command.to_entity_id != 0, "missing transfer entity");
            let from_key = ResourceKey { game_id, entity_id: command.from_entity_id };
            assert!(crate::logic::structures::owner(from_key) == actor, "actor does not own structure");
            let to = crate::logic::troops::active_explorer(
                ExplorerKey { game_id, explorer_id: command.to_entity_id }, context.timestamp, context,
            );
            assert!(
                crate::geometry::adjacent(crate::structures::structure_coord(from_key), to.coord),
                "structure and explorer are not adjacent",
            );
            for resource in command.resources {
                assert!(
                    !crate::resources::is_troop_resource(*resource.resource_type), "cannot transfer troop resource",
                );
            }
            self.transfer_instant(game_id, command, context.timestamp, context, ref story_cursor);
            ((), story_cursor)
        }
    }
    #[generate_trait]
    impl Internal of InternalTrait {
        fn assert_resource_command(
            self: @ContractState, game_id: u32, timestamp: u64, game_context: crate::commands::ExecutionContext,
        ) {
            crate::game::assert_main_with_grace(game_context.game.unbox(), timestamp);
        }

        fn assert_deposits_unlocked(
            self: @ContractState, key: ResourceKey, timestamp: u64, game_context: crate::commands::ExecutionContext,
        ) {
            let structure = crate::logic::structures::structure(key).expect('missing destination structure');
            if structure.base.category != crate::ownership::VILLAGE_CATEGORY {
                return;
            }
            let rules = game_context.rules.unbox();
            let game = game_context.game.unbox();
            let interval = rules.tick_config.armies_tick_in_seconds;
            let now = timestamp / interval;
            let season_end = game.start_main_at / interval + rules.battle_config.regular_immunity_ticks.into();
            let village_end = structure.base.created_at.into() / interval
                + rules.battle_config.village_immunity_ticks.into();
            assert!(now >= season_end && now >= village_end, "village cannot claim deposits during spawn immunity");
        }

        fn burn(ref self: ContractState, key: ResourceKey, resources: Span<crate::resources::ResourceAmount>) {
            for resource in resources {
                let rule = crate::logic::resources::rule(key.game_id, *resource.resource_type);
                self.resources.burn_resource(key, *resource.resource_type, *resource.amount, rule.unit_weight);
            }
        }
        fn transfer_delayed(
            ref self: ContractState,
            game_id: u32,
            command: crate::resources::ResourceTransfer,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
            ref story_cursor: crate::ownership::StoryCursor,
        ) {
            assert!(command.from_entity_id != 0 && command.to_entity_id != 0, "missing transfer structure");
            assert!(command.from_entity_id != command.to_entity_id, "self transfer");
            assert!(!command.resources.is_empty(), "no resource to transfer");
            let from = ResourceKey { game_id, entity_id: command.from_entity_id };
            let to = ResourceKey { game_id, entity_id: command.to_entity_id };
            let source = crate::logic::structures::structure(from).expect('missing sending structure');
            let destination = crate::logic::structures::structure(to).expect('missing recipient structure');
            let rules = game_context.rules.unbox();
            assert!(
                !crate::rules::rule_enabled(rules, crate::rules::SAME_OWNER_TRANSFER)
                    || source.owner == destination.owner,
                "transfers require the same owner",
            );
            let travel_time = crate::transport::travel_time(
                crate::structures::structure_coord(from),
                crate::structures::structure_coord(to),
                command.resources,
                rules.speed_config,
                false,
            );
            let weight = self.spend_shipment(from, command.resources, timestamp, game_context);
            let donkeys = crate::transport::donkeys_needed(weight, rules.capacity_config.donkey_capacity.into());
            self
                .resources
                .spend(
                    from, crate::transport::DONKEY, donkeys, timestamp, crate::commands::resource_context(game_context),
                );
            let arrival = crate::arrivals::arrival_key(
                game_id, to.entity_id, rules.tick_config.delivery_tick_in_seconds, timestamp, travel_time,
            );
            self.arrivals.enqueue(arrival, command.resources);
            let story = Story::ResourceTransferStory(
                crate::ownership::ResourceTransferStory {
                    transfer_type: crate::ownership::TransferType::Delayed,
                    from_entity_id: from.entity_id,
                    from_entity_owner_address: source.owner,
                    to_entity_id: to.entity_id,
                    to_entity_owner_address: destination.owner,
                    resources: command.resources,
                    is_mint: false,
                    travel_time,
                },
            );
            crate::logic::stories::emit_entity_story(from, source.owner, story, timestamp, ref story_cursor);
            crate::logic::stories::emit_entity_story(to, destination.owner, story, timestamp, ref story_cursor);
        }
        fn spend_shipment(
            ref self: ContractState,
            from: ResourceKey,
            resources: Span<crate::resources::ResourceAmount>,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) -> u128 {
            let mut weight = 0;
            let start_at = crate::logic::resources::production_start(from.game_id, game_context);
            for resource in resources {
                let rule = crate::logic::resources::rule(from.game_id, *resource.resource_type);
                weight += *resource.amount * rule.unit_weight;
                self
                    .resources
                    .spend_resource(
                        from,
                        *resource.resource_type,
                        *resource.amount,
                        rule.unit_weight,
                        timestamp.try_into().unwrap(),
                        start_at,
                    );
            }
            weight
        }
        fn transfer_instant(
            ref self: ContractState,
            game_id: u32,
            command: crate::resources::ResourceTransfer,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
            ref story_cursor: crate::ownership::StoryCursor,
        ) {
            crate::resources::assert_unique_resources(command.resources);
            let from = ResourceKey { game_id, entity_id: command.from_entity_id };
            let to = ResourceKey { game_id, entity_id: command.to_entity_id };
            let start_at = crate::logic::resources::production_start(game_id, game_context);
            for resource in command.resources {
                let rule = crate::logic::resources::rule(game_id, *resource.resource_type);
                self
                    .resources
                    .spend_resource(
                        from,
                        *resource.resource_type,
                        *resource.amount,
                        rule.unit_weight,
                        timestamp.try_into().unwrap(),
                        start_at,
                    );
                self
                    .resources
                    .grant_resource(
                        to,
                        *resource.resource_type,
                        *resource.amount,
                        rule.unit_weight,
                        timestamp.try_into().unwrap(),
                        start_at,
                    );
            }
            let recipient = crate::logic::structures::owner(to);
            crate::logic::stories::emit_entity_story(
                to,
                recipient,
                Story::ResourceTransferStory(
                    crate::ownership::ResourceTransferStory {
                        transfer_type: crate::ownership::TransferType::Instant,
                        from_entity_id: from.entity_id,
                        from_entity_owner_address: crate::logic::structures::owner(from),
                        to_entity_id: to.entity_id,
                        to_entity_owner_address: recipient,
                        resources: command.resources,
                        is_mint: false,
                        travel_time: 0,
                    },
                ),
                timestamp,
                ref story_cursor,
            );
        }
    }
}
