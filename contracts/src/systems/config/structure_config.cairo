#[system]
mod SetStructureConfig {
    use eternum::components::config::StructureConfig;
    use eternum::components::structure::StructureMaterial;

    use dojo::world::Context;

    use core::poseidon::poseidon_hash_span;

    fn execute(ctx: Context, materials: Span<StructureMaterial>, structure_type: u8) {   
        // todo@credence: check if structure type and materaials are valid
        // todo@credence: check permissions

        let mut arr: Array<felt252> = array![];
        let mut index = 0;
        loop {
            if index == materials.len() {
                break;
            }

            Serde::serialize(materials[index], ref arr);

            index += 1;
        };

        let structure_composition_hash: felt252 = poseidon_hash_span(arr.span());

        let structure = get!(ctx.world, structure_composition_hash, StructureConfig);
        assert(structure.structure_type == 0, 'structure already exists');

        set!(ctx.world, (
            StructureConfig {
                structure_composition_hash,
                structure_type
            }
        ));   
    }
}
