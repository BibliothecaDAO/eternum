use core::num::traits::zero::Zero;
use dojo::model::{ModelStorage};
use dojo::world::{WorldStorage, WorldStorageTrait};
use s1_eternum::alias::ID;
use s1_eternum::constants::{RESOURCE_PRECISION};
use s1_eternum::constants::{ResourceTypes, WORLD_CONFIG_ID};
use s1_eternum::models::config::{
    ResourceBridgeConfig, ResourceBridgeFeeSplitConfig, ResourceBridgeWhitelistConfig, WorldConfigUtilImpl,
};
use s1_eternum::models::hyperstructure::{HyperstructureGlobals};
use s1_eternum::models::resource::arrivals::{ResourceArrivalImpl};
use s1_eternum::models::resource::resource::{
    ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, TroopResourceImpl, WeightStoreImpl,
};
use s1_eternum::models::structure::{
    StructureBase, StructureBaseImpl, StructureBaseStoreImpl, StructureCategory, StructureMetadata,
    StructureMetadataStoreImpl, StructureOwnerStoreImpl,
};
use s1_eternum::models::weight::{Weight};
use s1_eternum::systems::utils::erc20::{
    ERC20ABIDispatcher, ERC20ABIDispatcherTrait, ResourceERC20MintableABIDispatcher,
    ResourceERC20MintableABIDispatcherTrait,
};
use s1_eternum::systems::utils::resource::{iResourceTransferImpl};
use s1_eternum::utils::math::{PercentageImpl, PercentageValueImpl, pow};
use starknet::ContractAddress;

#[derive(Copy, Drop, Serde)]
pub enum BridgeTxType {
    Deposit,
    Withdrawal,
}

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

    fn assert_resource_whitelisted(
        world: WorldStorage, resource_bridge_token_whitelist: ResourceBridgeWhitelistConfig,
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

    fn send_realm_fees(
        ref world: WorldStorage,
        from_structure_id: ID,
        from_structure_owner: ContractAddress,
        from_structure_base: StructureBase,
        ref from_structure_weight: Weight,
        resource_type: u8,
        amount: u128,
        tx_type: BridgeTxType,
    ) -> u128 {
        assert!(from_structure_base.category == StructureCategory::Village.into(), "Bridge: caller is not village");

        let fee_split_config: ResourceBridgeFeeSplitConfig = WorldConfigUtilImpl::get_member(
            world, selector!("res_bridge_fee_split_config"),
        );
        let realm_fee_percent = match tx_type {
            BridgeTxType::Deposit => { fee_split_config.realm_fee_dpt_percent },
            BridgeTxType::Withdrawal => { fee_split_config.realm_fee_wtdr_percent },
        };
        if realm_fee_percent.is_non_zero() {
            let realm_fee_amount: u128 = Self::calculate_fees(amount.into(), realm_fee_percent).try_into().unwrap();
            assert!(realm_fee_amount.is_non_zero(), "Bridge: amount too small to pay realm fees");

            let from_structure_metadata: StructureMetadata = StructureMetadataStoreImpl::retrieve(
                ref world, from_structure_id,
            );
            let realm_structure_id: ID = from_structure_metadata.village_realm;

            match tx_type {
                BridgeTxType::Deposit => {
                    // beam resources into the realm's resource arrivals. it costs 0 donkey and time
                    iResourceTransferImpl::portal_to_structure_arrivals_instant(
                        ref world, realm_structure_id, array![(resource_type, realm_fee_amount)].span(),
                    );
                },
                BridgeTxType::Withdrawal => {
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
                        array![(resource_type, realm_fee_amount)].span(),
                        false,
                        false,
                    );
                },
            };
            return realm_fee_amount;
        }
        return 0;
    }

    fn send_platform_fees(
        ref world: WorldStorage,
        token: ContractAddress,
        client_fee_recipient: ContractAddress,
        amount: u256,
        tx_type: BridgeTxType,
    ) -> u256 {
        let fee_split_config: ResourceBridgeFeeSplitConfig = WorldConfigUtilImpl::get_member(
            world, selector!("res_bridge_fee_split_config"),
        );
        let (velords_fee_amount, season_pool_fee_amount, client_fee_amount) = match tx_type {
            BridgeTxType::Deposit => {
                (
                    Self::calculate_fees(amount, fee_split_config.velords_fee_on_dpt_percent),
                    Self::calculate_fees(amount, fee_split_config.season_pool_fee_on_dpt_percent),
                    Self::calculate_fees(amount, fee_split_config.client_fee_on_dpt_percent),
                )
            },
            BridgeTxType::Withdrawal => {
                (
                    Self::calculate_fees(amount, fee_split_config.velords_fee_on_wtdr_percent),
                    Self::calculate_fees(amount, fee_split_config.season_pool_fee_on_wtdr_percent),
                    Self::calculate_fees(amount, fee_split_config.client_fee_on_wtdr_percent),
                )
            },
        };
        assert!(
            velords_fee_amount.is_non_zero() && season_pool_fee_amount.is_non_zero() && client_fee_amount.is_non_zero(),
            "Bridge: deposit amount too small to take fees",
        );

        // send fees to recipients
        if velords_fee_amount.is_non_zero() {
            Self::transfer_or_mint(token, fee_split_config.velords_fee_recipient, velords_fee_amount);
        }
        if season_pool_fee_amount.is_non_zero() {
            Self::transfer_or_mint(token, fee_split_config.season_pool_fee_recipient, season_pool_fee_amount);
        }
        if client_fee_amount.is_non_zero() {
            if client_fee_recipient.is_zero() {
                Self::transfer_or_mint(token, fee_split_config.velords_fee_recipient, client_fee_amount);
            } else {
                Self::transfer_or_mint(token, client_fee_recipient, client_fee_amount);
            }
        }

        // return the total fees sent
        velords_fee_amount + season_pool_fee_amount + client_fee_amount
    }

    fn inefficiency_percentage(ref world: WorldStorage, resource_type: u8) -> (u32, u32) {
        if resource_type == ResourceTypes::LORDS {
            return (100 - 100, 100);
        }

        let hyperstructures_globals: HyperstructureGlobals = world.read_model(WORLD_CONFIG_ID);
        let hyperstructures_completed: u32 = hyperstructures_globals.completed_count;
        let troop_inefficiencies: Array<(u32, u32)> = array![
            (100 - 0, 100), (100 - 25, 100), (100 - 50, 100), (100 - 70, 100), (100 - 85, 100), (100 - 95, 100),
        ];
        let non_troop_inefficiencies = array![
            (100 - 25, 100), (100 - 50, 100), (100 - 70, 100), (100 - 85, 100), (100 - 95, 100), (100 - 95, 100),
        ];
        assert!(
            troop_inefficiencies.len() == non_troop_inefficiencies.len(),
            "Bridge: troop inefficiencies must be equal to non-troop inefficiencies",
        );

        let mut inefficiency_index: u32 = hyperstructures_completed;
        let last_inefficiency_index: u32 = troop_inefficiencies.len() - 1;
        if hyperstructures_completed > last_inefficiency_index {
            inefficiency_index = last_inefficiency_index;
        }

        if TroopResourceImpl::is_troop(resource_type) {
            return *troop_inefficiencies.at(inefficiency_index);
        } else {
            return *non_troop_inefficiencies.at(inefficiency_index);
        }
    }

    fn calculate_fees(amount: u256, fee_percent: u16) -> u256 {
        return (amount * fee_percent.into()) / PercentageValueImpl::_100().into();
    }
}

