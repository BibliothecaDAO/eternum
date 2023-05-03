#[system]
mod ERC721Approve {
    use starknet::ContractAddress;
    use super::super::components::TokenApproval;
    use traits::Into;
    use traits::TryInto;
    use starknet::contract_address::Felt252TryIntoContractAddress;

    fn execute(token: felt252, approved: felt252, token_id: felt252) {
        // approve an address
        commands::set_entity(
            (token, token_id).into(), (TokenApproval { address: approved.try_into().unwrap() })
        );
    }
}

#[system]
mod ERC721TransferFrom {
    use starknet::ContractAddress;
    use zeroable::Zeroable;
    use traits::Into;
    use traits::TryInto;
    use super::super::components::TokenApproval;
    use super::super::components::Owner;
    use super::super::components::Balance;
    use starknet::contract_address::Felt252TryIntoContractAddress;

    fn execute(token: felt252, from: felt252, to: felt252, token_id: felt252) {
        let query: Query = (token, token_id).into();
        commands::set_entity(
            query,
            ( // reset approvals
                TokenApproval {
                    address: Zeroable::zero()
                    }, // update ownership
                     Owner {
                    address: to.try_into().unwrap()
                }
            )
        );

        // update old owner balance
        let query: Query = (token, from).into();
        let balance = commands::<Balance>::entity(query);
        commands::set_entity(query, (Balance { value: balance.value - 1 }));

        // update new owner balance
        let query: Query = (token, to).into();
        let balance = commands::<Balance>::entity(query);
        commands::set_entity(query, (Balance { value: balance.value + 1 }));
    }
}

#[system]
mod ERC721Mint {
    use starknet::contract_address;
    use starknet::ContractAddress;
    use traits::Into;
    use traits::TryInto;
    use starknet::contract_address::Felt252TryIntoContractAddress;
    use super::super::components::Balance;
    use super::super::components::Owner;

    fn execute(token: felt252, owner: felt252, token_id: felt252) {
        // assign token to owner
        commands::set_entity(
            (token, token_id).into(), (Owner { address: owner.try_into().unwrap() })
        );

        let query: Query = (token, owner).into();
        // update owner's balance
        let maybe_balance = commands::<Balance>::try_entity(query);
        let balance = match maybe_balance {
            Option::Some(balance) => balance,
            Option::None(_) => Balance { value: 0 },
        };
        commands::set_entity(query, (Balance { value: balance.value + 1 }));
    }
}
