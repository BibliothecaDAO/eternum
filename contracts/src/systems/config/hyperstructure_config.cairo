#[system]
mod DefineHyperStructure {
    use eternum::alias::ID;
    use eternum::models::hyperstructure::HyperStructure;
    use eternum::models::resources::ResourceCost;
    use eternum::models::position::{Position, Coord};

    use dojo::world::Context;

    use core::traits::Into;
    use core::array::SpanTrait;


    fn execute(ctx: Context, 
                hyperstructure_type: u8, 
                mut initialization_resources: Span<(u8, u128)>, 
                mut construction_resources: Span<(u8, u128)>, 
                coord: Coord
            ) -> ID {   
        
        // todo@credence: check admin permissions
        
        let initialization_resource_count = initialization_resources.len();
        assert(initialization_resource_count > 0, 'resources must not be empty');

        let construction_resource_count = construction_resources.len();
        assert(construction_resource_count > 0, 'resources must not be empty');

        // create initialization resource cost components
        let initialization_resource_id: ID = ctx.world.uuid().into();
        let mut index = 0;
        loop {
            match initialization_resources.pop_front() {
                Option::Some((resource_type, resource_amount)) => {
                    assert(*resource_amount > 0, 'amount must not be 0');

                    set!(ctx.world, (
                        ResourceCost {
                            entity_id: initialization_resource_id,
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


        // create construction resource cost components
        let construction_resource_id: ID = ctx.world.uuid().into();
        let mut index = 0;
        loop {
            match construction_resources.pop_front() {
                Option::Some((resource_type, resource_amount)) => {
                    assert(*resource_amount > 0, 'amount must not be 0');

                    set!(ctx.world, (
                        ResourceCost {
                            entity_id: construction_resource_id,
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


        let hyperstructure_id: ID = ctx.world.uuid().into();

        set!(ctx.world, (
            HyperStructure {
                entity_id: hyperstructure_id,
                hyperstructure_type,
                initialization_resource_id,
                initialization_resource_count,
                construction_resource_id,
                construction_resource_count,
                initialized_at: 0,
                completed_at: 0,
                coord_x: coord.x,
                coord_y: coord.y
            }
        ));  

        hyperstructure_id 
    }
}


#[cfg(test)]
mod tests {

    use eternum::models::hyperstructure::HyperStructure;
    use eternum::models::resources::ResourceCost;
    use eternum::models::position::{Position, Coord};
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
        let initialization_resources = array![
            (ResourceTypes::STONE, 10_u8), // 10 stone
            (ResourceTypes::WOOD, 13_u8)  // 13 wood
        ];
        let construction_resources = array![
            (ResourceTypes::STONE, 40_u8), // 40 stone
            (ResourceTypes::WOOD, 50_u8)  // 50 wood
        ];
        let hyperstructure_coord = Coord{ x:20, y:30 };


        let mut calldata = array![];
        Serde::serialize(@hyperstructure_type, ref calldata);
        Serde::serialize(@initialization_resources, ref calldata); 
        Serde::serialize(@construction_resources, ref calldata); 
        Serde::serialize(@hyperstructure_coord, ref calldata);
        let result = world.execute('DefineHyperStructure', calldata);
        let hyperstructure_id = *result[0];


        let hyperstructure = get!(world, hyperstructure_id, HyperStructure);
        assert(hyperstructure.hyperstructure_type == hyperstructure_type, 
                'wrong hyperstructure_type value'
        );
        assert(hyperstructure.initialized_at == 0, 'wrong initialized_at value');
        assert(hyperstructure.completed_at == 0, 'wrong completed_at value');
        assert(hyperstructure.initialization_resource_count == 2, 'wrong resource count');
        assert(hyperstructure.construction_resource_count == 2, 'wrong resource count');

        let hyperstructure = get!(world, hyperstructure_id, HyperStructure);

        let hyperstructure_initialization_stone_cost = get!(world, (hyperstructure.initialization_resource_id, 0), ResourceCost);
        assert(hyperstructure_initialization_stone_cost.amount == 10, 'wrong amount value');
        assert(hyperstructure_initialization_stone_cost.resource_type == ResourceTypes::STONE, 
                'wrong resource_type value'
        );


        let hyperstructure_initialization_wood_cost = get!(world, (hyperstructure.initialization_resource_id, 1), ResourceCost);
        assert(hyperstructure_initialization_wood_cost.amount == 13, 'wrong amount value');
        assert(hyperstructure_initialization_wood_cost.resource_type == ResourceTypes::WOOD, 
                'wrong resource_type value'
        );

        let hyperstructure_construction_stone_cost = get!(world, (hyperstructure.construction_resource_id, 0), ResourceCost);
        assert(hyperstructure_construction_stone_cost.amount == 40, 'wrong amount value');
        assert(hyperstructure_construction_stone_cost.resource_type == ResourceTypes::STONE, 
                'wrong resource_type value'
        );


        let hyperstructure_construction_wood_cost = get!(world, (hyperstructure.construction_resource_id, 1), ResourceCost);
        assert(hyperstructure_construction_wood_cost.amount == 50, 'wrong amount value');
        assert(hyperstructure_construction_wood_cost.resource_type == ResourceTypes::WOOD, 
                'wrong resource_type value'
        );


        assert(hyperstructure.coord_x == hyperstructure_coord.x, 'wrong x value');
        assert(hyperstructure.coord_y == hyperstructure_coord.y, 'wrong y value');
    }

}
