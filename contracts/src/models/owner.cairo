use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::alias::ID;
use eternum::constants::ErrorMessages;
use eternum::models::realm::Realm;
use starknet::ContractAddress;

// contract address owning an entity
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Owner {
    #[key]
    entity_id: ID,
    address: ContractAddress,
}

// entity owning an entity
#[derive(IntrospectPacked, Copy, Drop, Serde, Default)]
#[dojo::model]
pub struct EntityOwner {
    #[key]
    entity_id: ID,
    entity_owner_id: ID,
}

#[generate_trait]
impl OwnerCustomImpl of OwnerCustomTrait {
    fn assert_caller_owner(self: Owner) {
        assert(self.address == starknet::get_caller_address(), ErrorMessages::NOT_OWNER);
    }
}

#[generate_trait]
impl EntityOwnerCustomImpl of EntityOwnerCustomTrait {
    fn assert_caller_owner(self: EntityOwner, world: IWorldDispatcher) {
        let owner: Owner = get!(world, self.entity_owner_id, Owner);
        owner.assert_caller_owner();
    }

    fn owner_address(self: EntityOwner, world: IWorldDispatcher) -> ContractAddress {
        return get!(world, self.entity_owner_id, Owner).address;
    }

    fn get_realm_id(self: EntityOwner, world: IWorldDispatcher) -> ID {
        get!(world, (self.entity_owner_id), Realm).realm_id
    }
}

#[cfg(test)]
mod tests {
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
    use eternum::alias::ID;
    use eternum::models::owner::{EntityOwner, EntityOwnerCustomTrait};
    use eternum::models::realm::Realm;
    use eternum::utils::testing::world::spawn_eternum;

    #[test]
    #[available_gas(300000000)]
    fn owner_test_entity_owner_get_realm_id() {
        let world = spawn_eternum();

        set!(
            world,
            Realm {
                entity_id: 1,
                realm_id: 3,
                produced_resources: 0,
                cities: 0,
                harbors: 0,
                rivers: 0,
                regions: 0,
                wonder: 0,
                order: 0,
                level: 0
            }
        );

        set!(world, EntityOwner { entity_id: 2, entity_owner_id: 1 });

        let entity_owner = get!(world, (2), EntityOwner);
        let realm_id = entity_owner.get_realm_id(world);

        assert(realm_id == 3, 'wrong realm id');
    }
}
