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

    fn execute(ctx: Context, entity_id: u128, mut resources: Span<(u8, u128)>) {

        loop {
            match resources.pop_front() {
                Option::Some((resource_type, amount)) => {
                    let (resource_type, amount) = (*resource_type, *amount);
                    assert(amount > 0, 'amount must not be 0');

                    let resource = get !(ctx.world, (entity_id, resource_type), Resource);

                    set!(
                        ctx.world,
                        (Resource { entity_id, resource_type, balance: resource.balance + amount,  }, )
                    );
                },

                Option::None => {break;}
            };
        };
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
    fn test_mint_resources() {
        let world = spawn_eternum();

        let entity_id: u128 = 44;

        let mut calldata = array![];
        Serde::serialize(@entity_id, ref calldata);
        Serde::serialize(@array![(ResourceTypes::GOLD, 1000), (ResourceTypes::SHEKELS, 1000), (ResourceTypes::FISH, 1000), (ResourceTypes::WHEAT, 1000)].span(), ref calldata);
        world.execute('MintResources', calldata);

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
