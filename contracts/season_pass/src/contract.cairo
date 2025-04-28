// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts for Cairo 0.16.0

// Eternum Season Pass
use starknet::ContractAddress;

#[starknet::interface]
trait IRealmMetadataEncoded<TState> {
    fn get_encoded_metadata(self: @TState, token_id: u16) -> (felt252, felt252, felt252);
}

#[starknet::interface]
trait ISeasonPass<TState> {
    fn mint(ref self: TState, recipient: ContractAddress, token_id: u256);
    // fn attach_lords(ref self: TState, token_id: u256, amount: u256);
// fn detach_lords(ref self: TState, token_id: u256, amount: u256);
// fn lords_balance(self: @TState, token_id: u256) -> u256;
}


#[starknet::contract]
mod EternumSeasonPass {
    use esp::utils::make_json_and_base64_encode_metadata;
    use openzeppelin::access::ownable::OwnableComponent;
    use openzeppelin::introspection::src5::SRC5Component;
    use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
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
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess, StoragePathEntry, Map};
    use super::{IRealmMetadataEncoded, IRealmMetadataEncodedDispatcher, IRealmMetadataEncodedDispatcherTrait};
    component!(path: ERC721Component, storage: erc721, event: ERC721Event);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: UpgradeableComponent, storage: upgradeable, event: UpgradeableEvent);

    #[abi(embed_v0)]
    impl ERC721Impl = ERC721Component::ERC721Impl<ContractState>;
    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;
    #[abi(embed_v0)]
    impl SRC5Impl = SRC5Component::SRC5Impl<ContractState>;

    impl ERC721InternalImpl = ERC721Component::InternalImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;
    impl UpgradeableInternalImpl = UpgradeableComponent::InternalImpl<ContractState>;

    fn TOKEN_IMAGE_IPFS_CID() -> ByteArray {
        "bafybeigf3hnqeu52erejskxicys5q5oqnfvbkj2o6w7jer5xpna4gpgk2i"
    }

    #[storage]
    struct Storage {
        realms: IERC721Dispatcher,
        lords: IERC20Dispatcher,
        lords_balance: Map<u256, u256>,
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
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        realms_contract_address: ContractAddress,
        lords_contract_address: ContractAddress
    ) {
        self.erc721.initializer("Eternum Season 1 Pass", "ESP1", "");
        self.ownable.initializer(owner);
        self.realms.write(IERC721Dispatcher { contract_address: realms_contract_address });
        self.lords.write(IERC20Dispatcher { contract_address: lords_contract_address });
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
            self.erc721._require_owned(token_id);
            let (name_and_attrs, _url_a, _url_b) = IRealmMetadataEncodedDispatcher {
                contract_address: self.realms.read().contract_address
            }
                .get_encoded_metadata(token_id.try_into().unwrap());

            make_json_and_base64_encode_metadata(name_and_attrs, TOKEN_IMAGE_IPFS_CID())
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

    #[abi(embed_v0)]
    impl SeasonPassImpl of super::ISeasonPass<ContractState> {
        fn mint(ref self: ContractState, recipient: ContractAddress, token_id: u256) {
            // ensure only caller is the token owner
            let caller = starknet::get_caller_address();
            let current_realm_owner = self.realms.read().owner_of(token_id);
            assert!(current_realm_owner == caller, "ESP: Only realm owner can mint season pass");

            // mint season pass
            self.erc721.mint(recipient, token_id);
        }
        // fn attach_lords(ref self: ContractState, token_id: u256, amount: u256) {
    //     // ensure season pass exists
    //     assert!(self.erc721.owner_of(token_id) != Zeroable::zero(), "ESP: Season pass does not exist");

        //     // receive lords from caller
    //     let caller = starknet::get_caller_address();
    //     let this = starknet::get_contract_address();

        //     assert!(self.lords.read().transfer_from(caller, this, amount), "ESP: Failed to transfer lords");

        //     // update lords balance
    //     let lords_balance = self.lords_balance.entry(token_id).read();
    //     self.lords_balance.entry(token_id).write(lords_balance + amount);
    // }

        // fn detach_lords(ref self: ContractState, token_id: u256, amount: u256) {
    //     // ensure caller is season pass owner
    //     let caller = starknet::get_caller_address();
    //     assert!(self.erc721.owner_of(token_id) == caller, "ESP: Only season pass owner can detach lords");

        //     // ensure caller has enough lords
    //     let lords_balance = self.lords_balance.entry(token_id).read();
    //     assert!(lords_balance >= amount, "ESP: Insufficient lords balance");

        //     // transfer lords to caller
    //     assert!(self.lords.read().transfer(caller, amount), "ESP: Failed to transfer lords");

        //     // update lords balance
    //     self.lords_balance.entry(token_id).write(lords_balance - amount);
    // }

        // fn lords_balance(self: @ContractState, token_id: u256) -> u256 {
    //     self.lords_balance.entry(token_id).read()
    // }
    }
}
