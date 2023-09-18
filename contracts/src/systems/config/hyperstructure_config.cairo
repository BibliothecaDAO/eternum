#[system]
mod DefineHyperStructure {
    use eternum::alias::ID;
    use eternum::components::hyperstructure::{HyperStructureResource, HyperStructure};
    use eternum::components::position::{Position, Coord};

    use dojo::world::Context;

    use core::traits::Into;
    use core::array::SpanTrait;


    fn execute(ctx: Context, hyperstructure_type: u8, mut resources: Span<(u8, usize)>, coord: Coord) -> ID {   
        
        // todo@credence: check admin permissions

        let resource_count = resources.len();
        assert(resource_count > 0, 'resources must not be empty');

        let hyperstructure_id: ID = ctx.world.uuid().into();
        let mut index = 0;
        loop {
            match resources.pop_front() {
                Option::Some((resource_type, resource_amount)) => {
                    assert(*resource_amount > 0, 'amount must not be 0');

                    set!(ctx.world, (
                        HyperStructureResource {
                            entity_id: hyperstructure_id,
                            index,
                            resource_type: *resource_type,
                            amount: *resource_amount
                        }
                    ));

                    index += 1;
                },
                Option::None => {break;}
            };
        };

        set!(ctx.world, (
            HyperStructure {
                entity_id: hyperstructure_id,
                hyperstructure_type,
                started_at: 0,
                completed_at: 0,
                resource_count: resource_count
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


#[cfg(test)]
mod tests {

    use eternum::components::hyperstructure::{HyperStructureResource, HyperStructure};
    use eternum::components::position::{Position, Coord};
    use eternum::constants::ResourceTypes;
    
    use eternum::utils::testing::spawn_eternum;
    
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

    use starknet::contract_address_const;

    use core::array::ArrayTrait;
    use core::serde::Serde;

    #[test]
    #[available_gas(3000000000000)]  
    fn test_define_hyperstructure() {
        let world = spawn_eternum();

        starknet::testing::set_contract_address(
            contract_address_const::<'entity'>()
        );

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


        let hyperstructure = get!(world, hyperstructure_id, HyperStructure);
        assert(hyperstructure.hyperstructure_type == hyperstructure_type, 
                'wrong hyperstructure_type value'
        );
        assert(hyperstructure.started_at == 0, 'wrong started_at value');
        assert(hyperstructure.completed_at == 0, 'wrong completed_at value');
        assert(hyperstructure.resource_count == 2, 'wrong resource_count value');

        let hyperstructure_stone_resource = get!(world, (hyperstructure_id, 0), HyperStructureResource);
        assert(hyperstructure_stone_resource.amount == 10, 'wrong amount value');
        assert(hyperstructure_stone_resource.resource_type == ResourceTypes::STONE, 
                'wrong resource_type value'
        );

        let hyperstructure_wood_resource = get!(world, (hyperstructure_id, 1), HyperStructureResource);
        assert(hyperstructure_wood_resource.amount == 10, 'wrong amount value');
        assert(hyperstructure_wood_resource.resource_type == ResourceTypes::WOOD, 
                'wrong resource_type value'
        );

        let hyperstructure_position = get!(world, hyperstructure_id, Position);
        assert(hyperstructure_position.x == hyperstructure_coord.x, 'wrong x value');
        assert(hyperstructure_position.y == hyperstructure_coord.y, 'wrong y value');
    }

}
