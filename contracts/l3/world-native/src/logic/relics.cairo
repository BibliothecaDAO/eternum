use crate::stamina::StaminaSourceTrait;

#[starknet::component]
pub mod RelicState {
    use starknet::ContractAddress;
    use crate::commands::ExecutionContext;
    use crate::game::assert_playing;
    use crate::logic::release::ReleaseState;
    use crate::relics::ApplyRelic;
    use crate::resources::ResourceKey;
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
        fn apply_relic(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: ApplyRelic,
            context: crate::commands::ActionContext,
        ) {
            let context = crate::commands::execution_context(game_id, context);

            self.assert_command(game_id, context.timestamp, context);
            self.activate_army_relic(game_id, actor, command, context);
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
        ) {
            let execution = crate::commands::execution_context(game_id, context);
            self.assert_command(game_id, execution.timestamp, execution);
            if crate::logic::deep::contains(game_id, command.coord) {
                crate::deep::IDeepSitesDispatcherTrait::join_deep_site(
                    crate::logic::deep_sites::dispatcher(game_id), game_id, actor, command, context,
                );
                return;
            }
            super::use_frontier_site(actor, command, context, execution);
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
                let progress = crate::logic::progression::create(
                    key, crate::logic::research::learned(home), value.category,
                );
                // A slot's first army of the day starts full at its own maximum, trained Logistics included.
                let maximum = crate::progression::stamina_max(progress, value.category, value.stamina_config);
                let initial = crate::troops::Stamina { amount: maximum, ..value.initial };
                return ResolvedArmySlot {
                    stamina: army_slot_storage::allocate(
                        key, value.home, value.epoch, value.allowance, value.slot, initial, maximum,
                    ),
                };
            }
            let mut explorer = crate::logic::troops::explorer(key).expect('missing slot explorer');
            let stamina = match action {
                ArmySlotAction::Resolve(refill) => { army_slot_storage::resolve(key, explorer, refill).troops.stamina },
                ArmySlotAction::Persist(stamina) => {
                    let previous = explorer.into_record();
                    explorer.troops.stamina = stamina;
                    army_slot_storage::persist(key, previous, explorer.troops).stamina
                },
                ArmySlotAction::Release(stamina) => {
                    if let crate::troops::StaminaSource::Slot(_) = explorer.troops.stamina {
                        crate::logic::army_relics::destroy(key);
                        crate::logic::progression::destroy(key);
                    }
                    explorer.troops.stamina = stamina;
                    army_slot_storage::release(key, explorer);
                    stamina
                },
                ArmySlotAction::Allocate(_) => panic!("allocation already handled"),
            };
            ResolvedArmySlot { stamina }
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
            relic_slot: Option<u8>,
            clean: bool,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::execution_context(site.game_id, context);
            let explorer_key = ExplorerKey { game_id: site.game_id, explorer_id };
            let explorer = crate::logic::troops::command_explorer(explorer_key, None, context.timestamp, context);
            if crate::logic::expeditions::expedition_site(site)
                .expect('missing expedition site')
                .category == crate::taxonomy::RUIN_CATEGORY {
                crate::logic::army_relics::award(explorer_key, site, relic_slot);
            }
            let captured = crate::logic::expeditions::expedition_site(site).expect('missing expedition site');
            let depth = crate::logic::expeditions::depth_at(site.game_id, explorer.coord);
            if depth < 3 && crate::expeditions::is_band(captured, crate::logic::expeditions::depth_rules(depth)) {
                crate::logic::oaths::offer(explorer_key, explorer.coord, context.raw_root);
            }
            self.refund_capture_stamina(explorer_key, explorer, context);
            crate::expeditions::ISiteRewardsDispatcherTrait::pay_expedition_site(
                crate::expeditions::ISiteRewardsLibraryDispatcher {
                    class_hash: crate::logic::release::class_of(site.game_id, crate::slots::RESOURCES),
                },
                site,
                explorer_key,
                explorer.owner,
                clean,
                crate::commands::action_context(context),
            );
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
        fn activate_army_relic(
            self: @ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: ApplyRelic,
            context: ExecutionContext,
        ) {
            let key = ExplorerKey { game_id, explorer_id: command.entity_id };
            let explorer = crate::logic::troops::command_explorer(key, Some(actor), context.timestamp, context);
            let relic = crate::logic::army_relics::activate(
                key, command.slot, command.relic_id, context.timestamp, context.rules.unbox().relic_seconds_per_rank,
            );
            if relic.kind == crate::army_relics::RelicKind::StaminaRegen {
                crate::logic::army_relics::start_stamina_regen(key, explorer);
            }
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

        fn assert_command(
            self: @ComponentState<TContractState>,
            game_id: u32,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) {
            assert_playing(game_context.game.unbox(), timestamp);
        }
    }
}

fn use_frontier_site(
    actor: starknet::ContractAddress,
    command: crate::relics::InteractSite,
    context: crate::commands::ActionContext,
    execution: crate::commands::ExecutionContext,
) {
    let game_id = execution.game_id;
    let key = crate::troops::ExplorerKey { game_id, explorer_id: command.explorer_id };
    let army = crate::logic::troops::command_explorer(key, Some(actor), execution.timestamp, execution);
    assert!(army.troops.count != 0, "explorer is dead");
    crate::expeditions::assert_same_region(army.coord, command.coord, crate::logic::settlement::spacing());
    assert!(crate::geometry::adjacent(army.coord, command.coord), "explorer is not adjacent to site");
    let site = consume_frontier_site(crate::geometry::tile_key(game_id, command.coord));
    let benefit = if site == crate::taxonomy::SHRINE_OCCUPIER {
        offer_shrine_oaths(key, command.coord, context);
        crate::relics::SiteBenefit::Shrine(0)
    } else {
        crate::relics::SiteBenefit::Well(refill_at_well(key, army, execution.rules.unbox().troop_stamina_config))
    };
    crate::logic::stories::emit_entity_story(
        crate::resources::ResourceKey { game_id, entity_id: command.explorer_id },
        actor,
        crate::ownership::Story::SiteUsed(
            crate::relics::SiteUsed { explorer_id: command.explorer_id, coord: command.coord, benefit },
        ),
        execution.timestamp,
    );
}

fn consume_frontier_site(key: crate::map::TileKey) -> u8 {
    let site = crate::logic::map::occupancy(key);
    assert!(crate::discovery::is_frontier_site(site), "tile is not a shrine or well");
    let site = site.unwrap();
    crate::logic::map::MapState::vacate(key, site.entity_id);
    site.category
}

fn offer_shrine_oaths(
    key: crate::troops::ExplorerKey, coord: crate::troops::Coord, context: crate::commands::ActionContext,
) {
    let mut raw_root = context.raw_root;
    crate::oaths::IOathsDispatcherTrait::offer_oaths(
        crate::oaths::IOathsLibraryDispatcher {
            class_hash: crate::logic::release::class_of(key.game_id, crate::slots::RELICS),
        },
        key,
        coord,
        crate::random::game_root(ref raw_root, key.game_id),
    );
}

fn refill_at_well(
    key: crate::troops::ExplorerKey, army: crate::troops::ExplorerTroops, rules: crate::rules::TroopStaminaConfig,
) -> u64 {
    let before = army.troops.stamina.inline().amount;
    let mut troops = army.troops;
    crate::logic::oaths::refill_at_well(key, ref troops, rules);
    let previous = crate::troops::ExplorerRecordTrait::into_record(
        crate::logic::troops::explorer(key).expect('missing explorer'),
    );
    crate::logic::army_slot_storage::persist(key, previous, troops);
    troops.stamina.inline().amount - before
}
