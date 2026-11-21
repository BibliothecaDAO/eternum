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
    use crate::map::TileKey;
    use crate::ownership::{Story, StoryEvent};
    use crate::resources::{IResourceOperationsDispatcherTrait, IResourceOperationsLibraryDispatcher, ResourceKey};
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

    #[abi(embed_v0)]
    impl BuildingRules of crate::buildings::IBuildingRules<ContractState> {
        #[cfg(feature: "test_support")]
        fn building_rule(
            self: @ContractState, key: crate::buildings::BuildingRuleKey,
        ) -> crate::buildings::BuildingRule {
            self.buildings.rule(key)
        }
    }

    #[abi(embed_v0)]
    impl FrontierDiscovery of crate::expeditions::IFrontierDiscovery<ContractState> {
        fn expedition_discovery(
            self: @ContractState, key: crate::expeditions::ExpeditionDiscoveryKey,
        ) -> Option<crate::expeditions::ExpeditionDiscovery> {
            crate::logic::expeditions::discovery(key)
        }
    }
    #[abi(embed_v0)]
    impl ExpeditionReveal of crate::discovery::IExpeditionReveal<ContractState> {
        fn reveal_expedition_tile(
            ref self: ContractState,
            key: TileKey,
            explorer_id: u64,
            seed: u256,
            context: crate::commands::ActionContext,
        ) -> crate::discovery::Discovery {
            crate::logic::discovery::reveal(key, explorer_id, seed, context)
        }
    }
    #[abi(embed_v0)]
    impl BuildingCommands of crate::buildings::IBuildingCommands<ContractState> {
        fn create_building(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::buildings::CreateBuilding,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::execution_context(game_id, context);

            let key = ResourceKey { game_id, entity_id: command.structure_id };
            let base = self.assert_building_command(key, actor, context.timestamp, context);
            let coord = self.resolve_building_coord(game_id, base, command.directions);
            let location = crate::logic::buildings::building_key(key, coord);
            let rule = self.buildings.rule(crate::buildings::BuildingRuleKey { game_id, category: command.category });
            let board = crate::logic::buildings::board();
            self.assert_board_category(key, command.category, board);
            self.erect_building(key, actor, base, location, coord, command.category, rule, context.timestamp, context);
            self.change_board_building(key, base, command.category, board, true, context);
            let mut count = crate::buildings::category_count(
                self.buildings.data.buildings.structure_buildings.read((game_id, command.structure_id)),
                command.category,
            );
            if command.category == crate::research::WORKSHOP {
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
                );
            let building = self.buildings.building(location).unwrap();
            self.buildings.write_building(location, Building { labor_paid, ..building });
            self.grant_training_start(key, base, command.category, board, context);
            ()
        }
        fn destroy_building(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::buildings::ChangeBuilding,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::execution_context(game_id, context);

            let key = ResourceKey { game_id, entity_id: command.structure_id };
            let base = self.assert_building_command(key, actor, context.timestamp, context);
            let location = crate::logic::buildings::building_key(key, command.coord);
            let building = self.buildings.building(location).expect('missing building');
            assert!(
                building.category != 25 || command.coord.x != 10 || command.coord.y != 10,
                "cannot destroy labor building",
            );
            let rule = self.buildings.rule(crate::buildings::BuildingRuleKey { game_id, category: building.category });
            self.buildings.remove(location, building, rule, context.rules.unbox().building_config.base_population);
            let board = crate::logic::buildings::board();
            self.change_board_building(key, base, building.category, board, false, context);
            let refund = crate::math::PercentageImpl::get(building.labor_paid, board.demolition_refund_bps.into());
            self
                .resources_dispatcher(game_id)
                .grant_resource(key, 23, refund, context.timestamp, crate::commands::resource_context(context));
            self
                .emit_building_change(
                    key,
                    actor,
                    command.coord,
                    building.category,
                    crate::ownership::BuildingChange::Destroyed,
                    context.timestamp,
                );
            ()
        }
        fn pause_building_production(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::buildings::ChangeBuilding,
            context: crate::commands::ActionContext,
        ) -> () {
            self.refuse_pause(game_id, actor, command, context)
        }
        fn resume_building_production(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::buildings::ChangeBuilding,
            context: crate::commands::ActionContext,
        ) -> () {
            self.refuse_pause(game_id, actor, command, context)
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
        ) {
            let context = crate::commands::execution_context(game_id, context);
            let key = ResourceKey { game_id, entity_id: command.structure_id };
            let base = self.assert_building_command(key, actor, context.timestamp, context);
            assert!(base.category == crate::taxonomy::REALM_CATEGORY, "research requires a realm board");
            let before = crate::logic::research::require(key).learned;
            let learned = crate::research::learn(before, command.row, command.choice);
            self.assert_row_open(key, command.row);
            self
                .pay_research(
                    key,
                    crate::logic::research::price(
                        command.row, crate::research::side_tier(learned, command.row, command.choice),
                    ),
                    context,
                );
            self.settle_store_choice(key, command, context);
            crate::logic::research::write(key, crate::research::RealmKnowledge { learned });
            self.apply_research(key, base, command.row, crate::logic::buildings::board(), before, learned, context);
        }
        fn realm_knowledge(self: @ContractState, key: ResourceKey) -> Option<crate::research::RealmKnowledge> {
            crate::logic::research::knowledge(key)
        }
    }

    #[inline(never)]
    #[abi(embed_v0)]
    impl Upgrades of crate::upgrades::IStructureUpgrades<ContractState> {
        fn level_up(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            structure_id: u64,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::execution_context(game_id, context);

            assert_playing(context.game.unbox(), context.timestamp);
            let key = ResourceKey { game_id, entity_id: structure_id };
            let record = crate::logic::structures::record(key);
            assert!(record.owner == actor, "actor does not own structure");
            assert!(
                record.base.category == crate::taxonomy::REALM_CATEGORY
                    || record.base.category == crate::taxonomy::VILLAGE_CATEGORY,
                "structure is not a realm or village",
            );
            let limits = crate::logic::upgrades::limits();
            let maximum = if record.base.category == crate::taxonomy::REALM_CATEGORY {
                limits.realm_max
            } else {
                limits.village_max
            };
            assert!(record.base.level < maximum, "structure is already at max level");
            let next_level = record.base.level + 1;
            self
                .resources_dispatcher(game_id)
                .settle_production(key, context.timestamp, crate::commands::resource_context(context));
            for cost in crate::logic::upgrades::recipe(next_level).costs {
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
            if record.base.category == crate::taxonomy::REALM_CATEGORY && self.has_castle(key) {
                self.raise_castle_labor(key, record.base.level, next_level, context);
            }
            self.emit_structure_upgrade(key, actor, next_level, context.timestamp);
            ()
        }
    }
    #[generate_trait]
    impl Internal of InternalTrait {
        fn emit_structure_upgrade(
            ref self: ContractState, key: ResourceKey, actor: ContractAddress, next_level: u8, timestamp: u64,
        ) {
            self
                .emit(
                    StoryEvent {
                        version: 2,
                        game_id: key.game_id,
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
        ) {
            let building = Building { category, paused: false, labor_paid: 0 };
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
            self.assert_structure_produces(key, building.category);
            self
                .emit_building_change(
                    key, actor, coord, building.category, crate::ownership::BuildingChange::Created, timestamp,
                );
        }
        fn resolve_building_coord(
            self: @ContractState, game_id: u32, base: StructureBase, directions: Span<u8>,
        ) -> Coord {
            let limits = crate::logic::upgrades::limits();
            let maximum = if base.category == crate::taxonomy::REALM_CATEGORY {
                limits.realm_max
            } else if base.category == crate::taxonomy::VILLAGE_CATEGORY {
                limits.village_max
            } else {
                0
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
                base.category == crate::taxonomy::REALM_CATEGORY
                    || base.category == crate::taxonomy::VILLAGE_CATEGORY
                    || base.category == crate::taxonomy::CAMP_CATEGORY,
                "structure does not support production",
            );
            base
        }

        fn assert_structure_produces(self: @ContractState, key: ResourceKey, category: u8) {
            if category == 25 {
                return;
            }
            let resources = self.data.structures.structures.entry((key.game_id, key.entity_id)).resources_packed.read();
            assert!(crate::buildings::can_produce(category, resources), "structure cannot produce building resource");
        }
        fn grant_training_start(
            ref self: ContractState,
            key: ResourceKey,
            base: StructureBase,
            category: u8,
            board: crate::buildings::BoardRules,
            context: crate::commands::ExecutionContext,
        ) {
            if !crate::research::is_training(category) {
                return;
            }
            let row = if category == crate::research::CONSCRIPTION_CAMP {
                crate::research::ROW_CONSCRIPTION
            } else if category == crate::research::RATIONS_DEPOT {
                crate::research::ROW_RATIONS
            } else {
                crate::research::ROW_SUPPLY_YARD
            };
            let before = crate::logic::research::require(key).learned;
            if crate::research::tier(before, row) != 0 {
                return;
            }
            let after = crate::research::learn(before, row, 0);
            crate::logic::research::write(key, crate::research::RealmKnowledge { learned: after });
            self.apply_research(key, base, row, board, before, after, context);
        }

        fn assert_board_category(
            self: @ContractState, key: ResourceKey, category: u8, board: crate::buildings::BoardRules,
        ) {
            let minimum = if category == crate::research::SCOUTS_LODGE {
                crate::research::SCOUTS_LODGE_LEVEL
            } else if category == crate::research::RANGE {
                crate::research::RANGE_LEVEL
            } else if category == crate::research::CONSCRIPTION_CAMP {
                crate::research::CONSCRIPTION_CAMP_LEVEL
            } else if category == crate::research::RATIONS_DEPOT {
                crate::research::RATIONS_DEPOT_LEVEL
            } else {
                0
            };
            let level = self.data.structures.structures.entry((key.game_id, key.entity_id)).base.read().level;
            assert!(level >= minimum, "building needs a higher realm level");
            if !crate::research::is_training(category) {
                return;
            }
            assert!(self.standing(key, category) == 0, "training building is unique");
        }
        // The buildings of a type standing on a realm board; the castle's own labor producer is not a workshop.
        fn standing(self: @ContractState, key: ResourceKey, category: u8) -> u8 {
            let count = crate::buildings::category_count(
                self.data.buildings.structure_buildings.read((key.game_id, key.entity_id)), category,
            );
            if category == crate::research::WORKSHOP {
                count - 1
            } else {
                count
            }
        }
        fn assert_row_open(self: @ContractState, key: ResourceKey, row: u8) {
            let category = crate::research::row_category(row);
            assert!(category == 0 || self.standing(key, category) != 0, "research row needs a standing building");
        }
        // A store choice enlarges its limit only after production settles under the old knowledge.
        fn settle_store_choice(
            ref self: ContractState,
            key: ResourceKey,
            command: crate::research::Research,
            context: crate::commands::ExecutionContext,
        ) {
            if command.choice != crate::research::CHOICE_STORE {
                return;
            }
            let resource = if command.row == crate::research::ROW_FARM {
                crate::resources::WHEAT
            } else if command.row == crate::research::ROW_WORKSHOP {
                crate::resources::LABOR
            } else {
                return;
            };
            self
                .resources_dispatcher(key.game_id)
                .spend_resource(key, resource, 0, context.timestamp, crate::commands::resource_context(context));
        }
        fn pay_research(
            ref self: ContractState,
            key: ResourceKey,
            price: crate::research::ResearchPrice,
            game_context: crate::commands::ExecutionContext,
        ) {
            let context = crate::commands::resource_context(game_context);
            self.spend(key, crate::resources::ESSENCE, price.essence, game_context.timestamp, context);
            if price.labor != 0 {
                self.spend(key, crate::resources::LABOR, price.labor, game_context.timestamp, context);
            }
        }
        // A tier applies at once to every building of its type: Fields, Tools and Drill raise each one's output, and
        // a hut tier raises each hut's population. Store, Rations and training picks are read where they apply.
        fn apply_research(
            ref self: ContractState,
            key: ResourceKey,
            base: StructureBase,
            row: u8,
            board: crate::buildings::BoardRules,
            before: u64,
            after: u64,
            game_context: crate::commands::ExecutionContext,
        ) {
            if row == crate::research::ROW_CONSCRIPTION {
                for category in array![
                    crate::research::BARRACKS, crate::research::RANGE, crate::research::SCOUTS_LODGE,
                ] {
                    self.change_researched_output(key, base, category, board, before, after, game_context);
                }
                return;
            }
            let category = crate::research::row_category(row);
            if category == 0 {
                return;
            }
            let standing = self.standing(key, category);
            self.change_researched_output(key, base, category, board, before, after, game_context);
            if category == crate::research::HUT {
                let old_bonus = self.buildings.hut_bonus(key.game_id, standing, board, before);
                let new_bonus = self.buildings.hut_bonus(key.game_id, standing, board, after);
                self
                    .buildings
                    .change_population_max(
                        key, old_bonus, new_bonus, game_context.rules.unbox().building_config.base_population,
                    );
            }
        }
        fn change_researched_output(
            ref self: ContractState,
            key: ResourceKey,
            base: StructureBase,
            category: u8,
            board: crate::buildings::BoardRules,
            before: u64,
            after: u64,
            game_context: crate::commands::ExecutionContext,
        ) {
            let count: u64 = self.standing(key, category).into();
            if count == 0 {
                return;
            }
            let (resource_type, old_rate) = self.buildings.board_output(key, base, category, board, before);
            let (_, new_rate) = self.buildings.board_output(key, base, category, board, after);
            if old_rate != new_rate {
                self.change_board_output(key, resource_type, old_rate * count, false, game_context);
                self.change_board_output(key, resource_type, new_rate * count, true, game_context);
            }
        }
        fn change_board_building(
            ref self: ContractState,
            key: ResourceKey,
            base: StructureBase,
            category: u8,
            board: crate::buildings::BoardRules,
            adding: bool,
            game_context: crate::commands::ExecutionContext,
        ) {
            let learned = crate::logic::research::learned(key);
            let (resource_type, rate) = self.buildings.board_output(key, base, category, board, learned);
            self.change_board_output(key, resource_type, rate, adding, game_context);
            if category == crate::research::HUT {
                let huts = self.standing(key, category);
                let previous = if adding {
                    huts - 1
                } else {
                    huts + 1
                };
                let old_bonus = self.buildings.hut_bonus(key.game_id, previous, board, learned);
                let new_bonus = self.buildings.hut_bonus(key.game_id, huts, board, learned);
                self
                    .buildings
                    .change_population_max(
                        key, old_bonus, new_bonus, game_context.rules.unbox().building_config.base_population,
                    );
            }
        }
        fn change_board_output(
            ref self: ContractState,
            key: ResourceKey,
            resource_type: u8,
            rate: u64,
            adding: bool,
            game_context: crate::commands::ExecutionContext,
        ) {
            if rate == 0 {
                return;
            }
            let resources = self.resources_dispatcher(key.game_id);
            let context = crate::commands::resource_context(game_context);
            if adding {
                resources
                    .start_production(
                        key, resource_type, rate, crate::resources::UNLIMITED_OUTPUT, game_context.timestamp, context,
                    );
            } else {
                resources.stop_production(key, resource_type, rate, game_context.timestamp, context);
            }
        }

        fn refuse_pause(
            self: @ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::buildings::ChangeBuilding,
            context: crate::commands::ActionContext,
        ) {
            let context = crate::commands::execution_context(game_id, context);
            let key = ResourceKey { game_id, entity_id: command.structure_id };
            self.assert_building_command(key, actor, context.timestamp, context);
            panic!("board buildings cannot pause")
        }
        fn emit_building_change(
            ref self: ContractState,
            key: ResourceKey,
            actor: ContractAddress,
            coord: Coord,
            category: u8,
            change: crate::ownership::BuildingChange,
            timestamp: u64,
        ) {
            crate::logic::stories::emit_entity_story(
                key,
                actor,
                Story::BuildingPlacementStory(crate::ownership::BuildingPlacementStory { coord, category, change }),
                timestamp,
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
            );
            labor_paid
        }

        fn resources_dispatcher(self: @ContractState, game_id: u32) -> IResourceOperationsLibraryDispatcher {
            IResourceOperationsLibraryDispatcher {
                class_hash: crate::logic::release::class_of(game_id, crate::slots::RESOURCES),
            }
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
        fn has_castle(self: @ContractState, key: ResourceKey) -> bool {
            let centre = BuildingKey {
                game_id: key.game_id, structure_id: key.entity_id, inner_col: 10, inner_row: 10,
            };
            match crate::logic::buildings::building(centre) {
                Some(building) => building.category == crate::research::WORKSHOP,
                None => false,
            }
        }
        fn raise_castle_labor(
            ref self: ContractState,
            key: ResourceKey,
            level: u8,
            next_level: u8,
            context: crate::commands::ExecutionContext,
        ) {
            let resources = self.resources_dispatcher(key.game_id);
            let resource_context = crate::commands::resource_context(context);
            resources
                .stop_production(
                    key,
                    crate::resources::LABOR,
                    crate::logic::resources::castle_labor_rate(level),
                    context.timestamp,
                    resource_context,
                );
            resources
                .start_production(
                    key,
                    crate::resources::LABOR,
                    crate::logic::resources::castle_labor_rate(next_level),
                    crate::resources::UNLIMITED_OUTPUT,
                    context.timestamp,
                    resource_context,
                );
        }
    }
}
