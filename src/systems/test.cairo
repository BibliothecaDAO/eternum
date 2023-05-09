// file containing systems used for testing
// miniting function, only for testing 
#[system]
mod MintResources {
    use traits::Into;
    use array::ArrayTrait;
    use eternum::components::resources::Resource;
    #[external]
    fn execute(realm_id: felt252, resource_id: u8, amount: u128) {
        let resource_id_felt: felt252 = resource_id.into();
        let resource_query: Query = (realm_id, resource_id_felt).into();
        let maybe_resource = commands::<Resource>::try_entity(resource_query);
        let resource = match maybe_resource {
            Option::Some(resource) => resource,
            Option::None(_) => Resource { id: resource_id, balance: 0 },
        };

        commands::set_entity(
            resource_query,
            (Resource { id: resource_id, balance: resource.balance + amount,  }, )
        );
    }
}

#[system]
mod CreateRealm {
    use eternum::components::realm::Realm;
    use traits::Into;
    use debug::PrintTrait;
    use eternum::components::owner::Owner;
    use starknet::ContractAddress;

    fn execute(
        realm_id: felt252,
        owner: ContractAddress,
        resource_ids_packed: u128,
        resource_ids_count: u8,
        cities: u8,
        harbors: u8,
        rivers: u8,
        regions: u8,
        wonder: u8,
        order: u8
    ) {
        let realm_query = realm_id.into();
        commands::<Realm>::set_entity(
            realm_query,
            (
                Owner {
                    address: owner
                    }, Realm {
                    realm_id: realm_id,
                    owner: owner,
                    resource_ids_packed: resource_ids_packed,
                    resource_ids_count: resource_ids_count,
                    cities: cities,
                    harbors: harbors,
                    rivers: rivers,
                    regions: regions,
                    wonder: wonder,
                    order: order,
                }
            )
        );
    }
}
