use crate::alias::ID;
use starknet::ContractAddress;

#[starknet::interface]
pub trait IResourceBridgeSystems<T> {
    fn deposit(
        ref self: T, token: ContractAddress, to_structure_id: ID, amount: u256, client_fee_recipient: ContractAddress,
    );
    fn withdraw(
        ref self: T,
        from_structure_id: ID,
        to_address: ContractAddress,
        token: ContractAddress,
        amount: u128,
        client_fee_recipient: ContractAddress,
    );
    fn lp_withdraw(ref self: T, to_address: ContractAddress, through_bank_id: ID, resource_type: u8, amount: u128);
    fn velords_claim(ref self: T);
}


#[dojo::contract]
pub mod resource_bridge_systems {
    use core::num::traits::Zero;
    use dojo::model::ModelStorage;
    use dojo::world::WorldStorage;
    use crate::alias::ID;
    use crate::constants::{DEFAULT_NS, ResourceTypes};
    use crate::models::config::{
        ResourceBridgeFeeSplitConfig, ResourceBridgeWtlConfig, ResourceRevBridgeWtlConfig, SeasonConfigImpl,
        WorldConfigUtilImpl,
    };
    use crate::models::owner::OwnerAddressImpl;
    use crate::models::resource::arrivals::ResourceArrivalImpl;
    use crate::models::resource::resource::{
        ResourceWeightImpl, SingleResource, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
    use crate::models::structure::{
        StructureBase, StructureBaseImpl, StructureBaseStoreImpl, StructureCategory, StructureMetadataStoreImpl,
        StructureOwnerStoreImpl,
    };
    use crate::models::weight::Weight;
    use crate::systems::utils::bridge::{BridgeTxType, iBridgeImpl};
    use crate::systems::utils::erc20::{ERC20ABIDispatcher, ERC20ABIDispatcherTrait};
    use crate::systems::utils::resource::iResourceTransferImpl;
    use crate::utils::achievements::index::{AchievementTrait, Tasks};
    use crate::utils::math::{PercentageImpl, PercentageValueImpl};
    use starknet::{ContractAddress, get_caller_address, get_contract_address};

    #[abi(embed_v0)]
    impl ResourceBridgeImpl of super::IResourceBridgeSystems<ContractState> {
        fn deposit(
            ref self: ContractState,
            token: ContractAddress,
            to_structure_id: ID,
            amount: u256,
            client_fee_recipient: ContractAddress,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());

            let original_amount = amount;

            // ensure the bridge is open
            SeasonConfigImpl::get(world).assert_main_game_started_and_grace_period_not_elapsed();

            // ensure the recipient of the bridged resources is a realm or village
            let mut to_structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, to_structure_id);
            assert!(
                to_structure_base.category == StructureCategory::Realm.into()
                    || to_structure_base.category == StructureCategory::Village.into(),
                "recipient structure is not a realm or village",
            );

            // ensure bridge deposit is not paused
            iBridgeImpl::assert_deposit_not_paused(world);

            // ensure token being bridged is whitelisted
            let resource_bridge_token_whitelist: ResourceBridgeWtlConfig = world.read_model(token);
            iBridgeImpl::assert_resource_whitelisted(world, resource_bridge_token_whitelist);

            // ensure no troops can be bridged into villages
            iBridgeImpl::assert_no_deposit_troops_in_village(
                to_structure_base.category, resource_bridge_token_whitelist.resource_type,
            );

            // ensure caller is owner of to_structure_id
            let to_structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, to_structure_id);
            to_structure_owner.assert_caller_owner();

            // transfer the deposit amount from the caller to this contract
            let caller = get_caller_address();
            let this = get_contract_address();
            assert!(
                ERC20ABIDispatcher { contract_address: token }.transfer_from(caller, this, amount),
                "Bridge: transfer failed",
            );

            // note: we only apply this AFTER the contract has received the deposit
            // apply inefficiency percentage to the deposit amount
            let (inefficiency_percentage_num, inefficiency_percentage_denom) = iBridgeImpl::inefficiency_percentage(
                ref world, resource_bridge_token_whitelist.resource_type,
            );
            let amount_lost_to_inefficiency = (amount * inefficiency_percentage_num.into())
                / inefficiency_percentage_denom.into();
            let amount = amount - amount_lost_to_inefficiency;

            // take platform fees from deposit
            let platform_fees = iBridgeImpl::send_platform_fees(
                ref world, token, client_fee_recipient, amount, BridgeTxType::Deposit,
            );
            let token_amount_less_platform_fees = amount - platform_fees;

            // take realm fees from deposit and get final resource amount
            let resource_total_amount = iBridgeImpl::token_amount_to_resource_amount(token, amount);
            let mut to_structure_weight: Weight = WeightStoreImpl::retrieve(ref world, to_structure_id);
            let mut resource_realm_fees: u128 = 0;
            if to_structure_base.category == StructureCategory::Village.into() {
                let to_structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, to_structure_id);
                resource_realm_fees =
                    iBridgeImpl::send_realm_fees(
                        ref world,
                        to_structure_id,
                        to_structure_owner,
                        to_structure_base,
                        ref to_structure_weight,
                        resource_bridge_token_whitelist.resource_type,
                        resource_total_amount,
                        BridgeTxType::Deposit,
                    );
            }
            to_structure_weight.store(ref world, to_structure_id);

            let resource_amount_less_platform_fees = iBridgeImpl::token_amount_to_resource_amount(
                token, token_amount_less_platform_fees,
            );
            let resource_amount_less_all_fees = resource_amount_less_platform_fees - resource_realm_fees;

            // transfer the resource to the recipient realm
            let resources = array![(resource_bridge_token_whitelist.resource_type, resource_amount_less_all_fees)]
                .span();

            // beam resources into the recipient's resource arrivals. it costs 0 donkey and time
            iResourceTransferImpl::portal_to_structure_arrivals_instant(ref world, to_structure_id, resources);

            // grant lords bridge in achievement
            if resource_bridge_token_whitelist.resource_type == ResourceTypes::LORDS {
                let one = iBridgeImpl::one_token(token);
                let lords_amount = original_amount / one;
                let lords_amount_u32: u32 = lords_amount.try_into().unwrap();
                AchievementTrait::progress(
                    world,
                    to_structure_owner.into(),
                    Tasks::BRIDGE_LORDS,
                    lords_amount_u32,
                    starknet::get_block_timestamp(),
                );
            }
        }

        fn withdraw(
            ref self: ContractState,
            from_structure_id: ID,
            to_address: ContractAddress,
            token: ContractAddress,
            amount: u128,
            client_fee_recipient: ContractAddress,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());

            // ensure the bridge is open
            SeasonConfigImpl::get(world).assert_main_game_started_and_grace_period_not_elapsed();

            // ensure bridge withdrawal is not paused
            iBridgeImpl::assert_withdraw_not_paused(world);

            // ensure caller is owner of from_structure_id
            let from_structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, from_structure_id);
            from_structure_owner.assert_caller_owner();

            // ensure from_structure_id is a realm or village
            let from_structure: StructureBase = StructureBaseStoreImpl::retrieve(ref world, from_structure_id);
            assert!(
                from_structure.category == StructureCategory::Realm.into()
                    || from_structure.category == StructureCategory::Village.into(),
                "from structure is not a realm or village",
            );

            // ensure token is still whitelisted (incase we want to disable specific resource withdrawals)
            let resource_bridge_token_whitelist: ResourceBridgeWtlConfig = world.read_model(token);
            iBridgeImpl::assert_resource_whitelisted(world, resource_bridge_token_whitelist);

            // burn the resource from sender's structure balance
            let resource_type = resource_bridge_token_whitelist.resource_type;
            let mut from_structure_weight: Weight = WeightStoreImpl::retrieve(ref world, from_structure_id);
            let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, resource_type);
            let mut resource: SingleResource = SingleResourceStoreImpl::retrieve(
                ref world, from_structure_id, resource_type, ref from_structure_weight, resource_weight_grams, true,
            );
            resource.spend(amount, ref from_structure_weight, resource_weight_grams);
            resource.store(ref world);

            // note: we only apply this AFTER the contract has burned the withdrawal amount
            // apply inefficiency percentage to the withdrawal amount
            let (inefficiency_percentage_num, inefficiency_percentage_denom) = iBridgeImpl::inefficiency_percentage(
                ref world, resource_bridge_token_whitelist.resource_type,
            );
            let amount_lost_to_inefficiency = (amount * inefficiency_percentage_num.into())
                / inefficiency_percentage_denom.into();
            let amount = amount - amount_lost_to_inefficiency;

            // send fees to realm if from_structure is a village
            let token_amount = iBridgeImpl::resource_amount_to_token_amount(token, amount);
            let mut realm_resource_fee_amount = 0;
            if from_structure.category == StructureCategory::Village.into() {
                realm_resource_fee_amount =
                    iBridgeImpl::send_realm_fees(
                        ref world,
                        from_structure_id,
                        from_structure_owner,
                        from_structure,
                        ref from_structure_weight,
                        resource_type,
                        amount,
                        BridgeTxType::Withdrawal,
                    );
            }
            from_structure_weight.store(ref world, from_structure_id);

            // send platform fees
            let platform_token_fee_amount = iBridgeImpl::send_platform_fees(
                ref world, token, client_fee_recipient, token_amount, BridgeTxType::Withdrawal,
            );
            let realm_token_fee_amount = iBridgeImpl::resource_amount_to_token_amount(token, realm_resource_fee_amount);

            // transfer withdrawm erc20 amount to recipient
            let withdrawal_amount_less_all_fees = token_amount - realm_token_fee_amount - platform_token_fee_amount;
            iBridgeImpl::transfer_or_mint(token, to_address, withdrawal_amount_less_all_fees);
        }


        fn lp_withdraw(
            ref self: ContractState, to_address: ContractAddress, through_bank_id: ID, resource_type: u8, amount: u128,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());

            //todo ensure only liquidity systems can call this
            iBridgeImpl::assert_only_liquidity_systems(world, get_caller_address());

            // ensure the bridge is open
            SeasonConfigImpl::get(world).assert_main_game_started_and_grace_period_not_elapsed();

            // ensure bridge withdrawal is not paused
            iBridgeImpl::assert_withdraw_not_paused(world);

            // obtain token address from reverse whitelist config
            let resource_bridge_token_whitelist_reverse: ResourceRevBridgeWtlConfig = world.read_model(resource_type);
            let token = resource_bridge_token_whitelist_reverse.token;

            // ensure token is still whitelisted (incase we want to disable specific resource withdrawals)
            let resource_bridge_token_whitelist: ResourceBridgeWtlConfig = world.read_model(token);
            iBridgeImpl::assert_resource_whitelisted(world, resource_bridge_token_whitelist);

            // apply inefficiency percentage to the withdrawal amount
            let (inefficiency_percentage_num, inefficiency_percentage_denom) = iBridgeImpl::inefficiency_percentage(
                ref world, resource_bridge_token_whitelist.resource_type,
            );
            let amount_lost_to_inefficiency = (amount * inefficiency_percentage_num.into())
                / inefficiency_percentage_denom.into();
            let amount = amount - amount_lost_to_inefficiency;

            // send fees to realm if from_structure is a village
            let bank_resource_fee_amount = iBridgeImpl::send_bank_fees(
                ref world, through_bank_id, resource_type, amount, BridgeTxType::Withdrawal,
            );

            // send platform fees
            let token_amount = iBridgeImpl::resource_amount_to_token_amount(token, amount);
            let platform_token_fee_amount = iBridgeImpl::send_platform_fees(
                ref world, token, Zero::zero(), token_amount, BridgeTxType::Withdrawal,
            );
            // transfer withdrawm erc20 amount to recipient
            let bank_token_fee_amount = iBridgeImpl::resource_amount_to_token_amount(token, bank_resource_fee_amount);
            let withdrawal_amount_less_all_fees = token_amount - bank_token_fee_amount - platform_token_fee_amount;
            iBridgeImpl::transfer_or_mint(token, to_address, withdrawal_amount_less_all_fees);
        }

        fn velords_claim(ref self: ContractState) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());

            // ensure the season has ended
            // note: season.end_at must to set to avoid fatal bug
            let season_config = SeasonConfigImpl::get(world);
            assert!(season_config.has_ended(), "Season has not ended");

            // ensure bridging grace period has not elapsed
            let bridging_grace_period_end_at = season_config.end_at + season_config.end_grace_seconds.into();
            assert!(
                bridging_grace_period_end_at < starknet::get_block_timestamp(),
                "bridging grace period hasn't ended yet",
            );

            // get lords contract address
            let lords_whitelist_rev_config: ResourceRevBridgeWtlConfig = world.read_model(ResourceTypes::LORDS);
            let lords_address = lords_whitelist_rev_config.token;
            let lords_contract = ERC20ABIDispatcher { contract_address: lords_address };
            let this = starknet::get_contract_address();
            let lords_balance = lords_contract.balance_of(this);

            let res_bridge_fee_split_config: ResourceBridgeFeeSplitConfig = WorldConfigUtilImpl::get_member(
                world, selector!("res_bridge_fee_split_config"),
            );
            let velords_address = res_bridge_fee_split_config.velords_fee_recipient;

            // transfer lords to velords
            assert!(lords_contract.transfer(velords_address, lords_balance), "Failed to transfer LORDS to velords");
        }
    }
}
