// file containing systems used for testing
// miniting function, only for testing 
#[system]
mod MintResources {
    use traits::Into;
    use eternum::components::resources::Resource;
    use eternum::alias::ID;

    #[external]
    fn execute(realm_id: ID, resource_type: u8, amount: u128) {
        let resource_type_felt: felt252 = resource_type.into();
        let resource_query: Query = (realm_id, resource_type_felt).into();
        let maybe_resource = commands::<Resource>::try_entity(resource_query);
        let resource = match maybe_resource {
            Option::Some(resource) => resource,
            Option::None(_) => Resource { resource_type, balance: 0 },
        };

        commands::set_entity(
            resource_query, (Resource { resource_type, balance: resource.balance + amount,  }, )
        );
    }
}

#[system]
mod CreateRealm {
    use traits::Into;
    use starknet::ContractAddress;

    use eternum::components::realm::Realm;
    use eternum::components::owner::Owner;
    use eternum::components::position::Position;
    use eternum::components::entity_type::EntityType;
    use eternum::constants::REALM_ENTITY_TYPE;

    use eternum::alias::ID;

    fn execute(
        realm_id: ID,
        owner: ContractAddress,
        resource_types_packed: u128,
        resource_types_count: u8,
        cities: u8,
        harbors: u8,
        rivers: u8,
        regions: u8,
        wonder: u8,
        order: u8,
        position: Position
    ) {
        commands::<Realm>::set_entity(
            realm_id.into(),
            (
                Owner {
                    address: owner
                    }, Realm {
                    realm_id,
                    resource_types_packed,
                    resource_types_count,
                    cities,
                    harbors,
                    rivers,
                    regions,
                    wonder,
                    order,
                    }, Position {
                    x: position.x, y: position.y, 
                    }, EntityType {
                    value: REALM_ENTITY_TYPE, 
                },
            )
        );
    }
}
