use dojo::world::IWorldDispatcher;

trait IResourceSystems<TContractState> {
    fn mint(
        self: @TContractState, 
        world: IWorldDispatcher, 
        entity_id: u128, 
        resource_type: u8, 
        amount: u128
    );
    fn mint_all(self: @TContractState, world: IWorldDispatcher, entity_id: u128, amount: u128);
}


#[system]
mod resource_systems {
    use eternum::models::resources::Resource;
    use eternum::constants::ResourceTypes;
    use eternum::alias::ID;

    impl ResourceSystemsImpl of super::IResourceSystems<ContractState> {
        fn mint(
            self: @ContractState, 
            world: IWorldDispatcher, 
            entity_id: u128, 
            resource_type: u8, 
            amount: u128
        ){
            let resource = get!(world, (entity_id, resource_type), Resource);

            set!(world, (
                Resource { 
                    entity_id, 
                    resource_type, 
                    balance: resource.balance + amount,  
                }
            ));
        }


        fn mint_all(self: @ContractState, world: IWorldDispatcher, entity_id: u128, amount: u128) {
            // mint non food
            let mut resource_type: u8 = 1;
            loop {
                if resource_type > 22 {
                    break;
                }

                let resource = get!(world, (entity_id, resource_type), Resource);

                set!(world, (
                    Resource { 
                        entity_id, 
                        resource_type, 
                        balance: resource.balance + amount,  
                    } 
                ));

                resource_type+=1;
            }; 

            // shekels
            let resource = get!(world, (entity_id, ResourceTypes::SHEKELS), Resource);
            set!(world, (
                    Resource { 
                        entity_id, 
                        resource_type: ResourceTypes::SHEKELS, 
                        balance: resource.balance + amount,  
                    } 
            ));

            // wheat
            let resource = get!(world, (entity_id, ResourceTypes::WHEAT), Resource);
            set!(world, (
                    Resource { 
                        entity_id, 
                        resource_type: ResourceTypes::WHEAT,
                        balance: resource.balance + amount,  
                    } 
            ));

            // fish
            let resource = get!(world, (entity_id, ResourceTypes::FISH), Resource);
            set!(world, (
                    Resource { 
                        entity_id, 
                        resource_type: ResourceTypes::FISH, 
                        balance: resource.balance + amount,  
                    } 
            ));
        }
    }
}