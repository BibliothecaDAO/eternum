#[dojo::contract]
mod name_systems {
    use eternum::models::name::{AddressName};
    use eternum::systems::name::interface::{INameSystems};
    
    use traits::Into; 

    #[external(v0)]
    impl NameSystemsImpl of INameSystems<ContractState> {
        fn set_address_name(self: @ContractState, world: IWorldDispatcher, name: felt252) {
            let caller = starknet::get_caller_address();
            let caller_felt252: felt252 = caller.into();

            // assert that name not set
            let mut address_name = get!(world, (caller_felt252), AddressName);
            assert(address_name.name == 0, 'Name already set');
            address_name.name = name;

            set!(world, (address_name));
        }
    }
}
