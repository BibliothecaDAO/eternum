
#[cfg(test)]
mod tests {
    use collectibles_claim::contracts::cosmetics::{
        CosmeticCollectiblesClaim, ICosmeticCollectiblesClaimDispatcher, ICosmeticCollectiblesClaimDispatcherTrait,
        CollectibleMintTrait, CollectibleMintTraitDispatcher, CollectibleMintTraitDispatcherTrait, UPGRADER_ROLE,
    };
    use collectibles_claim::tests::mocks::account::AccountUpgradeable;
    use collectibles_claim::utils::cartridge::vrf::{IVrfProviderDispatcher, IVrfProviderDispatcherTrait, Source};
    use openzeppelin::access::accesscontrol::DEFAULT_ADMIN_ROLE;
    use openzeppelin::access::accesscontrol::interface::{IAccessControlDispatcher, IAccessControlDispatcherTrait};
    use openzeppelin::token::erc721::interface::{IERC721Dispatcher, IERC721DispatcherTrait};
    use openzeppelin::upgrades::interface::{IUpgradeableDispatcher, IUpgradeableDispatcherTrait};
    use collectibles_claim::tests::mocks::contracts::{
        MockPaymentERC721, IMockPaymentERC721Dispatcher, IMockPaymentERC721DispatcherTrait,
        MockCollectibleERC721, 
    };
    

    use snforge_std::{
        ContractClass, ContractClassTrait, DeclareResultTrait, declare, spy_events, EventSpyAssertionsTrait, 
        start_cheat_caller_address, start_cheat_block_timestamp, start_cheat_transaction_hash,
        stop_cheat_caller_address, stop_cheat_block_timestamp, stop_cheat_transaction_hash,
        start_cheat_chain_id_global 
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

    fn UPGRADER() -> ContractAddress {
        starknet::contract_address_const::<'UPGRADER'>()
    }

    // Test constants
    const TOKEN_ID_1: u256 = 1;
    const TOKEN_ID_2: u256 = 2;
    const TOKEN_ID_3: u256 = 3;

    // Helper function to create person accounts
    fn PERSON(name: ByteArray) -> ContractAddress {
        let account_class = declare("AccountUpgradeable").unwrap().contract_class();
        let mut constructor_calldata = array![0x123];
        let (addr, _) = account_class.deploy(@constructor_calldata).unwrap();
        addr
    }



    fn deploy_payment_contract() -> ContractAddress {
        let payment_class = declare("MockPaymentERC721").unwrap().contract_class();
        let mut constructor_calldata = array![];
        let name: ByteArray = "Payment Tokens";
        let symbol: ByteArray = "PAY";
        name.serialize(ref constructor_calldata);
        symbol.serialize(ref constructor_calldata);
        let (addr, _) = payment_class.deploy(@constructor_calldata).unwrap();
        addr
    }

    fn deploy_collectible_contract() -> ContractAddress {
        let collectible_class = declare("MockCollectibleERC721").unwrap().contract_class();
        let mut constructor_calldata = array![];
        let name: ByteArray = "Collectible Tokens";
        let symbol: ByteArray = "COLLECT";
        name.serialize(ref constructor_calldata);
        symbol.serialize(ref constructor_calldata);
        let (addr, _) = collectible_class.deploy(@constructor_calldata).unwrap();
        addr
    }

    fn setup_claim_scenario() -> (ContractAddress, ContractAddress, ContractAddress, ContractAddress) {
        let payment_contract = deploy_payment_contract();
        let collectible_contract = deploy_collectible_contract();
        let vrf_provider: ContractAddress = Zeroable::zero();

        let claim_class = declare("CosmeticCollectiblesClaim").unwrap().contract_class();

        let mut constructor_calldata = array![];
        collectible_contract.serialize(ref constructor_calldata);
        payment_contract.serialize(ref constructor_calldata);
        vrf_provider.serialize(ref constructor_calldata);
        ADMIN().serialize(ref constructor_calldata);
        UPGRADER().serialize(ref constructor_calldata);

        let (claim_contract, _) = claim_class.deploy(@constructor_calldata).unwrap();

        (claim_contract, payment_contract, collectible_contract, vrf_provider)
    }

    // =====================================
    // INITIALIZATION TESTS
    // =====================================

    #[test]
    fn test_contract_initialization() {
        let (claim_contract, _payment_contract, _collectible_contract, _vrf_provider) = setup_claim_scenario();
        let admin = ADMIN();
        let upgrader = UPGRADER();

        let access_control = IAccessControlDispatcher { contract_address: claim_contract };

        // Check role assignments
        assert!(access_control.has_role(DEFAULT_ADMIN_ROLE, admin), "Admin role not assigned");
        assert!(access_control.has_role(UPGRADER_ROLE, upgrader), "Upgrader role not assigned");
    }

    // =====================================
    // CLAIM FUNCTIONALITY TESTS
    // =====================================

    #[test]
    fn test_claim_success() {
        let (claim_contract, payment_contract, collectible_contract, _vrf_provider) = setup_claim_scenario();
        let alice = ALICE();

        let claim = ICosmeticCollectiblesClaimDispatcher { contract_address: claim_contract };
        let payment_token = IERC721Dispatcher { contract_address: payment_contract };
        let collectible_token = IERC721Dispatcher { contract_address: collectible_contract };

        // Mint a payment token to Alice
        let payment_mint = IMockPaymentERC721Dispatcher { contract_address: payment_contract };
        payment_mint.mint(alice, TOKEN_ID_1);

        // Alice approves the claim contract to transfer her payment token
        start_cheat_caller_address(payment_contract, alice);
        payment_token.approve(claim_contract, TOKEN_ID_1);
        stop_cheat_caller_address(payment_contract);

        // Verify Alice owns the payment token initially
        assert!(payment_token.owner_of(TOKEN_ID_1) == alice, "Alice should own payment token");
        assert!(collectible_token.balance_of(alice) == 0, "Alice should have no collectibles initially");

        // Alice claims collectibles by burning her payment token
        start_cheat_caller_address(claim_contract, alice);
        start_cheat_chain_id_global('abc');
        claim.claim(TOKEN_ID_1);
        stop_cheat_caller_address(claim_contract);

        // Verify the payment token was transferred to the claim contract
        assert!(payment_token.owner_of(TOKEN_ID_1) == claim_contract, "Claim contract should own payment token");

        // Verify Alice received collectibles (should be 3 based on num_collectibles())
        let alice_balance = collectible_token.balance_of(alice);
        assert!(alice_balance == 3, "Alice should have received 3 collectibles");

        // Verify Alice owns the collectible tokens
        assert!(collectible_token.owner_of(1) == alice, "Alice should own collectible token 1");
        assert!(collectible_token.owner_of(2) == alice, "Alice should own collectible token 2");
        assert!(collectible_token.owner_of(3) == alice, "Alice should own collectible token 3");
    }

    #[test]
    #[should_panic(expected: 'ERC721: unauthorized caller')]
    fn test_claim_without_payment_token_fails() {
        let (claim_contract, payment_contract, _collectible_contract, _vrf_provider) = setup_claim_scenario();
        let alice = ALICE();

        // Mint a payment token to Bob
        let payment_mint = IMockPaymentERC721Dispatcher { contract_address: payment_contract };
        payment_mint.mint(BOB(), TOKEN_ID_1);

        let claim = ICosmeticCollectiblesClaimDispatcher { contract_address: claim_contract };

        // Alice tries to claim without owning the payment token (should fail)
        start_cheat_caller_address(claim_contract, alice);
        claim.claim(TOKEN_ID_1);
    }

    #[test]
    #[should_panic(expected: 'ERC721: unauthorized caller')]
    fn test_claim_without_approval_fails() {
        let (claim_contract, payment_contract, _collectible_contract, _vrf_provider) = setup_claim_scenario();
        let alice = ALICE();

        let claim = ICosmeticCollectiblesClaimDispatcher { contract_address: claim_contract };

        // Mint a payment token to Alice but don't approve the claim contract
        let payment_mint = IMockPaymentERC721Dispatcher { contract_address: payment_contract };
        payment_mint.mint(alice, TOKEN_ID_1);

        // Alice tries to claim without approving the transfer (should fail)
        start_cheat_caller_address(claim_contract, alice);
        claim.claim(TOKEN_ID_1);
    }

    // #[test]
    // fn test_claim_event_emission() {
    //     let (claim_contract, payment_contract, collectible_contract, _vrf_provider) = setup_claim_scenario();
    //     let alice = ALICE();

    //     let claim = ICosmeticCollectiblesClaimDispatcher { contract_address: claim_contract };
    //     let payment_token = IERC721Dispatcher { contract_address: payment_contract };

    //     // Setup payment token
    //     let payment_mint = IMockPaymentERC721Dispatcher { contract_address: payment_contract };
    //     payment_mint.mint(alice, TOKEN_ID_1);

    //     start_cheat_caller_address(payment_contract, alice);
    //     payment_token.approve(claim_contract, TOKEN_ID_1);
    //     stop_cheat_caller_address(payment_contract);

    //     // Start spying on events
    //     let mut spy = spy_events();

    //     // Set block timestamp for the event
    //     start_cheat_block_timestamp(claim_contract, 1000);

    //     // Alice claims collectibles
    //     start_cheat_caller_address(claim_contract, alice);
    //     claim.claim(TOKEN_ID_1);
    //     stop_cheat_caller_address(claim_contract);

    //     stop_cheat_block_timestamp(claim_contract);

    //     // Verify CollectibleClaimed events were emitted (should be 3 events)
    //     let events = spy.get_events().emitted_by(claim_contract);
    //     assert!(events.len() == 3, "Should emit 3 CollectibleClaimed events");

    //     // Check that each event has the correct structure
    //     for i in 0..3 {
    //         let event = events.at(i);
    //         let event_name = *event.keys.at(0);
    //         assert!(event_name == selector!("CollectibleClaimed"), "Wrong event name");
    //     }
    // }

    // #[test]
    // fn test_multiple_claims_by_different_users() {
    //     let (claim_contract, payment_contract, collectible_contract, _vrf_provider) = setup_claim_scenario();
    //     let alice = ALICE();
    //     let bob = BOB();

    //     let claim = ICosmeticCollectiblesClaimDispatcher { contract_address: claim_contract };
    //     let payment_token = IERC721Dispatcher { contract_address: payment_contract };
    //     let collectible_token = IERC721Dispatcher { contract_address: collectible_contract };
    //     let payment_mint = IMockPaymentERC721Dispatcher { contract_address: payment_contract };

    //     // Setup payment tokens for both users
    //     payment_mint.mint(alice, TOKEN_ID_1);
    //     payment_mint.mint(bob, TOKEN_ID_2);

    //     // Alice claims first
    //     start_cheat_caller_address(payment_contract, alice);
    //     payment_token.approve(claim_contract, TOKEN_ID_1);
    //     stop_cheat_caller_address(payment_contract);

    //     start_cheat_caller_address(claim_contract, alice);
    //     claim.claim(TOKEN_ID_1);
    //     stop_cheat_caller_address(claim_contract);

    //     // Bob claims second
    //     start_cheat_caller_address(payment_contract, bob);
    //     payment_token.approve(claim_contract, TOKEN_ID_2);
    //     stop_cheat_caller_address(payment_contract);

    //     start_cheat_caller_address(claim_contract, bob);
    //     claim.claim(TOKEN_ID_2);
    //     stop_cheat_caller_address(claim_contract);

    //     // Verify both users received their collectibles
    //     assert!(collectible_token.balance_of(alice) == 3, "Alice should have 3 collectibles");
    //     assert!(collectible_token.balance_of(bob) == 3, "Bob should have 3 collectibles");

    //     // Verify token ownership is correct
    //     assert!(collectible_token.owner_of(1) == alice, "Alice should own token 1");
    //     assert!(collectible_token.owner_of(2) == alice, "Alice should own token 2");
    //     assert!(collectible_token.owner_of(3) == alice, "Alice should own token 3");
    //     assert!(collectible_token.owner_of(4) == bob, "Bob should own token 4");
    //     assert!(collectible_token.owner_of(5) == bob, "Bob should own token 5");
    //     assert!(collectible_token.owner_of(6) == bob, "Bob should own token 6");
    // }

    // // =====================================
    // // RANDOM GENERATION TESTS
    // // =====================================

    // #[test]
    // fn test_collectible_attributes_generation() {
    //     let (claim_contract, payment_contract, collectible_contract, _vrf_provider) = setup_claim_scenario();
    //     let alice = ALICE();

    //     let claim = ICosmeticCollectiblesClaimDispatcher { contract_address: claim_contract };
    //     let payment_token = IERC721Dispatcher { contract_address: payment_contract };
    //     let collectible_attrs = MockCollectibleERC721Dispatcher { contract_address: collectible_contract };

    //     // Setup payment token
    //     let payment_mint = IMockPaymentERC721Dispatcher { contract_address: payment_contract };
    //     payment_mint.mint(alice, TOKEN_ID_1);

    //     start_cheat_caller_address(payment_contract, alice);
    //     payment_token.approve(claim_contract, TOKEN_ID_1);
    //     stop_cheat_caller_address(payment_contract);

    //     // Alice claims collectibles
    //     start_cheat_caller_address(claim_contract, alice);
    //     claim.claim(TOKEN_ID_1);
    //     stop_cheat_caller_address(claim_contract);

    //     // Verify that each collectible has non-zero attributes
    //     let attrs1 = collectible_attrs.get_token_attributes(1);
    //     let attrs2 = collectible_attrs.get_token_attributes(2);
    //     let attrs3 = collectible_attrs.get_token_attributes(3);

    //     assert!(attrs1 != 0, "Token 1 should have non-zero attributes");
    //     assert!(attrs2 != 0, "Token 2 should have non-zero attributes");
    //     assert!(attrs3 != 0, "Token 3 should have non-zero attributes");
    // }

    // #[test]
    // fn test_attributes_probabilities_consistency() {
    //     // Test that the attributes probabilities function returns consistent data
    //     let (choices, weights) = CosmeticCollectiblesClaim::InternalImpl::collectibles_attributes_probabilities();
        
    //     // Verify that choices and weights arrays have the same length
    //     assert!(choices.len() == weights.len(), "Choices and weights arrays should have same length");
        
    //     // Verify that we have at least one choice available
    //     assert!(choices.len() > 0, "Should have at least one attribute choice");
        
    //     // Verify that all weights are positive (since we're doing probability selection)
    //     let mut total_weight: u128 = 0;
    //     for i in 0..weights.len() {
    //         let weight = *weights.at(i);
    //         assert!(weight > 0, "All weights should be positive");
    //         total_weight += weight;
    //     }
    //     assert!(total_weight > 0, "Total weight should be positive");
        
    //     // Verify that all attribute choices are non-zero (as they should be valid attributes)
    //     for i in 0..choices.len() {
    //         let choice = *choices.at(i);
    //         assert!(choice > 0, "All attribute choices should be non-zero");
    //     }
    // }

    // #[test]
    // fn test_num_collectibles_consistency() {
    //     // Test that num_collectibles returns a reasonable value
    //     let num_collectibles = CosmeticCollectiblesClaim::InternalImpl::num_collectibles();
    //     assert!(num_collectibles > 0, "Should mint at least 1 collectible");
    //     assert!(num_collectibles <= 10, "Should not mint too many collectibles at once");
    // }

    // #[test]
    // fn test_deterministic_randomness_with_vrf() {
    //     let (claim_contract, payment_contract, collectible_contract, vrf_provider) = setup_claim_scenario();
    //     let alice = ALICE();

    //     let claim = ICosmeticCollectiblesClaimDispatcher { contract_address: claim_contract };
    //     let payment_token = IERC721Dispatcher { contract_address: payment_contract };
    //     let collectible_attrs = MockCollectibleERC721Dispatcher { contract_address: collectible_contract };
    //     let vrf_mock = MockVrfProviderDispatcher { contract_address: vrf_provider };

    //     // Set a specific random value for Alice
    //     vrf_mock.set_random_value(alice, 12345);

    //     // Setup payment tokens for multiple claims
    //     let payment_mint = IMockPaymentERC721Dispatcher { contract_address: payment_contract };
    //     payment_mint.mint(alice, TOKEN_ID_1);
    //     payment_mint.mint(alice, TOKEN_ID_2);

    //     // First claim
    //     start_cheat_caller_address(payment_contract, alice);
    //     payment_token.approve(claim_contract, TOKEN_ID_1);
    //     stop_cheat_caller_address(payment_contract);

    //     start_cheat_caller_address(claim_contract, alice);
    //     claim.claim(TOKEN_ID_1);
    //     stop_cheat_caller_address(claim_contract);

    //     let attrs1_1 = collectible_attrs.get_token_attributes(1);
    //     let attrs1_2 = collectible_attrs.get_token_attributes(2);
    //     let attrs1_3 = collectible_attrs.get_token_attributes(3);

    //     // Reset the random value to the same value
    //     vrf_mock.set_random_value(alice, 12345);

    //     // Second claim with same random seed should potentially give different results
    //     // due to different salt/timestamp, but all should still be valid attributes
    //     start_cheat_caller_address(payment_contract, alice);
    //     payment_token.approve(claim_contract, TOKEN_ID_2);
    //     stop_cheat_caller_address(payment_contract);

    //     start_cheat_caller_address(claim_contract, alice);
    //     claim.claim(TOKEN_ID_2);
    //     stop_cheat_caller_address(claim_contract);

    //     let attrs2_1 = collectible_attrs.get_token_attributes(4);
    //     let attrs2_2 = collectible_attrs.get_token_attributes(5);
    //     let attrs2_3 = collectible_attrs.get_token_attributes(6);

    //     // All attributes should be non-zero and valid
    //     assert!(attrs1_1 != 0 && attrs1_2 != 0 && attrs1_3 != 0, "First claim attributes should be valid");
    //     assert!(attrs2_1 != 0 && attrs2_2 != 0 && attrs2_3 != 0, "Second claim attributes should be valid");
    // }

    // // =====================================
    // // UPGRADE FUNCTIONALITY TESTS
    // // =====================================

    // #[test]
    // fn test_upgrade_contract() {
    //     let claim_contract = CLAIM_CONTRACT();
    //     let upgrader = UPGRADER();

    //     let upgradeable = IUpgradeableDispatcher { contract_address: claim_contract };

    //     // Declare a new version (for testing, we'll use the same contract)
    //     let new_class = declare("CosmeticCollectiblesClaim").unwrap().contract_class();

    //     start_cheat_caller_address(claim_contract, upgrader);
    //     upgradeable.upgrade(*new_class.class_hash);
    //     stop_cheat_caller_address(claim_contract);
    // }

    // #[test]
    // #[should_panic(expected: 'Caller is missing role')]
    // fn test_upgrade_unauthorized() {
    //     let claim_contract = CLAIM_CONTRACT();
    //     let alice = ALICE();

    //     let upgradeable = IUpgradeableDispatcher { contract_address: claim_contract };

    //     let new_class = declare("CosmeticCollectiblesClaim").unwrap().contract_class();

    //     start_cheat_caller_address(claim_contract, alice);
    //     upgradeable.upgrade(*new_class.class_hash);
    // }

    // // =====================================
    // // ERROR CASE TESTS
    // // =====================================

    // #[test]
    // #[should_panic(expected: "ERC721: invalid token ID")]
    // fn test_claim_nonexistent_payment_token() {
    //     let (claim_contract, _payment_contract, _collectible_contract, _vrf_provider) = setup_claim_scenario();
    //     let alice = ALICE();

    //     let claim = ICosmeticCollectiblesClaimDispatcher { contract_address: claim_contract };

    //     // Alice tries to claim with a non-existent payment token
    //     start_cheat_caller_address(claim_contract, alice);
    //     claim.claim(999); // Non-existent token ID
    // }

    // #[test]
    // fn test_vrf_provider_zero_address_fallback() {
    //     // Test the fallback behavior when VRF provider is zero address
    //     let payment_contract = deploy_payment_contract();
    //     let collectible_contract = deploy_collectible_contract();
    //     let zero_vrf_provider = starknet::contract_address_const::<0>();

    //     let claim_class = declare("CosmeticCollectiblesClaim").unwrap().contract_class();

    //     let mut constructor_calldata = array![];
    //     collectible_contract.serialize(ref constructor_calldata);
    //     payment_contract.serialize(ref constructor_calldata);
    //     zero_vrf_provider.serialize(ref constructor_calldata); // Zero address
    //     ADMIN().serialize(ref constructor_calldata);
    //     UPGRADER().serialize(ref constructor_calldata);

    //     let (claim_contract, _) = claim_class.deploy(@constructor_calldata).unwrap();

    //     let alice = ALICE();
    //     let claim = ICosmeticCollectiblesClaimDispatcher { contract_address: claim_contract };
    //     let payment_token = IERC721Dispatcher { contract_address: payment_contract };

    //     // Setup payment token
    //     let payment_mint = IMockPaymentERC721Dispatcher { contract_address: payment_contract };
    //     payment_mint.mint(alice, TOKEN_ID_1);

    //     start_cheat_caller_address(payment_contract, alice);
    //     payment_token.approve(claim_contract, TOKEN_ID_1);
    //     stop_cheat_caller_address(payment_contract);

    //     // Set a specific transaction hash to ensure deterministic behavior
    //     start_cheat_transaction_hash(claim_contract, 0x123456789);

    //     // Alice should be able to claim (using transaction hash as seed)
    //     start_cheat_caller_address(claim_contract, alice);
    //     claim.claim(TOKEN_ID_1);
    //     stop_cheat_caller_address(claim_contract);

    //     stop_cheat_transaction_hash(claim_contract);

    //     // Verify claim succeeded
    //     let collectible_token = IERC721Dispatcher { contract_address: collectible_contract };
    //     assert!(collectible_token.balance_of(alice) == 3, "Alice should have received collectibles with zero VRF provider");
    // }

    // // =====================================
    // // INTEGRATION TESTS
    // // =====================================

    // #[test]
    // fn test_complete_claim_workflow() {
    //     let (claim_contract, payment_contract, collectible_contract, _vrf_provider) = setup_claim_scenario();
    //     let alice = ALICE();

    //     let claim = ICosmeticCollectiblesClaimDispatcher { contract_address: claim_contract };
    //     let payment_token = IERC721Dispatcher { contract_address: payment_contract };
    //     let collectible_token = IERC721Dispatcher { contract_address: collectible_contract };
    //     let collectible_attrs = MockCollectibleERC721Dispatcher { contract_address: collectible_contract };

    //     // Step 1: Mint payment token to Alice
    //     let payment_mint = IMockPaymentERC721Dispatcher { contract_address: payment_contract };
    //     payment_mint.mint(alice, TOKEN_ID_1);

    //     // Step 2: Alice approves the claim contract
    //     start_cheat_caller_address(payment_contract, alice);
    //     payment_token.approve(claim_contract, TOKEN_ID_1);
    //     stop_cheat_caller_address(payment_contract);

    //     // Step 3: Start event monitoring
    //     let mut spy = spy_events();

    //     // Step 4: Alice claims collectibles
    //     start_cheat_block_timestamp(claim_contract, 2000);
    //     start_cheat_caller_address(claim_contract, alice);
    //     claim.claim(TOKEN_ID_1);
    //     stop_cheat_caller_address(claim_contract);
    //     stop_cheat_block_timestamp(claim_contract);

    //     // Step 5: Verify all state changes

    //     // Payment token should be transferred to claim contract
    //     assert!(payment_token.owner_of(TOKEN_ID_1) == claim_contract, "Payment token should be in claim contract");

    //     // Alice should have received 3 collectible tokens
    //     assert!(collectible_token.balance_of(alice) == 3, "Alice should have 3 collectibles");

    //     // All collectible tokens should have valid attributes
    //     for i in 1..4 {
    //         assert!(collectible_token.owner_of(i) == alice, "Alice should own all collectibles");
    //         let attrs = collectible_attrs.get_token_attributes(i);
    //         assert!(attrs != 0, "All collectibles should have valid attributes");
    //     }

    //     // Events should have been emitted
    //     let events = spy.get_events().emitted_by(claim_contract);
    //     assert!(events.len() == 3, "Should emit 3 CollectibleClaimed events");
    // }

    // #[test]
    // fn test_batch_claims_different_attributes() {
    //     let (claim_contract, payment_contract, collectible_contract, vrf_provider) = setup_claim_scenario();
    //     let alice = ALICE();
    //     let bob = BOB();

    //     let claim = ICosmeticCollectiblesClaimDispatcher { contract_address: claim_contract };
    //     let payment_token = IERC721Dispatcher { contract_address: payment_contract };
    //     let collectible_attrs = MockCollectibleERC721Dispatcher { contract_address: collectible_contract };
    //     let vrf_mock = MockVrfProviderDispatcher { contract_address: vrf_provider };

    //     // Set different random values for Alice and Bob
    //     vrf_mock.set_random_value(alice, 11111);
    //     vrf_mock.set_random_value(bob, 99999);

    //     // Setup payment tokens
    //     let payment_mint = IMockPaymentERC721Dispatcher { contract_address: payment_contract };
    //     payment_mint.mint(alice, TOKEN_ID_1);
    //     payment_mint.mint(bob, TOKEN_ID_2);

    //     // Alice claims
    //     start_cheat_caller_address(payment_contract, alice);
    //     payment_token.approve(claim_contract, TOKEN_ID_1);
    //     stop_cheat_caller_address(payment_contract);

    //     start_cheat_caller_address(claim_contract, alice);
    //     claim.claim(TOKEN_ID_1);
    //     stop_cheat_caller_address(claim_contract);

    //     // Bob claims
    //     start_cheat_caller_address(payment_contract, bob);
    //     payment_token.approve(claim_contract, TOKEN_ID_2);
    //     stop_cheat_caller_address(payment_contract);

    //     start_cheat_caller_address(claim_contract, bob);
    //     claim.claim(TOKEN_ID_2);
    //     stop_cheat_caller_address(claim_contract);

    //     // Collect all attributes from both users
    //     let mut all_attributes = array![];
    //     for i in 1..7 { // 6 tokens total (3 for Alice, 3 for Bob)
    //         let attrs = collectible_attrs.get_token_attributes(i);
    //         assert!(attrs != 0, "All attributes should be non-zero");
    //         all_attributes.append(attrs);
    //     }

    //     // Verify we got valid attributes for all tokens
    //     assert!(all_attributes.len() == 6, "Should have attributes for all 6 tokens");
    // }
}
