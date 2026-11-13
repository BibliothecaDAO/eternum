use starknet::storage::{StorageMapReadAccess, StoragePathEntry, StoragePointerReadAccess};
use crate::quests::{IQuestProgressDispatcherTrait, IQuestProgressLibraryDispatcher, QuestProgress};
use crate::resources::ResourceKey;

pub fn enabled(game_id: u32) -> bool {
    crate::logic::preset_record::for_game(game_id).quest_rewards.read().is_some()
}

pub fn record(home: ResourceKey, kind: u8, amount: u128, timestamp: u64) {
    if amount == 0 {
        return;
    }
    let state = crate::state::read();
    let release = state.game_releases.read(home.game_id);
    IQuestProgressLibraryDispatcher { class_hash: state.releases.entry(release).classes.bridge.read() }
        .record_quest_progress(home, kind, amount, timestamp);
}

pub fn read(home: ResourceKey, day: u64) -> QuestProgress {
    let (progress, completed_level) = crate::state::read().quests.progress.read((home.game_id, home.entity_id, day));
    QuestProgress { progress, completed_level }
}

pub fn labor_bonus(home: ResourceKey, owner: starknet::ContractAddress) -> bool {
    let state = crate::state::read();
    if state.settlements.campaign_homes.read((home.game_id, home.entity_id)).is_some() {
        return true;
    }
    let Some(source) = state.settlements.entitlements.read((home.game_id, owner)) else {
        return false;
    };
    source.pass_kind == crate::settlement::HELD_REALM_KIND
        && state
            .settlements
            .held_realm_homes
            .read((home.game_id, source.realm_id.try_into().unwrap())) == home
            .entity_id
}

#[starknet::component]
pub mod QuestState {
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess};
    use crate::quests::{ClaimDailyQuest, QuestProgress};
    use crate::resources::{IResourceOperationsDispatcherTrait, IResourceOperationsLibraryDispatcher, ResourceKey};
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
    }

    #[embeddable_as(ProgressImpl)]
    pub impl Progress<
        TContractState, +HasComponent<TContractState>, +Drop<TContractState>,
    > of crate::quests::IQuestProgress<ComponentState<TContractState>> {
        fn record_quest_progress(
            ref self: ComponentState<TContractState>, home: ResourceKey, kind: u8, amount: u128, timestamp: u64,
        ) {
            if amount == 0 || !super::enabled(home.game_id) {
                return;
            }
            let game = crate::logic::game::game(home.game_id);
            let preset = crate::logic::preset_record::for_game(home.game_id);
            let day = crate::days::day_of(game, preset.rules.day_unit_seconds.read(), timestamp).index;
            let selected = crate::logic::banes::quest_kind(home, day);
            let kind = if kind == crate::quests::REVEALS && selected == crate::quests::LIGHTS {
                crate::quests::LIGHTS
            } else {
                kind
            };
            if selected != kind {
                return;
            }
            let mut progress = super::read(home, day);
            if progress.completed_level != 0 {
                return;
            }
            assert!(crate::logic::structures::exists(home), "missing structure");
            let base = self.data.structures.structures.entry((home.game_id, home.entity_id)).base.read();
            assert!(base.category == crate::taxonomy::REALM_CATEGORY, "quest requires a Realm");
            let level = base.level + 1;
            assert!(level >= 1 && level <= 4, "invalid Realm level");
            let target = crate::logic::banes::target(home, kind, level);
            progress.progress += amount;
            if progress.progress >= target {
                progress.completed_level = level;
            }
            self.write_progress(home, day, progress);
            if progress.completed_level != 0 {
                crate::logic::banes::complete(home, day, timestamp);
            }
        }
    }

    #[embeddable_as(BaneEffectsImpl)]
    pub impl BaneEffects<
        TContractState, +HasComponent<TContractState>, +Drop<TContractState>,
    > of crate::banes::IBaneEffects<ComponentState<TContractState>> {
        fn bane_effects(
            self: @ComponentState<TContractState>, home: ResourceKey, from: u64, until: u64,
        ) -> crate::banes::BaneEffects {
            crate::logic::banes::read_effects(home, from, until)
        }
    }

    #[embeddable_as(DailyQuestImpl)]
    pub impl DailyQuest<
        TContractState, +HasComponent<TContractState>, +Drop<TContractState>,
    > of crate::quests::IDailyQuest<ComponentState<TContractState>> {
        fn claim_daily_quest(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: starknet::ContractAddress,
            command: ClaimDailyQuest,
            context: crate::commands::ActionContext,
        ) {
            let context = crate::commands::execution_context(game_id, context);
            crate::game::assert_playing(context.game.unbox(), context.timestamp);
            let home = ResourceKey { game_id, entity_id: command.home };
            assert!(crate::logic::structures::exists(home), "missing structure");
            let realm = self.data.structures.structures.entry((game_id, command.home));
            assert!(
                realm.owner.read() == actor && realm.base.read().category == crate::taxonomy::REALM_CATEGORY,
                "quest requires an owned Realm",
            );
            assert!(super::enabled(game_id), "daily quests are disabled");
            let day = crate::days::day_of(
                context.game.unbox(), context.rules.unbox().day_unit_seconds, context.timestamp,
            )
                .index;
            assert!(command.day == day, "incorrect quest day");
            let progress = super::read(home, day);
            assert!(progress.completed_level != 0, "daily quest is unfinished");
            let key = (game_id, command.home, day);
            if self.data.entry.home_labor_grants.read(key).is_none() {
                let grant = self.grant_reward(home, actor, progress.completed_level, context);
                crate::logic::home_grants::record_labor_grant(day, grant);
            }
            if crate::logic::banes::won(home, day) && self.data.banes.bonus_grants.read(key).is_none() {
                let grant = self.grant_reward(home, actor, progress.completed_level, context);
                self.record_bane_grant(day, grant);
            }
        }
    }

    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn record_bane_grant(ref self: ComponentState<TContractState>, day: u64, grant: crate::entry::LaborGrant) {
            self.data.banes.bonus_grants.write((grant.game_id, grant.home, day), Some((grant.amount, grant.essence)));
            self
                .emit(
                    crate::events::RowSet {
                        version: 1,
                        model: 'BaneGrant',
                        keys: array![grant.game_id.into(), grant.home.into(), day.into()].span(),
                        values: array![grant.account.into(), grant.amount.into(), grant.essence.into()].span(),
                    },
                );
        }

        fn grant_reward(
            ref self: ComponentState<TContractState>,
            home: ResourceKey,
            actor: starknet::ContractAddress,
            level: u8,
            context: crate::commands::ExecutionContext,
        ) -> crate::entry::LaborGrant {
            let (labor, essence, bonus) = crate::logic::preset_record::for_game(home.game_id)
                .quest_rewards
                .read()
                .expect('daily quests are disabled');
            let (labor, essence) = crate::quests::reward(
                labor, essence, if super::labor_bonus(home, actor) {
                    bonus
                } else {
                    100
                }, level,
            );
            let release = self.data.game_releases.read(home.game_id);
            let resources = IResourceOperationsLibraryDispatcher {
                class_hash: self.data.releases.entry(release).classes.resources.read(),
            };
            let resource_context = crate::commands::resource_context(context);
            let amount = resources
                .grant_resource(
                    home,
                    crate::resources::LABOR,
                    labor * crate::rules::RESOURCE_PRECISION,
                    context.timestamp,
                    resource_context,
                );
            let essence = resources
                .grant_resource(
                    home,
                    crate::resources::ESSENCE,
                    essence * crate::rules::RESOURCE_PRECISION,
                    context.timestamp,
                    resource_context,
                );
            crate::entry::LaborGrant { game_id: home.game_id, account: actor, home: home.entity_id, amount, essence }
        }

        fn write_progress(
            ref self: ComponentState<TContractState>, home: ResourceKey, day: u64, progress: QuestProgress,
        ) {
            self
                .data
                .quests
                .progress
                .write((home.game_id, home.entity_id, day), (progress.progress, progress.completed_level));
            self
                .emit(
                    crate::events::RowSet {
                        version: 1,
                        model: 'QuestProgress',
                        keys: array![home.game_id.into(), home.entity_id.into(), day.into()].span(),
                        values: array![progress.progress.into(), progress.completed_level.into()].span(),
                    },
                );
        }
    }
}
