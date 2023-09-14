#[system]
mod BuildHyperStructure {
    use eternum::alias::ID;
    use eternum::components::caravan::{CaravanAttachment, Cargo, CargoItem};
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



    fn execute(ctx: Context, entity_id:ID, caravan_id: ID, hyperstructure_id: ID) {

        let owner = get!(ctx.world, entity_id, Owner);
        assert(owner.address == ctx.origin, 'not owner of caller id');

        let caravan_owner = get!(ctx.world, caravan_id, Owner);
        assert(caravan_owner.address == ctx.origin, 'caravan owner mismatch');
        
        let hyperstructure = get!(ctx.world, hyperstructure_id, HyperStructure);
        assert(hyperstructure.started_at != 0 , 'hyper structure not found');

        if (hyperstructure.completed_at != 0) {
            // if hyperstructure isn't completed,
            // release resources to hyperstructure
            let cargo = caravan::offboard(ctx.world, caravan_id);
            caravan::cargo::release(ctx.world, hyperstructure_id, cargo);  
        }


        // travel back from Hyperstructure --> Realm
        let hyperstructure_position = get!(ctx.world, hyperstructure.entity_id, Position);
        let entity_position = get!(ctx.world, entity_id, Position);

        caravan::travel(ctx.world, caravan_id, hyperstructure_position, entity_position);

    }        
}

