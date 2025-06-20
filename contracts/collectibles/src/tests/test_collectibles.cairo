#[cfg(test)]
mod tests {
    use collectibles::contract::{
        ERC721EnumerableTransferAmountTrait, ERC721EnumerableTransferAmountTraitDispatcher,
        ERC721EnumerableTransferAmountTraitDispatcherTrait, ERC721MintBurnTrait, ERC721MintBurnTraitDispatcher,
        ERC721MintBurnTraitDispatcherTrait, IRealmsCollectibleLock, IRealmsCollectibleLockAdmin,
        IRealmsCollectibleLockAdminDispatcher, IRealmsCollectibleLockAdminDispatcherTrait,
        IRealmsCollectibleLockDispatcher, IRealmsCollectibleLockDispatcherTrait, IRealmsCollectibleMetadata,
        IRealmsCollectibleMetadataDispatcher, IRealmsCollectibleMetadataDispatcherTrait, LOCKER_ROLE,
        METADATA_UPDATER_ROLE, MINTER_ROLE, RealmsCollectible as collectibles_contract, UPGRADER_ROLE,
    };
    use collectibles::tests::mocks::account::AccountUpgradeable;
    use openzeppelin::access::accesscontrol::DEFAULT_ADMIN_ROLE;

    use openzeppelin::access::accesscontrol::interface::{IAccessControlDispatcher, IAccessControlDispatcherTrait};
    use openzeppelin::token::common::erc2981::interface::{IERC2981Dispatcher, IERC2981DispatcherTrait};
    use openzeppelin::token::erc721::extensions::erc721_enumerable::interface::{
        IERC721EnumerableDispatcher, IERC721EnumerableDispatcherTrait,
    };
    use openzeppelin::token::erc721::interface::{IERC721Dispatcher, IERC721DispatcherTrait};
    use openzeppelin::token::erc721::interface::{IERC721MetadataDispatcher, IERC721MetadataDispatcherTrait};
    use openzeppelin::upgrades::interface::{IUpgradeableDispatcher, IUpgradeableDispatcherTrait};

    use snforge_std::{
        ContractClass, ContractClassTrait, DeclareResultTrait, declare, spy_events, start_cheat_block_timestamp,
        start_cheat_caller_address, start_cheat_transaction_hash, stop_cheat_block_timestamp, stop_cheat_caller_address,
        stop_cheat_transaction_hash,
    };

    use starknet::{ClassHash, ContractAddress};

    // Test addresses
    fn ADMIN() -> ContractAddress {
        starknet::contract_address_const::<'ADMIN'>()
    }

    fn ALICE() -> ContractAddress {
        PERSON("ALICE")
    }

    fn BOB() -> ContractAddress {
        PERSON("BOB")
    }

    fn CHARLIE() -> ContractAddress {
        PERSON("CHARLIE")
    }

    fn MINTER() -> ContractAddress {
        starknet::contract_address_const::<'MINTER'>()
    }

    fn UPGRADER() -> ContractAddress {
        starknet::contract_address_const::<'UPGRADER'>()
    }

    fn LOCKER() -> ContractAddress {
        starknet::contract_address_const::<'LOCKER'>()
    }

    fn METADATA_UPDATER() -> ContractAddress {
        starknet::contract_address_const::<'METADATA_UPDATER'>()
    }

    fn ROYALTY_RECEIVER() -> ContractAddress {
        starknet::contract_address_const::<'ROYALTY_RECEIVER'>()
    }

    // Test constants
    const TOKEN_ID_1: u256 = 1;
    const TOKEN_ID_2: u256 = 2;
    const TOKEN_ID_3: u256 = 3;
    const LOCK_ID_1: felt252 = 'lock_1';
    const LOCK_ID_2: felt252 = 'lock_2';
    const UNLOCK_TIMESTAMP: u64 = 1000000;
    const EXPIRED_TIMESTAMP: u64 = 100;

    fn COLLECTIBLES_CONTRACT() -> ContractAddress {
        let collectibles_class = declare("RealmsCollectible").unwrap().contract_class();

        let mut constructor_calldata = array![];
        let name: ByteArray = "Realms Collectibles";
        let symbol: ByteArray = "RC";
        let base_uri: ByteArray = "https://base.uri/";
        name.serialize(ref constructor_calldata);
        symbol.serialize(ref constructor_calldata);
        base_uri.serialize(ref constructor_calldata);
        ADMIN().serialize(ref constructor_calldata); // default_admin
        MINTER().serialize(ref constructor_calldata); // minter
        UPGRADER().serialize(ref constructor_calldata); // upgrader
        LOCKER().serialize(ref constructor_calldata); // locker
        METADATA_UPDATER().serialize(ref constructor_calldata); // metadata_updater
        ROYALTY_RECEIVER().serialize(ref constructor_calldata); // default_royalty_receiver
        250_u128.serialize(ref constructor_calldata); // fee_numerator (2.5%)

        let (addr, _) = collectibles_class.deploy(@constructor_calldata).unwrap();
        addr
    }

    fn PERSON(name: ByteArray) -> ContractAddress {
        let account_class = declare("AccountUpgradeable").unwrap().contract_class();

        let mut constructor_calldata = array![0x123];
        let (addr, _) = account_class.deploy(@constructor_calldata).unwrap();
        addr
    }

    // =====================================
    // BASIC ERC721 FUNCTIONALITY TESTS
    // =====================================

    #[test]
    fn test_contract_initialization() {
        let contract = COLLECTIBLES_CONTRACT();
        let admin = ADMIN();
        let minter = MINTER();
        let upgrader = UPGRADER();
        let locker = LOCKER();
        let metadata_updater = METADATA_UPDATER();

        let erc721 = IERC721MetadataDispatcher { contract_address: contract };
        let access_control = IAccessControlDispatcher { contract_address: contract };

        // Check basic ERC721 properties
        assert!(erc721.name() == "Realms Collectibles", "Wrong name");
        assert!(erc721.symbol() == "RC", "Wrong symbol");

        // Check role assignments
        assert!(access_control.has_role(DEFAULT_ADMIN_ROLE, admin), "Admin role not assigned");
        assert!(access_control.has_role(MINTER_ROLE, minter), "Minter role not assigned");
        assert!(access_control.has_role(UPGRADER_ROLE, upgrader), "Upgrader role not assigned");
        assert!(access_control.has_role(LOCKER_ROLE, locker), "Locker role not assigned");
        assert!(access_control.has_role(METADATA_UPDATER_ROLE, metadata_updater), "Metadata updater role not assigned");
    }

    #[test]
    fn test_mint_success() {
        let contract = COLLECTIBLES_CONTRACT();
        let alice = ALICE();
        let minter = MINTER();

        let erc721 = IERC721Dispatcher { contract_address: contract };
        let mint_burn = ERC721MintBurnTraitDispatcher { contract_address: contract };

        // Mint token with empty attributes
        start_cheat_caller_address(contract, minter);
        mint_burn.safe_mint(alice, TOKEN_ID_1, 0_u128);
        stop_cheat_caller_address(contract);

        // Verify ownership
        assert!(erc721.owner_of(TOKEN_ID_1) == alice, "Wrong owner");
        assert!(erc721.balance_of(alice) == 1, "Wrong balance");
    }

    #[test]
    #[should_panic(expected: 'Caller is missing role')]
    fn test_mint_unauthorized() {
        let contract = COLLECTIBLES_CONTRACT();
        let alice = ALICE();

        let mint_burn = ERC721MintBurnTraitDispatcher { contract_address: contract };

        // Try to mint without MINTER_ROLE
        start_cheat_caller_address(contract, alice);
        mint_burn.safe_mint(alice, TOKEN_ID_1, 0_u128);
    }

    #[test]
    fn test_burn_success() {
        let contract = COLLECTIBLES_CONTRACT();
        let alice = ALICE();
        let minter = MINTER();

        let erc721 = IERC721Dispatcher { contract_address: contract };
        let mint_burn = ERC721MintBurnTraitDispatcher { contract_address: contract };

        // First mint a token
        start_cheat_caller_address(contract, minter);
        mint_burn.safe_mint(alice, TOKEN_ID_1, 0_u128);
        stop_cheat_caller_address(contract);

        // Verify token exists
        assert!(erc721.owner_of(TOKEN_ID_1) == alice, "Token not minted");

        // Burn token
        start_cheat_caller_address(contract, alice);
        mint_burn.burn(TOKEN_ID_1);
        stop_cheat_caller_address(contract);

        // Verify token is burned
        assert!(erc721.balance_of(alice) == 0, "Token not burned");
    }

    #[test]
    #[should_panic(expected: 'ERC721: unauthorized caller')]
    fn test_burn_unauthorized() {
        let contract = COLLECTIBLES_CONTRACT();
        let alice = ALICE();
        let bob = BOB();
        let minter = MINTER();

        let mint_burn = ERC721MintBurnTraitDispatcher { contract_address: contract };

        // First mint a token
        start_cheat_caller_address(contract, minter);
        mint_burn.safe_mint(alice, TOKEN_ID_1, 0_u128);
        stop_cheat_caller_address(contract);

        // Try to burn when not owner
        start_cheat_caller_address(contract, bob);
        mint_burn.burn(TOKEN_ID_1);
    }

    #[test]
    fn test_transfer_success() {
        let contract = COLLECTIBLES_CONTRACT();
        let alice = ALICE();
        let bob = BOB();
        let minter = MINTER();

        let erc721 = IERC721Dispatcher { contract_address: contract };
        let mint_burn = ERC721MintBurnTraitDispatcher { contract_address: contract };

        // Mint token to Alice
        start_cheat_caller_address(contract, minter);
        mint_burn.safe_mint(alice, TOKEN_ID_1, 0_u128);
        stop_cheat_caller_address(contract);

        // Transfer from Alice to Bob
        start_cheat_caller_address(contract, alice);
        erc721.transfer_from(alice, bob, TOKEN_ID_1);
        stop_cheat_caller_address(contract);

        // Verify transfer
        assert!(erc721.owner_of(TOKEN_ID_1) == bob, "Transfer failed");
        assert!(erc721.balance_of(alice) == 0, "Alice balance not updated");
        assert!(erc721.balance_of(bob) == 1, "Bob balance not updated");
    }

    // =====================================
    // METADATA FUNCTIONALITY TESTS
    // =====================================

    #[test]
    fn test_set_default_ipfs_cid() {
        let contract = COLLECTIBLES_CONTRACT();
        let metadata_updater = METADATA_UPDATER();

        let metadata = IRealmsCollectibleMetadataDispatcher { contract_address: contract };

        let ipfs_cid = "QmDefaultCID123";

        start_cheat_caller_address(contract, metadata_updater);
        metadata.set_default_ipfs_cid(ipfs_cid);
        stop_cheat_caller_address(contract);
        // Test by checking if a token without specific metadata uses default
    // This would be tested when getting metadata for a token
    }

    #[test]
    #[should_panic(expected: 'Caller is missing role')]
    fn test_set_default_ipfs_cid_unauthorized() {
        let contract = COLLECTIBLES_CONTRACT();
        let alice = ALICE();

        let metadata = IRealmsCollectibleMetadataDispatcher { contract_address: contract };

        start_cheat_caller_address(contract, alice);
        metadata.set_default_ipfs_cid("QmDefaultCID123");
    }

    #[test]
    fn test_set_attrs_raw_to_ipfs_cid() {
        let contract = COLLECTIBLES_CONTRACT();
        let metadata_updater = METADATA_UPDATER();

        let metadata = IRealmsCollectibleMetadataDispatcher { contract_address: contract };

        let attrs_raw: u128 = 0x12345678;
        let ipfs_cid = "QmSpecificCID456";

        start_cheat_caller_address(contract, metadata_updater);
        metadata.set_attrs_raw_to_ipfs_cid(attrs_raw, ipfs_cid);
        stop_cheat_caller_address(contract);
    }

    #[test]
    fn test_set_trait_type_name() {
        let contract = COLLECTIBLES_CONTRACT();
        let metadata_updater = METADATA_UPDATER();

        let metadata = IRealmsCollectibleMetadataDispatcher { contract_address: contract };

        let trait_type_id: u8 = 5;
        let trait_name: ByteArray = "Rarity";

        start_cheat_caller_address(contract, metadata_updater);
        metadata.set_trait_type_name(trait_type_id, trait_name, false);
        stop_cheat_caller_address(contract);

        // Verify the trait type name was set
        let retrieved_name = metadata.get_trait_type_name(trait_type_id);
        assert!(retrieved_name == "Rarity", "Trait type name not set correctly");
    }

    #[test]
    #[should_panic(expected: "RealmsCollectible: Trait type id must be a value between 0 and 15")]
    fn test_set_trait_type_name_invalid_id() {
        let contract = COLLECTIBLES_CONTRACT();
        let metadata_updater = METADATA_UPDATER();

        let metadata = IRealmsCollectibleMetadataDispatcher { contract_address: contract };

        start_cheat_caller_address(contract, metadata_updater);
        metadata.set_trait_type_name(16, "Invalid", false); // ID > 15
    }

    #[test]
    #[should_panic(expected: "RealmsCollectible: Trait type name already exists")]
    fn test_set_trait_type_name_already_exists() {
        let contract = COLLECTIBLES_CONTRACT();
        let metadata_updater = METADATA_UPDATER();

        let metadata = IRealmsCollectibleMetadataDispatcher { contract_address: contract };

        let trait_type_id: u8 = 5;

        start_cheat_caller_address(contract, metadata_updater);
        metadata.set_trait_type_name(trait_type_id, "First Name", false);
        // Try to set again without overwrite
        metadata.set_trait_type_name(trait_type_id, "Second Name", false);
    }

    #[test]
    fn test_set_trait_type_name_with_overwrite() {
        let contract = COLLECTIBLES_CONTRACT();
        let metadata_updater = METADATA_UPDATER();

        let metadata = IRealmsCollectibleMetadataDispatcher { contract_address: contract };

        let trait_type_id: u8 = 5;

        start_cheat_caller_address(contract, metadata_updater);
        metadata.set_trait_type_name(trait_type_id, "First Name", false);
        // Overwrite with new name
        metadata.set_trait_type_name(trait_type_id, "Second Name", true);
        stop_cheat_caller_address(contract);

        let retrieved_name = metadata.get_trait_type_name(trait_type_id);
        assert!(retrieved_name == "Second Name", "Trait type name not overwritten");
    }

    #[test]
    fn test_set_trait_value_name() {
        let contract = COLLECTIBLES_CONTRACT();
        let metadata_updater = METADATA_UPDATER();

        let metadata = IRealmsCollectibleMetadataDispatcher { contract_address: contract };

        let trait_type_id: u8 = 3;
        let trait_value_id: u8 = 10;
        let trait_value_name: ByteArray = "Legendary";

        start_cheat_caller_address(contract, metadata_updater);
        metadata.set_trait_value_name(trait_type_id, trait_value_id, trait_value_name, false);
        stop_cheat_caller_address(contract);

        let retrieved_name = metadata.get_trait_value_name(trait_type_id, trait_value_id);
        assert!(retrieved_name == "Legendary", "Trait value name not set correctly");
    }

    #[test]
    #[should_panic(expected: "RealmsCollectible: Trait value id must be a value between 1 and 255")]
    fn test_set_trait_value_name_invalid_id() {
        let contract = COLLECTIBLES_CONTRACT();
        let metadata_updater = METADATA_UPDATER();

        let metadata = IRealmsCollectibleMetadataDispatcher { contract_address: contract };

        start_cheat_caller_address(contract, metadata_updater);
        metadata.set_trait_value_name(5, 0, "Invalid", false); // value_id = 0
    }

    #[test]
    fn test_get_metadata_raw() {
        let contract = COLLECTIBLES_CONTRACT();
        let metadata = IRealmsCollectibleMetadataDispatcher { contract_address: contract };

        // Test with non-existent token - should return 0
        let raw_metadata = metadata.get_metadata_raw(TOKEN_ID_1);
        assert!(raw_metadata == 0, "Should return 0 for non-existent metadata");
    }

    // =====================================
    // LOCKING FUNCTIONALITY TESTS
    // =====================================

    #[test]
    fn test_lock_state_update() {
        let contract = COLLECTIBLES_CONTRACT();
        let locker = LOCKER();

        let lock_admin = IRealmsCollectibleLockAdminDispatcher { contract_address: contract };

        start_cheat_caller_address(contract, locker);
        lock_admin.lock_state_update(LOCK_ID_1, UNLOCK_TIMESTAMP);
        stop_cheat_caller_address(contract);
    }

    #[test]
    #[should_panic(expected: "RealmsCollectible: Lock id is zero")]
    fn test_lock_state_update_zero_lock_id() {
        let contract = COLLECTIBLES_CONTRACT();
        let locker = LOCKER();

        let lock_admin = IRealmsCollectibleLockAdminDispatcher { contract_address: contract };

        start_cheat_caller_address(contract, locker);
        lock_admin.lock_state_update(0, UNLOCK_TIMESTAMP);
    }

    #[test]
    #[should_panic(expected: 'Caller is missing role')]
    fn test_lock_state_update_unauthorized() {
        let contract = COLLECTIBLES_CONTRACT();
        let alice = ALICE();

        let lock_admin = IRealmsCollectibleLockAdminDispatcher { contract_address: contract };

        start_cheat_caller_address(contract, alice);
        lock_admin.lock_state_update(LOCK_ID_1, UNLOCK_TIMESTAMP);
    }

    #[test]
    fn test_token_lock() {
        let contract = COLLECTIBLES_CONTRACT();
        let alice = ALICE();
        let minter = MINTER();
        let locker = LOCKER();

        let erc721 = IERC721Dispatcher { contract_address: contract };
        let mint_burn = ERC721MintBurnTraitDispatcher { contract_address: contract };
        let lock_admin = IRealmsCollectibleLockAdminDispatcher { contract_address: contract };
        let lock = IRealmsCollectibleLockDispatcher { contract_address: contract };

        // Setup: mint token and create lock
        start_cheat_caller_address(contract, minter);
        mint_burn.safe_mint(alice, TOKEN_ID_1, 0_u128);
        stop_cheat_caller_address(contract);

        // Create lock state with future unlock time
        start_cheat_block_timestamp(contract, 500); // Current time = 500
        start_cheat_caller_address(contract, locker);
        lock_admin.lock_state_update(LOCK_ID_1, 1000); // Unlock at 1000
        stop_cheat_caller_address(contract);

        // Lock the token as the owner (ALICE)
        start_cheat_caller_address(contract, alice);
        start_cheat_transaction_hash(contract, 123);
        lock.token_lock(TOKEN_ID_1, LOCK_ID_1);
        stop_cheat_caller_address(contract);
        stop_cheat_block_timestamp(contract);
        stop_cheat_transaction_hash(contract);

        // Verify token is locked
        assert!(lock.token_is_locked(TOKEN_ID_1), "Token should be locked");

        let (returned_lock_id, lock_tx_hash) = lock.token_lock_state(TOKEN_ID_1);
        assert!(returned_lock_id == LOCK_ID_1, "Wrong lock ID");
        assert!(lock_tx_hash != 0, "Lock tx hash should not be zero");
    }

    #[test]
    #[should_panic(expected: "RealmsCollectible: Caller is not owner")]
    fn test_token_lock_unauthorized() {
        let contract = COLLECTIBLES_CONTRACT();
        let alice = ALICE();
        let bob = BOB();
        let minter = MINTER();
        let locker = LOCKER();

        let mint_burn = ERC721MintBurnTraitDispatcher { contract_address: contract };
        let lock_admin = IRealmsCollectibleLockAdminDispatcher { contract_address: contract };
        let lock = IRealmsCollectibleLockDispatcher { contract_address: contract };

        // Setup: mint token to Alice
        start_cheat_caller_address(contract, minter);
        mint_burn.safe_mint(alice, TOKEN_ID_1, 0_u128);
        stop_cheat_caller_address(contract);

        // Create lock state
        start_cheat_caller_address(contract, locker);
        lock_admin.lock_state_update(LOCK_ID_1, 1000);
        stop_cheat_caller_address(contract);

        // Try to lock as Bob (not owner)
        start_cheat_caller_address(contract, bob);
        lock.token_lock(TOKEN_ID_1, LOCK_ID_1);
    }

    #[test]
    #[should_panic(expected: "RealmsCollectible: Caller is not owner")]
    fn test_token_lock_with_approval_fails() {
        let contract = COLLECTIBLES_CONTRACT();
        let alice = ALICE();
        let bob = BOB();
        let minter = MINTER();
        let locker = LOCKER();

        let erc721 = IERC721Dispatcher { contract_address: contract };
        let mint_burn = ERC721MintBurnTraitDispatcher { contract_address: contract };
        let lock_admin = IRealmsCollectibleLockAdminDispatcher { contract_address: contract };
        let lock = IRealmsCollectibleLockDispatcher { contract_address: contract };

        // Setup: mint token to Alice
        start_cheat_caller_address(contract, minter);
        mint_burn.safe_mint(alice, TOKEN_ID_1, 0_u128);
        stop_cheat_caller_address(contract);

        // Alice approves Bob for this token
        start_cheat_caller_address(contract, alice);
        erc721.approve(bob, TOKEN_ID_1);
        stop_cheat_caller_address(contract);

        // Create lock state
        start_cheat_caller_address(contract, locker);
        lock_admin.lock_state_update(LOCK_ID_1, 1000);
        stop_cheat_caller_address(contract);

        // Bob cannot lock the token even though he's approved (owner-only policy)
        start_cheat_caller_address(contract, bob);
        lock.token_lock(TOKEN_ID_1, LOCK_ID_1);
    }

    #[test]
    #[should_panic(expected: "RealmsCollectible: Caller is not owner")]
    fn test_token_lock_with_operator_approval_fails() {
        let contract = COLLECTIBLES_CONTRACT();
        let alice = ALICE();
        let bob = BOB();
        let minter = MINTER();
        let locker = LOCKER();

        let erc721 = IERC721Dispatcher { contract_address: contract };
        let mint_burn = ERC721MintBurnTraitDispatcher { contract_address: contract };
        let lock_admin = IRealmsCollectibleLockAdminDispatcher { contract_address: contract };
        let lock = IRealmsCollectibleLockDispatcher { contract_address: contract };

        // Setup: mint token to Alice
        start_cheat_caller_address(contract, minter);
        mint_burn.safe_mint(alice, TOKEN_ID_1, 0_u128);
        stop_cheat_caller_address(contract);

        // Alice approves Bob as operator for all tokens
        start_cheat_caller_address(contract, alice);
        erc721.set_approval_for_all(bob, true);
        stop_cheat_caller_address(contract);

        // Create lock state
        start_cheat_caller_address(contract, locker);
        lock_admin.lock_state_update(LOCK_ID_1, 1000);
        stop_cheat_caller_address(contract);

        // Bob cannot lock the token even though he's an approved operator (owner-only policy)
        start_cheat_caller_address(contract, bob);
        lock.token_lock(TOKEN_ID_1, LOCK_ID_1);
    }

    #[test]
    #[should_panic(expected: "RealmsCollectible: Lock is not active")]
    fn test_token_lock_expired() {
        let contract = COLLECTIBLES_CONTRACT();
        let alice = ALICE();
        let minter = MINTER();
        let locker = LOCKER();

        let mint_burn = ERC721MintBurnTraitDispatcher { contract_address: contract };
        let lock_admin = IRealmsCollectibleLockAdminDispatcher { contract_address: contract };
        let lock = IRealmsCollectibleLockDispatcher { contract_address: contract };

        // Setup: mint token
        start_cheat_caller_address(contract, minter);
        mint_burn.safe_mint(alice, TOKEN_ID_1, 0_u128);
        stop_cheat_caller_address(contract);

        // Create expired lock
        start_cheat_caller_address(contract, locker);
        lock_admin.lock_state_update(LOCK_ID_1, EXPIRED_TIMESTAMP); // Unlock at 100
        stop_cheat_caller_address(contract);

        // Try to lock with expired lock
        start_cheat_block_timestamp(contract, 500); // Current time = 500 > 100
        start_cheat_caller_address(contract, alice);
        lock.token_lock(TOKEN_ID_1, LOCK_ID_1);
    }

    #[test]
    fn test_token_unlock() {
        let contract = COLLECTIBLES_CONTRACT();
        let alice = ALICE();
        let minter = MINTER();
        let locker = LOCKER();

        let mint_burn = ERC721MintBurnTraitDispatcher { contract_address: contract };
        let lock_admin = IRealmsCollectibleLockAdminDispatcher { contract_address: contract };
        let lock = IRealmsCollectibleLockDispatcher { contract_address: contract };

        // Setup: mint and lock token
        start_cheat_caller_address(contract, minter);
        mint_burn.safe_mint(alice, TOKEN_ID_1, 0_u128);
        stop_cheat_caller_address(contract);

        // Create lock and lock token
        start_cheat_block_timestamp(contract, 500);
        start_cheat_caller_address(contract, locker);
        lock_admin.lock_state_update(LOCK_ID_1, 1000);
        stop_cheat_caller_address(contract);

        start_cheat_caller_address(contract, alice);
        lock.token_lock(TOKEN_ID_1, LOCK_ID_1);
        stop_cheat_caller_address(contract);

        // Wait for lock to expire and unlock as owner
        start_cheat_block_timestamp(contract, 1500); // After unlock time
        start_cheat_caller_address(contract, alice);
        lock.token_unlock(TOKEN_ID_1);
        stop_cheat_caller_address(contract);
        stop_cheat_block_timestamp(contract);

        // Verify token is unlocked
        assert!(!lock.token_is_locked(TOKEN_ID_1), "Token should be unlocked");

        let (lock_id, lock_tx_hash) = lock.token_lock_state(TOKEN_ID_1);
        assert!(lock_id == 0, "Lock ID should be reset");
        assert!(lock_tx_hash == 0, "Lock tx hash should be reset");
    }

    #[test]
    #[should_panic(expected: "RealmsCollectible: Caller is not owner")]
    fn test_token_unlock_unauthorized() {
        let contract = COLLECTIBLES_CONTRACT();
        let alice = ALICE();
        let bob = BOB();
        let minter = MINTER();
        let locker = LOCKER();

        let mint_burn = ERC721MintBurnTraitDispatcher { contract_address: contract };
        let lock_admin = IRealmsCollectibleLockAdminDispatcher { contract_address: contract };
        let lock = IRealmsCollectibleLockDispatcher { contract_address: contract };

        // Setup: mint and lock token
        start_cheat_caller_address(contract, minter);
        mint_burn.safe_mint(alice, TOKEN_ID_1, 0_u128);
        stop_cheat_caller_address(contract);

        // Create lock and lock token as Alice
        start_cheat_block_timestamp(contract, 500);
        start_cheat_caller_address(contract, locker);
        lock_admin.lock_state_update(LOCK_ID_1, 1000);
        stop_cheat_caller_address(contract);

        start_cheat_caller_address(contract, alice);
        lock.token_lock(TOKEN_ID_1, LOCK_ID_1);
        stop_cheat_caller_address(contract);

        // Wait for lock to expire
        start_cheat_block_timestamp(contract, 1500);

        // Try to unlock as Bob (not owner)
        start_cheat_caller_address(contract, bob);
        lock.token_unlock(TOKEN_ID_1);
    }

    #[test]
    #[should_panic(expected: "RealmsCollectible: Caller is not owner")]
    fn test_token_unlock_with_approval_fails() {
        let contract = COLLECTIBLES_CONTRACT();
        let alice = ALICE();
        let bob = BOB();
        let minter = MINTER();
        let locker = LOCKER();

        let erc721 = IERC721Dispatcher { contract_address: contract };
        let mint_burn = ERC721MintBurnTraitDispatcher { contract_address: contract };
        let lock_admin = IRealmsCollectibleLockAdminDispatcher { contract_address: contract };
        let lock = IRealmsCollectibleLockDispatcher { contract_address: contract };

        // Setup: mint token to Alice
        start_cheat_caller_address(contract, minter);
        mint_burn.safe_mint(alice, TOKEN_ID_1, 0_u128);
        stop_cheat_caller_address(contract);

        // Alice approves Bob for this token
        start_cheat_caller_address(contract, alice);
        erc721.approve(bob, TOKEN_ID_1);
        stop_cheat_caller_address(contract);

        // Create lock and lock token as Alice
        start_cheat_block_timestamp(contract, 500);
        start_cheat_caller_address(contract, locker);
        lock_admin.lock_state_update(LOCK_ID_1, 1000);
        stop_cheat_caller_address(contract);

        start_cheat_caller_address(contract, alice);
        lock.token_lock(TOKEN_ID_1, LOCK_ID_1);
        stop_cheat_caller_address(contract);

        // Wait for lock to expire - Bob cannot unlock even though approved (owner-only policy)
        start_cheat_block_timestamp(contract, 1500);
        start_cheat_caller_address(contract, bob);
        lock.token_unlock(TOKEN_ID_1);
    }

    #[test]
    #[should_panic(expected: "RealmsCollectible: Token is not locked")]
    fn test_token_unlock_not_locked() {
        let contract = COLLECTIBLES_CONTRACT();
        let alice = ALICE();
        let minter = MINTER();

        let mint_burn = ERC721MintBurnTraitDispatcher { contract_address: contract };
        let lock = IRealmsCollectibleLockDispatcher { contract_address: contract };

        // Setup: mint token (but don't lock it)
        start_cheat_caller_address(contract, minter);
        mint_burn.safe_mint(alice, TOKEN_ID_1, 0_u128);
        stop_cheat_caller_address(contract);

        // Try to unlock non-locked token as owner
        start_cheat_caller_address(contract, alice);
        lock.token_unlock(TOKEN_ID_1);
    }

    #[test]
    #[should_panic(expected: "RealmsCollectible: Lock is not expired")]
    fn test_token_unlock_not_expired() {
        let contract = COLLECTIBLES_CONTRACT();
        let alice = ALICE();
        let minter = MINTER();
        let locker = LOCKER();

        let mint_burn = ERC721MintBurnTraitDispatcher { contract_address: contract };
        let lock_admin = IRealmsCollectibleLockAdminDispatcher { contract_address: contract };
        let lock = IRealmsCollectibleLockDispatcher { contract_address: contract };

        // Setup: mint and lock token
        start_cheat_caller_address(contract, minter);
        mint_burn.safe_mint(alice, TOKEN_ID_1, 0_u128);
        stop_cheat_caller_address(contract);

        start_cheat_block_timestamp(contract, 500);
        start_cheat_caller_address(contract, locker);
        lock_admin.lock_state_update(LOCK_ID_1, 1000);
        stop_cheat_caller_address(contract);

        start_cheat_caller_address(contract, alice);
        lock.token_lock(TOKEN_ID_1, LOCK_ID_1);
        stop_cheat_caller_address(contract);

        // Try to unlock before expiration as owner
        start_cheat_block_timestamp(contract, 800); // Before unlock time of 1000
        start_cheat_caller_address(contract, alice);
        lock.token_unlock(TOKEN_ID_1);
    }

    #[test]
    #[should_panic(expected: "RealmsCollectible: Token is locked")]
    fn test_transfer_locked_token() {
        let contract = COLLECTIBLES_CONTRACT();
        let alice = ALICE();
        let bob = BOB();
        let minter = MINTER();
        let locker = LOCKER();

        let erc721 = IERC721Dispatcher { contract_address: contract };
        let mint_burn = ERC721MintBurnTraitDispatcher { contract_address: contract };
        let lock_admin = IRealmsCollectibleLockAdminDispatcher { contract_address: contract };
        let lock = IRealmsCollectibleLockDispatcher { contract_address: contract };

        // Setup: mint token to Alice
        start_cheat_caller_address(contract, minter);
        mint_burn.safe_mint(alice, TOKEN_ID_1, 0_u128);
        stop_cheat_caller_address(contract);

        // Lock the token
        start_cheat_block_timestamp(contract, 500);
        start_cheat_caller_address(contract, locker);
        lock_admin.lock_state_update(LOCK_ID_1, 1000);
        stop_cheat_caller_address(contract);

        start_cheat_caller_address(contract, alice);
        lock.token_lock(TOKEN_ID_1, LOCK_ID_1);
        stop_cheat_caller_address(contract);

        // Try to transfer locked token
        start_cheat_caller_address(contract, alice);
        erc721.transfer_from(alice, bob, TOKEN_ID_1);
    }

    // =====================================
    // ENUMERABLE FUNCTIONALITY TESTS
    // =====================================

    #[test]
    fn test_transfer_amount() {
        let contract = COLLECTIBLES_CONTRACT();
        let alice = ALICE();
        let bob = BOB();
        let minter = MINTER();

        let erc721 = IERC721Dispatcher { contract_address: contract };
        let mint_burn = ERC721MintBurnTraitDispatcher { contract_address: contract };
        let enumerable = ERC721EnumerableTransferAmountTraitDispatcher { contract_address: contract };

        // Mint 3 tokens to Alice
        start_cheat_caller_address(contract, minter);
        mint_burn.safe_mint(alice, TOKEN_ID_1, 0_u128);
        mint_burn.safe_mint(alice, TOKEN_ID_2, 0_u128);
        mint_burn.safe_mint(alice, TOKEN_ID_3, 0_u128);
        stop_cheat_caller_address(contract);

        // Verify Alice has 3 tokens
        assert!(erc721.balance_of(alice) == 3, "Alice should have 3 tokens");

        // Transfer 2 tokens from Alice to Bob
        start_cheat_caller_address(contract, alice);
        let transferred_tokens = enumerable.transfer_amount(alice, bob, 2);
        stop_cheat_caller_address(contract);

        // Verify balances
        assert!(erc721.balance_of(alice) == 1, "Alice should have 1 token left");
        assert!(erc721.balance_of(bob) == 2, "Bob should have 2 tokens");
        assert!(transferred_tokens.len() == 2, "Should have transferred 2 tokens");

        // Verify Bob owns the transferred tokens
        let token_1 = *transferred_tokens.at(0);
        let token_2 = *transferred_tokens.at(1);
        assert!(erc721.owner_of(token_1) == bob, "Bob should own first transferred token");
        assert!(erc721.owner_of(token_2) == bob, "Bob should own second transferred token");
    }

    // =====================================
    // ROYALTY FUNCTIONALITY TESTS
    // =====================================

    #[test]
    fn test_royalty_info() {
        let contract = COLLECTIBLES_CONTRACT();
        let royalty_receiver = ROYALTY_RECEIVER();

        let royalty = IERC2981Dispatcher { contract_address: contract };

        let sale_price: u256 = 10000; // 100.00 in basis points
        let (receiver, royalty_amount) = royalty.royalty_info(TOKEN_ID_1, sale_price);

        assert!(receiver == royalty_receiver, "Wrong royalty receiver");
        // 250/10000 * 10000 = 250 (2.5%)
        assert!(royalty_amount == 250, "Wrong royalty amount");
    }

    // =====================================
    // UPGRADE FUNCTIONALITY TESTS
    // =====================================

    #[test]
    fn test_upgrade_contract() {
        let contract = COLLECTIBLES_CONTRACT();
        let upgrader = UPGRADER();

        let upgradeable = IUpgradeableDispatcher { contract_address: contract };

        // Declare a new version (for testing, we'll use the same contract)
        let new_class = declare("RealmsCollectible").unwrap().contract_class();

        start_cheat_caller_address(contract, upgrader);
        upgradeable.upgrade(*new_class.class_hash);
        stop_cheat_caller_address(contract);
    }

    #[test]
    #[should_panic(expected: 'Caller is missing role')]
    fn test_upgrade_unauthorized() {
        let contract = COLLECTIBLES_CONTRACT();
        let alice = ALICE();

        let upgradeable = IUpgradeableDispatcher { contract_address: contract };

        let new_class = declare("RealmsCollectible").unwrap().contract_class();

        start_cheat_caller_address(contract, alice);
        upgradeable.upgrade(*new_class.class_hash);
    }

    // =====================================
    // COMPLEX INTEGRATION TESTS
    // =====================================

    #[test]
    fn test_complete_metadata_workflow() {
        let contract = COLLECTIBLES_CONTRACT();
        let alice = ALICE();
        let minter = MINTER();
        let metadata_updater = METADATA_UPDATER();

        let metadata = IRealmsCollectibleMetadataDispatcher { contract_address: contract };
        let mint_burn = ERC721MintBurnTraitDispatcher { contract_address: contract };
        let erc721_metadata = IERC721MetadataDispatcher { contract_address: contract };

        // Setup metadata
        start_cheat_caller_address(contract, metadata_updater);

        // Set default IPFS CID
        metadata.set_default_ipfs_cid("QmDefaultCID123");

        // Set trait types
        metadata.set_trait_type_name(0, "Rarity", false);
        metadata.set_trait_type_name(1, "Element", false);

        // Set trait values
        metadata.set_trait_value_name(0, 1, "Common", false);
        metadata.set_trait_value_name(0, 2, "Rare", false);
        metadata.set_trait_value_name(1, 1, "Fire", false);
        metadata.set_trait_value_name(1, 2, "Water", false);

        stop_cheat_caller_address(contract);

        // Mint a token
        start_cheat_caller_address(contract, minter);
        mint_burn.safe_mint(alice, TOKEN_ID_1, 0_u128);
        stop_cheat_caller_address(contract);

        // Get token URI (should work even with empty metadata)
        let token_uri = erc721_metadata.token_uri(TOKEN_ID_1);
        assert!(token_uri.len() > 0, "Token URI should not be empty");
    }

    #[test]
    fn test_multiple_locks_workflow() {
        let contract = COLLECTIBLES_CONTRACT();
        let alice = ALICE();
        let bob = BOB();
        let minter = MINTER();
        let locker = LOCKER();

        let mint_burn = ERC721MintBurnTraitDispatcher { contract_address: contract };
        let lock_admin = IRealmsCollectibleLockAdminDispatcher { contract_address: contract };
        let lock = IRealmsCollectibleLockDispatcher { contract_address: contract };

        // Mint tokens to different owners
        start_cheat_caller_address(contract, minter);
        mint_burn.safe_mint(alice, TOKEN_ID_1, 0_u128);
        mint_burn.safe_mint(bob, TOKEN_ID_2, 0_u128);
        stop_cheat_caller_address(contract);

        // Create multiple lock states
        start_cheat_caller_address(contract, locker);
        lock_admin.lock_state_update(LOCK_ID_1, 1000);
        lock_admin.lock_state_update(LOCK_ID_2, 2000);
        stop_cheat_caller_address(contract);

        // Lock tokens with different locks (owners locking their own tokens)
        start_cheat_block_timestamp(contract, 500);

        start_cheat_caller_address(contract, alice);
        lock.token_lock(TOKEN_ID_1, LOCK_ID_1);
        stop_cheat_caller_address(contract);

        start_cheat_caller_address(contract, bob);
        lock.token_lock(TOKEN_ID_2, LOCK_ID_2);
        stop_cheat_caller_address(contract);

        // Verify both tokens are locked
        assert!(lock.token_is_locked(TOKEN_ID_1), "Token 1 should be locked");
        assert!(lock.token_is_locked(TOKEN_ID_2), "Token 2 should be locked");

        // Unlock first token when its lock expires (Alice unlocks her token)
        start_cheat_block_timestamp(contract, 1500);
        start_cheat_caller_address(contract, alice);
        lock.token_unlock(TOKEN_ID_1);
        stop_cheat_caller_address(contract);

        // First token should be unlocked, second still locked
        assert!(!lock.token_is_locked(TOKEN_ID_1), "Token 1 should be unlocked");
        assert!(lock.token_is_locked(TOKEN_ID_2), "Token 2 should still be locked");

        // Unlock second token (Bob unlocks his token)
        start_cheat_block_timestamp(contract, 2500);
        start_cheat_caller_address(contract, bob);
        lock.token_unlock(TOKEN_ID_2);
        stop_cheat_caller_address(contract);
        assert!(!lock.token_is_locked(TOKEN_ID_2), "Token 2 should be unlocked");

        stop_cheat_block_timestamp(contract);
    }

    #[test]
    fn test_edge_case_empty_metadata() {
        let contract = COLLECTIBLES_CONTRACT();
        let alice = ALICE();
        let minter = MINTER();

        let metadata = IRealmsCollectibleMetadataDispatcher { contract_address: contract };
        let mint_burn = ERC721MintBurnTraitDispatcher { contract_address: contract };

        // Mint token without setting any metadata
        start_cheat_caller_address(contract, minter);
        mint_burn.safe_mint(alice, TOKEN_ID_1, 0_u128);
        stop_cheat_caller_address(contract);

        // Get metadata - should handle gracefully
        let raw_metadata = metadata.get_metadata_raw(TOKEN_ID_1);
        assert!(raw_metadata == 0, "Empty metadata should be 0");

        let json_metadata = metadata.get_metadata_json(TOKEN_ID_1);
        assert!(json_metadata.len() > 0, "JSON metadata should not be empty even without traits");
    }

    #[test]
    fn test_comprehensive_authorization_workflow() {
        let contract = COLLECTIBLES_CONTRACT();
        let alice = ALICE();
        let bob = BOB();
        let charlie = CHARLIE();
        let minter = MINTER();
        let locker = LOCKER();

        let erc721 = IERC721Dispatcher { contract_address: contract };
        let mint_burn = ERC721MintBurnTraitDispatcher { contract_address: contract };
        let lock_admin = IRealmsCollectibleLockAdminDispatcher { contract_address: contract };
        let lock = IRealmsCollectibleLockDispatcher { contract_address: contract };

        // Setup: mint tokens to different owners
        start_cheat_caller_address(contract, minter);
        mint_burn.safe_mint(alice, TOKEN_ID_1, 0_u128);
        mint_burn.safe_mint(bob, TOKEN_ID_2, 0_u128);
        mint_burn.safe_mint(charlie, TOKEN_ID_3, 0_u128);
        stop_cheat_caller_address(contract);

        // Create lock state
        start_cheat_caller_address(contract, locker);
        lock_admin.lock_state_update(LOCK_ID_1, 2000);
        stop_cheat_caller_address(contract);

        // Test: Each owner can lock their own token
        start_cheat_block_timestamp(contract, 500);

        start_cheat_caller_address(contract, alice);
        lock.token_lock(TOKEN_ID_1, LOCK_ID_1);
        stop_cheat_caller_address(contract);
        assert!(lock.token_is_locked(TOKEN_ID_1), "Token 1 should be locked by owner");

        start_cheat_caller_address(contract, bob);
        lock.token_lock(TOKEN_ID_2, LOCK_ID_1);
        stop_cheat_caller_address(contract);
        assert!(lock.token_is_locked(TOKEN_ID_2), "Token 2 should be locked by owner");

        start_cheat_caller_address(contract, charlie);
        lock.token_lock(TOKEN_ID_3, LOCK_ID_1);
        stop_cheat_caller_address(contract);
        assert!(lock.token_is_locked(TOKEN_ID_3), "Token 3 should be locked by owner");

        // Test: Wait for lock to expire and each owner can unlock their own token
        start_cheat_block_timestamp(contract, 2500);

        start_cheat_caller_address(contract, alice);
        lock.token_unlock(TOKEN_ID_1);
        stop_cheat_caller_address(contract);
        assert!(!lock.token_is_locked(TOKEN_ID_1), "Token 1 should be unlocked by owner");

        start_cheat_caller_address(contract, bob);
        lock.token_unlock(TOKEN_ID_2);
        stop_cheat_caller_address(contract);
        assert!(!lock.token_is_locked(TOKEN_ID_2), "Token 2 should be unlocked by owner");

        start_cheat_caller_address(contract, charlie);
        lock.token_unlock(TOKEN_ID_3);
        stop_cheat_caller_address(contract);
        assert!(!lock.token_is_locked(TOKEN_ID_3), "Token 3 should be unlocked by owner");

        stop_cheat_block_timestamp(contract);
    }

    // =====================================
    // COMPREHENSIVE METADATA TESTS
    // =====================================

    #[test]
    fn test_mint_with_attributes() {
        let contract = COLLECTIBLES_CONTRACT();
        let alice = ALICE();
        let minter = MINTER();

        let metadata = IRealmsCollectibleMetadataDispatcher { contract_address: contract };
        let mint_burn = ERC721MintBurnTraitDispatcher { contract_address: contract };

        // Create packed attributes: trait_type_0 = 5, trait_type_1 = 3, rest = 0
        // u128 packs 16 bytes, each trait_type is 1 byte
        let attributes_raw: u128 = 0x00000000000000000000000000000305;

        // Mint token with specific attributes
        start_cheat_caller_address(contract, minter);
        mint_burn.safe_mint(alice, TOKEN_ID_1, attributes_raw);
        stop_cheat_caller_address(contract);

        // Verify attributes were stored correctly
        let stored_attributes = metadata.get_metadata_raw(TOKEN_ID_1);
        assert!(stored_attributes == attributes_raw, "Attributes not stored correctly");
    }

    #[test]
    fn test_complex_attributes_metadata() {
        let contract = COLLECTIBLES_CONTRACT();
        let alice = ALICE();
        let minter = MINTER();
        let metadata_updater = METADATA_UPDATER();

        let metadata = IRealmsCollectibleMetadataDispatcher { contract_address: contract };
        let mint_burn = ERC721MintBurnTraitDispatcher { contract_address: contract };

        // Set up comprehensive trait system
        start_cheat_caller_address(contract, metadata_updater);

        // Set trait types
        metadata.set_trait_type_name(0, "Rarity", false);
        metadata.set_trait_type_name(1, "Element", false);
        metadata.set_trait_type_name(2, "Power", false);
        metadata.set_trait_type_name(3, "Region", false);

        // Set trait values for each type
        // Rarity values
        metadata.set_trait_value_name(0, 1, "Common", false);
        metadata.set_trait_value_name(0, 2, "Uncommon", false);
        metadata.set_trait_value_name(0, 3, "Rare", false);
        metadata.set_trait_value_name(0, 4, "Epic", false);
        metadata.set_trait_value_name(0, 5, "Legendary", false);

        // Element values
        metadata.set_trait_value_name(1, 1, "Fire", false);
        metadata.set_trait_value_name(1, 2, "Water", false);
        metadata.set_trait_value_name(1, 3, "Earth", false);
        metadata.set_trait_value_name(1, 4, "Air", false);

        // Power values
        metadata.set_trait_value_name(2, 1, "Weak", false);
        metadata.set_trait_value_name(2, 2, "Strong", false);
        metadata.set_trait_value_name(2, 3, "Mighty", false);

        // Region values
        metadata.set_trait_value_name(3, 1, "Northern Realms", false);
        metadata.set_trait_value_name(3, 2, "Southern Wastes", false);
        metadata.set_trait_value_name(3, 3, "Eastern Kingdoms", false);

        stop_cheat_caller_address(contract);

        // Create attributes for a Legendary Fire Mighty Northern Realms token
        // Byte layout: [region=1, power=3, element=1, rarity=5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        let attributes_raw: u128 = 0x00000000000000000000000001030105;
        // Mint token with these attributes
        start_cheat_caller_address(contract, minter);
        mint_burn.safe_mint(alice, TOKEN_ID_1, attributes_raw);
        stop_cheat_caller_address(contract);

        // Get and verify individual trait names
        assert!(metadata.get_trait_type_name(0) == "Rarity", "Wrong rarity trait type");
        assert!(metadata.get_trait_value_name(0, 5) == "Legendary", "Wrong rarity value");
        assert!(metadata.get_trait_value_name(1, 1) == "Fire", "Wrong element value");
        assert!(metadata.get_trait_value_name(2, 3) == "Mighty", "Wrong power value");
        assert!(metadata.get_trait_value_name(3, 1) == "Northern Realms", "Wrong region value");

        // Get metadata raw and verify
        let stored_attributes = metadata.get_metadata_raw(TOKEN_ID_1);
        assert!(stored_attributes == attributes_raw, "Stored attributes don't match");

        // Get JSON metadata and verify it's not empty
        let json_metadata = metadata.get_metadata_json(TOKEN_ID_1);
        assert!(json_metadata.len() > 0, "JSON metadata should not be empty");
    }

    #[test]
    fn test_metadata_with_ipfs_mapping() {
        let contract = COLLECTIBLES_CONTRACT();
        let alice = ALICE();
        let minter = MINTER();
        let metadata_updater = METADATA_UPDATER();

        let metadata = IRealmsCollectibleMetadataDispatcher { contract_address: contract };
        let mint_burn = ERC721MintBurnTraitDispatcher { contract_address: contract };

        // Set default IPFS CID
        start_cheat_caller_address(contract, metadata_updater);
        metadata.set_default_ipfs_cid("QmDefaultImageCID123");

        // Set specific IPFS CID for legendary items
        let legendary_attributes: u128 = 0x00000000000000000000000000000005; // rarity = 5 (legendary)
        metadata.set_attrs_raw_to_ipfs_cid(legendary_attributes, "QmLegendaryImageCID456");

        stop_cheat_caller_address(contract);

        // Mint a common token (should use default IPFS)
        let common_attributes: u128 = 0x00000000000000000000000000000001; // rarity = 1 (common)
        start_cheat_caller_address(contract, minter);
        mint_burn.safe_mint(alice, TOKEN_ID_1, common_attributes);
        stop_cheat_caller_address(contract);

        // Mint a legendary token (should use specific IPFS)
        start_cheat_caller_address(contract, minter);
        mint_burn.safe_mint(alice, TOKEN_ID_2, legendary_attributes);
        stop_cheat_caller_address(contract);

        // Both should have different JSON metadata due to different IPFS CIDs
        let common_json = metadata.get_metadata_json(TOKEN_ID_1);
        let legendary_json = metadata.get_metadata_json(TOKEN_ID_2);

        assert!(common_json.len() > 0, "Common JSON should not be empty");
        assert!(legendary_json.len() > 0, "Legendary JSON should not be empty");
        assert!(common_json != legendary_json, "JSON should be different for different IPFS mappings");
    }

    #[test]
    fn test_sparse_attributes() {
        let contract = COLLECTIBLES_CONTRACT();
        let alice = ALICE();
        let minter = MINTER();
        let metadata_updater = METADATA_UPDATER();

        let metadata = IRealmsCollectibleMetadataDispatcher { contract_address: contract };
        let mint_burn = ERC721MintBurnTraitDispatcher { contract_address: contract };

        // Set up trait system with gaps
        start_cheat_caller_address(contract, metadata_updater);
        metadata.set_trait_type_name(0, "Rarity", false);
        metadata.set_trait_type_name(5, "Special", false);
        metadata.set_trait_type_name(15, "Ultra", false);

        metadata.set_trait_value_name(0, 3, "Rare", false);
        metadata.set_trait_value_name(5, 7, "Magic", false);
        metadata.set_trait_value_name(15, 255, "Cosmic", false);
        stop_cheat_caller_address(contract);

        // Create sparse attributes: only positions 0, 5, and 15 have values
        // Positions: [15][14][13][12][11][10][9][8][7][6][5][4][3][2][1][0]
        // Values:    [255][0][0][0][0][0][0][0][0][0][7][0][0][0][0][3]
        let sparse_attributes: u128 = 0xFF000000000000000000070000000003;

        start_cheat_caller_address(contract, minter);
        mint_burn.safe_mint(alice, TOKEN_ID_1, sparse_attributes);
        stop_cheat_caller_address(contract);

        // Verify sparse attributes are stored correctly
        let stored = metadata.get_metadata_raw(TOKEN_ID_1);
        assert!(stored == sparse_attributes, "Sparse attributes not stored correctly");

        // JSON should only contain the 3 non-zero traits
        let json_metadata = metadata.get_metadata_json(TOKEN_ID_1);
        assert!(json_metadata.len() > 0, "JSON should contain sparse traits");
    }

    #[test]
    fn test_empty_vs_full_attributes() {
        let contract = COLLECTIBLES_CONTRACT();
        let alice = ALICE();
        let minter = MINTER();

        let metadata = IRealmsCollectibleMetadataDispatcher { contract_address: contract };
        let mint_burn = ERC721MintBurnTraitDispatcher { contract_address: contract };

        // Mint token with no attributes
        start_cheat_caller_address(contract, minter);
        mint_burn.safe_mint(alice, TOKEN_ID_1, 0_u128);
        stop_cheat_caller_address(contract);

        // Mint token with all 16 bytes filled
        let full_attributes: u128 = 0x0F0E0D0C0B0A09080706050403020101;
        start_cheat_caller_address(contract, minter);
        mint_burn.safe_mint(alice, TOKEN_ID_2, full_attributes);
        stop_cheat_caller_address(contract);

        // Compare metadata
        let empty_raw = metadata.get_metadata_raw(TOKEN_ID_1);
        let full_raw = metadata.get_metadata_raw(TOKEN_ID_2);

        assert!(empty_raw == 0, "Empty attributes should be 0");
        assert!(full_raw == full_attributes, "Full attributes should match");

        // Both should generate JSON (though empty will have no traits)
        let empty_json = metadata.get_metadata_json(TOKEN_ID_1);
        let full_json = metadata.get_metadata_json(TOKEN_ID_2);

        assert!(empty_json.len() > 0, "Empty JSON should still have structure");
        assert!(full_json.len() > 0, "Full JSON should have content");
        assert!(full_json.len() > empty_json.len(), "Full JSON should be longer");
    }

    #[test]
    fn test_token_uri_with_attributes() {
        let contract = COLLECTIBLES_CONTRACT();
        let alice = ALICE();
        let minter = MINTER();
        let metadata_updater = METADATA_UPDATER();

        let metadata = IRealmsCollectibleMetadataDispatcher { contract_address: contract };
        let mint_burn = ERC721MintBurnTraitDispatcher { contract_address: contract };
        let erc721_metadata = IERC721MetadataDispatcher { contract_address: contract };

        // Set up metadata system
        start_cheat_caller_address(contract, metadata_updater);
        metadata.set_default_ipfs_cid("QmTestCID");
        metadata.set_trait_type_name(0, "Type", false);
        metadata.set_trait_value_name(0, 1, "Warrior", false);
        stop_cheat_caller_address(contract);

        // Mint token with warrior attributes
        let warrior_attributes: u128 = 0x00000000000000000000000000000001;
        start_cheat_caller_address(contract, minter);
        mint_burn.safe_mint(alice, TOKEN_ID_1, warrior_attributes);
        stop_cheat_caller_address(contract);

        // Get token URI through ERC721 interface
        let token_uri = erc721_metadata.token_uri(TOKEN_ID_1);
        assert!(token_uri.len() > 0, "Token URI should not be empty");

        // Should be base64 encoded JSON with data: prefix
        assert!(token_uri.len() > 20, "Token URI should be substantial length");
    }
}
