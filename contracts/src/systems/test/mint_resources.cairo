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

    fn execute(ctx: Context, realm_id: u128, resource_type: u8, amount: u128) {
        let resource_query: Query = (realm_id, resource_type).into();
        let maybe_resource = try_get !(ctx.world, resource_query, Resource);
        let resource = match maybe_resource {
            Option::Some(resource) => resource,
            Option::None(_) => Resource { resource_type, balance: 0 },
        };

        set !(
            ctx.world,
            resource_query,
            (Resource { resource_type, balance: resource.balance + amount,  }, )
        );
    }
}
