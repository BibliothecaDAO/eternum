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
    use crate::stamina::{StaminaSourceTrait, StaminaTrait};
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
        fn lords_budget(self: @ComponentState<TContractState>, game_id: u32) -> Option<crate::relics::LordsBudget> {
            crate::logic::lords_budget::budget(game_id)
        }
        fn chest_rules(self: @ComponentState<TContractState>, game_id: u32) -> Option<crate::relics::ChestRules> {
            crate::logic::preset_record::for_game(game_id).rollover_chest_rules.read()
        }
        fn site_chest(self: @ComponentState<TContractState>, key: ResourceKey) -> Option<crate::relics::SiteChest> {
            crate::logic::lords_budget::site_chest(key)
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
        ) -> () {
            let context = crate::commands::execution_context(game_id, context);

            self.assert_command(game_id, context.timestamp, context);
            let classes = self.logic_classes(game_id);
            let explorer = crate::logic::troops::authorized_explorer(
                ExplorerKey { game_id, explorer_id: command.explorer_id }, actor, context.timestamp, context,
            );
            assert!(explorer.troops.count != 0, "explorer is dead");
            assert!(crate::geometry::adjacent(explorer.coord, command.coord), "explorer is not adjacent to chest");
            let chest_id = IRelicMapLibraryDispatcher { class_hash: classes.map.read() }
                .consume_relic_chest(game_id, command.coord);
            if context.rules.unbox().day_unit_seconds != 0 {
                self.pay_reward_chest(game_id, actor, command, chest_id, explorer.owner, context);
            } else {
                self.pay_chest(game_id, actor, command, chest_id, explorer.owner, context);
            }
            ()
        }
        fn apply_relic(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: ApplyRelic,
            context: crate::commands::ActionContext,
        ) {
            let context = crate::commands::execution_context(game_id, context);

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
            self.record_activation(game_id, actor, command, rule, context);
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
            ref self: ComponentState<TContractState>, key: ExplorerKey, award: crate::progression::XpAward,
        ) {
            crate::logic::progression::award_xp(key, award);
        }
        fn spend_skill_point(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: crate::progression::SpendSkillPoint,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::execution_context(game_id, context);
            self.assert_command(game_id, context.timestamp, context);
            let key = ExplorerKey { game_id, explorer_id: command.explorer_id };
            let explorer = crate::logic::troops::authorized_explorer(key, actor, context.timestamp, context);
            let mut progress = crate::logic::progression::require(key);
            if let crate::progression::SkillPointUse::Stamina(_) = command.choice {
                let maximum = crate::progression::stamina_max(
                    progress, explorer.troops.category, context.rules.unbox().troop_stamina_config,
                );
                assert!(explorer.troops.stamina.inline().amount < maximum, "stamina is full");
            }
            let mut bought = crate::progression::spend_skill_point(ref progress, command);
            crate::logic::progression::write(key, progress);
            bought.stamina = self.grant_stamina(key, explorer, bought.stamina.try_into().unwrap(), context);
            self
                .emit(
                    crate::ownership::StoryEvent {
                        version: 2,
                        game_id,
                        entity_id: Some(command.explorer_id),
                        owner: Some(actor),
                        timestamp: context.timestamp,
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: crate::ownership::Story::SkillPointSpent(bought),
                    },
                );
            ()
        }
    }
    #[embeddable_as(FrontierSitesImpl)]
    pub impl FrontierSites<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of crate::relics::IFrontierSites<ComponentState<TContractState>> {
        fn interact_site(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: crate::relics::InteractSite,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::execution_context(game_id, context);
            self.assert_command(game_id, context.timestamp, context);
            assert!(context.rules.unbox().day_unit_seconds != 0, "site requires expedition");
            let key = ExplorerKey { game_id, explorer_id: command.explorer_id };
            let explorer = crate::logic::troops::authorized_explorer(key, actor, context.timestamp, context);
            assert!(explorer.troops.count != 0, "explorer is dead");
            crate::expeditions::assert_same_region(
                explorer.coord, command.coord, crate::logic::settlement::rules(game_id).spacing,
            );
            assert!(crate::geometry::adjacent(explorer.coord, command.coord), "explorer is not adjacent to site");
            let category = crate::expeditions::IFrontierDiscoveryDispatcherTrait::consume_frontier_site(
                crate::expeditions::IFrontierDiscoveryLibraryDispatcher {
                    class_hash: self.logic_classes(game_id).map.read(),
                },
                crate::geometry::tile_key(game_id, command.coord),
            );
            let benefit = if category == crate::taxonomy::SHRINE_OCCUPIER {
                crate::relics::SiteBenefit::Shrine(crate::logic::progression::grant_fixed_xp(key))
            } else {
                crate::relics::SiteBenefit::Well(self.grant_stamina(key, explorer, crate::rules::WELL_STAMINA, context))
            };
            self
                .emit(
                    crate::ownership::StoryEvent {
                        version: 2,
                        game_id,
                        entity_id: Some(command.explorer_id),
                        owner: Some(actor),
                        timestamp: context.timestamp,
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: crate::ownership::Story::SiteUsed(
                            crate::relics::SiteUsed { explorer_id: command.explorer_id, coord: command.coord, benefit },
                        ),
                    },
                );
            ()
        }
    }

    #[embeddable_as(LordsImpl)]
    pub impl Lords<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of crate::relics::ILords<ComponentState<TContractState>> {
        // Each purchased stamina point returns one LORDS from the realm to the season's chest pool.
        // It is always allowed, including while the day's ruin stands.
        fn refill_stamina(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: crate::relics::RefillStamina,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::execution_context(game_id, context);
            self.assert_command(game_id, context.timestamp, context);
            let key = ExplorerKey { game_id, explorer_id: command.explorer_id };
            let explorer = crate::logic::troops::authorized_explorer(key, actor, context.timestamp, context);
            assert!(explorer.troops.count != 0, "explorer is dead");
            let maximum = crate::progression::stamina_max(
                crate::logic::progression::require(key),
                explorer.troops.category,
                context.rules.unbox().troop_stamina_config,
            );
            let mut stamina = explorer.troops.stamina.inline();
            assert!(stamina.amount < maximum, "stamina is already full");
            assert!(command.amount > 0 && command.amount <= maximum - stamina.amount, "invalid refill amount");
            let purchased: u128 = command.amount.into();
            self
                .resources(game_id)
                .spend_resource(
                    ResourceKey { game_id, entity_id: explorer.owner },
                    crate::resources::LORDS,
                    purchased * crate::rules::RESOURCE_PRECISION,
                    context.timestamp,
                    crate::commands::resource_context(context),
                );
            crate::logic::lords_budget::return_to_pool(game_id, purchased, context);
            stamina.amount += command.amount;
            stamina.clamp(maximum);
            crate::troops::IArmySlotStaminaDispatcherTrait::army_slot_stamina(
                crate::troops::IArmySlotStaminaLibraryDispatcher {
                    class_hash: self.logic_classes(game_id).relics.read(),
                },
                key,
                crate::troops::ArmySlotAction::Persist(crate::troops::StaminaSource::Inline(stamina)),
            );
            ()
        }

        fn sweep_lords(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            structure_id: u64,
            context: crate::commands::ActionContext,
        ) {
            crate::logic::entry::assert_ledger_operator();
            let context = crate::commands::execution_context(game_id, context);
            let realm = ResourceKey { game_id, entity_id: structure_id };
            let record = crate::logic::structures::record(realm);
            assert!(record.base.category == crate::taxonomy::REALM_CATEGORY, "withdrawal requires a realm");
            let balance = crate::logic::resources::balance(realm, crate::resources::LORDS);
            assert!(balance % crate::rules::RESOURCE_PRECISION == 0, "fractional realm LORDS");
            if balance == 0 {
                return;
            }
            self.withdraw_realm_lords(realm, record.owner, balance / crate::rules::RESOURCE_PRECISION, context);
        }

        // Whole LORDS leave the realm and are recorded for fulfilment on L2.
        fn withdraw_lords(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: crate::relics::WithdrawLords,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::execution_context(game_id, context);
            crate::relics::assert_claim_window(
                context.game.unbox(), crate::logic::lords_budget::chest_rules(game_id), context.timestamp,
            );
            assert!(command.amount != 0, "zero LORDS withdrawal");
            let realm = ResourceKey { game_id, entity_id: command.structure_id };
            let record = crate::logic::structures::record(realm);
            assert!(record.base.category == crate::taxonomy::REALM_CATEGORY, "withdrawal requires a realm");
            assert!(record.owner == actor, "actor does not own structure");
            self.withdraw_realm_lords(realm, actor, command.amount, context);
            ()
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
                let home = crate::resources::ResourceKey { game_id: key.game_id, entity_id: value.home };
                let progress = crate::logic::progression::create(key, crate::logic::research::learned(home));
                // A slot's first army of the day starts full at its own maximum, trained Logistics included.
                let maximum = crate::progression::stamina_max(progress, value.category, value.stamina_config);
                let initial = crate::troops::Stamina { amount: maximum, ..value.initial };
                return ResolvedArmySlot {
                    stamina: army_slot_storage::allocate(
                        key, value.home, value.epoch, value.allowance, value.slot, initial, maximum,
                    ),
                    battle_bonus_percent: 0,
                };
            }
            let mut explorer = crate::logic::troops::explorer(key).expect('missing slot explorer');
            let mut battle_bonus_percent = 0;
            let stamina = match action {
                ArmySlotAction::Resolve(refill) => {
                    battle_bonus_percent =
                        crate::rules::battle_bonus_bps(crate::logic::progression::require(key).battle)
                        .try_into()
                        .unwrap();
                    army_slot_storage::resolve(key, explorer, refill).troops.stamina
                },
                ArmySlotAction::Persist(stamina) => {
                    let previous = explorer.into_record();
                    explorer.troops.stamina = stamina;
                    army_slot_storage::persist(key, previous, explorer.troops).stamina
                },
                ArmySlotAction::Release(stamina) => {
                    if let crate::troops::StaminaSource::Slot(_) = explorer.troops.stamina {
                        crate::logic::progression::destroy(key);
                    }
                    explorer.troops.stamina = stamina;
                    army_slot_storage::release(key, explorer);
                    stamina
                },
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
            explorer_id: u64,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::execution_context(site.game_id, context);
            let explorer_key = ExplorerKey { game_id: site.game_id, explorer_id };
            let explorer = crate::logic::troops::active_explorer(explorer_key, context.timestamp, context);
            self.refund_capture_stamina(explorer_key, explorer, context);
            if context.rules.unbox().day_unit_seconds != 0 {
                crate::expeditions::ISiteRewardsDispatcherTrait::pay_expedition_site(
                    crate::expeditions::ISiteRewardsLibraryDispatcher {
                        class_hash: self.logic_classes(site.game_id).resources.read(),
                    },
                    site,
                    explorer_key,
                    explorer.owner,
                    crate::commands::action_context(context),
                );
            }
            ()
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
            structure_id: u64,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::execution_context(game_id, context);

            self.assert_command(game_id, context.timestamp, context);
            let key = ResourceKey { game_id, entity_id: structure_id };
            let structure = crate::logic::structures::structure(key).expect('missing structure');
            assert!(
                structure.base.category == crate::taxonomy::REALM_CATEGORY
                    || structure.base.category == crate::taxonomy::VILLAGE_CATEGORY,
                "structure is not a realm or village",
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
            let seed = crate::random::game_root(ref root, game_id);
            let relic = crate::relics::draw_relic(self.relic_rules(game_id), seed);
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
            ()
        }
    }
    #[generate_trait]
    pub impl InternalImpl<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of InternalTrait<TContractState> {
        /// Adds stamina to a slot army's bar, up to its own maximum: a well's or a skill point's.
        fn grant_stamina(
            self: @ComponentState<TContractState>,
            key: ExplorerKey,
            explorer: crate::troops::ExplorerTroops,
            amount: u8,
            context: ExecutionContext,
        ) -> u64 {
            let progress = crate::logic::progression::require(key);
            let maximum = crate::progression::stamina_max(
                progress, explorer.troops.category, context.rules.unbox().troop_stamina_config,
            );
            let mut stamina = explorer.troops.stamina.inline();
            let before = stamina.amount;
            stamina.amount += amount.into();
            stamina.clamp(maximum);
            crate::troops::IArmySlotStaminaDispatcherTrait::army_slot_stamina(
                crate::troops::IArmySlotStaminaLibraryDispatcher {
                    class_hash: self.logic_classes(key.game_id).relics.read(),
                },
                key,
                crate::troops::ArmySlotAction::Persist(crate::troops::StaminaSource::Inline(stamina)),
            );
            stamina.amount - before
        }

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
                    crate::logic::progression::own_stamina_max(key, explorer.troops, rules.troop_stamina_config),
                    rules.troop_stamina_config,
                    refund.into(),
                    rules.tick_config.armies_tick_in_seconds,
                    context.timestamp,
                );
            crate::logic::troops::TroopState::save(key, crate::troops::ExplorerRecordTrait::into_record(explorer));
        }

        fn pay_reward_chest(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: OpenChest,
            chest_id: u64,
            home: u64,
            context: ExecutionContext,
        ) {
            let reward = crate::logic::lords_budget::pay(ResourceKey { game_id, entity_id: chest_id }, context);
            self
                .resources(game_id)
                .grant_resource(
                    ResourceKey { game_id, entity_id: home },
                    reward.resource_type,
                    reward.amount,
                    context.timestamp,
                    crate::commands::resource_context(context),
                );
            crate::logic::stories::emit_entity_story(
                ResourceKey { game_id, entity_id: command.explorer_id },
                actor,
                crate::ownership::Story::RewardChestOpened(
                    crate::relics::RewardChestOpened {
                        explorer_id: command.explorer_id,
                        structure_id: home,
                        coord: command.coord,
                        amount: reward.amount / crate::rules::RESOURCE_PRECISION,
                    },
                ),
                context.timestamp,
            );
        }

        fn pay_chest(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: OpenChest,
            chest_id: u64,
            home: u64,
            context: ExecutionContext,
        ) {
            let config = context.rules.unbox();
            let chest = crate::logic::relic_chests::take(ResourceKey { game_id, entity_id: chest_id });
            let relics = crate::relics::pack_relics(chest);
            let army = ResourceKey { game_id, entity_id: command.explorer_id };
            let realm = ResourceKey { game_id, entity_id: home };
            for id in relics {
                let holder = if crate::relics::is_army_relic(*id) {
                    army
                } else {
                    realm
                };
                self
                    .resources(game_id)
                    .grant_resource(
                        holder,
                        *id,
                        crate::rules::RESOURCE_PRECISION,
                        context.timestamp,
                        crate::commands::resource_context(context),
                    );
            }
            let points = config.victory_points_grant_config.relic_open_points.into();
            IPointsLibraryDispatcher { class_hash: get_dep_component!(@self, Life).classes(game_id).season.read() }
                .register_relic_points(game_id, actor, crate::commands::action_context(context));
            self.record_chest_opened(game_id, actor, command, chest, relics, points, context.timestamp);
        }

        fn withdraw_realm_lords(
            ref self: ComponentState<TContractState>,
            realm: ResourceKey,
            account: ContractAddress,
            amount: u128,
            context: ExecutionContext,
        ) {
            assert!(account != 0.try_into().unwrap(), "withdrawal owner missing");
            self
                .resources(realm.game_id)
                .spend_resource(
                    realm,
                    crate::resources::LORDS,
                    amount * crate::rules::RESOURCE_PRECISION,
                    context.timestamp,
                    crate::commands::resource_context(context),
                );
            self
                .record_lords_withdrawal(
                    realm,
                    crate::relics::LordsWithdrawal { account, amount, prize_rank: 0, prize_count: 0 },
                    context.timestamp,
                );
        }

        fn record_lords_withdrawal(
            ref self: ComponentState<TContractState>,
            realm: ResourceKey,
            withdrawal: crate::relics::LordsWithdrawal,
            timestamp: u64,
        ) {
            let claim_id = starknet::get_tx_info().unbox().transaction_hash;
            assert!(self.data.relics.lords_withdrawals.read(claim_id).is_none(), "withdrawal already recorded");
            self.data.relics.lords_withdrawals.write(claim_id, Some(withdrawal));
            let mut values = array![];
            withdrawal.serialize(ref values);
            self
                .emit(
                    crate::events::RowSet {
                        version: 1,
                        model: 'LordsWithdrawal',
                        keys: array![realm.game_id.into(), claim_id].span(),
                        values: values.span(),
                    },
                );
            self
                .emit(
                    crate::ownership::StoryEvent {
                        version: 2,
                        game_id: realm.game_id,
                        entity_id: Some(realm.entity_id),
                        owner: Some(withdrawal.account),
                        timestamp,
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: crate::ownership::Story::LordsWithdrawn(withdrawal),
                    },
                );
        }

        fn record_crafted_relic(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            structure_id: u64,
            relic: u8,
            timestamp: u64,
        ) {
            self
                .emit(
                    crate::ownership::StoryEvent {
                        version: 2,
                        game_id,
                        entity_id: Some(structure_id),
                        owner: Some(actor),
                        timestamp,
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: crate::ownership::Story::RelicCrafted(relic),
                    },
                );
        }
        fn record_activation(
            self: @ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: ApplyRelic,
            rule: RelicRule,
            context: ExecutionContext,
        ) {
            let ticks: u64 = match command.relic_id {
                39 | 40 => rule.uses.into(),
                45 | 46 => 0,
                _ => rule.duration.into(),
            };
            crate::logic::stories::emit_entity_story(
                ResourceKey { game_id, entity_id: command.entity_id },
                actor,
                crate::ownership::Story::RelicActivated(
                    crate::relics::RelicActivated {
                        relic_id: command.relic_id,
                        recipient: command.recipient,
                        rate_bps: rule.rate_bps,
                        duration_seconds: ticks * context.rules.unbox().tick_config.armies_tick_in_seconds,
                        radius: if command.relic_id == 45 || command.relic_id == 46 {
                            rule.uses
                        } else {
                            0
                        },
                    },
                ),
                context.timestamp,
            );
        }
        fn record_chest_opened(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: OpenChest,
            chest: crate::relics::RelicChest,
            relics: Span<u8>,
            points: u128,
            timestamp: u64,
        ) {
            self
                .emit(
                    crate::ownership::StoryEvent {
                        version: 2,
                        game_id,
                        entity_id: Some(command.explorer_id),
                        owner: Some(actor),
                        timestamp,
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: crate::ownership::Story::RelicChestOpened(
                            crate::relics::ChestOpened {
                                explorer_id: command.explorer_id, coord: command.coord, chest, relics, points,
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
        ) -> u64 {
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
