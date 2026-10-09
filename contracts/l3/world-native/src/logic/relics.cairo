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
            let context = crate::commands::load_context(game_id, context);

            self.assert_command(game_id, context.timestamp, context);
            let classes = self.logic_classes(game_id);
            let explorer = crate::logic::troops::authorized_explorer(
                ExplorerKey { game_id, explorer_id: command.explorer_id }, actor, context.timestamp, context,
            );
            assert!(explorer.troops.count != 0, "explorer is dead");
            assert!(crate::geometry::adjacent(explorer.coord, command.coord), "explorer is not adjacent to chest");
            IRelicMapLibraryDispatcher { class_hash: classes.map.read() }.consume_relic_chest(game_id, command.coord);
            self.pay_chest(game_id, actor, command, context);
            ()
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
            ref self: ComponentState<TContractState>, key: ExplorerKey, award: crate::progression::XpAward,
        ) {
            crate::logic::progression::award_xp(key, award);
        }
        fn buy_tier(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: crate::progression::BuyTier,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::load_context(game_id, context);
            self.assert_command(game_id, context.timestamp, context);
            let key = ExplorerKey { game_id, explorer_id: command.explorer_id };
            let explorer = crate::logic::troops::authorized_explorer(key, actor, context.timestamp, context);
            let mut progress = crate::logic::progression::require(key);
            let bought = crate::progression::buy_tier(
                ref progress, crate::logic::progression::rules(game_id).expect('missing progression rules'), command,
            );
            crate::logic::progression::write(key, progress);
            self.grant_stamina(key, explorer, crate::rules::TIER_STAMINA_REFILL, context);
            self
                .emit(
                    crate::ownership::StoryEvent {
                        version: 2,
                        game_id,
                        entity_id: Some(command.explorer_id),
                        owner: Some(actor),
                        timestamp: context.timestamp,
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: crate::ownership::Story::TierBought(bought),
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
            let context = crate::commands::load_context(game_id, context);
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
            if category == crate::taxonomy::SHRINE_OCCUPIER {
                crate::logic::progression::grant_fixed_xp(key);
            } else {
                self.grant_stamina(key, explorer, crate::rules::WELL_STAMINA, context);
            }
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
        // A full refill at 1 LORDS per missing stamina point, paid from the realm's LORDS back into the season pool.
        // It is always allowed, including while the day's ruin stands.
        fn refill_stamina(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: crate::relics::RefillStamina,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::load_context(game_id, context);
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
            let missing: u128 = (maximum - stamina.amount).into();
            self
                .resources(game_id)
                .spend_resource(
                    ResourceKey { game_id, entity_id: explorer.owner },
                    crate::resources::LORDS,
                    missing * crate::rules::RESOURCE_PRECISION,
                    context.timestamp,
                    crate::commands::resource_context(context),
                );
            crate::logic::lords_budget::return_to_pool(game_id, missing, context);
            stamina.amount = maximum;
            crate::troops::IArmySlotStaminaDispatcherTrait::army_slot_stamina(
                crate::troops::IArmySlotStaminaLibraryDispatcher {
                    class_hash: self.logic_classes(game_id).relics.read(),
                },
                key,
                crate::troops::ArmySlotAction::Persist(crate::troops::StaminaSource::Inline(stamina)),
            );
            ()
        }

        // Whole LORDS leave the realm and are recorded for fulfilment on L2.
        fn withdraw_lords(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: crate::relics::WithdrawLords,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::load_context(game_id, context);
            crate::relics::assert_claim_window(
                context.game.unbox(), crate::logic::lords_budget::chest_rules(game_id), context.timestamp,
            );
            assert!(command.amount != 0, "zero LORDS withdrawal");
            let realm = ResourceKey { game_id, entity_id: command.structure_id };
            let record = crate::logic::structures::record(realm);
            assert!(record.base.category == crate::taxonomy::REALM_CATEGORY, "withdrawal requires a realm");
            assert!(record.owner == actor, "actor does not own structure");
            self
                .resources(game_id)
                .spend_resource(
                    realm,
                    crate::resources::LORDS,
                    command.amount * crate::rules::RESOURCE_PRECISION,
                    context.timestamp,
                    crate::commands::resource_context(context),
                );
            let withdrawal = crate::relics::LordsWithdrawal { account: actor, amount: command.amount };
            self.record_lords_withdrawal(realm, withdrawal, context.timestamp);
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
                let maximum = crate::progression::stamina_max(
                    progress, value.category, crate::logic::game::rules(key.game_id).troop_stamina_config,
                );
                let initial = crate::troops::Stamina { amount: maximum, ..value.initial };
                return ResolvedArmySlot {
                    stamina: army_slot_storage::allocate(
                        key, value.home, value.epoch, value.allowance, initial, maximum,
                    ),
                    battle_bonus_percent: 0,
                };
            }
            let mut explorer = crate::logic::troops::explorer(key).expect('missing slot explorer');
            let mut battle_bonus_percent = 0;
            let stamina = match action {
                ArmySlotAction::Resolve(timestamp) => {
                    battle_bonus_percent =
                        crate::rules::battle_bonus_bps(crate::logic::progression::require(key).battle)
                        .try_into()
                        .unwrap();
                    army_slot_storage::resolve(key, explorer, timestamp).troops.stamina
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
            let context = crate::commands::load_context(site.game_id, context);
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
            let context = crate::commands::load_context(game_id, context);

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
            let seed = crate::random::game_root(ref root, game_id, context.game.unbox().seed);
            let relic = *crate::relics::draw_relics(self.relic_rules(game_id), seed, 1).at(0);
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
        /// Adds stamina to a slot army's bar, up to its own maximum: a well's, and a bought tier's.
        fn grant_stamina(
            self: @ComponentState<TContractState>,
            key: ExplorerKey,
            explorer: crate::troops::ExplorerTroops,
            amount: u8,
            context: ExecutionContext,
        ) {
            let progress = crate::logic::progression::require(key);
            let maximum = crate::progression::stamina_max(
                progress, explorer.troops.category, context.rules.unbox().troop_stamina_config,
            );
            let mut stamina = explorer.troops.stamina.inline();
            stamina.amount = core::cmp::min(maximum, stamina.amount + amount.into());
            crate::troops::IArmySlotStaminaDispatcherTrait::army_slot_stamina(
                crate::troops::IArmySlotStaminaLibraryDispatcher {
                    class_hash: self.logic_classes(key.game_id).relics.read(),
                },
                key,
                crate::troops::ArmySlotAction::Persist(crate::troops::StaminaSource::Inline(stamina)),
            );
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
                    context.timestamp / rules.tick_config.armies_tick_in_seconds,
                );
            crate::logic::troops::TroopState::save(key, crate::troops::ExplorerRecordTrait::into_record(explorer));
        }

        fn pay_chest(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: OpenChest,
            context: ExecutionContext,
        ) {
            let mut root = context.raw_root;
            let seed = crate::random::game_root(ref root, game_id, context.game.unbox().seed);
            let config = context.rules.unbox();
            let relics = crate::relics::draw_relics(
                self.relic_rules(game_id), seed, config.map_config.relic_chest_relics_per_chest,
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
                        version: 2,
                        game_id,
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
