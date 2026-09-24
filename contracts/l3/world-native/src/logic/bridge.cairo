#[starknet::component]
pub mod BridgeState {
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess};
    use starknet::{ContractAddress, get_contract_address};
    use crate::bridge::{Deposit, DepositRules, IDepositTokenDispatcher, IDepositTokenDispatcherTrait, Withdraw};
    use crate::events::RowSet;
    use crate::logic::release::ReleaseState;
    use crate::logic::release::ReleaseState::InternalTrait as LifeInternalTrait;
    use crate::logic::withdrawals::WithdrawalState;
    use crate::logic::withdrawals::WithdrawalState::InternalTrait as WithdrawalInternalTrait;
    use crate::ownership::{ResourceTransferStory, Story, StoryEvent, TransferType};
    use crate::resources::{
        IResourceOperationsDispatcherTrait, IResourceOperationsLibraryDispatcher, ResourceAmount, ResourceKey,
    };
    use crate::structures::{Structure, structure_coord};
    use crate::trade::{IEconomyDeliveryDispatcherTrait, IEconomyDeliveryLibraryDispatcher};
    use crate::withdrawals::{resource_amount, token_amount, transfer_or_mint};

    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    pub struct Storage {
        #[flat]
        pub data: crate::state::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
        StoryEvent: StoryEvent,
    }
    #[embeddable_as(BridgeImpl)]
    pub impl Bridge<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: ReleaseState::HasComponent<TContractState>,
        impl Withdrawals: WithdrawalState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of crate::bridge::IBridge<ComponentState<TContractState>> {
        fn configure_deposits(ref self: ComponentState<TContractState>, game_id: u32, rules: DepositRules) {
            crate::logic::release::assert_authority();
            crate::logic::game::game(game_id);
            assert!(self.data.bridge.deposits.read(game_id).is_none(), "deposit rules already configured");
            let total: u32 = rules.realm_fee_bps.into()
                + rules.velords_fee_bps.into()
                + rules.season_fee_bps.into()
                + rules.client_fee_bps.into();
            assert!(total <= 10000, "deposit fees exceed amount");
            self.data.bridge.deposits.write(game_id, Some(rules));
            let mut values = array![];
            rules.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1, model: 'DepositRules', keys: array![game_id.into()].span(), values: values.span(),
                    },
                );
        }
        fn deposit_rules(self: @ComponentState<TContractState>, game_id: u32) -> DepositRules {
            self.data.bridge.deposits.read(game_id).expect('missing deposit rules')
        }
        fn deposit_resource(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: Deposit,
            context: crate::commands::ActionContext,
        ) {
            let context = crate::commands::load_context(game_id, context);

            let target = self.authorize(game_id, actor, command.structure_id, context.timestamp, context);
            let rules = self.deposit_rules(game_id);
            assert!(!rules.paused, "resource bridge deposit is paused");
            let withdrawals = self.withdrawals();
            let token = withdrawals.token(crate::market::MarketKey { game_id, resource_type: command.resource_type });
            assert!(
                target.base.category != 5 || !crate::resources::is_troop_resource(command.resource_type),
                "troops cannot be bridged into villages",
            );
            assert!(
                IDepositTokenDispatcher { contract_address: token }
                    .transfer_from(actor, get_contract_address(), command.amount),
                "bridge token transfer failed",
            );
            let amount = withdrawals
                .retained_tokens(game_id, command.resource_type, command.amount, self.completed(game_id));
            let fees = self
                .platform_fees(
                    game_id,
                    token,
                    amount,
                    rules.velords_fee_bps,
                    rules.season_fee_bps,
                    rules.client_fee_bps,
                    command.client_fee_recipient,
                );
            let realm_fee = self
                .realm_fee(
                    game_id,
                    command.structure_id,
                    target,
                    command.resource_type,
                    resource_amount(token, amount),
                    rules.realm_fee_bps,
                    false,
                    context.timestamp,
                    context,
                );
            let credited = resource_amount(token, amount - fees) - realm_fee;
            self
                .deliver(
                    game_id,
                    0,
                    command.structure_id,
                    ResourceAmount { resource_type: command.resource_type, amount: credited },
                    0,
                    true,
                    context.timestamp,
                    context,
                );
        }
        fn withdraw_resource(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: Withdraw,
            context: crate::commands::ActionContext,
        ) {
            let context = crate::commands::load_context(game_id, context);

            let source = self.authorize(game_id, actor, command.structure_id, context.timestamp, context);
            let withdrawals = self.withdrawals();
            let rules = withdrawals.rules(game_id);
            assert!(!rules.paused, "resource bridge withdrawal is paused");
            let token = withdrawals.token(crate::market::MarketKey { game_id, resource_type: command.resource_type });
            self
                .resources(game_id)
                .spend_resource(
                    ResourceKey { game_id, entity_id: command.structure_id },
                    command.resource_type,
                    command.amount,
                    context.timestamp,
                    crate::commands::resource_context(context),
                );
            let amount = withdrawals
                .retained_amount(game_id, command.resource_type, command.amount, self.completed(game_id));
            let realm_fee = self
                .realm_fee(
                    game_id,
                    command.structure_id,
                    source,
                    command.resource_type,
                    amount,
                    rules.bank_fee_bps,
                    true,
                    context.timestamp,
                    context,
                );
            self.pay_withdrawal(game_id, command.recipient, token, amount, realm_fee, command.client_fee_recipient);
        }
    }
    #[embeddable_as(BankWithdrawalImpl)]
    pub impl BankWithdrawal<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: ReleaseState::HasComponent<TContractState>,
        impl Withdrawals: WithdrawalState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of crate::bridge::IBankWithdrawal<ComponentState<TContractState>> {
        fn withdraw_bank_resources(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            bank_id: u32,
            resource_type: u8,
            amount: u128,
            timestamp: u64,
            game_context: crate::commands::ActionContext,
        ) {
            let game_context = crate::commands::load_context(game_id, game_context);

            self.withdraw_liquidity_token(game_id, actor, bank_id, resource_type, amount, timestamp, game_context);
        }
    }
    #[generate_trait]
    pub impl InternalImpl<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: ReleaseState::HasComponent<TContractState>,
        impl Withdrawals: WithdrawalState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of InternalTrait<TContractState> {
        fn logic_classes(
            self: @ComponentState<TContractState>, game_id: u32,
        ) -> starknet::storage::StoragePointer<games_storage::release::LogicClasses> {
            get_dep_component!(self, Life).classes(game_id)
        }
        fn withdrawals(self: @ComponentState<TContractState>) -> @WithdrawalState::ComponentState<TContractState> {
            get_dep_component!(self, Withdrawals)
        }
        fn resources(self: @ComponentState<TContractState>, game_id: u32) -> IResourceOperationsLibraryDispatcher {
            IResourceOperationsLibraryDispatcher { class_hash: self.logic_classes(game_id).resources.read() }
        }
        fn structure(self: @ComponentState<TContractState>, game_id: u32, entity_id: u32) -> Structure {
            crate::logic::structures::structure(ResourceKey { game_id, entity_id }).expect('structure does not exist')
        }
        fn completed(self: @ComponentState<TContractState>, game_id: u32) -> u32 {
            crate::logic::hyperstructures::completed_hyperstructure_count(game_id)
        }
        fn authorize(
            self: @ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            entity_id: u32,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) -> Structure {
            crate::game::assert_main_with_grace(game_context.game.unbox(), timestamp);
            let structure = self.structure(game_id, entity_id);
            assert!(structure.owner == actor, "actor does not own structure");
            assert!(
                structure.base.category == 1 || structure.base.category == 5, "structure is not a realm or village",
            );
            structure
        }
        fn platform_fees(
            self: @ComponentState<TContractState>,
            game_id: u32,
            token: ContractAddress,
            amount: u256,
            velords: u16,
            season: u16,
            client: u16,
            client_recipient: ContractAddress,
        ) -> u256 {
            let rules = self.withdrawals().rules(game_id);
            let velords_fee = amount * velords.into() / 10000;
            let season_fee = amount * season.into() / 10000;
            let client_fee = amount * client.into() / 10000;
            assert!(velords_fee != 0 && season_fee != 0 && client_fee != 0, "amount too small to pay platform fees");
            transfer_or_mint(token, rules.velords_recipient, velords_fee);
            transfer_or_mint(token, rules.season_recipient, season_fee);
            transfer_or_mint(
                token,
                if client_recipient == 0.try_into().unwrap() {
                    rules.velords_recipient
                } else {
                    client_recipient
                },
                client_fee,
            );
            velords_fee + season_fee + client_fee
        }
        fn pay_withdrawal(
            self: @ComponentState<TContractState>,
            game_id: u32,
            recipient: ContractAddress,
            token: ContractAddress,
            amount: u128,
            resource_fee: u128,
            client: ContractAddress,
        ) {
            let rules = self.withdrawals().rules(game_id);
            let converted = token_amount(token, amount);
            let fees = self
                .platform_fees(
                    game_id,
                    token,
                    converted,
                    rules.velords_fee_bps,
                    rules.season_fee_bps,
                    rules.client_fee_bps,
                    client,
                );
            transfer_or_mint(token, recipient, converted - token_amount(token, resource_fee) - fees);
        }
        fn withdraw_liquidity_token(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            bank_id: u32,
            resource_type: u8,
            amount: u128,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) {
            let withdrawals = self.withdrawals();
            let rules = withdrawals.rules(game_id);
            assert!(!rules.paused, "resource bridge withdrawal is paused");
            let token = withdrawals.token(crate::market::MarketKey { game_id, resource_type });
            let amount = withdrawals.retained_amount(game_id, resource_type, amount, self.completed(game_id));
            let fee = amount * rules.bank_fee_bps.into() / 10000;
            if rules.bank_fee_bps != 0 {
                assert!(fee != 0, "amount too small to pay bank fees");
                self
                    .deliver(
                        game_id,
                        0,
                        bank_id,
                        ResourceAmount { resource_type, amount: fee },
                        0,
                        true,
                        timestamp,
                        game_context,
                    );
            }
            self.pay_withdrawal(game_id, actor, token, amount, fee, 0.try_into().unwrap());
        }
        fn realm_fee(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            village_id: u32,
            village: Structure,
            resource_type: u8,
            amount: u128,
            rate: u16,
            withdrawal: bool,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) -> u128 {
            if village.base.category != 5 || rate == 0 {
                return 0;
            }
            let fee = amount * rate.into() / 10000;
            assert!(fee != 0, "amount too small to pay realm fees");
            let realm_id = village.metadata.village_realm;
            let realm = self.structure(game_id, realm_id);
            assert!(realm.base.category == 1, "connected structure is not a realm");
            let resource = ResourceAmount { resource_type, amount: fee };
            let mut travel_time = 0;
            if withdrawal {
                let rules = game_context.rules.unbox();
                assert!(
                    !crate::rules::rule_enabled(rules, crate::rules::SAME_OWNER_TRANSFER)
                        || village.owner == realm.owner,
                    "blitz delayed transfers require the same owner",
                );
                travel_time =
                    crate::transport::travel_time(
                        structure_coord(village.base),
                        structure_coord(realm.base),
                        array![resource].span(),
                        rules.speed_config,
                        false,
                    );
                let weight = fee * crate::logic::resources::rule(game_id, resource_type).unit_weight;
                let donkeys = crate::transport::donkeys_needed(weight, rules.capacity_config.donkey_capacity.into());
                self
                    .resources(game_id)
                    .spend_resource(
                        ResourceKey { game_id, entity_id: village_id },
                        crate::transport::DONKEY,
                        donkeys,
                        timestamp,
                        crate::commands::resource_context(game_context),
                    );
            }
            self
                .deliver(
                    game_id,
                    if withdrawal {
                        village_id
                    } else {
                        0
                    },
                    realm_id,
                    resource,
                    travel_time,
                    !withdrawal,
                    timestamp,
                    game_context,
                );
            fee
        }
        fn deliver(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            from_id: u32,
            to_id: u32,
            resource: ResourceAmount,
            travel_time: u64,
            is_mint: bool,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) {
            IEconomyDeliveryLibraryDispatcher { class_hash: self.logic_classes(game_id).resources.read() }
                .queue_economy_delivery(
                    ResourceKey { game_id, entity_id: to_id },
                    resource,
                    travel_time,
                    timestamp,
                    crate::commands::resource_context(game_context),
                );
            let recipient = self.structure(game_id, to_id).owner;
            let sender = if from_id == 0 {
                0.try_into().unwrap()
            } else {
                self.structure(game_id, from_id).owner
            };
            let id = crate::logic::game::allocate_entity(game_id);
            self
                .emit(
                    StoryEvent {
                        version: 1,
                        game_id,
                        id,
                        owner: Some(recipient),
                        entity_id: Some(to_id),
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        timestamp,
                        story: Story::ResourceTransferStory(
                            ResourceTransferStory {
                                transfer_type: if is_mint {
                                    TransferType::InstantArrivals
                                } else {
                                    TransferType::Delayed
                                },
                                from_entity_id: from_id,
                                from_entity_owner_address: sender,
                                to_entity_id: to_id,
                                to_entity_owner_address: recipient,
                                resources: array![resource].span(),
                                is_mint,
                                travel_time,
                            },
                        ),
                    },
                );
        }
    }
}
