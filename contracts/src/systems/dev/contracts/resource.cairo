use dojo::world::IWorldDispatcher;

#[dojo::interface]
trait IResourceSystems {
    fn mint(entity_id: u128, resources: Span<(u8, u128)>,);
}

#[dojo::contract]
mod dev_resource_systems {
    use eternum::alias::ID;
    use eternum::constants::ResourceTypes;
    use eternum::constants::{WORLD_CONFIG_ID};
    use eternum::models::config::{WorldConfig};
    use eternum::models::resources::{Resource, ResourceTrait, ResourceImpl};
    use eternum::systems::config::contracts::config_systems::{assert_caller_is_admin};


    #[abi(embed_v0)]
    impl ResourceSystemsImpl of super::IResourceSystems<ContractState> {
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

                        let mut resource = ResourceImpl::get(world, (entity_id, resource_type));
                        resource.add(amount);
                        resource.save(world);
                    },
                    Option::None => { break; }
                };
            };
        }
    }
}

