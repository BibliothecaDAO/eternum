#[system]
mod ERC721Approve {
    use traits::{Into, TryInto};
    use starknet::contract_address::Felt252TryIntoContractAddress;

    use super::super::components::TokenApproval;
    use eternum::alias::ID;

    fn execute(token: felt252, approved: felt252, token_id: ID) {
        // approve an address
        commands::set_entity(
            (token, token_id).into(), (TokenApproval { address: approved.try_into().unwrap() })
        );
    }
}

#[system]
mod ERC721TransferFrom {
    use zeroable::Zeroable;
    use traits::{Into, TryInto};
    use starknet::contract_address::Felt252TryIntoContractAddress;

    use super::super::components::{TokenApproval, Owner, Balance};
    use eternum::alias::ID;

    fn execute(token: felt252, from: felt252, to: felt252, token_id: ID) {
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
        let maybe_balance = commands::<Balance>::try_entity(query);
        let balance = match maybe_balance {
            Option::Some(balance) => balance,
            Option::None(_) => Balance { value: 0 },
        };

        commands::set_entity(query, (Balance { value: balance.value + 1 }));
    }
}

#[system]
mod ERC721Mint {
    use traits::{Into, TryInto};
    use starknet::contract_address::Felt252TryIntoContractAddress;

    use eternum::alias::ID;
    use super::super::components::{Balance, Owner};

    fn execute(token: felt252, owner: felt252, token_id: ID) {
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
