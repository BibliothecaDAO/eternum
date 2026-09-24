#[starknet::component]
pub mod RelicState {
    use games_storage::release::LogicClasses;
    use starknet::ContractAddress;
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess};
    use crate::commands::ExecutionContext;
    use crate::game::{IPointsDispatcherTrait, IPointsLibraryDispatcher, assert_playing};
    use crate::logic::release::ReleaseState;
    use crate::logic::release::ReleaseState::InternalTrait as LifeInternalTrait;
    use crate::relics::{
        ApplyRelic, IRelicMapDispatcherTrait, IRelicMapLibraryDispatcher, IRelicProductionDispatcherTrait,
        IRelicProductionLibraryDispatcher, IRelicTroopsDispatcherTrait, IRelicTroopsLibraryDispatcher, OpenChest,
        Recipient, RelicRule,
    };
    use crate::resources::{IResourceOperationsDispatcherTrait, IResourceOperationsLibraryDispatcher, ResourceKey};
    use crate::troops::ExplorerKey;

    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    pub struct Storage {
        #[flat]
        pub data: crate::state::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: crate::events::RowSet,
        StoryEvent: crate::ownership::StoryEvent,
    }
    #[embeddable_as(RelicsImpl)]
    pub impl Relics<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of crate::relics::IRelics<ComponentState<TContractState>> {
        fn configure_relics(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            rules: Span<RelicRule>,
            chests: Option<crate::relics::ChestRules>,
        ) {
            crate::logic::release::assert_authority();
            let game_rules = crate::logic::game::rules(game_id);
            if let Some(value) = chests {
                assert!(
                    game_rules.epoch_seconds != 0
                        && crate::rules::rule_enabled(game_rules, crate::rules::DEPTH_CONTENTS),
                    "chest tables require depth rules",
                );
                assert!(value.loose_one_in != 0, "empty loose chest lottery");
                assert!(
                    Into::<u16, u32>::into(value.relic_probability) + value.cosmetic_probability.into() <= 10000,
                    "invalid chest type probabilities",
                );
            }
            assert!(!self.data.relics.relic_configured.read(game_id), "relic rules already configured");
            assert!(rules.len() == 18, "all eighteen relic rules required");
            let mut total: u128 = 0;
            for index in 0..18_u32 {
                let rule = *rules.at(index);
                total += rule.draw_weight;
                self
                    .data
                    .relics
                    .relic_rules
                    .write((game_id, crate::relics::FIRST_RELIC + index.try_into().unwrap()), rule);
            }
            assert!(total != 0, "empty relic discovery pool");
            assert!(*rules.at(6).uses == 1 && *rules.at(7).uses == 2, "invalid reveal radii");
            self.data.relics.relic_configured.write(game_id, true);
            self.data.relics.chest_rules.write(game_id, chests);
            if let Some(chest_rules) = chests {
                let mut values = array![];
                chest_rules.serialize(ref values);
                self
                    .emit(
                        crate::events::RowSet {
                            version: 1, model: 'ChestRules', keys: array![game_id.into()].span(), values: values.span(),
                        },
                    );
            }
            let mut values = array![];
            rules.serialize(ref values);
            self
                .emit(
                    crate::events::RowSet {
                        version: 1, model: 'RelicRules', keys: array![game_id.into()].span(), values: values.span(),
                    },
                );
        }
        fn chest_rules(self: @ComponentState<TContractState>, game_id: u32) -> Option<crate::relics::ChestRules> {
            assert!(self.data.relics.relic_configured.read(game_id), "missing chest rules");
            self.data.relics.chest_rules.read(game_id)
        }
        fn chest_pity(self: @ComponentState<TContractState>, game_id: u32, player: ContractAddress, depth: u8) -> u16 {
            self.data.relics.chest_pity.read((game_id, player, depth))
        }
        fn chest_tokens(
            self: @ComponentState<TContractState>, game_id: u32, player: ContractAddress, epoch: u64,
        ) -> u16 {
            self.data.relics.chest_tokens.read((game_id, player, epoch))
        }
        fn chest_reward(
            self: @ComponentState<TContractState>, game_id: u32, result_id: u32,
        ) -> Option<crate::relics::ChestReward> {
            self.data.relics.chest_rewards.read((game_id, result_id))
        }
        fn grant_reveal_chest(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: OpenChest,
            context: crate::commands::ActionContext,
        ) {
            let context = crate::commands::load_context(game_id, context);

            let Some(rules) = self.chest_rules(game_id) else {
                return;
            };
            let game = context.game.unbox();
            assert_playing(game, context.timestamp);
            crate::logic::troops::authorized_explorer(
                ExplorerKey { game_id, explorer_id: command.explorer_id }, actor, context.timestamp, context,
            );
            let mut root = context.raw_root;
            let seed = crate::random::game_root(ref root, game_id, game.seed);
            if crate::random::range(
                seed, Into::<u64, u128>::into(context.timestamp) + 29, rules.loose_one_in.into(),
            ) == 0 {
                self.pay_expedition_chest(game_id, actor, command, context, rules);
            }
        }

        fn relic_rules(self: @ComponentState<TContractState>, game_id: u32) -> Span<RelicRule> {
            assert!(self.data.relics.relic_configured.read(game_id), "missing relic rules");
            let mut rules = array![];
            for id in crate::relics::FIRST_RELIC..crate::relics::LAST_RELIC + 1 {
                rules.append(self.data.relics.relic_rules.read((game_id, id)));
            }
            rules.span()
        }
        fn open_relic_chest(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: OpenChest,
            context: crate::commands::ActionContext,
        ) {
            let context = crate::commands::load_context(game_id, context);

            self.assert_command(game_id, context.timestamp, context);
            let classes = self.logic_classes(game_id);
            let explorer = crate::logic::troops::authorized_explorer(
                ExplorerKey { game_id, explorer_id: command.explorer_id }, actor, context.timestamp, context,
            );
            assert!(crate::geometry::adjacent(explorer.coord, command.coord), "explorer is not adjacent to chest");
            IRelicMapLibraryDispatcher { class_hash: classes.map.read() }.consume_relic_chest(game_id, command.coord);
            self.pay_chest(game_id, actor, command, context);
        }
        fn grant_site_chest(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: OpenChest,
            context: crate::commands::ActionContext,
        ) {
            let context = crate::commands::load_context(game_id, context);

            assert_playing(context.game.unbox(), context.timestamp);
            crate::logic::troops::authorized_explorer(
                ExplorerKey { game_id, explorer_id: command.explorer_id }, actor, context.timestamp, context,
            );
            self.pay_chest(game_id, actor, command, context);
        }
        fn apply_relic(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: ApplyRelic,
            context: crate::commands::ActionContext,
        ) {
            let context = crate::commands::load_context(game_id, context);

            self.assert_command(game_id, context.timestamp, context);
            assert!(
                command.relic_id >= crate::relics::FIRST_RELIC && command.relic_id <= crate::relics::LAST_RELIC,
                "invalid relic resource",
            );
            assert!(self.data.relics.relic_configured.read(game_id), "missing relic rules");
            let rule = self.data.relics.relic_rules.read((game_id, command.relic_id));
            let payer = self.apply_effect(game_id, actor, command, rule, context.timestamp, context);
            self
                .resources(game_id)
                .spend_resource(
                    ResourceKey { game_id, entity_id: command.entity_id },
                    command.relic_id,
                    crate::rules::RESOURCE_PRECISION,
                    context.timestamp,
                    crate::commands::resource_context(context),
                );
            self
                .resources(game_id)
                .spend_resource(
                    ResourceKey { game_id, entity_id: payer },
                    38,
                    rule.essence_cost * crate::rules::RESOURCE_PRECISION,
                    context.timestamp,
                    crate::commands::resource_context(context),
                );
        }
    }
    #[embeddable_as(ArtificerImpl)]
    pub impl Artificer<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of crate::artificer::IArtificer<ComponentState<TContractState>> {
        fn configure_artificer(ref self: ComponentState<TContractState>, game_id: u32, research_cost: u128) {
            crate::logic::release::assert_authority();
            crate::logic::game::game(game_id);
            assert!(self.data.relics.artificer_costs.read(game_id).is_none(), "artificer already configured");
            self.data.relics.artificer_costs.write(game_id, Some(research_cost));
            self
                .emit(
                    crate::events::RowSet {
                        version: 1,
                        model: 'ArtificerCost',
                        keys: array![game_id.into()].span(),
                        values: array![research_cost.into()].span(),
                    },
                );
        }
        fn artificer_cost(self: @ComponentState<TContractState>, game_id: u32) -> u128 {
            self.data.relics.artificer_costs.read(game_id).expect('missing artificer cost')
        }
        fn craft_relic(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            structure_id: u32,
            context: crate::commands::ActionContext,
        ) {
            let context = crate::commands::load_context(game_id, context);

            self.assert_command(game_id, context.timestamp, context);
            let key = ResourceKey { game_id, entity_id: structure_id };
            let structure = crate::logic::structures::structure(key).expect('missing structure');
            assert!(
                structure.base.category == 1 || structure.base.category == 5, "structure is not a realm or village",
            );
            assert!(structure.owner == actor, "actor does not own structure");
            self
                .resources(game_id)
                .spend_resource(
                    key,
                    crate::artificer::RESEARCH,
                    self.artificer_cost(game_id),
                    context.timestamp,
                    crate::commands::resource_context(context),
                );
            let mut root = context.raw_root;
            let seed = crate::random::game_root(ref root, game_id, context.game.unbox().seed);
            let relic = *crate::relics::draw_relics(self.relic_rules(game_id), seed, context.timestamp, 1).at(0);
            self
                .resources(game_id)
                .grant_resource(
                    key,
                    relic,
                    crate::rules::RESOURCE_PRECISION,
                    context.timestamp,
                    crate::commands::resource_context(context),
                );
            self.record_crafted_relic(game_id, actor, structure_id, relic, context.timestamp);
        }
    }
    #[generate_trait]
    pub impl InternalImpl<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of InternalTrait<TContractState> {
        fn pay_chest(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: OpenChest,
            context: ExecutionContext,
        ) {
            if let Some(rules) = self.chest_rules(game_id) {
                self.pay_expedition_chest(game_id, actor, command, context, rules);
                return;
            }
            let mut root = context.raw_root;
            let seed = crate::random::game_root(ref root, game_id, context.game.unbox().seed);
            let config = context.rules.unbox();
            let relics = crate::relics::draw_relics(
                self.relic_rules(game_id), seed, context.timestamp, config.map_config.relic_chest_relics_per_chest,
            );
            let key = ResourceKey { game_id, entity_id: command.explorer_id };
            for id in relics {
                self
                    .resources(game_id)
                    .grant_resource(
                        key,
                        *id,
                        crate::rules::RESOURCE_PRECISION,
                        context.timestamp,
                        crate::commands::resource_context(context),
                    );
            }
            let points = config.victory_points_grant_config.relic_open_points.into();
            IPointsLibraryDispatcher { class_hash: get_dep_component!(@self, Life).classes(game_id).season.read() }
                .register_relic_points(game_id, actor, crate::commands::action_context(context));
            self.record_chest_opened(game_id, actor, command, relics, points, context.timestamp);
        }

        fn pay_expedition_chest(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: OpenChest,
            context: ExecutionContext,
            rules: crate::relics::ChestRules,
        ) {
            let game = context.game.unbox();
            let game_rules = context.rules.unbox();
            let spacing = crate::logic::settlement::rules(game_id).spacing;
            let depth: u8 = (command.coord.y / spacing % 4).try_into().unwrap();
            let epoch = context.timestamp / game_rules.epoch_seconds.into();
            let old_pity = self.data.relics.chest_pity.read((game_id, actor, depth));
            let tokens = self.data.relics.chest_tokens.read((game_id, actor, epoch));
            let mut root = context.raw_root;
            let seed = crate::random::game_root(ref root, game_id, game.seed);
            let ground = crate::logic::expeditions::depth_rules(game_id, depth).chest;
            let roll = crate::relics::roll_chest(rules, ground, old_pity, tokens, seed, context.timestamp);
            let relic_id = self
                .grant_rolled_relic(game_id, command.explorer_id, roll, seed, context.timestamp, context);
            self.write_chest_counters(game_id, actor, depth, epoch, roll, old_pity, tokens);
            let reward = crate::relics::ChestReward {
                player: actor,
                explorer_id: command.explorer_id,
                epoch,
                depth,
                kind: roll.kind,
                quality: roll.quality,
                relic_id,
            };
            self.record_expedition_chest(game_id, reward, context.timestamp);
        }

        fn grant_rolled_relic(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            explorer_id: u32,
            roll: crate::relics::ChestRoll,
            seed: u256,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) -> u8 {
            if roll.kind == crate::relics::ChestKind::Relic {
                let drawn = *crate::relics::draw_relics(self.relic_rules(game_id), seed, timestamp + 41, 1).at(0);
                let strength = if roll.quality < 2 {
                    0
                } else {
                    1
                };
                let id = crate::relics::FIRST_RELIC + (drawn - crate::relics::FIRST_RELIC) / 2 * 2 + strength;
                self
                    .resources(game_id)
                    .grant_resource(
                        ResourceKey { game_id, entity_id: explorer_id },
                        id,
                        crate::rules::RESOURCE_PRECISION,
                        timestamp,
                        crate::commands::resource_context(game_context),
                    );
                id
            } else {
                0
            }
        }

        fn write_chest_counters(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            depth: u8,
            epoch: u64,
            roll: crate::relics::ChestRoll,
            old_pity: u16,
            tokens: u16,
        ) {
            if roll.pity != old_pity {
                self.data.relics.chest_pity.write((game_id, actor, depth), roll.pity);
                self
                    .emit(
                        crate::events::RowSet {
                            version: 1,
                            model: 'ChestPity',
                            keys: array![game_id.into(), actor.into(), depth.into()].span(),
                            values: array![roll.pity.into()].span(),
                        },
                    );
            }
            if roll.kind == crate::relics::ChestKind::Token {
                self.data.relics.chest_tokens.write((game_id, actor, epoch), tokens + 1);
                self
                    .emit(
                        crate::events::RowSet {
                            version: 1,
                            model: 'ChestTokens',
                            keys: array![game_id.into(), actor.into(), epoch.into()].span(),
                            values: array![(tokens + 1).into()].span(),
                        },
                    );
            }
        }

        fn record_expedition_chest(
            ref self: ComponentState<TContractState>, game_id: u32, reward: crate::relics::ChestReward, timestamp: u64,
        ) {
            let id = crate::logic::game::allocate_entity(game_id);
            if reward.kind != crate::relics::ChestKind::Relic {
                self.data.relics.chest_rewards.write((game_id, id), Some(reward));
                let mut values = array![];
                reward.serialize(ref values);
                self
                    .emit(
                        crate::events::RowSet {
                            version: 1,
                            model: 'ChestReward',
                            keys: array![game_id.into(), id.into()].span(),
                            values: values.span(),
                        },
                    );
            }
            self
                .emit(
                    crate::ownership::StoryEvent {
                        version: 1,
                        game_id,
                        id,
                        entity_id: Some(reward.explorer_id),
                        owner: Some(reward.player),
                        timestamp: timestamp,
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: crate::ownership::Story::ChestReward(reward),
                    },
                );
        }

        fn record_crafted_relic(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            structure_id: u32,
            relic: u8,
            timestamp: u64,
        ) {
            self
                .emit(
                    crate::ownership::StoryEvent {
                        version: 1,
                        game_id,
                        id: crate::logic::game::allocate_entity(game_id),
                        entity_id: Some(structure_id),
                        owner: Some(actor),
                        timestamp,
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: crate::ownership::Story::RelicCrafted(relic),
                    },
                );
        }
        fn record_chest_opened(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: OpenChest,
            relics: Span<u8>,
            points: u128,
            timestamp: u64,
        ) {
            self
                .emit(
                    crate::ownership::StoryEvent {
                        version: 1,
                        game_id,
                        id: crate::logic::game::allocate_entity(game_id),
                        entity_id: Some(command.explorer_id),
                        owner: Some(actor),
                        timestamp,
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: crate::ownership::Story::RelicChestOpened(
                            crate::relics::ChestOpened {
                                explorer_id: command.explorer_id, coord: command.coord, relics, points,
                            },
                        ),
                    },
                );
        }
        fn logic_classes(
            self: @ComponentState<TContractState>, game_id: u32,
        ) -> starknet::storage::StoragePointer<LogicClasses> {
            get_dep_component!(self, Life).classes(game_id)
        }
        fn resources(self: @ComponentState<TContractState>, game_id: u32) -> IResourceOperationsLibraryDispatcher {
            IResourceOperationsLibraryDispatcher { class_hash: self.logic_classes(game_id).resources.read() }
        }
        fn assert_command(
            self: @ComponentState<TContractState>,
            game_id: u32,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) {
            assert_playing(game_context.game.unbox(), timestamp);
        }
        fn apply_effect(
            self: @ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: ApplyRelic,
            rule: RelicRule,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) -> u32 {
            let classes = self.logic_classes(game_id);
            if command.recipient == Recipient::Explorer {
                let explorer = crate::logic::troops::authorized_explorer(
                    ExplorerKey { game_id, explorer_id: command.entity_id }, actor, timestamp, game_context,
                );
                IRelicTroopsLibraryDispatcher { class_hash: classes.troops.read() }
                    .apply_troop_relic(
                        game_id, actor, command, rule, timestamp, crate::commands::action_context(game_context),
                    );
                explorer.owner
            } else {
                let key = ResourceKey { game_id, entity_id: command.entity_id };
                assert!(crate::logic::structures::owner(key) == actor, "actor does not own structure");
                if command.recipient == Recipient::StructureProduction {
                    IRelicProductionLibraryDispatcher { class_hash: classes.production.read() }
                        .apply_production_relic(
                            key, command.relic_id, rule, timestamp, crate::commands::action_context(game_context),
                        );
                } else {
                    IRelicTroopsLibraryDispatcher { class_hash: classes.troops.read() }
                        .apply_troop_relic(
                            game_id, actor, command, rule, timestamp, crate::commands::action_context(game_context),
                        );
                }
                command.entity_id
            }
        }
    }
}
