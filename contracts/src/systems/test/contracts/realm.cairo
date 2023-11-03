#[dojo::contract]
mod test_realm_systems {

    use eternum::models::realm::Realm;
    use eternum::models::owner::Owner;
    use eternum::models::position::Position;
    use eternum::models::metadata::EntityMetadata;
    use eternum::models::combat::TownWatch;

    use eternum::systems::test::interface::realm::IRealmSystems;

    use eternum::constants::REALM_ENTITY_TYPE;

    use eternum::alias::ID;

    use starknet::ContractAddress;

    #[external(v0)]
    impl RealmSystemsImpl of IRealmSystems<ContractState> {
        fn create(
            self: @ContractState,
            world: IWorldDispatcher,
            realm_id: u128,
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
        ) -> ID {
            let entity_id = world.uuid();
            set!(world, (
                    Owner {
                        entity_id: entity_id.into(), 
                        address: owner
                    }, 
                    Realm {
                        entity_id: entity_id.into(),
                        realm_id,
                        resource_types_packed,
                        resource_types_count,
                        cities,
                        harbors,
                        rivers,
                        regions,
                        wonder,
                        order,
                    }, 
                    Position {
                        entity_id: entity_id.into(), 
                        x: position.x, 
                        y: position.y, 
                    }, 
                    EntityMetadata {
                        entity_id: entity_id.into(), 
                        entity_type: REALM_ENTITY_TYPE, 
                    },
                    TownWatch {
                        entity_id: entity_id.into(),
                        town_watch_id: world.uuid().into(),
                    }
                )
            );
            entity_id.into()
        }

    }
    
}
