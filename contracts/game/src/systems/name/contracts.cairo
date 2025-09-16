#[starknet::interface]
pub trait INameSystems<T> {
    fn set_address_name(ref self: T, name: felt252);
}

#[dojo::contract]
pub mod name_systems {
    use dojo::model::ModelStorage;
    use dojo::world::WorldStorage;
    use s1_eternum::constants::DEFAULT_NS;
    use s1_eternum::models::config::SeasonConfigImpl;
    use s1_eternum::models::name::AddressName;
    use s1_eternum::models::structure::StructureOwnerStats;

    #[abi(embed_v0)]
    pub impl NameSystemsImpl of super::INameSystems<ContractState> {
        fn set_address_name(ref self: ContractState, name: felt252) {
            // todo: limit this to only realm/village owners else it can be spammed
            let mut world: WorldStorage = self.world(DEFAULT_NS());

            // we can bypass this check because no user would own a structure
            // until the season starts
            // SeasonConfigImpl::get(world).assert_started_and_not_over();

            let caller = starknet::get_caller_address();
            let mut structure_owner_stats: StructureOwnerStats = world.read_model(caller);
            assert!(structure_owner_stats.structures_num > 0, "Caller does not own any structure");

            // assert that name not set
            let mut address_name: AddressName = world.read_model(caller);
            // assert!(address_name.name == 0, "Name already set");

            // set name
            address_name.name = name;
            world.write_model(@address_name);

            structure_owner_stats.name = name;
            world.write_model(@structure_owner_stats);
        }
    }
}
