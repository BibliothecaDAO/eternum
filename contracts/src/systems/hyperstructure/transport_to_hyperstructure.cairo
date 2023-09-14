#[system]
mod TransportToHyperStructure {
    use eternum::alias::ID;
    use eternum::components::hyperstructure::HyperStructure;
    use eternum::components::resources::Resource;
    use eternum::components::owner::Owner;
    use eternum::components::position::Position;
    use eternum::components::config::WeightConfigImpl;
    use eternum::utils::caravan;

    use dojo::world::Context;

    use core::traits::Into;
    use core::array::{SpanTrait,ArrayTrait};
    use core::poseidon::poseidon_hash_span;
    use core::serde::Serde;
    use core::option::Option;

    #[derive(Copy, Drop, Serde)]
    struct AddedResources {
        resource_type: u8,
        amount: u32
    }

    fn execute(
        ctx: Context, entity_id: ID, hyperstructure_id: ID, caravan_id: ID, added_resources: Span<AddedResources> ) {

        let owner = get!(ctx.world, entity_id, Owner);
        assert(owner.address == ctx.origin, 'not owner of caller id');

        let caravan_owner = get!(ctx.world, caravan_id, Owner);
        assert(caravan_owner.address == ctx.origin, 'not owner of caravan id');
        
        let hyperstructure = get!(ctx.world, hyperstructure_id, HyperStructure);
        assert(hyperstructure.started_at != 0 , 'hyper structure not found');
        assert(hyperstructure.completed_at == 0, 'hyper structure completed!');


        let mut cargo = caravan::cargo::new(ctx.world.uuid().into());
        cargo.count = added_resources.len();

        let mut index = 0;
        loop {
            if index == added_resources.len() {
                break;
            }

            let AddedResources {resource_type, amount} = *added_resources[index];
            assert(amount != 0, 'material amount is 0');

            // add cargo item
            caravan::cargo::add(
                ctx.world, entity_id, cargo.cargo_id,
                index, resource_type, amount.into()
            );

            // update cargo weight 
            cargo.weight += WeightConfigImpl::get_weight(
                ctx.world, resource_type, amount.into()
            );

            index+=1;
        };


        // travel from Realm --> Hyperstructure 
        let entity_position = get!(ctx.world, entity_id, Position);
        let hyperstructure_position = get!(ctx.world, hyperstructure.entity_id, Position);

        caravan::onboard(ctx.world, caravan_id, cargo); 
        caravan::travel(ctx.world, caravan_id, entity_position, hyperstructure_position);

    }        
}

