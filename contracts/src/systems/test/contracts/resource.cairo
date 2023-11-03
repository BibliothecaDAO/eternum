use dojo::world::IWorldDispatcher;

#[starknet::interface]
trait IResourceSystems<TContractState> {
    fn mint(
        self: @TContractState, 
        world: IWorldDispatcher, 
        entity_id: u128, 
        resources: Span<(u8, u128)>, 
    );
}


#[dojo::contract]
mod test_resource_systems {
    use eternum::models::resources::Resource;
    use eternum::constants::ResourceTypes;
    use eternum::alias::ID;

    #[external(v0)]
    impl ResourceSystemsImpl of super::IResourceSystems<ContractState> {
        fn mint(
            self: @ContractState, 
            world: IWorldDispatcher, 
            entity_id: u128, 
            resources: Span<(u8, u128)>, 
        ){
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