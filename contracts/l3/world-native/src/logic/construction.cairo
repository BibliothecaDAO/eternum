#[starknet::contract]
pub mod ConstructionLogic {
    use starknet::ContractAddress;
    use starknet::storage::{
        StorageMapReadAccess, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use crate::buildings::{Building, BuildingKey};
    use crate::events::RowSet;
    use crate::game::assert_playing;
    use crate::logic::buildings::BuildingState;
    use crate::logic::release::ReleaseState;
    use crate::logic::structures::StructureState;
    use crate::ownership::{Story, StoryEvent};
    use crate::resources::{IResourceOperationsDispatcherTrait, IResourceOperationsLibraryDispatcher, ResourceKey};
    use crate::rules::RESOURCE_PRECISION;
    use crate::structures::{StructureBase, StructureRecord};
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
        #[cfg(test)]
        fn building_rule(
            self: @ContractState, key: crate::buildings::BuildingRuleKey,
        ) -> crate::buildings::BuildingRule {
            self.buildings.rule(key)
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
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            let key = ResourceKey { game_id, entity_id: command.structure_id };
            let base = self.assert_building_command(key, actor, context.timestamp, context);
            let coord = self.resolve_building_coord(game_id, base, command.directions);
            let location = crate::logic::buildings::building_key(game_id, base, coord);
            let rule = self.buildings.rule(crate::buildings::BuildingRuleKey { game_id, category: command.category });
            let before = self.neighbor_effects(key, base, coord, context);
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
                    key, before, self.neighbor_effects(key, base, coord, context), context.timestamp, context,
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
                building.labor_paid = labor_paid;
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
            let location = crate::logic::buildings::building_key(game_id, base, command.coord);
            let building = self.buildings.building(location).expect('missing building');
            let board = self.buildings.board(game_id);
            assert!(
                building.category != 25 || (board.is_some() && (command.coord.x != 10 || command.coord.y != 10)),
                "cannot destroy labor building",
            );
            let before = self.neighbor_effects(key, base, command.coord, context);
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
                    key, before, self.neighbor_effects(key, base, command.coord, context), context.timestamp, context,
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

    #[inline(never)]
    #[abi(embed_v0)]
    impl Upgrades of crate::upgrades::IStructureUpgrades<ContractState> {
        fn buy_realm_upgrade(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::upgrades::BuyRealmUpgrade,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) {
            let context = crate::commands::load_context(game_id, context);

            let _ = self.release.classes(game_id);

            assert_playing(context.game.unbox(), context.timestamp);
            let key = ResourceKey { game_id, entity_id: command.structure_id };
            let mut record = crate::logic::structures::record(key);
            assert!(record.owner == actor && record.base.category == 1, "actor does not own realm");
            match command.lane {
                crate::upgrades::RealmUpgradeLane::Barracks => {
                    record.metadata.barracks_tier = self.buy_barracks_tier(key, record, context.timestamp, context);
                },
                crate::upgrades::RealmUpgradeLane::Attunement => {
                    assert!(record.metadata.attunement < 3, "attunement is complete");
                    let next = record.metadata.attunement + 1;
                    let depth = crate::logic::expeditions::depth_rules(game_id, next);
                    self
                        .spend(
                            key,
                            38,
                            depth.attunement_cost,
                            context.timestamp,
                            crate::commands::resource_context(context),
                        );
                    record.metadata.attunement = next;
                },
            }
            self.data.structures.structures.entry((game_id, command.structure_id)).metadata.write(record.metadata);
            let mut values = array![];
            record.metadata.serialize(ref values);
            self
                .emit(
                    Event::StructureEvent(
                        StructureState::Event::RowMemberSet(
                            crate::events::RowMemberSet {
                                version: 1,
                                model: 'Structure',
                                member: 'metadata',
                                keys: array![game_id.into(), command.structure_id.into()].span(),
                                values: values.span(),
                            },
                        ),
                    ),
                );
        }

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
                let coord = Coord { alt: false, x: record.base.coord_x, y: record.base.coord_y };
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
        fn buy_barracks_tier(
            ref self: ContractState,
            key: ResourceKey,
            record: StructureRecord,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) -> u8 {
            let board = self.buildings.board(key.game_id).expect('barracks lane is disabled');
            let tier = record.metadata.barracks_tier;
            assert!(tier < 2, "barracks tier is complete");
            let cost = if tier == 0 {
                board.barracks_ii_cost
            } else {
                board.barracks_iii_cost
            };
            self.spend(key, 38, cost, timestamp, crate::commands::resource_context(game_context));
            for x in 6_u32..15 {
                for y in 6_u32..15 {
                    let coord = Coord { alt: false, x, y };
                    if let Some(building) = self
                        .buildings
                        .building(crate::logic::buildings::building_key(key.game_id, record.base, coord)) {
                        if building.category == 28 || building.category == 31 || building.category == 34 {
                            let before = self
                                .buildings
                                .building_effect(key, record.base, coord, board, tier, game_context);
                            let after = self
                                .buildings
                                .building_effect(key, record.base, coord, board, tier + 1, game_context);
                            self
                                .buildings
                                .apply_board_effects(
                                    key, array![before].span(), array![after].span(), timestamp, game_context,
                                );
                        }
                    }
                }
            }
            tier + 1
        }
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
            let building = Building { category, outer_entity_id: key.entity_id, paused: false, labor_paid: 0 };
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
        fn neighbor_effects(
            self: @ContractState,
            key: ResourceKey,
            base: StructureBase,
            coord: Coord,
            game_context: crate::commands::ExecutionContext,
        ) -> Span<crate::buildings::BuildingEffect> {
            let Some(board) = self.buildings.board(key.game_id) else {
                return array![].span();
            };
            let tier = crate::logic::structures::record(key).metadata.barracks_tier;
            let mut effects = array![self.buildings.building_effect(key, base, coord, board, tier, game_context)];
            for direction in 0_u8..6 {
                effects
                    .append(
                        self
                            .buildings
                            .building_effect(
                                key, base, crate::geometry::neighbor(coord, direction), board, tier, game_context,
                            ),
                    );
            }
            effects.span()
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
            let location = crate::logic::buildings::building_key(game_id, base, command.coord);
            let mut building = self.buildings.building(location).expect('missing building');
            assert!(building.paused != paused, "building already in requested state");
            let before = self.neighbor_effects(key, base, command.coord, game_context);
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
                    key, before, self.neighbor_effects(key, base, command.coord, game_context), timestamp, game_context,
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
