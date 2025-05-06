// Eternum Village Pass
// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts for Cairo ^1.0.0

use starknet::ContractAddress;

#[starknet::interface]
trait IVillagePass<TState> {
    fn mint(ref self: TState, recipient: ContractAddress) -> u256;
    fn batch_transfer_from(ref self: TState, from: ContractAddress, to: ContractAddress, amount: u16) -> Span<u256>;
}


const MINTER_ROLE: felt252 = selector!("MINTER_ROLE");
const UPGRADER_ROLE: felt252 = selector!("UPGRADER_ROLE");
const DISTRIBUTOR_ROLE: felt252 = selector!("DISTRIBUTOR_ROLE");

#[starknet::contract]
mod EternumVillagePass {
    use evp::utils::make_json_and_base64_encode_metadata;
    use openzeppelin::access::accesscontrol::{AccessControlComponent, DEFAULT_ADMIN_ROLE};
    use openzeppelin::introspection::src5::SRC5Component;
    use openzeppelin::token::erc721::ERC721Component;
    use openzeppelin::token::erc721::extensions::ERC721EnumerableComponent;
    use openzeppelin::token::erc721::interface::{
        IERC721Dispatcher, IERC721DispatcherTrait, IERC721Metadata, IERC721MetadataCamelOnly, IERC721MetadataDispatcher,
        IERC721MetadataDispatcherTrait,
    };
    use openzeppelin::upgrades::UpgradeableComponent;
    use openzeppelin::upgrades::interface::IUpgradeable;
    use starknet::storage::{Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ClassHash, ContractAddress};
    use super::{DISTRIBUTOR_ROLE, MINTER_ROLE, UPGRADER_ROLE};

    component!(path: ERC721Component, storage: erc721, event: ERC721Event);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);
    component!(path: AccessControlComponent, storage: accesscontrol, event: AccessControlEvent);
    component!(path: ERC721EnumerableComponent, storage: erc721_enumerable, event: ERC721EnumerableEvent);
    component!(path: UpgradeableComponent, storage: upgradeable, event: UpgradeableEvent);


    // External
    #[abi(embed_v0)]
    impl ERC721Impl = ERC721Component::ERC721Impl<ContractState>;
    #[abi(embed_v0)]
    impl ERC721CamelOnlyImpl = ERC721Component::ERC721CamelOnlyImpl<ContractState>;
    #[abi(embed_v0)]
    impl AccessControlImpl = AccessControlComponent::AccessControlImpl<ContractState>;
    #[abi(embed_v0)]
    impl AccessControlCamelImpl = AccessControlComponent::AccessControlCamelImpl<ContractState>;
    #[abi(embed_v0)]
    impl ERC721EnumerableImpl = ERC721EnumerableComponent::ERC721EnumerableImpl<ContractState>;
    #[abi(embed_v0)]
    impl SRC5Impl = SRC5Component::SRC5Impl<ContractState>;

    // Internal
    impl ERC721InternalImpl = ERC721Component::InternalImpl<ContractState>;
    impl AccessControlInternalImpl = AccessControlComponent::InternalImpl<ContractState>;
    impl ERC721EnumerableInternalImpl = ERC721EnumerableComponent::InternalImpl<ContractState>;
    impl UpgradeableInternalImpl = UpgradeableComponent::InternalImpl<ContractState>;

    fn TOKEN_IMAGE_IPFS_CID() -> ByteArray {
        "bafybeiae3us54v5rd37qs44lmbefe6wjja5hfdnszpvlbo2kr4pejoxnou"
    }

    #[storage]
    struct Storage {
        counter: u16,
        #[substorage(v0)]
        erc721: ERC721Component::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
        #[substorage(v0)]
        accesscontrol: AccessControlComponent::Storage,
        #[substorage(v0)]
        erc721_enumerable: ERC721EnumerableComponent::Storage,
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
        AccessControlEvent: AccessControlComponent::Event,
        #[flat]
        ERC721EnumerableEvent: ERC721EnumerableComponent::Event,
        #[flat]
        UpgradeableEvent: UpgradeableComponent::Event,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        default_admin: ContractAddress,
        upgrader: ContractAddress,
        minter: ContractAddress,
        distributors: Span<ContractAddress>,
    ) {
        self.erc721.initializer("EternumVillagePass", "EVP1", "");
        self.accesscontrol.initializer();
        self.erc721_enumerable.initializer();

        self.accesscontrol._grant_role(DEFAULT_ADMIN_ROLE, default_admin);
        self.accesscontrol._grant_role(UPGRADER_ROLE, upgrader);
        self.accesscontrol._grant_role(MINTER_ROLE, minter);
        for distributor in distributors {
            self.accesscontrol._grant_role(DISTRIBUTOR_ROLE, *distributor);
        };
    }

    impl ERC721HooksImpl of ERC721Component::ERC721HooksTrait<ContractState> {
        fn before_update(
            ref self: ERC721Component::ComponentState<ContractState>,
            to: ContractAddress,
            token_id: u256,
            auth: ContractAddress,
        ) {
            let mut contract_state = self.get_contract_mut();
            contract_state.erc721_enumerable.before_update(to, token_id);
            let owner: ContractAddress = contract_state.erc721._owner_of(token_id);
            if owner.is_non_zero() {
                let owner_has_distributor_role = contract_state.accesscontrol.has_role(DISTRIBUTOR_ROLE, owner);
                let auth_has_distributor_role = contract_state.accesscontrol.has_role(DISTRIBUTOR_ROLE, auth);
                assert!(
                    owner_has_distributor_role || auth_has_distributor_role,
                    "EVP: Village token can not be transferred",
                );
            }
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
            make_json_and_base64_encode_metadata(TOKEN_IMAGE_IPFS_CID())
        }
    }


    #[abi(embed_v0)]
    impl ERC721MetadataCamelOnly of IERC721MetadataCamelOnly<ContractState> {
        fn tokenURI(self: @ContractState, tokenId: u256) -> ByteArray {
            ERC721Metadata::token_uri(self, tokenId)
        }
    }

    #[abi(embed_v0)]
    impl VillagePassImpl of super::IVillagePass<ContractState> {
        fn mint(ref self: ContractState, recipient: ContractAddress) -> u256 {
            // increase counter
            let token_id = self.counter.read() + 1;
            self.counter.write(token_id);

            // ensure only minter
            self.accesscontrol.assert_only_role(MINTER_ROLE);

            // mint the token
            self.erc721.mint(recipient, token_id.into());

            token_id.into()
        }

        // todo: ensure only authorized callers
        fn batch_transfer_from(
            ref self: ContractState, from: ContractAddress, to: ContractAddress, amount: u16,
        ) -> Span<u256> {
            let mut token_ids = array![];
            for _ in 0..amount {
                let token_id = self.erc721_enumerable.token_of_owner_by_index(from, 0);
                self.erc721.transfer_from(from, to, token_id);
                token_ids.append(token_id);
            };
            token_ids.span()
        }
    }

    //
    // Upgradeable
    //

    #[abi(embed_v0)]
    impl UpgradeableImpl of IUpgradeable<ContractState> {
        fn upgrade(ref self: ContractState, new_class_hash: ClassHash) {
            self.accesscontrol.assert_only_role(UPGRADER_ROLE);
            self.upgradeable.upgrade(new_class_hash);
        }
    }
}
