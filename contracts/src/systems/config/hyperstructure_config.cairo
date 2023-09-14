#[system]
mod DefineHyperStructure {
    use eternum::alias::ID;
    use eternum::components::hyperstructure::{HyperStructureResource, HyperStructure};
    use eternum::components::position::{Position, Coord};

    use dojo::world::Context;

    use core::poseidon::poseidon_hash_span;
    use core::traits::Into;
    use core::array::{SpanTrait};

    #[derive(Copy, Drop, Serde)]
    struct ReqiuredResource {
        resource_type: u8,
        amount: usize
    }

    fn execute(ctx: Context, resources: Span<ReqiuredResource>, coord: Coord) -> ID {   

        // todo@credence: check admin permissions
        // todo@credence: maybe ensure resources aren't duplicated

        let hyperstructure_id: ID = ctx.world.uuid().into();
        let mut index = 0;
        loop {
            if index == resources.len() {
                break;
            }

            let resource: ReqiuredResource = *resources[index];
            assert(resource.amount > 0, 'amount must not be 0');


            set!(ctx.world, (
                HyperStructureResource {
                    entity_id: hyperstructure_id,
                    index,
                    resource_type: resource.resource_type,
                    amount: resource.amount
                }
            ));

            index += 1;
        };


        set!(ctx.world, (
            HyperStructure {
                entity_id: hyperstructure_id,
                started_at: starknet::get_block_timestamp(),
                completed_at: 0,
                resource_count: resources.len(),
            },
            Position {
                entity_id: hyperstructure_id,
                x: coord.x,
                y: coord.y
            }
        ));  

        hyperstructure_id 
    }
}
