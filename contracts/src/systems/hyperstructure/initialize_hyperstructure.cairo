#[system]
mod InitializeHyperStructure {
    use eternum::alias::ID;
    use eternum::components::hyperstructure::HyperStructure;
    use eternum::components::resources::{Resource, ResourceCost};
    use eternum::components::owner::Owner;
    use eternum::components::position::{Coord, Position};

    use dojo::world::Context;

    fn execute(ctx: Context, entity_id:ID, hyperstructure_id: ID) {   
        
        // todo@credence: use entity_id to check that realm is in order

        let entity_owner = get!(ctx.world, entity_id, Owner);
        assert(entity_owner.address == ctx.origin, 'not owner of entity');


        let hyperstructure = get!(ctx.world, hyperstructure_id, HyperStructure);
        assert(hyperstructure.hyperstructure_type != 0, 'hyperstructure does not exist');
        assert(hyperstructure.initialized_at == 0, 'already initialized');

        let entity_position = get!(ctx.world, entity_id, Position);
        let entity_coord: Coord = entity_position.into();
        assert(entity_coord.x == hyperstructure.coord_x, 'wrong position');
        assert(entity_coord.y == hyperstructure.coord_y, 'wrong position');


        let mut index = 0;
        loop {
            if index == hyperstructure.initialization_resource_count {
                break;
            }

            // burn initialization resources from entity

            let initialization_resource = get!(ctx.world, (hyperstructure.initialization_resource_id, index), ResourceCost);
            let entity_resource = get!(ctx.world, (entity_id, initialization_resource.resource_type), Resource);
            assert(entity_resource.balance >= initialization_resource.amount, 'not enough resources');
            set!(ctx.world, (
                Resource { 
                    entity_id, 
                    resource_type: initialization_resource.resource_type, 
                    balance: entity_resource.balance - initialization_resource.amount
                }
            ));

            index += 1;
        };

        // set hyperstructure as initialized
        // and add hyperstructure to the map

        set!(ctx.world, (
             HyperStructure {
                entity_id: hyperstructure.entity_id,
                hyperstructure_type: hyperstructure.hyperstructure_type,
                initialization_resource_id: hyperstructure.initialization_resource_id,
                initialization_resource_count: hyperstructure.initialization_resource_count,
                construction_resource_id: hyperstructure.construction_resource_id,
                construction_resource_count: hyperstructure.construction_resource_count,
                initialized_at: starknet::get_block_timestamp(),
                completed_at: hyperstructure.completed_at,
                coord_x: hyperstructure.coord_x,
                coord_y: hyperstructure.coord_y
            },
            Position {
                entity_id: hyperstructure_id,
                x: hyperstructure.coord_x,
                y: hyperstructure.coord_y
            }
        ));

    }
}



#[cfg(test)]
mod tests {

    use eternum::components::position::{Coord, Position};
    use eternum::components::hyperstructure::HyperStructure;
    use eternum::components::resources::{Resource, ResourceCost};
    use eternum::components::owner::Owner;

    use eternum::constants::ResourceTypes;
    
    use eternum::utils::testing::spawn_eternum;
    
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

    use starknet::contract_address_const;

    use core::array::ArrayTrait;
    use core::serde::Serde;
    use core::traits::TryInto;
    use core::option::OptionTrait;



    fn setup() -> (IWorldDispatcher, u128, u128, Coord) {
        let world = spawn_eternum();

        let entity_id: u128 = 44;

        starknet::testing::set_contract_address(world.executor());
        set!(world, ( 
            Owner { entity_id, address: contract_address_const::<'entity'>()},
            Resource {
                entity_id,
                resource_type: ResourceTypes::STONE,
                balance: 400
            },
            Resource {
                entity_id,
                resource_type: ResourceTypes::WOOD,
                balance: 400
            },
            Position {
                entity_id,
                x: 20,
                y: 30
            }
        ));


        starknet::testing::set_contract_address(contract_address_const::<'entity'>());

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
        let hyperstructure_id: u128 = (*result[0]).try_into().unwrap();

        (world, entity_id, hyperstructure_id, hyperstructure_coord)

    }



    #[test]
    #[available_gas(3000000000000)]  
    fn test_initialize() {

        let (world, entity_id, hyperstructure_id, hyperstructure_coord) = setup();

        // update block timestamp
        starknet::testing::set_block_timestamp(1);
        // call initialize
        let mut calldata = array![];
        Serde::serialize(@entity_id, ref calldata);
        Serde::serialize(@hyperstructure_id, ref calldata);
        world.execute('InitializeHyperStructure', calldata);
        

        let hyperstructure = get!(world, hyperstructure_id, HyperStructure);
        assert(hyperstructure.initialized_at != 0, 'not initialized');

        let entity_stone_resource = get!(world, (entity_id, ResourceTypes::STONE), Resource);
        assert(entity_stone_resource.balance == 400 - 10 , 'wrong stone balance');

        let entity_wood_resource = get!(world, (entity_id, ResourceTypes::WOOD), Resource);
        assert(entity_wood_resource.balance == 400 - 13, 'wrong wood balance');

        let position = get!(world, hyperstructure_id, Position);
        assert(position.x == hyperstructure_coord.x, 'wrong x coord');
        assert(position.y == hyperstructure_coord.y, 'wrong y coord');
    }


    #[test]
    #[available_gas(3000000000000)]  
    #[should_panic(expected: ('wrong position','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED' ))]
    fn test_wrong_position() {

        let (world, entity_id, hyperstructure_id, hyperstructure_coord) = setup();

        starknet::testing::set_contract_address(world.executor());
        set!(world, ( 
            Position {
                entity_id,
                x: 50,
                y: 60
            }
        ));


        starknet::testing::set_contract_address(contract_address_const::<'entity'>());
        
        // update block timestamp
        starknet::testing::set_block_timestamp(1);
        // call initialize
        let mut calldata = array![];
        Serde::serialize(@entity_id, ref calldata);
        Serde::serialize(@hyperstructure_id, ref calldata);
        world.execute('InitializeHyperStructure', calldata);
    }

}