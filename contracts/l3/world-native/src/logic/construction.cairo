#[starknet::contract]
pub mod ConstructionLogic {
    use starknet::ContractAddress;
    use starknet::storage::{StorageMapReadAccess, StoragePathEntry, StoragePointerReadAccess};
    use crate::buildings::{Building, BuildingKey};
    use crate::events::RowSet;
    use crate::game::assert_playing;
    use crate::logic::buildings::BuildingState;
    use crate::logic::release::ReleaseState;
    use crate::logic::structures::StructureState;
    use crate::ownership::{Story, StoryEvent};
    use crate::resources::{IResourceOperationsDispatcherTrait, IResourceOperationsLibraryDispatcher, ResourceKey};
    use crate::rules::RESOURCE_PRECISION;
    use crate::structures::StructureBase;
    use crate::troops::Coord;
    component!(path: BuildingState, storage: buildings, event: BuildingEvent);
    impl BuildingInternal = BuildingState::InternalImpl<ContractState>;
    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    impl LifeInternal = ReleaseState::InternalImpl<ContractState>;
    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[flat]
        pub data: crate::state::Storage,
        #[substorage(v0)]
        release: ReleaseState::Storage,
        #[substorage(v0)]
        buildings: BuildingState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        ReleaseEvent: ReleaseState::Event,
        StructureEvent: StructureState::Event,
        BuildingEvent: BuildingState::Event,
        StoryEvent: StoryEvent,
        RowSet: RowSet,
    }
    #[cfg(test)]
    pub fn observed_board_rules(game_id: u32) -> Option<crate::buildings::BoardRules> {
        let state = contract_state_for_testing();
        state.buildings.board(game_id)
    }

    #[abi(embed_v0)]
    impl BuildingRules of crate::buildings::IBuildingRules<ContractState> {
        #[cfg(test)]
        fn building_rule(
            self: @ContractState, key: crate::buildings::BuildingRuleKey,
        ) -> crate::buildings::BuildingRule {
            self.buildings.rule(key)
        }
    }

    #[abi(embed_v0)]
    impl BuildingCommands of crate::buildings::IBuildingCommands<ContractState> {
        fn upgrade_building(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::buildings::ChangeBuilding,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);
            let key = ResourceKey { game_id, entity_id: command.structure_id };
            let base = self.assert_building_command(key, actor, context.timestamp, context);
            assert!(self.buildings.board(game_id).is_some(), "building tiers require a board");
            let location = crate::logic::buildings::building_key(key, command.coord);
            let mut building = self.buildings.building(location).expect('missing building');
            let next = building.tier + 1;
            assert!(
                next <= crate::logic::research::building_tier(key, building.category),
                "building tier is not researched",
            );
            let rule = crate::logic::research::tier_rule(game_id, building.category, next);
            let before = self.board_effects(key, base, command.coord, context);
            self
                .pay_tier_labor(
                    key, actor, command.coord, building.category, rule.labor_upgrade_cost, context, ref story_cursor,
                );
            building.tier = next;
            building.labor_paid += rule.labor_upgrade_cost;
            self.buildings.write_building(location, building);
            self
                .buildings
                .apply_board_effects(
                    key, before, self.board_effects(key, base, command.coord, context), context.timestamp, context,
                );
            ((), story_cursor)
        }

        fn create_building(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::buildings::CreateBuilding,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            let key = ResourceKey { game_id, entity_id: command.structure_id };
            let base = self.assert_building_command(key, actor, context.timestamp, context);
            let coord = self.resolve_building_coord(game_id, base, command.directions);
            let location = crate::logic::buildings::building_key(key, coord);
            let rule = self.buildings.rule(crate::buildings::BuildingRuleKey { game_id, category: command.category });
            let before = self.board_effects(key, base, coord, context);
            self
                .erect_building(
                    key,
                    actor,
                    base,
                    location,
                    coord,
                    command.category,
                    rule,
                    context.timestamp,
                    context,
                    ref story_cursor,
                );
            self
                .buildings
                .apply_board_effects(
                    key, before, self.board_effects(key, base, coord, context), context.timestamp, context,
                );
            let mut count = crate::buildings::category_count(
                self.buildings.data.buildings.structure_buildings.read((game_id, command.structure_id)),
                command.category,
            );
            if self.buildings.board(game_id).is_some() && command.category == 25 {
                count -= 1;
            }
            let costs = if command.use_simple {
                rule.simple_cost
            } else {
                rule.complex_cost
            };
            let labor_paid = self
                .pay_building_costs(
                    key,
                    actor,
                    coord,
                    command.category,
                    count,
                    costs,
                    context.rules.unbox().building_config.base_cost_percent_increase,
                    context.timestamp,
                    context,
                    ref story_cursor,
                );
            if self.buildings.board(game_id).is_some() {
                let mut building = self.buildings.building(location).unwrap();
                let mut upgrades = 0;
                for tier in 2..building.tier + 1 {
                    upgrades += crate::logic::research::tier_rule(game_id, building.category, tier).labor_upgrade_cost;
                }
                self.pay_tier_labor(key, actor, coord, building.category, upgrades, context, ref story_cursor);
                building.labor_paid = labor_paid + upgrades;
                self.buildings.write_building(location, building);
            }
            ((), story_cursor)
        }
        fn destroy_building(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::buildings::ChangeBuilding,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            let key = ResourceKey { game_id, entity_id: command.structure_id };
            let base = self.assert_building_command(key, actor, context.timestamp, context);
            let location = crate::logic::buildings::building_key(key, command.coord);
            let building = self.buildings.building(location).expect('missing building');
            let board = self.buildings.board(game_id);
            assert!(
                building.category != 25 || (board.is_some() && (command.coord.x != 10 || command.coord.y != 10)),
                "cannot destroy labor building",
            );
            let before = self.board_effects(key, base, command.coord, context);
            if board.is_none() && !building.paused {
                self
                    .change_building_production(
                        key, building.category, base.category, false, context.timestamp, context,
                    );
            }
            if board.is_none() {
                self.change_building_capacity(key, building.category, false, context);
            }
            let rule = self.buildings.rule(crate::buildings::BuildingRuleKey { game_id, category: building.category });
            self.buildings.remove(location, building, rule, context.rules.unbox().building_config.base_population);
            self
                .buildings
                .apply_board_effects(
                    key, before, self.board_effects(key, base, command.coord, context), context.timestamp, context,
                );
            if let Some(board) = board {
                let refund = crate::math::PercentageImpl::get(building.labor_paid, board.demolition_refund_bps.into());
                self
                    .resources_dispatcher(game_id)
                    .grant_resource(key, 23, refund, context.timestamp, crate::commands::resource_context(context));
            }
            self
                .emit_building_change(
                    key,
                    actor,
                    command.coord,
                    building.category,
                    crate::ownership::BuildingChange::Destroyed,
                    context.timestamp,
                    ref story_cursor,
                );
            ((), story_cursor)
        }
        fn pause_building_production(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::buildings::ChangeBuilding,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            self.set_building_paused(game_id, actor, command, true, context.timestamp, context, ref story_cursor);
            ((), story_cursor)
        }
        fn resume_building_production(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::buildings::ChangeBuilding,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            self.set_building_paused(game_id, actor, command, false, context.timestamp, context, ref story_cursor);
            ((), story_cursor)
        }
    }

    #[abi(embed_v0)]
    impl ResearchCommands of crate::research::IResearch<ContractState> {
        fn research(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::research::Research,
            context: crate::commands::ActionContext,
            story_cursor: crate::ownership::StoryCursor,
        ) {
            let context = crate::commands::load_context(game_id, context);
            let key = ResourceKey { game_id, entity_id: command.structure_id };
            let base = self.assert_building_command(key, actor, context.timestamp, context);
            assert!(base.category == 1 && self.buildings.board(game_id).is_some(), "research requires a realm board");
            let mut knowledge = crate::logic::research::require(key);
            let rule = crate::logic::research::node(game_id, command.node);
            let bit = crate::research::node_bit(command.node);
            assert!(knowledge.learned & bit == 0, "research already learned");
            assert!(knowledge.learned & rule.prerequisites == rule.prerequisites, "research prerequisite missing");
            self
                .spend(
                    key,
                    crate::resources::ESSENCE,
                    rule.essence_cost,
                    context.timestamp,
                    crate::commands::resource_context(context),
                );
            knowledge.learned = knowledge.learned | bit;
            crate::logic::research::write(key, knowledge);
        }
        fn realm_knowledge(self: @ContractState, key: ResourceKey) -> Option<crate::research::RealmKnowledge> {
            crate::logic::research::knowledge(key)
        }
        #[cfg(test)]
        fn research_node(self: @ContractState, game_id: u32, node: u8) -> crate::research::ResearchNode {
            crate::logic::research::node(game_id, node)
        }
        #[cfg(test)]
        fn building_tier_rule(
            self: @ContractState, game_id: u32, category: u8, tier: u8,
        ) -> crate::research::BuildingTierRule {
            crate::logic::research::tier_rule(game_id, category, tier)
        }
    }

    #[inline(never)]
    #[abi(embed_v0)]
    impl Upgrades of crate::upgrades::IStructureUpgrades<ContractState> {
        fn level_up(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            structure_id: u32,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            assert_playing(context.game.unbox(), context.timestamp);
            let key = ResourceKey { game_id, entity_id: structure_id };
            let record = crate::logic::structures::record(key);
            assert!(record.owner == actor, "actor does not own structure");
            assert!(record.base.category == 1 || record.base.category == 5, "structure is not a realm or village");
            let limits = crate::logic::upgrades::limits(game_id);
            let maximum = if record.base.category == 1 {
                limits.realm_max
            } else {
                limits.village_max
            };
            assert!(record.base.level < maximum, "structure is already at max level");
            let next_level = record.base.level + 1;
            for cost in crate::logic::upgrades::recipe(game_id, next_level).costs {
                self
                    .spend(
                        key,
                        *cost.resource_type,
                        *cost.amount,
                        context.timestamp,
                        crate::commands::resource_context(context),
                    );
            }
            crate::logic::structures::StructureState::upgrade(
                key, record.base, context.rules.unbox().troop_limit_config,
            );
            if record.base.category == 1 && context.rules.unbox().epoch_seconds == 0 {
                let coord = crate::structures::structure_coord(key);
                crate::logic::map::MapState::upgrade_realm(
                    crate::map::TileKey { game_id, alt: coord.alt, col: coord.x, row: coord.y },
                    structure_id,
                    record.metadata.has_wonder,
                    next_level,
                );
            }
            self.emit_structure_upgrade(key, actor, next_level, context.timestamp, ref story_cursor);
            ((), story_cursor)
        }
    }
    #[generate_trait]
    impl Internal of InternalTrait {
        fn emit_structure_upgrade(
            ref self: ContractState,
            key: ResourceKey,
            actor: ContractAddress,
            next_level: u8,
            timestamp: u64,
            ref story_cursor: crate::ownership::StoryCursor,
        ) {
            self
                .emit(
                    StoryEvent {
                        version: 1,
                        game_id: key.game_id,
                        order: story_cursor.order,
                        index: crate::ownership::StoryCursorTrait::next(ref story_cursor),
                        owner: Some(actor),
                        entity_id: Some(key.entity_id),
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: Story::StructureLevelUpStory(
                            crate::ownership::StructureLevelUpStory { new_level: next_level },
                        ),
                        timestamp,
                    },
                );
        }
        fn erect_building(
            ref self: ContractState,
            key: ResourceKey,
            actor: ContractAddress,
            base: StructureBase,
            location: BuildingKey,
            coord: Coord,
            category: u8,
            rule: crate::buildings::BuildingRule,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
            ref story_cursor: crate::ownership::StoryCursor,
        ) {
            let tier = if self.buildings.board(key.game_id).is_some() {
                crate::logic::research::building_tier(key, category)
            } else {
                1
            };
            let building = Building { category, paused: false, labor_paid: 0, tier };
            let rules = game_context.rules.unbox();
            self
                .buildings
                .create(
                    location,
                    building,
                    rule.population_cost,
                    rule.capacity_grant,
                    rules.building_config.base_population,
                );
            if self.buildings.board(key.game_id).is_none() {
                self.change_building_production(key, building.category, base.category, true, timestamp, game_context);
                self.change_building_capacity(key, building.category, true, game_context);
            }
            self.assert_structure_produces(key, building.category);
            self
                .emit_building_change(
                    key,
                    actor,
                    coord,
                    building.category,
                    crate::ownership::BuildingChange::Created,
                    timestamp,
                    ref story_cursor,
                );
        }
        fn resolve_building_coord(
            self: @ContractState, game_id: u32, base: StructureBase, directions: Span<u8>,
        ) -> Coord {
            let limits = crate::logic::upgrades::limits(game_id);
            let maximum = match base.category {
                1 => limits.realm_max,
                5 => limits.village_max,
                _ => 0,
            };
            assert!(!directions.is_empty(), "building path is empty");
            assert!(directions.len() <= Into::<u8, u32>::into(maximum) + 1, "building outside maximum level");
            assert!(directions.len() <= Into::<u8, u32>::into(base.level) + 1, "building outside current level");
            let mut coord = Coord { alt: false, x: 10, y: 10 };
            for direction in directions {
                coord = crate::geometry::neighbor(coord, *direction);
            }
            coord
        }
        fn assert_building_command(
            self: @ContractState,
            key: ResourceKey,
            actor: ContractAddress,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) -> StructureBase {
            assert_playing(game_context.game.unbox(), timestamp);
            assert!(crate::logic::structures::owner(key) == actor, "actor does not own structure");
            let base = self.data.structures.structures.entry((key.game_id, key.entity_id)).base.read();
            assert!(
                base.category == 1 || base.category == 5 || base.category == 7, "structure does not support production",
            );
            base
        }

        fn assert_structure_produces(self: @ContractState, key: ResourceKey, category: u8) {
            if category == 25 && self.buildings.board(key.game_id).is_some() {
                return;
            }
            let resources = self.data.structures.structures.entry((key.game_id, key.entity_id)).resources_packed.read();
            assert!(crate::buildings::can_produce(category, resources), "structure cannot produce building resource");
        }
        fn board_effects(
            self: @ContractState,
            key: ResourceKey,
            base: StructureBase,
            coord: Coord,
            game_context: crate::commands::ExecutionContext,
        ) -> Span<crate::buildings::BuildingEffect> {
            let Some(board) = self.buildings.board(key.game_id) else {
                return array![].span();
            };
            array![self.buildings.building_effect(key, base, coord, board, game_context)].span()
        }

        fn change_building_production(
            ref self: ContractState,
            key: ResourceKey,
            category: u8,
            structure_category: u8,
            enabled: bool,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) {
            let resource_type = crate::buildings::produced_resource(category);
            if resource_type == 0 {
                return;
            }
            let resources = self.resources_dispatcher(key.game_id);
            let rule = crate::logic::resources::rule(key.game_id, resource_type);
            let rate = if structure_category == 1 {
                rule.realm_rate
            } else {
                rule.village_rate
            };
            if enabled {
                assert!(rate != 0, "resource cannot be produced");
                resources
                    .start_production(
                        key, resource_type, rate, 0, timestamp, crate::commands::resource_context(game_context),
                    );
            } else {
                resources
                    .stop_production(
                        key, resource_type, rate, timestamp, crate::commands::resource_context(game_context),
                    );
            }
        }
        fn change_building_capacity(
            ref self: ContractState,
            key: ResourceKey,
            category: u8,
            adding: bool,
            game_context: crate::commands::ExecutionContext,
        ) {
            if category != 2 {
                return;
            }
            let amount = Into::<u32, u128>::into(game_context.rules.unbox().capacity_config.storehouse_boost_capacity)
                * RESOURCE_PRECISION;
            self.resources_dispatcher(key.game_id).change_structure_capacity(key, amount, adding);
        }
        fn set_building_paused(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::buildings::ChangeBuilding,
            paused: bool,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
            ref story_cursor: crate::ownership::StoryCursor,
        ) {
            let key = ResourceKey { game_id, entity_id: command.structure_id };
            let base = self.assert_building_command(key, actor, timestamp, game_context);
            let location = crate::logic::buildings::building_key(key, command.coord);
            let mut building = self.buildings.building(location).expect('missing building');
            assert!(building.paused != paused, "building already in requested state");
            let before = self.board_effects(key, base, command.coord, game_context);
            if self.buildings.board(game_id).is_none() {
                self
                    .change_building_production(
                        key, building.category, base.category, !paused, timestamp, game_context,
                    );
            }
            building.paused = paused;
            self.buildings.write_building(location, building);
            self
                .buildings
                .apply_board_effects(
                    key, before, self.board_effects(key, base, command.coord, game_context), timestamp, game_context,
                );
            let change = if paused {
                crate::ownership::BuildingChange::Paused
            } else {
                crate::ownership::BuildingChange::Resumed
            };
            self
                .emit_building_change(
                    key, actor, command.coord, building.category, change, timestamp, ref story_cursor,
                );
        }
        fn emit_building_change(
            ref self: ContractState,
            key: ResourceKey,
            actor: ContractAddress,
            coord: Coord,
            category: u8,
            change: crate::ownership::BuildingChange,
            timestamp: u64,
            ref story_cursor: crate::ownership::StoryCursor,
        ) {
            crate::logic::stories::emit_entity_story(
                key,
                actor,
                Story::BuildingPlacementStory(crate::ownership::BuildingPlacementStory { coord, category, change }),
                timestamp,
                ref story_cursor,
            );
        }
        fn pay_building_costs(
            ref self: ContractState,
            key: ResourceKey,
            actor: ContractAddress,
            coord: Coord,
            category: u8,
            count: u8,
            costs: Span<crate::resources::ResourceAmount>,
            increase: u16,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
            ref story_cursor: crate::ownership::StoryCursor,
        ) -> u128 {
            assert!(!costs.is_empty(), "missing building erection cost");
            let scale: u128 = (count - 1).into();
            let mut paid = array![];
            let mut labor_paid = 0;
            for cost in costs {
                let amount = *cost.amount
                    + scale * scale * crate::math::PercentageImpl::get(*cost.amount, increase.into());
                assert!(amount != 0, "zero building erection cost");
                self
                    .spend(
                        key, *cost.resource_type, amount, timestamp, crate::commands::resource_context(game_context),
                    );
                if *cost.resource_type == 23 {
                    labor_paid += amount;
                }
                paid.append(crate::resources::ResourceAmount { resource_type: *cost.resource_type, amount });
            }
            crate::logic::stories::emit_entity_story(
                key,
                actor,
                Story::BuildingPaymentStory(
                    crate::ownership::BuildingPaymentStory { coord, category, cost: paid.span() },
                ),
                timestamp,
                ref story_cursor,
            );
            labor_paid
        }

        fn pay_tier_labor(
            ref self: ContractState,
            key: ResourceKey,
            actor: ContractAddress,
            coord: Coord,
            category: u8,
            amount: u128,
            context: crate::commands::ExecutionContext,
            ref story_cursor: crate::ownership::StoryCursor,
        ) {
            if amount == 0 {
                return;
            }
            self
                .spend(
                    key, crate::resources::LABOR, amount, context.timestamp, crate::commands::resource_context(context),
                );
            crate::logic::stories::emit_entity_story(
                key,
                actor,
                Story::BuildingPaymentStory(
                    crate::ownership::BuildingPaymentStory {
                        coord,
                        category,
                        cost: array![
                            crate::resources::ResourceAmount { resource_type: crate::resources::LABOR, amount },
                        ]
                            .span(),
                    },
                ),
                context.timestamp,
                ref story_cursor,
            );
        }

        fn resources_dispatcher(self: @ContractState, game_id: u32) -> IResourceOperationsLibraryDispatcher {
            IResourceOperationsLibraryDispatcher { class_hash: self.release.classes(game_id).resources.read() }
        }
        fn spend(
            ref self: ContractState,
            key: ResourceKey,
            resource_type: u8,
            amount: u128,
            timestamp: u64,
            game_context: crate::commands::ResourceContext,
        ) {
            self.resources_dispatcher(key.game_id).spend_resource(key, resource_type, amount, timestamp, game_context);
        }
    }
}
