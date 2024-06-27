#[dojo::interface]
trait INameSystems {
    fn set_address_name(ref world: IWorldDispatcher, name: felt252);
    fn set_entity_name(ref world: IWorldDispatcher, entity_id: u128, name: felt252);
}

#[dojo::contract]
mod name_systems {
    use eternum::models::name::{AddressName, EntityName};
    use eternum::models::owner::{Owner, OwnerTrait, EntityOwner, EntityOwnerTrait};

    #[abi(embed_v0)]
    impl NameSystemsImpl of super::INameSystems<ContractState> {
        fn set_address_name(ref world: IWorldDispatcher, name: felt252) {
            let caller = starknet::get_caller_address();

            // assert that name not set
            let mut address_name = get!(world, (caller), AddressName);
            assert(address_name.name == 0, 'Name already set');
            address_name.name = name;

            set!(world, (address_name));
        }

        fn set_entity_name(ref world: IWorldDispatcher, entity_id: u128, name: felt252) {
            get!(world, entity_id, EntityOwner).assert_caller_owner(world);

            set!(world, (EntityName { entity_id, name }));
        }
    }
}
