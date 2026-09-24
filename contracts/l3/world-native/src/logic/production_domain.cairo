#[starknet::contract]
pub mod ProductionLogic {
    use starknet::ContractAddress;
    use starknet::storage::StorageMapWriteAccess;
    use crate::commands::ExecutionContext;
    use crate::events::RowSet;
    use crate::game::assert_playing;
    use crate::logic::arrivals::ArrivalState;
    use crate::logic::production::ProductionState;
    use crate::logic::release::ReleaseState;
    use crate::logic::resources::ResourceState;
    use crate::ownership::{Story, StoryEvent};
    #[cfg(test)]
    use crate::production::{ProductionBonus, ProductionRecipe};
    use crate::production::{RecipeConfig, RecipeKey, RefillProduction};
    use crate::resources::ResourceKey;

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
    impl MineRules of crate::mines::IMineRules<ContractState> {
        fn configure_mines(
            ref self: ContractState,
            game_id: u32,
            kinds: Span<crate::mines::MineKindEntry>,
            surface: Span<crate::mines::MineWeight>,
        ) {
            crate::logic::release::assert_authority();
            let _ = crate::logic::game::game(game_id);
            self.mines.configure(game_id, kinds, surface);
        }
        #[cfg(test)]
        fn mine_kind(self: @ContractState, key: crate::mines::MineKindKey) -> crate::mines::MineKindConfig {
            self.mines.kind(key)
        }
        #[cfg(test)]
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
            ref self: ContractState, key: ResourceKey, relic_id: u8, rule: crate::relics::RelicRule, timestamp: u64,
        ) {
            crate::commands::assert_context_time(timestamp);
            let rules = crate::logic::game::rules(key.game_id);
            let mut bonus = self.production.bonus(key);
            crate::relics::boost_production(
                ref bonus, relic_id, rule, (timestamp / rules.tick_config.armies_tick_in_seconds).try_into().unwrap(),
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
        fn configure_production(ref self: ContractState, game_id: u32, recipes: Span<RecipeConfig>) {
            crate::logic::release::assert_authority();
            let _ = crate::logic::game::game(game_id);
            self.production.configure(game_id, recipes);
        }
        #[cfg(test)]
        fn production_recipe(self: @ContractState, key: RecipeKey) -> ProductionRecipe {
            self.production.recipe(key)
        }
        #[cfg(test)]
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

    #[generate_trait]
    impl Internal of InternalTrait {
        fn assert_production_command(
            self: @ContractState, game_id: u32, actor: ContractAddress, command: RefillProduction, timestamp: u64,
        ) -> ResourceKey {
            assert_playing(crate::logic::game::game(game_id), timestamp);
            let key = ResourceKey { game_id, entity_id: command.structure_id };
            let structure = crate::logic::structures::structure(key).expect('missing producer structure');
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
                    self.resources.spend(key, *input.resource_type, amount, timestamp);
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
            let tick: u32 = (timestamp / crate::logic::game::rules(key.game_id).tick_config.armies_tick_in_seconds)
                .try_into()
                .unwrap();
            let output = crate::production::bonus_output(self.production.bonus(key), resource_type, output, tick);
            self
                .resources
                .refill_production(
                    key,
                    resource_type,
                    output,
                    crate::logic::resources::rule(key.game_id, resource_type).unit_weight,
                    timestamp.try_into().unwrap(),
                    crate::logic::resources::production_start(key.game_id),
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
}
