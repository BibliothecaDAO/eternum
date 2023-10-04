#[system]
mod SpendResources {
    use traits::Into;

    use eternum::models::resources::Resource;
    use eternum::models::owner::Owner;
    use eternum::alias::ID;

    use dojo::world::Context;

    fn execute(ctx: Context, entity_id: u128, resource_type: u8, amount: u128) {
        // DISCUSS: will get_caller_address give the original caller address ?
        let caller = starknet::get_caller_address();

        // assert amount is non negative
        assert(amount > 0, 'amount must be positive');

        // verify owner
        let (resource, owner) = get!(ctx.world, entity_id, (Resource, Owner));
        assert(owner.address == caller, 'Only owner can spend resources');

        // assert balance is enough
        let final_balance = resource.balance - amount;
        assert(final_balance >= 0, 'Not enough balance');
        set!(ctx.world, (Resource { entity_id, resource_type, balance: final_balance,  }));
    }
}
