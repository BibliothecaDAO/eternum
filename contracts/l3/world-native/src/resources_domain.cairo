#[starknet::contract]
pub mod ResourcesDomain {
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};
    use starknet::{ContractAddress, get_caller_address};
    use crate::arrivals::{Arrival, ArrivalKey, ArrivalState, OffloadArrival, has_arrived};
    use crate::commands::ExecutionContext;
    use crate::events::RowSet;
    use crate::game::{IGameDispatcher, IGameDispatcherTrait, assert_playing};
    use crate::lifecycle::Lifecycle;
    use crate::ownership::{Story, StoryEvent};
    use crate::production::{
        ProductionBonus, ProductionRecipe, ProductionState, RecipeConfig, RecipeKey, RefillProduction,
    };
    use crate::resources::{Production, ResourceKey, ResourceRule, ResourceSlot, ResourceState, Weight};
    use crate::structures::{IStructuresDispatcher, IStructuresDispatcherTrait};
    use crate::troops::{ExplorerKey, ITroopsDispatcher, ITroopsDispatcherTrait};
    component!(path: crate::mines::MineState, storage: mines, event: MineEvent);
    impl MineInternal = crate::mines::MineState::InternalImpl<ContractState>;
    component!(path: Lifecycle, storage: lifecycle, event: LifecycleEvent);
    component!(path: ResourceState, storage: resources, event: ResourceEvent);
    component!(path: ArrivalState, storage: arrivals, event: ArrivalEvent);
    component!(path: ProductionState, storage: production, event: ProductionEvent);
    #[abi(embed_v0)]
    impl Domain = Lifecycle::DomainImpl<ContractState>;
    impl LifeInternal = Lifecycle::InternalImpl<ContractState>;
    impl ResourceInternal = ResourceState::InternalImpl<ContractState>;
    impl ArrivalInternal = ArrivalState::InternalImpl<ContractState>;
    impl ProductionInternal = ProductionState::InternalImpl<ContractState>;
    const RATE_WORD_SCALE: u128 = 0x10000000000000000;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        lifecycle: Lifecycle::Storage,
        #[substorage(v0)]
        resources: ResourceState::Storage,
        #[substorage(v0)]
        arrivals: ArrivalState::Storage,
        resource_rules: Map<(u32, u8), (u128, u128)>,
        resources_configured: Map<u32, bool>,
        #[substorage(v0)]
        production: ProductionState::Storage,
        #[substorage(v0)]
        mines: crate::mines::MineState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        MineEvent: crate::mines::MineState::Event,
        LifecycleEvent: Lifecycle::Event,
        ResourceEvent: ResourceState::Event,
        ArrivalEvent: ArrivalState::Event,
        ProductionEvent: ProductionState::Event,
        RowSet: RowSet,
        StoryEvent: StoryEvent,
    }
    #[constructor]
    fn constructor(ref self: ContractState, authority: ContractAddress) {
        self.lifecycle.initialize(authority);
    }
    #[abi(embed_v0)]
    impl Resources of crate::resources::IResources<ContractState> {
        fn resource_arrival(self: @ContractState, key: ArrivalKey) -> Arrival {
            self.arrivals.read(key)
        }
        fn has_resource(self: @ContractState, key: ResourceKey) -> bool {
            self.resources.resource_exists.read((key.game_id, key.entity_id))
        }
        fn resource_balance(self: @ContractState, key: ResourceSlot) -> u128 {
            self.resources.balance(ResourceKey { game_id: key.game_id, entity_id: key.entity_id }, key.resource_type)
        }
        fn resource_production(self: @ContractState, key: ResourceSlot) -> Production {
            self.resources.production(ResourceKey { game_id: key.game_id, entity_id: key.entity_id }, key.resource_type)
        }
        fn production_receiver(
            self: @ContractState, key: ResourceSlot,
        ) -> Option<crate::resources::ProductionReceiver> {
            self.resources.production_receivers.read((key.game_id, key.entity_id, key.resource_type))
        }
        fn redirect_production(
            ref self: ContractState,
            key: ResourceKey,
            resource_type: u8,
            receiver: crate::resources::ProductionReceiver,
            rate: u64,
            timestamp: u64,
        ) {
            self.assert_structures();
            let rule = self.rule(key.game_id, resource_type);
            self
                .resources
                .redirect_production(
                    key,
                    resource_type,
                    receiver,
                    rate,
                    rule.unit_weight,
                    timestamp.try_into().unwrap(),
                    self.production_start(key.game_id),
                );
        }
        fn resource_weight(self: @ContractState, key: ResourceKey) -> Weight {
            self.resources.weight(key)
        }
        fn configure_resources(ref self: ContractState, game_id: u32, rules: Span<ResourceRule>) {
            self.lifecycle.assert_configurator();
            let _ = self.game_dispatcher().game(game_id);
            assert!(!self.resources_configured.read(game_id), "resource rules already configured");
            assert!(rules.len() == 58, "incomplete resource rules");
            for index in 0_u32..58 {
                let rule = *rules.at(index);
                assert!(rule.resource_type.into() == index + 1, "resource rules must be ordered");
                self
                    .resource_rules
                    .write(
                        (game_id, rule.resource_type),
                        (
                            rule.unit_weight,
                            Into::<u64, u128>::into(rule.realm_rate)
                                + Into::<u64, u128>::into(rule.village_rate) * RATE_WORD_SCALE,
                        ),
                    );
                let mut values = array![];
                rule.serialize(ref values);
                self
                    .emit(
                        RowSet {
                            version: 1,
                            model: 'ResourceRule',
                            keys: array![game_id.into(), rule.resource_type.into()].span(),
                            values: values.span().slice(1, values.len() - 1),
                        },
                    );
            }
            self.resources_configured.write(game_id, true);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'ResourceRulesReady',
                        keys: array![game_id.into()].span(),
                        values: array![1].span(),
                    },
                );
        }
        fn initialize_explorer_resources(ref self: ContractState, key: ResourceKey, amount: u128) {
            self.assert_troops();
            let rules = self.game_dispatcher().rules(key.game_id);
            self.resources.initialize(key, rules.capacity_config.troop_capacity.into() * amount);
        }
        fn change_explorer_capacity(ref self: ContractState, key: ResourceKey, amount: u128, increase: bool) {
            self.assert_troops();
            let rules = self.game_dispatcher().rules(key.game_id);
            self.resources.change_capacity(key, rules.capacity_config.troop_capacity.into() * amount, increase);
        }
        fn spend_food(ref self: ContractState, key: ResourceKey, wheat: u128, fish: u128, timestamp: u64) {
            self.assert_troops();
            self.spend(key, 35, wheat, timestamp);
            self.spend(key, 36, fish, timestamp);
        }
        fn spend_spire_fee(ref self: ContractState, key: ResourceKey, timestamp: u64) {
            self.assert_troops();
            let rules = self.game_dispatcher().rules(key.game_id);
            if rules.spire_travel_essence_cost != 0 {
                self.spend(key, 38, rules.spire_travel_essence_cost, timestamp);
            }
        }
        fn resource_rule(self: @ContractState, game_id: u32, resource_type: u8) -> ResourceRule {
            self.rule(game_id, resource_type)
        }
        fn initialize_resources(
            ref self: ContractState, key: ResourceKey, capacity: u128, category: u8, timestamp: u64,
        ) {
            self.assert_structures();
            self.resources.initialize(key, capacity);
            if category == 8 {
                crate::bitcoin::IBitcoinFundingDispatcherTrait::register_bitcoin_structure(
                    crate::bitcoin::IBitcoinFundingDispatcher {
                        contract_address: self.lifecycle.require_active().prizes,
                    },
                    key,
                    category,
                    timestamp,
                );
            }
        }
        fn destroy_resources(ref self: ContractState, key: ResourceKey) {
            self.assert_structures();
            self.resources.destroy(key);
        }
        fn grant_resource(
            ref self: ContractState, key: ResourceKey, resource_type: u8, amount: u128, timestamp: u64,
        ) -> u128 {
            self.assert_resource_settlement_domain();
            let rule = self.rule(key.game_id, resource_type);
            self
                .resources
                .grant_resource(
                    key,
                    resource_type,
                    amount,
                    rule.unit_weight,
                    timestamp.try_into().unwrap(),
                    self.production_start(key.game_id),
                )
        }
        fn spend_resource(ref self: ContractState, key: ResourceKey, resource_type: u8, amount: u128, timestamp: u64) {
            self.assert_resource_settlement_domain();
            self.spend(key, resource_type, amount, timestamp);
        }
        fn stop_production(ref self: ContractState, key: ResourceKey, resource_type: u8, rate: u64, timestamp: u64) {
            self.assert_structures();
            self
                .resources
                .stop_production(
                    key,
                    resource_type,
                    rate,
                    self.rule(key.game_id, resource_type).unit_weight,
                    timestamp.try_into().unwrap(),
                    self.production_start(key.game_id),
                );
        }
        fn change_structure_capacity(ref self: ContractState, key: ResourceKey, amount: u128, adding: bool) {
            self.assert_structures();
            self.resources.change_structure_capacity(key, amount, adding);
        }
        fn start_production(
            ref self: ContractState, key: ResourceKey, resource_type: u8, rate: u64, output: u128, timestamp: u64,
        ) {
            self.assert_structures();
            let rule = self.rule(key.game_id, resource_type);
            self
                .resources
                .start_production(
                    key,
                    resource_type,
                    rate,
                    output,
                    rule.unit_weight,
                    timestamp.try_into().unwrap(),
                    self.production_start(key.game_id),
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
        ) {
            let peers = self.lifecycle.require_active();
            assert!(
                get_caller_address() == peers.economy || get_caller_address() == peers.bridge,
                "only economy or bridge domain",
            );
            crate::commands::assert_context_time(timestamp);
            let _ = self.rule(key.game_id, resource.resource_type);
            let rules = self.game_dispatcher().rules(key.game_id);
            let arrival = crate::arrivals::arrival_key(
                key.game_id, key.entity_id, rules.tick_config.delivery_tick_in_seconds, timestamp, travel_time,
            );
            self.arrivals.enqueue(arrival, array![resource].span());
        }
    }
    #[abi(embed_v0)]
    impl MineRules of crate::mines::IMineRules<ContractState> {
        fn configure_mines(
            ref self: ContractState,
            game_id: u32,
            kinds: Span<crate::mines::MineKindEntry>,
            surface: Span<crate::mines::MineWeight>,
        ) {
            self.lifecycle.assert_configurator();
            let _ = self.game_dispatcher().game(game_id);
            self.mines.configure(game_id, kinds, surface);
        }
        fn mine_kind(self: @ContractState, key: crate::mines::MineKindKey) -> crate::mines::MineKindConfig {
            self.mines.kind(key)
        }
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
    impl ExplorationGrant of crate::exploration_rewards::IExplorationGrant<ContractState> {
        fn grant_exploration_reward(
            ref self: ContractState, key: ResourceKey, resource_type: u8, amount: u128, timestamp: u64,
        ) {
            assert!(get_caller_address() == self.lifecycle.require_active().map, "only map domain");
            let rule = self.rule(key.game_id, resource_type);
            self
                .resources
                .grant_resource(
                    key,
                    resource_type,
                    amount,
                    rule.unit_weight,
                    timestamp.try_into().unwrap(),
                    self.production_start(key.game_id),
                );
        }
    }
    #[abi(embed_v0)]
    impl RelicProduction of crate::relics::IRelicProduction<ContractState> {
        fn apply_production_relic(
            ref self: ContractState, key: ResourceKey, relic_id: u8, rule: crate::relics::RelicRule, timestamp: u64,
        ) {
            let peers = self.lifecycle.require_active();
            assert!(
                get_caller_address() == peers.economy || get_caller_address() == peers.bridge,
                "only economy or bridge domain",
            );
            crate::commands::assert_context_time(timestamp);
            let rules = IGameDispatcher { contract_address: self.lifecycle.require_active().registry }
                .rules(key.game_id);
            let mut bonus = self.production.bonus(key);
            crate::relics::boost_production(
                ref bonus, relic_id, rule, (timestamp / rules.tick_config.armies_tick_in_seconds).try_into().unwrap(),
            );
            self.production.bonuses.write((key.game_id, key.entity_id), bonus);
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
        fn configure_production(ref self: ContractState, game_id: u32, recipes: Span<RecipeConfig>) {
            self.lifecycle.assert_configurator();
            let _ = self.game_dispatcher().game(game_id);
            self.production.configure(game_id, recipes);
        }
        fn production_recipe(self: @ContractState, key: RecipeKey) -> ProductionRecipe {
            self.production.recipe(key)
        }
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
            context: ExecutionContext,
        ) {
            let key = self.assert_production_command(game_id, actor, command, context.timestamp);
            self.refill_from_recipes(key, command, false, context.timestamp);
        }
        fn burn_resource_for_resource_production(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: RefillProduction,
            context: ExecutionContext,
        ) {
            let key = self.assert_production_command(game_id, actor, command, context.timestamp);
            self.refill_from_recipes(key, command, true, context.timestamp);
        }
    }
    #[abi(embed_v0)]
    impl ResourceCommands of crate::commands::IResourceCommands<ContractState> {
        fn send_resources(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::resources::ResourceTransfer,
            context: ExecutionContext,
        ) {
            self.assert_resource_command(game_id, context.timestamp);
            crate::resources::assert_unique_resources(command.resources);
            let from = ResourceKey { game_id, entity_id: command.from_entity_id };
            assert!(self.structure_owner(from) == actor, "actor does not own sender");
            self.transfer_delayed(game_id, command, context.timestamp);
        }
        fn transfer_explorer_resources_to_structure(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::resources::ResourceTransfer,
            context: ExecutionContext,
        ) {
            self.assert_resource_command(game_id, context.timestamp);
            let explorer = self
                .troops_dispatcher()
                .authorized_explorer(
                    ExplorerKey { game_id, explorer_id: command.from_entity_id }, actor, context.timestamp,
                );
            let structure = IStructuresDispatcher { contract_address: self.lifecycle.require_active().structures }
                .structure(ResourceKey { game_id, entity_id: command.to_entity_id })
                .expect('missing recipient structure');
            assert!(
                crate::geometry::adjacent(explorer.coord, crate::structures::structure_coord(structure.base)),
                "explorer and structure are not adjacent",
            );
            for resource in command.resources {
                if crate::resources::is_troop_resource(*resource.resource_type) {
                    let owner = self.structure_owner(ResourceKey { game_id, entity_id: explorer.owner });
                    assert!(
                        owner != 0.try_into().unwrap() && owner == structure.owner,
                        "reinforcement requires target ownership",
                    );
                    break;
                }
            }
            self.transfer_instant(game_id, command, context.timestamp);
        }
        fn offload_arrival(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: OffloadArrival,
            context: ExecutionContext,
        ) {
            self.assert_resource_command(game_id, context.timestamp);
            let entity = ResourceKey { game_id, entity_id: command.entity_id };
            assert!(command.entity_id != 0, "missing destination structure");
            assert!(self.structure_owner(entity) == actor, "actor does not own structure");
            self.assert_deposits_unlocked(entity, context.timestamp);
            assert!(command.resource_count != 0, "resource count is zero");
            let key = ArrivalKey { game_id, entity_id: command.entity_id, day: command.day, slot: command.slot };
            let rules = self.game_dispatcher().rules(game_id);
            assert!(
                has_arrived(key, rules.tick_config.delivery_tick_in_seconds, context.timestamp),
                "resources have not arrived",
            );
            let arrival = self.arrivals.read(key);
            let count = core::cmp::min(command.resource_count.into(), arrival.resources.len());
            let delivered = arrival.resources.slice(0, count);
            let start_at = self.production_start(game_id);
            for resource in delivered {
                let rule = self.rule(game_id, *resource.resource_type);
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
                self
                    .emit_resource_story(
                        entity,
                        actor,
                        Story::ResourceReceiveArrivalStory(
                            crate::ownership::ResourceAmountsStory { resources: delivered },
                        ),
                        context.timestamp,
                    );
            }
        }
        fn burn_structure_resources(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::resources::ResourceBurn,
            context: ExecutionContext,
        ) {
            self.assert_resource_command(game_id, context.timestamp);
            let key = ResourceKey { game_id, entity_id: command.entity_id };
            assert!(self.structure_owner(key) == actor, "actor does not own structure");
            crate::resources::assert_unique_resources(command.resources);
            self.burn(key, command.resources);
            self
                .emit_resource_story(
                    key,
                    actor,
                    Story::ResourceBurnStory(crate::ownership::ResourceAmountsStory { resources: command.resources }),
                    context.timestamp,
                );
        }
        fn transfer_explorer_resources(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::resources::ResourceTransfer,
            context: ExecutionContext,
        ) {
            self.assert_resource_command(game_id, context.timestamp);
            assert!(command.from_entity_id != 0 && command.to_entity_id != 0, "missing explorer id");
            let from = self
                .troops_dispatcher()
                .authorized_explorer(
                    ExplorerKey { game_id, explorer_id: command.from_entity_id }, actor, context.timestamp,
                );
            let to = self
                .troops_dispatcher()
                .active_explorer(ExplorerKey { game_id, explorer_id: command.to_entity_id }, context.timestamp);
            assert!(to.owner != 0, "recipient explorer has no owner");
            assert!(crate::geometry::adjacent(from.coord, to.coord), "explorers are not adjacent");
            self.transfer_instant(game_id, command, context.timestamp);
        }
        fn transfer_structure_resources_to_explorer(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::resources::ResourceTransfer,
            context: ExecutionContext,
        ) {
            self.assert_resource_command(game_id, context.timestamp);
            assert!(command.from_entity_id != 0 && command.to_entity_id != 0, "missing transfer entity");
            let from_key = ResourceKey { game_id, entity_id: command.from_entity_id };
            assert!(self.structure_owner(from_key) == actor, "actor does not own structure");
            let from = IStructuresDispatcher { contract_address: self.lifecycle.require_active().structures }
                .structure(from_key)
                .expect('missing sending structure');
            let to = self
                .troops_dispatcher()
                .active_explorer(ExplorerKey { game_id, explorer_id: command.to_entity_id }, context.timestamp);
            assert!(
                crate::geometry::adjacent(crate::structures::structure_coord(from.base), to.coord),
                "structure and explorer are not adjacent",
            );
            for resource in command.resources {
                assert!(
                    !crate::resources::is_troop_resource(*resource.resource_type), "cannot transfer troop resource",
                );
            }
            self.transfer_instant(game_id, command, context.timestamp);
        }
    }
    #[generate_trait]
    impl Internal of InternalTrait {
        fn assert_production_command(
            self: @ContractState, game_id: u32, actor: ContractAddress, command: RefillProduction, timestamp: u64,
        ) -> ResourceKey {
            let peers = self.lifecycle.require_active();
            assert!(get_caller_address() == peers.season, "only authenticated command domain");
            assert_playing(self.game_dispatcher().game(game_id), timestamp);
            let key = ResourceKey { game_id, entity_id: command.structure_id };
            let structure = IStructuresDispatcher { contract_address: peers.structures }
                .structure(key)
                .expect('missing producer structure');
            assert!(structure.owner == actor, "actor does not own structure");
            assert!(
                structure.base.category == 1 || structure.base.category == 5 || structure.base.category == 7,
                "structure cannot produce resources",
            );
            assert!(command.resource_types.len() == command.amounts.len(), "production input lengths differ");
            key
        }
        fn refill_from_recipes(
            ref self: ContractState, key: ResourceKey, command: RefillProduction, complex: bool, timestamp: u64,
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
                    self.spend(key, *input.resource_type, amount, timestamp);
                    costs.append(crate::resources::ResourceAmount { resource_type: *input.resource_type, amount });
                }
                let output = Into::<u64, u128>::into(per_cycle) * cycles;
                assert!(output != 0, "zero production output");
                self.refill_output(key, resource_type, output, costs.span(), timestamp);
            }
        }
        fn refill_output(
            ref self: ContractState,
            key: ResourceKey,
            resource_type: u8,
            output: u128,
            costs: Span<crate::resources::ResourceAmount>,
            timestamp: u64,
        ) {
            let tick: u32 = (timestamp / self.game_dispatcher().rules(key.game_id).tick_config.armies_tick_in_seconds)
                .try_into()
                .unwrap();
            let output = crate::production::bonus_output(self.production.bonus(key), resource_type, output, tick);
            self
                .resources
                .refill_production(
                    key,
                    resource_type,
                    output,
                    self.rule(key.game_id, resource_type).unit_weight,
                    timestamp.try_into().unwrap(),
                    self.production_start(key.game_id),
                );
            self
                .emit_resource_story(
                    key,
                    self.structure_owner(key),
                    Story::ProductionStory(
                        crate::ownership::ProductionStory {
                            received_resource_type: resource_type, received_amount: output, cost: costs,
                        },
                    ),
                    timestamp,
                );
        }
        fn assert_resource_settlement_domain(self: @ContractState) {
            let peers = self.lifecycle.require_active();
            let caller = get_caller_address();
            assert!(
                caller == peers.structures
                    || caller == peers.economy
                    || caller == peers.troops
                    || caller == peers.combat
                    || caller == peers.bridge
                    || caller == peers.prizes,
                "only resource settlement domain",
            );
        }
        fn assert_structures(self: @ContractState) {
            assert!(get_caller_address() == self.lifecycle.require_active().structures, "only structures domain");
        }
        fn assert_troops(self: @ContractState) {
            assert!(get_caller_address() == self.lifecycle.require_active().troops, "only troops domain");
        }
        fn assert_resource_command(self: @ContractState, game_id: u32, timestamp: u64) {
            assert!(
                get_caller_address() == self.lifecycle.require_active().season, "only authenticated command domain",
            );
            crate::game::assert_main_with_grace(self.game_dispatcher().game(game_id), timestamp);
        }
        fn production_start(self: @ContractState, game_id: u32) -> u32 {
            let games = self.game_dispatcher();
            if crate::rules::rule_enabled(games.rules(game_id), crate::rules::PRODUCTION_START) {
                games.game(game_id).start_main_at.try_into().unwrap()
            } else {
                0
            }
        }
        fn game_dispatcher(self: @ContractState) -> IGameDispatcher {
            IGameDispatcher { contract_address: self.lifecycle.require_active().registry }
        }
        #[inline(never)]
        fn structure_owner(self: @ContractState, key: ResourceKey) -> ContractAddress {
            IStructuresDispatcher { contract_address: self.lifecycle.require_active().structures }.structure_owner(key)
        }
        #[inline(never)]
        fn rule(self: @ContractState, game_id: u32, resource_type: u8) -> ResourceRule {
            assert!(self.resources_configured.read(game_id), "missing resource rules");
            assert!(resource_type > 0 && resource_type <= 58, "invalid resource type");
            let (unit_weight, rates) = self.resource_rules.read((game_id, resource_type));
            ResourceRule {
                resource_type,
                unit_weight,
                realm_rate: (rates % RATE_WORD_SCALE).try_into().unwrap(),
                village_rate: (rates / RATE_WORD_SCALE).try_into().unwrap(),
            }
        }
        fn assert_deposits_unlocked(self: @ContractState, key: ResourceKey, timestamp: u64) {
            let structure = IStructuresDispatcher { contract_address: self.lifecycle.require_active().structures }
                .structure(key)
                .expect('missing destination structure');
            if structure.base.category != crate::ownership::VILLAGE_CATEGORY {
                return;
            }
            let rules = self.game_dispatcher().rules(key.game_id);
            let game = self.game_dispatcher().game(key.game_id);
            let interval = rules.tick_config.armies_tick_in_seconds;
            let now = timestamp / interval;
            let season_end = game.start_main_at / interval + rules.battle_config.regular_immunity_ticks.into();
            let village_end = structure.base.created_at.into() / interval
                + rules.battle_config.village_immunity_ticks.into();
            assert!(now >= season_end && now >= village_end, "village cannot claim deposits during spawn immunity");
        }
        fn troops_dispatcher(self: @ContractState) -> ITroopsDispatcher {
            ITroopsDispatcher { contract_address: self.lifecycle.require_active().troops }
        }
        fn burn(ref self: ContractState, key: ResourceKey, resources: Span<crate::resources::ResourceAmount>) {
            for resource in resources {
                let rule = self.rule(key.game_id, *resource.resource_type);
                self.resources.burn_resource(key, *resource.resource_type, *resource.amount, rule.unit_weight);
            }
        }
        fn transfer_delayed(
            ref self: ContractState, game_id: u32, command: crate::resources::ResourceTransfer, timestamp: u64,
        ) {
            assert!(command.from_entity_id != 0 && command.to_entity_id != 0, "missing transfer structure");
            assert!(command.from_entity_id != command.to_entity_id, "self transfer");
            assert!(!command.resources.is_empty(), "no resource to transfer");
            let structures = IStructuresDispatcher { contract_address: self.lifecycle.require_active().structures };
            let from = ResourceKey { game_id, entity_id: command.from_entity_id };
            let to = ResourceKey { game_id, entity_id: command.to_entity_id };
            let source = structures.structure(from).expect('missing sending structure');
            let destination = structures.structure(to).expect('missing recipient structure');
            let rules = self.game_dispatcher().rules(game_id);
            assert!(
                !crate::rules::rule_enabled(rules, crate::rules::SAME_OWNER_TRANSFER)
                    || source.owner == destination.owner,
                "transfers require the same owner",
            );
            let travel_time = crate::transport::travel_time(
                crate::structures::structure_coord(source.base),
                crate::structures::structure_coord(destination.base),
                command.resources,
                rules.speed_config,
                false,
            );
            let weight = self.spend_shipment(from, command.resources, timestamp);
            let donkeys = crate::transport::donkeys_needed(weight, rules.capacity_config.donkey_capacity.into());
            self.spend(from, crate::transport::DONKEY, donkeys, timestamp);
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
            self.emit_resource_story(from, source.owner, story, timestamp);
            self.emit_resource_story(to, destination.owner, story, timestamp);
        }
        fn spend_shipment(
            ref self: ContractState,
            from: ResourceKey,
            resources: Span<crate::resources::ResourceAmount>,
            timestamp: u64,
        ) -> u128 {
            let mut weight = 0;
            let start_at = self.production_start(from.game_id);
            for resource in resources {
                let rule = self.rule(from.game_id, *resource.resource_type);
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
            ref self: ContractState, game_id: u32, command: crate::resources::ResourceTransfer, timestamp: u64,
        ) {
            crate::resources::assert_unique_resources(command.resources);
            let from = ResourceKey { game_id, entity_id: command.from_entity_id };
            let to = ResourceKey { game_id, entity_id: command.to_entity_id };
            let start_at = self.production_start(game_id);
            for resource in command.resources {
                let rule = self.rule(game_id, *resource.resource_type);
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
            let recipient = self.structure_owner(to);
            self
                .emit_resource_story(
                    to,
                    recipient,
                    Story::ResourceTransferStory(
                        crate::ownership::ResourceTransferStory {
                            transfer_type: crate::ownership::TransferType::Instant,
                            from_entity_id: from.entity_id,
                            from_entity_owner_address: self.structure_owner(from),
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
        fn spend(ref self: ContractState, key: ResourceKey, resource_type: u8, amount: u128, timestamp: u64) {
            let rule = self.rule(key.game_id, resource_type);
            self
                .resources
                .spend_resource(
                    key,
                    resource_type,
                    amount,
                    rule.unit_weight,
                    timestamp.try_into().unwrap(),
                    self.production_start(key.game_id),
                );
        }
        fn emit_resource_story(
            ref self: ContractState, key: ResourceKey, actor: ContractAddress, story: Story, timestamp: u64,
        ) {
            self
                .emit(
                    StoryEvent {
                        version: 1,
                        game_id: key.game_id,
                        id: self.game_dispatcher().allocate_entity(key.game_id),
                        owner: Some(actor),
                        entity_id: Some(key.entity_id),
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story,
                        timestamp,
                    },
                );
        }
    }
}
