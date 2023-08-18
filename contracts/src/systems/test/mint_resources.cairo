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
