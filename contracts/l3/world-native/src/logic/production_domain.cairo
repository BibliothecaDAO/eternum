#[starknet::contract]
pub mod ProductionLogic {
    use starknet::ContractAddress;
    use starknet::storage::StorageMapWriteAccess;
    use crate::arrivals::{ArrivalKey, OffloadArrival, has_arrived};
    use crate::events::RowSet;
    use crate::game::assert_playing;
    use crate::logic::arrivals::ArrivalState;
    use crate::logic::bridge::BridgeState;
    use crate::logic::production::ProductionState;
    use crate::logic::release::ReleaseState;
    use crate::logic::resources::ResourceState;
    use crate::logic::withdrawals::WithdrawalState;
    use crate::ownership::{Story, StoryEvent};
    #[cfg(feature: "test_support")]
    use crate::production::{ProductionBonus, ProductionRecipe};
    use crate::production::{RecipeKey, RefillProduction};
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

    component!(path: crate::logic::home_grants::HomeGrantState, storage: home_grants, event: AdministrationEvent);
    #[abi(embed_v0)]
    impl HomeGrants = crate::logic::home_grants::HomeGrantState::HomeGrantsImpl<ContractState>;
    impl HomeGrantsInternal = crate::logic::home_grants::HomeGrantState::InternalImpl<ContractState>;
    component!(path: crate::logic::quests::QuestState, storage: quests, event: QuestEvent);
    #[abi(embed_v0)]
    impl DailyQuest = crate::logic::quests::QuestState::DailyQuestImpl<ContractState>;
    #[abi(embed_v0)]
    impl BaneEffects = crate::logic::quests::QuestState::BaneEffectsImpl<ContractState>;
    #[abi(embed_v0)]
    impl QuestProgress = crate::logic::quests::QuestState::ProgressImpl<ContractState>;

    #[abi(embed_v0)]
    impl PresetResources of crate::presets::IPresetResources<ContractState> {
        fn store_resource_preset(
            ref self: ContractState,
            commitment: felt252,
            resources: crate::presets::ResourcePreset,
            exploration: Span<crate::exploration_rewards::ExplorationReward>,
            mode_rules: u32,
        ) {
            crate::logic::preset_record::store_resources(commitment, resources, exploration, mode_rules);
        }
    }
    component!(path: BridgeState, storage: bridge, event: BridgeEvent);
    #[abi(embed_v0)]
    impl Bridge = BridgeState::BridgeImpl<ContractState>;
    component!(path: WithdrawalState, storage: withdrawals, event: WithdrawalEvent);
    impl WithdrawalInternal = WithdrawalState::InternalImpl<ContractState>;
    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[substorage(v0)]
        home_grants: crate::logic::home_grants::HomeGrantState::Storage,
        #[substorage(v0)]
        quests: crate::logic::quests::QuestState::Storage,
        #[substorage(v0)]
        withdrawals: WithdrawalState::Storage,
        #[substorage(v0)]
        bridge: BridgeState::Storage,
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
        AdministrationEvent: crate::logic::home_grants::HomeGrantState::Event,
        QuestEvent: crate::logic::quests::QuestState::Event,
        WithdrawalEvent: WithdrawalState::Event,
        BridgeEvent: BridgeState::Event,
        MineEvent: crate::logic::mines::MineState::Event,
        ReleaseEvent: ReleaseState::Event,
        ResourceEvent: ResourceState::Event,
        ArrivalEvent: ArrivalState::Event,
        ProductionEvent: ProductionState::Event,
        RowSet: RowSet,
        StoryEvent: StoryEvent,
    }

    #[abi(embed_v0)]
    impl MineRules of crate::mines::IMineRules<ContractState> {
        #[cfg(feature: "test_support")]
        fn mine_kind(self: @ContractState, key: crate::mines::MineKindKey) -> crate::mines::MineKindConfig {
            self.mines.kind(key)
        }
        #[cfg(feature: "test_support")]
        fn mine_pool(self: @ContractState, key: crate::mines::MinePoolKey) -> Span<crate::mines::MineWeight> {
            self.mines.pool(key)
        }
        fn mine_draw(
            self: @ContractState, key: crate::mines::MinePoolKey, seed: u256,
        ) -> (u8, crate::mines::MineKindConfig, u128) {
            let kind = crate::mines::select_kind(self.mines.pool(key), seed);
            let config = self.mines.kind(crate::mines::MineKindKey { game_id: key.game_id, kind });
            (kind, config, crate::mines::cap(config, seed))
        }
    }

    #[abi(embed_v0)]
    impl RelicProduction of crate::relics::IRelicProduction<ContractState> {
        fn apply_production_relic(
            ref self: ContractState,
            key: ResourceKey,
            relic_id: u8,
            rule: crate::relics::RelicRule,
            timestamp: u64,
            game_context: crate::commands::ActionContext,
        ) {
            let game_context = crate::commands::execution_context(key.game_id, game_context);

            let rules = game_context.rules.unbox();
            let mut bonus = self.production.bonus(key);
            crate::relics::boost_production(
                ref bonus, relic_id, rule, timestamp, rules.tick_config.armies_tick_in_seconds,
            );
            self.production.data.production.bonuses.write((key.game_id, key.entity_id), bonus);
            let mut values = array![];
            bonus.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'ProductionBonus',
                        keys: array![key.game_id.into(), key.entity_id.into()].span(),
                        values: values.span(),
                    },
                );
        }
    }
    #[abi(embed_v0)]
    impl ProductionRules of crate::production::IProductionRules<ContractState> {
        #[cfg(feature: "test_support")]
        fn production_recipe(self: @ContractState, key: RecipeKey) -> ProductionRecipe {
            self.production.recipe(key)
        }
        #[cfg(feature: "test_support")]
        fn production_bonus(self: @ContractState, key: ResourceKey) -> ProductionBonus {
            self.production.bonus(key)
        }
    }
    #[abi(embed_v0)]
    impl ProductionCommands of crate::production::IProductionCommands<ContractState> {
        fn burn_labor_for_resource_production(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: RefillProduction,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::execution_context(game_id, context);

            let key = self.assert_production_command(game_id, actor, command, context.timestamp, context);
            self.refill_from_recipes(key, command, false, context.timestamp, context);
            ()
        }
        fn burn_resource_for_resource_production(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: RefillProduction,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::execution_context(game_id, context);

            let key = self.assert_production_command(game_id, actor, command, context.timestamp, context);
            self.refill_from_recipes(key, command, true, context.timestamp, context);
            ()
        }
    }

    #[generate_trait]
    impl Internal of InternalTrait {
        fn transfer_instant(
            ref self: ContractState,
            game_id: u32,
            command: crate::resources::ResourceTransfer,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
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
            );
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
        fn transfer_delayed(
            ref self: ContractState,
            game_id: u32,
            command: crate::resources::ResourceTransfer,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
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
            crate::logic::stories::emit_entity_story(from, source.owner, story, timestamp);
            crate::logic::stories::emit_entity_story(to, destination.owner, story, timestamp);
        }
        fn burn(ref self: ContractState, key: ResourceKey, resources: Span<crate::resources::ResourceAmount>) {
            for resource in resources {
                let rule = crate::logic::resources::rule(key.game_id, *resource.resource_type);
                self.resources.burn_resource(key, *resource.resource_type, *resource.amount, rule.unit_weight);
            }
        }
        fn assert_deposits_unlocked(
            self: @ContractState, key: ResourceKey, timestamp: u64, game_context: crate::commands::ExecutionContext,
        ) {
            let structure = crate::logic::structures::structure(key).expect('missing destination structure');
            if structure.base.category != crate::taxonomy::VILLAGE_CATEGORY {
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
        fn assert_resource_command(
            self: @ContractState, game_id: u32, timestamp: u64, game_context: crate::commands::ExecutionContext,
        ) {
            crate::game::assert_main_with_grace(game_context.game.unbox(), timestamp);
        }
        fn assert_production_command(
            self: @ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: RefillProduction,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) -> ResourceKey {
            assert_playing(game_context.game.unbox(), timestamp);
            let key = ResourceKey { game_id, entity_id: command.structure_id };
            let structure = crate::logic::structures::structure(key).expect('missing producer structure');
            assert!(structure.owner == actor, "actor does not own structure");
            assert!(
                structure.base.category == crate::taxonomy::REALM_CATEGORY
                    || structure.base.category == crate::taxonomy::VILLAGE_CATEGORY
                    || structure.base.category == crate::taxonomy::CAMP_CATEGORY,
                "structure cannot produce resources",
            );
            assert!(command.resource_types.len() == command.amounts.len(), "production input lengths differ");
            key
        }
        fn refill_from_recipes(
            ref self: ContractState,
            key: ResourceKey,
            command: RefillProduction,
            complex: bool,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) {
            for index in 0..command.resource_types.len() {
                let resource_type = *command.resource_types.at(index);
                let cycles = *command.amounts.at(index);
                assert!(cycles != 0, "zero production cycles");
                let recipe = self.production.recipe(RecipeKey { game_id: key.game_id, resource_type });
                let (inputs, per_cycle) = if complex {
                    (recipe.complex_inputs, recipe.complex_output)
                } else {
                    (recipe.simple_inputs, recipe.simple_output)
                };
                assert!(!inputs.is_empty(), "missing production input recipe");
                let mut costs = array![];
                for input in inputs {
                    assert!(*input.amount != 0, "zero production input cost");
                    let amount = *input.amount * cycles;
                    self
                        .resources
                        .spend(
                            key,
                            *input.resource_type,
                            amount,
                            timestamp,
                            crate::commands::resource_context(game_context),
                        );
                    costs.append(crate::resources::ResourceAmount { resource_type: *input.resource_type, amount });
                }
                let output = Into::<u64, u128>::into(per_cycle) * cycles;
                assert!(output != 0, "zero production output");
                self.refill_output(key, resource_type, output, costs.span(), timestamp, game_context);
            }
        }
        fn refill_output(
            ref self: ContractState,
            key: ResourceKey,
            resource_type: u8,
            output: u128,
            costs: Span<crate::resources::ResourceAmount>,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) {
            let output = crate::production::bonus_output(self.production.bonus(key), resource_type, output, timestamp);
            self
                .resources
                .refill_production(
                    key,
                    resource_type,
                    output,
                    crate::logic::resources::rule(key.game_id, resource_type).unit_weight,
                    timestamp.try_into().unwrap(),
                    crate::logic::resources::production_start(key.game_id, game_context),
                );
            crate::logic::stories::emit_entity_story(
                key,
                crate::logic::structures::owner(key),
                Story::ProductionStory(
                    crate::ownership::ProductionStory {
                        received_resource_type: resource_type, received_amount: output, cost: costs,
                    },
                ),
                timestamp,
            );
        }
    }
    #[abi(embed_v0)]
    impl BankWithdrawal = BridgeState::BankWithdrawalImpl<ContractState>;
    #[abi(embed_v0)]
    impl PresetWithdrawals of crate::presets::IPresetWithdrawals<ContractState> {
        fn store_withdrawal_preset(
            ref self: ContractState, commitment: felt252, withdrawals: crate::presets::WithdrawalPreset,
        ) {
            crate::logic::preset_record::store_withdrawals(commitment, withdrawals);
        }
    }
    #[abi(embed_v0)]
    impl Withdrawals of crate::withdrawals::IWithdrawals<ContractState> {
        #[cfg(feature: "test_support")]
        fn withdrawal_rules(self: @ContractState, game_id: u32) -> crate::withdrawals::WithdrawalRules {
            self.withdrawals.rules(game_id)
        }
        #[cfg(feature: "test_support")]
        fn resource_token(self: @ContractState, key: crate::market::MarketKey) -> ContractAddress {
            self.withdrawals.token(key)
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
        ) -> () {
            let context = crate::commands::execution_context(game_id, context);

            self.assert_resource_command(game_id, context.timestamp, context);
            crate::resources::assert_unique_resources(command.resources);
            let from = ResourceKey { game_id, entity_id: command.from_entity_id };
            assert!(crate::logic::structures::owner(from) == actor, "actor does not own sender");
            self.transfer_delayed(game_id, command, context.timestamp, context);
            ()
        }
        fn transfer_explorer_resources_to_structure(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::resources::ResourceTransfer,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::execution_context(game_id, context);

            self.assert_resource_command(game_id, context.timestamp, context);
            let explorer = crate::logic::troops::command_explorer(
                ExplorerKey { game_id, explorer_id: command.from_entity_id }, Some(actor), context.timestamp, context,
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
            self.transfer_instant(game_id, command, context.timestamp, context);
            ()
        }
        fn offload_arrival(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: OffloadArrival,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::execution_context(game_id, context);

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
                );
            }
            ()
        }
        fn burn_structure_resources(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::resources::ResourceBurn,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::execution_context(game_id, context);

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
            );
            ()
        }
        fn transfer_explorer_resources(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::resources::ResourceTransfer,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::execution_context(game_id, context);

            self.assert_resource_command(game_id, context.timestamp, context);
            assert!(command.from_entity_id != 0 && command.to_entity_id != 0, "missing explorer id");
            let from = crate::logic::troops::command_explorer(
                ExplorerKey { game_id, explorer_id: command.from_entity_id }, Some(actor), context.timestamp, context,
            );
            let to = crate::logic::troops::command_explorer(
                ExplorerKey { game_id, explorer_id: command.to_entity_id }, None, context.timestamp, context,
            );
            assert!(to.owner != 0, "recipient explorer has no owner");
            assert!(crate::geometry::adjacent(from.coord, to.coord), "explorers are not adjacent");
            self.transfer_instant(game_id, command, context.timestamp, context);
            ()
        }
        fn transfer_structure_resources_to_explorer(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::resources::ResourceTransfer,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::execution_context(game_id, context);

            self.assert_resource_command(game_id, context.timestamp, context);
            assert!(command.from_entity_id != 0 && command.to_entity_id != 0, "missing transfer entity");
            let from_key = ResourceKey { game_id, entity_id: command.from_entity_id };
            assert!(crate::logic::structures::owner(from_key) == actor, "actor does not own structure");
            let to = crate::logic::troops::command_explorer(
                ExplorerKey { game_id, explorer_id: command.to_entity_id }, None, context.timestamp, context,
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
            self.transfer_instant(game_id, command, context.timestamp, context);
            ()
        }
    }
}
