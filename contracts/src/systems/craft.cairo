#[system]
mod Craft {
    use eternum::alias::ID;
    use eternum::components::structure::{Structure, StructureMaterial};
    use eternum::components::resources::Resource;
    use eternum::components::owner::Owner;
    use eternum::components::config::StructureConfig;

    use dojo::world::Context;

    use core::traits::Into;
    use core::array::{SpanTrait,ArrayTrait};
    use core::poseidon::poseidon_hash_span;
    use core::serde::Serde;



    fn execute(ctx: Context, caller_id: ID, materials: Span<StructureMaterial>) -> ID {

        let mut materials_felt_array: Array<felt252> = array![];
        let mut i = 0;
        loop {
            if i == materials.len() {
                break;
            }

            let material: StructureMaterial = *materials[i];
            assert(material.amount != 0, 'material amount is 0');


            let owner = get!(ctx.world, caller_id, Owner);
            assert(owner.address == ctx.origin, 'not owner of caller id');

            let caller_resource = get!(ctx.world, (caller_id, material.resource_type), Resource);
            assert(caller_resource.balance >= material.amount, 'not enough resources');

            set!(ctx.world, (
                Resource { 
                    entity_id: caller_resource.entity_id, 
                    resource_type: caller_resource.resource_type, 
                    balance: caller_resource.balance - material.amount
                }
            ));

            Serde::serialize(@material, ref materials_felt_array);

            i+=1;
        };
        

        let structure_composition_hash: felt252 = poseidon_hash_span(materials_felt_array.span());
        let structure_config = get!(ctx.world, structure_composition_hash, StructureConfig);
        assert(structure_config.structure_type != 0 , 'no structure found');

        // create and assign the structure
        let structure_id: ID = ctx.world.uuid().into();
        set!(ctx.world, (
            Structure {
                entity_id: structure_id,
                structure_type: structure_config.structure_type
            },
            Owner {
                entity_id: structure_id,
                address: ctx.origin
            }
        ));


        structure_id
    }        
}