// TODO: proper safe_transfer_from
//       token URI - wat do?
//       use low level API for execute
//       check for EIP compliance
//       auth?
//       pass in the token: felt252 as the first param to system::execute, since there can be more than 1 in a game; same as erc20
//       try ((get_contract_address(), token_id).into()) - without using into() on get_contract_address
//       maybe some nice / smart way how to use the get_contract_address automatically to build a query? so I don't have to inject it everywhere

// NOTES:
//   * owner_of is less optimal because it calls `owner` twice (once in `validate_token_id`) but
//     the code is cleaner this way so I kept it
//   * not sure yet where the auth asserts should be - in the 721 interface or in systems?

#[contract]
mod ERC721 {
    use array::ArrayTrait;
    use option::OptionTrait;
    use starknet::contract_address;
    use starknet::ContractAddress;
    use starknet::get_caller_address;
    use starknet::get_contract_address;
    use traits::Into;
    use traits::TryInto;
    use zeroable::Zeroable;
    use starknet::contract_address::Felt252TryIntoContractAddress;

    use dojo_core::storage::query::Query;
    use dojo_core::storage::query::QueryTrait;
    use dojo_core::storage::query::LiteralIntoQuery;

    use dojo_core::interfaces::IWorldDispatcher;
    use dojo_core::interfaces::IWorldDispatcherTrait;

    use super::super::components::Balance;
    use super::super::components::Owner;
    use super::super::components::TokenApproval;

    #[event]
    fn Transfer(from: ContractAddress, to: ContractAddress, token_id: felt252) {}

    #[event]
    fn Approval(owner: ContractAddress, approved: ContractAddress, token_id: felt252) {}

    struct Storage {
        _world: ContractAddress,
        _name: felt252,
        _symbol: felt252,
        _token_counter: felt252,
    }

    //
    // Constructor
    //

    #[constructor]
    fn constructor(world_addr: ContractAddress, token_name: felt252, token_symbol: felt252) {
        _world::write(world_addr);
        _name::write(token_name);
        _symbol::write(token_symbol);
        _token_counter::write(0);
    }

    //
    // ERC721Metadata
    //

    #[view]
    fn name() -> felt252 {
        _name::read()
    }

    #[view]
    fn symbol() -> felt252 {
        _symbol::read()
    }

    //
    // ERC721
    //

    #[external]
    fn transfer_from(from: ContractAddress, to: ContractAddress, token_id: felt252) {
        transfer(from, to, token_id);
    }

    #[external]
    fn approve(approved: ContractAddress, token_id: felt252) {
        let owner = owner(token_id);
        assert(owner != approved, 'approval to owner');

        let token: felt252 = get_contract_address().into();
        let caller = get_caller_address();
        assert(caller == owner, 'not approved');

        let mut calldata = ArrayTrait::new();
        calldata.append(token);
        calldata.append(approved.into());
        calldata.append(token_id);
        world().execute('ERC721Approve'.into(), calldata.span());

        Approval(owner, approved, token_id);
    }

    //
    // NFT mint / burn
    //

    #[external]
    fn mint(to: ContractAddress) {
        assert(to.is_non_zero(), 'minting to zero address');
        // TODO: assert can mint

        let token = get_contract_address();
        let token_id = _token_counter::read();
        _token_counter::write(token_id + 1);
        let mut calldata = ArrayTrait::<felt252>::new();
        calldata.append(token.into());
        calldata.append(to.into());
        calldata.append(token_id);
        world().execute('ERC721Mint'.into(), calldata.span());

        Transfer(Zeroable::zero(), to, token_id);
    }

    //
    // Internal
    //

    // NOTE: temporary, until we have inline commands outside of systems
    fn world() -> IWorldDispatcher {
        IWorldDispatcher { contract_address: _world::read() }
    }

    // fn assert_approved_or_owner(owner: ContractAddress, operator: ContractAddress, token_id: felt252) {
    //     let approved = commands::<TokenApproval>::entity((get_contract_address().into(), token_id).into());
    //     assert(
    //         operator == owner | operator == approved.address,
    //         'operation not allowed'
    //     );
    // }

    fn assert_valid_address(address: ContractAddress) {
        assert(address.is_non_zero(), 'invalid address');
    }

    #[inline(always)]
    fn owner(token: felt252) -> ContractAddress {
        let owner = world().entity('Owner'.into(), get_contract_address().into(), 0_u8, 0_usize);
        (*owner[0]).try_into().unwrap()
    }

    fn transfer(from: ContractAddress, to: ContractAddress, token_id: felt252) {
        let token = get_contract_address();
        let owner = owner(token_id);

        assert(owner == from, 'source not owner');
        assert(to.is_non_zero(), 'transferring to zero');

        let mut calldata = ArrayTrait::new();
        calldata.append(token.into());
        calldata.append(from.into());
        calldata.append(to.into());
        calldata.append(token_id);
        world().execute('ERC721TransferFrom'.into(), calldata.span());

        Transfer(from, to, token_id);
    }
}
