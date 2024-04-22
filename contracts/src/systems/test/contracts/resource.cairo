#[dojo::contract]
mod test_resource_systems {
    use eternum::alias::ID;
    use eternum::constants::ResourceTypes;
    use eternum::constants::{WORLD_CONFIG_ID};
    use eternum::models::config::{WorldConfig};
    use eternum::models::resources::{Resource, ResourceTrait};
    use eternum::systems::test::interface::resource::IResourceSystems;

    fn assert_caller_is_admin(world: IWorldDispatcher) {
        let admin_address = get!(world, WORLD_CONFIG_ID, WorldConfig).admin_address;
        if admin_address != Zeroable::zero() {
            assert(starknet::get_caller_address() == admin_address, 'caller not admin');
        }
    }

    #[abi(embed_v0)]
    impl ResourceSystemsImpl of IResourceSystems<ContractState> {
        fn mint(world: IWorldDispatcher, entity_id: u128, resources: Span<(u8, u128)>,) {
            assert_caller_is_admin(world);

            let mut resources = resources;
            loop {
                match resources.pop_front() {
                    Option::Some((
                        resource_type, amount
                    )) => {
                        let (resource_type, amount) = (*resource_type, *amount);
                        assert(amount > 0, 'amount must not be 0');

                        let mut resource = get!(world, (entity_id, resource_type), Resource);
                        resource.balance += amount;
                        resource.save(world);
                    },
                    Option::None => { break; }
                };
            };
        }
    }
}

