#[starknet::component]
pub mod LordsState {
    use games_storage::release::LogicClasses;
    use starknet::ContractAddress;
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess};
    use crate::commands::ResourceContext;
    use crate::logic::release::ReleaseState;
    use crate::logic::release::ReleaseState::InternalTrait as LifeInternalTrait;
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
        StoryEvent: crate::ownership::StoryEvent,
    }
    #[embeddable_as(LordsImpl)]
    pub impl Lords<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of crate::relics::ILords<ComponentState<TContractState>> {
        fn sweep_lords(ref self: ComponentState<TContractState>, game_id: u32, structure_id: u64) {
            crate::logic::entry::assert_ledger_operator();
            let timestamp = starknet::get_block_timestamp();
            let game = self.data.games.games.entry(game_id);
            assert!(game.preset_id.read() != 0, "game does not exist");
            assert!(timestamp >= game.end_at.read(), "season has not ended");
            let realm = ResourceKey { game_id, entity_id: structure_id };
            let record = self.data.structures.structures.entry((game_id, structure_id));
            let owner = record.owner.read();
            assert!(
                record.base.read().category == crate::taxonomy::REALM_CATEGORY && owner != 0.try_into().unwrap(),
                "sweep requires an owned realm",
            );
            let balance = crate::logic::resources::balance(realm, crate::resources::LORDS);
            assert!(balance % crate::rules::RESOURCE_PRECISION == 0, "fractional realm LORDS");
            crate::logic::deposits::sweep(game_id, owner);
            if balance == 0 {
                return;
            }
            let rules = crate::logic::preset_record::for_game(game_id).rules;
            let context = ResourceContext {
                production_start: if rules.mode_rules.read() & crate::rules::PRODUCTION_START != 0 {
                    game.start_main_at.read().try_into().unwrap()
                } else {
                    0
                },
                troop_capacity: rules.capacity_config.troop_capacity.read(),
                spire_fee: rules.spire_travel_essence_cost.read(),
                delivery_tick: rules.tick_config.delivery_tick_in_seconds.read(),
            };
            self.withdraw_realm_lords(realm, owner, balance / crate::rules::RESOURCE_PRECISION, timestamp, context);
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
            timestamp: u64,
            context: ResourceContext,
        ) {
            assert!(account != 0.try_into().unwrap(), "withdrawal owner missing");
            self
                .resources(realm.game_id)
                .spend_resource(
                    realm, crate::resources::LORDS, amount * crate::rules::RESOURCE_PRECISION, timestamp, context,
                );
            self
                .record_lords_withdrawal(
                    realm, crate::relics::LordsWithdrawal { account, amount, prize_rank: 0, prize_count: 0 }, timestamp,
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
