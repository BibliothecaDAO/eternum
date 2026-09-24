#[starknet::contract]
pub mod MovementLogic {
    use starknet::ContractAddress;
    use starknet::storage::StoragePointerReadAccess;
    use crate::commands::{ExecutionContext, Explore};
    use crate::game::{IPointsDispatcherTrait, IPointsLibraryDispatcher};
    use crate::geometry::{neighbor, spire_neighbor, tile_key};
    use crate::logic::release::ReleaseState;
    use crate::logic::troops::TroopState;
    use crate::map::IMapLogicDispatcherTrait;
    use crate::ownership::StoryResultTrait;
    use crate::resources::{IResourceOperationsDispatcherTrait, ResourceKey};
    use crate::stamina::StaminaTrait;
    use crate::structures::IStructureOperationsDispatcherTrait;
    use crate::troops::{Coord, ExplorerKey};
    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    impl LifeInternal = ReleaseState::InternalImpl<ContractState>;
    use crate::logic::troops::troop_helpers::TroopHelpersTrait;
    impl Helpers = crate::logic::troops::troop_helpers::TroopHelpers<ContractState>;
    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[substorage(v0)]
        release: ReleaseState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        GuardEvent: crate::logic::guards::GuardState::Event,
        ReleaseEvent: ReleaseState::Event,
        TroopEvent: TroopState::Event,
        StoryEvent: crate::ownership::StoryEvent,
        OwnershipRow: crate::events::RowSet,
        OwnershipDeleted: crate::events::RowDeleted,
    }

    #[abi(embed_v0)]
    impl Exploration of crate::commands::IExplore<ContractState> {
        fn explore(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: Explore,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            let rules = self.authorize(game_id, context);
            let key = ExplorerKey { game_id, explorer_id: command.explorer_id };
            let mut explorer = crate::logic::troops::authorized_explorer(key, actor, context.timestamp, context);
            assert!(explorer.troops.count != 0, "explorer is dead");
            crate::logic::map::MapState::vacate(tile_key(game_id, explorer.coord), command.explorer_id);
            let destination = neighbor(explorer.coord, command.direction);
            if rules.epoch_seconds != 0 {
                crate::expeditions::assert_same_region(explorer.coord, destination, self.expedition_spacing(game_id));
            }
            let tile = tile_key(game_id, destination);
            let data = self
                .map_dispatcher(game_id)
                .reveal_destination_tile(tile, crate::commands::biome_context(context))
                .map(|tile| tile.data)
                .unwrap_or(0);
            assert!(data % 0x20000000000 == 0, "destination occupied");
            let biome: crate::biome::Biome = self
                .map_dispatcher(game_id)
                .biome(tile, crate::commands::biome_context(context))
                .into();
            let exploring = (data / 0x20000000000) % 0x100 == 0;
            let mut raw_root = context.raw_root;
            let game = context.game.unbox();
            let seed = crate::random::game_root(ref raw_root, game_id, game.seed);
            let mut discovery = crate::discovery::Discovery::None;
            if exploring {
                crate::logic::map::MapState::reveal(tile, biome.into());
                IPointsLibraryDispatcher { class_hash: self.release.classes(game_id).season.read() }
                    .register_exploration(game_id, actor, crate::commands::action_context(context));
                if !destination.alt {
                    crate::relics::IRelicMapDispatcherTrait::discover_relic_chest(
                        crate::relics::IRelicMapLibraryDispatcher {
                            class_hash: self.release.classes(game_id).map.read(),
                        },
                        game_id,
                        destination,
                        explorer.coord,
                        seed,
                        context.timestamp,
                        crate::commands::action_context(context),
                    );
                }
                discovery = self
                    .map_dispatcher(game_id)
                    .discovery(
                        tile,
                        seed,
                        crate::hyperstructures::IHyperstructuresDispatcherTrait::hyperstructure_count(
                            crate::hyperstructures::IHyperstructuresLibraryDispatcher {
                                class_hash: self.release.classes(game_id).economy.read(),
                            },
                            game_id,
                        ),
                        context.timestamp,
                        crate::commands::action_context(context),
                    );
                if discovery != crate::discovery::Discovery::None {
                    self
                        .structures_dispatcher(game_id)
                        .create_discovery(
                            game_id,
                            destination,
                            discovery,
                            seed,
                            context.timestamp,
                            crate::commands::action_context(context),
                        );
                }
            }
            if discovery == crate::discovery::Discovery::None {
                explorer.coord = destination;
            }
            crate::logic::map::MapState::occupy(
                tile_key(game_id, explorer.coord),
                command.explorer_id,
                crate::troops::explorer_occupier(explorer),
                false,
            );
            self.pay_movement(game_id, ref explorer, rules, biome, exploring, context.timestamp, context);
            crate::logic::troops::TroopState::save(key, explorer);

            if !explorer.coord.alt {
                crate::exploration_rewards::IExtractionDispatcherTrait::extract_exploration_reward(
                    crate::exploration_rewards::IExtractionLibraryDispatcher {
                        class_hash: self.release.classes(game_id).map.read(),
                    },
                    game_id,
                    actor,
                    command.explorer_id,
                    if exploring {
                        Some(destination)
                    } else {
                        None
                    },
                    crate::commands::action_context(ExecutionContext { raw_root, ..context }),
                    story_cursor,
                )
                    .resume_story(ref story_cursor);
            }
            ((), story_cursor)
        }
    }
    #[abi(embed_v0)]
    impl SettlementDisplacement of crate::settlement::ISettlementDisplacement<ContractState> {
        fn displace_explorer(
            ref self: ContractState, game_id: u32, explorer_id: u32, game_context: crate::commands::ActionContext,
        ) {
            let game_context = crate::commands::load_context(game_id, game_context);

            let key = ExplorerKey { game_id, explorer_id };
            let mut explorer = crate::logic::troops::explorer(key).expect('missing blocking explorer');
            assert!(explorer.owner != 0, "blocking explorer has no owner");
            let origin = tile_key(game_id, explorer.coord);
            for direction in 0_u8..6 {
                let destination = neighbor(explorer.coord, direction);
                let tile = tile_key(game_id, destination);
                let data = crate::logic::map::tile(tile).map(|tile| tile.data).unwrap_or(0);
                if (data / 2) % 256 != 0 {
                    continue;
                }
                if (data / 0x20000000000) % 256 == 0 {
                    crate::logic::map::MapState::reveal(
                        tile, self.map_dispatcher(game_id).biome(tile, crate::commands::biome_context(game_context)),
                    );
                }
                let category = crate::troops::explorer_occupier(explorer);
                crate::logic::map::MapState::occupy(tile, explorer_id, category, false);
                explorer.coord = destination;
                crate::logic::troops::TroopState::save(key, explorer);
                crate::logic::map::MapState::vacate(origin, explorer_id);
                return;
            }
            self.destroy_explorer(key, explorer);
        }
    }
    #[abi(embed_v0)]
    impl Travel of crate::commands::ITravelCommands<ContractState> {
        fn enter_depth(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::commands::EnterDepth,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) {
            let context = crate::commands::load_context(game_id, context);

            let rules = self.authorize(game_id, context);
            assert!(rules.epoch_seconds != 0, "depth entry requires expeditions");
            let key = ExplorerKey { game_id, explorer_id: command.explorer_id };
            let mut explorer = crate::logic::troops::authorized_explorer(key, actor, context.timestamp, context);
            assert!(explorer.troops.count != 0, "explorer is dead");
            let home = crate::logic::troops::owned_structure(game_id, explorer.owner, actor);
            assert!(command.depth != 0 && command.depth <= home.metadata.attunement, "depth is not unlocked");
            let spacing = self.expedition_spacing(game_id);
            let spire = crate::expeditions::spire(
                context.game.unbox().start_main_at,
                rules.epoch_seconds,
                spacing,
                home.metadata.realm_id,
                context.timestamp,
            );
            assert!(
                explorer.coord == spire || crate::geometry::adjacent(explorer.coord, spire),
                "army must be at its realm's spire",
            );
            let depth = crate::logic::expeditions::depth_rules(game_id, command.depth);
            explorer
                .troops
                .stamina
                .spend(
                    ref explorer.troops.boosts,
                    explorer.troops.category,
                    explorer.troops.tier,
                    rules.troop_stamina_config,
                    depth.entry_stamina.into(),
                    context.timestamp / rules.tick_config.armies_tick_in_seconds,
                    true,
                );
            let destination = Coord {
                y: explorer.coord.y + Into::<u8, u32>::into(command.depth) * spacing, ..explorer.coord,
            };
            let location = tile_key(game_id, destination);
            self.reveal_expedition_tile(game_id, destination, context);
            crate::logic::map::MapState::vacate(tile_key(game_id, explorer.coord), command.explorer_id);
            crate::logic::map::MapState::occupy(
                location, command.explorer_id, crate::troops::explorer_occupier(explorer), false,
            );
            explorer.coord = destination;
            crate::logic::troops::TroopState::save(key, explorer);
        }
        fn move_explorer(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::commands::Move,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) {
            let context = crate::commands::load_context(game_id, context);

            let rules = self.authorize(game_id, context);
            assert!(!command.directions.is_empty(), "empty movement path");
            let key = ExplorerKey { game_id, explorer_id: command.explorer_id };
            let mut explorer = crate::logic::troops::authorized_explorer(key, actor, context.timestamp, context);
            assert!(explorer.troops.count != 0, "explorer is dead");
            crate::logic::map::MapState::vacate(tile_key(game_id, explorer.coord), command.explorer_id);
            for direction in command.directions {
                let destination = neighbor(explorer.coord, *direction);
                if rules.epoch_seconds != 0 {
                    crate::expeditions::assert_same_region(
                        explorer.coord, destination, self.expedition_spacing(game_id),
                    );
                }
                let tile = tile_key(game_id, destination);
                let data = self
                    .map_dispatcher(game_id)
                    .reveal_destination_tile(tile, crate::commands::biome_context(context))
                    .expect('undiscovered movement tile')
                    .data;
                assert!(data % 0x20000000000 == 0, "movement tile occupied");
                assert!((data / 0x20000000000) % 256 != 0, "undiscovered movement tile");
                let biome = self.map_dispatcher(game_id).biome(tile, crate::commands::biome_context(context)).into();
                crate::troops::spend_stamina(ref explorer, rules, biome, false, context.timestamp);
                explorer.coord = destination;
            }
            crate::logic::map::MapState::occupy(
                tile_key(game_id, explorer.coord),
                command.explorer_id,
                crate::troops::explorer_occupier(explorer),
                false,
            );
            self.pay_food(game_id, explorer, rules, false, context.timestamp, context);
            crate::logic::troops::TroopState::save(key, explorer);
        }
        fn toggle_alternate(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::commands::ToggleAlternate,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) {
            let context = crate::commands::load_context(game_id, context);

            self.authorize(game_id, context);
            let key = ExplorerKey { game_id, explorer_id: command.explorer_id };
            let mut explorer = crate::logic::troops::authorized_explorer(key, actor, context.timestamp, context);
            assert!(explorer.troops.count != 0, "explorer is dead");
            let spire = crate::logic::map::tile(
                tile_key(game_id, spire_neighbor(explorer.coord, command.spire_direction)),
            )
                .expect('missing spire');
            assert!((spire.data / 2) % 256 == 35, "explorer must be adjacent to spire");
            let destination = Coord { alt: !explorer.coord.alt, ..explorer.coord };
            let destination_key = tile_key(game_id, destination);
            let data = crate::logic::map::tile(destination_key).map(|tile| tile.data).unwrap_or(0);
            assert!(data % 0x20000000000 == 0, "portal landing occupied");
            self
                .resources_dispatcher(game_id)
                .spend_spire_fee(
                    ResourceKey { game_id, entity_id: explorer.owner },
                    context.timestamp,
                    crate::commands::resource_context(context),
                );
            if (data / 0x20000000000) % 256 == 0 {
                crate::logic::map::MapState::reveal(
                    destination_key,
                    self.map_dispatcher(game_id).biome(destination_key, crate::commands::biome_context(context)),
                );
            }
            crate::logic::map::MapState::vacate(tile_key(game_id, explorer.coord), command.explorer_id);
            crate::logic::map::MapState::occupy(
                destination_key, command.explorer_id, crate::troops::explorer_occupier(explorer), false,
            );
            explorer.coord = destination;
            crate::logic::troops::TroopState::save(key, explorer);
        }
    }
}
