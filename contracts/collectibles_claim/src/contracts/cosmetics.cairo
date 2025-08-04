// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts for Cairo 0.20.0

//! # Cosmetic Collectibles Claim Contract
//!
//! An contract that allows users to claim collectibles from the Cosmetic Collectibles contract.

use starknet::ContractAddress;

/// Minting functionality for ERC721 tokens with packed attributes.
#[starknet::interface]
trait CollectibleMintTrait<TState> {
    fn safe_mint(ref self: TState, recipient: ContractAddress, attributes_raw: u128);
}


#[starknet::interface]
trait ICosmeticCollectiblesClaim<TState> {
    fn claim(ref self: TState, token_id: u256);
}


// Role constants for access control
const UPGRADER_ROLE: felt252 = selector!("UPGRADER_ROLE");

/// Main contract implementation with all components integrated
#[starknet::contract]
mod CosmeticCollectiblesClaim {
    use collectibles_claim::utils::random;
    use collectibles_claim::utils::random::VRFImpl;
    use core::num::traits::Zero;
    use openzeppelin::access::accesscontrol::AccessControlComponent;
    use openzeppelin::access::accesscontrol::DEFAULT_ADMIN_ROLE;
    use openzeppelin::access::ownable::OwnableComponent;
    use openzeppelin::introspection::src5::SRC5Component;
    use openzeppelin::token::common::erc2981::{DefaultConfig, ERC2981Component};
    use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use openzeppelin::token::erc721::ERC721Component;
    use openzeppelin::token::erc721::extensions::ERC721EnumerableComponent;
    use openzeppelin::token::erc721::interface::{
        IERC721Dispatcher, IERC721DispatcherTrait, IERC721Metadata, IERC721MetadataCamelOnly, IERC721MetadataDispatcher,
        IERC721MetadataDispatcherTrait,
    };
    use openzeppelin::upgrades::UpgradeableComponent;
    use openzeppelin::upgrades::interface::IUpgradeable;

    use starknet::ClassHash;
    use starknet::ContractAddress;
    use starknet::storage::{Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess};
    use super::{
        CollectibleMintTrait, CollectibleMintTraitDispatcher, CollectibleMintTraitDispatcherTrait,
        ICosmeticCollectiblesClaim,
    };
    use super::{UPGRADER_ROLE};

    component!(path: SRC5Component, storage: src5, event: SRC5Event);
    component!(path: AccessControlComponent, storage: accesscontrol, event: AccessControlEvent);
    component!(path: UpgradeableComponent, storage: upgradeable, event: UpgradeableEvent);

    #[abi(embed_v0)]
    impl AccessControlMixinImpl = AccessControlComponent::AccessControlMixinImpl<ContractState>;


    // Internal impls
    impl UpgradeableInternalImpl = UpgradeableComponent::InternalImpl<ContractState>;
    impl AccessControlInternalImpl = AccessControlComponent::InternalImpl<ContractState>;

    /// Event emitted when a collectible is claimed
    #[derive(Drop, starknet::Event)]
    pub struct CollectibleClaimed {
        #[key]
        pub token_address: ContractAddress,
        #[key]
        pub attributes_raw: u128,
        #[key]
        pub token_recipient: ContractAddress,
        pub timestamp: u64,
    }

    /// Contract storage structure containing all state variables
    #[storage]
    struct Storage {
        payment_erc721_address: ContractAddress,
        collectible_erc721_address: ContractAddress,
        vrf_provider_address: ContractAddress,
        #[substorage(v0)]
        accesscontrol: AccessControlComponent::Storage,
        #[substorage(v0)]
        upgradeable: UpgradeableComponent::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        AccessControlEvent: AccessControlComponent::Event,
        #[flat]
        UpgradeableEvent: UpgradeableComponent::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
        CollectibleClaimed: CollectibleClaimed,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        collectible_erc721_address: ContractAddress,
        payment_erc721_address: ContractAddress,
        vrf_provider_address: ContractAddress,
        default_admin: ContractAddress,
        upgrader: ContractAddress,
    ) {
        self.accesscontrol.initializer();
        self.accesscontrol._grant_role(DEFAULT_ADMIN_ROLE, default_admin);
        self.accesscontrol._grant_role(UPGRADER_ROLE, upgrader);

        self.collectible_erc721_address.write(collectible_erc721_address);
        self.payment_erc721_address.write(payment_erc721_address);
        self.vrf_provider_address.write(vrf_provider_address);
    }

    #[abi(embed_v0)]
    impl UpgradeableImpl of IUpgradeable<ContractState> {
        fn upgrade(ref self: ContractState, new_class_hash: ClassHash) {
            self.accesscontrol.assert_only_role(UPGRADER_ROLE);
            self.upgradeable.upgrade(new_class_hash);
        }
    }

    #[abi(embed_v0)]
    impl CosmeticCollectiblesClaimImpl of ICosmeticCollectiblesClaim<ContractState> {
        fn claim(ref self: ContractState, token_id: u256) {
            let payment_token = IERC721Dispatcher { contract_address: self.payment_erc721_address.read() };

            // Transfer the payment token to the contract
            let caller = starknet::get_caller_address();
            let this = starknet::get_contract_address();
            payment_token.transfer_from(caller, this, token_id);

            // randomly select the collectible attributes
            let vrf_provider_address = self.vrf_provider_address.read();
            let vrf_seed: u256 = VRFImpl::seed(caller, vrf_provider_address);
            let collectible_attributes = InternalImpl::get_collectibles_attributes(vrf_seed);

            // mint the randomly collectibles
            let collectible_token_address = self.collectible_erc721_address.read();
            let collectible_token = CollectibleMintTraitDispatcher { contract_address: collectible_token_address };
            let now = starknet::get_block_timestamp();

            for i in 0..collectible_attributes.len() {
                let attributes_raw = *collectible_attributes[i];
                collectible_token.safe_mint(caller, attributes_raw);

                // emit the event
                self
                    .emit(
                        CollectibleClaimed {
                            token_address: collectible_token_address,
                            attributes_raw: attributes_raw,
                            token_recipient: caller,
                            timestamp: now,
                        },
                    );
            }
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn num_collectibles() -> u128 {
            3
        }

        fn collectibles_attributes_probabilities() -> (Span<u128>, Span<u128>) {
            (
                array![
                    0x000000000007,
                    0x000200000007,
                    0x001000000007,
                    0x0003000000007,
                    0x000400000007,
                    0x0001000000007,
                    0x003000000007,
                    0x005000000007,
                    0x000100040007,
                    0x0001111000007,
                ]
                    .span(),
                array![422, 141, 141, 845, 845, 1268, 1268, 169, 169, 169].span(),
            )
        }


        fn get_collectibles_attributes(vrf_seed: u256) -> Span<u128> {
            let (choices, weights) = Self::collectibles_attributes_probabilities();
            random::choices(choices, weights, array![].span(), Self::num_collectibles(), true, vrf_seed)
        }
    }
}
