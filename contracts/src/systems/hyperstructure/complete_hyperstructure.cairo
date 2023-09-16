#[system]
mod CompleteHyperstructure {
    use eternum::alias::ID;
    use eternum::components::hyperstructure::{HyperStructure, HyperStructureResource};
    use eternum::components::resources::Resource;

    use dojo::world::Context;

    use core::traits::Into;

    fn execute(ctx: Context, hyperstructure_id: ID) {
        
        let hyperstructure = get!(ctx.world, hyperstructure_id, HyperStructure);
        assert(hyperstructure.started_at != 0 , 'hyperstructure not found');
        assert(hyperstructure.completed_at == 0 , 'hyperstructure completed');

        let mut index = hyperstructure.resource_count;
        loop {
            if index == 0 {
                break;
            }

            let hyperstructure_resource = get!(ctx.world, (hyperstructure_id, index), HyperStructureResource);
            let resource = get!(ctx.world, (hyperstructure_id, hyperstructure_resource.resource_type), Resource);
            assert(resource.balance >= hyperstructure_resource.amount.into(), 'not enough resources');
            
            index -= 1;
        };

        set!(ctx.world, (
             HyperStructure {
                entity_id: hyperstructure_id,
                started_at: hyperstructure.started_at,
                completed_at: starknet::get_block_timestamp(),
                resource_count: hyperstructure.resource_count
            }
        ));

    }        
}

