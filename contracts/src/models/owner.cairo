use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::constants::ErrorMessages;
use eternum::models::realm::Realm;
use starknet::ContractAddress;

// contract address owning an entity
#[derive(Copy, Drop, Serde)]
#[dojo::model]
struct Owner {
    #[key]
    entity_id: u128,
    address: ContractAddress,
}

// entity owning an entity
#[derive(Copy, Drop, Serde, Default)]
#[dojo::model]
struct EntityOwner {
    #[key]
    entity_id: u128,
    entity_owner_id: u128,
}

#[generate_trait]
impl OwnerImpl of OwnerTrait {
    fn assert_caller_owner(self: Owner) {
        assert(self.address == starknet::get_caller_address(), ErrorMessages::NOT_OWNER);
    }
}

#[generate_trait]
impl EntityOwnerImpl of EntityOwnerTrait {
    fn assert_caller_owner(self: EntityOwner, world: IWorldDispatcher) {
        let owner: Owner = get!(world, self.entity_owner_id, Owner);
        owner.assert_caller_owner();
    }

    fn owner_address(self: EntityOwner, world: IWorldDispatcher) -> ContractAddress {
        return get!(world, self.entity_owner_id, Owner).address;
    }

    fn get_realm_id(self: EntityOwner, world: IWorldDispatcher) -> u128 {
        get!(world, (self.entity_owner_id), Realm).realm_id
    }
}

#[cfg(test)]
mod tests {
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
    use eternum::models::owner::{EntityOwner, EntityOwnerTrait};
    use eternum::models::realm::Realm;
    use eternum::utils::testing::spawn_eternum;

    #[test]
    #[available_gas(30000000)]
    fn test_entity_owner_get_realm_id() {
        let world = spawn_eternum();

        set!(
            world,
            Realm {
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
            }
        );

        set!(world, EntityOwner { entity_id: 2, entity_owner_id: 1 });

        let entity_owner = get!(world, (2), EntityOwner);
        let realm_id = entity_owner.get_realm_id(world);

        assert(realm_id == 3, 'wrong realm id');
    }
}
