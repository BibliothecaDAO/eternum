#[cfg(test)]
mod tests {
    use evp::contract::{
        EternumVillagePass as village_pass_contract, IVillagePassDispatcher, IVillagePassDispatcherTrait,
    };
    use evp::mock::realms::realms::{
        IERC721MinterDispatcher, IERC721MinterDispatcherTrait, TestRealm as realms_contract,
    };

    use openzeppelin::access::ownable::interface::{IOwnableDispatcher, IOwnableDispatcherTrait};
    use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use openzeppelin::token::erc721::interface::{
        IERC721Dispatcher, IERC721DispatcherTrait, IERC721MetadataDispatcher, IERC721MetadataDispatcherTrait,
    };
    use openzeppelin::upgrades::interface::{IUpgradeableDispatcher, IUpgradeableDispatcherTrait};
    use snforge_std::{
        ContractClass, ContractClassTrait, DeclareResultTrait, cheatcodes::{l1_handler::L1HandlerTrait}, declare,
        get_class_hash, spy_events, start_cheat_caller_address, stop_cheat_caller_address,
    };

    use starknet::{ClassHash, ContractAddress, EthAddress};

    fn DEFAULT_ADMIN() -> ContractAddress {
        starknet::contract_address_const::<'ADMIN'>()
    }

    fn UPGRADER() -> ContractAddress {
        DEFAULT_ADMIN()
    }

    fn MINTER() -> ContractAddress {
        starknet::contract_address_const::<'MINTER'>()
    }


    fn ALICE() -> ContractAddress {
        starknet::contract_address_const::<'ALICE'>()
    }

    fn DISTRIBUTORS() -> Span<ContractAddress> {
        array![MINTER(), DEFAULT_ADMIN(), ALICE()].span()
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
        let (addr, _) = realms_class.deploy(@array![DEFAULT_ADMIN().into()]).unwrap();
        addr
    }

    fn VILLAGE_PASS() -> ContractAddress {
        let village_pass_class = declare("EternumVillagePass").unwrap().contract_class();
        let realms_contract = TEST_REALMS();

        // deploy season pass contract
        let mut constructor_calldata = array![];
        DEFAULT_ADMIN().serialize(ref constructor_calldata);
        UPGRADER().serialize(ref constructor_calldata);
        MINTER().serialize(ref constructor_calldata);
        DISTRIBUTORS().serialize(ref constructor_calldata);
        realms_contract.serialize(ref constructor_calldata);
        let (addr, _) = village_pass_class.deploy(@constructor_calldata).unwrap();

        addr
    }


    #[test]
    fn test_mint_pass() {
        let village_pass = VILLAGE_PASS();

        let village_pass_dispatcher = IVillagePassDispatcher { contract_address: village_pass };
        let village_pass_erc721_dispatcher = IERC721Dispatcher { contract_address: village_pass };
        // let village_pass_erc721_metadata_dispatcher = IERC721MetadataDispatcher { contract_address: village_pass };

        // ensure alice has no pass
        assert!(village_pass_erc721_dispatcher.balance_of(ALICE()).is_zero(), "expected alice to have no pass");

        // minter mints pass for alice
        start_cheat_caller_address(village_pass, MINTER());
        village_pass_dispatcher.mint(ALICE());
        stop_cheat_caller_address(village_pass);
        // // ensure alice has pass
    // assert!(village_pass_erc721_dispatcher.balance_of(ALICE()) == 1, "expected alice to have pass");

        // ensure encoded metadata is correct
    // println!("\n{}\n\n\n", village_pass_erc721_metadata_dispatcher.token_uri(1));
    // data:application/json;base64,eyJuYW1lIjoiRXRlcm51bSBWaWxsYWdlIFtTZWFzb24gMV0iLCJpbWFnZSI6Imh0dHBzOi8vZ2F0ZXdheS5waW5hdGEuY2xvdWQvaXBmcy9iYWZ5YmVpZ2YzaG5xZXU1MmVyZWpza3hpY3lzNXE1b3FuZnZia2oybzZ3N2plcjV4cG5hNGdwZ2syaSJ9
    }
    // #[test]
// #[should_panic(expected: "evp: Only realm owner can mint season pass")]
// fn test_only_owner_can_mint_pass() {
//     let (village_pass, realms, _) = village_pass();

    //     let realms_mint_dispatcher = IERC721MinterDispatcher { contract_address: realms };
//     let village_pass_dispatcher = IVillagePassDispatcher { contract_address: village_pass };
//     let village_pass_erc721_dispatcher = IERC721Dispatcher { contract_address: village_pass };

    //     // ensure alice has no pass
//     assert!(village_pass_erc721_dispatcher.balance_of(ALICE()).is_zero(), "expected alice to have no pass");

    //     // alice buys realms nft
//     start_cheat_caller_address(realms, ALICE());
//     realms_mint_dispatcher.mint(ALICE_REALMS_ID());
//     stop_cheat_caller_address(realms);

    //     // bob tries to mint pass
//     start_cheat_caller_address(village_pass, BOB());
//     village_pass_dispatcher.mint(ALICE(), ALICE_REALMS_ID());
// }
}
