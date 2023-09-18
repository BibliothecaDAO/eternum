#[system]
mod InitializeHyperStructure {
    use eternum::alias::ID;
    use eternum::components::hyperstructure::HyperStructure;
    use eternum::components::owner::Owner;


    use dojo::world::Context;

    fn execute(ctx: Context, entity_id:ID, hyperstructure_id: ID) {   
        
        // todo@credence: use entity_id to check that realm is in order
        let entity_owner = get!(ctx.world, entity_id, Owner);
        assert(entity_owner.address == ctx.origin, 'not owner of entity');


        let hyperstructure = get!(ctx.world, hyperstructure_id, HyperStructure);
        assert(hyperstructure.resource_count != 0, 'hyperstructure does not exist');
        assert(hyperstructure.started_at == 0, 'already initialized');

        set!(ctx.world, (
             HyperStructure {
                entity_id: hyperstructure_id,
                hyperstructure_type: hyperstructure.hyperstructure_type,
                started_at: starknet::get_block_timestamp(),
                completed_at: 0,
                resource_count: hyperstructure.resource_count
            },
        ));

    }
}

#[cfg(test)]
mod tests {

    use eternum::components::position::Coord;
    use eternum::components::resources::Resource;
    use eternum::components::hyperstructure::HyperStructure;
    use eternum::components::owner::Owner;

    use eternum::constants::ResourceTypes;
    
    use eternum::utils::testing::spawn_eternum;
    
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

    use starknet::contract_address_const;

    use core::array::ArrayTrait;
    use core::serde::Serde;

    #[test]
    #[available_gas(3000000000000)]  
    fn test_initialize() {
        let world = spawn_eternum();

        let entity_id: u128 = 44;

        starknet::testing::set_contract_address(world.executor());
        set!(world, ( 
            Owner { entity_id, address: contract_address_const::<'entity'>()}
        ));


        starknet::testing::set_contract_address(contract_address_const::<'entity'>());

        let hyperstructure_type = 1_u8;
        let hyperstructure_resources = array![
            (ResourceTypes::STONE, 10_u8), // 10 stone
            (ResourceTypes::WOOD, 10_u8)  // 10 wood
        ];
        let hyperstructure_coord = Coord{ x:20, y:30 };


        let mut calldata = array![];
        Serde::serialize(@hyperstructure_type, ref calldata);
        Serde::serialize(@hyperstructure_resources, ref calldata); 
        Serde::serialize(@hyperstructure_coord, ref calldata);
        let result = world.execute('DefineHyperStructure', calldata);
        let hyperstructure_id = *result[0];



        // update block timestamp
        starknet::testing::set_block_timestamp(1);
        let mut calldata = array![];
        Serde::serialize(@entity_id, ref calldata);
        Serde::serialize(@hyperstructure_id, ref calldata);
        world.execute('InitializeHyperStructure', calldata);


        let hyperstructure = get!(world, hyperstructure_id, HyperStructure);
        assert(hyperstructure.started_at != 0, 'not initialized');
    }

}