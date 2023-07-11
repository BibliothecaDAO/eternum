// Creates a tick system which is called before Realm state change
// TODO for a next milestone
#[system]
mod TickSystem {
    use array::ArrayTrait;
    use traits::Into;

    use eternum::alias::ID;
    use eternum::components::tick::Tick;

    use dojo::world::Context;

    fn execute(ctx: Context, realm_id: ID) { // auth function - can only be called by approved systems
    // Can only be approved modules

    // Adjust state on Realm

    }
}
