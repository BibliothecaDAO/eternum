#[dojo::contract]
mod test_resource_systems {
    use eternum::models::resources::Resource;
    use eternum::systems::config::contracts::config_systems::assert_caller_is_admin;
    use eternum::systems::test::interface::resource::IResourceSystems;
    use eternum::constants::ResourceTypes;
    use eternum::alias::ID;

    #[external(v0)]
    impl ResourceSystemsImpl of IResourceSystems<ContractState> {
        fn mint(
            self: @ContractState, 
            world: IWorldDispatcher, 
            entity_id: u128, 
            resources: Span<(u8, u128)>, 
        ){
            
            assert_caller_is_admin(world);

            let mut resources = resources;
            loop {
                match resources.pop_front() {
                    Option::Some((resource_type, amount)) => {
                        let (resource_type, amount) = (*resource_type, *amount);
                        assert(amount > 0, 'amount must not be 0');

                        let resource = get !(world, (entity_id, resource_type), Resource);

                        set!(
                            world,
                            (Resource { entity_id, resource_type, balance: resource.balance + amount,  }, )
                        );
                    },

                    Option::None => {break;}
                };
            };
        }
    }
}