use starknet::ContractAddress;

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

use eternum::models::realm::Realm;
 
// contract address owning an entity
#[derive(Model, Copy, Drop, Serde)]
struct Owner {
    #[key]
    entity_id: u128,
    address: ContractAddress,
}

// entity owning an entity
#[derive(Model, Copy, Drop, Serde)]
struct EntityOwner {
    #[key]
    entity_id: u128,
    entity_owner_id: u128,
}


#[generate_trait]
impl EntityOwnerImpl of EntityOwnerTrait {
    fn get_realm_id(self: EntityOwner, world: IWorldDispatcher) -> u128 {
        get!(world, (self.entity_owner_id), Realm).realm_id
    }
}

#[cfg(test)]
mod tests {
    use eternum::utils::testing::spawn_eternum;
    use eternum::models::realm::Realm;
    use eternum::models::owner::{EntityOwner, EntityOwnerTrait};

    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

    #[test]
    #[available_gas(30000000)]
    fn test_entity_owner_get_realm_id() {
        let world = spawn_eternum();

        set!(world, Realm {
                entity_id: 1,
                realm_id: 3,
                resource_types_packed: 0,
                resource_types_count: 0,
                cities: 0,
                harbors: 0,
                rivers: 0,
                regions: 0,
                wonder: 0,
                order: 0,
        });

        set!(world, EntityOwner {
            entity_id: 2,
            entity_owner_id: 1
        });

        let entity_owner = get!(world, (2), EntityOwner);
        let realm_id = entity_owner.get_realm_id(world);

        assert(realm_id == 3, 'wrong realm id');
    }

}
