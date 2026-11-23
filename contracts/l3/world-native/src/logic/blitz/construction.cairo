#[starknet::contract]
pub mod ConstructionLogic {
    use starknet::ContractAddress;
    use starknet::storage::{StorageMapReadAccess, StoragePathEntry, StoragePointerReadAccess};
    use crate::buildings::{Building, BuildingKey, ChangeBuilding};
    use crate::commands::ExecutionContext;
    use crate::events::RowSet;
    use crate::logic::buildings::{BuildingState, assert_building_command, emit_building_change};
    use crate::logic::release::ReleaseState;
    use crate::logic::structure_actions::resources_dispatcher;
    use crate::logic::structures::StructureState;
    use crate::map::TileKey;
    use crate::ownership::{BuildingChange, StoryEvent};
    use crate::resources::{IResourceOperationsDispatcherTrait, ResourceKey};
    use crate::structures::StructureBase;
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
        PointsAwarded: crate::game::PointsAwarded,
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
            crate::logic::blitz::discovery::reveal(key, explorer_id, seed, context)
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
            let base = assert_building_command(key, actor, context.timestamp, context);
            let coord = crate::logic::buildings::resolve_building_coord(base, command.directions);
            let location = crate::logic::buildings::building_key(key, coord);
            let rule = self.buildings.rule(crate::buildings::BuildingRuleKey { game_id, category: command.category });
            self.erect_building(key, base, location, command.category, rule, context);
            emit_building_change(key, actor, coord, command.category, BuildingChange::Created, context.timestamp);
            let count = crate::buildings::category_count(
                self.data.buildings.structure_buildings.read((game_id, command.structure_id)), command.category,
            );
            let costs = if command.use_simple {
                rule.simple_cost
            } else {
                rule.complex_cost
            };
            crate::logic::buildings::pay_building_costs(
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
        }
        fn destroy_building(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: ChangeBuilding,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::execution_context(game_id, context);
            let key = ResourceKey { game_id, entity_id: command.structure_id };
            let base = assert_building_command(key, actor, context.timestamp, context);
            let location = crate::logic::buildings::building_key(key, command.coord);
            let building = self.buildings.building(location).expect('missing building');
            assert!(building.category != crate::research::WORKSHOP, "cannot destroy labor building");
            if !building.paused {
                self.change_building_production(key, building.category, base, false, context);
            }
            let rule = self.buildings.rule(crate::buildings::BuildingRuleKey { game_id, category: building.category });
            self.buildings.remove(location, building);
            self.buildings.house(location, rule, false, context.rules.unbox().building_config.base_population);
            emit_building_change(
                key, actor, command.coord, building.category, BuildingChange::Destroyed, context.timestamp,
            );
        }
        fn pause_building_production(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: ChangeBuilding,
            context: crate::commands::ActionContext,
        ) -> () {
            self.set_building_paused(game_id, actor, command, true, context);
        }
        fn resume_building_production(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: ChangeBuilding,
            context: crate::commands::ActionContext,
        ) -> () {
            self.set_building_paused(game_id, actor, command, false, context);
        }
    }

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
            crate::game::assert_playing(context.game.unbox(), context.timestamp);
            let key = ResourceKey { game_id, entity_id: structure_id };
            let record = crate::logic::structures::record(key);
            let next_level = crate::logic::upgrades::next_level(record, actor);
            crate::logic::upgrades::pay(key, next_level, context);
            StructureState::upgrade(key, record.base, context.rules.unbox().troop_limit_config);
            if record.base.category == crate::taxonomy::REALM_CATEGORY {
                raise_realm_tile(key, record.metadata.has_wonder, next_level);
            }
            crate::logic::upgrades::emit_level_up(key, actor, next_level, context.timestamp);
        }
    }

    #[generate_trait]
    impl Internal of InternalTrait {
        fn erect_building(
            ref self: ContractState,
            key: ResourceKey,
            base: StructureBase,
            location: BuildingKey,
            category: u8,
            rule: crate::buildings::BuildingRule,
            context: ExecutionContext,
        ) {
            let building = Building { category, paused: false, labor_paid: 0 };
            self.buildings.create(location, building);
            self.buildings.house(location, rule, true, context.rules.unbox().building_config.base_population);
            self.change_building_production(key, category, base, true, context);
            let resources = self.data.structures.structures.entry((key.game_id, key.entity_id)).resources_packed.read();
            assert!(crate::buildings::can_produce(category, resources), "structure cannot produce building resource");
        }
        fn change_building_production(
            ref self: ContractState,
            key: ResourceKey,
            category: u8,
            base: StructureBase,
            starting: bool,
            context: ExecutionContext,
        ) {
            let resource_type = crate::buildings::produced_resource(category);
            if resource_type == 0 {
                return;
            }
            let rule = crate::logic::resources::rule(resource_type);
            let rate = if base.category == crate::taxonomy::REALM_CATEGORY {
                rule.realm_rate
            } else {
                rule.village_rate
            };
            let resources = resources_dispatcher(key.game_id);
            let resource_context = crate::commands::resource_context(context);
            if starting {
                assert!(rate != 0, "resource cannot be produced");
                resources.start_production(key, resource_type, rate, 0, context.timestamp, resource_context);
            } else {
                resources.stop_production(key, resource_type, rate, context.timestamp, resource_context);
            }
        }
        fn set_building_paused(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: ChangeBuilding,
            paused: bool,
            context: crate::commands::ActionContext,
        ) {
            let context = crate::commands::execution_context(game_id, context);
            let key = ResourceKey { game_id, entity_id: command.structure_id };
            let base = assert_building_command(key, actor, context.timestamp, context);
            let location = crate::logic::buildings::building_key(key, command.coord);
            let building = self.buildings.building(location).expect('missing building');
            assert!(building.paused != paused, "building already in requested state");
            self.change_building_production(key, building.category, base, !paused, context);
            self.buildings.write_building(location, Building { paused, ..building });
            let change = if paused {
                BuildingChange::Paused
            } else {
                BuildingChange::Resumed
            };
            emit_building_change(key, actor, command.coord, building.category, change, context.timestamp);
        }
    }

    fn raise_realm_tile(key: ResourceKey, wonder: bool, level: u8) {
        let coord = crate::structures::structure_coord(key);
        crate::logic::map::MapState::upgrade_realm(
            TileKey { game_id: key.game_id, alt: coord.alt, col: coord.x, row: coord.y }, key.entity_id, wonder, level,
        );
    }
}
