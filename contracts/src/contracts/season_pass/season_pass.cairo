// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts for Cairo ^0.17.0

// Eternum Season Pass
#[starknet::interface]
trait IRealmMetadataEncoded<TState> {
    fn get_encoded_metadata(self: @TState, token_id: u16) -> (felt252, felt252, felt252);
}

#[starknet::contract]
mod EternumSeasonPass {
    use openzeppelin::access::ownable::OwnableComponent;
    use openzeppelin::introspection::src5::SRC5Component;
    use openzeppelin::token::erc721::ERC721Component;
    use openzeppelin::token::erc721::ERC721HooksEmptyImpl;
    use openzeppelin::token::erc721::interface::{
        IERC721Metadata, IERC721MetadataDispatcher, IERC721MetadataDispatcherTrait, IERC721Dispatcher,
        IERC721DispatcherTrait, IERC721MetadataCamelOnly,
    };
    use openzeppelin::upgrades::UpgradeableComponent;
    use openzeppelin::upgrades::interface::IUpgradeable;

    use starknet::ClassHash;
    use starknet::ContractAddress;
    use super::{IRealmMetadataEncoded, IRealmMetadataEncodedDispatcher, IRealmMetadataEncodedDispatcherTrait};
    component!(path: ERC721Component, storage: erc721, event: ERC721Event);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: UpgradeableComponent, storage: upgradeable, event: UpgradeableEvent);

    #[abi(embed_v0)]
    impl ERC721Impl = ERC721Component::ERC721Impl<ContractState>;
    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;

    impl ERC721InternalImpl = ERC721Component::InternalImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;
    impl UpgradeableInternalImpl = UpgradeableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        realms: IERC721Dispatcher,
        #[substorage(v0)]
        erc721: ERC721Component::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        #[substorage(v0)]
        upgradeable: UpgradeableComponent::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        ERC721Event: ERC721Component::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        #[flat]
        UpgradeableEvent: UpgradeableComponent::Event,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress, realms_contract_address: ContractAddress) {
        self.erc721.initializer("Eternum Season 0 Pass", "ES0P", "");
        self.ownable.initializer(owner);
        self.realms.write(IERC721Dispatcher { contract_address: realms_contract_address });
    }

    #[abi(embed_v0)]
    impl UpgradeableImpl of IUpgradeable<ContractState> {
        fn upgrade(ref self: ContractState, new_class_hash: ClassHash) {
            self.ownable.assert_only_owner();
            self.upgradeable.upgrade(new_class_hash);
        }
    }

    #[abi(embed_v0)]
    impl ERC721Metadata of IERC721Metadata<ContractState> {
        /// Returns the NFT name.
        fn name(self: @ContractState) -> ByteArray {
            self.erc721.ERC721_name.read()
        }

        /// Returns the NFT symbol.
        fn symbol(self: @ContractState) -> ByteArray {
            self.erc721.ERC721_symbol.read()
        }

        /// Returns the Uniform Resource Identifier (URI) for the `token_id` token.
        /// If the URI is not set, the return value will be an empty ByteArray.
        ///
        /// Requirements:
        ///
        /// - `token_id` exists.
        fn token_uri(self: @ContractState, token_id: u256) -> ByteArray {
            IERC721MetadataDispatcher { contract_address: self.realms.read().contract_address }.token_uri(token_id)
        }
    }


    #[abi(embed_v0)]
    impl ERC721MetadataCamelOnly of IERC721MetadataCamelOnly<ContractState> {
        fn tokenURI(self: @ContractState, tokenId: u256) -> ByteArray {
            ERC721Metadata::token_uri(self, tokenId)
        }
    }

    #[abi(embed_v0)]
    impl RealmMetadataEncodedImpl of IRealmMetadataEncoded<ContractState> {
        fn get_encoded_metadata(self: @ContractState, token_id: u16) -> (felt252, felt252, felt252) {
            IRealmMetadataEncodedDispatcher { contract_address: self.realms.read().contract_address }
                .get_encoded_metadata(token_id)
        }
    }

    #[generate_trait]
    #[abi(per_item)]
    impl ERC721MintImpl of ERC721MintTrait {
        #[external(v0)]
        fn mint(ref self: ContractState, token_id: u256) {
            // ensure caller is the current realm owner
            let caller = starknet::get_caller_address();
            let current_realm_owner = self.realms.read().owner_of(token_id);
            assert!(current_realm_owner == caller, "ESP: Only realm owner can mint season pass");

            // mint season pass
            self.erc721.mint(caller, token_id);
        }
    }
}
