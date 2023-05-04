#[system]
mod IncreaseBalance {
    use starknet::ContractAddress;

    use traits::Into;
    use array::ArrayTrait;

    use eternum::components::resources::Resource;

    // could be id of a player, of the realm, of a vault
    fn execute(owner_id: felt252, resource_id: felt252, amount: u128) {
        let maybe_resource = commands::<Resource>::try_entity((owner_id, (resource_id)).into());

        let mut resource_balance = 0;
        match maybe_resource {
            Option::Some(resource) => {
                resource_balance = resource.balance;
            },
            Option::None(_) => {},
        }
        commands::<Resource>::set_entity(
            (owner_id, (resource_id)).into(),
            (Resource { id: resource_id, balance: resource_balance + amount }),
        )
    }
}

#[system]
mod DecreaseBalance {
    use starknet::ContractAddress;

    use traits::Into;
    use array::ArrayTrait;

    use eternum::components::resources::Resource;

    // could be id of a player, of the realm, of a vault
    fn execute(owner_id: felt252, resource_id: felt252, amount: u128) {
        let maybe_resource = commands::<Resource>::try_entity((owner_id, (resource_id)).into());

        let mut resource_balance = 0;
        match maybe_resource {
            Option::Some(resource) => {
                resource_balance = resource.balance;
            },
            Option::None(_) => {},
        }
        assert(resource_balance >= amount, 'Insufficient balance');
        commands::<Resource>::set_entity(
            (owner_id, (resource_id)).into(),
            (Resource { id: resource_id, balance: resource_balance - amount }),
        )
    }
}
