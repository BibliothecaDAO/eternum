#[system]
mod InitializeHyperStructure {
    use eternum::alias::ID;
    use eternum::components::hyperstructure::HyperStructure;

    use dojo::world::Context;

    fn execute(ctx: Context, entity_id:ID, hyperstructure_id: ID) {   

        // todo@credence: use entity_id to check that realm is in order

        let hyperstructure = get!(ctx.world, hyperstructure_id, HyperStructure);
        assert(hyperstructure.resource_count != 0, 'hyperstructure does not exist');
        assert(hyperstructure.started_at == 0, 'already initialized');

        set!(ctx.world, (
             HyperStructure {
                entity_id: hyperstructure_id,
                started_at: starknet::get_block_timestamp(),
                completed_at: 0,
                resource_count: hyperstructure.resource_count
            },
        ));

    }
}
