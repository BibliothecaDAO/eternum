use eternum::alias::ID;
use starknet::ContractAddress;

#[dojo::interface]
trait IResourceBridgeSystems {
    fn deposit(
        ref world: IWorldDispatcher,
        token: ContractAddress,
        recipient_id: ID,
        amount: u256,
        client_fee_recipient: ContractAddress
    );
    fn withdraw(
        ref world: IWorldDispatcher,
        from_id: ID,
        token: ContractAddress,
        recipient_address: ContractAddress,
        amount: u128,
        client_fee_recipient: ContractAddress
    );
}

#[dojo::contract]
mod resource_bridge_systems {
    use eternum::alias::ID;
    use eternum::constants::WORLD_CONFIG_ID;
    use eternum::models::config::{ResourceBridgeWhitelistConfig, ResourceBridgeConfig, ResourceBridgeFeeSplitConfig};
    use eternum::models::owner::{EntityOwner, EntityOwnerCustomTrait};
    use eternum::models::resources::{Resource, ResourceCustomImpl, RESOURCE_PRECISION};
    use eternum::models::structure::{Structure, StructureCustomTrait, StructureCategory};
    use eternum::utils::math::{pow, PercentageImpl, PercentageValueImpl};
    use openzeppelin::token::erc20::interface::{ERC20ABIDispatcher, ERC20ABIDispatcherTrait};
    use starknet::ContractAddress;
    use starknet::{get_caller_address, get_contract_address};


    #[abi(embed_v0)]
    impl ResourceBridgeImpl of super::IResourceBridgeSystems<ContractState> {
        fn deposit(
            ref world: IWorldDispatcher,
            token: ContractAddress,
            recipient_id: ID,
            amount: u256,
            client_fee_recipient: ContractAddress
        ) {
            // ensure transfer recipient is a bank
            let recipient_structure: Structure = get!(world, recipient_id, Structure);
            recipient_structure.assert_is_structure();
            assert!(recipient_structure.category == StructureCategory::Bank, "structure is not a bank");

            // ensure bridge deposit is not paused
            InternalBridgeImpl::assert_deposit_not_paused(world);

            // ensure token is whitelisted
            let resource_bridge_token_whitelist = get!(world, token, ResourceBridgeWhitelistConfig);
            InternalBridgeImpl::assert_resource_whitelisted(world, resource_bridge_token_whitelist);

            // transfer the deposit amount from the caller to this contract
            let caller = get_caller_address();
            let this = get_contract_address();
            assert!(
                ERC20ABIDispatcher { contract_address: token }.transfer_from(caller, this, amount),
                "Bridge: transfer failed"
            );

            // take fees from deposit
            let total_fees = InternalBridgeImpl::send_fees_on_deposit(world, token, client_fee_recipient, amount);
            assert!(total_fees.is_non_zero(), "Bridge: deposit amount too small");
            let amount_less_fees = amount - total_fees;

            // get resource id associated with token
            let resource_type = resource_bridge_token_whitelist.resource_type;
            // mint resource to recipient
            let mut resource: Resource = ResourceCustomImpl::get(world, (recipient_id, resource_type));
            let deposit_amount_given = InternalBridgeImpl::token_amount_to_resource_amount(token, amount_less_fees);
            resource.add(deposit_amount_given);
            resource.save(world);
        }


        fn withdraw(
            ref world: IWorldDispatcher,
            from_id: ID,
            token: ContractAddress,
            recipient_address: ContractAddress,
            amount: u128,
            client_fee_recipient: ContractAddress
        ) {
            // ensure caller is owner of from_id
            get!(world, from_id, EntityOwner).assert_caller_owner(world);

            // ensure from_id is a bank
            let from_structure: Structure = get!(world, from_id, Structure);
            from_structure.assert_is_structure();
            assert!(from_structure.category == StructureCategory::Bank, "structure is not a bank");

            // ensure bridge withdrawal is not paused
            InternalBridgeImpl::assert_withdraw_not_paused(world);

            // ensure token is still whitelisted (incase we want to disable specific resource withdrawals)
            // we also want to make sure it is non zero
            let resource_bridge_token_whitelist = get!(world, token, ResourceBridgeWhitelistConfig);
            InternalBridgeImpl::assert_resource_whitelisted(world, resource_bridge_token_whitelist);

            // get resource id associated with token
            let resource_type = resource_bridge_token_whitelist.resource_type;

            // burn resource from sender
            let mut resource: Resource = ResourceCustomImpl::get(world, (from_id, resource_type));
            resource.burn(amount);
            resource.save(world);

            // get relative withdrawal amount
            let withdrawal_amount = InternalBridgeImpl::resource_amount_to_token_amount(token, amount);

            // take fees from withdrawn amount
            let total_fees = InternalBridgeImpl::send_fees_on_withdrawal(
                world, token, client_fee_recipient, withdrawal_amount
            );
            assert!(total_fees.is_non_zero(), "Bridge: withdrawal amount too small");
            let withdrawal_amount_less_fees = withdrawal_amount - total_fees;

            // transfer withdrawal amount to recipient
            assert!(
                ERC20ABIDispatcher { contract_address: token }.transfer(recipient_address, withdrawal_amount_less_fees),
                "Bridge: transfer failed"
            );
        }
    }

    #[generate_trait]
    impl InternalBridgeImpl of InternalBridgeTrait {
        fn one_token(token: ContractAddress) -> u256 {
            let token_decimal: u8 = ERC20ABIDispatcher { contract_address: token }.decimals();
            return pow(10, token_decimal.into()).into();
        }


        fn assert_deposit_not_paused(world: IWorldDispatcher) {
            let resource_bridge_config = get!(world, WORLD_CONFIG_ID, ResourceBridgeConfig);
            assert!(resource_bridge_config.deposit_paused == false, "resource bridge deposit is paused");
        }

        fn assert_withdraw_not_paused(world: IWorldDispatcher) {
            let resource_bridge_config = get!(world, WORLD_CONFIG_ID, ResourceBridgeConfig);
            assert!(resource_bridge_config.withdraw_paused == false, "resource bridge withdrawal is paused");
        }

        fn assert_resource_whitelisted(
            world: IWorldDispatcher, resource_bridge_token_whitelist: ResourceBridgeWhitelistConfig
        ) {
            assert!(resource_bridge_token_whitelist.resource_type.is_non_zero(), "resource id not whitelisted");
        }

        // Convert from the token's number system to the internal resource number system
        fn token_amount_to_resource_amount(token: ContractAddress, amount: u256) -> u128 {
            let relative_amount: u256 = (amount * RESOURCE_PRECISION.into()) / Self::one_token(token);
            return relative_amount.try_into().unwrap();
        }

        // Convert from the internal resource number system to the token's number system
        fn resource_amount_to_token_amount(token: ContractAddress, amount: u128) -> u256 {
            let relative_amount: u256 = (amount.into() * Self::one_token(token)) / RESOURCE_PRECISION.into();
            return relative_amount;
        }

        fn send_fees_on_deposit(
            world: IWorldDispatcher, token: ContractAddress, client_fee_recipient: ContractAddress, amount: u256
        ) -> u256 {
            let fee_split_config = get!(world, WORLD_CONFIG_ID, ResourceBridgeFeeSplitConfig);
            let velords_fee_amount = (amount * fee_split_config.velords_fee_on_dpt_percent.into())
                / PercentageValueImpl::_100().into();
            let season_pool_fee_amount = (amount * fee_split_config.season_pool_fee_on_dpt_percent.into())
                / PercentageValueImpl::_100().into();
            let client_fee_amount = (amount * fee_split_config.client_fee_on_dpt_percent.into())
                / PercentageValueImpl::_100().into();

            // send fees to recipients
            let erc20 = ERC20ABIDispatcher { contract_address: token };
            if velords_fee_amount.is_non_zero() {
                erc20.transfer(fee_split_config.velords_fee_recipient, velords_fee_amount);
            }
            if season_pool_fee_amount.is_non_zero() {
                erc20.transfer(fee_split_config.season_pool_fee_recipient, season_pool_fee_amount);
            }
            if client_fee_amount.is_non_zero() {
                erc20.transfer(client_fee_recipient, client_fee_amount);
            }

            // return the total fees sent
            velords_fee_amount + season_pool_fee_amount + client_fee_amount
        }


        fn send_fees_on_withdrawal(
            world: IWorldDispatcher, token: ContractAddress, client_fee_recipient: ContractAddress, amount: u256
        ) -> u256 {
            let fee_split_config = get!(world, WORLD_CONFIG_ID, ResourceBridgeFeeSplitConfig);
            let velords_fee_amount = (amount * fee_split_config.velords_fee_on_wtdr_percent.into())
                / PercentageValueImpl::_100().into();
            let season_pool_fee_amount = (amount * fee_split_config.season_pool_fee_on_wtdr_percent.into())
                / PercentageValueImpl::_100().into();
            let client_fee_amount = (amount * fee_split_config.client_fee_on_wtdr_percent.into())
                / PercentageValueImpl::_100().into();

            // send fees to recipients
            let erc20 = ERC20ABIDispatcher { contract_address: token };
            if velords_fee_amount.is_non_zero() {
                erc20.transfer(fee_split_config.velords_fee_recipient, velords_fee_amount);
            }
            if season_pool_fee_amount.is_non_zero() {
                erc20.transfer(fee_split_config.season_pool_fee_recipient, season_pool_fee_amount);
            }
            if client_fee_amount.is_non_zero() {
                erc20.transfer(client_fee_recipient, client_fee_amount);
            }

            // return the total fees sent
            velords_fee_amount + season_pool_fee_amount + client_fee_amount
        }
    }
}
