#[starknet::component]
pub mod LordsState {
    use games_storage::release::LogicClasses;
    use starknet::ContractAddress;
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess};
    use crate::commands::ExecutionContext;
    use crate::logic::release::ReleaseState;
    use crate::logic::release::ReleaseState::InternalTrait as LifeInternalTrait;
    use crate::resources::{IResourceOperationsDispatcherTrait, IResourceOperationsLibraryDispatcher, ResourceKey};
    use crate::stamina::{StaminaSourceTrait, StaminaTrait};
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
    #[embeddable_as(LordsImpl)]
    pub impl Lords<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of crate::relics::ILords<ComponentState<TContractState>> {
        fn refill_stamina(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: crate::relics::RefillStamina,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::execution_context(game_id, context);
            crate::game::assert_playing(context.game.unbox(), context.timestamp);
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
            let earned = crate::logic::deposits::spend(game_id, actor, command.amount.into());
            if earned != 0 {
                self
                    .resources(game_id)
                    .spend_resource(
                        ResourceKey { game_id, entity_id: explorer.owner },
                        crate::resources::LORDS,
                        earned * crate::rules::RESOURCE_PRECISION,
                        context.timestamp,
                        crate::commands::resource_context(context),
                    );
                crate::logic::lords_budget::return_to_pool(game_id, earned, context);
            }
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

    #[embeddable_as(EarnedLordsSweepImpl)]
    pub impl EarnedLordsSweep<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of crate::relics::IEarnedLordsSweep<ComponentState<TContractState>> {
        fn sweep_earned_lords(
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
            assert!(crate::logic::lords_budget::budget(game_id).is_some(), "Frontier pool not published");
            self.withdraw_realm_lords(realm, record.owner, balance / crate::rules::RESOURCE_PRECISION, context);
        }
    }

    #[generate_trait]
    pub impl InternalImpl<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of InternalTrait<TContractState> {
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

        fn logic_classes(
            self: @ComponentState<TContractState>, game_id: u32,
        ) -> starknet::storage::StoragePointer<LogicClasses> {
            get_dep_component!(self, Life).classes(game_id)
        }
        fn resources(self: @ComponentState<TContractState>, game_id: u32) -> IResourceOperationsLibraryDispatcher {
            IResourceOperationsLibraryDispatcher { class_hash: self.logic_classes(game_id).resources.read() }
        }
    }
}
