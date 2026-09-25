#[starknet::component]
pub mod RelicState {
    use games_storage::release::LogicClasses;
    use starknet::ContractAddress;
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess};
    use crate::commands::ExecutionContext;
    use crate::game::{IPointsDispatcherTrait, IPointsLibraryDispatcher, assert_playing};
    use crate::logic::release::ReleaseState;
    use crate::logic::release::ReleaseState::InternalTrait as LifeInternalTrait;
    use crate::ownership::StoryResultTrait;
    use crate::relics::{
        ApplyRelic, IRelicMapDispatcherTrait, IRelicMapLibraryDispatcher, IRelicProductionDispatcherTrait,
        IRelicProductionLibraryDispatcher, IRelicTroopsDispatcherTrait, IRelicTroopsLibraryDispatcher, OpenChest,
        Recipient, RelicRule,
    };
    use crate::resources::{IResourceOperationsDispatcherTrait, IResourceOperationsLibraryDispatcher, ResourceKey};
    use crate::stamina::StaminaSourceTrait;
    use crate::troops::{ExplorerKey, ExplorerRecordTrait};

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
        fn chest_rules(self: @ComponentState<TContractState>, game_id: u32) -> Option<crate::relics::ChestRules> {
            crate::logic::preset_record::for_game(game_id).chest_rules.read()
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
            self: @ComponentState<TContractState>, game_id: u32, order: u64, index: u32,
        ) -> Option<crate::relics::ChestReward> {
            self.data.relics.chest_rewards.read((game_id, order, index))
        }
        fn grant_reveal_chest(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: OpenChest,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            let Some(rules) = self.chest_rules(game_id) else {
                return ((), story_cursor);
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
                self.pay_expedition_chest(game_id, actor, command, context, rules, ref story_cursor);
            }
            ((), story_cursor)
        }

        fn relic_rules(self: @ComponentState<TContractState>, game_id: u32) -> Span<RelicRule> {
            if self.chest_rules(game_id).is_some() {
                return array![].span();
            }
            let preset = crate::logic::preset_record::for_game(game_id);
            let mut rules = array![];
            for id in crate::relics::FIRST_RELIC..crate::relics::LAST_RELIC + 1 {
                rules.append(preset.relic_rules.read(id));
            }
            rules.span()
        }
        fn open_relic_chest(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: OpenChest,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            self.assert_command(game_id, context.timestamp, context);
            let classes = self.logic_classes(game_id);
            let explorer = crate::logic::troops::authorized_explorer(
                ExplorerKey { game_id, explorer_id: command.explorer_id }, actor, context.timestamp, context,
            );
            assert!(crate::geometry::adjacent(explorer.coord, command.coord), "explorer is not adjacent to chest");
            IRelicMapLibraryDispatcher { class_hash: classes.map.read() }.consume_relic_chest(game_id, command.coord);
            self.pay_chest(game_id, actor, command, context, ref story_cursor);
            ((), story_cursor)
        }
        fn grant_site_chest(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: OpenChest,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            assert_playing(context.game.unbox(), context.timestamp);
            crate::logic::troops::authorized_explorer(
                ExplorerKey { game_id, explorer_id: command.explorer_id }, actor, context.timestamp, context,
            );
            self.pay_chest(game_id, actor, command, context, ref story_cursor);
            ((), story_cursor)
        }
        fn apply_relic(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: ApplyRelic,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) {
            let context = crate::commands::load_context(game_id, context);

            self.assert_command(game_id, context.timestamp, context);
            assert!(
                command.relic_id >= crate::relics::FIRST_RELIC && command.relic_id <= crate::relics::LAST_RELIC,
                "invalid relic resource",
            );
            let preset = crate::logic::preset_record::for_game(game_id);
            let rule = preset.relic_rules.read(command.relic_id);
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
    #[embeddable_as(ArmyProgressionImpl)]
    pub impl ArmyProgression<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of crate::progression::IArmyProgression<ComponentState<TContractState>> {
        fn army_progress(
            self: @ComponentState<TContractState>, key: ExplorerKey,
        ) -> Option<crate::progression::ArmyProgress> {
            crate::logic::progression::read(key)
        }
        fn army_progression_rules(
            self: @ComponentState<TContractState>, game_id: u32,
        ) -> Option<crate::progression::ArmyProgressionRules> {
            crate::logic::progression::rules(game_id)
        }
        fn grant_army_xp(
            ref self: ComponentState<TContractState>,
            key: ExplorerKey,
            award: crate::progression::XpAward,
            context: crate::commands::ActionContext,
        ) {
            crate::logic::progression::award_xp(key, award, crate::commands::load_context(key.game_id, context));
        }
        fn choose_attribute(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: crate::progression::ChooseAttribute,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);
            self.assert_command(game_id, context.timestamp, context);
            let key = ExplorerKey { game_id, explorer_id: command.explorer_id };
            let explorer = crate::logic::troops::authorized_explorer(key, actor, context.timestamp, context);
            let mut progress = crate::logic::progression::require(key);
            let choice = crate::progression::apply_choice(ref progress, command);
            if choice.attribute == crate::progression::Attribute::Logistics {
                crate::logic::army_slots::grant_logistics(key, explorer.troops.stamina, choice.applied);
            }
            crate::logic::progression::offer_earned_level(key, ref progress, context);
            crate::logic::progression::write(key, progress);
            let index = crate::ownership::StoryCursorTrait::next(ref story_cursor);
            self
                .emit(
                    crate::ownership::StoryEvent {
                        version: 1,
                        game_id,
                        order: story_cursor.order,
                        index,
                        entity_id: Some(command.explorer_id),
                        owner: Some(actor),
                        timestamp: context.timestamp,
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: crate::ownership::Story::AttributeChosen(choice),
                    },
                );
            ((), story_cursor)
        }
    }
    #[embeddable_as(ArmySlotStaminaImpl)]
    pub impl ArmySlotStamina<
        TContractState, +HasComponent<TContractState>, +Drop<TContractState>,
    > of crate::troops::IArmySlotStamina<ComponentState<TContractState>> {
        fn army_slot_stamina(
            ref self: ComponentState<TContractState>, key: ExplorerKey, action: crate::troops::ArmySlotAction,
        ) -> crate::troops::ResolvedArmySlot {
            use crate::troops::{ArmySlotAction, ResolvedArmySlot};
            use crate::logic::army_slot_storage;
            if let ArmySlotAction::Allocate(value) = action {
                crate::logic::progression::create(key);
                return ResolvedArmySlot {
                    stamina: army_slot_storage::allocate(
                        key, value.home, value.epoch, value.allowance, value.initial, value.maximum,
                    ),
                    battle_bonus_percent: 0,
                };
            }
            let mut explorer = crate::logic::troops::explorer(key).expect('missing slot explorer');
            let mut battle_bonus_percent = 0;
            let stamina = match action {
                ArmySlotAction::Resolve(timestamp) => {
                    battle_bonus_percent = Into::<u8, u16>::into(crate::logic::progression::require(key).battle - 1)
                        * crate::rules::ATTRIBUTE_DAMAGE_PERCENT.into();
                    army_slot_storage::resolve(key, explorer, timestamp).troops.stamina
                },
                ArmySlotAction::Persist(stamina) => {
                    let previous = explorer.into_record();
                    explorer.troops.stamina = stamina;
                    army_slot_storage::persist(key, previous, explorer.troops).stamina
                },
                ArmySlotAction::Release(stamina) => {
                    explorer.troops.stamina = stamina;
                    army_slot_storage::release(key, explorer);
                    crate::logic::progression::destroy(key);
                    stamina
                },
                ArmySlotAction::GrantLogistics(award) => army_slot_storage::grant_logistics(key, explorer, award),
                ArmySlotAction::Allocate(_) => panic!("allocation already handled"),
            };
            ResolvedArmySlot { stamina, battle_bonus_percent }
        }
    }

    #[embeddable_as(CaptureRewardsImpl)]
    pub impl CaptureRewards<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of crate::relics::ICaptureRewards<ComponentState<TContractState>> {
        fn grant_capture_rewards(
            ref self: ComponentState<TContractState>,
            site: ResourceKey,
            explorer_id: u32,
            category: u8,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(site.game_id, context);
            let explorer_key = ExplorerKey { game_id: site.game_id, explorer_id };
            let explorer = crate::logic::troops::active_explorer(explorer_key, context.timestamp, context);
            self.refund_capture_stamina(explorer_key, explorer, context);
            self.pay_capture_rewards(site, explorer_key, explorer.owner, category, context, ref story_cursor);
            ((), story_cursor)
        }
    }
    #[embeddable_as(ArtificerImpl)]
    pub impl Artificer<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of crate::artificer::IArtificer<ComponentState<TContractState>> {
        fn artificer_cost(self: @ComponentState<TContractState>, game_id: u32) -> u128 {
            crate::logic::preset_record::for_game(game_id).artificer_cost.read()
        }
        fn craft_relic(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            structure_id: u32,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
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
            self.record_crafted_relic(game_id, actor, structure_id, relic, context.timestamp, ref story_cursor);
            ((), story_cursor)
        }
    }
    #[generate_trait]
    pub impl InternalImpl<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of InternalTrait<TContractState> {
        fn refund_capture_stamina(
            self: @ComponentState<TContractState>,
            key: ExplorerKey,
            mut explorer: crate::troops::ExplorerTroops,
            context: ExecutionContext,
        ) {
            let rules = context.rules.unbox();
            let refund = rules.troop_stamina_config.capture_stamina_refund;
            if refund == 0 {
                return;
            }
            explorer
                .troops
                .stamina
                .add(
                    ref explorer.troops.boosts,
                    explorer.troops.category,
                    explorer.troops.tier,
                    rules.troop_stamina_config,
                    refund.into(),
                    context.timestamp / rules.tick_config.armies_tick_in_seconds,
                );
            crate::logic::troops::TroopState::save(key, crate::troops::ExplorerRecordTrait::into_record(explorer));
        }

        fn pay_capture_rewards(
            ref self: ComponentState<TContractState>,
            site: ResourceKey,
            explorer_key: ExplorerKey,
            home_id: u32,
            category: u8,
            context: ExecutionContext,
            ref story_cursor: crate::ownership::StoryCursor,
        ) {
            let rules = context.rules.unbox();
            let camp = category == crate::camps::CAMP_CATEGORY;
            if rules.epoch_seconds != 0 && (camp || category == 4) {
                crate::logic::progression::award_xp(explorer_key, crate::progression::XpAward::Clear, context);
            }
            let home_rewards = camp && crate::rules::rule_enabled(rules, crate::rules::HOME_CAMP_REWARDS);
            let chests = crate::rules::rule_enabled(rules, crate::rules::CAPTURE_CHESTS);
            if !home_rewards && !chests {
                return;
            }
            let coord = crate::structures::structure_coord(site);
            let depth = if crate::rules::rule_enabled(rules, crate::rules::DEPTH_CONTENTS) {
                Some(crate::logic::expeditions::depth_rules_at(site.game_id, coord))
            } else {
                None
            };
            let home = ResourceKey { game_id: site.game_id, entity_id: home_id };
            if home_rewards {
                self.pay_camp_resources(home, context);
            }
            let mine_chest = category == 4 && depth.map(|value| value.mine_chest).unwrap_or(false);
            if chests && (camp || mine_chest) {
                let actor = crate::logic::structures::structure(home).expect('missing home structure').owner;
                self
                    .grant_site_chest(
                        site.game_id,
                        actor,
                        OpenChest { explorer_id: explorer_key.explorer_id, coord },
                        crate::commands::action_context(context),
                        story_cursor,
                    )
                    .resume_story(ref story_cursor);
            }
        }

        fn pay_camp_resources(self: @ComponentState<TContractState>, home: ResourceKey, context: ExecutionContext) {
            for reward in crate::camps::ICampRulesDispatcherTrait::camp_resources(
                crate::camps::ICampRulesLibraryDispatcher {
                    class_hash: self.logic_classes(home.game_id).structures.read(),
                },
                home.game_id,
            ) {
                self
                    .resources(home.game_id)
                    .grant_resource(
                        home,
                        *reward.resource_type,
                        *reward.amount,
                        context.timestamp,
                        crate::commands::resource_context(context),
                    );
            }
        }

        fn pay_chest(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: OpenChest,
            context: ExecutionContext,
            ref story_cursor: crate::ownership::StoryCursor,
        ) {
            if let Some(rules) = self.chest_rules(game_id) {
                self.pay_expedition_chest(game_id, actor, command, context, rules, ref story_cursor);
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
            self.record_chest_opened(game_id, actor, command, relics, points, context.timestamp, ref story_cursor);
        }

        fn pay_expedition_chest(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: OpenChest,
            context: ExecutionContext,
            rules: crate::relics::ChestRules,
            ref story_cursor: crate::ownership::StoryCursor,
        ) {
            let explorer_key = ExplorerKey { game_id, explorer_id: command.explorer_id };
            crate::logic::progression::assert_can_receive_offer(crate::logic::progression::require(explorer_key));
            let game = context.game.unbox();
            let game_rules = context.rules.unbox();
            let spacing = crate::logic::settlement::rules(game_id).spacing;
            let depth: u8 = (command.coord.y / spacing % 4).try_into().unwrap();
            let epoch = crate::expeditions::absolute_epoch(game_rules.epoch_seconds, context.timestamp);
            let old_pity = self.data.relics.chest_pity.read((game_id, actor, depth));
            let tokens = self.data.relics.chest_tokens.read((game_id, actor, epoch));
            let mut root = context.raw_root;
            let seed = crate::random::game_root(ref root, game_id, game.seed);
            let ground = crate::logic::expeditions::depth_rules(game_id, depth).chest;
            let roll = crate::relics::roll_chest(rules, ground, old_pity, tokens, seed, context.timestamp);
            if roll.kind == crate::relics::ChestKind::Relic {
                crate::logic::progression::grant_relic(explorer_key, roll.quality, context);
            }
            self.write_chest_counters(game_id, actor, depth, epoch, roll, old_pity, tokens);
            let reward = crate::relics::ChestReward {
                player: actor, explorer_id: command.explorer_id, epoch, depth, kind: roll.kind, quality: roll.quality,
            };
            self.record_expedition_chest(game_id, reward, context.timestamp, ref story_cursor);
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
            ref self: ComponentState<TContractState>,
            game_id: u32,
            reward: crate::relics::ChestReward,
            timestamp: u64,
            ref story_cursor: crate::ownership::StoryCursor,
        ) {
            let order = story_cursor.order;
            let index = crate::ownership::StoryCursorTrait::next(ref story_cursor);
            if reward.kind != crate::relics::ChestKind::Relic {
                self.data.relics.chest_rewards.write((game_id, order, index), Some(reward));
                let mut values = array![];
                reward.serialize(ref values);
                self
                    .emit(
                        crate::events::RowSet {
                            version: 1,
                            model: 'ChestReward',
                            keys: array![game_id.into(), order.into(), index.into()].span(),
                            values: values.span(),
                        },
                    );
            }
            self
                .emit(
                    crate::ownership::StoryEvent {
                        version: 1,
                        game_id,
                        order,
                        index,
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
            ref story_cursor: crate::ownership::StoryCursor,
        ) {
            self
                .emit(
                    crate::ownership::StoryEvent {
                        version: 1,
                        game_id,
                        order: story_cursor.order,
                        index: crate::ownership::StoryCursorTrait::next(ref story_cursor),
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
            ref story_cursor: crate::ownership::StoryCursor,
        ) {
            self
                .emit(
                    crate::ownership::StoryEvent {
                        version: 1,
                        game_id,
                        order: story_cursor.order,
                        index: crate::ownership::StoryCursorTrait::next(ref story_cursor),
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
