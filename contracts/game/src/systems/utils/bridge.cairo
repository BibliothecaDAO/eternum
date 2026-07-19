use core::num::traits::zero::Zero;
use dojo::model::ModelStorage;
use dojo::world::{WorldStorage, WorldStorageTrait};
use starknet::ContractAddress;
use crate::alias::ID;
use crate::constants::{RESOURCE_PRECISION, ResourceTypes, WORLD_CONFIG_ID};
use crate::models::config::{
    ResourceBridgeConfig, ResourceBridgeFeeSplitConfig, ResourceBridgeWtlConfig, WorldConfigUtilImpl,
};
use crate::models::hyperstructure::HyperstructureGlobals;
use crate::models::resource::arrivals::ResourceArrivalImpl;
use crate::models::resource::resource::{
    ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, TroopResourceImpl, WeightStoreImpl,
};
use crate::models::structure::{
    StructureBase, StructureBaseImpl, StructureBaseStoreImpl, StructureCategory, StructureMetadata,
    StructureMetadataStoreImpl, StructureOwnerStoreImpl,
};
use crate::models::weight::Weight;
use crate::systems::utils::bridge_quote::{
    BridgeDirection, BridgeFeePolicy, BridgeQuote, BridgeQuoteRequest, BridgeRecipientClass, BridgeResourceClass,
    quote_bridge,
};
use crate::systems::utils::erc20::{
    ERC20ABIDispatcher, ERC20ABIDispatcherTrait, ResourceERC20MintableABIDispatcher,
    ResourceERC20MintableABIDispatcherTrait,
};
use crate::systems::utils::resource::iResourceTransferImpl;
use crate::utils::math::pow;

#[generate_trait]
pub impl iBridgeImpl of iBridgeTrait {
    fn one_token(token: ContractAddress) -> u256 {
        let token_decimal: u8 = ERC20ABIDispatcher { contract_address: token }.decimals();
        return pow(10, token_decimal.into()).into();
    }

    fn transfer_or_mint(token: ContractAddress, recipient: ContractAddress, amount: u256) {
        let erc20 = ERC20ABIDispatcher { contract_address: token };
        if erc20.balance_of(starknet::get_contract_address()) < amount {
            let erc20mintable = ResourceERC20MintableABIDispatcher { contract_address: token };
            erc20mintable.mint(recipient, amount);
        } else {
            assert!(erc20.transfer(recipient, amount), "Bridge: transfer failed");
        }
    }

    fn assert_only_owner_or_realm_systems(
        world: WorldStorage, caller: ContractAddress, structure_owner: ContractAddress,
    ) {
        if caller != structure_owner {
            let (realm_systems_address, _) = world.dns(@"realm_systems").unwrap();
            assert!(caller == realm_systems_address, "Bridge: caller is not owner or realm systems");
        }
    }

    fn assert_only_liquidity_systems(world: WorldStorage, caller: ContractAddress) {
        let (liquidity_systems_address, _) = world.dns(@"liquidity_systems").unwrap();
        assert!(caller == liquidity_systems_address, "Bridge: caller is not liquidity systems");
    }

    fn assert_deposit_not_paused(world: WorldStorage) {
        let resource_bridge_config: ResourceBridgeConfig = WorldConfigUtilImpl::get_member(
            world, selector!("resource_bridge_config"),
        );
        assert!(resource_bridge_config.deposit_paused == false, "resource bridge deposit is paused");
    }

    fn assert_withdraw_not_paused(world: WorldStorage) {
        let resource_bridge_config: ResourceBridgeConfig = WorldConfigUtilImpl::get_member(
            world, selector!("resource_bridge_config"),
        );
        assert!(resource_bridge_config.withdraw_paused == false, "resource bridge withdrawal is paused");
    }

    fn assert_resource_whitelisted(world: WorldStorage, resource_bridge_token_whitelist: ResourceBridgeWtlConfig) {
        assert!(resource_bridge_token_whitelist.resource_type.is_non_zero(), "resource id not whitelisted");
    }

    fn assert_no_deposit_troops_in_village(structure_category: u8, resource_type: u8) {
        if TroopResourceImpl::is_troop(resource_type) {
            assert!(structure_category != StructureCategory::Village.into(), "Troops can't be bridged into villages");
        }
    }

    fn deposit_quote(
        ref world: WorldStorage,
        token: ContractAddress,
        recipient_class: BridgeRecipientClass,
        resource_type: u8,
        amount: u256,
        client_fee_recipient: ContractAddress,
    ) -> BridgeQuote {
        quote_bridge(
            Self::quote_request(
                ref world,
                BridgeDirection::Deposit,
                token,
                recipient_class,
                resource_type,
                amount,
                client_fee_recipient.is_zero(),
            ),
        )
    }

    fn withdrawal_quote(
        ref world: WorldStorage,
        token: ContractAddress,
        recipient_class: BridgeRecipientClass,
        resource_type: u8,
        amount: u128,
        client_fee_recipient: ContractAddress,
    ) -> BridgeQuote {
        quote_bridge(
            Self::quote_request(
                ref world,
                BridgeDirection::Withdrawal,
                token,
                recipient_class,
                resource_type,
                amount.into(),
                client_fee_recipient.is_zero(),
            ),
        )
    }

    fn quote_request(
        ref world: WorldStorage,
        direction: BridgeDirection,
        token: ContractAddress,
        recipient_class: BridgeRecipientClass,
        resource_type: u8,
        amount: u256,
        client_fee_redirected_to_velords: bool,
    ) -> BridgeQuoteRequest {
        let fee_config: ResourceBridgeFeeSplitConfig = WorldConfigUtilImpl::get_member(
            world, selector!("res_bridge_fee_split_config"),
        );
        let hyperstructure_globals: HyperstructureGlobals = world.read_model(WORLD_CONFIG_ID);

        BridgeQuoteRequest {
            direction,
            amount,
            token_precision: Self::one_token(token),
            resource_precision: RESOURCE_PRECISION.into(),
            recipient_class,
            resource_class: Self::resource_class(resource_type),
            hyperstructures_completed: hyperstructure_globals.completed_count,
            client_fee_redirected_to_velords,
            fee_policy: BridgeFeePolicy {
                velords_deposit_bps: fee_config.velords_fee_on_dpt_percent,
                velords_withdrawal_bps: fee_config.velords_fee_on_wtdr_percent,
                season_deposit_bps: fee_config.season_pool_fee_on_dpt_percent,
                season_withdrawal_bps: fee_config.season_pool_fee_on_wtdr_percent,
                client_deposit_bps: fee_config.client_fee_on_dpt_percent,
                client_withdrawal_bps: fee_config.client_fee_on_wtdr_percent,
                internal_deposit_bps: fee_config.realm_fee_dpt_percent,
                internal_withdrawal_bps: fee_config.realm_fee_wtdr_percent,
            },
        }
    }

    fn resource_class(resource_type: u8) -> BridgeResourceClass {
        if resource_type == ResourceTypes::LORDS {
            BridgeResourceClass::Lords
        } else if TroopResourceImpl::is_troop(resource_type) {
            BridgeResourceClass::Troop
        } else {
            BridgeResourceClass::Other
        }
    }

    fn send_realm_fees(
        ref world: WorldStorage,
        from_structure_id: ID,
        from_structure_owner: ContractAddress,
        from_structure_base: StructureBase,
        ref from_structure_weight: Weight,
        resource_type: u8,
        fee_amount: u128,
        direction: BridgeDirection,
    ) {
        assert!(from_structure_base.category == StructureCategory::Village.into(), "Bridge: caller is not village");

        let fee_split_config: ResourceBridgeFeeSplitConfig = WorldConfigUtilImpl::get_member(
            world, selector!("res_bridge_fee_split_config"),
        );
        let realm_fee_percent = match direction {
            BridgeDirection::Deposit => { fee_split_config.realm_fee_dpt_percent },
            BridgeDirection::Withdrawal => { fee_split_config.realm_fee_wtdr_percent },
        };
        if realm_fee_percent.is_non_zero() {
            assert!(fee_amount.is_non_zero(), "Bridge: amount too small to pay realm fees");

            let from_structure_metadata: StructureMetadata = StructureMetadataStoreImpl::retrieve(
                ref world, from_structure_id,
            );
            let realm_structure_id: ID = from_structure_metadata.village_realm;

            match direction {
                BridgeDirection::Deposit => {
                    // beam resources into the realm's resource arrivals. it costs 0 donkey and time
                    iResourceTransferImpl::portal_to_structure_arrivals_instant(
                        ref world, realm_structure_id, array![(resource_type, fee_amount)].span(),
                    );
                },
                BridgeDirection::Withdrawal => {
                    // send fees from village to realm
                    let realm_structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(
                        ref world, realm_structure_id,
                    );
                    let realm_structure_base: StructureBase = StructureBaseStoreImpl::retrieve(
                        ref world, realm_structure_id,
                    );
                    let mut realm_structure_weight: Weight = WeightStoreImpl::retrieve(ref world, realm_structure_id);
                    iResourceTransferImpl::structure_to_structure_delayed(
                        ref world,
                        from_structure_id,
                        from_structure_owner,
                        from_structure_base,
                        ref from_structure_weight,
                        realm_structure_id,
                        realm_structure_owner,
                        realm_structure_base,
                        ref realm_structure_weight,
                        array![(resource_type, fee_amount)].span(),
                        false,
                        false,
                    );
                },
            }
        }
    }


    fn send_bank_fees(
        ref world: WorldStorage, bank_structure_id: ID, resource_type: u8, fee_amount: u128, direction: BridgeDirection,
    ) {
        let fee_split_config: ResourceBridgeFeeSplitConfig = WorldConfigUtilImpl::get_member(
            world, selector!("res_bridge_fee_split_config"),
        );

        // bank fee is same amount as realm fee
        let bank_fee_percent = match direction {
            BridgeDirection::Deposit => { fee_split_config.realm_fee_dpt_percent },
            BridgeDirection::Withdrawal => { fee_split_config.realm_fee_wtdr_percent },
        };
        if bank_fee_percent.is_non_zero() {
            assert!(fee_amount.is_non_zero(), "Bridge: amount too small to pay bank fees");
            match direction {
                BridgeDirection::Deposit => { panic!("Bridge: deposit through bank is not allowed"); },
                BridgeDirection::Withdrawal => {
                    // beam resources into the bank's resource arrivals. it costs 0 donkey and time
                    iResourceTransferImpl::portal_to_structure_arrivals_instant(
                        ref world, bank_structure_id, array![(resource_type, fee_amount)].span(),
                    );
                },
            }
        }
    }


    fn send_platform_fees(
        ref world: WorldStorage, token: ContractAddress, client_fee_recipient: ContractAddress, quote: BridgeQuote,
    ) {
        let fee_split_config: ResourceBridgeFeeSplitConfig = WorldConfigUtilImpl::get_member(
            world, selector!("res_bridge_fee_split_config"),
        );
        assert!(
            quote.velords_fee_token.is_non_zero()
                && quote.season_fee_token.is_non_zero()
                && quote.client_fee_token.is_non_zero(),
            "Bridge: deposit amount too small to take fees",
        );

        // send fees to recipients
        if quote.velords_fee_token.is_non_zero() {
            Self::transfer_or_mint(token, fee_split_config.velords_fee_recipient, quote.velords_fee_token);
        }
        if quote.season_fee_token.is_non_zero() {
            Self::transfer_or_mint(token, fee_split_config.season_pool_fee_recipient, quote.season_fee_token);
        }
        if quote.client_fee_token.is_non_zero() {
            if quote.client_fee_redirected_to_velords {
                Self::transfer_or_mint(token, fee_split_config.velords_fee_recipient, quote.client_fee_token);
            } else {
                Self::transfer_or_mint(token, client_fee_recipient, quote.client_fee_token);
            }
        }
    }
}
