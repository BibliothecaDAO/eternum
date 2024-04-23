#[dojo::interface]
trait INameSystems {
    fn set_address_name(name: felt252);
}

#[dojo::contract]
mod name_systems {
    use eternum::models::name::{AddressName};

    #[abi(embed_v0)]
    impl NameSystemsImpl of super::INameSystems<ContractState> {
        fn set_address_name(world: IWorldDispatcher, name: felt252) {
            let caller = starknet::get_caller_address();

            // assert that name not set
            let mut address_name = get!(world, (caller), AddressName);
            assert(address_name.name == 0, 'Name already set');
            address_name.name = name;

            set!(world, (address_name));
        }
    }
}
