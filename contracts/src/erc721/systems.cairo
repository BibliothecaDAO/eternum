#[dojo::contract]
mod ERC721Approve {
    use traits::{Into, TryInto};
    use starknet::contract_address::Felt252TryIntoContractAddress;

    use super::super::models::TokenApproval;
    use eternum::alias::ID;

    use dojo::world::Context;

    fn execute(ctx: Context, token: felt252, approved: felt252, token_id: u128) {
        // approve an address
        set !(ctx.world, 
            (token, token_id).into(), (TokenApproval { address: approved.try_into().unwrap() })
        );
    }
}

#[dojo::contract]
mod ERC721TransferFrom {
    use zeroable::Zeroable;
    use traits::{Into, TryInto};
    use starknet::contract_address::Felt252TryIntoContractAddress;

    use super::super::models::{TokenApproval, Balance};
    use eternum::models::owner::Owner;
    use eternum::alias::ID;

    use dojo::world::Context;

    fn execute(ctx: Context, token: felt252, from: felt252, to: felt252, token_id: u128) {
        let query: Query = (token, token_id).into();
        set !(ctx.world, 
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
        let balance = get !(ctx.world, query, Balance);
        set !(ctx.world, y, (Balance { value: balance.value - 1 }));

        // update new owner balance
        let query: Query = (token, to).into();
        let maybe_balance = try_get !(ctx.world, query, Balance);
        let balance = match maybe_balance {
            Option::Some(balance) => balance,
            Option::None(_) => Balance { value: 0 },
        };

        set !(ctx.world, query, (Balance { value: balance.value + 1 }));
    }
}

#[dojo::contract]
mod ERC721Mint {
    use traits::{Into, TryInto};
    use starknet::contract_address::Felt252TryIntoContractAddress;

    use eternum::alias::ID;
    use super::super::models::Balance;
    use eternum::models::owner::Owner;

    use dojo::world::Context;

    fn execute(ctx: Context, token: felt252, owner: felt252, token_id: u128) {
        // assign token to owner
        set !(ctx.world, 
            (token, token_id).into(), (Owner { address: owner.try_into().unwrap() })
        );

        let query: Query = (token, owner).into();
        // update owner's balance
        let maybe_balance = try_get !(ctx.world, query, Balance);
        let balance = match maybe_balance {
            Option::Some(balance) => balance,
            Option::None(_) => Balance { value: 0 },
        };
        fn execute(ctx: Context, y, (Balance { value: balance.value + 1 }));
    }
}
