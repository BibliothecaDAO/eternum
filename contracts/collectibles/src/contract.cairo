// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts for Cairo 0.20.0

// Realms Collectible
use starknet::ContractAddress;
#[starknet::interface]
trait ERC721MintBurnTrait<TState> {
    fn burn(ref self: TState, token_id: u256);
    fn safe_mint(ref self: TState, recipient: ContractAddress, attributes_raw: u128);
    fn safe_mint_many(ref self: TState, recipient: ContractAddress, attributes_and_counts: Span<(u128, u16)>);
}

#[starknet::interface]
trait ERC721EnumerableTransferAmountTrait<TState> {
    fn transfer_amount(ref self: TState, from: ContractAddress, to: ContractAddress, amount: u16) -> Span<u256>;
}


#[starknet::interface]
trait IRealmsCollectibleMetadata<TState> {
    // trait_type_id is a number from 0 to 15 (128/8 = 16)
    // trait_value_id is a number 1 to 255 (u8)

    fn set_default_ipfs_cid(ref self: TState, ipfs_cid: ByteArray, overwrite: bool);
    fn set_attrs_raw_to_ipfs_cid(ref self: TState, attrs_raw: u128, ipfs_cid: ByteArray, overwrite: bool);

    fn set_trait_type_name(ref self: TState, trait_type_id: u8, name: ByteArray, overwrite: bool);
    fn set_trait_value_name(ref self: TState, trait_type_id: u8, trait_value_id: u8, name: ByteArray, overwrite: bool);

    fn get_trait_type_name(self: @TState, trait_type_id: u8) -> ByteArray;
    fn get_trait_value_name(self: @TState, trait_type_id: u8, trait_value_id: u8) -> ByteArray;

    fn get_metadata_raw(self: @TState, token_id: u256) -> u128;
    fn get_metadata_json(self: @TState, token_id: u256) -> ByteArray;
}

#[derive(Copy, Drop, Serde)]
enum LockState {
    #[default]
    Inactive,
    Active,
}

#[starknet::interface]
trait IRealmsCollectibleLock<TState> {
    fn token_lock(ref self: TState, token_id: u256, lock_id: felt252);
    fn token_unlock(ref self: TState, token_id: u256);
    fn token_lock_state(self: @TState, token_id: u256) -> (felt252, felt252);
    fn token_is_locked(self: @TState, token_id: u256) -> bool;
}

#[starknet::interface]
trait IRealmsCollectibleLockAdmin<TState> {
    fn lock_state_update(ref self: TState, lock_id: felt252, unlock_at: u64);
}


const METADATA_UPDATER_ROLE: felt252 = selector!("METADATA_UPDATER_ROLE");
const MINTER_ROLE: felt252 = selector!("MINTER_ROLE");
const UPGRADER_ROLE: felt252 = selector!("UPGRADER_ROLE");
const LOCKER_ROLE: felt252 = selector!("LOCKER_ROLE");

#[starknet::contract]
mod RealmsCollectible {
    use collectibles::utils::{make_json_and_base64_encode_metadata, unpack_u128_to_bytes_full};
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
    use super::LockState;
    use super::{ERC721EnumerableTransferAmountTrait};
    use super::{IRealmsCollectibleLock, IRealmsCollectibleLockDispatcher, IRealmsCollectibleLockDispatcherTrait};
    use super::{
        IRealmsCollectibleLockAdmin, IRealmsCollectibleLockAdminDispatcher, IRealmsCollectibleLockAdminDispatcherTrait,
    };
    use super::{
        IRealmsCollectibleMetadata, IRealmsCollectibleMetadataDispatcher, IRealmsCollectibleMetadataDispatcherTrait,
    };
    use super::{LOCKER_ROLE, METADATA_UPDATER_ROLE, MINTER_ROLE, UPGRADER_ROLE};

    component!(path: ERC721Component, storage: erc721, event: ERC721Event);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);
    component!(path: AccessControlComponent, storage: accesscontrol, event: AccessControlEvent);
    component!(path: UpgradeableComponent, storage: upgradeable, event: UpgradeableEvent);
    component!(path: ERC2981Component, storage: erc2981, event: ERC2981Event);
    component!(path: ERC721EnumerableComponent, storage: erc721_enumerable, event: ERC721EnumerableEvent);

    #[abi(embed_v0)]
    impl ERC721Impl = ERC721Component::ERC721Impl<ContractState>;
    #[abi(embed_v0)]
    impl AccessControlMixinImpl = AccessControlComponent::AccessControlMixinImpl<ContractState>;
    // #[abi(embed_v0)]
    // impl SRC5Impl = SRC5Component::SRC5Impl<ContractState>;
    #[abi(embed_v0)]
    impl ERC2981Impl = ERC2981Component::ERC2981Impl<ContractState>;
    #[abi(embed_v0)]
    impl ERC2981InfoImpl = ERC2981Component::ERC2981InfoImpl<ContractState>;
    #[abi(embed_v0)]
    impl ERC2981AdminAccessControlImpl = ERC2981Component::ERC2981AdminAccessControlImpl<ContractState>;
    #[abi(embed_v0)]
    impl ERC721EnumerableImpl = ERC721EnumerableComponent::ERC721EnumerableImpl<ContractState>;

    impl ERC721InternalImpl = ERC721Component::InternalImpl<ContractState>;
    impl UpgradeableInternalImpl = UpgradeableComponent::InternalImpl<ContractState>;
    impl ERC2981InternalImpl = ERC2981Component::InternalImpl<ContractState>;
    impl AccessControlInternalImpl = AccessControlComponent::InternalImpl<ContractState>;
    impl ERC721EnumerableInternalImpl = ERC721EnumerableComponent::InternalImpl<ContractState>;


    #[derive(Drop, starknet::Event)]
    pub struct TraitTypeUpdated {
        #[key]
        pub trait_type_id: u8,
        pub trait_type_name: ByteArray,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct TraitValueUpdated {
        #[key]
        pub trait_type_id: u8,
        #[key]
        pub trait_value_id: u8,
        pub trait_value_name: ByteArray,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct TokenLockStateUpdated {
        #[key]
        pub token_id: u256,
        #[key]
        pub lock_id: felt252,
        pub lock_state: LockState,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct LockStateUpdated {
        #[key]
        pub lock_id: felt252,
        pub unlock_at: u64,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct DefaultIPFSCIDUpdated {
        #[key]
        pub ipfs_cid: ByteArray,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct AttrsRawToIPFSCIDUpdated {
        #[key]
        pub attrs_raw: u128,
        #[key]
        pub ipfs_cid: ByteArray,
        pub timestamp: u64,
    }


    #[storage]
    struct Storage {
        counter: u128,
        token_id_to_attrs_raw: Map<u256, u128>,
        default_ipfs_cid: ByteArray,
        attrs_raw_to_ipfs_cid: Map<u128, ByteArray>,
        trait_type_to_name: Map<u8, ByteArray>,
        trait_value_to_name: Map<(u8, u8), ByteArray>,
        // Map token_id to (lock_id, lock_tx_hash)
        token_lock: Map<u256, (felt252, felt252)>,
        // Map lock_id to unlock_at (timestamp)
        lock_state: Map<felt252, u64>,
        #[substorage(v0)]
        erc721: ERC721Component::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
        #[substorage(v0)]
        erc721_enumerable: ERC721EnumerableComponent::Storage,
        #[substorage(v0)]
        accesscontrol: AccessControlComponent::Storage,
        #[substorage(v0)]
        upgradeable: UpgradeableComponent::Storage,
        #[substorage(v0)]
        erc2981: ERC2981Component::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        ERC721Event: ERC721Component::Event,
        #[flat]
        ERC721EnumerableEvent: ERC721EnumerableComponent::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
        #[flat]
        AccessControlEvent: AccessControlComponent::Event,
        #[flat]
        UpgradeableEvent: UpgradeableComponent::Event,
        #[flat]
        ERC2981Event: ERC2981Component::Event,
        // todo: check how bytearray looks in events
        TraitTypeUpdated: TraitTypeUpdated,
        TraitValueUpdated: TraitValueUpdated,
        TokenLockStateUpdated: TokenLockStateUpdated,
        LockStateUpdated: LockStateUpdated,
        DefaultIPFSCIDUpdated: DefaultIPFSCIDUpdated,
        AttrsRawToIPFSCIDUpdated: AttrsRawToIPFSCIDUpdated,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        erc721_name: ByteArray,
        erc721_symbol: ByteArray,
        erc721_base_uri: ByteArray,
        default_admin: ContractAddress,
        minter: ContractAddress,
        upgrader: ContractAddress,
        locker: ContractAddress,
        metadata_updater: ContractAddress,
        default_royalty_receiver: ContractAddress,
        fee_numerator: u128,
    ) {
        self.erc721.initializer(erc721_name, erc721_symbol, erc721_base_uri);
        self.erc721_enumerable.initializer();
        self.erc2981.initializer(default_royalty_receiver, fee_numerator);

        self.accesscontrol.initializer();
        self.accesscontrol._grant_role(DEFAULT_ADMIN_ROLE, default_admin);
        self.accesscontrol._grant_role(UPGRADER_ROLE, upgrader);
        self.accesscontrol._grant_role(MINTER_ROLE, minter);
        self.accesscontrol._grant_role(LOCKER_ROLE, locker);
        self.accesscontrol._grant_role(METADATA_UPDATER_ROLE, metadata_updater);
    }

    #[abi(embed_v0)]
    impl UpgradeableImpl of IUpgradeable<ContractState> {
        fn upgrade(ref self: ContractState, new_class_hash: ClassHash) {
            self.accesscontrol.assert_only_role(UPGRADER_ROLE);
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
            RealmsCollectibleMetadataImpl::get_metadata_json(self, token_id)
        }
    }

    impl ERC721HooksImpl of ERC721Component::ERC721HooksTrait<ContractState> {
        fn before_update(
            ref self: ERC721Component::ComponentState<ContractState>,
            to: ContractAddress,
            token_id: u256,
            auth: ContractAddress,
        ) {
            let mut contract_state = self.get_contract_mut();
            // attempt to unlock token and check if token is locked
            contract_state.token_unlock(token_id);
            assert!(!contract_state.token_is_locked(token_id), "RealmsCollectible: Token is locked");
            contract_state.erc721_enumerable.before_update(to, token_id);
        }
    }

    #[abi(embed_v0)]
    impl ERC721EnumerableTransferAmountImpl of ERC721EnumerableTransferAmountTrait<ContractState> {
        fn transfer_amount(
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


    #[abi(embed_v0)]
    impl ERC721MetadataCamelOnly of IERC721MetadataCamelOnly<ContractState> {
        fn tokenURI(self: @ContractState, tokenId: u256) -> ByteArray {
            ERC721Metadata::token_uri(self, tokenId)
        }
    }

    #[abi(embed_v0)]
    impl ERC721MintBurnImpl of super::ERC721MintBurnTrait<ContractState> {
        fn burn(ref self: ContractState, token_id: u256) {
            self.erc721.update(Zero::zero(), token_id, starknet::get_caller_address());
        }

        fn safe_mint(ref self: ContractState, recipient: ContractAddress, attributes_raw: u128) {
            self.accesscontrol.assert_only_role(MINTER_ROLE);

            // increment counter
            let token_id = self.counter.read() + 1;
            self.counter.write(token_id);

            // set attributes raw
            assert!(attributes_raw != 0, "RealmsCollectible: Attributes raw must be non-zero");

            // ensure ipfs image is already set for those attributes
            let ipfs_cid = self.attrs_raw_to_ipfs_cid.entry(attributes_raw).read();
            assert!(ipfs_cid != "", "RealmsCollectible: IPFS CID not set for those attributes");

            self.token_id_to_attrs_raw.entry(token_id.into()).write(attributes_raw);

            // mint token
            self.erc721.safe_mint(recipient, token_id.into(), array![].span());
        }


        fn safe_mint_many(
            ref self: ContractState, recipient: ContractAddress, mut attributes_and_counts: Span<(u128, u16)>,
        ) {
            while attributes_and_counts.len() > 0 {
                let (attributes_raw, count) = attributes_and_counts.pop_front().unwrap();
                let (attributes_raw, count) = (*attributes_raw, *count);
                for _ in 0..count {
                    self.safe_mint(recipient, attributes_raw);
                }
            }
        }
    }


    #[abi(embed_v0)]
    impl RealmsCollectibleMetadataImpl of IRealmsCollectibleMetadata<ContractState> {
        fn set_default_ipfs_cid(ref self: ContractState, ipfs_cid: ByteArray, overwrite: bool) {
            self.accesscontrol.assert_only_role(METADATA_UPDATER_ROLE);

            let current_ipfs_cid = self.default_ipfs_cid.read();
            if current_ipfs_cid != "" {
                if current_ipfs_cid == ipfs_cid {
                    return;
                } else {
                    assert!(overwrite, "RealmsCollectible: Default IPFS CID already exists");
                }
            }
            self.default_ipfs_cid.write(format!("{}", ipfs_cid));
            self.emit(DefaultIPFSCIDUpdated { ipfs_cid, timestamp: starknet::get_block_timestamp() });
        }

        fn set_attrs_raw_to_ipfs_cid(ref self: ContractState, attrs_raw: u128, ipfs_cid: ByteArray, overwrite: bool) {
            self.accesscontrol.assert_only_role(METADATA_UPDATER_ROLE);

            let current_ipfs_cid = self.attrs_raw_to_ipfs_cid.entry(attrs_raw).read();
            if current_ipfs_cid != "" {
                if current_ipfs_cid == ipfs_cid {
                    return;
                } else {
                    assert!(overwrite, "RealmsCollectible: Attrs raw to IPFS CID already exists");
                }
            }
            self.attrs_raw_to_ipfs_cid.entry(attrs_raw).write(format!("{}", ipfs_cid));
            self.emit(AttrsRawToIPFSCIDUpdated { attrs_raw, ipfs_cid, timestamp: starknet::get_block_timestamp() });
        }

        fn set_trait_type_name(ref self: ContractState, trait_type_id: u8, name: ByteArray, overwrite: bool) {
            self.accesscontrol.assert_only_role(METADATA_UPDATER_ROLE);
            assert!(trait_type_id < 16, "RealmsCollectible: Trait type id must be a value between 0 and 15");

            let current_name = self.trait_type_to_name.entry(trait_type_id).read();
            if current_name != "" {
                if current_name == name {
                    return;
                } else {
                    assert!(overwrite, "RealmsCollectible: Trait type name already exists");
                }
            }
            self.trait_type_to_name.entry(trait_type_id).write(format!("{}", name));
            self
                .emit(
                    TraitTypeUpdated {
                        trait_type_id, trait_type_name: name, timestamp: starknet::get_block_timestamp(),
                    },
                );
        }

        fn set_trait_value_name(
            ref self: ContractState, trait_type_id: u8, trait_value_id: u8, name: ByteArray, overwrite: bool,
        ) {
            self.accesscontrol.assert_only_role(METADATA_UPDATER_ROLE);
            assert!(trait_type_id < 16, "RealmsCollectible: Trait type id must be a value between 0 and 15");
            assert!(trait_value_id > 0, "RealmsCollectible: Trait value id must be a value between 1 and 255");

            let current_name = self.trait_value_to_name.entry((trait_type_id, trait_value_id)).read();
            if current_name != "" {
                if current_name == name {
                    return;
                } else {
                    assert!(overwrite, "RealmsCollectible: Trait value name already exists");
                }
            }

            self.trait_value_to_name.entry((trait_type_id, trait_value_id)).write(format!("{}", name));
            self
                .emit(
                    TraitValueUpdated {
                        trait_type_id,
                        trait_value_id,
                        trait_value_name: name,
                        timestamp: starknet::get_block_timestamp(),
                    },
                );
        }

        fn get_trait_type_name(self: @ContractState, trait_type_id: u8) -> ByteArray {
            assert!(trait_type_id < 16, "RealmsCollectible: Trait type id must be a value between 0 and 15");
            self.trait_type_to_name.entry(trait_type_id).read()
        }

        fn get_trait_value_name(self: @ContractState, trait_type_id: u8, trait_value_id: u8) -> ByteArray {
            assert!(trait_type_id < 16, "RealmsCollectible: Trait type id must be a value between 0 and 15");
            assert!(trait_value_id > 0, "RealmsCollectible: Trait value id must be a value between 1 and 255");
            self.trait_value_to_name.entry((trait_type_id, trait_value_id)).read()
        }

        fn get_metadata_raw(self: @ContractState, token_id: u256) -> u128 {
            self.token_id_to_attrs_raw.entry(token_id).read()
        }

        fn get_metadata_json(self: @ContractState, token_id: u256) -> ByteArray {
            let attrs_raw: u128 = self.token_id_to_attrs_raw.entry(token_id).read();
            let mut ipfs_cid: ByteArray = self.attrs_raw_to_ipfs_cid.entry(attrs_raw).read();
            if ipfs_cid == "" {
                ipfs_cid = self.default_ipfs_cid.read();
            }
            let mut attrs_arr: Array<u8> = unpack_u128_to_bytes_full(attrs_raw);
            let mut attrs_data: Array<(ByteArray, ByteArray)> = array![];
            for i in 0..attrs_arr.len() {
                let trait_value: u8 = attrs_arr.pop_front().unwrap();
                if trait_value > 0 {
                    let trait_type_name: ByteArray = self.trait_type_to_name.entry(i.try_into().unwrap()).read();
                    let trait_value_name: ByteArray = self
                        .trait_value_to_name
                        .entry((i.try_into().unwrap(), trait_value))
                        .read();
                    // Only add trait if both type and value names are defined
                    if trait_type_name != "" && trait_value_name != "" {
                        attrs_data.append((trait_type_name, trait_value_name));
                    }
                }
            };

            make_json_and_base64_encode_metadata(attrs_data, ipfs_cid)
        }
    }


    #[abi(embed_v0)]
    impl RealmsCollectibleLockImpl of IRealmsCollectibleLock<ContractState> {
        fn token_lock(ref self: ContractState, token_id: u256, lock_id: felt252) {
            // Ensure token exists and caller is the owner
            self.erc721._require_owned(token_id);
            let caller = starknet::get_caller_address();
            let owner = self.erc721._owner_of(token_id);
            assert!(caller == owner, "RealmsCollectible: Caller is not owner");

            let unlock_at = self.lock_state.entry(lock_id).read();
            assert!(unlock_at > starknet::get_block_timestamp(), "RealmsCollectible: Lock is not active");

            self.token_lock.entry(token_id).write((lock_id, starknet::get_tx_info().transaction_hash));

            self
                .emit(
                    TokenLockStateUpdated {
                        token_id, lock_id, lock_state: LockState::Active, timestamp: starknet::get_block_timestamp(),
                    },
                );
        }

        // Note: this function can be called by anyone and is also
        // used internally in ERC721HooksImpl::before_update
        fn token_unlock(ref self: ContractState, token_id: u256) {
            // return early if token is not locked
            let (lock_id, _) = self.token_lock.entry(token_id).read();
            if lock_id == 0 {
                return;
            }

            let unlock_at = self.lock_state.entry(lock_id).read();
            let now = starknet::get_block_timestamp();
            if now >= unlock_at {
                // unlock token
                self.token_lock.entry(token_id).write((0, 0));
                self
                    .emit(
                        TokenLockStateUpdated {
                            token_id,
                            lock_id,
                            lock_state: LockState::Inactive,
                            timestamp: starknet::get_block_timestamp(),
                        },
                    );
            }
        }

        fn token_lock_state(self: @ContractState, token_id: u256) -> (felt252, felt252) {
            self.token_lock.entry(token_id).read()
        }

        fn token_is_locked(self: @ContractState, token_id: u256) -> bool {
            let (lock_id, _) = self.token_lock.entry(token_id).read();

            lock_id != 0
        }
    }


    #[abi(embed_v0)]
    impl RealmsCollectibleLockAdminImpl of IRealmsCollectibleLockAdmin<ContractState> {
        fn lock_state_update(ref self: ContractState, lock_id: felt252, unlock_at: u64) {
            self.accesscontrol.assert_only_role(LOCKER_ROLE);

            assert!(unlock_at > starknet::get_block_timestamp(), "RealmsCollectible: Unlock at must be in the future");

            assert!(lock_id != 0, "RealmsCollectible: Lock id is zero");
            self.lock_state.entry(lock_id).write(unlock_at);

            self.emit(LockStateUpdated { lock_id, unlock_at, timestamp: starknet::get_block_timestamp() });
        }
    }
}
