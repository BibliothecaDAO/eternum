use dojo::world::WorldStorage;
use dojo::model::ModelStorage;
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

    fn transfer(ref self: Owner, new_owner: ContractAddress) {
        // ensure new owner is non zero
        assert!(new_owner.is_non_zero(), "new owner is zero");

        // ensure current owner and new owner are not the same
        assert!(self.address != new_owner, "current owner and new owner are the same");

        // set the new owner
        self.address = new_owner;
    }
}

#[generate_trait]
impl EntityOwnerCustomImpl of EntityOwnerCustomTrait {
    fn assert_caller_owner(self: EntityOwner, world: WorldStorage) {
        let owner: Owner = world.read_model(self.entity_owner_id);
        owner.assert_caller_owner();
    }

    fn owner_address(self: EntityOwner, world: WorldStorage) -> ContractAddress {
        let owner: Owner = world.read_model(self.entity_owner_id);
        owner.address
    }

    fn get_realm_id(self: EntityOwner, world: WorldStorage) -> ID {
        let realm: Realm = world.read_model(self.entity_owner_id);
        realm.realm_id
    }
}

#[cfg(test)]
mod tests {
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
    use eternum::alias::ID;
    use eternum::models::owner::{EntityOwner, EntityOwnerCustomTrait, Owner, OwnerCustomTrait};
    use eternum::models::owner::{owner, entity_owner};
    use eternum::models::realm::Realm;
    use eternum::models::realm::realm;
    use eternum::utils::testing::world::spawn_eternum_custom;
    use starknet::contract_address_const;

    #[test]
    fn owner_test_entity_owner_get_realm_id() {
        let world = spawn_eternum_custom(
            array![array![realm::TEST_CLASS_HASH, entity_owner::TEST_CLASS_HASH]], array![].span()
        );

        set!(world, Realm { entity_id: 1, realm_id: 3, produced_resources: 0, order: 0, level: 0 });
        set!(world, EntityOwner { entity_id: 2, entity_owner_id: 1 });

        let entity_owner = get!(world, (2), EntityOwner);
        let realm_id = entity_owner.get_realm_id(world);

        assert(realm_id == 3, 'wrong realm id');
    }

    #[test]
    #[should_panic(expected: "new owner is zero")]
    fn owner_test_set_zero_owner() {
        let mut owner = Owner { entity_id: 199999, address: contract_address_const::<1>() };
        owner.transfer(contract_address_const::<0>());
    }


    #[test]
    #[should_panic(expected: "current owner and new owner are the same")]
    fn owner_test_set_same_owner() {
        let mut owner = Owner { entity_id: 199999, address: contract_address_const::<1>() };
        owner.transfer(contract_address_const::<1>());
    }
}
