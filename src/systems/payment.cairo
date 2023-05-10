#[system]
mod SpendResources {
    use traits::Into;
    use eternum::components::resources::Resource;
    use eternum::components::owner::Owner;

    fn execute(entity_id: felt252, resource_id: u8, amount: u128) {
        // DISCUSS: will get_caller_address give the original caller address ?
        let caller = starknet::get_caller_address();

        // assert amount is non negative
        assert(amount > 0, 'amount must be positive');

        // verify owner
        let (resource, owner) = commands::<Resource, Owner>::entity(entity_id.into());
        assert(owner.address == caller, 'Only owner can spend resources');

        // assert balance is enough
        let final_balance = resource.balance - amount;
        assert(final_balance >= 0, 'Not enough balance');
        commands::<Resource>::set_entity(
            entity_id.into(), (Resource { id: resource_id, balance: final_balance,  })
        );
    }
}
