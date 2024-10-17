#[cfg(test)]
mod tests {
    use snforge_std::{
        cheatcodes::{l1_handler::L1HandlerTrait},
        declare, ContractClass, ContractClassTrait, start_cheat_caller_address, stop_cheat_caller_address,
        get_class_hash, spy_events, DeclareResultTrait
    };

    use openzeppelin::access::ownable::interface::{
        IOwnableDispatcher, IOwnableDispatcherTrait
    };
    use openzeppelin::token::erc721::interface::{IERC721Dispatcher, IERC721DispatcherTrait};
    use openzeppelin::upgrades::interface::{IUpgradeableDispatcher, IUpgradeableDispatcherTrait};
    use esp::contract::EternumSeasonPass as season_pass_contract;
    use esp::mock::realms::{TestRealm as realms_contract, IERC721MinterDispatcher, IERC721MinterDispatcherTrait};
    use esp::mock::realms::{IRealmMetadataEncodedDispatcher, IRealmMetadataEncodedDispatcherTrait};
    
    use starknet::{ContractAddress, ClassHash, EthAddress};

    fn ADMIN() -> ContractAddress {
        starknet::contract_address_const::<'ADMIN'>()
    }

    fn ALICE() -> ContractAddress {
        starknet::contract_address_const::<'ALICE'>()
    }

    fn BOB() -> ContractAddress {
        starknet::contract_address_const::<'BOB'>()
    }

    fn ALICE_REALMS_ID() -> u256 {
        1
    }

    fn BOB_REALMS_ID() -> u256 {
        2
    }



    fn TEST_REALMS() -> ContractAddress {
        let realms_class = declare("TestRealm").unwrap().contract_class();
        let (addr, _) = realms_class.deploy(@array![ADMIN().into()]).unwrap();
        addr
    }

    fn SEASON_PASS() -> (ContractAddress, ContractAddress) {
        let season_pass_class = declare("EternumSeasonPass").unwrap().contract_class();
        let realms = TEST_REALMS();

        let mut constructor_calldata = array![];
        ADMIN().serialize(ref constructor_calldata);
        realms.serialize(ref constructor_calldata);
        let (addr, _) = season_pass_class.deploy(@constructor_calldata).unwrap();

        (addr, realms)
    }


    #[test]
    fn test_mint_pass() {
        let (season_pass, realms) = SEASON_PASS();

        let realms_mint_dispatcher = IERC721MinterDispatcher { contract_address: realms };
        let season_pass_mint_dispatcher = IERC721MinterDispatcher { contract_address: season_pass };
        let season_pass_erc721_dispatcher = IERC721Dispatcher { contract_address: season_pass };

        // ensure alice has no pass
        assert!(season_pass_erc721_dispatcher.balance_of(ALICE()).is_zero(), "expected alice to have no pass");

        // alice buys realms nft
        start_cheat_caller_address(realms, ALICE());
        realms_mint_dispatcher.mint(ALICE_REALMS_ID());
        stop_cheat_caller_address(realms);

        // alice gets pass using realms nft
        start_cheat_caller_address(season_pass, ALICE());
        season_pass_mint_dispatcher.mint(ALICE_REALMS_ID());
        stop_cheat_caller_address(season_pass);

        // ensure alice has pass
        assert!(season_pass_erc721_dispatcher.balance_of(ALICE()) ==1, "expected alice to have pass");

        // ensure encoded metadata is correct
        let (realms_metadata, _a, _b) 
            = IRealmMetadataEncodedDispatcher { contract_address: realms }
                .get_encoded_metadata(ALICE_REALMS_ID().try_into().unwrap());
        
        let (season_pass_metadata, _a, _b) 
            = IRealmMetadataEncodedDispatcher { contract_address: season_pass }
                .get_encoded_metadata(ALICE_REALMS_ID().try_into().unwrap());
        assert!(realms_metadata == season_pass_metadata, "expected realms metadata to be equal to season pass metadata");
    }


    #[test]
    #[should_panic(expected: "ESP: Only realm owner can mint season pass")]
    fn test_only_owner_can_mint_pass() {
        let (season_pass, realms) = SEASON_PASS();

        let realms_mint_dispatcher = IERC721MinterDispatcher { contract_address: realms };
        let season_pass_mint_dispatcher = IERC721MinterDispatcher { contract_address: season_pass };
        let season_pass_erc721_dispatcher = IERC721Dispatcher { contract_address: season_pass };

        // ensure alice has no pass
        assert!(season_pass_erc721_dispatcher.balance_of(ALICE()).is_zero(), "expected alice to have no pass");

        // alice buys realms nft
        start_cheat_caller_address(realms, ALICE());
        realms_mint_dispatcher.mint(ALICE_REALMS_ID());
        stop_cheat_caller_address(realms);

        // bob tries to mint pass
        start_cheat_caller_address(season_pass, BOB());
        season_pass_mint_dispatcher.mint(ALICE_REALMS_ID());       
    }
   
}
