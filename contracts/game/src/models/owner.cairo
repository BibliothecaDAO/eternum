use core::num::traits::zero::Zero;
use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use s1_eternum::alias::ID;
use s1_eternum::constants::ErrorMessages;
use s1_eternum::models::realm::Realm;
use starknet::ContractAddress;

#[generate_trait]
pub impl OwnerAddressImpl of OwnerAddressTrait {
    fn assert_caller_owner(self: ContractAddress) {
        assert(self == starknet::get_caller_address(), ErrorMessages::NOT_OWNER);
    }
    fn assert_non_zero(self: ContractAddress) {
        assert!(self.is_non_zero(), "owner is zero");
    }
}


// contract address owning an entity
#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct Owner {
    #[key]
    pub entity_id: ID,
    pub address: ContractAddress,
}


// entity owning an entity
#[derive(Introspect, Copy, Drop, Serde, Default)]
#[dojo::model]
pub struct EntityOwner {
    #[key]
    pub entity_id: ID,
    pub entity_owner_id: ID,
}

#[generate_trait]
pub impl OwnerImpl of OwnerTrait {
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
pub impl EntityOwnerImpl of EntityOwnerTrait {
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
// #[cfg(test)]
// mod tests {
//     use dojo::model::{ModelStorage, ModelStorageTest, ModelValueStorage};
//     use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
//     use dojo::world::{WorldStorage, WorldStorageTrait};
//     use dojo_cairo_test::{ContractDefTrait, NamespaceDef, TestResource};
//     use s1_eternum::alias::ID;
//     use s1_eternum::models::owner::{EntityOwner, EntityOwnerTrait, Owner, OwnerTrait};
//     use s1_eternum::models::realm::Realm;
//     use s1_eternum::utils::testing::world::spawn_eternum;
//     use starknet::contract_address_const;

//     #[test]
//     fn owner_test_entity_owner_get_realm_id() {
//         let mut world = spawn_eternum();

//         world
//             .write_model_test(
//                 @Realm { entity_id: 1, realm_id: 3, produced_resources: 0, order: 0, level: 0, has_wonder: false },
//             );
//         world.write_model_test(@EntityOwner { entity_id: 2, entity_owner_id: 1 });

//         let entity_owner: EntityOwner = world.read_model(2);
//         let realm_id = entity_owner.get_realm_id(world);

//         assert(realm_id == 3, 'wrong realm id');
//     }

//     #[test]
//     #[should_panic(expected: "new owner is zero")]
//     fn owner_test_set_zero_owner() {
//         let mut owner = Owner { entity_id: 199999, address: contract_address_const::<1>() };
//         owner.transfer(contract_address_const::<0>());
//     }

//     #[test]
//     #[should_panic(expected: "current owner and new owner are the same")]
//     fn owner_test_set_same_owner() {
//         let mut owner = Owner { entity_id: 199999, address: contract_address_const::<1>() };
//         owner.transfer(contract_address_const::<1>());
//     }
// }


