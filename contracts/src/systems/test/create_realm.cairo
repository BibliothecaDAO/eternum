#[system]
mod CreateRealm {
    use traits::Into;
    use starknet::ContractAddress;

    use eternum::components::realm::Realm;
    use eternum::components::owner::Owner;
    use eternum::components::position::Position;
    use eternum::components::metadata::MetaData;
    use eternum::constants::REALM_ENTITY_TYPE;

    use eternum::alias::ID;

    use dojo::world::Context;

    fn execute(
        ctx: Context,
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
        let entity_id = ctx.world.uuid();
        set !(
            ctx.world,
            (
                Owner {
                    entity_id: entity_id.into(), address: owner
                    }, Realm {
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
                    }, Position {
                    entity_id: entity_id.into(), x: position.x, y: position.y, 
                    }, MetaData {
                    entity_id: entity_id.into(), entity_type: REALM_ENTITY_TYPE, 
                },
            )
        );
        entity_id.into()
    }
}
