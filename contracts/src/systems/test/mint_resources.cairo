// file containing systems used for testing
// miniting function, only for testing 
// TODO: remvoe these systems from tests since we can now
// set storage directly in the tests without using systems
#[system]
mod MintResources {
    use traits::Into;
    use eternum::components::resources::Resource;
    use eternum::alias::ID;

    use dojo::world::Context;

    fn execute(ctx: Context, entity_id: u128, resource_type: u8, amount: u128) {
        let resource = get !(ctx.world, (entity_id, resource_type), Resource);

        set!(
            ctx.world,
            (Resource { entity_id, resource_type, balance: resource.balance + amount,  }, )
        );
    }
}

#[system]
mod MintAllResources {
    use traits::Into;
    use eternum::components::resources::Resource;
    use eternum::constants::ResourceTypes;
    use eternum::alias::ID;

    use dojo::world::Context;

    fn execute(ctx: Context, entity_id: u128, amount: u128) {

        // mint non food
        let mut resource_type: u8 = 1;
        loop {
            if resource_type > 22 {
                break;
            }

            let resource = get !(ctx.world, (entity_id, resource_type), Resource);

            set!(
                ctx.world,
                (Resource { entity_id, resource_type, balance: resource.balance + amount,  }, )
            );

            resource_type+=1;
            
        }; 

        // shekels
        let resource = get !(ctx.world, (entity_id, ResourceTypes::SHEKELS), Resource);
        set!(
            ctx.world,
            (Resource { entity_id, resource_type: ResourceTypes::SHEKELS, balance: resource.balance + amount,  }, )
        );

        // wheat
        let resource = get !(ctx.world, (entity_id, ResourceTypes::WHEAT), Resource);
        set!(
            ctx.world,
            (Resource { entity_id, resource_type: ResourceTypes::WHEAT, balance: resource.balance + amount,  }, )
        );

        // fish
        let resource = get !(ctx.world, (entity_id, ResourceTypes::FISH), Resource);
        set!(
            ctx.world,
            (Resource { entity_id, resource_type: ResourceTypes::FISH, balance: resource.balance + amount,  }, )
        );
    }
}


#[cfg(test)]
mod tests {
    use eternum::components::resources::Resource;
    
    use eternum::utils::testing::spawn_eternum;

    use eternum::constants::ResourceTypes;

    use dojo::world::IWorldDispatcherTrait;

    use core::array::ArrayTrait;
    use core::serde::Serde;

    #[test]
    #[available_gas(3000000000000)]  
    fn test_mint_all_resources() {
        let world = spawn_eternum();

        let entity_id: u128 = 44;

        let mut calldata = array![];
        Serde::serialize(@entity_id, ref calldata);
        Serde::serialize(@1000, ref calldata);
        world.execute('MintAllResources', calldata);

        let gold_resource = get!(world, (entity_id, ResourceTypes::GOLD), Resource);
        assert(gold_resource.balance == 1000, 'resource amount not right');

        let no_resource = get!(world, (entity_id, 0), Resource);
        assert(no_resource.balance == 0, 'resource amount not right');

        let no_resource = get!(world, (entity_id, 23), Resource);
        assert(no_resource.balance == 0, 'resource amount not right');


        // shekels
        let shekels = get!(world, (entity_id, 253), Resource);
        assert(shekels.balance == 1000, 'shekels amount not right');

        // food
        let wheat = get!(world, (entity_id, 254), Resource);
        assert(wheat.balance == 1000, 'wheat amount not right');
        let fish = get!(world, (entity_id, 255), Resource);
        assert(fish.balance == 1000, 'fish amount not right');
    }

}
